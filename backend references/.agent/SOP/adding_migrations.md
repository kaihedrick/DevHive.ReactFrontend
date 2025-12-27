# SOP: Adding Database Migrations

## Related Documentation
- [Database Schema](../System/database_schema.md) - Current schema structure
- [Project Architecture](../System/project_architecture.md) - Overall system design

## Overview

This SOP describes how to create and deploy database schema changes using sequential SQL migration files.

## Migration System

- **Location:** `cmd/devhive-api/migrations/`
- **Format:** Sequential numbered SQL files (e.g., `001_initial_schema.sql`)
- **Execution:** Automatic on server startup (see `cmd/devhive-api/main.go`)
- **Runner:** `db/migrate.go`

## Step-by-Step Process

### Step 1: Determine Next Migration Number

```bash
# List existing migrations
ls cmd/devhive-api/migrations/

# Output example:
# 001_initial_schema.sql
# 002_remove_title_from_tasks.sql
# 003_add_refresh_tokens.sql
# ...
# 010_backfill_missing_owners.sql

# Next migration would be: 011_your_migration_name.sql
```

### Step 2: Create Migration File

**File naming convention:** `{number}_{descriptive_name}.sql`

```bash
# Create new migration file
touch cmd/devhive-api/migrations/011_add_notifications_table.sql
```

### Step 3: Write Migration SQL

**Template:**

```sql
-- Migration: {Brief description}
-- {Optional: More detailed explanation}

-- Create new table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_notifications_user_id ON notifications (user_id);
CREATE INDEX idx_notifications_is_read ON notifications (is_read);

-- Add trigger (if needed)
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Backfill data (if needed)
-- INSERT INTO notifications ...

-- Add constraints (if needed)
-- ALTER TABLE ...
```

### Step 4: Make Migration Idempotent

**Always use IF EXISTS / IF NOT EXISTS:**

```sql
-- Good (idempotent)
CREATE TABLE IF NOT EXISTS notifications (...);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;

-- Bad (not idempotent)
CREATE TABLE notifications (...);
CREATE INDEX idx_notifications_user_id ON notifications (user_id);
DROP TRIGGER update_notifications_updated_at ON notifications;
```

**Why:** Migrations may run multiple times in development, or need to be re-run on failure.

### Step 5: Test Migration Locally

#### Option A: Auto-run on Server Start

```bash
# Start server (migrations run automatically)
go run cmd/devhive-api/main.go

# Check logs for migration success
# Expected output:
# Running migrations...
# Migration 011_add_notifications_table.sql applied successfully
```

#### Option B: Manual Migration via psql

```bash
# Connect to local database
psql -d devhive -U devhive

# Run migration manually
\i cmd/devhive-api/migrations/011_add_notifications_table.sql

# Verify changes
\d notifications
\di notifications
```

#### Option C: Use Migration API Endpoint

```bash
# Trigger migration via API (dev/admin only)
curl -X POST http://localhost:8080/api/v1/migrations/run
```

### Step 6: Verify Migration

**Check table structure:**

```bash
psql -d devhive -U devhive -c "\d notifications"
```

**Check indexes:**

```bash
psql -d devhive -U devhive -c "\di notifications"
```

**Check triggers:**

```bash
psql -d devhive -U devhive -c "
SELECT tgname, tgtype, tgisinternal
FROM pg_trigger
WHERE tgrelid = 'notifications'::regclass;
"
```

**Check NOTIFY triggers (if applicable):**

```bash
# Use verification SQL
psql -d devhive -U devhive -f cmd/devhive-api/migrations/VERIFY_NOTIFY.sql
```

### Step 7: Update SQLC Queries (if needed)

If adding new tables or columns that need Go bindings:

1. **Add queries to `sqlc.yaml` query file:**

```sql
-- name: GetUserNotifications :many
SELECT * FROM notifications
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: CreateNotification :one
INSERT INTO notifications (user_id, message)
VALUES ($1, $2)
RETURNING *;

-- name: MarkNotificationAsRead :exec
UPDATE notifications
SET is_read = true
WHERE id = $1;
```

