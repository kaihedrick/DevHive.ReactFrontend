# DevHive Backend - Project Architecture

## Related Documentation
- [Database Schema](./database_schema.md) - Complete database schema and relationships
- [Authentication Flow](./authentication_flow.md) - JWT authentication and refresh token mechanism
- [Real-time System](./realtime_system.md) - WebSocket and cache invalidation architecture
- [SOP: Adding Migrations](../SOP/adding_migrations.md)
- [SOP: Adding API Endpoints](../SOP/adding_api_endpoints.md)
- [SOP: AWS Deployment](../SOP/aws_deployment.md) - Deploying to AWS Lambda and API Gateway

## Project Overview

**DevHive Backend** is a modern, scalable Go backend for project management and team collaboration. It provides comprehensive APIs for user management, project organization, sprint planning, task tracking, and real-time messaging.

### Core Purpose
- Enable teams to collaborate on projects with role-based access control
- Support agile sprint planning and task management
- Provide real-time updates through WebSocket connections
- Offer secure authentication with JWT tokens and refresh mechanism

### Tech Stack

#### Backend Framework
- **Go 1.25** - Primary language
- **Chi v5** - HTTP router (lightweight, idiomatic)
- **SQLC** - Type-safe SQL code generation
- **PostgreSQL 12+** - Primary database (Neon serverless PostgreSQL in production)

#### AWS Infrastructure (Production)
- **AWS Lambda** - Serverless compute for HTTP API and WebSocket handling
- **AWS API Gateway HTTP API** - REST API endpoints with CORS
- **AWS API Gateway WebSocket API** - Real-time bidirectional communication
- **AWS DynamoDB** - WebSocket connection state storage
- **AWS SAM** - Infrastructure as Code deployment
- **Neon PostgreSQL** - Serverless PostgreSQL database

#### Key Libraries
- `jackc/pgx/v5` - PostgreSQL driver and connection pooling
- `golang-jwt/jwt/v5` - JWT token generation and validation
- `aws-lambda-go` - AWS Lambda Go runtime
- `aws-lambda-go-api-proxy/httpadapter` - Chi router to Lambda adapter
- `aws-sdk-go-v2` - AWS SDK for DynamoDB, Lambda invocation
- `gorilla/websocket` - WebSocket support (local development)
- `go-chi/cors` - CORS middleware
- `go-chi/httprate` - Rate limiting (100 req/min per IP)
- `golang.org/x/crypto` - bcrypt password hashing
- `joho/godotenv` - Environment variable management

#### Optional Integrations
- Firebase Auth (v4.18.0) - Alternative authentication provider
- Firebase Storage - File storage
- Resend - Transactional email delivery
- gRPC - Optional gRPC API endpoints

## Project Structure

