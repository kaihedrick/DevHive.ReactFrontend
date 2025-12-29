import { queryClient } from '../lib/queryClient.ts';
import { getAccessToken, refreshToken } from '../lib/apiClient.ts';
import { WS_BASE_URL } from '../config.js';
import { messageKeys } from '../hooks/useMessages.ts';

/**
 * Cache invalidation payload structure from backend
 * 
 * Backend normalizes database table names to singular resource names:
 * - `projects` table → `'project'` resource
 * - `sprints` table → `'sprint'` resource
 * - `tasks` table → `'task'` resource
 * - `project_members` table → `'project_members'` resource (kept plural)
 * 
 * Migration `007_ensure_notify_triggers.sql` ensures this normalization.
 * 
 * NOTE: For backward compatibility, we also handle plural forms ('tasks', 'sprints', 'projects')
 * in case some backend instances haven't been migrated yet.
 */
interface CacheInvalidationPayload {
  resource: 'project' | 'projects' | 'sprint' | 'sprints' | 'task' | 'tasks' | 'project_members' | 'message' | 'messages';
  id: string; // UUID for projects/sprints/tasks/messages, "project_id:user_id" for project_members
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  project_id: string; // Always present
  timestamp: string; // ISO 8601 format
}

interface WebSocketMessage {
  type: 'member_added' | 'member_removed' | 'message_created' | 'task_created' | 'task_updated' | 'task_deleted' | 'sprint_created' | 'sprint_updated' | 'sprint_deleted' | 'project_updated' | 'cache_invalidate' | 'reconnect' | 'pong';
  // Event-specific fields (backend sends camelCase)
  projectId?: string; // Primary: camelCase from backend
  project_id?: string; // Fallback: legacy snake_case support
  user_id?: string;
  id?: string;
  // Legacy cache_invalidate format
  resource?: string;
  action?: string;
  timestamp?: string;
  // Fallback for nested data format (if backend changes)
  data?: CacheInvalidationPayload | { reason: string };
}

