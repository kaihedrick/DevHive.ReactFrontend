// MessageService.js
// This module handles message-related API calls and WebSocket communication for real-time messaging in DevHive.

import { api } from '../lib/api.ts';
import { ENDPOINTS } from '../config';

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let heartbeatInterval = null;

/**
 * Sends a new message to a project.
 *
 * @param {Object} messageData - The message data
 * @param {string} messageData.projectId - The project ID
 * @param {string} messageData.content - The message content
 * @param {string} [messageData.messageType] - The message type (default: "text")
 * @param {string} [messageData.parentMessageId] - Parent message ID for replies
 * @returns {Promise<Object>} - The response object from the backend
 * @throws {Error} - Throws an error if the request fails
 */
export const sendMessage = async (messageData) => {
    try {
        const payload = {
            content: messageData.content,
            messageType: messageData.messageType || "text",
            ...(messageData.parentMessageId && { parentMessageId: messageData.parentMessageId })
        };

        console.log("📤 Sending message:", payload);

        const response = await api.post(`${ENDPOINTS.PROJECTS}/${messageData.projectId}/messages`, payload);

        console.log("✅ Message sent successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error sending message:", error.response?.status, error.response?.data || error.message);
        
        if (error.response?.status === 500) {
            throw new Error("Server error - The messaging service is currently unavailable. Our team has been notified.");
        } else if (error.response?.status === 401 || error.response?.status === 403) {
            throw new Error("Authentication error - Please try logging out and back in.");
        } else {
            throw new Error(`Failed to send message: ${error.response?.data?.message || error.message}`);
        }
    }
};

/**
 * Fetches messages for a specific project with pagination.
 *
 * @param {string} projectId - The project ID
 * @param {Object} [options] - Pagination options
 * @param {number} [options.limit] - Number of messages to fetch (default: 20, max: 100)
 * @param {number} [options.offset] - Number of messages to skip (default: 0)
 * @returns {Promise<Object>} - Object containing messages array and pagination info
 * @throws {Error} - Throws an error if fetching messages fails
 */
