# Google OAuth 2.0 Authentication - Implementation Plan

## Related Documentation
- [Authentication Flow](../System/authentication_flow.md) - Current JWT authentication system
- [Database Schema](../System/database_schema.md) - Current database structure
- [Project Architecture](../System/project_architecture.md) - System architecture overview
- [SOP: Adding Migrations](../SOP/adding_migrations.md) - Database migration process
- [SOP: Adding API Endpoints](../SOP/adding_api_endpoints.md) - API endpoint implementation

---

## Overview

### Goal
Implement Google OAuth 2.0 authentication alongside the existing username/password authentication system, with persistent login functionality controlled by a frontend "Remember Me" checkbox.

### Key Requirements
1. **Add Google OAuth 2.0 login** - Allow users to sign in with their Google account
2. **Remove 24-hour timeout limitation** - Make sessions persistent based on user preference
3. **Frontend "Remember Me" checkbox** - Control session persistence at login time
4. **Maintain existing auth** - Keep username/password login functional
5. **Unified user system** - OAuth and password users share the same user table
6. **Security best practices** - CSRF protection, secure token storage, proper scopes

### Authentication Strategy
- **Remember Me = Checked**: Long-lived refresh token (30 days or until browser cache cleared)
- **Remember Me = Unchecked**: Session-based refresh token (expires when browser closes)
- Access tokens remain short-lived (15 minutes) for security

---

## Architecture Changes

### Current System
```
┌─────────────────────────────────────────────────────────┐
│                    Current Auth Flow                     │
├─────────────────────────────────────────────────────────┤
│  Username/Password Login                                 │
│    ↓                                                     │
│  Validate Credentials                                    │
│    ↓                                                     │
│  Generate Access Token (15min) + Refresh Token (7 days) │
│    ↓                                                     │
│  Store refresh token in DB + HttpOnly Cookie            │
│    ↓                                                     │
│  Return access token to frontend                         │
└─────────────────────────────────────────────────────────┘
```

### New System with Google OAuth
```
┌──────────────────────────────────────────────────────────────┐
│                   Enhanced Auth Flow                         │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌──────────────────────────┐   │
│  │ Username/Password   │    │   Google OAuth 2.0       │   │
│  │      Login          │    │       Login              │   │
│  └──────────┬──────────┘    └──────────┬───────────────┘   │
│             │                           │                    │
│             │  Validate Credentials     │  Exchange Code    │
│             │                           │  for Google Token │
│             │                           │  Fetch User Info  │
│             │                           │                    │
│             └───────────┬───────────────┘                    │
│                         ↓                                    │
│          Get or Create User Record                           │
│                         ↓                                    │
│          Generate Access Token (15min)                       │
│                         ↓                                    │
│          Generate Refresh Token with:                        │
│            - Long expiry if "Remember Me" checked (30 days)  │
│            - Session expiry if unchecked (browser session)   │
│                         ↓                                    │
│          Store refresh token + Google tokens (if OAuth)      │
│                         ↓                                    │
│          Set HttpOnly Cookie with appropriate MaxAge         │
│                         ↓                                    │
│          Return access token + user info to frontend         │
└──────────────────────────────────────────────────────────────┘
```

---

## Database Schema Changes

### 1. Modify `users` Table
Add OAuth-related fields to support both authentication methods:

```sql
-- Migration: 011_add_oauth_support.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'local'
    CHECK (auth_provider IN ('local', 'google')),
  ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
  -- Make password_h nullable for OAuth-only users
  ALTER COLUMN password_h DROP NOT NULL;

-- Indexes for efficient OAuth lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)
  WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);

-- Add unique constraint: either password OR google_id must exist
-- Users must have at least one authentication method
ALTER TABLE users
  ADD CONSTRAINT users_auth_method_check
  CHECK (
    (auth_provider = 'local' AND password_h IS NOT NULL) OR
    (auth_provider = 'google' AND google_id IS NOT NULL)
  );
```

