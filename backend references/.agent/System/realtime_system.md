# DevHive Backend - Real-time System

## Related Documentation
- [Project Architecture](./project_architecture.md) - Overall system architecture
- [Database Schema](./database_schema.md) - Cache invalidation triggers
- [SOP: AWS Deployment](../SOP/aws_deployment.md) - Deploying WebSocket infrastructure

## Overview

DevHive implements a **real-time notification system** with two deployment modes:

### Production (AWS Lambda)
1. **AWS API Gateway WebSocket API** - Manages WebSocket connections
2. **DynamoDB** - Stores connection state (connectionId, projectId, userId)
3. **Broadcaster Lambda** - Pushes messages to connected clients
4. **HTTP Lambda** - Invokes broadcaster on data changes

### Local Development
1. **PostgreSQL NOTIFY/LISTEN** - Database-level change notifications
2. **Gorilla WebSocket** - Direct WebSocket connections
3. **In-memory Hub** - Central message broker

Both architectures enable **instant cache invalidation** and **real-time collaboration** without polling.

---

## AWS Production Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AWS API Gateway WebSocket API                     │
│            Custom Domain: wss://ws.devhive.it.com                    │
│            Direct: wss://er7oc4a3o5.execute-api.../prod              │
├─────────────────────────────────────────────────────────────────────┤
│  Routes: $connect | $disconnect | subscribe | unsubscribe | $default │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   devhive-websocket Lambda    │
                    │   (cmd/websocket/main.go)     │
                    │   - JWT validation on connect │
                    │   - Store connection in DDB   │
                    │   - Handle subscribe/unsub    │
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │      DynamoDB Table           │
                    │   devhive-ws-connections      │
                    │   ┌─────────────────────────┐ │
                    │   │ connectionId (PK)       │ │
                    │   │ projectId (GSI)         │ │
                    │   │ userId                  │ │
                    │   │ connectedAt             │ │
                    │   │ ttl (24h auto-expire)   │ │
                    │   └─────────────────────────┘ │
                    └───────────────────────────────┘
                                    ▲
                                    │ Query by projectId
                                    │
┌───────────────────┐     invokes   │
│   devhive-api     │──────────────►│
│   Lambda          │               │
│   (HTTP handler)  │    ┌──────────┴──────────────┐
│   - Creates task  │    │  devhive-broadcaster    │
│   - Updates data  │    │  Lambda                 │
│   - Calls Send()  │    │  (cmd/broadcaster/)     │
└───────────────────┘    │  - Query DDB for conns  │
                         │  - POST to each client   │
                         │  - Clean stale conns     │
                         └─────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   API Gateway Management API   │
                    │   PostToConnection()           │
                    │   - Pushes message to client   │
                    └───────────────────────────────┘
```

---

## Local Development Architecture

```
┌─────────────────┐
│   PostgreSQL    │
│   Triggers      │ NOTIFY 'cache_invalidate'
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ NOTIFY Listener │ (Dedicated PG connection)
│ notify_listener │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  WebSocket Hub  │ (Central message broker)
│   global hub    │
└────────┬────────┘
         │
         ▼
    ┌────┴────┬────────┬─────────┐
    ▼         ▼        ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐ ...
│Client 1│ │Client 2│ │Client N│
└────────┘ └────────┘ └────────┘
   (WS)      (WS)       (WS)
```

---

## Component 1: Database NOTIFY Triggers

### Overview

PostgreSQL triggers fire on INSERT/UPDATE/DELETE operations and send notifications via `pg_notify()`.

**Migration:** `004_add_cache_invalidation_triggers.sql`

### Trigger Function: `notify_cache_invalidation()`

```sql
CREATE OR REPLACE FUNCTION notify_cache_invalidation()
RETURNS TRIGGER AS $$
DECLARE
  notification_payload JSONB;
  project_uuid UUID;
  record_id TEXT;
