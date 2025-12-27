# Fix Message Realtime Updates - Messages Not Updating Without Logout/Login

## Problem Statement

**Issue:** Messages are not updating in real-time for project members. Users need to perform a full logout and login to see new messages from other users.

**Current Behavior:**
- User A sends a message → message appears immediately for User A
- User B does NOT see the new message until they logout and login again
- This affects all project members except the message sender

**Expected Behavior:**
- When any user sends a message, ALL project members should see it immediately via WebSocket real-time updates

## Root Cause Analysis

### Dual Real-time System Architecture

**Backend Has TWO Mechanisms for Real-time Updates:**

1. **Immediate Application-Level Broadcasts:**
   - When message is created: `broadcast.Send(r.Context(), projectID, broadcast.EventMessageCreated, messageResp)`
   - Sends `message_created` event immediately to all WebSocket clients
   - Provides instant real-time messaging

2. **Database-Level Cache Invalidation Triggers:**
   - PostgreSQL triggers fire on table changes
   - Send `pg_notify()` to `cache_invalidate` channel
   - WebSocket hub broadcasts `cache_invalidate` events
   - Ensures frontend caches stay in sync

**Available Event Types:**
```go
const (
    EventTaskCreated       = "task_created"
    EventTaskUpdated       = "task_updated"
    EventTaskDeleted       = "task_deleted"
    EventSprintCreated     = "sprint_created"
    EventSprintUpdated     = "sprint_updated"
    EventSprintDeleted     = "sprint_deleted"
    EventMessageCreated    = "message_created"  // ← Immediate broadcast
    EventProjectUpdated    = "project_updated"
    EventMemberAdded       = "member_added"
    EventMemberRemoved     = "member_removed"
    EventCacheInvalidate   = "cache_invalidate" // ← From database triggers
)
```

### Frontend Event Handling Analysis

**Cache Invalidation Service (`src/services/cacheInvalidationService.ts`):**
- ✅ Has `message_created` case in `handleMessage()` (line 545-549)
- ✅ Invalidates `messageKeys.project(message.project_id)` query key
- ✅ Logs "💬 Message created for project ${message.project_id}"

**Messages Hook (`src/hooks/useMessages.ts`):**
- ✅ Uses `messageKeys.project(projectId)` query key (line 30)
- ✅ Has `staleTime: Infinity` (messages updated via WebSocket)
- ✅ `useSendMessage` mutation invalidates the same query key on success

### Potential Issues

**Issue 1: Race Condition Between Two Systems**
- Application broadcasts `message_created` immediately
- Database triggers also fire and send `cache_invalidate`
- Frontend might be handling both, but there could be conflicts

**Issue 2: Message Format Differences**
- `message_created` events might have different payload structure than `cache_invalidate`
- Frontend expects specific fields that might not be present

**Issue 3: WebSocket Connection Issues**
- WebSocket might not be connected properly
- Subscription messages might not be sent correctly
- Authentication issues with WebSocket connection

**Issue 4: Database Trigger Still Missing**
- Despite application broadcasts, database triggers might still be needed for reliability
- Current triggers: projects, sprints, tasks, project_members
- Missing: messages table trigger

## Investigation Required

### Phase 1: Debug Which System is Working

**Check Browser Console Logs:**
1. Open browser dev tools → Console tab
2. Send a message from another user/browser
3. Look for WebSocket events:
   - `📨 WS Event received:` logs from cacheInvalidationService
   - Look for `type: "message_created"` vs `type: "cache_invalidate"`

**Expected Immediate Broadcast:**
```json
{
  "type": "message_created",
  "data": { /* message object */ },
  "project_id": "uuid"
}
```

**Expected Database Trigger Broadcast:**
```json
{
  "type": "cache_invalidate",
  "resource": "message",
  "id": "message-uuid",
  "action": "INSERT",
  "project_id": "project-uuid",
  "timestamp": "2025-12-26T..."
}
```

### Phase 2: Verify WebSocket Connection

**Check Connection Status:**
1. WebSocket connection logs: `🔌 Connecting to WebSocket` and `✅ Cache invalidation WebSocket connected`
2. Subscription logs: `📤 WS Subscribe sent:` with project_id
3. Error logs: Any WebSocket errors or disconnections

### Phase 3: Test Message Sending

**Check Message Creation Flow:**
1. When sending a message, check if `useSendMessage` mutation succeeds
2. Verify message appears immediately for sender (via mutation onSuccess)
3. Check if WebSocket events are received by other clients

## Potential Solutions

### Solution A: Fix Immediate Broadcast Handling (If Application Broadcasts Work)

