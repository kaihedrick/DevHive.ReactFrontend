# SOP: Adding New API Endpoints

## Related Documentation
- [Project Architecture](../System/project_architecture.md) - API design patterns
- [Database Schema](../System/database_schema.md) - Data models
- [Adding Migrations](./adding_migrations.md) - If new database tables needed

## Overview

This SOP describes how to add new RESTful API endpoints to DevHive backend.

## File Structure

```
internal/
├── repo/
│   ├── queries.sql.go      # SQLC-generated database functions
│   └── models.go           # SQLC-generated models
├── http/
│   ├── handlers/
│   │   └── {resource}.go   # Request handlers for resource
│   ├── middleware/
│   │   └── auth.go         # Authentication middleware
│   ├── response/
│   │   └── response.go     # Standardized responses
│   └── router/
│       └── router.go       # Route definitions
```

## Step-by-Step Process

### Step 1: Define Database Queries (if needed)

If your endpoint needs new database operations, add SQL queries for SQLC.

**File:** `internal/repo/queries.sql` (or create resource-specific SQL file)

```sql
-- name: GetNotificationByID :one
SELECT * FROM notifications
WHERE id = $1;

-- name: ListUserNotifications :many
SELECT * FROM notifications
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CreateNotification :one
INSERT INTO notifications (user_id, message, is_read)
VALUES ($1, $2, $3)
RETURNING *;

-- name: MarkNotificationAsRead :exec
UPDATE notifications
SET is_read = true, updated_at = NOW()
WHERE id = $1;

-- name: DeleteNotification :exec
DELETE FROM notifications
WHERE id = $1;
```

**Generate Go code:**

```bash
sqlc generate
```

**Output:** `internal/repo/queries.sql.go` (auto-generated)

---

### Step 2: Create Handler File

**File:** `internal/http/handlers/{resource}.go`

**Template:**

```go
package handlers

import (
    "net/http"
    "github.com/go-chi/chi/v5"
    "github.com/google/uuid"
    "devhive-backend/internal/repo"
    "devhive-backend/internal/http/response"
)

// NotificationHandler handles notification-related requests
type NotificationHandler struct {
    queries *repo.Queries
}

// NewNotificationHandler creates a new notification handler
func NewNotificationHandler(queries *repo.Queries) *NotificationHandler {
    return &NotificationHandler{
        queries: queries,
    }
}

// Request/Response structs
type CreateNotificationRequest struct {
    UserID  string `json:"userId"`
    Message string `json:"message"`
}

type NotificationResponse struct {
    ID        string `json:"id"`
    UserID    string `json:"userId"`
    Message   string `json:"message"`
    IsRead    bool   `json:"isRead"`
    CreatedAt string `json:"createdAt"`
}

// Handler methods (implement below)
```

---

### Step 3: Implement Handler Methods

#### A. List Resource (GET /resources)

```go
func (h *NotificationHandler) ListNotifications(w http.ResponseWriter, r *http.Request) {
    // Get authenticated user ID from context (set by auth middleware)
    userID := r.Context().Value("user_id").(string)

    // Parse query parameters
    limit := 20
    offset := 0
    // TODO: Parse from r.URL.Query() if needed

    // Query database
    notifications, err := h.queries.ListUserNotifications(r.Context(), repo.ListUserNotificationsParams{
        UserID: uuid.MustParse(userID),
        Limit:  int32(limit),
        Offset: int32(offset),
    })
    if err != nil {
        response.InternalServerError(w, "Failed to fetch notifications")
        return
    }

    // Return success response
    response.Success(w, notifications)
}
```

#### B. Get Resource by ID (GET /resources/{id})

```go
func (h *NotificationHandler) GetNotification(w http.ResponseWriter, r *http.Request) {
    // Get ID from URL path
    notificationID := chi.URLParam(r, "notificationId")
    if notificationID == "" {
        response.BadRequest(w, "Notification ID is required")
        return
    }

    // Parse UUID
    id, err := uuid.Parse(notificationID)
    if err != nil {
        response.BadRequest(w, "Invalid notification ID")
        return
    }

    // Get authenticated user ID
    userID := r.Context().Value("user_id").(string)

    // Query database
    notification, err := h.queries.GetNotificationByID(r.Context(), id)
    if err != nil {
        response.NotFound(w, "Notification not found")
        return
    }

    // Authorization check: ensure user owns this notification
    if notification.UserID.String() != userID {
        response.Forbidden(w, "You don't have access to this notification")
        return
    }

    // Return success response
    response.Success(w, notification)
}
```

