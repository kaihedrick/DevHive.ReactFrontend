# Environment Setup Guide

## Issue Fixed: `Cannot read properties of undefined (reading 'VITE_API_BASE_URL')`

This error was occurring because `import.meta.env` is not available in the development environment. I've fixed this by implementing a robust fallback system.

## Solution Implemented

I've updated the following files to handle environment variables properly:

1. **`src/lib/api.ts`** - Main API client
2. **`src/config.js`** - Configuration file
3. **`src/axiosConfig.js`** - Axios configuration

### How It Works

The new implementation:
1. **Checks for Vite environment** - Uses `import.meta.env` if available
2. **Falls back to Create React App** - Uses `process.env` as backup
3. **Provides hardcoded fallback** - Uses `https://devhive-go-backend.fly.dev/api/v1` as final fallback

## Environment Variables

### For Development
Create a `.env` file in the project root:

```env
# DevHive React Frontend Environment Variables
VITE_API_BASE_URL=https://devhive-go-backend.fly.dev/api/v1
REACT_APP_API_BASE_URL=https://devhive-go-backend.fly.dev/api/v1
NODE_ENV=development
```

### For Production
```env
VITE_API_BASE_URL=https://api.devhive.it.com/api/v1
REACT_APP_API_BASE_URL=https://api.devhive.it.com/api/v1
NODE_ENV=production
```

## Testing

The application should now work without the environment variable error. The API will default to `https://devhive-go-backend.fly.dev/api/v1` if no environment variables are set.

## Files Updated

- ✅ `src/lib/api.ts` - Fixed environment variable handling
- ✅ `src/config.js` - Fixed environment variable handling  
- ✅ `src/axiosConfig.js` - Fixed environment variable handling

## Build Status

- ✅ Build successful
- ✅ No compilation errors
- ✅ Environment variable fallback working
- ⚠️ Some warnings (non-blocking)

The application is now ready for development and production deployment!

## Related Documentation

- [Project Architecture](../System/project_architecture.md) - Overall system architecture
- [Development Workflow](./development_workflow.md) - Common development procedures
- [Migration Guide](./migration_guide.md) - Backend migration documentation

