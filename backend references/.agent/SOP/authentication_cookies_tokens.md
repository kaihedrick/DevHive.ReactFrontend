# Authentication: Cookies vs Tokens - How It Should Work

## Standard Authentication Flow

### 1. **Login Flow**

**Backend (Your App):**
```
POST /api/v1/auth/login
{
  "username": "user",
  "password": "pass",
  "rememberMe": true
}
```

**Backend Response:**
- **HTTP 200 OK**
- **Set-Cookie Header:** `refresh_token=<64-char-hex>; HttpOnly; Secure; SameSite=None; MaxAge=2592000; Path=/`
- **JSON Body:** `{"token": "eyJhbGci...", "userId": "uuid"}`

**Frontend Should:**
1. Extract `token` from JSON response
2. Store token in memory: `tokenManager.setAccessToken(response.data.token)`
3. Cookie is automatically stored by browser (you don't need to do anything)

---

### 2. **Making Authenticated Requests**

**Frontend:**
```typescript
// Axios automatically adds Authorization header via interceptor
apiClient.get('/api/v1/projects')
```

**What Happens:**
1. Request interceptor reads token from memory: `getAccessToken()`
2. Adds header: `Authorization: Bearer <access-token>`
3. Cookie (`refresh_token`) is automatically sent by browser (because `withCredentials: true`)

**Backend:**
- Validates JWT from `Authorization` header
- Returns data if valid
- Returns 401 if token expired/invalid

---

### 3. **Token Refresh Flow (When Access Token Expires)**

**What Happens Automatically:**
1. API request returns **401 Unauthorized**
2. Response interceptor catches 401
3. Frontend calls: `POST /api/v1/auth/refresh` (with cookie automatically)
4. Backend reads `refresh_token` cookie
5. Backend validates cookie, generates new access token
6. Backend returns: `{"token": "new-access-token"}`
7. Frontend stores new token: `setAccessToken(newToken)`
8. Frontend retries original request with new token

---

## What Your App Is Doing Right ✅

1. ✅ **Backend sets HttpOnly cookie** - Prevents XSS attacks
2. ✅ **Cookie has Secure flag** - Only sent over HTTPS
3. ✅ **Cookie has SameSite=None** - Works for cross-origin (frontend on different domain)
4. ✅ **Access token is short-lived (15 min)** - Limits exposure if stolen
5. ✅ **Refresh token rotates** - Old token deleted, new one issued
6. ✅ **Frontend has axios interceptor** - Automatic refresh on 401
7. ✅ **Frontend uses `withCredentials: true`** - Allows cookies to be sent

---

## Common Issues & What Might Be Wrong ❌

### Issue 1: Access Token Not Stored After Login

**Problem:**
```typescript
// ❌ WRONG - Token not stored
const response = await apiClient.post('/auth/login', { username, password });
// Token is in response.data.token but never stored!
```

**Fix:**
```typescript
// ✅ CORRECT - Store token after login
const response = await apiClient.post('/auth/login', { username, password });
tokenManager.setAccessToken(response.data.token);
```

**How to Check:**
- Open DevTools → Console
- Type: `localStorage.getItem('auth_state')` (if you're using localStorage)
- Or check if `getAccessToken()` returns null

---

### Issue 2: Cookie Not Being Sent

**Why Cookies Might Not Be Sent:**

1. **CORS Not Configured Properly**
   - Backend must return: `Access-Control-Allow-Credentials: true`
   - Backend must return: `Access-Control-Allow-Origin: <exact-frontend-domain>` (NOT `*`)
   - Frontend must use: `withCredentials: true` ✅ (you have this)

2. **Cookie Domain Mismatch**
   - Cookie domain: `devhive-go-backend.fly.dev`
   - Frontend domain: `devhive.it.com` or `localhost:3000`
   - **Solution:** Cookie `Path=/` and `SameSite=None` should work, but verify CORS

3. **Cookie Expired**
   - If `rememberMe=false`, cookie is session-only (expires when browser closes)
   - If browser was closed/reopened, cookie is gone
   - **Solution:** Use `rememberMe=true` for persistent cookies

**How to Check:**
- DevTools → Application → Cookies
- Look for `refresh_token` cookie
- Check: Domain, Path, HttpOnly, Secure, SameSite
- Check: Expires/Max-Age (should be future date or "Session")

---

### Issue 3: Refresh Endpoint Not Being Called

**Problem:**
- 401 error occurs, but `/auth/refresh` is never called
- Interceptor not triggering

**Possible Causes:**
1. **Interceptor not registered** - Check if `apiClient.ts` is imported
2. **Auth route exclusion** - Check if route is in `AUTH_ROUTES` array (shouldn't be)
3. **Error not 401** - Check Network tab for actual status code

**How to Check:**
- DevTools → Network tab
- Make a request that returns 401
- Look for `/auth/refresh` request
- If missing, interceptor isn't working

---

### Issue 4: Refresh Token Cookie Missing After Google OAuth

**Problem:**
- Google OAuth login works, but refresh token cookie not set
- Cookie is set during redirect, but browser might not accept it

**Why:**
- Google OAuth redirects: `Frontend → Google → Backend → Frontend`
- Cookie is set on backend redirect, but browser might reject it if:
  - CORS headers missing
  - Domain mismatch
  - SameSite policy violation

**How to Check:**
- After Google OAuth login, check Application → Cookies
- If `refresh_token` cookie is missing, this is the issue

---

## Debugging Checklist

### Step 1: Verify Cookie After Login
```
1. Login via POST /auth/login
2. DevTools → Application → Cookies
3. Find refresh_token cookie
4. Verify: HttpOnly ✓, Secure ✓, SameSite=None ✓
5. Verify: Expires date is in future (or "Session")
```

### Step 2: Verify Access Token Stored
```typescript
// In browser console after login:
import { tokenManager } from './lib/apiClient';
console.log(tokenManager.getAccessToken());
// Should print: "eyJhbGci..."
```

### Step 3: Verify Refresh Endpoint Called
```
1. Wait 15+ minutes (or manually expire token)
2. Make any API request
3. DevTools → Network tab
4. Look for /auth/refresh request
5. Check request headers: Cookie: refresh_token=...
6. Check response: Should be 200 with new token
```

### Step 4: Verify CORS Headers
```
1. DevTools → Network tab
2. Click any API request
3. Check Response Headers:
   - Access-Control-Allow-Origin: <your-frontend-domain>
   - Access-Control-Allow-Credentials: true
```

---

## Most Likely Issue: Cookie Not Being Sent

Based on your symptoms (401 after 15 minutes), the most likely issue is:

**The refresh token cookie is not being sent with the `/auth/refresh` request.**

### Why This Happens:

1. **Cookie was never set** (most likely)
   - After login, cookie wasn't accepted by browser
   - Check Application → Cookies after login

2. **Cookie expired**
   - If `rememberMe=false`, cookie is session-only
   - Browser closed = cookie gone

3. **CORS blocking cookie**
   - Backend not returning `Access-Control-Allow-Credentials: true`
   - Or `Access-Control-Allow-Origin` is `*` instead of specific domain

### Quick Test:

```bash
# Test if cookie is set after login
curl -X POST https://devhive-go-backend.fly.dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test","rememberMe":true}' \
  -c cookies.txt \
  -v

# Check if cookie file was created
cat cookies.txt

# Test refresh with cookie
curl -X POST https://devhive-go-backend.fly.dev/api/v1/auth/refresh \
  -b cookies.txt \
  -v
```

---

## Standard vs Your Implementation

| Aspect | Standard | Your App | Status |
|--------|----------|----------|--------|
| Access token in memory | ✅ | ✅ | Correct |
| Refresh token in HttpOnly cookie | ✅ | ✅ | Correct |
| Cookie SameSite=None for cross-origin | ✅ | ✅ | Correct |
| Cookie Secure flag | ✅ | ✅ | Correct |
| Automatic refresh on 401 | ✅ | ✅ | Correct |
| Token rotation | ✅ | ✅ | Correct |
| CORS with credentials | ✅ | ✅ | Should be correct |

**Your implementation is correct!** The issue is likely:
- Cookie not being set/accepted by browser
- Cookie expired (if rememberMe=false)
- CORS configuration issue

---

## Next Steps

1. **Check cookies after login** - Verify `refresh_token` cookie exists
2. **Check Network tab** - See if `/auth/refresh` is called on 401
3. **Check CORS headers** - Verify `Access-Control-Allow-Credentials: true`
4. **Test with `rememberMe=true`** - Use persistent cookies to rule out session expiry