**Field Descriptions:**
- `auth_provider`: Authentication method ('local' for username/password, 'google' for OAuth)
- `google_id`: Google's unique user identifier (sub claim from Google)
- `profile_picture_url`: User's Google profile picture URL
- `password_h`: Made nullable - OAuth users won't have a password

### 2. Modify `refresh_tokens` Table
Add fields to support "Remember Me" functionality and Google token storage:

```sql
-- Migration: 011_add_oauth_support.sql (continued)

ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS is_persistent BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_access_token TEXT,
  ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMPTZ;

-- Index for cleaning up expired Google tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_google_expiry
  ON refresh_tokens(google_token_expiry)
  WHERE google_token_expiry IS NOT NULL;

COMMENT ON COLUMN refresh_tokens.is_persistent IS
  'True for persistent login (Remember Me), false for session-only';
COMMENT ON COLUMN refresh_tokens.google_refresh_token IS
  'Google OAuth refresh token for re-authentication';
COMMENT ON COLUMN refresh_tokens.google_access_token IS
  'Google OAuth access token (cached for API calls)';
COMMENT ON COLUMN refresh_tokens.google_token_expiry IS
  'Expiration time for Google access token';
```

**Field Descriptions:**
- `is_persistent`: Controls session duration (true = 30 days, false = browser session)
- `google_refresh_token`: Google's refresh token for long-term access (encrypted recommended)
- `google_access_token`: Cached Google access token (for Google API calls if needed)
- `google_token_expiry`: When the Google access token expires

### 3. Create `oauth_state` Table
Temporary storage for CSRF protection during OAuth flow:

```sql
-- Migration: 011_add_oauth_support.sql (continued)

CREATE TABLE IF NOT EXISTS oauth_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_token TEXT NOT NULL UNIQUE,
  remember_me BOOLEAN NOT NULL DEFAULT false,
  redirect_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes')
);

CREATE INDEX idx_oauth_state_token ON oauth_state(state_token);
CREATE INDEX idx_oauth_state_expires ON oauth_state(expires_at);

-- Cleanup function for expired state tokens
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_state()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_state WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;
```

**Purpose:**
- Store state parameter for CSRF protection during OAuth flow
- Store "Remember Me" preference during auth redirect
- Auto-cleanup after 10 minutes (OAuth flows should complete quickly)

---

## Configuration Changes

### Environment Variables
Add to `.env` and `internal/config/config.go`:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# Development (local)
GOOGLE_REDIRECT_URL="http://localhost:8080/api/v1/auth/google/callback"

# Production (Fly.io)
# Set via: fly secrets set GOOGLE_REDIRECT_URL="https://devhive-go-backend.fly.dev/api/v1/auth/google/callback"

# Updated Refresh Token Settings
JWT_REFRESH_EXPIRATION_PERSISTENT_DAYS=30  # For "Remember Me" = true
JWT_REFRESH_EXPIRATION_SESSION_HOURS=0     # 0 = browser session only
```

### Config Struct Updates

```go
// internal/config/config.go

type Config struct {
    // ... existing fields ...
    GoogleOAuth GoogleOAuthConfig
    JWT         JWTConfig
}

type GoogleOAuthConfig struct {
    ClientID     string
    ClientSecret string
    RedirectURL  string
    Scopes       []string // Default: ["openid", "profile", "email"]
}

type JWTConfig struct {
    // ... existing fields ...
    RefreshTokenPersistentExpiration time.Duration // 30 days for Remember Me
    RefreshTokenSessionExpiration    time.Duration // 0 = session only
}
```

---

## API Endpoints

### New OAuth Endpoints

#### 1. **Initiate Google OAuth Flow**
```
GET /api/v1/auth/google/login?remember_me={true|false}&redirect={url}
```

**Purpose:** Start OAuth authorization flow

**Query Parameters:**
- `remember_me` (optional): `true` for persistent login, `false` for session (default: false)
- `redirect` (optional): Frontend URL to redirect after successful auth

**Response:**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
  "state": "random-csrf-token"
}
```

