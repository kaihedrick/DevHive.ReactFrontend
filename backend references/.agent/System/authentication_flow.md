# DevHive Backend - Authentication & Authorization

## Related Documentation
- [Project Architecture](./project_architecture.md) - Overall system architecture
- [Database Schema](./database_schema.md) - Users, refresh_tokens, password_resets tables
- [SOP: Testing Authentication](../SOP/testing_authentication.md)

## Overview

DevHive uses a **dual-token JWT authentication system** with support for both local (username/password) and Google OAuth 2.0 authentication:
- **Access tokens** (short-lived, 15 minutes) for API requests
- **Refresh tokens** (long-lived, configurable persistence) for obtaining new access tokens
- **Remember Me** functionality controls session persistence (30 days vs browser session)

This approach balances security (short-lived access tokens) with user experience (don't require frequent re-authentication).

### Authentication Methods
1. **Local Authentication**: Username/password-based login with bcrypt password hashing
2. **Google OAuth 2.0**: OAuth-based authentication using Google accounts

## Authentication Flow

### 1. User Registration

**Endpoint:** `POST /api/v1/users`

**Request:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePassword123",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Process:**
1. **Validation:**
   - Email format validation (must match RFC 5322 pattern)
   - Username validation (3-20 alphanumeric characters, underscores, hyphens)
   - Email uniqueness check (case-insensitive)
   - Username uniqueness check (case-insensitive)
2. **Password Hashing:**
   - bcrypt with automatic salt (cost factor: 10)
   - Stored in `users.password_h` column
3. **User Creation:**
   - Insert into `users` table with `active = true`
   - Return user object (without password hash)

**Response:**
```json
{
  "data": {
    "id": "uuid-here",
    "username": "johndoe",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "active": true,
    "created_at": "2025-12-22T12:00:00Z"
  }
}
```

**Implementation:** `internal/http/handlers/user.go:CreateUser()`

---

### 2. User Login

**Endpoint:** `POST /api/v1/auth/login`

**Request:**
```json
{
  "username": "johndoe",
  "password": "SecurePassword123",
  "rememberMe": true
}
```

**Process:**
1. **User Lookup:**
   - Query `users` table by username (case-insensitive)
   - Return 401 if user not found
2. **Password Verification:**
   - bcrypt.CompareHashAndPassword(stored_hash, provided_password)
   - Return 401 if password doesn't match
3. **Active Check:**
   - Verify `users.active = true`
   - Return 401 if account deactivated
4. **Access Token Generation:**
   - JWT with HS256 signing algorithm
   - Claims: user_id (subject), issuer, audience, expiration (15min)
   - Signed with `JWT_SIGNING_KEY` from config
5. **Refresh Token Generation (with Remember Me support):**
   - Random 64-character hex string
   - If `rememberMe=true`: 30-day expiration, `is_persistent=true`, cookie MaxAge=30 days
   - If `rememberMe=false`: 7-day DB expiration, `is_persistent=false`, cookie MaxAge=0 (session)
   - Insert into `refresh_tokens` table with appropriate settings
   - Set as HTTP-only cookie with appropriate MaxAge
6. **Response:**
   - Return access token and user ID

**Response:**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userId": "uuid-here"
  }
}
```

**Set-Cookie Header (if using cookies):**
```
Set-Cookie: refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/api/v1/auth/refresh
```

**Implementation:** `internal/http/handlers/auth.go:Login()`

---

### 3. Token Refresh

**Endpoint:** `POST /api/v1/auth/refresh`

**Request:**
```json
{
  "refresh_token": "hex-token-here"
}
```
*Or via HTTP-only cookie (preferred for web apps)*

**Process:**
1. **Extract Refresh Token:**
   - From request body OR from cookie
2. **Validate Refresh Token:**
   - Query `refresh_tokens` WHERE `token = $1 AND expires_at > now()`
   - Return 401 if not found or expired
3. **Generate New Access Token:**
   - Create new JWT with user_id from refresh token record
   - 15-minute expiration
4. **Response:**
   - Return new access token
   - Keep same refresh token (no rotation currently)

**Response:**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Implementation:** `internal/http/handlers/auth.go:Refresh()`

**Frontend Integration:**
The frontend automatically refreshes tokens on 401 responses using axios interceptors (see `frontend-examples/src/lib/apiClient.ts`).

---

### 4. User Logout

**Endpoint:** `POST /api/v1/auth/logout`

**Request:**
```json
{
  "refresh_token": "hex-token-here"
}
```
*Or via HTTP-only cookie*

**Process:**
1. **Extract Refresh Token**
2. **Delete Refresh Token:**
   - `DELETE FROM refresh_tokens WHERE token = $1`
3. **Clear Cookie** (if using cookies)
4. **Response:** Success message

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

**Frontend Action:**
- Clear access token from memory
- Clear any auth-related localStorage
- Redirect to login page

**Implementation:** `internal/http/handlers/auth.go:Logout()`

---

## JWT Token Structure

### Access Token Claims

```json
{
  "sub": "user-uuid-here",           // Subject: User ID
  "iss": "https://api.devhive.it.com", // Issuer
  "aud": "devhive-clients",          // Audience
  "exp": 1703257200,                 // Expiration (Unix timestamp, 15min from now)
  "iat": 1703256300                  // Issued at (Unix timestamp)
}
```

**Signing:**
- Algorithm: HS256 (HMAC with SHA-256)
- Secret: `JWT_SIGNING_KEY` from environment config
- Library: `golang-jwt/jwt/v5`

**Validation:**
- Signature verification
- Expiration check
- Issuer/audience validation (optional, not enforced currently)

### Refresh Token

- **Format:** Random 64-character hex string
- **Generation:** `crypto/rand` -> hex encoding
- **Storage:** PostgreSQL `refresh_tokens` table
- **Validation:** Database lookup + expiration check

---

## Authorization & Access Control

### Request Authentication

**Middleware:** `internal/http/middleware/auth.go:RequireAuth()`

**Process:**
1. **Extract Token:**
   - From `Authorization: Bearer <token>` header
   - Return 401 if missing
2. **Parse & Validate JWT:**
   - Verify signature with signing key
   - Check expiration
   - Extract user_id from subject claim
3. **Inject User ID:**
   - Add user_id to request context for handlers
4. **Continue to Handler**

**Protected Endpoints:**
All endpoints except:
- `/api/v1/auth/login`
- `/api/v1/auth/refresh`
- `/api/v1/auth/google/login` (OAuth initiation)
- `/api/v1/auth/google/callback` (OAuth callback)
- `/api/v1/auth/password/reset-request`
- `/api/v1/auth/password/reset`
- `/api/v1/users` (POST only - registration)
- `/api/v1/users/validate-email`
- `/api/v1/users/validate-username`
- `/api/v1/invites/{token}` (GET only - invite details)

---

### Project-Level Authorization

**Role-Based Access Control (RBAC):**

| Role | Permissions |
|------|-------------|
| **owner** | Full control: delete project, manage all settings, manage members, create/edit/delete sprints/tasks |
| **admin** | Manage members, create/edit/delete sprints/tasks, cannot delete project |
| **member** | Create/edit tasks, view sprints, cannot manage members or delete project |
| **viewer** | Read-only access to project, sprints, tasks, messages |

**Authorization Check Pattern:**

```go
// Get project membership
member, err := queries.GetProjectMember(ctx, project_id, user_id)
if err != nil {
    return 403 // Forbidden
}

