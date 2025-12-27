# DevHive Backend - Database Schema

## Related Documentation
- [Project Architecture](./project_architecture.md) - Overall system architecture
- [Authentication Flow](./authentication_flow.md) - JWT and refresh token mechanism
- [Real-time System](./realtime_system.md) - WebSocket and cache invalidation
- [SOP: Adding Migrations](../SOP/adding_migrations.md) - How to create new migrations

## Overview

DevHive uses **PostgreSQL 12+** with the following key extensions:
- `pgcrypto` - UUID generation (`gen_random_uuid()`)
- `citext` - Case-insensitive text (for emails)

All migrations are located in: `cmd/devhive-api/migrations/`

## Schema Version History

| Migration | Description |
|-----------|-------------|
| 001 | Initial schema with core tables |
| 002 | Remove title from tasks table |
| 003 | Add refresh_tokens table |
| 004 | Add cache invalidation triggers |
| 005 | Add project_invites table |
| 006 | Fix project_members notification_id |
| 007 | Ensure NOTIFY triggers installed |
| 008 | Backfill owners in project_members |
| 009 | Canonical project_members cleanup |
| 010 | Backfill missing owners |
| 011 | Add Google OAuth 2.0 support and Remember Me functionality |

## Core Tables

### users

User accounts and profiles. Supports both local (username/password) and OAuth (Google) authentication.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    email CITEXT NOT NULL UNIQUE,
    password_h TEXT,  -- Nullable for OAuth-only users
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    avatar_url TEXT,
    auth_provider TEXT DEFAULT 'local' CHECK (auth_provider IN ('local', 'google')),
    google_id TEXT UNIQUE,
    profile_picture_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_auth_method_check CHECK (
        (auth_provider = 'local' AND password_h IS NOT NULL) OR
        (auth_provider = 'google' AND google_id IS NOT NULL)
    )
);
```

**Indexes:**
- `users_username_uidx` - Unique index on `lower(username)` for case-insensitive username lookups
- `users_email_uidx` - Unique index on `lower(email)` for case-insensitive email lookups
- `idx_users_google_id` - Partial index on `google_id` WHERE `google_id IS NOT NULL`
- `idx_users_auth_provider` - Index on `auth_provider` for filtering by auth method

**Fields:**
- `password_h` - bcrypt hash of password (auto-salted) - **Nullable for OAuth users**
- `email` - CITEXT type ensures case-insensitive storage and comparison
- `active` - Soft deactivation flag (not used for auth currently)
- `avatar_url` - URL to user's profile picture (Firebase Storage or Fly.io volume)
- `auth_provider` - Authentication method: 'local' (username/password) or 'google' (OAuth)
- `google_id` - Google's unique user identifier (sub claim) - Unique across users
- `profile_picture_url` - Google profile picture URL (synced from Google OAuth)

**Triggers:**
- `update_users_updated_at` - Auto-update `updated_at` on row modification

**Common Queries:**
- Get user by username: `SELECT * FROM users WHERE lower(username) = lower($1)`
- Get user by email: `SELECT * FROM users WHERE email = $1` (case-insensitive)
- Create user: Validate email/username uniqueness, hash password, insert

---

### projects

Project entities with ownership.

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
- `idx_projects_owner_id` - Foreign key index for efficient owner lookups

**Fields:**
- `owner_id` - References the user who created the project
- `name` - Project name (no uniqueness constraint)
- `description` - Optional project description

**Triggers:**
- `update_projects_updated_at` - Auto-update `updated_at`
- `projects_cache_invalidate` - NOTIFY on INSERT/UPDATE/DELETE

**Relationships:**
- One-to-many with `project_members`
- One-to-many with `sprints`
- One-to-many with `tasks`
- One-to-many with `messages`
- One-to-many with `project_invites`

**Common Queries:**
- List projects for user: Join with `project_members` where `user_id = $1`
- Get project with member count
- Create project: Insert project + insert owner as member with role 'owner'

---

### project_members

Many-to-many relationship between users and projects with role-based access.

```sql
CREATE TABLE project_members (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);
```

**Indexes:**
- `idx_project_members_project_id` - Composite primary key serves as index
- `idx_project_members_user_id` - Foreign key index

**Fields:**
- `role` - One of: `owner`, `admin`, `member`, `viewer`
  - `owner` - Full permissions, can delete project
  - `admin` - Can manage members and settings
  - `member` - Can create/edit tasks and sprints
  - `viewer` - Read-only access
- `joined_at` - Timestamp when user joined project

**Triggers:**
- `project_members_cache_invalidate` - NOTIFY on INSERT/UPDATE/DELETE

**Important Notes:**
- No `id` column - composite primary key (project_id, user_id)
- Project owner should also have an entry with role='owner'
- Migrations 008, 009, 010 backfilled missing owner entries

**Common Queries:**
- List members for project: `SELECT * FROM project_members WHERE project_id = $1`
- Check user access: `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`
- Add member: Insert with role
- Remove member: Delete where project_id and user_id match

---

### project_invites

Time-limited invite links for projects.

```sql
CREATE TABLE project_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invite_token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    max_uses INTEGER DEFAULT NULL,
    used_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