```
DevHive.GoBackend/
├── cmd/
│   ├── devhive-api/
│   │   ├── main.go                 # Local development entry point (HTTP server)
│   │   └── migrations/             # Database migration files (SQL)
│   ├── lambda/
│   │   └── main.go                 # AWS Lambda HTTP API handler
│   ├── websocket/
│   │   └── main.go                 # AWS Lambda WebSocket handler
│   └── broadcaster/
│       └── main.go                 # AWS Lambda broadcaster (pushes to WebSocket clients)
├── internal/                       # Private application code
│   ├── config/                     # Configuration management
│   │   └── config.go              # Environment-based config loading
│   ├── repo/                       # SQLC-generated database layer
│   │   ├── db.go                  # Database interface
│   │   ├── models.go              # Auto-generated models
│   │   └── queries.sql.go         # Auto-generated query functions
│   ├── http/
│   │   ├── handlers/              # HTTP request handlers
│   │   │   ├── auth.go            # Authentication endpoints
│   │   │   ├── user.go            # User management
│   │   │   ├── project.go         # Project CRUD and invites
│   │   │   ├── sprint.go          # Sprint management
│   │   │   ├── task.go            # Task management
│   │   │   ├── message.go         # Messaging and WebSocket
│   │   │   ├── mail.go            # Email sending
│   │   │   └── migration.go       # Migration utilities (dev/admin)
│   │   ├── middleware/
│   │   │   ├── auth.go            # JWT authentication middleware
│   │   │   └── cache.go           # Cache invalidation middleware
│   │   ├── response/
│   │   │   └── response.go        # Standardized HTTP responses
│   │   └── router/
│   │       └── router.go          # Route definitions and setup
│   ├── ws/                         # WebSocket system (local development)
│   │   ├── hub.go                 # WebSocket hub and client management
│   │   └── handlers.go            # WebSocket message handlers
│   ├── broadcast/                  # AWS WebSocket broadcasting
│   │   └── client.go              # Lambda invocation client for broadcaster
│   ├── db/                         # Database utilities
│   │   ├── notify_listener.go     # PostgreSQL NOTIFY listener (local dev)
│   │   └── postgres.go            # Database connection and migration runner
│   ├── grpc/                       # gRPC server (optional)
│   └── auth/                       # Authentication utilities
├── db/                             # Database layer
│   ├── migrate.go                 # Migration runner
│   └── postgres.go                # DB connection utilities
├── config/                         # Legacy config (deprecated)
├── api/v1/                         # gRPC proto definitions
├── frontend-examples/              # Frontend integration examples
│   └── src/
│       ├── lib/
│       │   └── apiClient.ts       # Axios client with token refresh
│       ├── hooks/
│       │   └── useInvites.ts      # Example React hooks
│       └── components/
│           ├── ProjectInvites.tsx  # Invite management UI
│           └── ProjectPage.example.tsx
├── docs/                           # Additional documentation
├── .agent/                         # AI assistant documentation (this folder)
│   ├── System/                    # Architecture and design docs
│   ├── Tasks/                     # Feature PRDs and implementation plans
│   ├── SOP/                       # Standard operating procedures
│   └── README.md                  # Documentation index
├── go.mod                          # Go module dependencies
├── sqlc.yaml                       # SQLC configuration
├── template.yaml                   # AWS SAM template (Infrastructure as Code)
├── samconfig.toml                  # AWS SAM deployment configuration
├── Dockerfile                      # Container image definition (local/Fly.io)
├── fly.toml                        # Fly.io deployment config (legacy)
└── Makefile                        # Build and development tasks
```

## Architecture Layers

### 1. HTTP Layer (Entry Point)
- **Router** (`internal/http/router/router.go`): Chi-based HTTP router with middleware chain
- **Handlers** (`internal/http/handlers/`): Request processing and business logic
- **Middleware**:
  - Request ID, logging, recovery (Chi built-in)
  - Rate limiting (100 req/min per IP)
  - CORS (configurable origins)
  - JWT authentication (`middleware.RequireAuth`)

### 2. Data Layer
- **SQLC Repository** (`internal/repo/`): Type-safe SQL queries auto-generated from SQL files
- **Database Connection**: pgx v5 connection pool (25 max open, 5 max idle, 5min lifetime)
- **Migrations**: Sequential SQL files in `cmd/devhive-api/migrations/`

### 3. Real-time Layer
- **WebSocket Hub** (`internal/ws/hub.go`): Central hub managing all WebSocket connections
- **PostgreSQL NOTIFY** (`internal/db/notify_listener.go`): Database triggers broadcast changes
- **Cache Invalidation**: Triggers on INSERT/UPDATE/DELETE notify connected clients

### 4. gRPC Layer (Optional)
- Separate gRPC server on port 8081
- Proto definitions in `api/v1/`
- Parallel to HTTP API (not widely used currently)

## Core Features

### Authentication & Authorization
- **JWT-based authentication** with access tokens (15min) and refresh tokens (7 days)
- **Refresh token rotation**: Stored in PostgreSQL, validated on refresh
- **Password hashing**: bcrypt with automatic salt
- **Role-based access control**: Project-level roles (owner, admin, member, viewer)
- **Public endpoints**: Email/username validation, invite details, password reset

### User Management
- User registration with email/username validation
- Profile management (first name, last name, bio, avatar)
- Password reset flow with time-limited tokens
- Active/inactive user status

