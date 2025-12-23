# Google OAuth Troubleshooting Guide

## Common Errors

### Error: "Missing required parameter: client_id"

**Symptom:** When clicking "Sign in with Google", you see an error from Google: "Missing required parameter: client_id"

**Cause:** The backend is not properly configured with Google OAuth credentials. The backend needs to have the `GOOGLE_CLIENT_ID` environment variable set.

**Solution:** Configure the backend with the following environment variables:

```bash
# Required Google OAuth Configuration
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URL="https://devhive-go-backend.fly.dev/api/v1/auth/google/callback"
```

**Backend Setup Steps:**

1. **Get Google OAuth Credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Navigate to "APIs & Services" > "Credentials"
   - Create OAuth 2.0 Client ID (Web application)
   - Copy the Client ID and Client Secret

2. **Configure Backend Environment Variables:**
   ```bash
   # For Fly.io deployment
   fly secrets set GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   fly secrets set GOOGLE_CLIENT_SECRET="your-client-secret"
   fly secrets set GOOGLE_REDIRECT_URL="https://devhive-go-backend.fly.dev/api/v1/auth/google/callback"
   ```

3. **Configure Google Cloud Console:**
   - Add the redirect URI to "Authorized redirect URIs":
     ```
     https://devhive-go-backend.fly.dev/api/v1/auth/google/callback
     ```
   - Add JavaScript origins:
     ```
     https://devhive.it.com
     https://d35scdhidypl44.cloudfront.net
     ```

4. **Restart Backend Service:**
   After setting the secrets, restart your backend service to load the new environment variables.

### Error: "redirect_uri_mismatch"

**Symptom:** Google shows "redirect_uri_mismatch" error

**Cause:** The redirect URI in Google Cloud Console doesn't match what the backend is sending.

**Solution:** 
- Ensure the redirect URI in Google Cloud Console exactly matches: `https://devhive-go-backend.fly.dev/api/v1/auth/google/callback`
- Check for trailing slashes, http vs https, and exact path matching

### Frontend Implementation Status

✅ **Frontend is correctly implemented:**
- Calls `/api/v1/auth/google/login` endpoint with `remember_me` parameter
- Handles OAuth callback at `/auth/callback` route
- Properly stores tokens and updates auth state

**Frontend requires no configuration** - it automatically uses the backend API base URL from environment variables.

### Testing the OAuth Flow

1. **Verify Backend Endpoint:**
   ```bash
   curl "https://devhive-go-backend.fly.dev/api/v1/auth/google/login?remember_me=false"
   ```
   Should return: `{"authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...", "state": "..."}`

2. **Check Backend Logs:**
   Look for errors about missing `GOOGLE_CLIENT_ID` or configuration issues.

3. **Test Frontend:**
   - Click "Sign in with Google" button
   - Should redirect to Google login page
   - After authorization, should redirect back to `/auth/callback`
   - Should then redirect to `/projects`

## Backend Configuration Checklist

- [ ] `GOOGLE_CLIENT_ID` is set in backend environment
- [ ] `GOOGLE_CLIENT_SECRET` is set in backend environment  
- [ ] `GOOGLE_REDIRECT_URL` is set to `https://devhive-go-backend.fly.dev/api/v1/auth/google/callback`
- [ ] Redirect URI is added to Google Cloud Console
- [ ] JavaScript origins are added to Google Cloud Console
- [ ] Backend service has been restarted after setting secrets
- [ ] Backend `/auth/google/login` endpoint is implemented
- [ ] Backend `/auth/google/callback` endpoint is implemented

## Related Documentation

- [Google OAuth Implementation Plan](.agent/Tasks/google_oauth.md) - Complete implementation details
- [Google Cloud Console Setup](.agent/Tasks/google_oauth.md#google-cloud-console-setup) - Step-by-step Google setup