- `idx_project_invites_project_id`
- `idx_project_invites_invite_token`
- `idx_project_invites_expires_at`
- `idx_project_invites_active` - Composite on (is_active, expires_at)
- `idx_project_invites_created_by`

**Fields:**
- `invite_token` - Random unique token (used in invite URL)
- `expires_at` - Invite expiration timestamp (typically 30 minutes from creation)
- `max_uses` - NULL for unlimited, or integer for max usage count
- `used_count` - Incremented when invite is accepted
- `is_active` - Can be manually deactivated or auto-deactivated on expiration

**Triggers:**
- `update_project_invites_updated_at`

**Functions:**
- `cleanup_expired_invites()` - Sets is_active=false for expired invites (can be called periodically)

**Common Queries:**
- Get invite details: `SELECT * FROM project_invites WHERE invite_token = $1 AND is_active = true AND expires_at > now()`
- Create invite: Generate random token, set expiration (now() + 30 minutes)
- Accept invite: Check validity, increment used_count, check max_uses, add user to project_members
- Revoke invite: Set is_active = false

---

### sprints

Agile sprint planning with start/end dates and status tracking.

```sql
CREATE TABLE sprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    is_started BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
- `idx_sprints_project_id`
- `idx_sprints_dates` - Composite on (start_date, end_date)

**Fields:**
- `start_date` / `end_date` - Sprint duration
- `is_started` - Whether sprint has begun
- `is_completed` - Whether sprint is finished

**Triggers:**
- `update_sprints_updated_at`
- `sprints_cache_invalidate` - NOTIFY on INSERT/UPDATE/DELETE

**Relationships:**
- One-to-many with `tasks` (tasks can be assigned to sprints)

**Common Queries:**
- List sprints for project: `SELECT * FROM sprints WHERE project_id = $1 ORDER BY start_date DESC`
- Get active sprint: `SELECT * FROM sprints WHERE project_id = $1 AND is_started = true AND is_completed = false`
- Update sprint status: Update is_started / is_completed

---

### tasks

Task entities with sprint assignment and status tracking.

```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL,
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
- `idx_tasks_project_id`
- `idx_tasks_sprint_id`
- `idx_tasks_assignee_id`
- `idx_tasks_status`

**Fields:**
- `title` - Task title (note: Migration 002 removed title column, then re-added it)
- `status` - Integer status code (0 = todo, 1 = in progress, 2 = done, etc.)
- `sprint_id` - Optional sprint assignment (SET NULL on sprint delete)
- `assignee_id` - Optional user assignment (SET NULL on user delete)

**Triggers:**
- `update_tasks_updated_at`
- `tasks_cache_invalidate` - NOTIFY on INSERT/UPDATE/DELETE

