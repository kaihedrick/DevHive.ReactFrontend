// MessageService.js
// This module handles message-related API calls and WebSocket communication for real-time messaging in DevHive.

import axios from "axios";
// Import the centralized config
import { API_BASE_URL } from '../config';

// Use the imported base URL
const MESSAGE_API_URL = `${API_BASE_URL}/Message`;

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let heartbeatInterval = null;

/**
 * Sends a new message to the backend.
 *
 * @param {Object} message - The message object containing user and project data.
 * @param {string} message.message - The text content of the message.
 * @param {string} message.fromUserID - The sender's user ID.
 * @param {string} message.toUserID - The recipient's user ID.
 * @param {string} message.projectID - The project context for the message.
 * @returns {Promise<Object>} - The response object from the backend.
 * @throws {Error} - Throws an error if the request fails.
 */
// In src/services/messageService.js
export const sendMessage = async (message) => {
    try {
        const token = getAuthToken();
        const payload = {
            Message: message.message,
            FromUserID: message.fromUserID,
            ToUserID: message.toUserID,
            ProjectID: message.projectID,
        };

        console.log("📤 Sending message:", payload);

        const response = await axios.post(`${MESSAGE_API_URL}/Send`, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });

        console.log("✅ Message sent successfully:", response.data);
        return response.data;
    } catch (error) {
        // More detailed error logging
        console.error("❌ Error sending message:", error.response?.status, error.response?.data || error.message);
        
        // More user-friendly error message based on status code
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
 * Fetches messages exchanged between two users in a given project.
 *
 * @param {string} fromUserID - Sender user ID.
 * @param {string} toUserID - Receiver user ID.
 * @param {string} projectID - Project ID in which the messages exist.
 * @returns {Promise<Array>} - An array of processed message objects.
 * @throws {Error} - Throws an error if fetching messages fails.
 */

export const fetchMessages = async (fromUserID, toUserID, projectID) => {
    try {
        const token = getAuthToken();
        const apiUrl = `${MESSAGE_API_URL}/Retrieve/${encodeURIComponent(fromUserID)}/${encodeURIComponent(toUserID)}/${encodeURIComponent(projectID)}`;

        const response = await axios.get(apiUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });

        const processedMessages = response.data.map(msg => {
            const tsObj = msg.dateSent ?? msg.DateSent;
            return {
                ...msg,
                DateSent: convertFirestoreTimestamp(tsObj)
            };
        });

        return processedMessages;
    } catch (error) {
        if (error.response?.status === 404) {
            return [];
        }
        console.error("Error retrieving messages:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Converts a Firestore timestamp or other common timestamp formats to a JavaScript Date object.
 *
 * @param {Object|string|Date} timestamp - The timestamp to convert.
 * @returns {Date} - A JavaScript Date object.
 */

const convertFirestoreTimestamp = (timestamp) => {
    if (!timestamp) return new Date();

    const secs = timestamp.seconds ?? timestamp.Seconds ?? timestamp._seconds ?? 0;
    const nanos = timestamp.nanoseconds ?? timestamp.Nanoseconds ?? timestamp._nanoseconds ?? 0;

    if (secs) return new Date(secs * 1000 + nanos / 1e6);
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (timestamp instanceof Date) return timestamp;
    return new Date();
};

/**
 * Sends a heartbeat message to the server to keep the WebSocket connection alive.
 *
 * @param {WebSocket} ws - The WebSocket connection instance.
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

// Helper function to build WebSocket URL
const buildWebSocketUrl = (userId) => {
    if (!userId) {
        console.error("❌ Missing userId for WebSocket URL");
        return null;
    }

    // Always use secure WebSocket (wss) for production
    const host = process.env.REACT_APP_API_HOST || 'api.devhive.it.com';
    
    // Format URL in the required pattern: wss://your-domain/ws/messages?userId={userId}
    const wsUrl = `wss://${host}/ws/messages?userId=${userId}`;
    
    console.log(`🔌 Configured WebSocket URL: ${wsUrl}`);
    return wsUrl;
};

/**
 * Subscribes a user to a WebSocket message stream for real-time updates.
 *
 * @param {string} userId - The ID of the user subscribing to messages.
 * @param {string} projectID - The ID of the current project.
 * @param {Function} onMessageReceived - Callback to invoke when a new message is received.
 * @returns {WebSocket|null} - The WebSocket instance or null if connection fails.
 */
export const subscribeToMessageStream = (userId, projectID, onMessageReceived) => {
    if (!userId || !projectID) {
        console.error("❌ Missing userId or projectID for WebSocket.");
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
        const wsUrl = buildWebSocketUrl(userId);
        
        console.log(`🔌 Connecting to WebSocket at: ${wsUrl}`);
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log(`✅ WebSocket connection established for user ${userId} in project ${projectID}`);
            // Reset reconnect attempts on successful connection
            reconnectAttempts = 0;
            
            // Send initialization message
            try {
                socket.send(JSON.stringify({ 
                    type: "init", 
                    userId: userId, 
                    projectId: projectID 
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
                
                // Handle camel case / pascal case field names
                const tsObj = message.dateSent ?? message.DateSent;
                
                // Convert Firestore timestamp to JS Date
                if (tsObj) {
                    message.DateSent = convertFirestoreTimestamp(tsObj);
                }

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
                        subscribeToMessageStream(userId, projectID, onMessageReceived);
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
 * Retrieves the stored JWT token from localStorage.
 *
 * @returns {string|null} - The stored JWT token or null if not found.
 */
export const getAuthToken = () => {
  return localStorage.getItem("token");
};

/**
 * Retrieves the user ID from localStorage.
 *
 * @returns {string|null} - The current user's ID or null if not found.
 */
export const getUserId = () => {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    console.warn("User ID not found in localStorage.");
  }
  return userId;
};