**Issue:** Frontend might not be properly handling `message_created` events from immediate broadcasts.

**Check:** Verify the message format matches what frontend expects:
```typescript
// Current handling in cacheInvalidationService.ts
case 'message_created':
  console.log(`💬 Message created for project ${message.project_id}`);
  queryClient.invalidateQueries({ queryKey: messageKeys.project(message.project_id) });
  break;
```

**Fix:** Ensure message format includes `project_id` field for immediate broadcasts.

### Solution B: Add Database Trigger Backup (If Only Database Triggers Work)

**Issue:** If immediate broadcasts aren't working, add the missing database trigger.

**Migration 008:** `cmd/devhive-api/migrations/008_add_messages_trigger.sql`
```sql
CREATE TRIGGER messages_cache_invalidate
    AFTER INSERT OR UPDATE OR DELETE ON messages
    FOR EACH ROW EXECUTE FUNCTION notify_cache_invalidation();
```

**Update Migration 007:** Add messages resource mapping
```sql
resource_name := CASE TG_TABLE_NAME
    WHEN 'projects' THEN 'project'
    WHEN 'sprints' THEN 'sprint'
    WHEN 'tasks' THEN 'task'
    WHEN 'messages' THEN 'message'
    ELSE TG_TABLE_NAME
END;
```

### Solution C: Ensure Both Systems Work Together

**Dual System Benefits:**
- Immediate Updates: Application broadcasts provide instant real-time messaging
- Cache Consistency: Database triggers ensure frontend caches stay in sync
- Reliability: If WebSocket connection drops, database triggers still work
- Performance: Frontend gets immediate feedback without polling

## Investigation Results Expected

**Please run the investigation and report back the results:**

### What to Look For:

1. **WebSocket Connection Logs:**
   ```
   🔌 Connecting to WebSocket with fresh token: wss://ws.devhive.it.com?token=***
   ✅ Cache invalidation WebSocket connected for project: [uuid]
   📤 WS Subscribe sent: { action: 'subscribe', project_id: '[uuid]' }
   ```

2. **WebSocket Event Logs (when sending a message):**
   ```
   📨 WS Event received: {"type":"message_created","project_id":"[uuid]",...}
   🔍 WS Event Details: { type: "message_created", hasProjectId: true, ... }
   💬 Message created for project [uuid]
   📝 Message created event details: { projectId: "[uuid]", ... }
   🔄 Invalidating message queries for project: [uuid]
   ```

3. **Debug Command Results:**
   - Open browser console and run: `debugWebSocket()`
   - Should show: `isConnected: true`, `currentProjectId: "[uuid]"`, etc.

### Expected Investigation Outcomes:

**✅ If `message_created` events appear:**
- Immediate application broadcasts are working perfectly
- Issue might be elsewhere (UI not updating, cache not invalidating properly)
- No backend changes needed

**⚠️ If only `cache_invalidate` events appear:**
- Database triggers are working, but immediate broadcasts are not
- Backend application broadcasts need to be implemented/fixed
- Need to add `broadcast.Send()` calls in message creation endpoint

**❌ If no events appear:**
- Neither system is working
- Need both immediate broadcasts AND database triggers
- Full backend implementation required

## Investigation Results: ❌ CONFIRMED - BACKEND MISSING MESSAGES TRIGGERS

**Analysis of Your Logs + Backend Documentation:**

✅ **WebSocket Connection:** Working (`✅ Cache invalidation WebSocket connected`)
✅ **Subscription:** Working (`📤 WS Subscribe sent`)
✅ **Message Sending:** Working (message sent successfully)
❌ **Real-time Events:** **NOT WORKING** - No `📨 WS Event received` logs on receiving end

**Backend Documentation Analysis:**

The backend has a **dual real-time system** but **messages table is completely missing**:

1. **Immediate Application Broadcasts:** `broadcast.Send()` calls in handlers
   - Backend should call: `broadcast.Send(r.Context(), projectID, broadcast.EventMessageCreated, messageResp)`
   - But message creation handler may not be calling this

2. **Database Triggers:** PostgreSQL NOTIFY triggers on tables
   - **Applied triggers:** `projects`, `sprints`, `tasks`, `project_members`
   - **Missing trigger:** `messages` table has NO trigger!
   - Migration 007 creates triggers for above tables but excludes `messages`

**Root Cause:** Messages table is not covered by either real-time mechanism. This explains why users must logout/login to see new messages.

## Next Steps: Backend Implementation Required

### Phase 1: Implement Immediate Application Broadcasts

**Backend Changes Needed:**
1. **Message Creation Endpoint** - Add `broadcast.Send()` call after successful message creation
2. **Broadcast Event** - Send `EventMessageCreated` with message data and project_id

