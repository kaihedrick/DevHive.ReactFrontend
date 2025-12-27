# Invite Management Logic - Frontend Implementation

## Overview

This document explains how the frontend creates, manages, and invalidates project invites. Invites can be invalidated in two ways:
1. **Time-based expiration** - After a specified time period (`expiresAt`)
2. **Usage-based expiration** - After reaching maximum uses (`maxUses`)

---

## 1. Invite Creation

### Frontend Flow

**Location**: `src/components/ProjectDetails.tsx` → `handleCreateInvite()`

```typescript
// State for invite creation form
const [expiresInMinutes, setExpiresInMinutes] = useState<number>(30); // Default: 30 minutes
const [maxUses, setMaxUses] = useState<number | undefined>(undefined); // Optional: unlimited by default

// Create invite handler
const handleCreateInvite = async (): Promise<void> => {
  if (!finalProjectId) return;
  
  try {
    const invite = await createInviteMutation.mutateAsync({
      projectId: finalProjectId,
      data: {
        expiresInMinutes,  // Time until expiration (default: 30 minutes)
        maxUses: maxUses || undefined  // Optional: max number of uses (undefined = unlimited)
      }
    });
    showSuccess("Invite link created successfully!");
    // Reset form
    setExpiresInMinutes(30);
    setMaxUses(undefined);
  } catch (err: any) {
    // Handle errors...
  }
};
```

### API Call

**Endpoint**: `POST /projects/{projectId}/invites`

**Request Body**:
```json
{
  "expiresInMinutes": 30,  // Optional, defaults to 30 if not provided
  "maxUses": 5             // Optional, undefined/null = unlimited uses
}
```

**Response**:
```json
{
  "id": "invite-uuid",
  "projectId": "project-uuid",
  "token": "invite-token-string",
  "expiresAt": "2025-01-20T16:00:00Z",  // ISO 8601 timestamp
  "maxUses": 5,                          // null if unlimited
  "usedCount": 0,                        // Starts at 0
  "isActive": true,                      // Can be manually deactivated
  "createdAt": "2025-01-20T15:30:00Z",
  "inviteUrl": "https://app.example.com/invite/invite-token-string"
}
```

### Mutation Hook

**Location**: `src/hooks/useInvites.ts` → `useCreateInvite()`

```typescript
export const useCreateInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      data
    }: {
      projectId: string;
      data: CreateInviteRequest;
    }) => {
      const response = await apiClient.post(`/projects/${projectId}/invites`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate invites list to refetch and show new invite
      queryClient.invalidateQueries({
        queryKey: ['projects', variables.projectId, 'invites']
      });
    },
  });
};
```

---

## 2. Invite Invalidation Logic

### Time-Based Expiration

Invites expire when `expiresAt` timestamp is in the past.

**Frontend Check**:
```typescript
// Location: src/components/ProjectDetails.tsx
const isExpired = new Date(invite.expiresAt) < new Date();

// Filter active invites (not expired)
invitesData.invites.filter((invite: any) => 
  invite.isActive && new Date(invite.expiresAt) > new Date()
)
```

**Display Logic**:
```typescript
// Location: src/components/ProjectDetails.tsx → formatExpiration()
const formatExpiration = (expiresAt: string): string => {
  const date = new Date(expiresAt);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 0) return "Expired";
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''}`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
};
```

**Example Output**:
- `"30 mins"` - Expires in 30 minutes
- `"2 hours"` - Expires in 2 hours
- `"3 days"` - Expires in 3 days
- `"Expired"` - Already expired

### Usage-Based Expiration

Invites expire when `usedCount >= maxUses` (if `maxUses` is set).

**Frontend Display**:
```typescript
// Location: src/components/ProjectDetails.tsx (line 654)
{invite.maxUses && ` • ${invite.usedCount || invite.useCount || 0}/${invite.maxUses} uses`}
```

**Example Display**:
- `"3/5 uses"` - 3 out of 5 uses consumed
- `"5/5 uses"` - All uses consumed (should be considered expired)
- No display if `maxUses` is `undefined` (unlimited)

**Backend Logic** (handled by backend):
- When a user accepts an invite, backend increments `usedCount`
- If `usedCount >= maxUses`, invite is considered invalid
- Frontend receives updated `usedCount` when fetching invites list

---

## 3. Active Invite Filtering

### Filter Criteria

An invite is considered **active** if ALL of the following are true:

1. ✅ `isActive === true` (not manually revoked)
2. ✅ `new Date(expiresAt) > new Date()` (not expired by time)
3. ✅ `maxUses === undefined || usedCount < maxUses` (not expired by usage)

### Frontend Implementation

**Location**: `src/components/ProjectDetails.tsx` (line 633)

```typescript
// Filter to show only active invites
{invitesData.invites.filter((invite: any) => 
  invite.isActive && 
  new Date(invite.expiresAt) > new Date()
).map((invite: any) => (
  // Render invite card...
))}
```

**Note**: The frontend currently only checks `isActive` and expiration time. The usage check (`usedCount < maxUses`) should ideally be included, but the backend may handle this by setting `isActive = false` when max uses are reached.

### Empty State Handling

```typescript
// No invites at all
{!invitesLoading && invitesData && invitesData.invites && invitesData.invites.length === 0 && (
  <div>No active invites. Create one above to get started.</div>
)}