BEGIN
  -- Extract project_id based on table name
  IF TG_TABLE_NAME = 'projects' THEN
    project_uuid := COALESCE(NEW.id, OLD.id);
  ELSIF TG_TABLE_NAME = 'sprints' THEN
    project_uuid := COALESCE(NEW.project_id, OLD.project_id);
  ELSIF TG_TABLE_NAME = 'tasks' THEN
    project_uuid := COALESCE(NEW.project_id, OLD.project_id);
  ELSIF TG_TABLE_NAME = 'project_members' THEN
    project_uuid := COALESCE(NEW.project_id, OLD.project_id);
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Build record ID (composite key for project_members)
  IF TG_TABLE_NAME = 'project_members' THEN
    record_id := COALESCE(NEW.project_id::text || ':' || NEW.user_id::text,
                          OLD.project_id::text || ':' || OLD.user_id::text);
  ELSE
    record_id := COALESCE(NEW.id::text, OLD.id::text);
  END IF;

  -- Build JSON payload
  notification_payload := json_build_object(
    'resource', TG_TABLE_NAME,
    'id', record_id,
    'action', TG_OP,
    'project_id', project_uuid::text,
    'timestamp', NOW()
  );

  -- Send notification on 'cache_invalidate' channel
  PERFORM pg_notify('cache_invalidate', notification_payload::text);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

### Applied Triggers

| Table | Trigger Name | Events |
|-------|--------------|--------|
| `projects` | `projects_cache_invalidate` | INSERT, UPDATE, DELETE |
| `sprints` | `sprints_cache_invalidate` | INSERT, UPDATE, DELETE |
| `tasks` | `tasks_cache_invalidate` | INSERT, UPDATE, DELETE |
| `project_members` | `project_members_cache_invalidate` | INSERT, UPDATE, DELETE |

### Notification Payload Format

```json
{
  "resource": "tasks",
  "id": "uuid-of-record",
  "action": "UPDATE",
  "project_id": "project-uuid",
  "timestamp": "2025-12-22T12:00:00.123456Z"
}
```

**Fields:**
- `resource` - Table name (projects, sprints, tasks, project_members)
- `id` - Record UUID (or composite key for project_members)
- `action` - SQL operation (INSERT, UPDATE, DELETE)
- `project_id` - Project UUID for filtering
- `timestamp` - Notification time

**Channel:** `cache_invalidate` (single channel for all resource types)

---

## Component 2: NOTIFY Listener

### Overview

A dedicated PostgreSQL connection listens for NOTIFY messages and forwards them to the WebSocket hub.

**File:** `internal/db/notify_listener.go`

### Implementation

```go
func StartNotifyListener(databaseURL string, hub *ws.Hub) {
    go func() {
        conn, err := pgx.Connect(context.Background(), databaseURL)
        if err != nil {
            log.Fatal("Failed to connect to database for NOTIFY listener:", err)
        }
        defer conn.Close(context.Background())

        // Listen on 'cache_invalidate' channel
        _, err = conn.Exec(context.Background(), "LISTEN cache_invalidate")
        if err != nil {
            log.Fatal("Failed to LISTEN on cache_invalidate:", err)
        }

        // Infinite loop waiting for notifications
        for {
            notification, err := conn.WaitForNotification(context.Background())
            if err != nil {
                log.Printf("Error waiting for notification: %v", err)
                continue
            }

            // Parse JSON payload
            var payload NotificationPayload
            if err := json.Unmarshal([]byte(notification.Payload), &payload); err != nil {
                log.Printf("Error parsing notification: %v", err)
                continue
            }

            // Broadcast to WebSocket clients in the affected project
            hub.BroadcastToProject(
                payload.ProjectID,
                "cache_invalidate",
                payload,
            )
        }
    }()
}
```

### Startup Sequence

**File:** `cmd/devhive-api/main.go`

```go
// 1. Start WebSocket hub first
ws.StartWebSocketHub()

// 2. Start NOTIFY listener (requires hub to be running)
dbnotify.StartNotifyListener(cfg.DatabaseURL, ws.GlobalHub)

// 3. Start HTTP server with WebSocket routes
```

**Critical:** Hub must be started before listener to avoid nil pointer errors.

---

## Component 3: WebSocket Hub

### Overview