export const fetchProjectMessages = async (projectId, options = {}) => {
    try {
        const params = {
            limit: options.limit || 20,
            offset: options.offset || 0
        };

        console.log(`📡 Fetching messages for project ${projectId}:`, params);

        const response = await api.get(`${ENDPOINTS.PROJECTS}/${projectId}/messages`, { params });

        console.log("✅ Messages fetched successfully:", response.data);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            return { messages: [], limit: 0, offset: 0 };
        }
        console.error("❌ Error fetching project messages:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Fetches messages with cursor-based pagination for real-time updates.
 *
 * @param {string} projectId - The project ID
 * @param {Object} [options] - Pagination options
 * @param {string} [options.afterId] - Get messages after this message ID
 * @param {number} [options.limit] - Number of messages to fetch (default: 20, max: 100)
 * @returns {Promise<Object>} - Object containing messages array and pagination info
 * @throws {Error} - Throws an error if fetching messages fails
 */
export const fetchMessages = async (projectId, options = {}) => {
    try {
        const params = {
            projectId,
            limit: options.limit || 20,
            ...(options.afterId && { afterId: options.afterId })
        };

        console.log(`📡 Fetching messages with cursor pagination:`, params);

        const response = await api.get(ENDPOINTS.MESSAGES, { params });

        console.log("✅ Messages fetched successfully:", response.data);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            return { messages: [], limit: 0 };
        }
        console.error("❌ Error fetching messages:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Sends a reply to a specific message.
 *
 * @param {Object} replyData - The reply data
 * @param {string} replyData.projectId - The project ID
 * @param {string} replyData.parentMessageId - The parent message ID
 * @param {string} replyData.content - The reply content
 * @param {string} [replyData.messageType] - The message type (default: "text")
 * @returns {Promise<Object>} - The response object from the backend
 * @throws {Error} - Throws an error if the request fails
 */
export const sendReply = async (replyData) => {
    try {
        const payload = {
            content: replyData.content,
            messageType: replyData.messageType || "text",
            parentMessageId: replyData.parentMessageId
        };

        console.log("📤 Sending reply:", payload);

        const response = await api.post(`${ENDPOINTS.PROJECTS}/${replyData.projectId}/messages`, payload);

        console.log("✅ Reply sent successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error sending reply:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Sends a heartbeat message to the server to keep the WebSocket connection alive.
 *
 * @param {WebSocket} ws - The WebSocket connection instance
 */
const sendHeartbeat = (ws) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify({ type: "ping" }));
            console.log("💓 Sent heartbeat to keep WebSocket connection alive");
        } catch (error) {
            console.error("❌ Failed to send heartbeat:", error);
        }
    }
};

/**
 * Helper function to build WebSocket URL
 *
 * @param {string} projectId - The project ID
 * @returns {string|null} - The WebSocket URL or null if invalid
 */
const buildWebSocketUrl = (projectId) => {
    if (!projectId) {
        console.error("❌ Missing projectId for WebSocket URL");
        return null;
    }

    // Use the new Go backend WebSocket endpoint
    const token = getAuthToken();
    const wsUrl = `${ENDPOINTS.MESSAGES_WS}?token=${token}&projectId=${projectId}`;
    
    console.log(`🔌 Configured WebSocket URL: ${wsUrl}`);
    return wsUrl;
};

/**
 * Subscribes to real-time message updates for a project.
 *
 * @param {string} projectId - The project ID
 * @param {Function} onMessageReceived - Callback to invoke when a new message is received
 * @returns {WebSocket|null} - The WebSocket instance or null if connection fails
 */
export const subscribeToMessageStream = (projectId, onMessageReceived) => {
    if (!projectId) {
        console.error("❌ Missing projectId for WebSocket");
        return null;
    }

    // Close existing connection if any
    if (socket && socket.readyState !== WebSocket.CLOSED) {
        console.log("🔄 Closing existing WebSocket connection before creating a new one");
        socket.close();
    }
    
    // Clear any existing heartbeat interval
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }

    try {
        console.log('🔄 Attempting to connect to WebSocket...');
        const wsUrl = buildWebSocketUrl(projectId);
        
        if (!wsUrl) {
            console.error("❌ Failed to build WebSocket URL");
            return null;
        }
        
        console.log(`🔌 Connecting to WebSocket at: ${wsUrl}`);
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log(`✅ WebSocket connection established for project ${projectId}`);
            // Reset reconnect attempts on successful connection
            reconnectAttempts = 0;
            
            // Send initialization message
            try {
                socket.send(JSON.stringify({ 
                    type: "init", 
                    projectId: projectId 
                }));
                console.log("📤 Sent initialization message to WebSocket server");
            } catch (error) {
                console.error("❌ Failed to send initialization message:", error);
            }
            
            // Start heartbeat to keep connection alive
            heartbeatInterval = setInterval(() => sendHeartbeat(socket), 30000);
        };

        socket.onmessage = (event) => {
            try {
                console.log("📩 Raw WebSocket message received:", event.data);
                const message = JSON.parse(event.data);
                
                // Ignore heartbeat responses
                if (message.type === "pong") {
                    console.log("💓 Received heartbeat response");
                    return;
                }
                
                // Process the message
                console.log("📨 Processed WebSocket message:", message);
                onMessageReceived(message);
            } catch (error) {
                console.error("❌ Error parsing WebSocket message:", error);
            }
        };

        socket.onerror = (error) => {
            console.error("❌ WebSocket error:", error);
            
            // Clear heartbeat on error
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
                heartbeatInterval = null;
            }
        };

        socket.onclose = (event) => {
            console.log(`👋 WebSocket closed: Code: ${event.code}, Reason: ${event.reason || "No reason provided"}`);
            
            // Clear heartbeat on close
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
                heartbeatInterval = null;
            }
            
            // Implement exponential backoff for reconnection
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                const delay = Math.min(30000, 1000 * Math.pow(1.5, reconnectAttempts));
                reconnectAttempts++;
                
                console.log(`⏱️ Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${(delay/1000).toFixed(1)}s...`);
                
                setTimeout(() => {
                    // Only attempt reconnection if the page is visible
                    if (document.visibilityState !== 'hidden') {
                        console.log(`🔄 Attempting reconnection #${reconnectAttempts}...`);
                        subscribeToMessageStream(projectId, onMessageReceived);
                    } else {
                        console.log("📱 Page not visible, delaying reconnection attempt");
                    }
                }, delay);
            } else {
                console.error(`❌ Maximum WebSocket reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Please refresh the page to reconnect.`);
            }
        };

        return socket;
    } catch (error) {
        console.error("❌ Error establishing WebSocket connection:", error);
        return null;
    }
};

/**
 * Closes the WebSocket connection
 */
export const closeMessageStream = () => {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
        console.log("🔌 Closing WebSocket connection");
        socket.close();
    }
    
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
};

/**
 * Retrieves the stored JWT token from localStorage.
 *
 * @returns {string|null} - The stored JWT token or null if not found
 */
export const getAuthToken = () => {
    return localStorage.getItem("token");
};

/**
 * Retrieves the user ID from localStorage.
 *
 * @returns {string|null} - The current user's ID or null if not found
 */
export const getUserId = () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
        console.warn("User ID not found in localStorage.");
    }
    return userId;
};

const messageService = {
    sendMessage,
    fetchProjectMessages,
    fetchMessages,
    sendReply,
    subscribeToMessageStream,
    closeMessageStream,
    getAuthToken,
    getUserId
};

export default messageService;