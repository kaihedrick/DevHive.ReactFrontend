# Realtime Messaging & Project Contacts Architecture

This document describes the backend architecture for project contacts (members) and realtime messaging in DevHive.

## ⚠️ CRITICAL UPDATE (2025-12-28): WebSocket Client CamelCase Fix

**Issue**: Frontend was sending `project_id` (snake_case) in subscribe payload, but AWS Lambda backend expects `projectId` (camelCase).

**Fix Applied**:
1. ✅ Subscribe payload now sends `{ action: "subscribe", projectId: "uuid" }` (camelCase)
2. ✅ All event handlers prioritize `message.projectId` over `message.project_id`
3. ✅ Debug logging added to confirm subscribe success/failure
4. ✅ Documentation updated to reflect camelCase requirement

**Files Changed**:
- `src/services/cacheInvalidationService.ts` - Subscribe payload, event handlers, debug logging
- `.agent/System/realtime_messaging.md` - Documentation examples and API reference

**Testing**: Look for `✅ Subscribe acknowledged by backend:` in browser console to confirm subscription success.

---

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
- **Dual Real-time System**: Immediate application broadcasts + database-triggered cache invalidation
- WebSocket is used for **cache invalidation**, not direct chat
- Messages are created via REST API, then broadcast via WebSocket
- PostgreSQL NOTIFY provides reliable event sourcing from the database layer
- **Immediate Updates**: Application broadcasts provide instant real-time messaging
- **Cache Consistency**: Database triggers ensure frontend caches stay in sync
- **Reliability**: If WebSocket connection drops, database triggers still work

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
| `subscribe` | `{ action: "subscribe", projectId: "uuid" }` | Subscribe to project updates (uses camelCase projectId) |
| `leave_project` | `{ project_id: "uuid" }` | Unsubscribe from project |
| `ping` | - | Keepalive ping |
| `pong` | - | Keepalive response |

**CRITICAL**: Backend expects `projectId` (camelCase), not `project_id` (snake_case) in subscribe payload. Using `project_id` will result in "project_id required" error from backend.

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

| Table | Trigger Name | Events | Status |
|-------|--------------|--------|
| `projects` | `projects_cache_invalidate` | INSERT, UPDATE, DELETE | ✅ Active |
| `sprints` | `sprints_cache_invalidate` | INSERT, UPDATE, DELETE | ✅ Active |
| `tasks` | `tasks_cache_invalidate` | INSERT, UPDATE, DELETE | ✅ Active |
| `project_members` | `project_members_cache_invalidate` | INSERT, UPDATE, DELETE | ✅ Active |
| `messages` | `messages_cache_invalidate` | INSERT, UPDATE, DELETE | ❌ **MISSING** - Messages table has NO database trigger |

**CRITICAL ISSUE:** The `messages` table is completely missing from the database triggers! Backend has dual real-time system:

1. **Immediate Application Broadcasts**: `broadcast.Send()` calls in handlers (should send `message_created` events)
2. **Database Triggers**: PostgreSQL NOTIFY triggers (send `cache_invalidate` events)

But messages table has neither! This explains why users must logout/login to see messages. See [Fix Message Realtime Updates](../Tasks/fix_message_realtime_updates.md) for implementation plan.

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
// 1. Connect to WebSocket (environment-specific URLs)
const ws = new WebSocket('wss://ws.devhive.it.com?token=your-jwt-token'); // Production
// OR for local development:
// const ws = new WebSocket('ws://localhost:8080/api/v1/messages/ws?token=your-jwt-token');

// 2. Authentication via query parameter
// JWT token is passed in the query parameter for browser compatibility
// Backend validates the token and establishes authenticated connection

// 3. Environment-specific URLs
| Environment | WebSocket URL |
|-------------|---------------|
| Production  | `wss://ws.devhive.it.com?token=<jwt>` |
| Local Dev   | `ws://localhost:8080/api/v1/messages/ws?token=<jwt>` |

// 4. Handle connection open
ws.onopen = () => {
    // Subscribe to project updates
    // CRITICAL: Backend expects projectId (camelCase), not project_id (snake_case)
    ws.send(JSON.stringify({
        action: 'subscribe',
        projectId: 'your-project-uuid'
    }));
    console.log('⏳ Waiting for subscribe acknowledgment from backend...');
};