// Check role for specific operation
if member.Role != "owner" && member.Role != "admin" {
    return 403 // Only owners/admins can do this
}
```

**Common Checks:**
- **View project:** Any role (owner, admin, member, viewer)
- **Create/edit tasks:** member, admin, owner
- **Delete tasks:** admin, owner
- **Manage members:** admin, owner
- **Delete project:** owner only
- **Create invites:** admin, owner

**Implementation:**
- Most handlers check project membership before performing actions
- Some handlers check specific roles (e.g., only owners can delete projects)
- Currently enforced in application code, not database constraints

---

## Password Reset Flow

### 1. Request Password Reset

**Endpoint:** `POST /api/v1/auth/password/reset-request`

**Request:**
```json
{
  "email": "john@example.com"
}
```

**Process:**
1. **Find User by Email:**
   - Case-insensitive lookup
   - Return success even if user not found (security: don't leak user existence)
2. **Generate Reset Token:**
   - Random hex string
   - Insert into `password_resets` with 1-hour expiration
3. **Send Email:**
   - Use Mailgun to send reset link
   - Link format: `https://app.devhive.com/reset-password?token=<reset_token>`
4. **Response:** Success message (always, even if email doesn't exist)

**Response:**
```json
{
  "message": "If the email exists, a password reset link has been sent"
}
```

**Implementation:** `internal/http/handlers/auth.go:RequestPasswordReset()`

---

### 2. Reset Password

**Endpoint:** `POST /api/v1/auth/password/reset`

**Request:**
```json
{
  "token": "reset-token-here",
  "password": "NewSecurePassword123"
}
```

**Process:**
1. **Validate Reset Token:**
   - Query `password_resets` WHERE `token = $1 AND expires_at > now()`
   - Return 400 if not found or expired
2. **Hash New Password:**
   - bcrypt with automatic salt
3. **Update User Password:**
   - `UPDATE users SET password_h = $1 WHERE id = $2`
4. **Delete Reset Token:**
   - `DELETE FROM password_resets WHERE token = $1`
5. **Response:** Success message

**Response:**
```json
{
  "message": "Password has been reset successfully"
}
```

**Implementation:** `internal/http/handlers/auth.go:ResetPassword()`

---

## Change Password (Authenticated)

**Endpoint:** `POST /api/v1/auth/password/change`

**Headers:** `Authorization: Bearer <token>` (required)

**Request:**
```json
{
  "current_password": "OldPassword123",
  "new_password": "NewSecurePassword123"
}
```

**Process:**
1. **Authenticate User:** Via JWT middleware
2. **Verify Current Password:**
   - Get user from database
   - bcrypt.CompareHashAndPassword
   - Return 401 if doesn't match
3. **Hash New Password**
4. **Update Password:**
   - `UPDATE users SET password_h = $1 WHERE id = $2`
5. **Invalidate Refresh Tokens** (optional, not implemented currently)
6. **Response:** Success message

**Response:**
```json
{
  "message": "Password changed successfully"
}
```

**Implementation:** `internal/http/handlers/auth.go:ChangePassword()`

---

## Admin Password Verification

### Admin Password Protection

Some frontend operations (e.g., accessing certificates) require admin password verification.

**Endpoint:** `POST /api/v1/verify-password`

**Request:**
```json
{
  "password": "admin-password-here"
}
```

**Process:**
1. **Compare with Config:**
   - Check against `config.AdminPassword` from environment
   - Plain text comparison (not hashed, since it's a shared admin password)
2. **Response:** Valid/invalid

**Response:**
```json
{
  "valid": true
}
```

**Security Note:**
This is a simple shared password mechanism, not tied to user accounts. Consider replacing with proper admin RBAC in the future.

**Implementation:** `internal/http/handlers/auth.go:VerifyPassword()`

---

## Token Validation Endpoint

**Endpoint:** `GET /api/v1/auth/validate-token`

**Headers:** `Authorization: Bearer <token>`

**Process:**
1. **Extract & Validate JWT:**
   - Parse token from Authorization header
   - Verify signature and expiration
2. **Response:** Valid/invalid with user info

**Response (valid):**
```json
{
  "valid": true,
  "userId": "uuid-here"
}
```

**Response (invalid):**
```json
{
  "valid": false,
  "error": "Token expired"
}
```

**Use Case:** Frontend can check if token is still valid before making API calls.

**Implementation:** `internal/http/handlers/auth.go:ValidateToken()`

---

## Security Best Practices

### Password Security
- **bcrypt hashing** with automatic salt (cost factor 10)
- **Minimum password requirements** enforced at application level (recommend 8+ chars, mix of letters/numbers)
- **No password storage in logs or responses**

### Token Security
- **Short-lived access tokens** (15 minutes) limit exposure window
- **HttpOnly cookies** for refresh tokens prevent XSS attacks
- **Secure flag** on cookies ensures HTTPS-only transmission
- **SameSite=Strict** prevents CSRF attacks

### Rate Limiting
- **Global rate limit:** 100 requests/minute per IP
- **Consider adding:** Auth-specific rate limits (e.g., 5 login attempts/minute)

### CORS Configuration
- **Allowed origins:** Configurable via environment (whitelist specific domains)
- **Credentials support:** `withCredentials: true` for cookie-based refresh tokens

### Database Security
- **Parameterized queries** via SQLC prevent SQL injection
- **Foreign key constraints** ensure data integrity
- **Cascade deletes** on user deletion clean up auth records

---

## Frontend Integration Guide

### Axios Client Setup

See `frontend-examples/src/lib/apiClient.ts` for complete implementation.

**Key Features:**
1. **Automatic token injection:**
   - Request interceptor adds `Authorization: Bearer <token>` header
   - Skips auth routes (login, register, refresh)
2. **Automatic token refresh on 401:**
   - Response interceptor catches 401 errors
   - Calls `/auth/refresh` to get new access token
   - Retries original request with new token
   - Redirects to login if refresh fails
3. **Request queuing during refresh:**
   - Multiple concurrent 401s trigger single refresh
   - Other requests wait and retry with new token

**Usage:**
```typescript
import apiClient from './lib/apiClient';

// Login
const { data } = await apiClient.post('/auth/login', { username, password });
tokenManager.setAccessToken(data.token);

// Make authenticated request (token added automatically)
const projects = await apiClient.get('/projects');

// Token refresh happens automatically on 401
```

---

## Common Issues & Troubleshooting

### Issue: "Invalid credentials" on login
- **Cause:** Username/password mismatch or user not found
- **Debug:** Check username exists in DB, verify password hash

### Issue: 401 on protected endpoints
- **Cause:** Missing, expired, or invalid access token
- **Debug:** Check `Authorization` header, verify token expiration, check JWT signature

### Issue: Refresh token not working
- **Cause:** Token expired, deleted, or not found in DB
- **Debug:** Query `refresh_tokens` table, check `expires_at`

### Issue: CORS errors on auth endpoints
- **Cause:** Frontend origin not in `CORS_ORIGINS` list
- **Debug:** Check `config.CORS.AllowedOrigins`, ensure `withCredentials: true` in frontend

### Issue: Infinite refresh loop
- **Cause:** Refresh endpoint also returning 401
- **Debug:** Check refresh token validity, ensure `/auth/refresh` is excluded from auth middleware

---

## Google OAuth 2.0 Authentication

### 1. Initiate Google OAuth Flow

**Endpoint:** `GET /api/v1/auth/google/login?remember_me={true|false}&redirect={url}`

**Query Parameters:**
- `remember_me` (optional): `true` for persistent login (30 days), `false` for session (default: false)
- `redirect` (optional): Frontend URL to redirect to after successful authentication

**Process:**
1. **Validate Configuration:**
   - Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
   - Return 400 error with clear message if missing (prevents "Missing required parameter: client_id" errors)
2. **Generate State Token:**
   - Random 32-character hex string for CSRF protection
3. **Store State:**
   - Insert into `oauth_state` table with `remember_me` preference
   - 10-minute expiration
4. **Build Google OAuth URL:**
   - Client ID and secret from config (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
   - Scopes: `openid`, `profile`, `email`
   - Redirect URL from config (`GOOGLE_REDIRECT_URL`, default: `/api/v1/auth/google/callback`)
   - State parameter for CSRF protection
5. **Response:**
   - Return authorization URL and state token

**Response:**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
  "state": "random-csrf-token"
}
```

**Frontend Action:**
- Redirect user to `authUrl` (Google login page)

**Implementation:** `internal/http/handlers/auth.go:GoogleLogin()`

---

### 2. Google OAuth Callback

**Endpoint:** `GET /api/v1/auth/google/callback?code={auth_code}&state={state_token}`

**Query Parameters:**
- `code`: Authorization code from Google
- `state`: CSRF token to validate request

**Process:**
1. **Validate Configuration:**
   - Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
   - Return 400 error with clear message if missing
2. **Validate State Token:**
   - Query `oauth_state` WHERE `state_token = $1 AND expires_at > now()`
   - Return 400 if invalid or expired (CSRF protection)
3. **Retrieve Remember Me Preference:**
   - Get `remember_me` from state record
4. **Exchange Code for Tokens:**
   - Call Google OAuth token endpoint with authorization code
   - Receive Google access token, refresh token (if offline access), expiry
5. **Fetch User Info:**
   - Call `https://www.googleapis.com/oauth2/v3/userinfo` with access token
   - Receive: sub (Google ID), email, name, given_name, family_name, picture
6. **Find or Create User:**
   - Query `users` WHERE `google_id = $1`
   - **If user exists:** Update profile picture if changed
   - **If user doesn't exist:**
     - Generate username from email (e.g., `john.doe_a1b2`)
     - Create user with `auth_provider='google'`, `password_h=NULL`
     - Store Google ID and profile picture
7. **Generate DevHive Tokens:**
   - Create access token (15-minute expiry)
   - Create refresh token with appropriate expiry:
     - If `remember_me=true`: 30 days, `is_persistent=true`
     - If `remember_me=false`: 7 days (DB), session cookie (MaxAge=0)
8. **Store Refresh Token:**
   - Insert into `refresh_tokens` with Google tokens:
     - `google_refresh_token` (for re-auth with Google)
     - `google_access_token` (cached for Google API calls)
     - `google_token_expiry`
9. **Set Cookie:**
   - HttpOnly cookie with appropriate MaxAge
10. **Cleanup:**
    - Delete state token from `oauth_state`
11. **Redirect to Frontend:**
    - Determine frontend redirect URL:
      - Use `redirect_url` from `oauth_state` table if provided
      - Default to `https://devhive.it.com/dashboard` if not provided
    - Encode token data as base64 JSON (includes token, userId, isNewUser, user info)
    - Redirect to: `{frontend_url}#token={base64-encoded-json}`
    - Token data in URL fragment (secure - fragments aren't sent to server)

**Redirect Behavior:**
The backend redirects to the frontend with token data in the URL fragment (after `#`). The redirect URL format is:
```
https://devhive.it.com/dashboard#token={base64-encoded-json}
```

The token data contains:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "uuid-here",
  "isNewUser": true,
  "user": {
    "id": "uuid",
    "email": "user@gmail.com",
    "firstName": "John",
    "lastName": "Doe",
    "profilePicture": "https://lh3.googleusercontent.com/..."
  }
}
```

**Frontend Handling:**
The frontend must extract the token from the URL fragment on the dashboard/redirect page:
1. Read `window.location.hash` to get the token data
2. Decode base64 and parse JSON
3. Store access token in memory/state
4. Clear the hash from URL for clean UX
5. Handle new user onboarding if `isNewUser: true`

**Implementation:** `internal/http/handlers/auth.go:GoogleCallback()`

---

### Google OAuth Configuration

**Required Environment Variables:**
- `GOOGLE_CLIENT_ID` - Google OAuth 2.0 client ID from Google Cloud Console (required)
- `GOOGLE_CLIENT_SECRET` - Google OAuth 2.0 client secret from Google Cloud Console (required)
- `GOOGLE_REDIRECT_URL` - OAuth callback URL (default: `http://localhost:8080/api/v1/auth/google/callback`)

**Configuration Validation:**
- Both handlers (`GoogleLogin` and `GoogleCallback`) validate that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set before processing
- Returns 400 Bad Request with clear error message if configuration is missing
- Prevents "Missing required parameter: client_id" errors from Google's OAuth endpoint

**Setup Steps:**
1. Create OAuth 2.0 credentials in [Google Cloud Console](https://console.cloud.google.com)
2. Set application type to "Web application"
3. Configure authorized redirect URIs (must match `GOOGLE_REDIRECT_URL`):
   - **Development**: `http://localhost:8080/api/v1/auth/google/callback`
   - **Production**: `https://devhive-go-backend.fly.dev/api/v1/auth/google/callback`
4. Copy Client ID and Client Secret to `.env` file (local) or Fly.io secrets (production)
5. Set `GOOGLE_REDIRECT_URL` environment variable:
   - Local: Add to `.env` file
   - Production: Set as Fly.io secret: `fly secrets set GOOGLE_REDIRECT_URL="https://devhive-go-backend.fly.dev/api/v1/auth/google/callback"`
6. Restart server to load configuration

### Google OAuth Security

**CSRF Protection:**
- State parameter is random, unique, and single-use
- Stored in database with 10-minute TTL
- Validated on callback before processing
- Deleted after successful authentication

**Token Storage:**
- Google refresh tokens stored in database (consider encryption for production)
- Google access tokens cached with expiry
- DevHive refresh tokens in HttpOnly cookies (XSS protection)
- DevHive access tokens in memory (frontend)

**User Linking:**
- Currently, each auth method creates a separate user
- Future enhancement: Link Google account to existing email-matched user

---

## Remember Me Functionality

### Session Persistence Behavior

| Remember Me | Cookie MaxAge | Refresh Token Expiry | DB `is_persistent` | Behavior |
|-------------|---------------|----------------------|--------------------|----------|
| ✓ Checked   | 30 days       | 30 days             | `true`             | Login persists across browser restarts |
| ✗ Unchecked | 0 (session)   | 7 days (backup)     | `false`            | Logout on browser close |

### Implementation Details

**Cookie Configuration:**
```go
http.SetCookie(w, &http.Cookie{
  Name:     "refresh_token",
  Value:    refreshToken,
  Path:     "/",
  MaxAge:   cookieMaxAge, // 0 for session, 2592000 for persistent (30 days)
  HttpOnly: true,
  Secure:   true,
  SameSite: http.SameSiteNoneMode,
})
```

**Database Storage:**
- Persistent tokens: `is_persistent=true`, `expires_at = now() + 30 days`
- Session tokens: `is_persistent=false`, `expires_at = now() + 7 days` (backup)

**Token Refresh:**
- On refresh, preserve `is_persistent` flag from old token
- Rotate both access and refresh tokens for security
- Extend expiration based on `is_persistent` setting

**Security Notes:**
- Session cookies (MaxAge=0) are cleared when browser closes
- Database tokens have backup expiry even for session cookies
- Persistent logins use secure, HttpOnly cookies to prevent XSS attacks

---

## Future Enhancements

### Planned Improvements
- **Session management:** Track active sessions per user, view/revoke specific sessions
- **Multi-factor authentication (MFA):** TOTP or SMS-based 2FA
- **Additional OAuth providers:** GitHub, Microsoft, Apple Sign In
- **Account linking:** Link Google account to existing password-based account with email verification
- **Admin RBAC:** Proper admin role instead of shared password
- **Audit logging:** Track all auth events (login, logout, password changes, OAuth logins)
- **Password policy enforcement:** Min length, complexity requirements
- **Account lockout:** Temporary lock after N failed login attempts
- **Email verification:** Require email confirmation on registration
- **Google token encryption:** Encrypt Google refresh tokens in database for enhanced security
- **Automatic token refresh:** Proactively refresh Google tokens before expiration