// All invites expired/inactive
{!invitesLoading && invitesData && invitesData.invites && invitesData.invites.length > 0 && 
 invitesData.invites.filter((invite: any) => invite.isActive && new Date(invite.expiresAt) > new Date()).length === 0 && (
  <div>No active invites (all invites are expired or inactive).</div>
)}
```

---

## 4. Invite Acceptance & Invalidation

### Accept Invite Flow

**Location**: `src/components/InviteAcceptPage.tsx`

```typescript
// Check if invite is valid
const isExpired = invite ? new Date(invite.expiresAt) < new Date() : false;
const isValid = invite?.isActive && !isExpired;

// When user accepts invite
const acceptInviteMutation = useAcceptInvite();
await acceptInviteMutation.mutateAsync(inviteToken);
```

**Backend Behavior**:
1. Validates invite is active and not expired
2. Validates `usedCount < maxUses` (if `maxUses` is set)
3. Increments `usedCount`
4. If `usedCount >= maxUses`, may set `isActive = false` (backend decision)
5. Adds user to project members

**Frontend Cache Update**:
```typescript
// Location: src/hooks/useInvites.ts → useAcceptInvite()
onSuccess: (project) => {
  // Update projects list cache
  queryClient.setQueriesData({ queryKey: ['projects', 'list'] }, ...);
  
  // Invalidate invite details (invite is now used)
  queryClient.invalidateQueries({ queryKey: ['invites'] });
  
  // Update project detail cache
  queryClient.setQueryData(projectKeys.detail(project.id), project);
}
```

---

## 5. Invite Revocation

### Manual Revocation

**Location**: `src/components/ProjectDetails.tsx` → `handleRevokeInvite()`

```typescript
const handleRevokeInvite = async (inviteId: string): Promise<void> => {
  if (!finalProjectId) return;
  
  try {
    await revokeInviteMutation.mutateAsync({
      projectId: finalProjectId,
      inviteId
    });
    showSuccess("Invite revoked successfully");
  } catch (err: any) {
    // Handle errors...
  }
};
```

**API Call**: `DELETE /projects/{projectId}/invites/{inviteId}`

**Backend Behavior**:
- Sets `isActive = false`
- Invite is immediately invalidated (won't appear in active invites list)

**Cache Invalidation**:
```typescript
// Location: src/hooks/useInvites.ts → useRevokeInvite()
onSuccess: (_, variables) => {
  queryClient.invalidateQueries({
    queryKey: ['projects', variables.projectId, 'invites']
  });
}
```

---

## 6. Invite Data Structure

### TypeScript Interface

```typescript
// Location: src/hooks/useInvites.ts
export interface Invite {
  id: string;                    // Unique invite ID
  projectId: string;             // Project the invite is for
  token: string;                 // Unique token for invite URL
  expiresAt: string;             // ISO 8601 timestamp (e.g., "2025-01-20T16:00:00Z")
  maxUses?: number;              // Optional: max number of uses (undefined = unlimited)
  usedCount: number;             // Current number of uses (starts at 0)
  isActive: boolean;             // Whether invite is active (can be manually revoked)
  createdAt: string;             // ISO 8601 timestamp
  inviteUrl?: string;            // Optional: Full invite URL
}
```

### Example Invite Objects

**Unlimited Use Invite (30 min expiration)**:
```json
{
  "id": "abc-123",
  "projectId": "proj-456",
  "token": "xyz789",
  "expiresAt": "2025-01-20T16:00:00Z",
  "maxUses": null,
  "usedCount": 0,
  "isActive": true,
  "createdAt": "2025-01-20T15:30:00Z"
}
```

**Limited Use Invite (5 uses, 1 hour expiration)**:
```json
{
  "id": "def-456",
  "projectId": "proj-456",
  "token": "abc123",
  "expiresAt": "2025-01-20T16:30:00Z",
  "maxUses": 5,
  "usedCount": 2,
  "isActive": true,
  "createdAt": "2025-01-20T15:30:00Z"
}
```

**Expired Invite (by time)**:
```json
{
  "id": "ghi-789",
  "projectId": "proj-456",
  "token": "expired-token",
  "expiresAt": "2025-01-20T14:00:00Z",  // Past timestamp
  "maxUses": null,
  "usedCount": 0,
  "isActive": true,
  "createdAt": "2025-01-20T13:30:00Z"
}
```

**Exhausted Invite (by usage)**:
```json
{
  "id": "jkl-012",
  "projectId": "proj-456",
  "token": "exhausted-token",
  "expiresAt": "2025-01-20T17:00:00Z",
  "maxUses": 3,
  "usedCount": 3,  // Equals maxUses
  "isActive": false,  // Backend may set this to false
  "createdAt": "2025-01-20T15:30:00Z"
}
```

---

## 7. Complete Invite Lifecycle

### Creation → Active → Invalidated

```
1. CREATE INVITE
   ├─ User sets expiresInMinutes (default: 30)
   ├─ User optionally sets maxUses (default: unlimited)
   └─ POST /projects/{id}/invites
      └─ Backend creates invite with:
         - expiresAt = now + expiresInMinutes
         - usedCount = 0
         - isActive = true