**Process:**
1. Generate random state token
2. Store state in `oauth_state` table with `remember_me` preference
3. Build Google OAuth URL with scopes: openid, profile, email
4. Return authorization URL to frontend
5. Frontend redirects user to Google login

**Implementation:** `internal/http/handlers/auth.go:GoogleLogin()`

---

#### 2. **Google OAuth Callback**
```
GET /api/v1/auth/google/callback?code={auth_code}&state={state_token}
```

**Purpose:** Handle OAuth redirect from Google

**Query Parameters:**
- `code`: Authorization code from Google
- `state`: CSRF token to validate request

**Response:**
HTTP 302 Redirect to frontend with token data in URL fragment.

The backend redirects to the frontend URL (default: `https://devhive.it.com/dashboard`) with token data encoded in the URL fragment:
```
https://devhive.it.com/dashboard#token={base64-encoded-json}
```

The encoded JSON contains:
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
The frontend must extract the token from `window.location.hash` on the redirect page and process it accordingly.

**Process:**
1. Validate state token (CSRF protection)
2. Retrieve `remember_me` preference from `oauth_state` table
3. Exchange authorization code for Google tokens (access + refresh)
4. Fetch user info from Google (`https://www.googleapis.com/oauth2/v3/userinfo`)
5. Check if user exists by `google_id`:
   - **Existing user**: Update profile picture if changed
   - **New user**: Create user record with `auth_provider='google'`
6. Generate DevHive access token (15 min expiry)
7. Generate DevHive refresh token:
   - If `remember_me=true`: 30-day expiry, `is_persistent=true`
   - If `remember_me=false`: No expiry (session), `is_persistent=false`
8. Store refresh token in DB with Google tokens
9. Set HttpOnly cookie with appropriate `MaxAge`:
   - Persistent: `MaxAge = 30 days in seconds`
   - Session: `MaxAge = 0` (session cookie)
10. Delete state token from `oauth_state`
11. **Redirect to Frontend:**
    - Determine redirect URL: use `redirect_url` from `oauth_state` if provided, otherwise default to `https://devhive.it.com/dashboard`
    - Encode token data (token, userId, isNewUser, user) as base64 JSON
    - Redirect to: `{frontend_url}#token={base64-encoded-json}`
    - Token data is in URL fragment (secure - fragments aren't sent to server)

**Redirect Response:**
The backend redirects to the frontend with token data in the URL fragment:
```
https://devhive.it.com/dashboard#token={base64-encoded-json}
```

The frontend must extract and handle the token from the URL fragment on page load.

**Implementation:** `internal/http/handlers/auth.go:GoogleCallback()`

---

### Modified Existing Endpoints

#### 3. **Enhanced Login Endpoint**
```
POST /api/v1/auth/login
```

**Updated Request:**
```json
{
  "username": "johndoe",
  "password": "SecurePassword123",
  "rememberMe": true  // NEW FIELD
}
```

**Response:** (unchanged)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "uuid-here"
}
```

**Changes:**
1. Accept `rememberMe` boolean field (default: false)
2. Generate refresh token with appropriate expiry:
   - If `rememberMe=true`: 30 days, `is_persistent=true`
   - If `rememberMe=false`: Session only, `is_persistent=false`
3. Set cookie MaxAge accordingly:
   - Persistent: `MaxAge = 2592000` (30 days)
   - Session: `MaxAge = 0`

**Implementation:** Update `internal/http/handlers/auth.go:Login()`

---

#### 4. **Logout Endpoint Enhancement**
```
POST /api/v1/auth/logout
```

**Changes:**
- Also delete Google refresh tokens if present
- Revoke Google access token if needed (call Google's revoke endpoint)

**Implementation:** Update `internal/http/handlers/auth.go:Logout()`

---

## Frontend Integration

### 1. Login Flow Changes

#### Username/Password Login
```typescript
// Before
const login = async (username: string, password: string) => {
  const response = await apiClient.post('/auth/login', { username, password });
  tokenManager.setAccessToken(response.data.token);
};