The hub is a **central message broker** that:
- Manages all active WebSocket connections
- Routes messages to specific clients based on project_id
- Handles client registration/unregistration

**File:** `internal/ws/hub.go`

### Hub Structure

```go
type Hub struct {
    clients    map[*Client]bool
    broadcast  chan []byte
    Register   chan *Client
    unregister chan *Client
    mutex      sync.RWMutex
}

var GlobalHub *Hub // Singleton instance
```

### Hub.Run() - Main Event Loop

```go
func (h *Hub) Run() {
    for {
        select {
        case client := <-h.Register:
            h.mutex.Lock()
            h.clients[client] = true
            h.mutex.Unlock()

        case client := <-h.unregister:
            h.mutex.Lock()
            if _, ok := h.clients[client]; ok {
                delete(h.clients, client)
                close(client.send)
            }
            h.mutex.Unlock()

        case message := <-h.broadcast:
            h.mutex.RLock()
            for client := range h.clients {
                select {
                case client.send <- message:
                default:
                    close(client.send)
                    delete(h.clients, client)
                }
            }
            h.mutex.RUnlock()
        }
    }
}
```

### Hub.BroadcastToProject()

Sends messages only to clients subscribed to a specific project.

```go
func (h *Hub) BroadcastToProject(projectID string, messageType string, data interface{}) {
    msg := Message{
        Type:      messageType,
        Data:      data,
        ProjectID: projectID,
    }

    msgBytes, _ := json.Marshal(msg)

    h.mutex.RLock()
    for client := range h.clients {
        if client.projectID == projectID {
            select {
            case client.send <- msgBytes:
            default:
                close(client.send)
                delete(h.clients, client)
            }
        }
    }
    h.mutex.RUnlock()
}
```

---

## Component 4: WebSocket Clients

### Client Structure

```go
type Client struct {
    conn      *websocket.Conn
    userID    string
    projectID string
    send      chan []byte
    hub       *Hub
}
```

**Fields:**
- `conn` - WebSocket connection
- `userID` - Authenticated user ID
- `projectID` - Current project subscription (can change via messages)
- `send` - Buffered channel for outgoing messages (256 buffer)
- `hub` - Reference to global hub

### Client Lifecycle

1. **Connection:**
   - Client connects to `GET /api/v1/messages/ws?token=<jwt>&projectId=<uuid>`
   - Handler validates JWT token
   - Creates new `Client` instance
   - Registers with hub

2. **Message Loop:**
   - **ReadPump:** Reads incoming messages from WebSocket
   - **WritePump:** Writes outgoing messages to WebSocket

3. **Disconnection:**
   - Unregister from hub
   - Close send channel
   - Close WebSocket connection

### ReadPump - Incoming Messages

```go
func (c *Client) ReadPump() {
    defer func() {
        c.hub.unregister <- c
        c.conn.Close()
    }()

    c.conn.SetReadLimit(512)
    c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
    c.conn.SetPongHandler(func(string) error {
        c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
        return nil
    })

    for {
        _, message, err := c.conn.ReadMessage()
        if err != nil {
            break
        }

        var msg Message
        json.Unmarshal(message, &msg)
        c.handleMessage(msg)
    }
}
```

### WritePump - Outgoing Messages

```go
func (c *Client) WritePump() {
    ticker := time.NewTicker(54 * time.Second)
    defer func() {
        ticker.Stop()
        c.conn.Close()
    }()

    for {
        select {
        case message, ok := <-c.send:
            if !ok {
                c.conn.WriteMessage(websocket.CloseMessage, []byte{})
                return
            }
            c.conn.WriteMessage(websocket.TextMessage, message)

        case <-ticker.C:
            // Send ping every 54 seconds
            c.conn.WriteMessage(websocket.PingMessage, nil)
        }
    }
}
```

### Message Handling

```go
func (c *Client) handleMessage(msg Message) {
    switch msg.Type {
    case "join_project":
        c.projectID = msg.ProjectID
        log.Printf("Client joined project: %s", msg.ProjectID)

    case "leave_project":
        c.projectID = ""
        log.Printf("Client left project")

    case "init", "ping", "pong":
        // Protocol control messages - no action needed
    }
}
```