### Project Management
- CRUD operations for projects
- Project ownership and member management
- Role-based permissions per project
- Time-limited invite links with optional max uses
- Public invite acceptance flow

### Sprint Planning
- Sprint CRUD with start/end dates
- Sprint status tracking (is_started, is_completed)
- Association with projects
- Task assignment to sprints

### Task Tracking
- Task CRUD operations
- Status management (integer-based status codes)
- Sprint and assignee association
- Project-level task listing

### Messaging & Real-time
- Project-based threaded messaging
- WebSocket connections for real-time updates
- Message types: text, image, file
- Parent-child message relationships (threading)

## Configuration

Configuration is loaded from environment variables with fallback defaults (see `internal/config/config.go`):

```go
type Config struct {
    Port          string             // HTTP port (default: 8080)
    GRPCPort      string             // gRPC port (default: 8081)
    DatabaseURL   string             // PostgreSQL connection string
    JWT           JWTConfig          // JWT signing key, expiration
    CORS          CORSConfig         // Allowed origins, credentials
    Mail          MailConfig         // Mailgun API key, domain, sender
    GoogleOAuth   GoogleOAuthConfig  // Google OAuth 2.0 configuration
    AdminPassword string             // Admin verification password
}
```

### Environment Variables

#### Core Configuration
- `DATABASE_URL` - PostgreSQL connection string (Neon serverless in production)
- `JWT_SIGNING_KEY` - Secret for JWT token signing
- `JWT_EXPIRATION_MINUTES` - Access token lifetime (default: 15)
- `JWT_REFRESH_EXPIRATION_DAYS` - Refresh token lifetime (default: 7)
- `JWT_REFRESH_EXPIRATION_PERSISTENT_DAYS` - Persistent refresh token lifetime for "Remember Me" (default: 30)
- `JWT_REFRESH_EXPIRATION_SESSION_HOURS` - Session refresh token lifetime (default: 0 = browser session)
- `CORS_ORIGINS` - Comma-separated allowed origins
- `ADMIN_CERTIFICATES_PASSWORD` - Admin verification password
- `FRONTEND_URL` - Frontend URL for OAuth redirects (default: `https://devhive.it.com`)

#### Email (Resend)
- `RESEND_API_KEY` - Resend API key for transactional emails
- `RESEND_FROM_EMAIL` - Sender email address (default: `noreply@devhive.it.com`)

#### Google OAuth
- `GOOGLE_CLIENT_ID` - Google OAuth 2.0 client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth 2.0 client secret
- `GOOGLE_REDIRECT_URL` - OAuth callback URL
  - Local: `http://localhost:8080/api/v1/auth/google/callback`
  - Production: `https://go.devhive.it.com/api/v1/auth/google/callback`

#### AWS Lambda-specific
- `BROADCASTER_FUNCTION_NAME` - Name of broadcaster Lambda (set automatically by SAM)
- `CONNECTIONS_TABLE` - DynamoDB table name for WebSocket connections
- `WEBSOCKET_ENDPOINT` - WebSocket API Gateway endpoint for broadcaster

#### Optional (Firebase)
- `FIREBASE_JSON_BASE64` - Base64-encoded Firebase service account JSON
- `FIREBASE_STORAGE_BUCKET` - Firebase Storage bucket name

## Database Design Principles

### Core Tables
- **users** - User accounts with bcrypt password hashing
- **projects** - Project entities with owner reference
- **project_members** - Many-to-many with role (owner, admin, member, viewer)
- **project_invites** - Time-limited invite links with usage tracking
- **sprints** - Sprint planning with dates and status
- **tasks** - Task entities with sprint/assignee associations
- **messages** - Threaded messaging with parent reference
- **refresh_tokens** - Persistent refresh token storage
- **password_resets** - Time-limited password reset tokens

### Key Design Patterns
- **UUID primary keys** across all tables for distributed system compatibility
- **Soft deletes** not implemented (hard deletes with CASCADE)
- **Timestamp tracking** (created_at, updated_at with triggers)
- **Indexed foreign keys** for query performance
- **CITEXT for emails** - Case-insensitive email storage
- **JSON payloads in NOTIFY** - Minimal, targeted cache invalidation