// After - with Remember Me
const login = async (username: string, password: string, rememberMe: boolean) => {
  const response = await apiClient.post('/auth/login', {
    username,
    password,
    rememberMe  // NEW
  });
  tokenManager.setAccessToken(response.data.token);

  // Optional: Store preference in localStorage
  if (rememberMe) {
    localStorage.setItem('rememberMe', 'true');
  }
};
```

#### Google OAuth Login
```typescript
const loginWithGoogle = async (rememberMe: boolean) => {
  // 1. Get authorization URL (optional: specify frontend redirect URL)
  const response = await apiClient.get('/auth/google/login', {
    params: {
      remember_me: rememberMe,
      redirect: 'https://devhive.it.com/dashboard' // Optional: defaults to devhive.it.com/dashboard
    }
  });

  // 2. Redirect to Google (backend will redirect back to frontend after auth)
  window.location.href = response.data.authUrl;
};

// Handle OAuth callback on dashboard/redirect page
// Backend redirects to frontend with token in URL fragment
const handleGoogleOAuthCallback = () => {
  const hash = window.location.hash;
  
  if (hash.startsWith('#token=')) {
    try {
      // Extract and decode token data
      const tokenDataEncoded = hash.substring(7); // Remove '#token='
      const tokenDataJSON = atob(tokenDataEncoded); // Decode base64
      const tokenData = JSON.parse(tokenDataJSON);
      
      // Store the access token
      tokenManager.setAccessToken(tokenData.token);
      
      // Handle new user onboarding if needed
      if (tokenData.isNewUser) {
        // Show welcome message, profile completion, etc.
        console.log('Welcome new user!', tokenData.user);
      }
      
      // Clear the hash from URL for clean UX
      window.history.replaceState(null, '', window.location.pathname);
    } catch (error) {
      console.error('Failed to parse OAuth token data:', error);
      // Redirect to login on error
      window.location.href = '/login';
    }
  }
};