2. **Regenerate SQLC code:**

```bash
sqlc generate
```

3. **New Go code generated in:** `internal/repo/queries.sql.go`

### Step 8: Create Handler (if needed)

If exposing new functionality via API:

```go
// internal/http/handlers/notification.go
package handlers

import (
    "net/http"
    "devhive-backend/internal/repo"
    "devhive-backend/internal/http/response"
)

type NotificationHandler struct {
    queries *repo.Queries
}

func NewNotificationHandler(queries *repo.Queries) *NotificationHandler {
    return &NotificationHandler{queries: queries}
}

func (h *NotificationHandler) ListNotifications(w http.ResponseWriter, r *http.Request) {
    userID := r.Context().Value("user_id").(string)

    notifications, err := h.queries.GetUserNotifications(r.Context(), uuid.MustParse(userID))
    if err != nil {
        response.InternalServerError(w, "Failed to fetch notifications")
        return
    }

    response.Success(w, notifications)
}
```

### Step 9: Add Routes (if needed)

```go
// internal/http/router/router.go
notificationHandler := handlers.NewNotificationHandler(queries)

r.Route("/notifications", func(notifications chi.Router) {
    notifications.Use(middleware.RequireAuth(cfg.JWT.SigningKey))
    notifications.Get("/", notificationHandler.ListNotifications)
    notifications.Patch("/{notificationId}/read", notificationHandler.MarkAsRead)
})
```

### Step 10: Test End-to-End

```bash
# Start server
go run cmd/devhive-api/main.go

# Test new endpoint
curl -H "Authorization: Bearer <token>" http://localhost:8080/api/v1/notifications

# Expected response:
# {"data": [...]}
```

### Step 11: Commit Migration

```bash
git add cmd/devhive-api/migrations/011_add_notifications_table.sql
git add internal/repo/queries.sql.go  # If SQLC regenerated
git add internal/http/handlers/notification.go  # If new handler
git add internal/http/router/router.go  # If new routes
git commit -m "Add notifications table and API endpoints"
```

### Step 12: Deploy

**Fly.io Deployment:**

```bash
# Deploy to Fly.io (migrations run automatically on startup)
fly deploy

# Check logs to verify migration
fly logs
```

**Manual Deployment:**

```bash
# SSH into production server
ssh production-server

# Run migrations manually (if not auto-running)
psql -d devhive -f /path/to/migrations/011_add_notifications_table.sql
```

---

## Common Migration Patterns

### Adding a Column

```sql
-- Add column with default value
ALTER TABLE users ADD COLUMN phone_number TEXT DEFAULT NULL;

-- Add NOT NULL column (requires default or backfill)
ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';

-- Add column and backfill
ALTER TABLE users ADD COLUMN full_name TEXT;
UPDATE users SET full_name = first_name || ' ' || last_name;
ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;
```

### Removing a Column

```sql
-- Drop column (caution: irreversible)
ALTER TABLE users DROP COLUMN phone_number;

-- Alternative: Rename to deprecate
ALTER TABLE users RENAME COLUMN phone_number TO phone_number_deprecated;
```

### Adding an Index

```sql
-- Simple index
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Composite index
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks (project_id, status);

-- Unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (lower(username));

-- Partial index
CREATE INDEX IF NOT EXISTS idx_active_users ON users (email) WHERE active = true;
```

### Adding a Foreign Key

```sql
-- Add foreign key constraint
ALTER TABLE notifications
ADD CONSTRAINT fk_notifications_user
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add with naming convention
ALTER TABLE notifications
ADD CONSTRAINT notifications_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

### Adding a Trigger

```sql
-- Create or replace trigger function
CREATE OR REPLACE FUNCTION update_notification_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users SET notification_count = notification_count + 1
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS increment_notification_count ON notifications;
CREATE TRIGGER increment_notification_count
AFTER INSERT ON notifications
FOR EACH ROW EXECUTE FUNCTION update_notification_count();
```

### Data Backfill

```sql
-- Backfill missing data
UPDATE project_members SET role = 'owner'
WHERE project_id IN (
    SELECT id FROM projects WHERE owner_id = project_members.user_id
) AND role != 'owner';