## API Design

### RESTful Conventions
- `GET /api/v1/projects` - List projects
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects/{projectId}` - Get project details
- `PATCH /api/v1/projects/{projectId}` - Update project
- `DELETE /api/v1/projects/{projectId}` - Delete project

### Nested Resources
- `GET /api/v1/projects/{projectId}/sprints` - List project sprints
- `POST /api/v1/projects/{projectId}/sprints` - Create sprint
- `GET /api/v1/projects/{projectId}/tasks` - List project tasks
- `GET /api/v1/projects/{projectId}/messages` - List project messages

### Authentication
- **Public endpoints**: `/auth/login`, `/auth/refresh`, `/auth/google/login`, `/auth/google/callback`, `/users` (POST), `/invites/{token}` (GET)
- **Protected endpoints**: All others require `Authorization: Bearer <token>` header
- **Token refresh**: Automatic retry with refresh token on 401 responses (see frontend apiClient.ts)

### Response Format
Standardized JSON responses:
```json
{
  "message": "Success message",
  "data": { ... }
}
```

Error responses:
```json
{
  "error": "Error message"
}
```

## Deployment Architecture

### AWS Serverless (Production)

The production deployment uses AWS serverless architecture with three Lambda functions:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AWS API Gateway                                    │
├─────────────────────────────────┬───────────────────────────────────────────┤
│       HTTP API (REST)           │        WebSocket API                       │
│   https://xxx.execute-api...    │    wss://xxx.execute-api.../prod           │
└───────────────┬─────────────────┴──────────────────┬────────────────────────┘
                │                                     │
                ▼                                     ▼
┌───────────────────────────┐         ┌──────────────────────────────┐
│   devhive-api Lambda      │         │   devhive-websocket Lambda   │
│   (HTTP API Handler)      │         │   (WebSocket Handler)        │
│   - Chi router adapter    │         │   - $connect, $disconnect    │
│   - All REST endpoints    │         │   - subscribe, unsubscribe   │
│   - Auth, projects, etc.  │         │   - JWT validation           │
└───────────────┬───────────┘         └──────────────────────────────┘
                │                                     │
                │                                     │
                │ invokes                             │ reads/writes
                ▼                                     ▼
┌───────────────────────────┐         ┌──────────────────────────────┐
│   devhive-broadcaster     │         │       DynamoDB Table         │
│   Lambda                  │◄────────│   devhive-ws-connections     │
│   - Push to WS clients    │         │   - connectionId (PK)        │
│   - Query by project_id   │         │   - projectId (GSI)          │
└───────────────────────────┘         │   - userId, TTL              │
                                      └──────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                          Neon PostgreSQL (us-west-2)                          │
│   postgresql://...@ep-xxx.us-west-2.aws.neon.tech/neondb?sslmode=require     │
└───────────────────────────────────────────────────────────────────────────────┘
```

#### Lambda Functions

| Function | Purpose | Trigger |
|----------|---------|---------|
| `devhive-api` | HTTP REST API | API Gateway HTTP API |
| `devhive-websocket` | WebSocket connections | API Gateway WebSocket API |
| `devhive-broadcaster` | Push messages to clients | Invoked by devhive-api |

#### AWS Resources (from template.yaml)

- **DevHiveHttpApi** - HTTP API Gateway with CORS
- **DevHiveWebSocketApi** - WebSocket API Gateway
- **ConnectionsTable** - DynamoDB table for WebSocket connections
- **DevHiveFunction** - HTTP API Lambda
- **WebSocketFunction** - WebSocket Lambda
- **BroadcasterFunction** - Broadcaster Lambda

#### Production URLs

**Custom Domains (recommended):**
- **HTTP API**: `https://go.devhive.it.com`
- **WebSocket**: `wss://ws.devhive.it.com`

**Direct API Gateway URLs:**
- **HTTP API**: `https://7x1vij0u6k.execute-api.us-west-2.amazonaws.com`
- **WebSocket**: `wss://er7oc4a3o5.execute-api.us-west-2.amazonaws.com/prod`