// Call this on dashboard page mount
useEffect(() => {
  handleGoogleOAuthCallback();
}, []);
```

### 2. Login UI Component

```tsx
// Example login component
function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async () => {
    await login(username, password, rememberMe);
  };

  const handleGoogleLogin = async () => {
    await loginWithGoogle(rememberMe);
  };

  return (
    <div>
      <input
        type="text"
        value={username}
        onChange={e => setUsername(e.target.value)}
        placeholder="Username"
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Password"
      />

      {/* Remember Me Checkbox */}
      <label>
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={e => setRememberMe(e.target.checked)}
        />
        Remember me (stay logged in for 30 days)
      </label>

      <button onClick={handleLogin}>Login with Password</button>
      <button onClick={handleGoogleLogin}>Sign in with Google</button>
    </div>
  );
}
```

### 3. Session Persistence Behavior

| Remember Me | Cookie MaxAge | Refresh Token Expiry | Behavior |
|-------------|---------------|----------------------|----------|
| ✓ Checked   | 30 days       | 30 days             | Persistent login - survives browser restart |
| ✗ Unchecked | 0 (session)   | 7 days (DB) but cookie expires | Session-only - logout on browser close |

**Note:** Even for session cookies, we store refresh token in DB with 7-day expiry as a safety backup, but the cookie will be cleared when browser closes.

---

## Security Considerations

### 1. CSRF Protection
- **State Parameter**: Random token generated per OAuth request
- **Validation**: Backend validates state token on callback
- **Short TTL**: State tokens expire after 10 minutes
- **One-time Use**: State token deleted after successful callback

### 2. Token Storage
- **Access Tokens**: Stored in memory (frontend), never in localStorage
- **Refresh Tokens**: HttpOnly cookies (prevent XSS attacks)
- **Google Refresh Tokens**: Encrypted in database (recommended)
- **Secure Flag**: Always use HTTPS in production

### 3. Cookie Security
```go
http.SetCookie(w, &http.Cookie{
  Name:     "refresh_token",
  Value:    refreshToken,
  Path:     "/",
  MaxAge:   maxAge, // 0 for session, 2592000 for persistent
  HttpOnly: true,
  Secure:   true, // HTTPS only
  SameSite: http.SameSiteNoneMode, // For cross-origin
})
```

### 4. OAuth Scopes
Request minimal scopes from Google:
- `openid` - Required for OpenID Connect
- `profile` - User's name and profile picture
- `email` - User's email address (verified)

### 5. User Data Privacy
- Only store necessary Google data (ID, email, name, picture)
- Don't store sensitive Google access tokens long-term
- Comply with Google's OAuth policies and user data requirements
- Provide account deletion functionality

### 6. Account Linking Prevention
- Users cannot link Google account to existing password account (initially)
- Each auth method creates separate user record
- Future enhancement: Account linking with email verification

---

## Implementation Steps

### Phase 1: Database Setup
1. Create migration `011_add_oauth_support.sql`
2. Add OAuth-related columns to `users` table
3. Add persistence columns to `refresh_tokens` table
4. Create `oauth_state` table
5. Test migration locally
6. Run migration in development environment

**Files to modify:**
- `cmd/devhive-api/migrations/011_add_oauth_support.sql` (new)

---

### Phase 2: Configuration
1. Add Google OAuth config to `internal/config/config.go`
2. Add environment variables to `.env.example`
3. Update config loader to read Google OAuth settings
4. Add persistent/session refresh token durations

**Files to modify:**
- `internal/config/config.go`
- `.env.example`

---

### Phase 3: SQLC Queries
1. Add OAuth user queries to `internal/repo/queries.sql`:
   - `GetUserByGoogleID`
   - `CreateOAuthUser`
   - `UpdateUserProfilePicture`
   - `CreateOAuthState`
   - `GetOAuthState`
   - `DeleteOAuthState`
   - `UpdateRefreshTokenWithGoogle`
2. Run `sqlc generate` to generate Go code
3. Test query compilation

**Files to modify:**
- `internal/repo/queries.sql` (or create new queries file)
- Run: `sqlc generate`

---

### Phase 4: OAuth Handler Implementation
1. Create OAuth helper functions:
   - `generateStateToken()` - Random CSRF token
   - `buildGoogleAuthURL()` - Construct OAuth URL
   - `exchangeCodeForToken()` - Exchange auth code for tokens
   - `fetchGoogleUserInfo()` - Get user profile from Google
2. Implement `GoogleLogin()` handler
3. Implement `GoogleCallback()` handler
4. Handle user creation vs. existing user logic
5. Implement token generation with Remember Me support

**Files to modify:**
- `internal/http/handlers/auth.go`
- Create: `internal/http/handlers/oauth_helpers.go` (optional)

---

### Phase 5: Update Existing Auth
1. Modify `Login()` to accept `rememberMe` parameter
2. Update refresh token generation logic:
   - Set `is_persistent` based on `rememberMe`
   - Set cookie `MaxAge` appropriately
3. Update `Logout()` to handle Google tokens
4. Update `Refresh()` to respect persistent vs. session tokens

**Files to modify:**
- `internal/http/handlers/auth.go`

---

### Phase 6: Router Updates
1. Add Google OAuth routes to `internal/http/router/router.go`:
   - `GET /api/v1/auth/google/login`
   - `GET /api/v1/auth/google/callback`
2. Ensure routes are public (not behind RequireAuth middleware)
3. Add CORS support for OAuth redirect URLs

**Files to modify:**
- `internal/http/router/router.go`

---

### Phase 7: Frontend Integration
1. Update login form to include Remember Me checkbox
2. Implement Google OAuth login button
3. Create OAuth callback route/page
4. Update `apiClient.ts` if needed
5. Test both authentication flows

**Files to create/modify:**
- Frontend login components
- OAuth callback page
- API client utilities

---

### Phase 8: Testing
1. **Unit Tests:**
   - Test OAuth state generation and validation
   - Test user creation for OAuth users
   - Test Remember Me cookie settings

2. **Integration Tests:**
   - Test full Google OAuth flow (may need mock)
   - Test persistent vs. session token behavior
   - Test logout and token cleanup

3. **Manual Testing:**
   - Test Google login with Remember Me checked
   - Test Google login without Remember Me
   - Test password login with Remember Me
   - Verify cookie expiration behavior
   - Test token refresh for both modes
   - Test logout clears tokens properly

**Files to create:**
- `internal/http/handlers/auth_test.go` (enhance)
- Integration test suite

---

### Phase 9: Documentation
1. Update `.agent/System/authentication_flow.md` with OAuth flow
2. Update `.agent/System/database_schema.md` with new tables/columns
3. Create user-facing documentation for Google login
4. Update API documentation with new endpoints

**Files to modify:**
- `.agent/System/authentication_flow.md`
- `.agent/System/database_schema.md`
- Root `README.md` (API reference)

---

## Google Cloud Console Setup

### Prerequisites
1. **Create Google Cloud Project:**
   - Go to https://console.cloud.google.com
   - Create new project or select existing

2. **Enable Google+ API:**
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API"
   - Click "Enable"

3. **Create OAuth 2.0 Credentials:**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: "Web application"
   - Name: "DevHive Backend"

4. **Configure Authorized Redirect URIs:**
   ```
   Development:
   http://localhost:8080/api/v1/auth/google/callback

   Production:
   https://devhive-go-backend.fly.dev/api/v1/auth/google/callback
   ```

5. **Configure Authorized JavaScript Origins:**
   ```
   Development:
   http://localhost:3000
   http://localhost:5173

   Production:
   https://devhive.it.com
   https://d35scdhidypl44.cloudfront.net
   ```

6. **Get Credentials:**
   - Copy Client ID
   - Copy Client Secret
   - Add to `.env` file

---

## Go Package Dependencies

Add to `go.mod`:
```bash
go get golang.org/x/oauth2
go get golang.org/x/oauth2/google
```

**Usage Example:**
```go
import (
    "golang.org/x/oauth2"
    "golang.org/x/oauth2/google"
)