#### C. Create Resource (POST /resources)

```go
func (h *NotificationHandler) CreateNotification(w http.ResponseWriter, r *http.Request) {
    // Decode request body
    var req CreateNotificationRequest
    if !response.Decode(w, r, &req) {
        return // Decode handles error response
    }

    // Validate input
    if req.Message == "" {
        response.BadRequest(w, "Message is required")
        return
    }

    // Get authenticated user ID
    userID := r.Context().Value("user_id").(string)

    // Create notification
    notification, err := h.queries.CreateNotification(r.Context(), repo.CreateNotificationParams{
        UserID:  uuid.MustParse(userID),
        Message: req.Message,
        IsRead:  false,
    })
    if err != nil {
        response.InternalServerError(w, "Failed to create notification")
        return
    }

    // Return created resource with 201 status
    response.Created(w, notification)
}
```

#### D. Update Resource (PATCH /resources/{id})

```go
type UpdateNotificationRequest struct {
    IsRead *bool `json:"isRead,omitempty"`
}

func (h *NotificationHandler) UpdateNotification(w http.ResponseWriter, r *http.Request) {
    // Get ID from URL
    notificationID := chi.URLParam(r, "notificationId")
    id, err := uuid.Parse(notificationID)
    if err != nil {
        response.BadRequest(w, "Invalid notification ID")
        return
    }

    // Decode request
    var req UpdateNotificationRequest
    if !response.Decode(w, r, &req) {
        return
    }

    // Get authenticated user
    userID := r.Context().Value("user_id").(string)

    // Check ownership
    notification, err := h.queries.GetNotificationByID(r.Context(), id)
    if err != nil {
        response.NotFound(w, "Notification not found")
        return
    }
    if notification.UserID.String() != userID {
        response.Forbidden(w, "You don't have access to this notification")
        return
    }

    // Update only if IsRead is provided
    if req.IsRead != nil && *req.IsRead {
        err = h.queries.MarkNotificationAsRead(r.Context(), id)
        if err != nil {
            response.InternalServerError(w, "Failed to update notification")
            return
        }
    }

    // Fetch updated notification
    updated, err := h.queries.GetNotificationByID(r.Context(), id)
    if err != nil {
        response.InternalServerError(w, "Failed to fetch updated notification")
        return
    }

    response.Success(w, updated)
}
```

#### E. Delete Resource (DELETE /resources/{id})

```go
func (h *NotificationHandler) DeleteNotification(w http.ResponseWriter, r *http.Request) {
    // Get ID from URL
    notificationID := chi.URLParam(r, "notificationId")
    id, err := uuid.Parse(notificationID)
    if err != nil {
        response.BadRequest(w, "Invalid notification ID")
        return
    }

    // Get authenticated user
    userID := r.Context().Value("user_id").(string)

    // Check ownership
    notification, err := h.queries.GetNotificationByID(r.Context(), id)
    if err != nil {
        response.NotFound(w, "Notification not found")
        return
    }
    if notification.UserID.String() != userID {
        response.Forbidden(w, "You don't have access to this notification")
        return
    }

    // Delete
    err = h.queries.DeleteNotification(r.Context(), id)
    if err != nil {
        response.InternalServerError(w, "Failed to delete notification")
        return
    }

    // Return 204 No Content
    w.WriteHeader(http.StatusNoContent)
}
```

---

### Step 4: Add Routes

**File:** `internal/http/router/router.go`

**Function:** `setupV1Routes()`

```go
func setupV1Routes(cfg *config.Config, queries *repo.Queries, db interface{}, hub *ws.Hub) chi.Router {
    r := chi.NewRouter()

    // ... existing handlers ...

    // Initialize new handler
    notificationHandler := handlers.NewNotificationHandler(queries)

    // ... existing routes ...

    // Add new routes
    r.Route("/notifications", func(notifications chi.Router) {
        // Apply authentication middleware to all routes
        notifications.Use(middleware.RequireAuth(cfg.JWT.SigningKey))

        // Define routes
        notifications.Get("/", notificationHandler.ListNotifications)
        notifications.Post("/", notificationHandler.CreateNotification)
        notifications.Get("/{notificationId}", notificationHandler.GetNotification)
        notifications.Patch("/{notificationId}", notificationHandler.UpdateNotification)
        notifications.Delete("/{notificationId}", notificationHandler.DeleteNotification)
    })

    return r
}
```

