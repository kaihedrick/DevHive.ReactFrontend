# Fix Real-time Cache Invalidation & Messaging Issues

## Problem Statement

Multiple real-time features are not working correctly:

1. **Messages not updating in real-time** - Receiving users don't see new messages until logout/login
2. **Member join/leave not updating** - Project members list doesn't update when users join/leave
3. **Chat messages looking different** - Messages appear differently on sender vs receiver end
4. **Cache invalidation gaps** - Some resources not invalidating properly

## Investigation Summary

### Architecture Analysis

The backend uses a **dual real-time system**:

1. **Immediate Application Broadcasts** (`broadcast.Send()`)
   - Called in HTTP handlers after successful operations
   - Sends typed events: `message_created`, `member_added`, `task_created`, etc.
   - Provides instant real-time updates

2. **Database Triggers** (PostgreSQL NOTIFY)
   - Fires on INSERT/UPDATE/DELETE operations
   - Sends `cache_invalidate` events via `pg_notify('cache_invalidate', ...)`
   - Ensures cache consistency even if immediate broadcasts fail

### Root Cause Analysis

#### Issue 1: Messages Not Updating in Real-time

**Root Cause: BACKEND - Messages table completely missing from both systems**

| System | Status | Issue |
|--------|--------|-------|
| Immediate Broadcasts | **MISSING** | Message handler not calling `broadcast.Send(EventMessageCreated)` |
| Database Triggers | **MISSING** | No `messages_cache_invalidate` trigger on `messages` table |

**Evidence:**
- `backend references/.agent/System/realtime_system.md` line 178: `messages` table NOT in trigger list
- `.agent/System/realtime_messaging.md` line 271: `messages` trigger status marked as "MISSING"

**Frontend Status: READY**
- `cacheInvalidationService.ts` lines 575-588: Handles `message_created` events
- `cacheInvalidationService.ts` lines 747-755: Handles `cache_invalidate` for `message` resource
- `useMessages.ts` lines 29-33: Uses `messageKeys.project(projectId)` query key

#### Issue 2: Member Join/Leave Not Updating

**Root Cause: Possibly BACKEND - May not be sending immediate broadcasts**

| System | Status | Notes |
|--------|--------|-------|
| Immediate Broadcasts | **UNCERTAIN** | Need to verify `broadcast.Send(EventMemberAdded)` is called |
| Database Triggers | ✅ Active | `project_members_cache_invalidate` trigger exists |

**Frontend Status: READY**
- `cacheInvalidationService.ts` lines 564-573: Handles `member_added`/`member_removed` events
- `cacheInvalidationService.ts` lines 733-745: Handles `cache_invalidate` for `project_members`

#### Issue 3: Messages Looking Different on Sender vs Receiver

**Root Cause: Potential ID format mismatch or field naming inconsistency**

The display logic in `Message.tsx` (line 252-254):
```tsx
className={`message-item ${message.userId === loggedInUserId ? 'sent' : 'received'}`}
```

**Potential Issues:**
1. `userId` comes from `localStorage.getItem('userId')` (set during login)
2. `message.senderId` comes from API response
3. `useMessages.ts` maps `senderId` -> `userId` for compatibility

**Check needed:**
- Are UUIDs stored in the same format (lowercase vs uppercase)?
- Is the backend returning `senderId` or `sender_id` (camelCase vs snake_case)?
- Is `loggedInUserId` ever null when it shouldn't be?

## Implementation Plan

### Phase 1: Backend Fixes (REQUIRED - Main Blocker)

#### 1.1 Add Immediate Broadcasts for Messages

**File:** `internal/http/handlers/message.go` (or equivalent)

```go
// After successful message creation:
func (h *MessageHandler) CreateMessage(w http.ResponseWriter, r *http.Request) {
    // ... existing message creation logic ...

    // After successful INSERT:
    broadcast.Send(r.Context(), message.ProjectID, broadcast.EventMessageCreated, MessageResponse{
        ID:        message.ID,
        ProjectID: message.ProjectID,
        SenderID:  message.SenderID,
        Content:   message.Content,
        // ... other fields
    })

    // Return response
}
```

#### 1.2 Add Database Trigger for Messages

**Migration:** `012_add_messages_cache_trigger.sql`

```sql
-- Add messages table to cache invalidation triggers
CREATE TRIGGER messages_cache_invalidate
    AFTER INSERT OR UPDATE OR DELETE ON messages
    FOR EACH ROW EXECUTE FUNCTION notify_cache_invalidation();
```

**Update:** `notify_cache_invalidation()` function to handle messages:

```sql
-- Add to resource name normalization in notify_cache_invalidation()
resource_name := CASE TG_TABLE_NAME
    WHEN 'projects' THEN 'project'
    WHEN 'sprints' THEN 'sprint'
    WHEN 'tasks' THEN 'task'
    WHEN 'messages' THEN 'message'  -- ADD THIS
    ELSE TG_TABLE_NAME
END;
```