var googleOAuthConfig = &oauth2.Config{
    ClientID:     cfg.GoogleOAuth.ClientID,
    ClientSecret: cfg.GoogleOAuth.ClientSecret,
    RedirectURL:  cfg.GoogleOAuth.RedirectURL,
    Scopes: []string{
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
    },
    Endpoint: google.Endpoint,
}
```

---

## Testing Strategy

### Unit Tests

```go
// Test state token generation and validation
func TestGenerateStateToken(t *testing.T) {
    token1 := generateStateToken()
    token2 := generateStateToken()

    assert.NotEqual(t, token1, token2)
    assert.GreaterOrEqual(t, len(token1), 32)
}

// Test Remember Me cookie settings
func TestRememberMeCookieSettings(t *testing.T) {
    tests := []struct {
        rememberMe bool
        wantMaxAge int
    }{
        {true, 2592000},  // 30 days
        {false, 0},       // session
    }

    for _, tt := range tests {
        maxAge := getRefreshTokenMaxAge(tt.rememberMe)
        assert.Equal(t, tt.wantMaxAge, maxAge)
    }
}
```

### Integration Tests

```go
// Test OAuth user creation
func TestGoogleCallbackCreatesNewUser(t *testing.T) {
    // Mock Google token exchange
    // Mock Google user info fetch
    // Call callback handler
    // Assert user created with correct fields
}