---

## AWS WebSocket Components (Production)

The following components are used in the AWS Lambda deployment instead of the local Hub/NOTIFY architecture.

### Component A: WebSocket Lambda Handler

**File:** `cmd/websocket/main.go`

Handles all WebSocket events from API Gateway:

```go
func handler(ctx context.Context, request events.APIGatewayWebsocketProxyRequest) (events.APIGatewayProxyResponse, error) {
    routeKey := request.RequestContext.RouteKey
    connectionID := request.RequestContext.ConnectionID

    switch routeKey {
    case "$connect":
        return handleConnect(ctx, request)    // Validate JWT, store in DynamoDB
    case "$disconnect":
        return handleDisconnect(ctx, connectionID)  // Remove from DynamoDB
    case "subscribe":
        return handleSubscribe(ctx, request)   // Update projectId in DynamoDB
    case "unsubscribe":
        return handleUnsubscribe(ctx, request) // Clear projectId
    default:
        return handleDefault(ctx, request)     // Handle ping/pong
    }
}
```

#### Connection Flow

1. **$connect**: Client connects with `?token=<jwt>` (project_id is optional)
   - Validates JWT token
   - Stores connection in DynamoDB with 24h TTL
   - **Note:** `projectId` uses `omitempty` tag - empty values are not stored (DynamoDB GSI keys cannot be empty strings)
   - Returns 200 OK or 401 Unauthorized

2. **subscribe**: Client sends `{"action": "subscribe", "project_id": "uuid"}`
   - Updates connection record with projectId
   - Enables receiving broadcasts for that project

3. **unsubscribe**: Client sends `{"action": "unsubscribe"}`
   - Removes projectId from connection record (uses `REMOVE projectId`)

4. **$disconnect**: Client disconnects
   - Removes connection from DynamoDB

### Component B: Broadcaster Lambda

**File:** `cmd/broadcaster/main.go`

Pushes messages to all clients subscribed to a project:

```go
func handler(ctx context.Context, event BroadcastEvent) error {
    // 1. Query DynamoDB for connections with this projectId (using GSI)
    connections, _ := getProjectConnections(ctx, event.ProjectID)

    // 2. Create API Gateway Management API client
    apiClient := apigatewaymanagementapi.NewFromConfig(cfg, func(o *apigatewaymanagementapi.Options) {
        o.BaseEndpoint = aws.String(wsEndpoint)
    })

    // 3. Send message to each connection
    for _, conn := range connections {
        apiClient.PostToConnection(ctx, &apigatewaymanagementapi.PostToConnectionInput{
            ConnectionId: aws.String(conn.ConnectionID),
            Data:         payload,
        })
    }

    // 4. Clean up stale connections (PostToConnection failures)
    return nil
}
```

### Component C: Broadcast Client

**File:** `internal/broadcast/client.go`

Called by HTTP handlers to trigger broadcasts:

```go
// In your handler after creating a task:
broadcast.Send(ctx, task.ProjectID, broadcast.EventTaskCreated, taskData)

// Available event types:
const (
    EventTaskCreated     = "task_created"
    EventTaskUpdated     = "task_updated"
    EventTaskDeleted     = "task_deleted"
    EventSprintCreated   = "sprint_created"
    EventMessageCreated  = "message_created"
    EventCacheInvalidate = "cache_invalidate"
)
```

The `Send()` function invokes the broadcaster Lambda asynchronously (`InvocationType: "Event"`).

### DynamoDB Table Schema

**Table Name:** `devhive-ws-connections`

| Attribute | Type | Description |
|-----------|------|-------------|
| `connectionId` | String (PK) | API Gateway connection ID |
| `projectId` | String (GSI, optional) | Project being subscribed to |
| `userId` | String | Authenticated user ID |
| `connectedAt` | String | ISO8601 connection timestamp |
| `ttl` | Number | Unix timestamp for auto-expiry (24h) |

**Global Secondary Index:** `projectId-index` on `projectId` for efficient queries.