**Route patterns:**

| HTTP Method | Path | Handler | Description |
|-------------|------|---------|-------------|
| GET | `/api/v1/notifications` | ListNotifications | List all notifications for user |
| POST | `/api/v1/notifications` | CreateNotification | Create new notification |
| GET | `/api/v1/notifications/{id}` | GetNotification | Get notification by ID |
| PATCH | `/api/v1/notifications/{id}` | UpdateNotification | Update notification |
| DELETE | `/api/v1/notifications/{id}` | DeleteNotification | Delete notification |

---

### Step 5: Test Endpoints

#### A. Manual Testing with curl

```bash
# Login to get token
TOKEN=$(curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}' \
  | jq -r '.data.token')

# List notifications
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/notifications

# Create notification
curl -X POST http://localhost:8080/api/v1/notifications \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Test notification"}'

# Get notification by ID
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/notifications/{notification-id}

# Update notification
curl -X PATCH http://localhost:8080/api/v1/notifications/{notification-id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isRead":true}'

# Delete notification
curl -X DELETE http://localhost:8080/api/v1/notifications/{notification-id} \
  -H "Authorization: Bearer $TOKEN"
```

#### B. Unit Testing (Optional)

```go
// internal/http/handlers/notification_test.go
package handlers_test

import (
    "testing"
    "net/http/httptest"
    "devhive-backend/internal/http/handlers"
)

func TestListNotifications(t *testing.T) {
    // TODO: Implement test
}
```

---

### Step 6: Add Nested Resource Routes (Optional)

For routes like `/projects/{projectId}/tasks`:

```go
// In setupV1Routes()
r.Route("/projects", func(projects chi.Router) {
    projects.Use(middleware.RequireAuth(cfg.JWT.SigningKey))

    // ... existing project routes ...

    // Nested resource: project tasks
    projects.Get("/{projectId}/tasks", taskHandler.ListTasksByProject)
    projects.Post("/{projectId}/tasks", taskHandler.CreateTask)
})
```

**Handler example:**

```go
func (h *TaskHandler) ListTasksByProject(w http.ResponseWriter, r *http.Request) {
    // Get project ID from URL
    projectID := chi.URLParam(r, "projectId")

    // Check user has access to project (authorization)
    userID := r.Context().Value("user_id").(string)
    _, err := h.queries.GetProjectMember(r.Context(), repo.GetProjectMemberParams{
        ProjectID: uuid.MustParse(projectID),
        UserID:    uuid.MustParse(userID),
    })
    if err != nil {
        response.Forbidden(w, "You don't have access to this project")
        return
    }

    // List tasks
    tasks, err := h.queries.ListTasksByProject(r.Context(), uuid.MustParse(projectID))
    if err != nil {
        response.InternalServerError(w, "Failed to fetch tasks")
        return
    }

    response.Success(w, tasks)
}
```

---

## Response Helper Functions

**File:** `internal/http/response/response.go`

```go
package response

import (
    "encoding/json"
    "net/http"
)

func Success(w http.ResponseWriter, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]interface{}{
        "data": data,
    })
}

func Created(w http.ResponseWriter, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(map[string]interface{}{
        "data": data,
    })
}

func BadRequest(w http.ResponseWriter, message string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusBadRequest)
    json.NewEncoder(w).Encode(map[string]interface{}{
        "error": message,
    })
}

func Unauthorized(w http.ResponseWriter, message string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusUnauthorized)
    json.NewEncoder(w).Encode(map[string]interface{}{
        "error": message,
    })
}

func Forbidden(w http.ResponseWriter, message string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusForbidden)
    json.NewEncoder(w).Encode(map[string]interface{}{
        "error": message,
    })
}

func NotFound(w http.ResponseWriter, message string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusNotFound)
    json.NewEncoder(w).Encode(map[string]interface{}{
        "error": message,
    })
}

func InternalServerError(w http.ResponseWriter, message string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusInternalServerError)
    json.NewEncoder(w).Encode(map[string]interface{}{
        "error": message,
    })
}

func Decode(w http.ResponseWriter, r *http.Request, v interface{}) bool {
    if err := json.NewDecoder(r.Body).Decode(v); err != nil {
        BadRequest(w, "Invalid request body")
        return false
    }
    return true
}
```