#### 1.3 Verify Member Broadcasts

**Check:** `internal/http/handlers/project_member.go`

Ensure these broadcasts are called:
```go
// After adding member:
broadcast.Send(ctx, projectID, broadcast.EventMemberAdded, MemberData{...})

// After removing member:
broadcast.Send(ctx, projectID, broadcast.EventMemberRemoved, MemberData{...})
```

### Phase 2: Frontend Verification (If Backend Fixed)

#### 2.1 Debug Message ID Comparison

Add temporary logging in `useMessages.ts`:

```typescript
// After mapping messages
console.log('🔍 Message ID Debug:', {
  loggedInUserId,
  messageIds: messages.map(m => ({ id: m.id, senderId: m.senderId, userId: m.userId }))
});
```

#### 2.2 Verify WebSocket Events

Open browser console and check for:
```
📨 WS Event received: {"type":"message_created","project_id":"..."}
💬 Message created for project ...
🔄 Invalidating message queries for project: ...
```

### Phase 3: Frontend Fixes (If Needed)

#### 3.1 ID Format Normalization

If IDs don't match due to case differences:

```typescript
// In useMessages.ts
const normalizeId = (id: string) => id?.toLowerCase?.() || id;

const messages: Message[] = (messagesData?.messages || []).map((msg: Message) => ({
  ...msg,
  userId: normalizeId(msg.senderId),
}));

// In useMessages hook return:
loggedInUserId: normalizeId(getUserId()),
```

#### 3.2 Null Safety for User ID

```typescript
// In Message.tsx
const isSentByMe = loggedInUserId && message.userId &&
  message.userId.toLowerCase() === loggedInUserId.toLowerCase();

className={`message-item ${isSentByMe ? 'sent' : 'received'}`}
```

## Testing Strategy

### After Backend Implementation

1. **Two-Browser Test:**
   - Open same project in two different browsers (different users)
   - Send message from Browser A
   - Verify message appears immediately in Browser B (without refresh)

2. **Console Verification:**
   Browser B should show:
   ```
   📨 WS Event received: {"type":"message_created","data":{...},"project_id":"..."}
   💬 Message created for project ...
   🔄 Invalidating message queries for project: ...
   ✅ Message cache invalidation completed
   ```

3. **Member Join/Leave Test:**
   - User A invites User B to project
   - User B accepts invite
   - Verify User A sees User B in members list immediately

### Debug Commands

```javascript
// In browser console:
debugWebSocket()  // Check WebSocket connection status

// Check React Query cache:
queryClient.getQueryData(['messages', 'list', 'project', projectId])
```

## File References

### Frontend Files
| File | Purpose | Status |
|------|---------|--------|
| `src/services/cacheInvalidationService.ts` | WebSocket cache sync | ✅ Ready |
| `src/hooks/useMessages.ts` | Message queries/mutations | ✅ Ready |
| `src/components/Message.tsx` | Message UI component | ⚠️ Check ID comparison |
| `src/services/authService.ts` | getUserId() function | ✅ Working |

### Backend Files (Need Changes)
| File | Purpose | Change Needed |
|------|---------|---------------|
| `internal/http/handlers/message.go` | Message creation | Add `broadcast.Send()` |
| `internal/http/handlers/project_member.go` | Member management | Verify broadcasts |
| `cmd/devhive-api/migrations/` | Database migrations | Add messages trigger |
| `internal/db/notify_listener.go` | NOTIFY listener | No changes needed |

## Success Criteria

- [ ] Messages appear immediately for all project members without logout/login
- [ ] Member list updates in real-time when users join/leave
- [ ] Messages display correctly (blue = sent by me, gray = received)
- [ ] WebSocket events logged in browser console on message send
- [ ] No performance regression on message sending

## Risk Assessment

### Low Risk
- Uses existing trigger function pattern
- Follows same implementation as other tables
- No breaking changes to existing functionality

### Medium Risk
- Migration order dependency
- Need to coordinate frontend/backend deployment

## Rollback Plan

### Backend
```sql
DROP TRIGGER IF EXISTS messages_cache_invalidate ON messages;
```

### Frontend
No rollback needed - frontend already handles both event types.

## Related Documentation

- [Realtime Messaging Architecture](../System/realtime_messaging.md)
- [Caching Strategy](../System/caching_strategy.md)
- [Backend Realtime System](../../backend references/.agent/System/realtime_system.md)
- [Fix Message Realtime Updates](./fix_message_realtime_updates.md) - Previous investigation

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend WebSocket | ✅ Working | Connected and receiving events |
| Frontend Event Handlers | ✅ Ready | Handles both event types |
| Backend Immediate Broadcasts | ❌ Missing | Messages not broadcasting |
| Backend Database Triggers | ❌ Missing | Messages table not covered |
| Member Broadcasts | ⚠️ Uncertain | Need to verify in backend |

**Next Step:** Implement backend changes (Phase 1) - this is the main blocker.