**Important:** The `projectId` attribute uses `omitempty` in the Go struct - when a client connects without subscribing to a project, the attribute is omitted entirely (not stored as empty string). This is required because DynamoDB GSI keys cannot be empty strings.

---

## Message Flow Example

### Example: User Creates a Task (AWS Lambda - Production)

1. **API Request:**
   ```
   POST https://xxx.execute-api.us-west-2.amazonaws.com/api/v1/projects/{projectId}/tasks
   { "title": "New Task", "status": 0 }
   ```

2. **HTTP Lambda Handler:**
   ```go
   // In task handler after successful insert:
   broadcast.Send(ctx, projectID, broadcast.EventTaskCreated, taskData)
   ```

3. **Broadcaster Lambda Invoked (async):**
   ```go
   // Queries DynamoDB for connections subscribed to this project
   connections := getProjectConnections(ctx, projectID)
   ```

4. **API Gateway Management API:**
   ```go
   // For each connection, push the message
   apiClient.PostToConnection(ctx, &PostToConnectionInput{
       ConnectionId: conn.ConnectionID,
       Data:         payload,
   })
   ```

5. **Clients Receive via WebSocket:**
   ```json
   {
     "type": "task_created",
     "project_id": "project-uuid",
     "data": { "id": "task-uuid", "title": "New Task", ... },
     "timestamp": "2025-12-22T12:00:00Z"
   }
   ```

6. **Frontend Handles:**
   ```typescript
   // React Query invalidates cache
   queryClient.invalidateQueries(['tasks', projectId]);
   // UI re-fetches and updates automatically
   ```

### Example: User Creates a Task (Local Development)

1. **API Request:**
   ```
   POST http://localhost:8080/api/v1/projects/{projectId}/tasks
   { "title": "New Task", "status": 0 }
   ```

2. **Database Insert:**
   ```sql
   INSERT INTO tasks (project_id, title, status) VALUES ($1, $2, $3);
   ```

3. **PostgreSQL Trigger Fires:**
   ```sql
   NOTIFY 'cache_invalidate', '{"resource": "tasks", "action": "INSERT", ...}'
   ```

4. **NOTIFY Listener → Hub → Clients:**
   ```go
   hub.BroadcastToProject("project-uuid", "cache_invalidate", payload)
   ```

5. **Frontend receives and handles as above**

---

## WebSocket Protocol

### Connection URL

**Production (AWS) - Custom Domain:**
```
wss://ws.devhive.it.com?token=<jwt>&project_id=<uuid>
```

**Production (AWS) - Direct API Gateway:**
```
wss://er7oc4a3o5.execute-api.us-west-2.amazonaws.com/prod?token=<jwt>&project_id=<uuid>
```

**Local Development:**
```
ws://localhost:8080/api/v1/messages/ws?token=<jwt>&projectId=<uuid>
```

**Query Parameters:**
- `token` - JWT access token for authentication
- `project_id` / `projectId` - Initial project to subscribe to

### Client → Server Messages

**AWS WebSocket API (uses `action` field for routing):**
```json
// Subscribe to a project
{
  "action": "subscribe",
  "project_id": "uuid-here"
}

// Unsubscribe from project
{
  "action": "unsubscribe"
}

// Ping for keepalive
{
  "action": "ping"
}
```

**Local Development (uses `type` field):**
```json
// Join a project
{
  "type": "join_project",
  "project_id": "uuid-here"
}

// Leave a project
{
  "type": "leave_project"
}

// Health check
{
  "type": "ping"
}
```

### Server → Client Messages

```json
// Cache invalidation
{
  "type": "cache_invalidate",
  "resource": "tasks",
  "action": "UPDATE",
  "project_id": "uuid-here",
  "data": {
    "id": "task-uuid",
    "timestamp": "2025-12-22T12:00:00Z"
  }
}

// Ping (keepalive)
{
  "type": "ping"
}
```

### Health Checks

- **Server → Client Ping:** Every 54 seconds
- **Client Response:** Pong frame (automatic via browser WebSocket API)
- **Read Timeout:** 60 seconds (if no pong received, disconnect)

---

## Frontend Integration

### WebSocket Connection Setup