### Fly.io Deployment (Legacy/Alternative)
- **Platform**: Fly.io with Docker containerization
- **Database**: Fly.io PostgreSQL cluster or external
- **Storage**: Fly.io persistent volumes for file uploads
- **Regions**: Configurable (default: DFW)
- **Scaling**: Horizontal scaling supported (stateless design)

### Health Checks
- `GET /health` - Basic health check
- `GET /healthz` - Liveness probe
- `GET /readyz` - Readiness probe (checks DB connection)

### CI/CD Pipeline
- GitHub Actions workflows in `.github/workflows/`
- Automated testing on push
- AWS SAM build and deploy for Lambda
- Container builds for Fly.io (alternative)

## Security Features

### Authentication Security
- bcrypt password hashing (automatic salt)
- Short-lived access tokens (15min)
- Refresh token rotation (7 days)
- Token invalidation on logout
- Secure cookie support (withCredentials)

### API Security
- Rate limiting (100 req/min per IP)
- CORS with configurable origins
- Request ID tracking for audit logs
- SQL injection prevention (parameterized queries via SQLC)
- Input validation on all endpoints

### Database Security
- Foreign key constraints with CASCADE deletes
- Unique constraints on email/username
- Password reset token expiration
- Invite token expiration and usage limits

## Performance Optimizations

### Database
- Connection pooling (pgx v5 pool)
- Indexed foreign keys
- Efficient query patterns via SQLC
- NOTIFY/LISTEN for cache invalidation (vs polling)

### HTTP
- Rate limiting to prevent abuse
- Compression support
- Keep-alive connections
- Request/response timeouts (15s read/write, 60s idle)

### WebSocket
- Centralized hub architecture
- Project-based message filtering
- Automatic ping/pong health checks (54s interval)
- Graceful connection cleanup

## Integration Points

### Frontend Integration
- Example React components in `frontend-examples/`
- Axios client with automatic token refresh
- WebSocket connection management
- TypeScript type definitions (can be generated)

### External Services
- **Neon** - Serverless PostgreSQL database (production)
- **Resend** - Transactional email delivery
- **Google OAuth** - Social authentication
- **Firebase** (optional) - File storage
- **AWS** - Lambda, API Gateway, DynamoDB (production infrastructure)

## Development Workflow

### Local Development
1. Set up PostgreSQL database (or use Neon for remote dev)
2. Copy `.env.example` to `.env` and configure
3. Run `go mod download` to install dependencies
4. Run `make migrate` or start server (auto-migrates)
5. Access API at `http://localhost:8080`

### AWS Deployment
```bash
# Build Lambda functions
sam build --profile devhive

# Deploy to AWS (with parameters)
sam deploy --profile devhive --parameter-overrides \
  "DatabaseURL=postgresql://..." \
  "JWTSigningKey=..." \
  "GoogleClientID=..." \
  "GoogleClientSecret=..." \
  ...
```

See [SOP: AWS Deployment](../SOP/aws_deployment.md) for full deployment guide.

### Code Generation
- **SQLC**: `sqlc generate` to regenerate database code
- **gRPC**: `protoc` to generate proto code (if using gRPC)

### Testing
- Unit tests: `go test ./...`
- Coverage: `go test -cover ./...`
- Integration tests in `.github/tests/`

## Monitoring and Observability

### Logging
- Structured logging with Chi middleware
- Request ID tracking
- WebSocket connection tracking
- Database query logging (via pgx)

### Metrics
- Health check endpoints
- Connection pool statistics
- WebSocket client counts
- Migration status verification

## Known Limitations & Future Improvements

### Current Limitations
- WebSocket real-time in Lambda requires broadcaster Lambda invocation (adds latency)
- Admin endpoints (`/migrations`) not production-secured
- Firebase integration optional but not fully utilized
- gRPC API exists but not actively used
- PostgreSQL NOTIFY/LISTEN not available in Lambda (replaced by broadcaster pattern)

### Planned Improvements
- Enhanced observability (CloudWatch metrics, X-Ray tracing)
- Admin role and RBAC for system-level operations
- Automated database backup (Neon handles this)
- Multi-region deployment support
- WebSocket connection authentication improvements