**Common Queries:**
- List tasks for project: `SELECT * FROM tasks WHERE project_id = $1`
- List tasks for sprint: `SELECT * FROM tasks WHERE sprint_id = $1`
- Update task status: `UPDATE tasks SET status = $1 WHERE id = $2`
- Assign task: `UPDATE tasks SET assignee_id = $1, sprint_id = $2 WHERE id = $3`

---

### messages

Threaded project messaging with file support.

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

**Indexes:**
- `idx_messages_project_id`
- `idx_messages_sender_id`
- `idx_messages_parent_id`
- `idx_messages_created_at`

**Fields:**
- `message_type` - One of: `text`, `image`, `file`
- `content` - Message text or file URL
- `parent_message_id` - For threaded replies (SET NULL on parent delete)

**Triggers:**
- `update_messages_updated_at`

**Threading:**
- Top-level messages have `parent_message_id = NULL`
- Reply messages reference parent via `parent_message_id`

**Common Queries:**
- List messages for project: `SELECT * FROM messages WHERE project_id = $1 ORDER BY created_at DESC`
- List replies to message: `SELECT * FROM messages WHERE parent_message_id = $1`
- Create message: Insert with sender_id and project_id
- Create reply: Insert with parent_message_id set

---

### refresh_tokens

Persistent storage for refresh tokens with support for OAuth and "Remember Me" functionality (Migration 003, enhanced in 011).