### Phase 2: Add Database Trigger Backup (Optional)

**Database Migration:**
- Add messages table trigger for `cache_invalidate` events
- Update trigger function to handle `messages` table

### Phase 3: Test Both Systems

**Verify:**
- Immediate broadcasts work (instant updates)
- Database triggers work (backup for missed events)

## Backend Implementation Required

### Option A: Immediate Application Broadcasts (Recommended)

**Add to Message Creation Handler:**

```go
// In message creation handler (likely internal/http/handlers/message.go)
func (h *MessageHandler) CreateMessage(w http.ResponseWriter, r *http.Request) {
    // ... existing message creation logic ...

    // After successful message creation, broadcast immediately
    broadcast.Send(r.Context(), messageResp.ProjectID, broadcast.EventMessageCreated, messageResp)

    // Return response...
}
```

**Event Structure:**
```go
// broadcast.EventMessageCreated sends:
{
    "type": "message_created",
    "data": {
        "id": "message-uuid",
        "projectId": "project-uuid",
        "senderId": "user-uuid",
        "content": "message content",
        "messageType": "text",
        // ... other message fields
    },
    "project_id": "project-uuid"
}
```

### Option B: Database Triggers (Backup System)

**Migration 008:** `cmd/devhive-api/migrations/008_add_messages_trigger.sql`
```sql
CREATE TRIGGER messages_cache_invalidate
    AFTER INSERT OR UPDATE OR DELETE ON messages
    FOR EACH ROW EXECUTE FUNCTION notify_cache_invalidation();
```

**Update Migration 007:** Add messages resource mapping
```sql
WHEN 'messages' THEN 'message'
```

### Testing After Backend Changes

**Frontend will automatically work** - no frontend changes needed. Test by:

1. Send message from browser A
2. Check browser B console for:
   ```
   📨 WS Event received: {"type":"message_created",...}
   🔍 WS Event Details: {type: "message_created", hasProjectId: true, ...}
   💬 Message created for project [uuid]
   📝 Message created event details: {projectId: "[uuid]", ...}
   🔄 Invalidating message queries for project: [uuid]
   ✅ Message cache invalidation completed
   ```

3. Verify message appears immediately in browser B without logout/login

## Testing the Fix

**Once backend changes are implemented, test with:**

```javascript
// In browser console - test the debug function
debugWebSocket()
// Should show: isConnected: true, currentProjectId: "2464b428-..."

// Send a message from another browser and watch for:
📨 WS Event received: {"type":"message_created","data":{...},"project_id":"2464b428-..."}
🔍 WS Event Details: {type: "message_created", hasProjectId: true, ...}
💬 Message created for project 2464b428-...
📝 Message created event details: {projectId: "2464b428-...", ...}
🔄 Invalidating message queries for project: 2464b428-...
✅ Message cache invalidation completed
```

## Current Status

- ✅ Frontend ready for both event types (enhanced with better cache invalidation)
- ✅ WebSocket connection working
- ✅ Message sending working
- ✅ Enhanced debugging and error handling
- ❌ Backend broadcasting missing (main blocker)

**Next:** Backend needs to implement broadcast calls and/or database triggers for messages and members.

## Success Criteria

- ✅ Messages appear immediately in other users' browsers without logout/login
- ✅ WebSocket events logged in receiving browser console
- ✅ No additional frontend changes needed

### Step 3: Implement Missing Components

**If Immediate Broadcasts Need Fixing:**
- Verify message creation calls `broadcast.Send()` with `EventMessageCreated`
- Ensure message payload includes required fields (`project_id`, message data)

**If Database Triggers Missing:**
- Add messages table trigger (migration 008)
- Update trigger function resource mapping (migration 007)

**If Both Systems Need Implementation:**
- Implement immediate broadcasts in message creation endpoint
- Add database trigger for reliability

## Implementation Tasks

### ✅ Investigation Setup Completed

**Enhanced Debugging Added:**
1. **Detailed WebSocket Logging** - Added comprehensive logging in `cacheInvalidationService.ts`
   - `📨 WS Event received:` - Shows all incoming WebSocket messages
   - `🔍 WS Event Details:` - Detailed breakdown of event type, project_id, data structure
   - `📝 Message created event details:` - Specific logging for message_created events
   - `🔄 Invalidating message queries` - Cache invalidation logging

2. **Debug Method Added** - Call `debugWebSocket()` in browser console to check WebSocket status
   - Connection state, URL, project ID, heartbeat status
   - Available globally as `window.debugWebSocket()`

### ✅ Frontend Improvements Completed