class CacheInvalidationService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private currentProjectId: string | null = null;
  private authFailureDetected = false; // Track auth failures to stop reconnecting
  private sessionGeneration = 0; // Increment on each connect/disconnect to invalidate stale callbacks
  private onForbiddenCallback: ((projectId: string) => void) | null = null; // Callback for 403 Forbidden errors

  // Debug method to check WebSocket status (call from browser console)
  public debugWebSocketStatus(): void {
    console.log('🔍 WebSocket Debug Status:', {
      isConnected: this.isConnected(),
      isConnecting: this.isConnecting,
      wsExists: !!this.ws,
      wsReadyState: this.ws?.readyState,
      wsUrl: this.ws?.url,
      currentProjectId: this.currentProjectId,
      sessionGeneration: this.sessionGeneration,
      heartbeatActive: !!this.heartbeatInterval,
      authFailureDetected: this.authFailureDetected,
      reconnectAttempts: this.reconnectAttempts
    });
  }

  /**
   * Decodes JWT and checks if it's expired by examining the 'exp' claim.
   * This allows proactive token refresh before actual expiration.
   * 
   * @param token - The JWT token to check
   * @param bufferSeconds - Number of seconds before expiration to consider token expired (default: 30)
   *                        This allows proactive refresh before actual expiration
   * @returns true if token is expired or expires within bufferSeconds
   */
  private isJWTExpired(token: string, bufferSeconds: number = 30): boolean {
    try {
      // JWT format: header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.warn('⚠️ Invalid JWT format');
        return true; // Consider invalid tokens as expired
      }

      // Decode payload (second part) - base64url decode
      const payload = parts[1];
      // Replace URL-safe base64 characters and add padding if needed
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      
      const decoded = JSON.parse(atob(padded));
      
      // Check exp claim (expiration time in seconds since epoch)
      if (decoded.exp) {
        const expTime = decoded.exp;
        const now = Math.floor(Date.now() / 1000); // Current time in seconds
        // Proactive check: token expires within bufferSeconds
        const expiresWithinBuffer = expTime < (now + bufferSeconds);
        
        if (expiresWithinBuffer) {
          const timeUntilExpiry = expTime - now;
          if (timeUntilExpiry > 0) {
            console.log(`⚠️ JWT expires within ${bufferSeconds}s (expires in ${timeUntilExpiry}s), refreshing proactively...`);
          } else {
            console.log(`⚠️ JWT expired: exp=${expTime}, now=${now}, diff=${now - expTime}s`);
          }
        }
        
        return expiresWithinBuffer;
      }
      
      // No exp claim - consider expired for safety
      console.warn('⚠️ JWT has no exp claim');
      return true;
    } catch (error) {
      console.error('❌ Failed to decode JWT:', error);
      return true; // Consider invalid tokens as expired
    }
  }

  /**
   * Ensures we have a fresh, valid access token before connecting.
   * Always fetches the latest token at connect-time (never uses cached value).
   * Proactively refreshes token if it expires within 30 seconds.
   * 
   * Decodes JWT and checks 'exp' claim directly with 30-second buffer for proactive refresh.
   */
  private async ensureFreshToken(): Promise<string> {
    // Always fetch fresh token from memory (no localStorage fallback)
    let token = getAccessToken();
    
    if (!token) {
      this.authFailureDetected = true;
      throw new Error('No access token available - user may need to login');
    }

    // Proactive check: Decode JWT and check exp claim with 30-second buffer
    // This refreshes tokens before they actually expire, preventing connection failures
    if (this.isJWTExpired(token, 30)) {
      console.log('⚠️ Token expires within 30 seconds or is expired, refreshing proactively before WebSocket connection...');
      try {
        token = await refreshToken();
        if (!token) {
          this.authFailureDetected = true;
          throw new Error('Token refresh failed - no token returned');
        }
        console.log('✅ Token refreshed successfully');
        this.authFailureDetected = false; // Reset on successful refresh
      } catch (error) {
        console.error('❌ Failed to refresh token:', error);
        this.authFailureDetected = true;
        throw error;
      }
    } else {
      // Token is valid, reset auth failure flag
      this.authFailureDetected = false;
    }

    return token;
  }

  async connect(projectId: string, accessToken?: string) {
    // Increment generation on new connection attempt to invalidate any stale callbacks
    // This ensures we start fresh after logout/login
    this.sessionGeneration++;
    console.log(`🔄 Starting new connection session (generation ${this.sessionGeneration})`);
    
    // Reset auth failure flag on new connection attempt
    // This allows reconnection after logout/login
    this.authFailureDetected = false;

    // Singleton connection: ensure only one WebSocket per project
    // Check readyState: don't create a new connection if CONNECTING or OPEN
    if (this.ws) {
      const readyState = this.ws.readyState;
      
      // If already connected to the same project, don't reconnect
      if (readyState === WebSocket.OPEN && this.currentProjectId === projectId) {
        console.log('✅ WebSocket already connected to project:', projectId);
        return;
      }
      
      // If connecting to the same project, wait for it to complete
      if (readyState === WebSocket.CONNECTING && this.currentProjectId === projectId) {
        console.log('⏳ WebSocket connection already in progress for project:', projectId);
        return;
      }
      
      // If closing, wait for it to close before reconnecting
      if (readyState === WebSocket.CLOSING) {
        console.log('⏳ WebSocket is closing, will reconnect after close');
        return;
      }
      
      // If connected to different project or in unexpected state, disconnect first
      if (this.currentProjectId !== projectId || readyState === WebSocket.CLOSED) {
        this.disconnect();
      }
    }

    // Don't start a new connection if one is already in progress
    if (this.isConnecting) {
      console.log('⏳ Connection already in progress, skipping duplicate connect call');
      return;
    }

    this.isConnecting = true;
    this.currentProjectId = projectId;

    try {
      // Always fetch fresh token at connect-time - never use cached accessToken parameter
      // This ensures we get the latest token even after logout/login
      // ensureFreshToken() will proactively refresh if token expires within 30 seconds
      const freshToken = await this.ensureFreshToken();

      // Build WebSocket URL - connect to backend WebSocket endpoint
      // IMPORTANT: Browsers cannot send custom headers in WebSocket constructor
      // The token MUST be sent in the query parameter for browser compatibility
      // Production: wss://ws.devhive.it.com (AWS API Gateway, no path needed)
      // Development: ws://localhost:8080/api/v1/messages/ws (Go backend)
      const wsUrl = `${WS_BASE_URL}?token=${encodeURIComponent(freshToken)}`;

      console.log(`🔌 Connecting to WebSocket with fresh token: ${WS_BASE_URL}?token=***`);

      // Browser WebSocket constructor does NOT support headers option
      // Token is sent via query parameter as required for browser compatibility
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ Cache invalidation WebSocket connected for project:', projectId);
        this.isConnecting = false;
        // Reset reconnect state on successful connection
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        // Reset auth failure flag on successful connection
        this.authFailureDetected = false;

        // Send subscribe message to subscribe to project updates
        // CRITICAL: Backend expects projectId (camelCase), not project_id (snake_case)
        try {
          const subscribePayload = {
            action: 'subscribe',
            projectId: projectId,
          };
          this.ws?.send(JSON.stringify(subscribePayload));
          console.log('📤 WS Subscribe sent:', subscribePayload);
          console.log('⏳ Waiting for subscribe acknowledgment from backend...');
          console.log('💡 If you see "project_id required" error, it means the backend rejected the subscribe (wrong field name)');
        } catch (error) {
          console.error('❌ Failed to send subscribe message:', error);
        }

        // Start heartbeat to keep connection alive (30s interval)
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          console.log('📨 WS Event received:', event.data); // Add this to see ALL incoming messages
          const message: WebSocketMessage = JSON.parse(event.data);

          // DETAILED DEBUGGING: Log all event types and their payloads
          // Prioritize camelCase projectId over snake_case project_id
          console.log('🔍 WS Event Details:', {
            type: message.type,
            hasProjectId: 'projectId' in message || 'project_id' in message,
            projectId: message.projectId || message.project_id || 'N/A',
            hasData: 'data' in message,
            dataKeys: message.data ? Object.keys(message.data) : 'N/A',
            resource: (message as any).resource || 'N/A',
            action: (message as any).action || 'N/A',
            id: (message as any).id || 'N/A',
            fullMessage: message
          });

          // Special logging for subscribe response to confirm success/failure
          if (message.type === 'reconnect' || (message as any).message === 'subscribed') {
            console.log('✅ Subscribe acknowledged by backend:', message);
          }

          // Log member-related messages for debugging
          if (message.type === 'cache_invalidate' && message.data) {
            const data = message.data as CacheInvalidationPayload;
            if (data.resource === 'project_members') {
              console.log(`👥 Member ${data.action} for project ${data.project_id}`);
            }
          }

          this.handleMessage(message);
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnecting = false;
      };

      // Capture generation at connection time to detect stale close events
      const connectionGeneration = this.sessionGeneration;
      
      this.ws.onclose = async (event) => {
        // CRITICAL: Check if this close event is from a stale connection
        // (e.g., connection was closed/disconnected, then a new one started)
        if (connectionGeneration !== this.sessionGeneration) {
          console.log('ℹ️ Ignoring stale WebSocket close event (generation mismatch)');
          return;
        }

        console.log('👋 Cache invalidation WebSocket disconnected', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        this.isConnecting = false;
        this.stopHeartbeat();
        this.ws = null;
        
        // Handle close codes: don't reconnect on normal close (code 1000)
        // Code 1006 (abnormal close) often indicates 401/auth failure
        // Code 1001 (going away) - page navigation, don't reconnect
        // Code 1005 (no status) - abnormal closure, don't retry
        // Code 1008 (policy violation) - might be expired token, attempt refresh
        // Code 1002 (protocol error) - might be expired token, attempt refresh
        
        const isPotentialTokenExpiry = 
          event.code === 1008 || // Policy violation (might be expired token or 403)
          event.code === 1002;   // Protocol error (might be expired token)
        
        const isUnauthorized = 
          event.code === 1006 || // Abnormal close (often from 401)
          event.code === 4001;   // Custom: Unauthorized
        
        const isForbidden = 
          event.code === 4003;   // Custom: Forbidden (403)
        
        const isNormalClose = 
          event.code === 1000 || // Normal closure
          event.code === 1001;   // Going away (page navigation)
        
        // Check close reason for more specific error information
        const reason = event.reason || '';
        const isNotAuthorizedForProject = reason.includes('not a member') || 
                                         reason.includes('not authorized') ||
                                         reason.includes('Forbidden');
        
        // Handle 403 Forbidden - user is authenticated but not authorized for this project
        if (isForbidden || (isPotentialTokenExpiry && isNotAuthorizedForProject)) {
          console.error(`❌ WebSocket closed: Not authorized for project (code: ${event.code}, reason: ${reason})`);
          console.warn('⚠️ User is authenticated but not authorized for this project. Clearing selectedProjectId.');
          this.authFailureDetected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          
          // Clear invalid projectId from localStorage
          if (this.currentProjectId === projectId) {
            this.currentProjectId = null;
          }
          
          // Notify callback if registered (e.g., AuthContext can clear selectedProjectId)
          if (this.onForbiddenCallback) {
            this.onForbiddenCallback(projectId);
          }
          
          // Don't reconnect - user needs to select a different project
          return;
        }
        
        // Handle potential token expiry - attempt refresh and reconnect
        if (isPotentialTokenExpiry && !isNotAuthorizedForProject) {
          console.log(`🔄 WebSocket closed with code ${event.code} (potential token expiry), attempting token refresh and reconnect...`);
          await this.handleTokenRefreshAndReconnect(projectId);
          return;
        }
        
        // Handle 401 Unauthorized - token expired or invalid
        if (isUnauthorized) {
          console.error(`❌ WebSocket closed due to authentication failure (code: ${event.code}). Attempting token refresh and reconnect...`);
          await this.handleTokenRefreshAndReconnect(projectId);
          // If refresh failed, authFailureDetected will be set and we won't reconnect
          return;
        }
        
        if (isNormalClose) {
          console.log('ℹ️ Not reconnecting - normal close (code:', event.code, ')');
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          return;
        }
        
        // Only reconnect for other error codes (network issues, server errors, etc.)
        // Use this.currentProjectId instead of closure projectId to ensure we have the latest value
        if (this.currentProjectId && !this.authFailureDetected) {
          console.log('🔄 Will attempt to reconnect (close code:', event.code, ')');
          this.scheduleReconnect(this.currentProjectId);
        } else {
          console.log('ℹ️ Not reconnecting - project changed or auth failure detected');
        }
      };
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      
      // Check if error is related to token refresh failure
      if (error instanceof Error && error.message.includes('token')) {
        console.error('❌ Token-related error during WebSocket connection. Auth failure detected.');
        this.authFailureDetected = true;
        return;
      }
      
      // Only schedule reconnect if we still have a current project and no auth failure
      if (this.currentProjectId === projectId && !this.authFailureDetected) {
        console.log('🔄 Scheduling reconnect after connection error...');
        this.scheduleReconnect(projectId);
      } else {
        console.log('ℹ️ Not scheduling reconnect - project changed or auth failure detected');
      }
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          console.error('❌ Failed to send heartbeat:', error);
        }
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Invalidates all message queries for a given project using predicate matching.
   * Matches any user-scoped message query for the project, regardless of userId.
   * Uses refetchType: 'active' to ensure the open chat refetches immediately.
   *
   * @param projectId - The project ID to invalidate messages for
   */
  private invalidateProjectMessages(projectId: string): void {
    // Bail if projectId is empty (don't invalidate a blank key)
    if (!projectId || projectId === '') {
      console.warn('⚠️ Attempted to invalidate messages with empty projectId - skipping');
      return;
    }

    console.log(`🔄 Invalidating message queries for project: ${projectId}`);
    queryClient.invalidateQueries({
      predicate: (q) => {
        const k = q.queryKey;
        return (
          Array.isArray(k) &&
          k[0] === 'messages' &&
          k.includes('project') &&
          k.includes(projectId)
        );
      },
      // ensures the open chat refetches immediately
      refetchType: 'active',
    });
  }

  /**
   * Handles token refresh and reconnection when auth-related close codes occur.
   * Attempts to refresh the token and reconnect the WebSocket.
   * 
   * @param projectId - The project ID to reconnect to
   */
  private async handleTokenRefreshAndReconnect(projectId: string): Promise<void> {
    // Don't attempt if auth failure already detected
    if (this.authFailureDetected) {
      console.warn('⚠️ Auth failure already detected, skipping token refresh attempt');
      return;
    }

    // Don't attempt if project changed
    if (this.currentProjectId !== projectId) {
      console.log('ℹ️ Project changed during token refresh, cancelling reconnect');
      return;
    }

    try {
      console.log('🔄 WebSocket closed with potential token expiry, attempting token refresh and reconnect...');
      
      // Attempt to refresh token
      const freshToken = await this.ensureFreshToken();
      
      if (!freshToken) {
        console.error('❌ Token refresh failed - no token returned');
        this.authFailureDetected = true;
        return;
      }

      console.log('✅ Token refresh successful, reconnecting WebSocket...');
      
      // Reset reconnect attempts to allow reconnection
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      
      // Attempt to reconnect with fresh token
      // Small delay to ensure token is properly set
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.connect(projectId);
      
    } catch (error) {
      console.error('❌ Failed to refresh token and reconnect:', error);
      this.authFailureDetected = true;
      // Don't schedule automatic reconnect - user needs to login
    }
  }

  private scheduleReconnect(projectId: string) {
    // Don't reconnect if auth failure detected
    if (this.authFailureDetected) {
      console.warn('⚠️ Auth failure detected, stopping reconnection attempts');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Cache invalidation unavailable.');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Capture current generation to invalidate stale callbacks
    const currentGeneration = this.sessionGeneration;

    // Only reconnect if page is visible
    if (document.visibilityState === 'hidden') {
      console.log('📱 Page not visible, delaying reconnection attempt');
      this.reconnectTimer = setTimeout(() => {
        // Check generation before executing - bail if stale
        if (currentGeneration !== this.sessionGeneration) {
          console.log('ℹ️ Reconnect cancelled - session generation changed');
          return;
        }
        this.scheduleReconnect(projectId);
      }, 5000);
      return;
    }

    // Backoff on reconnect: use exponential backoff (1s, 2s, 4s, 8s, 16s, 30s max)
    this.reconnectAttempts++;
    
    // Calculate delay: 2^(attempt-1) seconds, capped at maxReconnectDelay
    // Attempt 1: 1s (1000ms), Attempt 2: 2s (2000ms), Attempt 3: 4s (4000ms), etc.
    const delay = Math.min(
      Math.pow(2, this.reconnectAttempts - 1) * 1000,
      this.maxReconnectDelay
    );
    
    console.log(`🔄 Reconnecting cache invalidation WebSocket (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);
    
    this.reconnectTimer = setTimeout(async () => {
      // CRITICAL: Check generation first - bail out if this callback is from a stale session
      if (currentGeneration !== this.sessionGeneration) {
        console.log('ℹ️ Reconnect cancelled - session generation changed (likely from logout/login)');
        return;
      }

      // Double-check we still need to reconnect
      // - Project hasn't changed
      // - Not already connected
      // - No auth failure
      if (this.currentProjectId === projectId && !this.isConnected() && !this.authFailureDetected) {
        // connect() will always fetch fresh token at connect-time (with proactive 30s buffer)
        console.log(`🔄 Attempting reconnection (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        await this.connect(projectId);
      } else if (this.currentProjectId !== projectId) {
        console.log('ℹ️ Project changed during reconnect delay, cancelling reconnect');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
      } else if (this.authFailureDetected) {
        console.log('ℹ️ Auth failure detected during reconnect delay, cancelling reconnect');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
      }
    }, delay);
  }

  private handleMessage(message: WebSocketMessage) {
    console.log('📨 WS Event received:', message); // Log all incoming messages

    switch (message.type) {
      // Handle specific event types from backend
      case 'member_added':
      case 'member_removed':
        // Prioritize camelCase projectId over snake_case project_id
        const memberProjectId = message.projectId || message.project_id || this.currentProjectId || '';
        console.log(`👥 Member ${message.type} for project ${memberProjectId}`);
        // Invalidate project and member caches
        queryClient.invalidateQueries({ queryKey: ['projects', memberProjectId] });
        queryClient.invalidateQueries({ queryKey: ['projectMembers', memberProjectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', 'bundle', memberProjectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', 'list'] });
        break;

      case 'message_created': {
        // Extract projectId from multiple sources (top-level, data, subscribed project)
        const projectId =
          message.projectId ||
          message.project_id ||
          (message.data as any)?.projectId ||
          (message.data as any)?.project_id ||
          this.currentProjectId ||
          '';

        if (!projectId) {
          console.warn('⚠️ message_created missing projectId; keys:', Object.keys(message), 'dataKeys:', Object.keys(message.data || {}));
          return;
        }

        console.log(`💬 Message created for project ${projectId}`);
        this.invalidateProjectMessages(projectId);
        break;
      }

      case 'task_created':
      case 'task_updated':
      case 'task_deleted':
        // Prioritize camelCase projectId over snake_case project_id
        const taskProjectId = message.projectId || message.project_id || '';
        console.log(`📋 Task ${message.type.replace('task_', '')} for project ${taskProjectId}`);
        // Invalidate task caches
        queryClient.invalidateQueries({ queryKey: ['tasks', 'list', 'project', taskProjectId] });
        queryClient.invalidateQueries({ queryKey: ['tasks', 'list', 'sprint'] }); // Invalidate all sprint tasks
        queryClient.invalidateQueries({ queryKey: ['projects', 'bundle', taskProjectId] });
        break;

      case 'sprint_created':
      case 'sprint_updated':
      case 'sprint_deleted':
        // Prioritize camelCase projectId over snake_case project_id
        const sprintProjectId = message.projectId || message.project_id || '';
        console.log(`📅 Sprint ${message.type.replace('sprint_', '')} for project ${sprintProjectId}`);
        // Invalidate sprint caches
        queryClient.invalidateQueries({ queryKey: ['sprints', 'list', sprintProjectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', 'bundle', sprintProjectId] });
        break;

      case 'project_updated':
        // Prioritize camelCase projectId over snake_case project_id
        const updatedProjectId = message.projectId || message.project_id || '';
        console.log(`🏗️ Project updated: ${updatedProjectId}`);
        // Invalidate project caches
        queryClient.invalidateQueries({ queryKey: ['projects', updatedProjectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', 'detail', updatedProjectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', 'bundle', updatedProjectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', 'list'] });
        break;

      // Legacy cache_invalidate format (fallback)
      case 'cache_invalidate': {
        console.log('📦 cache_invalidate message received');

        // NEW: nested payload support
        if (message.data && typeof message.data === 'object' && 'resource' in message.data) {
          const payload = message.data as CacheInvalidationPayload;
          // Ensure project_id is present - prioritize camelCase projectId over snake_case project_id
          if (!payload.project_id) {
            payload.project_id = message.projectId || message.project_id || '';
          }
          this.handleCacheInvalidation(payload);
          break;
        }

        // Existing: flat payload support - prioritize camelCase projectId
        if (message.resource) {
          const payload: CacheInvalidationPayload = {
            resource: message.resource as CacheInvalidationPayload['resource'],
            id: (message as any).id || (message as any).user_id || '',
            action: (message as any).action as CacheInvalidationPayload['action'],
            project_id: message.projectId || message.project_id || '',
            timestamp: (message as any).timestamp || new Date().toISOString(),
          };
          this.handleCacheInvalidation(payload);
          break;
        }

        console.warn('⚠️ Invalid cache_invalidate format:', message);
        break;
      }

      case 'reconnect':
        // Backend requested reconnect - no action needed
        console.log('🔄 Backend requested reconnect');
        break;

      case 'pong':
        // Heartbeat response - ignore
        // console.log('💓 Pong received'); // Uncomment for heartbeat debugging
        break;

      default:
        console.warn('⚠️ Unknown WebSocket message type:', message.type, message);
    }
  }

  /**
   * Handles cache invalidation based on WebSocket messages from the backend.
   * 
   * Backend sends singular resource names (migration `007_ensure_notify_triggers.sql`):
   * - `'project'` (not `'projects'`)
   * - `'sprint'` (not `'sprints'`)
   * - `'task'` (not `'tasks'`)
   * - `'project_members'` (unchanged, stays plural)
   * 
   * For backward compatibility, we also handle plural forms in case some backend
   * instances haven't been migrated yet.
   */
  private handleCacheInvalidation(payload: CacheInvalidationPayload) {
    const { resource, id, action, project_id } = payload;

    console.log(`🔄 Cache invalidation: ${resource} ${action}`, { id, project_id, currentProjectId: this.currentProjectId });

    // Normalize resource name (handle both singular and plural for backward compatibility)
    const normalizedResource = resource === 'projects' ? 'project'
      : resource === 'sprints' ? 'sprint'
      : resource === 'tasks' ? 'task'
      : resource === 'messages' ? 'message'
      : resource;

    switch (normalizedResource) {
      case 'project':
        // Handle project changes
        if (id) {
          queryClient.invalidateQueries({ queryKey: ['projects', id] });
          queryClient.invalidateQueries({ queryKey: ['projects', 'detail', id] }); // Also support detailed key pattern
        }
        queryClient.invalidateQueries({ queryKey: ['projects', 'list'] });
        
        // For project deletion, also remove from cache
        if (action === 'DELETE' && id) {
          queryClient.removeQueries({ queryKey: ['projects', id] });
          queryClient.removeQueries({ queryKey: ['projects', 'detail', id] });
          queryClient.removeQueries({ queryKey: ['projects', 'bundle', id] });
        }
        break;

      case 'sprint':
        // Handle sprint changes
        if (id) {
          queryClient.invalidateQueries({ queryKey: ['sprints', id] });
          queryClient.invalidateQueries({ queryKey: ['sprints', 'detail', id] }); // Also support detailed key pattern
        }
        
        // For INSERT actions (new sprints), immediately refetch to ensure visibility
        // For UPDATE/DELETE, invalidate is sufficient (will refetch when query becomes active)
        if (action === 'INSERT') {
          console.log(`🔄 Refetching sprints list for project ${project_id} (new sprint created)`);
          queryClient.refetchQueries({ 
            queryKey: ['sprints', 'list', project_id],
            exact: false // Match queries with options/filters (e.g., ['sprints', 'list', projectId, { limit: 100, offset: 0 }])
          });
        }
        
        // Always invalidate to ensure stale data is refreshed
        queryClient.invalidateQueries({ 
          queryKey: ['sprints', 'list', project_id],
          exact: false // Match queries with options/filters
        });
        queryClient.invalidateQueries({ queryKey: ['projects', 'bundle', project_id] });
        console.log(`✅ Sprint cache invalidated for project ${project_id} (action: ${action})`);
        break;

      case 'task':
        // Handle task changes
        if (id) {
          queryClient.invalidateQueries({ queryKey: ['tasks', id] });
          queryClient.invalidateQueries({ queryKey: ['tasks', 'detail', id] }); // Also support detailed key pattern
        }
        // Invalidate tasks list for the project (matches ['tasks', 'list', 'project', project_id])
        queryClient.invalidateQueries({ queryKey: ['tasks', 'list', 'project', project_id] });
        // Invalidate all sprint tasks (matches ['tasks', 'list', 'sprint', sprintId] for any sprint)
        queryClient.invalidateQueries({ queryKey: ['tasks', 'list', 'sprint'] });
        console.log(`✅ Task cache invalidated for project ${project_id}`);
        break;

      case 'project_members':
        // Handle member changes (invalidate caches for immediate updates)
        queryClient.invalidateQueries({ queryKey: ['projectMembers', project_id] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        console.log(`✅ Invalidated project member caches for project ${project_id}`);
        break;

      case 'message': {
        this.invalidateProjectMessages(project_id);
        console.log(`✅ Invalidated message caches for project ${project_id}`);
        break;
      }

      default:
        console.warn('⚠️ Unknown resource type for cache invalidation:', resource);
    }
  }

  disconnect(reason: string = 'Intentional disconnect') {
    console.log('🔌 Disconnecting WebSocket:', reason);

    // CRITICAL: Increment generation to invalidate ALL pending reconnect callbacks
    // This ensures stale timers from before logout won't execute
    this.sessionGeneration++;
    console.log(`🔄 Session generation incremented to ${this.sessionGeneration} (invalidating stale callbacks)`);

    // Cancel any pending reconnection attempts
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      const readyState = this.ws.readyState;

      // CRITICAL FIX: Cannot call close() on CONNECTING WebSocket
      // Calling close() during CONNECTING causes: "WebSocket is closed before the connection is established."
      if (readyState === WebSocket.OPEN) {
        // Use normal closure code (1000) to indicate intentional disconnect
        // This prevents reconnection attempts
        this.ws.close(1000, reason);
      } else if (readyState === WebSocket.CONNECTING) {
        // Cannot call close() during CONNECTING - just remove handlers and nullify
        console.log('⚠️ WebSocket is CONNECTING, cannot call close() - removing handlers instead');
      }
      // For CLOSING or CLOSED states, we don't need to call close()

      // Remove event handlers to prevent any callbacks from firing
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws = null;
    }

    // Reset all state
    this.currentProjectId = null;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.isConnecting = false;
    // Don't reset authFailureDetected here - let it persist until next login
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get current connection status for debugging
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected(),
      currentProjectId: this.currentProjectId,
      readyState: this.ws?.readyState,
      readyStateText: this.ws ? {
        0: 'CONNECTING',
        1: 'OPEN',
        2: 'CLOSING',
        3: 'CLOSED'
      }[this.ws.readyState] : 'NO_SOCKET'
    };
  }

  /**
   * Register a callback to be called when a 403 Forbidden error occurs
   * This allows components (e.g., AuthContext) to clear invalid projectId
   * @param callback - Function to call with projectId when 403 occurs
   */
  setOnForbiddenCallback(callback: ((projectId: string) => void) | null): void {
    this.onForbiddenCallback = callback;
  }
}

export const cacheInvalidationService = new CacheInvalidationService();

// Make debug method globally accessible for browser console debugging
if (typeof window !== 'undefined') {
  (window as any).debugWebSocket = () => cacheInvalidationService.debugWebSocketStatus();
}