// 5. Handle incoming messages - Dual System Support
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    // Log incoming messages for debugging
    console.log('📨 WS Event received:', message);

    // Special logging for subscribe response to confirm success/failure
    if (message.type === 'reconnect' || message.message === 'subscribed') {
        console.log('✅ Subscribe acknowledged by backend:', message);
    }

    // BACKEND SENDS TWO TYPES OF MESSAGES:
    // Backend sends camelCase projectId in events, with snake_case project_id as fallback

    // Type 1: Immediate Application Broadcasts (e.g., message_created from broadcast.Send())
    // These have the event type directly in message.type
    switch (message.type) {
        case 'member_added':
        case 'member_removed':
            // Prioritize camelCase projectId over snake_case project_id
            const memberProjectId = message.projectId || message.project_id;
            queryClient.invalidateQueries(['projects', memberProjectId]);
            queryClient.invalidateQueries(['projectMembers', memberProjectId]);
            queryClient.invalidateQueries(['projects', 'bundle', memberProjectId]);
            break;

        case 'message_created':
            // IMMEDIATE BROADCAST: New message via broadcast.Send() in handler
            // Prioritize camelCase projectId over snake_case project_id
            const messageProjectId = message.projectId || message.project_id;
            console.log('💬 New message via immediate broadcast:', message.data);
            // Use predicate-based invalidation (no userId dependency)
            queryClient.invalidateQueries({
                predicate: (q) => {
                    const k = q.queryKey;
                    return (
                        Array.isArray(k) &&
                        k[0] === 'messages' &&
                        k.includes('project') &&
                        k.includes(messageProjectId)
                    );
                },
                refetchType: 'active', // Ensures immediate refetch
            });
            break;

        case 'task_created':
        case 'task_updated':
        case 'task_deleted':
        case 'sprint_created':
        case 'sprint_updated':
        case 'sprint_deleted':
        case 'project_updated':
            // Handle other immediate broadcasts
            console.log('📡 Immediate broadcast received:', message.type);
            // Invalidate appropriate caches based on event type
            break;

        case 'cache_invalidate':
            // Type 2: Database Trigger Events (from PostgreSQL NOTIFY)
            // These have resource/action/project_id structure
            console.log('🔄 Cache invalidate from database trigger:', message);

            // Support both nested and flat payload formats
            let payload = message.data && typeof message.data === 'object' && 'resource' in message.data
                ? message.data
                : message;

            const resource = payload.resource;
            // Prioritize camelCase projectId over snake_case project_id
            const project_id = payload.projectId || payload.project_id;

            if (resource === 'message' || resource === 'messages') {
                // Use predicate-based invalidation (no userId dependency)
                queryClient.invalidateQueries({
                    predicate: (q) => {
                        const k = q.queryKey;
                        return (
                            Array.isArray(k) &&
                            k[0] === 'messages' &&
                            k.includes('project') &&
                            k.includes(project_id)
                        );
                    },
                    refetchType: 'active',
                });
            } else if (resource === 'project_members') {
                queryClient.invalidateQueries(['projectMembers', project_id]);
            } else if (resource === 'task' || resource === 'tasks') {
                queryClient.invalidateQueries(['tasks', 'list', 'project', project_id]);
            }
            // Handle other resource types...
            break;

        default:
            console.log('⚠️ Unknown WebSocket message type:', message.type);
    }
};

// 5. Handle errors and reconnection
ws.onerror = (error) => console.error('WebSocket error:', error);
ws.onclose = () => {
    // Implement reconnection logic with exponential backoff
};
```

### Authentication Options

**Current Implementation: Query Parameter**
```typescript
const ws = new WebSocket(`wss://ws.devhive.it.com?token=${accessToken}`);
```

**Why Query Parameter:**
- Browser WebSocket API doesn't support custom headers
- Query parameter provides secure token transmission
- Token is validated by backend on connection establishment
- Maintains compatibility with existing JWT authentication system

**Environment URLs:**
- **Production:** `wss://ws.devhive.it.com?token=<jwt>` (AWS API Gateway, no path needed)
- **Development:** `ws://localhost:8080/api/v1/messages/ws?token=<jwt>` (Go backend)

### Sending Messages

**CRITICAL:** Messages are sent via REST API, and cache invalidation happens **only via WebSocket** to prevent double-fetch issues.

```typescript
// React Query mutation (no onSuccess invalidation)
export const useSendMessage = () => {
  return useMutation({
    mutationFn: (messageData: { projectId: string; content: string; messageType?: string }) =>
      sendMessage(messageData),
    // No onSuccess invalidation - WebSocket handles cache invalidation
  });
};

// REST API call
const sendMessage = async (messageData) => {
  const response = await fetch(`/api/v1/projects/${messageData.projectId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      content: messageData.content,
      messageType: messageData.messageType || 'text'
    })
  });
  return response.json();
};
```

**Message Sending Flow:**
```
1. User sends message via useSendMessage mutation
2. POST /api/v1/projects/{projectId}/messages
3. Backend creates message in database
4. Backend broadcasts message_created via WebSocket
5. Frontend WebSocket handler receives message_created
6. invalidateProjectMessages(projectId) called
7. React Query refetches active message queries
8. UI updates with new message
```

**Why No onSuccess Invalidation?**
- Prevents double-fetch (mutation + WebSocket both invalidating)
- Consistent update path for all clients (sender + receivers)
- Better performance (only one refetch per message)
- Simpler logic (cache invalidation centralized in WebSocket handler)

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

## Related Documentation

- [Project Architecture](./project_architecture.md) - Overall system architecture
- [Caching Strategy](./caching_strategy.md) - How WebSocket cache invalidation works
- [Authentication Architecture](./authentication_architecture.md) - Token management for WebSocket
- [Invite Management](./invite_management.md) - Project invite system

