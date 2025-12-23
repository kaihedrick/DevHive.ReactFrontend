# DevHive Backend Migration Guide

## Overview
This guide outlines the transition from the legacy .NET backend to the new Go + PostgreSQL backend with minimal churn.

## Environment Setup

### 1. Environment Variables
Create a `.env` file in the project root:
```env
VITE_API_BASE_URL=https://devhive-go-backend.fly.dev/api/v1
```

### 2. Feature Flag (Optional)
For gradual rollout, you can add a feature flag:
```javascript
const USE_NEW_API = import.meta.env.VITE_USE_NEW_API === 'true' || true;
```

## API Endpoint Changes

### Authentication
- `POST /api/User/ProcessLogin` → `POST https://devhive-go-backend.fly.dev/api/v1/auth/login`
  - **Request**: `{username, password}`
  - **Response**: `{token, userId}`
- `POST /api/User/Register` → `POST https://devhive-go-backend.fly.dev/api/v1/users`
  - **Request**: `{username, email, password, firstName, lastName}`
  - **Response**: `{id, username, email, firstName, lastName, active, avatarUrl?, createdAt, updatedAt}`
- `GET /api/User/{id}` → `GET https://devhive-go-backend.fly.dev/api/v1/users/{id}`
  - **Response**: `{id, username, email, firstName, lastName, active, avatarUrl?, createdAt, updatedAt}`
- `GET /api/User/Me` → `GET https://devhive-go-backend.fly.dev/api/v1/users/me`
  - **Response**: `{id, username, email, firstName, lastName, active, avatarUrl?, createdAt, updatedAt}`
- `PUT /api/User/Me` → `PUT https://devhive-go-backend.fly.dev/api/v1/users/me`
  - **Request**: `{firstName?, lastName?, email?, avatarUrl?}`
  - **Response**: `{id, username, email, firstName, lastName, active, avatarUrl?, createdAt, updatedAt}`
- `PATCH /api/User/Me/Password` → `PATCH https://devhive-go-backend.fly.dev/api/v1/users/me/password`
  - **Request**: `{currentPassword, newPassword}`
  - **Response**: `{message: "Password updated successfully"}`
- `DELETE /api/User/Me` → `DELETE https://devhive-go-backend.fly.dev/api/v1/users/me`
  - **Response**: `{message: "Account deactivated successfully"}`
- `GET /api/User/Search` → `GET https://devhive-go-backend.fly.dev/api/v1/users/search?q={query}`
  - **Response**: `[{id, username, email, firstName, lastName, active, avatarUrl?}]`
- `GET /api/User/ValidateEmail` → `GET https://devhive-go-backend.fly.dev/api/v1/users/validate-email?email={email}`
  - **Response**: `{available: boolean}`
- `GET /api/User/ValidateUsername` → `GET https://devhive-go-backend.fly.dev/api/v1/users/validate-username?username={username}`
  - **Response**: `{available: boolean}`
- `POST /api/User/RequestPasswordReset` → `POST https://devhive-go-backend.fly.dev/api/v1/auth/password/reset-request`
  - **Request**: `{email}`
  - **Response**: `{message: "If the email exists, a reset link has been sent"}`
- `POST /api/User/ResetPassword` → `POST https://devhive-go-backend.fly.dev/api/v1/auth/password/reset`
  - **Request**: `{token, password}`
  - **Response**: `{message: "Password updated successfully"}`

### Projects
- `GET /api/Scrum/Project/{id}` → `GET https://devhive-go-backend.fly.dev/api/v1/projects/{id}`
  - **Response**: `{id, ownerId, name, description, createdAt, updatedAt, owner: {id, username, email, firstName, lastName}}`
- `POST /api/Scrum/Project` → `POST https://devhive-go-backend.fly.dev/api/v1/projects`
  - **Request**: `{name, description}`
  - **Response**: `{id, ownerId, name, description, createdAt, updatedAt}`
- `PUT /api/Scrum/Project` → `PUT https://devhive-go-backend.fly.dev/api/v1/projects/{id}`
  - **Request**: `{name?, description?}`
  - **Response**: `{id, ownerId, name, description, createdAt, updatedAt}`
- `DELETE /api/Scrum/Project/{id}` → `DELETE https://devhive-go-backend.fly.dev/api/v1/projects/{id}`
  - **Response**: `{message: "Project deleted successfully"}`
- `GET /api/Scrum/Project/Members/{id}` → `GET https://devhive-go-backend.fly.dev/api/v1/projects/{id}/members`
  - **Response**: `{members: [...], count: number}`
- `POST /api/Scrum/Project/{id}/{userId}` → `POST https://devhive-go-backend.fly.dev/api/v1/projects/{id}/members/{userId}?role=member`
  - **Response**: `{message: "Member added successfully"}`
- `DELETE /api/Scrum/Project/Members/{id}/{userId}` → `DELETE https://devhive-go-backend.fly.dev/api/v1/projects/{id}/members/{userId}`
  - **Response**: `{message: "Member removed successfully"}`