**Enhanced WebSocket Event Handling:**
1. **Improved Cache Invalidation** - Changed `refetchQueries` to `invalidateQueries` for more reliable cache updates
   - Fixed project_members and messages to use `invalidateQueries` instead of `refetchQueries`
   - More consistent and reliable cache invalidation across all event types

2. **Enhanced Debug Logging** - Added resource, action, and id fields to event details logging
   - Helps identify cache_invalidate events from database triggers

3. **Fallback Project ID Handling** - Added fallbacks for events missing `project_id`
   - Uses `this.currentProjectId` as fallback for member events
   - Prevents cache invalidation failures when project_id is missing

4. **Consistent Query Invalidation** - Unified cache invalidation strategy across all resources
   - All resources now use `invalidateQueries` for consistent behavior

### Next Steps: Manual Investigation

**Run the app and test:**

1. **Start the application:**
   ```bash
   npm start
   ```

2. **Open browser console** and check for WebSocket connection:
   - Look for: `🔌 Connecting to WebSocket` and `✅ Cache invalidation WebSocket connected`
   - Check subscription: `📤 WS Subscribe sent:` with project_id

3. **Test message sending:**
   - Open two browser windows with the same project
   - Send a message from window A
   - Check window B console for WebSocket events

4. **Debug WebSocket status:**
   - In browser console, run: `debugWebSocket()`
   - Check if WebSocket is connected and subscribed to project

**Expected Results:**
- **If `message_created` events appear:** Immediate broadcasts are working ✅
- **If only `cache_invalidate` events appear:** Database triggers are working, immediate broadcasts are not
- **If no events appear:** Neither system is working

### Backend Tasks (If Needed)
1. **Add Messages Trigger** - Migration 008 for database-level cache invalidation
2. **Update Resource Mapping** - Migration 007 to handle messages table
3. **Verify Broadcasts** - Ensure application-level broadcasts fire on message creation

### Frontend Tasks (If Needed)
1. **Fix Event Handling** - Ensure both `message_created` and `cache_invalidate` events are handled
2. **Verify Message Format** - Confirm payload structure matches expectations

## Files to Investigate

### Frontend
- `src/services/cacheInvalidationService.ts` - WebSocket message handling
- Browser console logs - Actual events received

### Backend (If Investigation Shows Missing Components)
- `cmd/devhive-api/migrations/007_ensure_notify_triggers.sql` - Trigger function
- Message creation endpoint - Immediate broadcast implementation
- `internal/ws/broadcast.go` - Broadcast system

## Success Criteria

- ✅ Messages appear immediately in other users' browsers
- ✅ WebSocket events logged in browser console
- ✅ Both immediate broadcasts AND database triggers working (dual system)
- ✅ No logout/login required to see new messages

## Testing Strategy

### Manual Testing
1. **Multi-browser test:** Open same project in two browsers
2. **Send message:** User A sends message
3. **Verify real-time:** User B sees message immediately (without refresh)
4. **Check console:** Look for `💬 Message created for project...` log

### WebSocket Debugging
1. **Connection verification:** Check WebSocket connects successfully
2. **Subscription verification:** Verify `{"action": "subscribe", "project_id": "..."}` sent
3. **Event monitoring:** Watch for incoming `message_created` events
4. **Cache invalidation:** Confirm query invalidation triggers refetch

### Database Verification
1. **Trigger existence:** `SELECT * FROM pg_trigger WHERE tgname LIKE '%messages%';`
2. **Function test:** Manually insert message and check for NOTIFY event
3. **Hub broadcasting:** Verify WebSocket clients receive events

## Risk Assessment

### Low Risk
- ✅ Uses existing trigger function and pattern
- ✅ Follows same implementation as other tables
- ✅ No changes to existing functionality

### Medium Risk
- ⚠️ Migration order dependency (007 must run before 008)
- ⚠️ Resource name normalization affects all event types

## Rollback Plan

1. **Drop trigger:** `DROP TRIGGER IF EXISTS messages_cache_invalidate ON messages;`
2. **Revert migration:** Roll back migration 008
3. **Verify:** Messages still work via REST API (just not real-time)

## Related Documentation

- [Realtime Messaging Architecture](./System/realtime_messaging.md) - WebSocket and PostgreSQL NOTIFY system
- [Caching Strategy](./System/caching_strategy.md) - How cache invalidation works
- [Authentication Architecture](./System/authentication_architecture.md) - WebSocket authentication

## Success Criteria

- ✅ Messages appear immediately for all project members
- ✅ No logout/login required to see new messages
- ✅ WebSocket events logged in browser console
- ✅ Cache invalidation triggers UI updates
- ✅ No performance impact on message sending