-- Backfill with conditional logic
UPDATE tasks SET status = CASE
    WHEN title LIKE '%done%' THEN 2
    WHEN title LIKE '%progress%' THEN 1
    ELSE 0
END;
```

---

## Migration Checklist

Before deploying a migration:

- [ ] Migration file numbered sequentially
- [ ] SQL is idempotent (uses IF EXISTS / IF NOT EXISTS)
- [ ] Tested locally on development database
- [ ] SQLC regenerated if adding new queries
- [ ] New handlers/routes added if needed
- [ ] End-to-end API test passes
- [ ] Migration committed to git
- [ ] Production database backed up (if destructive changes)
- [ ] Deployment plan documented (if complex migration)

---

## Rollback Strategy

### If Migration Fails During Deployment

1. **Check logs:**
   ```bash
   fly logs  # For Fly.io
   ```

2. **Identify failure reason:**
   - Syntax error in SQL
   - Constraint violation
   - Missing dependency (table, function)

3. **Options:**
   - **Fix forward:** Create new migration to fix issue
   - **Rollback:** Drop changes manually via psql

### Rollback Example

```sql
-- If 011_add_notifications_table.sql fails, rollback with:
DROP TABLE IF EXISTS notifications CASCADE;
```

### Best Practice

**Always create a rollback SQL file for complex migrations:**

```sql
-- 011_add_notifications_table_rollback.sql
DROP TABLE IF EXISTS notifications CASCADE;
DROP FUNCTION IF EXISTS update_notification_count CASCADE;
```

---

## Advanced: Schema Changes with Zero Downtime

For production deployments with no downtime:

### Step 1: Add new column (nullable)
```sql
ALTER TABLE users ADD COLUMN phone_number TEXT DEFAULT NULL;
```

### Step 2: Deploy new code (writes to both old and new columns)
```go
// Dual-write during transition
user.Email = email
user.PhoneNumber = &phoneNumber  // Write to new column
```

### Step 3: Backfill existing data
```sql
UPDATE users SET phone_number = '...' WHERE phone_number IS NULL;
```

### Step 4: Deploy new code (reads from new column only)
```go
// Only use new column
user.PhoneNumber = phoneNumber
```

### Step 5: Make column NOT NULL (if needed)
```sql
ALTER TABLE users ALTER COLUMN phone_number SET NOT NULL;
```

### Step 6: Remove old code paths

---

## Troubleshooting

### Issue: Migration runs but changes not applied

**Cause:** SQL syntax error or silent failure

**Debug:**
```bash
# Check PostgreSQL logs
tail -f /var/log/postgresql/postgresql-*.log

# Or run migration manually to see errors
psql -d devhive -f cmd/devhive-api/migrations/011_add_notifications_table.sql
```

### Issue: Duplicate key violation during migration

**Cause:** Unique constraint violation during backfill

**Solution:**
```sql
-- Use INSERT ... ON CONFLICT for idempotency
INSERT INTO project_members (project_id, user_id, role)
VALUES ($1, $2, 'owner')
ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner';
```

### Issue: Foreign key constraint fails

**Cause:** Referenced table/row doesn't exist

**Solution:**
```sql
-- Add foreign key with deferred validation
ALTER TABLE notifications
ADD CONSTRAINT fk_notifications_user
FOREIGN KEY (user_id) REFERENCES users(id)
DEFERRABLE INITIALLY DEFERRED;

-- Or clean up orphaned records first
DELETE FROM notifications WHERE user_id NOT IN (SELECT id FROM users);
```

---

## References

- **Migration Runner:** `db/migrate.go`
- **Verification SQL:** `cmd/devhive-api/migrations/VERIFY_NOTIFY.sql`
- **SQLC Config:** `sqlc.yaml`
- **PostgreSQL Docs:** https://www.postgresql.org/docs/current/ddl.html