- `GET /api/Scrum/Project/{id}/Sprints` → `GET https://devhive-go-backend.fly.dev/api/v1/projects/{id}/sprints`
  - **Response**: `{sprints: [...], limit, offset}`
- `POST /api/Scrum/Sprint` → `POST https://devhive-go-backend.fly.dev/api/v1/projects/{projectId}/sprints`
  - **Request**: `{name, description, startDate, endDate}`
  - **Response**: `{id, projectId, name, description, startDate, endDate, isCompleted, isStarted, createdAt, updatedAt, owner: {...}}`
- `GET /api/Scrum/Sprint/{id}` → `GET https://devhive-go-backend.fly.dev/api/v1/sprints/{id}`
  - **Response**: `{id, projectId, name, description, startDate, endDate, isCompleted, isStarted, createdAt, updatedAt, owner: {...}}`
- `PUT /api/Scrum/Sprint` → `PUT https://devhive-go-backend.fly.dev/api/v1/sprints/{id}`
  - **Request**: `{name?, description?, startDate?, endDate?}`
  - **Response**: `{id, projectId, name, description, startDate, endDate, isCompleted, isStarted, createdAt, updatedAt, owner: {...}}`
- `DELETE /api/Scrum/Sprint/{id}` → `DELETE https://devhive-go-backend.fly.dev/api/v1/sprints/{id}`
  - **Response**: `{message: "Sprint deleted successfully"}`

### Tasks
- `POST /api/Scrum/Task` → `POST https://devhive-go-backend.fly.dev/api/v1/projects/{projectId}/tasks`
  - **Request**: `{description, sprintId?, assigneeId?, status}`
  - **Response**: `{id, projectId, sprintId?, assigneeId?, description, status, createdAt, updatedAt, assignee?: {...}, owner: {...}}`
- `GET /api/Scrum/Project/Tasks/{id}` → `GET https://devhive-go-backend.fly.dev/api/v1/projects/{id}/tasks?limit=20&offset=0`
  - **Response**: `{tasks: [...], limit, offset}`
- `GET /api/Scrum/Sprint/Tasks/{id}` → `GET https://devhive-go-backend.fly.dev/api/v1/sprints/{id}/tasks?limit=20&offset=0`
  - **Response**: `{tasks: [...], limit, offset}`
- `GET /api/Scrum/Task/{id}` → `GET https://devhive-go-backend.fly.dev/api/v1/tasks/{id}`
  - **Response**: `{id, projectId, sprintId?, assigneeId?, description, status, createdAt, updatedAt, assignee?: {...}, owner: {...}}`
- `PUT /api/Scrum/Task` → `PUT https://devhive-go-backend.fly.dev/api/v1/tasks/{id}`
  - **Request**: `{description?, assigneeId?}`
  - **Response**: `{id, projectId, sprintId?, assigneeId?, description, status, createdAt, updatedAt, assignee?: {...}, owner: {...}}`
- `PATCH /api/Scrum/Task/{id}/status` → `PATCH https://devhive-go-backend.fly.dev/api/v1/tasks/{id}/status`
  - **Request**: `{status}`
  - **Response**: `{id, projectId, sprintId?, assigneeId?, description, status, createdAt, updatedAt, assignee?: {...}, owner: {...}}`
- `DELETE /api/Scrum/Task/{id}` → `DELETE https://devhive-go-backend.fly.dev/api/v1/tasks/{id}`
  - **Response**: `{message: "Task deleted successfully"}`

### Messages
- `POST /api/Message/Send` → `POST https://devhive-go-backend.fly.dev/api/v1/projects/{projectId}/messages`
  - **Request**: `{content, messageType?, parentMessageId?}`
  - **Response**: `{id, projectId, senderId, content, messageType, parentMessageId?, createdAt, updatedAt, sender: {username, firstName, lastName, avatarUrl?}}`
- `GET /api/Message/Retrieve/{from}/{to}/{proj}` → `GET https://devhive-go-backend.fly.dev/api/v1/projects/{projectId}/messages?limit=20&offset=0`
  - **Response**: `{messages: [...], limit, offset}`
- `GET https://devhive-go-backend.fly.dev/api/v1/messages?projectId={id}&afterId={id}&limit=20`
  - **Response**: `{messages: [...], limit}` (cursor-based pagination)

### Mail Service
- `POST https://devhive-go-backend.fly.dev/api/v1/mail/send`
  - **Request**: `{to, subject, body, html?}`
  - **Response**: `{message: "Email sent successfully", to, subject}`

## Key Changes Made

### 1. API Configuration
- Updated `src/config.js` with new endpoint mappings
- Added environment variable support
- Maintained backward compatibility with legacy endpoints

### 2. Authentication Structure Changes
- **Login**: Now uses `username` instead of `email` for authentication
- **Registration**: Updated to include `username`, `email`, `password`, `firstName`, `lastName`
- **Password Reset Request**: Simplified to only require `email`
- **Password Reset**: Uses `token` and `password` fields
- **Response Format**: Login returns `{token, userId}` structure

### 3. Service Updates
- **Auth Service**: Updated to use new auth endpoints
- **Project Service**: Updated to use new project endpoints with query parameters
- **Task Service**: Updated to use new task endpoints with proper project context
- **Message Service**: Updated to use new message endpoints with query parameters
- **Mail Service**: Added email functionality for notifications and password reset

