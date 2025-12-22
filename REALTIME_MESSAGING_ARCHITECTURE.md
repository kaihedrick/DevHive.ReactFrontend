# Realtime Messaging & Project Contacts Architecture

This document describes the backend architecture for project contacts (members) and realtime messaging in DevHive.

## Table of Contents

- [Overview](#overview)
- [Project Contacts (Members)](#project-contacts-members)
- [Realtime Messaging System](#realtime-messaging-system)
- [WebSocket Implementation](#websocket-implementation)
- [PostgreSQL NOTIFY System](#postgresql-notify-system)
- [Firebase Integration](#firebase-integration)
- [API Reference](#api-reference)
- [Frontend Integration Guide](#frontend-integration-guide)

---

## Overview

DevHive uses a hybrid architecture for realtime features:

| Component | Technology | Purpose |
|-----------|------------|---------|
| Project Members | PostgreSQL + REST API | Contact/member management |
| Realtime Updates | PostgreSQL NOTIFY + WebSocket | Cache invalidation broadcasts |
| Message Storage | PostgreSQL | Persistent message history |
| Authentication | JWT + Firebase Auth (optional) | Token verification |

**Key Design Decisions:**
- WebSocket is used for **cache invalidation**, not direct chat
- Messages are created via REST API, then broadcast via WebSocket
- PostgreSQL NOTIFY provides reliable event sourcing from the database layer

---

## Project Contacts (Members)

### Database Schema

**File:** `cmd/devhive-api/migrations/001_initial_schema.sql`

```sql
CREATE TABLE project_members (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);
```

### Member Roles

| Role | Permissions |
|------|-------------|
| `owner` | Full control, cannot be removed |
| `admin` | Manage members, edit project settings |
| `member` | Create/edit tasks, view all content |
| `viewer` | Read-only access |

### Canonical Model

Project owners are automatically added to `project_members` table (Migration 009). This ensures:
- Consistent member queries (owners appear in member lists)
- Simplified permission checks
- Single source of truth for project access

### Project Invites

**File:** `cmd/devhive-api/migrations/005_add_project_invites.sql`

```sql
CREATE TABLE project_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invite_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ,
    max_uses INT DEFAULT 1,
    used_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Invite Flow:**
1. Admin/owner creates invite with optional expiration and usage limits
2. Invite token is shared with invitee
3. Invitee accepts invite (authenticated endpoint)
4. User is added to `project_members` with `member` role

---

## Realtime Messaging System

### Message Schema

**File:** `cmd/devhive-api/migrations/001_initial_schema.sql`

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
    parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Message Types

| Type | Description |
|------|-------------|
| `text` | Plain text message |
| `image` | Image attachment (URL in content) |
| `file` | File attachment (URL in content) |

### Threading Support

Messages support threading via `parent_message_id`. When set, the message is a reply to another message.

---

## WebSocket Implementation

### Architecture

**Files:**
- `internal/ws/hub.go` - Hub and client management
- `internal/http/handlers/message.go` - WebSocket endpoint handler

### Hub Structure

```go
type Hub struct {
    clients    map[*Client]bool  // All connected clients
    broadcast  chan []byte       // Broadcast channel
    Register   chan *Client      // Client registration
    unregister chan *Client      // Client removal
    mutex      sync.RWMutex      // Thread safety
}

type Client struct {
    conn      *websocket.Conn
    userID    string
    projectID string            // Scoped to specific project
    send      chan []byte       // Outbound messages
    hub       *Hub
}
```

### Message Format

```go
type Message struct {
    Type      string      `json:"type"`       // "cache_invalidate", "ping", "pong"
    Resource  string      `json:"resource"`   // "project", "sprint", "task", "project_member"
    Action    string      `json:"action"`     // "INSERT", "UPDATE", "DELETE"
    Data      interface{} `json:"data"`       // Payload data
    ProjectID string      `json:"project_id"`
    UserID    string      `json:"user_id"`
}
```

### Connection Lifecycle

**Client Connection:**
```
1. Client connects to /api/v1/messages/ws
2. JWT token validated (header, cookie, or query param)
3. Client registered with Hub
4. Client sends "join_project" message with project_id
5. Client receives broadcasts for that project
```

**Keepalive:**
- Ping interval: 54 seconds
- Read deadline: 60 seconds
- Write deadline: 10 seconds

### Supported Client Messages

| Type | Payload | Description |
|------|---------|-------------|
| `join_project` | `{ project_id: "uuid" }` | Subscribe to project updates |
| `leave_project` | `{ project_id: "uuid" }` | Unsubscribe from project |
| `init` | - | Initialization acknowledgment |
| `ping` | - | Keepalive ping |
| `pong` | - | Keepalive response |

### Broadcasting Logic

```go
// Project-level events -> broadcast to project clients only
hub.BroadcastToProject(projectID, "cache_invalidate", data)

// Global events (project create/delete, member changes) -> broadcast to all
hub.BroadcastToAll("cache_invalidate", data)
```

---

## PostgreSQL NOTIFY System

### How It Works

**File:** `internal/db/notify_listener.go`

1. **Database Triggers** fire on table changes
2. **pg_notify()** sends event to `cache_invalidate` channel
3. **NotifyListener** receives events on dedicated connection
4. **Hub broadcasts** event to connected WebSocket clients

### Trigger Setup

**File:** `cmd/devhive-api/migrations/007_ensure_notify_triggers.sql`

```sql
CREATE OR REPLACE FUNCTION notify_cache_invalidation() RETURNS trigger AS $$
DECLARE
    notification_payload JSONB;
    record_data RECORD;
    resource_name TEXT;
    target_project_id UUID;
BEGIN
    -- Determine which record to use
    IF TG_OP = 'DELETE' THEN
        record_data := OLD;
    ELSE
        record_data := NEW;
    END IF;

    -- Normalize resource names (plural -> singular)
    resource_name := CASE TG_TABLE_NAME
        WHEN 'projects' THEN 'project'
        WHEN 'sprints' THEN 'sprint'
        WHEN 'tasks' THEN 'task'
        ELSE TG_TABLE_NAME
    END;

    -- Build notification payload
    notification_payload := jsonb_build_object(
        'resource', resource_name,
        'id', record_data.id::text,
        'action', TG_OP,
        'project_id', target_project_id::text,
        'timestamp', now()::text
    );

    PERFORM pg_notify('cache_invalidate', notification_payload::text);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### Monitored Tables

| Table | Trigger Name | Events |
|-------|--------------|--------|
| `projects` | `projects_cache_invalidate` | INSERT, UPDATE, DELETE |
| `sprints` | `sprints_cache_invalidate` | INSERT, UPDATE, DELETE |
| `tasks` | `tasks_cache_invalidate` | INSERT, UPDATE, DELETE |
| `project_members` | `project_members_cache_invalidate` | INSERT, UPDATE, DELETE |

### Notification Payload

```json
{
    "resource": "task",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "action": "UPDATE",
    "project_id": "550e8400-e29b-41d4-a716-446655440001",
    "timestamp": "2024-01-15T10:30:00Z"
}
```

### Listener Implementation

```go
type NotifyListener struct {
    databaseURL string
    hub         *ws.Hub
    conn        *pgx.Conn  // Dedicated connection (not from pool)
    ctx         context.Context
    cancel      context.CancelFunc
}

func (l *NotifyListener) Start() error {
    // 1. Connect to database
    // 2. LISTEN cache_invalidate
    // 3. Loop: receive notifications, parse, broadcast
}
```

**Important:** The listener uses a **dedicated database connection** separate from the connection pool to ensure notifications are received immediately without blocking other queries.

---

## Firebase Integration

### Current Status

**File:** `config/firebase.go`

Firebase is **initialized but minimally used**:

```go
var (
    FirebaseApp     *firebase.App
    FirebaseAuth    *auth.Client      // Token verification
    FirebaseStorage *storage.Client   // File storage
)
```

### Configuration

```bash
# Option 1: Base64-encoded credentials (production/Fly.io)
FIREBASE_JSON_BASE64=<base64-encoded-service-account-json>

# Option 2: File path (local development)
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=firebase-service-account.json

# Storage bucket
FIREBASE_STORAGE_BUCKET=your-bucket.appspot.com
```

### Available Functions

| Function | Purpose |
|----------|---------|
| `InitFirebase()` | Initialize Firebase app and clients |
| `VerifyFirebaseToken(idToken)` | Validate Firebase ID tokens |
| `GetFirebaseStorageBucket()` | Get storage bucket name |

### What's NOT Implemented

- **Firebase Cloud Messaging (FCM)** - No push notifications
- **Firebase Realtime Database** - Not used, PostgreSQL handles all data
- **Firestore** - Not used

---

## API Reference

### Project Members

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/projects/{projectId}/members` | List project members |
| PUT | `/api/v1/projects/{projectId}/members/{userId}` | Add member to project |
| DELETE | `/api/v1/projects/{projectId}/members/{userId}` | Remove member |

### Project Invites

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/projects/{projectId}/invites` | Required | Create invite |
| GET | `/api/v1/projects/{projectId}/invites` | Required | List project invites |
| DELETE | `/api/v1/projects/{projectId}/invites/{inviteId}` | Required | Revoke invite |
| GET | `/api/v1/invites/{inviteToken}` | None | Get invite details |
| POST | `/api/v1/invites/{inviteToken}/accept` | Required | Accept invite |

### Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/projects/{projectId}/messages` | List messages (paginated) |
| POST | `/api/v1/projects/{projectId}/messages` | Create message |
| GET | `/api/v1/messages` | List messages with filtering |
| GET | `/api/v1/messages/ws` | WebSocket connection |
| GET | `/api/v1/projects/{projectId}/ws/status` | Debug: connection count |

### Message Request/Response

**Create Message Request:**
```json
{
    "content": "Hello, team!",
    "messageType": "text",
    "parentMessageId": "optional-uuid-for-threading"
}
```

**Message Response:**
```json
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "projectId": "550e8400-e29b-41d4-a716-446655440001",
    "senderId": "550e8400-e29b-41d4-a716-446655440002",
    "content": "Hello, team!",
    "messageType": "text",
    "parentMessageId": null,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
}
```

---

## Frontend Integration Guide

### WebSocket Connection

```typescript
// 1. Connect to WebSocket
const ws = new WebSocket('wss://api.devhive.com/api/v1/messages/ws');

// 2. Set auth header (or use cookie)
// Note: WebSocket doesn't support custom headers in browser
// Use cookie-based auth or pass token as query param (deprecated)

// 3. Handle connection open
ws.onopen = () => {
    // Join a project room
    ws.send(JSON.stringify({
        type: 'join_project',
        project_id: 'your-project-uuid'
    }));
};

// 4. Handle incoming messages
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'cache_invalidate') {
        // Invalidate relevant cache
        const { resource, action, data, project_id } = message;

        switch (resource) {
            case 'task':
                queryClient.invalidateQueries(['tasks', project_id]);
                break;
            case 'sprint':
                queryClient.invalidateQueries(['sprints', project_id]);
                break;
            case 'project_member':
                queryClient.invalidateQueries(['members', project_id]);
                break;
        }
    }
};

// 5. Handle errors and reconnection
ws.onerror = (error) => console.error('WebSocket error:', error);
ws.onclose = () => {
    // Implement reconnection logic with exponential backoff
};
```

### Authentication Options

**Option 1: Cookie (Recommended)**
```typescript
// Set httpOnly cookie on login
// WebSocket will automatically include cookies
```

**Option 2: Query Parameter (Deprecated)**
```typescript
const ws = new WebSocket(`wss://api.devhive.com/api/v1/messages/ws?token=${accessToken}`);
```

### Sending Messages

```typescript
// Messages are sent via REST API, not WebSocket
const response = await fetch(`/api/v1/projects/${projectId}/messages`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
        content: 'Hello, team!',
        messageType: 'text'
    })
});

// WebSocket will broadcast cache_invalidate to all project members
// Frontend should listen and refetch messages
```

---

## Server Startup Sequence

**File:** `cmd/devhive-api/main.go`

```
1. Load environment configuration
2. Connect to PostgreSQL database
3. Run database migrations
4. Verify NOTIFY triggers are installed
5. Start WebSocket Hub (goroutine)
6. Start PostgreSQL NOTIFY Listener (goroutine)
7. Create HTTP router with Hub reference
8. Start gRPC server (port 8081)
9. Start HTTP server (port 8080)
```

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `github.com/gorilla/websocket` | v1.5.x | WebSocket implementation |
| `github.com/jackc/pgx/v5` | v5.x | PostgreSQL driver + NOTIFY |
| `firebase.google.com/go/v4` | v4.x | Firebase Admin SDK |
| `github.com/golang-jwt/jwt/v5` | v5.x | JWT validation |
| `github.com/go-chi/chi/v5` | v5.x | HTTP routing |
| `google.golang.org/grpc` | v1.x | gRPC server |

---

## Future Considerations

### Potential Improvements

1. **Firebase Cloud Messaging (FCM)** - Add push notifications for mobile/offline users
2. **Message Read Receipts** - Track which users have read messages
3. **Typing Indicators** - Real-time "user is typing" status
4. **Direct Messages** - User-to-user messaging outside projects
5. **Message Reactions** - Emoji reactions to messages
6. **File Upload Integration** - Direct file upload to Firebase Storage

### Scaling Considerations

- **Multiple Server Instances:** Current architecture assumes single server. For horizontal scaling, consider Redis pub/sub for cross-instance WebSocket broadcasting
- **Connection Limits:** Monitor WebSocket connection counts; consider load balancing with sticky sessions
- **Database Connection Pool:** NOTIFY listener uses dedicated connection; ensure pool size accounts for this
