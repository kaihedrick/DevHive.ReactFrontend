import { queryClient } from '../lib/queryClient.ts';

interface CacheInvalidationPayload {
  resource: 'project' | 'sprint' | 'task' | 'project_member';
  id?: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  project_id: string;
  timestamp: string;
}

interface WebSocketMessage {
  type: 'cache_invalidate' | 'reconnect' | 'pong';
  data?: CacheInvalidationPayload | { reason: string };
  project_id?: string;
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

  connect(projectId: string, accessToken: string) {
    // If already connected to the same project, don't reconnect
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentProjectId === projectId) {
      return;
    }

    // Disconnect existing connection if project changed
    if (this.currentProjectId !== projectId) {
      this.disconnect();
    }

    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.currentProjectId = projectId;

    // Build WebSocket URL - use project_id (snake_case) to match backend
    // IMPORTANT: Browsers cannot send custom headers in WebSocket constructor
    // The token MUST be sent in the query parameter for browser compatibility
    // Backend should accept token via query parameter OR HttpOnly cookie (sent automatically)
    // Always use wss:// for production backend (HTTPS requires WSS)
    const wsBaseUrl = process.env.REACT_APP_WS_URL || 'wss://devhive-go-backend.fly.dev';
    
    // Ensure URL starts with wss:// or ws://
    const baseUrl = wsBaseUrl.startsWith('wss://') || wsBaseUrl.startsWith('ws://') 
      ? wsBaseUrl 
      : `wss://${wsBaseUrl}`;
    
    // Token MUST be in query parameter - browsers don't support headers in WebSocket
    // Backend should read token from query parameter: ?project_id={id}&token={token}
    const wsUrl = `${baseUrl}/api/v1/messages/ws?project_id=${encodeURIComponent(projectId)}&token=${encodeURIComponent(accessToken)}`;
    
    console.log(`🔌 Connecting to WebSocket: ${baseUrl}/api/v1/messages/ws?project_id=${projectId}&token=***`);
    console.log(`🔌 Full URL (token hidden): ${wsUrl.replace(accessToken, '***')}`);
    
    try {
      // Browser WebSocket constructor does NOT support headers option
      // Token is sent via query parameter as required for browser compatibility
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ Cache invalidation WebSocket connected for project:', projectId);
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;

        // Send initialization message
        try {
          this.ws?.send(JSON.stringify({
            type: 'init',
            projectId: projectId,
          }));
        } catch (error) {
          console.error('❌ Failed to send initialization message:', error);
        }

        // Start heartbeat to keep connection alive (30s interval)
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        console.error('❌ WebSocket readyState:', this.ws?.readyState);
        console.error('❌ WebSocket URL attempted:', wsUrl.replace(accessToken, '***'));
        this.isConnecting = false;
      };

      this.ws.onclose = (event) => {
        console.log('👋 Cache invalidation WebSocket disconnected');
        console.log('📊 Close event details:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        this.isConnecting = false;
        this.stopHeartbeat();
        this.ws = null;
        
        // Only reconnect if we still have a project selected and it wasn't a clean close
        if (this.currentProjectId && event.code !== 1000) {
          this.scheduleReconnect(projectId, accessToken);
        }
      };
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      this.scheduleReconnect(projectId, accessToken);
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

  private scheduleReconnect(projectId: string, accessToken: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Cache invalidation unavailable.');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Only reconnect if page is visible
    if (document.visibilityState === 'hidden') {
      console.log('📱 Page not visible, delaying reconnection attempt');
      this.reconnectTimer = setTimeout(() => {
        this.scheduleReconnect(projectId, accessToken);
      }, 5000);
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        this.maxReconnectDelay
      );
      console.log(`🔄 Reconnecting cache invalidation WebSocket (attempt ${this.reconnectAttempts})...`);
      this.connect(projectId, accessToken);
    }, this.reconnectDelay);
  }

  private handleMessage(message: WebSocketMessage) {
    switch (message.type) {
      case 'cache_invalidate':
        // CRITICAL: Backend sends payload in message.data
        if (message.data) {
          this.handleCacheInvalidation(message.data as CacheInvalidationPayload);
        }
        break;
      case 'reconnect':
        // On reconnect, DON'T invalidate all caches - WebSocket reconnection doesn't mean data changed
        // Only invalidate when backend explicitly sends cache_invalidate messages
        console.log('🔄 Cache invalidation WebSocket reconnected - keeping existing cache');
        // Cache remains valid until backend explicitly invalidates via cache_invalidate message
        break;
      case 'pong':
        // Heartbeat response - ignore
        break;
      default:
        console.warn('⚠️ Unknown WebSocket message type:', message.type);
    }
  }

  private handleCacheInvalidation(payload: CacheInvalidationPayload) {
    const { resource, id, action, project_id } = payload;

    console.log(`🔄 Cache invalidation: ${resource} ${action}`, { id, project_id });

    // Invalidate based on resource type using partial key matching
    switch (resource) {
      case 'project':
        if (id) {
          // Invalidate specific project
          queryClient.invalidateQueries({ queryKey: ['projects', 'detail', id] });
        }
        // Always invalidate project list (matches any options)
        queryClient.invalidateQueries({ queryKey: ['projects', 'list'] });
        break;

      case 'sprint':
        if (id) {
          // Invalidate specific sprint
          queryClient.invalidateQueries({ queryKey: ['sprints', 'detail', id] });
        }
        // Invalidate sprints for the project (matches any options)
        queryClient.invalidateQueries({ queryKey: ['sprints', 'list', project_id] });
        break;

      case 'task':
        if (id) {
          // Invalidate specific task
          queryClient.invalidateQueries({ queryKey: ['tasks', 'detail', id] });
        }
        // Invalidate tasks for the project
        queryClient.invalidateQueries({ queryKey: ['tasks', 'list', 'project', project_id] });
        // Invalidate all sprint tasks (task might belong to any sprint)
        queryClient.invalidateQueries({ queryKey: ['tasks', 'list', 'sprint'] });
        break;

      case 'project_member':
        // Invalidate project members
        queryClient.invalidateQueries({ queryKey: ['projectMembers', project_id] });
        // Also invalidate project bundle if it exists
        queryClient.invalidateQueries({ queryKey: ['projects', 'bundle', project_id] });
        break;

      default:
        console.warn('⚠️ Unknown resource type for cache invalidation:', resource);
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.currentProjectId = null;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.isConnecting = false;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const cacheInvalidationService = new CacheInvalidationService();