### 4. Error Handling
- Implemented RFC-7807 error handling in axios interceptors
- Added automatic token cleanup on 401 errors
- Normalized error messages across all services

### 5. Pagination
- Created `useCursorList` hook for cursor-based pagination
- Supports `afterId`, `limit`, and `hasMore` parameters
- Automatic loading states and error handling

### 6. Mail Service Integration
- **Password Reset Emails**: Automatic email sending with reset links
- **Welcome Emails**: Sent to new users upon registration
- **Project Invite Emails**: For team collaboration
- **Custom Email Templates**: HTML and plain text support
- **Error Handling**: Graceful fallback if email service fails

### 7. Message System Overhaul
- **Project-Based Messaging**: Messages organized by project instead of user-to-user
- **Message Types**: Support for different message types (text, etc.)
- **Threading Support**: Reply to specific messages with parentMessageId
- **Rich Sender Info**: Includes username, firstName, lastName, avatarUrl
- **Pagination**: Both offset-based and cursor-based pagination
- **Real-time Updates**: WebSocket support for live messaging
- **Message Replies**: Built-in support for threaded conversations

### 8. Project Management Overhaul
- **Rich Project Responses**: Includes owner information and timestamps
- **Pagination Support**: Projects list with limit and offset parameters
- **Project Access Control**: Automatic access validation for all operations
- **Member Management**: Add/remove/list project members with roles
- **Full CRUD Operations**: Create, read, update, delete projects
- **Owner Information**: Detailed owner data in project responses
- **Role-Based Access**: Support for different member roles

### 9. Sprint Management Overhaul
- **Rich Sprint Responses**: Includes owner information and timestamps
- **Pagination Support**: Sprints list with limit and offset parameters
- **Project Access Control**: Automatic access validation for all operations
- **Flexible Date Parsing**: Supports both YYYY-MM-DD and RFC3339 formats
- **Sprint Status Management**: isCompleted and isStarted flags
- **Full CRUD Operations**: Create, read, update, delete sprints
- **Sprint Lifecycle**: Start and complete sprint functionality
- **Active Sprint Tracking**: Get current active sprint for a project
- **Next Sprint Planning**: Get next sprint to start

### 10. Task Management Overhaul
- **Rich Task Responses**: Includes assignee and owner information
- **Pagination Support**: Tasks list with limit and offset parameters
- **Project Access Control**: Automatic access validation for all operations
- **Sprint Integration**: Tasks can be assigned to sprints
- **Assignee Management**: Assign/unassign tasks to users
- **Status Management**: Proper task status handling (Pending, In Progress, Completed)
- **Full CRUD Operations**: Create, read, update, delete tasks
- **Sprint Movement**: Move tasks between sprints
- **Status Helpers**: Get status names and colors for UI display

### 11. User Management Overhaul
- **Rich User Responses**: Includes all user fields and timestamps
- **User Profile Management**: Get current user and other users by ID
- **Profile Updates**: Update user profile information
- **Password Management**: Change password functionality
- **Account Management**: Deactivate account functionality
- **User Search**: Search users by username or email
- **Validation**: Email and username availability validation
- **Avatar Support**: Optional avatar URL handling
- **Active Status**: User active/inactive state management
- **Helper Functions**: User initials and display name utilities

## Rollout Strategy

### Phase 1: Configuration Update
1. Deploy with new API configuration
2. Keep server shim active for 30-60 days
3. Monitor old endpoint usage

### Phase 2: Gradual Migration
1. Convert endpoints feature-by-feature
2. Test each feature thoroughly
3. Monitor error rates and performance

### Phase 3: Cleanup
1. Remove server shim after zero old endpoint hits
2. Remove legacy endpoint mappings
3. Clean up unused code

## Testing Checklist

- [ ] Login/Register functionality
- [ ] Project creation and management
- [ ] Task creation and status updates
- [ ] Message sending and retrieval
- [ ] WebSocket real-time messaging
- [ ] Error handling and user feedback
- [ ] Pagination on all list endpoints
- [ ] Authentication token management

## Rollback Plan

If issues arise, you can quickly rollback by:
1. Setting `VITE_API_BASE_URL=https://devhive-go-backend.fly.dev/api` (legacy)
2. Reverting service files to use `ENDPOINTS.LEGACY.*`
3. Monitoring error rates and user feedback

## Monitoring

Track these metrics during migration:
- API response times
- Error rates by endpoint
- User authentication success rates
- WebSocket connection stability
- User feedback and bug reports

## Support

For issues during migration:
1. Check browser console for API errors
2. Verify environment variables are set correctly
3. Test with both old and new API endpoints
4. Monitor server logs for shim usage

## Related Documentation

- [Project Architecture](../System/project_architecture.md) - Overall system architecture
- [Environment Setup](./environment_setup.md) - Development environment configuration
- [Development Workflow](./development_workflow.md) - Common development procedures
- [Realtime Messaging](../System/realtime_messaging.md) - WebSocket and messaging system