// Test session vs persistent token
func TestRefreshTokenPersistence(t *testing.T) {
    // Login with rememberMe=true
    // Check is_persistent=true in DB
    // Check cookie MaxAge=30 days

    // Login with rememberMe=false
    // Check is_persistent=false in DB
    // Check cookie MaxAge=0
}
```

---

## Rollback Plan

If issues arise during deployment:

1. **Database Rollback:**
   ```sql
   -- Rollback migration 011
   ALTER TABLE users DROP COLUMN IF EXISTS auth_provider;
   ALTER TABLE users DROP COLUMN IF EXISTS google_id;
   ALTER TABLE users DROP COLUMN IF EXISTS profile_picture_url;
   ALTER TABLE users ALTER COLUMN password_h SET NOT NULL;

   ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS is_persistent;
   ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS google_refresh_token;
   ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS google_access_token;
   ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS google_token_expiry;

   DROP TABLE IF EXISTS oauth_state;
   ```

2. **Code Rollback:**
   - Revert to previous commit
   - Redeploy previous version
   - Existing password-based auth continues working

3. **Configuration Rollback:**
   - Remove Google OAuth env vars
   - Restart service

**Note:** No data loss for existing users - OAuth changes are additive.

---

## Future Enhancements

### Account Linking
Allow users to link Google account to existing password account:
1. Add `linked_accounts` table
2. Support multiple auth providers per user
3. Email verification during linking

### Additional OAuth Providers
- GitHub OAuth
- Microsoft OAuth
- Apple Sign In

### Enhanced Session Management
- View active sessions
- Revoke specific sessions
- Device tracking and management

### Token Refresh Optimization
- Automatic Google token refresh using stored refresh token
- Proactive token renewal before expiration

### Security Enhancements
- Encrypt Google refresh tokens in database
- Add rate limiting to OAuth endpoints
- Implement anomaly detection for logins
- Two-factor authentication (2FA)

---

## Monitoring and Logging

### Key Metrics to Track
- OAuth login success/failure rate
- Token refresh rate (persistent vs. session)
- Average session duration
- Google API call failures
- State token validation failures (potential attacks)

### Log Events
```go
// Example logging
log.Info("Google OAuth login initiated",
    "remember_me", rememberMe,
    "state", stateToken)

log.Info("Google OAuth callback successful",
    "user_id", userID,
    "new_user", isNewUser,
    "is_persistent", isPersistent)

log.Warn("Google OAuth state validation failed",
    "state", providedState,
    "ip", clientIP)
```

---

## Estimated Effort

| Phase | Estimated Time | Complexity |
|-------|----------------|------------|
| Phase 1: Database Setup | 2 hours | Low |
| Phase 2: Configuration | 1 hour | Low |
| Phase 3: SQLC Queries | 2 hours | Low |
| Phase 4: OAuth Handlers | 6 hours | High |
| Phase 5: Update Existing Auth | 3 hours | Medium |
| Phase 6: Router Updates | 1 hour | Low |
| Phase 7: Frontend Integration | 4 hours | Medium |
| Phase 8: Testing | 6 hours | High |
| Phase 9: Documentation | 2 hours | Low |
| **Total** | **27 hours** | **Medium-High** |

---

## Success Criteria

- [ ] Users can log in with Google OAuth
- [ ] Users can log in with username/password
- [ ] "Remember Me" checkbox controls session persistence
- [ ] Persistent sessions last 30 days
- [ ] Session-only logins clear on browser close
- [ ] CSRF protection working (state validation)
- [ ] User profile pictures synced from Google
- [ ] Token refresh working for both auth types
- [ ] Logout clears all tokens and sessions
- [ ] No breaking changes to existing auth
- [ ] All tests passing
- [ ] Documentation updated

---

## References

### Official Documentation
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google OAuth 2.0 for Web Server Apps](https://developers.google.com/identity/protocols/oauth2/web-server)
- [golang.org/x/oauth2 Package](https://pkg.go.dev/golang.org/x/oauth2)
- [Google People API](https://developers.google.com/people) - For user info

### Security Best Practices
- [OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

### Related DevHive Docs
- [Authentication Flow](../System/authentication_flow.md)
- [Database Schema](../System/database_schema.md)
- [Adding Migrations SOP](../SOP/adding_migrations.md)

---

**Document Version:** 1.0
**Created:** 2025-12-22
**Author:** DevHive Team
**Status:** Planning - Ready for Implementation