```typescript
const ws = new WebSocket(
  `ws://localhost:8080/api/v1/messages/ws?token=${accessToken}&projectId=${projectId}`
);

ws.onopen = () => {
  console.log('WebSocket connected');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'cache_invalidate') {
    // Invalidate React Query cache for affected resource
    queryClient.invalidateQueries([message.resource, message.project_id]);
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('WebSocket disconnected');
  // Attempt reconnection with exponential backoff
};
```

### React Query Integration

```typescript
// Automatically refetch when cache is invalidated
const { data: tasks } = useQuery(
  ['tasks', projectId],
  () => fetchTasks(projectId),
  {
    staleTime: Infinity, // Never auto-refetch
    cacheTime: 30 * 60 * 1000, // 30 minutes
  }
);

// WebSocket message handler calls:
// queryClient.invalidateQueries(['tasks', projectId]);
```

---

## Performance Characteristics

### Scalability

- **Hub Capacity:** Single hub instance can handle ~10,000 concurrent connections
- **Database NOTIFY:** Minimal overhead (< 1KB payload)
- **Message Delivery:** O(n) where n = clients in project (filtered broadcast)

### Latency

- **Trigger → Client:** Typically < 100ms
- **Database NOTIFY:** ~1-5ms
- **Hub Processing:** ~1-2ms
- **WebSocket Delivery:** ~10-50ms (network dependent)

### Memory Usage

- **Per Client:** ~4KB (Client struct + send channel buffer)
- **10,000 clients:** ~40MB
- **Hub Overhead:** ~1MB (map structures)

---

## Monitoring & Debugging

### Debug Endpoint: WebSocket Status

**Endpoint:** `GET /api/v1/projects/{projectId}/ws/status`

**Response:**
```json
{
  "total_clients": 142,
  "project_clients": 5,
  "user_ids": ["user-uuid-1", "user-uuid-2", ...]
}
```

**Use Case:** Check how many clients are connected to a project.

### Logging

**Hub Logs:**
- Client registered/unregistered with total count
- Broadcast details (type, project, matching clients)

**Listener Logs:**
- NOTIFY payload received
- Parsing errors
- Broadcast calls

**Client Logs:**
- Join/leave project events
- Unknown message types

### Common Issues

**Issue: Clients not receiving notifications**
- Check client.projectID matches notification project_id
- Verify NOTIFY listener is running
- Check trigger installed on table

**Issue: NOTIFY listener not starting**
- Check DATABASE_URL connection string
- Verify GlobalHub is not nil
- Check PostgreSQL LISTEN permissions

**Issue: WebSocket disconnects frequently**
- Check ping/pong health checks
- Verify network stability
- Check for client-side errors

---

## Security Considerations

### Authentication

- **WebSocket connection:** Requires valid JWT token in query parameter
- **Token validation:** Happens on connection handshake
- **Token expiration:** Client should reconnect with new token when access token expires

**Note:** Current implementation accepts token in URL, which can expose tokens in logs. Consider moving to initial message after connection.

### Authorization

- **Project filtering:** Clients only receive notifications for their subscribed project
- **No cross-project leakage:** Hub filters by client.projectID
- **User verification:** Should verify user is member of project (not enforced currently)

### Rate Limiting

- **No rate limits on WebSocket messages currently**
- **Consider adding:** Max messages per second per client
- **NOTIFY payloads:** Limited by database (< 8KB recommended)

---

## Future Enhancements

### Planned Improvements

1. **Authentication Enhancement:**
   - Move token from URL to initial message
   - Verify project membership on join_project message

2. **Message Types:**
   - Direct messages (user-to-user)
   - Typing indicators
   - Presence (online/offline status)

3. **Scalability:**
   - Redis Pub/Sub for multi-instance deployments
   - Horizontal scaling with sticky sessions
   - Connection pooling optimization

4. **Reliability:**
   - Message acknowledgments
   - Automatic reconnection with exponential backoff
   - Message queue for offline clients

5. **Monitoring:**
   - Prometheus metrics (client count, message rate)
   - Connection duration tracking
   - Error rate monitoring