2. INVITE IS ACTIVE
   ├─ isActive === true
   ├─ expiresAt > now
   └─ (maxUses === undefined || usedCount < maxUses)

3. INVITE BECOMES INVALID (one of):
   ├─ TIME EXPIRATION: expiresAt < now
   ├─ USAGE EXPIRATION: usedCount >= maxUses
   └─ MANUAL REVOCATION: isActive = false (via DELETE)

4. FRONTEND FILTERS
   └─ Only shows invites where:
      - isActive === true
      - expiresAt > now
      - (maxUses === undefined || usedCount < maxUses)
```

---

## 8. Frontend Display Logic Summary

### Active Invites List

**Filter**:
```typescript
invitesData.invites.filter((invite: any) => 
  invite.isActive && 
  new Date(invite.expiresAt) > new Date()
)
```

**Display for each invite**:
- Invite URL/token
- Expiration time (formatted: "30 mins", "2 hours", etc.)
- Usage count (if maxUses is set): "3/5 uses"
- Copy button
- Revoke button (if user has permission)

### Invite Acceptance Page

**Validation**:
```typescript
const isExpired = invite ? new Date(invite.expiresAt) < new Date() : false;
const isValid = invite?.isActive && !isExpired;
```

**Shows**:
- Project name
- Expiration timestamp
- Error if expired or inactive
- Accept button (if valid and authenticated)

---

## 9. Cache Management

### Query Keys

```typescript
// List of invites for a project
['projects', projectId, 'invites']

// Invite details by token (public)
['invites', inviteToken]
```

### Cache Invalidation Triggers

1. **After creating invite**: Invalidates `['projects', projectId, 'invites']`
2. **After revoking invite**: Invalidates `['projects', projectId, 'invites']`
3. **After accepting invite**: Invalidates `['invites']` (all invite queries)

### Cache Settings

```typescript
// Invites list query
staleTime: Infinity,           // Never goes stale
gcTime: 24 * 60 * 60 * 1000,   // Keep in cache for 24 hours
refetchOnMount: false,         // Don't refetch if data exists
refetchOnWindowFocus: false,   // Don't refetch on focus
refetchOnReconnect: false,     // WebSocket handles updates
```

---

## 10. Recommendations

### Current Implementation Gaps

1. **Usage-based filtering**: Frontend doesn't explicitly check `usedCount < maxUses` in the filter. Backend should handle this by setting `isActive = false` when max uses are reached.

2. **Real-time updates**: Invites list doesn't automatically update when:
   - Invite expires (time-based)
   - Invite is used (usage-based)
   
   **Solution**: Use WebSocket cache invalidation for `project_members` changes, or poll periodically.

3. **Expiration display**: Consider showing a warning when invite is close to expiring (e.g., < 5 minutes remaining).

### Best Practices

✅ **Do**:
- Always check both `isActive` and `expiresAt` before showing invite
- Display usage count when `maxUses` is set
- Invalidate cache after create/revoke operations
- Show clear expiration messages

❌ **Don't**:
- Rely solely on frontend for validation (backend is source of truth)
- Cache invite validation results indefinitely
- Show expired invites in active list

---

## Summary

- **Creation**: User sets `expiresInMinutes` (default: 30) and optional `maxUses`
- **Time Expiration**: Frontend filters `expiresAt > now`
- **Usage Expiration**: Backend increments `usedCount`; frontend displays `usedCount/maxUses`
- **Manual Revocation**: DELETE endpoint sets `isActive = false`
- **Active Filter**: `isActive === true && expiresAt > now`
- **Cache**: Invalidated on create/revoke/accept operations