```sql
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    is_persistent BOOLEAN NOT NULL DEFAULT true,
    google_refresh_token TEXT,
    google_access_token TEXT,
    google_token_expiry TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
- `idx_refresh_tokens_token`
- `idx_refresh_tokens_user_id`
- `idx_refresh_tokens_expires_at`
- `idx_refresh_tokens_google_expiry` - Partial index on `google_token_expiry` WHERE `google_token_expiry IS NOT NULL`

**Fields:**
- `token` - Random 64-character token
- `expires_at` - Token expiration (30 days for persistent, 7 days for session)
- `is_persistent` - True for "Remember Me" (30 days), false for session-only
- `google_refresh_token` - Google OAuth refresh token (for re-authentication with Google)
- `google_access_token` - Cached Google access token (for Google API calls if needed)
- `google_token_expiry` - Expiration time for Google access token

**Functions:**
- `cleanup_expired_refresh_tokens()` - Deletes expired tokens (can be called periodically)

**Common Queries:**
- Validate refresh token: `SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > now()`
- Create persistent refresh token: Insert with `is_persistent=true`, 30-day expiration
- Create session refresh token: Insert with `is_persistent=false`, 0 MaxAge cookie (session)
- Delete refresh token: Delete on logout or when rotated

**Session Persistence Behavior:**
- **Remember Me = true**: Cookie MaxAge = 30 days, `is_persistent = true`
- **Remember Me = false**: Cookie MaxAge = 0 (session), `is_persistent = false`
- Session cookies clear on browser close, but DB token has 7-day expiry as backup

**Security Notes:**
- DevHive tokens are stored as plaintext (not hashed) for simplicity
- Google refresh tokens should ideally be encrypted (not implemented currently)
- Token rotation: Each refresh generates new access token AND new refresh token
- On logout, refresh token is deleted from database

---

### password_resets

Time-limited password reset tokens.

```sql
CREATE TABLE password_resets (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reset_token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes:**
- `idx_password_resets_reset_token`
- `idx_password_resets_user_id`

**Fields:**
- `reset_token` - Random unique token sent via email
- `expires_at` - Token expiration (typically 1 hour from creation)

**Common Queries:**
- Request password reset: Insert with random token, 1-hour expiration
- Validate reset token: `SELECT * FROM password_resets WHERE reset_token = $1 AND expires_at > now()`
- Reset password: Update user password_h, delete reset token

**Security Notes:**
- Tokens are single-use (deleted after password reset)
- Expired tokens should be cleaned up periodically
- Token is sent via email (Mailgun integration)

---

### oauth_state

Temporary storage for OAuth state tokens (CSRF protection) during OAuth flows (Migration 011).

```sql
CREATE TABLE oauth_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_token TEXT NOT NULL UNIQUE,
    remember_me BOOLEAN NOT NULL DEFAULT false,
    redirect_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes')
);
```

**Indexes:**
- `idx_oauth_state_token` - Index on `state_token` for fast lookups
- `idx_oauth_state_expires` - Index on `expires_at` for cleanup queries

**Fields:**
- `state_token` - Random CSRF token passed to OAuth provider and validated on callback
- `remember_me` - User preference for persistent login (stored during auth redirect)
- `redirect_url` - Frontend URL to redirect to after successful authentication
- `expires_at` - State tokens expire after 10 minutes (OAuth flows should complete quickly)

**Functions:**
- `cleanup_expired_oauth_state()` - Removes expired state tokens

**Flow:**
1. User initiates OAuth login with `remember_me` preference
2. Backend generates state token, stores in `oauth_state` table
3. User is redirected to Google with state token
4. Google redirects back with state token
5. Backend validates state token (CSRF protection)
6. Retrieves `remember_me` preference from state record
7. Creates user/session with appropriate persistence
8. Deletes state token from database

**Security Notes:**
- State tokens provide CSRF protection for OAuth flows
- Tokens are single-use and deleted after successful callback
- 10-minute expiry prevents token reuse and cleans up abandoned flows
- Random state tokens make it infeasible to guess valid states

---

## Database Functions

### update_updated_at_column()

Automatically updates the `updated_at` timestamp on row modification.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';
```

Applied to: users, projects, sprints, tasks, messages, project_invites

---

### notify_cache_invalidation()

Sends PostgreSQL NOTIFY messages on table changes (Migration 004).

```sql
CREATE OR REPLACE FUNCTION notify_cache_invalidation()
RETURNS TRIGGER AS $$
DECLARE
  notification_payload JSONB;
  project_uuid UUID;
  record_id TEXT;
BEGIN
  -- Extract project_id based on resource type
  -- Build JSON payload with: resource, id, action, project_id, timestamp
  -- PERFORM pg_notify('cache_invalidate', notification_payload::text);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

**Applied to:**
- projects (resource: 'projects', project_id: id)
- sprints (resource: 'sprints', project_id: project_id)
- tasks (resource: 'tasks', project_id: project_id)
- project_members (resource: 'project_members', project_id: project_id)

**Payload Format:**
```json
{
  "resource": "tasks",
  "id": "uuid-here",
  "action": "UPDATE",
  "project_id": "project-uuid",
  "timestamp": "2025-12-22T12:00:00Z"
}
```

**Channel:** `cache_invalidate` (single channel for all notifications)

**Listener:** `internal/db/notify_listener.go` listens and broadcasts to WebSocket clients

---

### cleanup_expired_refresh_tokens()

Deletes expired refresh tokens.

```sql
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM refresh_tokens WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;
```

**Usage:** Can be called manually or via scheduled job (not automated currently)

---

### cleanup_expired_invites()

Deactivates expired project invites.

```sql
CREATE OR REPLACE FUNCTION cleanup_expired_invites()
RETURNS void AS $$
BEGIN
    UPDATE project_invites
    SET is_active = false
    WHERE expires_at < NOW() AND is_active = true;
END;
$$ LANGUAGE plpgsql;
```

**Usage:** Can be called manually or via scheduled job (not automated currently)

---

## Entity Relationships Diagram

```
users
  ├─1:N─> projects (owner_id)
  ├─1:N─> project_members (user_id)
  ├─1:N─> project_invites (created_by)
  ├─1:N─> tasks (assignee_id)
  ├─1:N─> messages (sender_id)
  ├─1:N─> refresh_tokens (user_id)
  └─1:N─> password_resets (user_id)

projects
  ├─1:N─> project_members (project_id)
  ├─1:N─> project_invites (project_id)
  ├─1:N─> sprints (project_id)
  ├─1:N─> tasks (project_id)
  └─1:N─> messages (project_id)

sprints
  └─1:N─> tasks (sprint_id)

messages
  └─1:N─> messages (parent_message_id) [self-referential]
```

---

## Common Query Patterns

### Get Project with Members
```sql
SELECT
  p.*,
  json_agg(
    json_build_object(
      'user_id', pm.user_id,
      'username', u.username,
      'role', pm.role,
      'joined_at', pm.joined_at
    )
  ) as members
FROM projects p
LEFT JOIN project_members pm ON p.id = pm.project_id
LEFT JOIN users u ON pm.user_id = u.id
WHERE p.id = $1
GROUP BY p.id;
```

### Get User's Projects with Role
```sql
SELECT p.*, pm.role
FROM projects p
INNER JOIN project_members pm ON p.id = pm.project_id
WHERE pm.user_id = $1
ORDER BY p.created_at DESC;
```

### Get Active Sprints for Project
```sql
SELECT *
FROM sprints
WHERE project_id = $1
  AND is_started = true
  AND is_completed = false
ORDER BY start_date;
```

### Get Tasks with Assignee Info
```sql
SELECT
  t.*,
  json_build_object(
    'id', u.id,
    'username', u.username,
    'first_name', u.first_name,
    'last_name', u.last_name
  ) as assignee
FROM tasks t
LEFT JOIN users u ON t.assignee_id = u.id
WHERE t.project_id = $1
ORDER BY t.created_at DESC;
```

### Get Threaded Messages
```sql
-- Top-level messages
SELECT *
FROM messages
WHERE project_id = $1 AND parent_message_id IS NULL
ORDER BY created_at DESC;

-- Replies to a message
SELECT *
FROM messages
WHERE parent_message_id = $1
ORDER BY created_at ASC;
```

---

## Migration Strategy

### Sequential Migrations
Migrations are numbered sequentially: `001_`, `002_`, etc.

### Migration Execution
- Migrations run automatically on server startup (see `cmd/devhive-api/main.go`)
- Migration runner: `db/migrate.go`
- Tracks applied migrations in memory (no migration tracking table currently)

### Best Practices
- Always use `IF EXISTS` / `IF NOT EXISTS` for idempotency
- Include rollback SQL in comments if needed
- Test migrations on local DB before deploying
- Backup production DB before running migrations

See [SOP: Adding Migrations](../SOP/adding_migrations.md) for detailed process.

---

## Performance Considerations

### Indexes
All foreign keys are indexed for efficient joins and lookups.

### Connection Pooling
- Max open connections: 25
- Max idle connections: 5
- Connection max lifetime: 5 minutes

### Query Optimization
- SQLC generates type-safe, prepared statements
- Use of `LIMIT` and `OFFSET` for pagination
- Composite indexes on frequently queried columns (e.g., sprints_dates)

### NOTIFY/LISTEN
- Minimal JSON payloads (< 1KB) for cache invalidation
- Single channel (`cache_invalidate`) to avoid channel proliferation
- Dedicated database connection for listener

---

## Security Considerations

### SQL Injection Prevention
All queries use parameterized statements via SQLC (no string concatenation).

### Cascade Deletes
- Deleting a user cascades to their memberships, invites, refresh tokens
- Deleting a project cascades to all related data (members, sprints, tasks, messages)
- Deleting a sprint sets task sprint_id to NULL (preserve tasks)

### Sensitive Data
- Passwords stored as bcrypt hashes (never plaintext)
- Refresh tokens stored plaintext (consider hashing in future)
- Reset tokens stored plaintext (single-use, time-limited)

### Data Validation
- Email uniqueness enforced at DB level
- Username uniqueness enforced at DB level (case-insensitive)
- Role CHECK constraint ensures valid roles
- Message type CHECK constraint ensures valid types