---

## Common Patterns

### Pattern 1: Authorization Check

```go
// Check if user is project member
member, err := h.queries.GetProjectMember(ctx, repo.GetProjectMemberParams{
    ProjectID: projectID,
    UserID:    userID,
})
if err != nil {
    response.Forbidden(w, "You don't have access to this project")
    return
}

// Check if user has specific role
if member.Role != "owner" && member.Role != "admin" {
    response.Forbidden(w, "Only owners and admins can perform this action")
    return
}
```

### Pattern 2: Pagination

```go
// Parse query parameters
limit := 20
offset := 0
if l := r.URL.Query().Get("limit"); l != "" {
    limit, _ = strconv.Atoi(l)
}
if o := r.URL.Query().Get("offset"); o != "" {
    offset, _ = strconv.Atoi(o)
}

// Query with pagination
items, err := h.queries.ListItems(ctx, repo.ListItemsParams{
    Limit:  int32(limit),
    Offset: int32(offset),
})
```

### Pattern 3: Input Validation

```go
var req CreateTaskRequest
if !response.Decode(w, r, &req) {
    return
}

// Validate required fields
if req.Title == "" {
    response.BadRequest(w, "Title is required")
    return
}

// Validate field length
if len(req.Title) > 200 {
    response.BadRequest(w, "Title must be less than 200 characters")
    return
}

// Validate format (email, UUID, etc.)
if _, err := uuid.Parse(req.ProjectID); err != nil {
    response.BadRequest(w, "Invalid project ID")
    return
}
```

### Pattern 4: Transaction Handling

For operations requiring multiple database queries:

```go
// Start transaction
tx, err := db.Begin()
if err != nil {
    response.InternalServerError(w, "Failed to start transaction")
    return
}
defer tx.Rollback()

// Use transaction-aware queries
qtx := h.queries.WithTx(tx)

// Perform multiple operations
project, err := qtx.CreateProject(ctx, params)
if err != nil {
    response.InternalServerError(w, "Failed to create project")
    return
}

err = qtx.AddProjectMember(ctx, memberParams)
if err != nil {
    response.InternalServerError(w, "Failed to add owner as member")
    return
}

// Commit transaction
if err := tx.Commit(); err != nil {
    response.InternalServerError(w, "Failed to commit transaction")
    return
}
```

---

## API Endpoint Checklist

Before deploying:

- [ ] SQLC queries defined and generated
- [ ] Handler struct created with constructor
- [ ] All CRUD methods implemented (as needed)
- [ ] Routes registered in router
- [ ] Authentication middleware applied
- [ ] Authorization checks implemented
- [ ] Input validation performed
- [ ] Error handling with appropriate status codes
- [ ] Database errors handled gracefully
- [ ] Manual testing completed (curl or Postman)
- [ ] Unit tests written (if applicable)
- [ ] API documentation updated (if applicable)
- [ ] Code committed to git

---

## Troubleshooting

### Issue: 404 Not Found

**Cause:** Route not registered or path mismatch

**Debug:**
```go
// Add logging in router
log.Printf("Registered route: %s %s", method, path)

// Or use Chi's built-in route printer
chi.Walk(r, func(method, route string, handler http.Handler, middlewares ...func(http.Handler) http.Handler) error {
    log.Printf("%s %s", method, route)
    return nil
})
```

### Issue: 401 Unauthorized

**Cause:** Missing or invalid JWT token

**Debug:**
```bash
# Check token in Authorization header
curl -v -H "Authorization: Bearer <token>" http://localhost:8080/api/v1/notifications

# Verify token is valid
curl http://localhost:8080/api/v1/auth/validate-token \
  -H "Authorization: Bearer <token>"
```

### Issue: 500 Internal Server Error

**Cause:** Database query error or unhandled exception

**Debug:**
- Check server logs for error details
- Add debug logging in handler
- Test database query directly in psql

---

## References

- **Chi Router Docs:** https://github.com/go-chi/chi
- **SQLC Docs:** https://docs.sqlc.dev/
- **Response Helpers:** `internal/http/response/response.go`
- **Existing Handlers:** `internal/http/handlers/`
