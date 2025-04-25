// MessageService.js
// This module handles message-related API calls and WebSocket communication for real-time messaging in DevHive.

import axios from "axios";

// Base URL for REST API message endpoints. For production use, move to environment config.
const API_BASE_URL = "http://18.119.104.29:5000/api/Message"; 
const API_HOST = "18.119.104.29:5000"; // Host used for WebSocket connection

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
export const sendMessage = async (message) => {
    try {
        const token = getAuthToken();
        const payload = {
            Message: message.message,
            FromUserID: message.fromUserID,
            ToUserID: message.toUserID,
            ProjectID: message.projectID,
        };

        const response = await axios.post(`${API_BASE_URL}/Send`, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });

        return response.data;
    } catch (error) {
        console.error("Error sending message:", error.response?.data || error.message);
        throw error;
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
        const apiUrl = `${API_BASE_URL}/Retrieve/${encodeURIComponent(fromUserID)}/${encodeURIComponent(toUserID)}/${encodeURIComponent(projectID)}`;

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
        ws.send(JSON.stringify({ type: "ping" }));
    }
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
        console.error("Missing userId or projectID for WebSocket.");
        return null;
    }

    if (socket && socket.readyState !== WebSocket.CLOSED) {
        socket.close();
    }
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }

    try {
        const scheme = window.location.protocol === "https:" ? "wss" : "ws";
        const host = API_HOST;
        const wsUrl = `${scheme}://${host}/ws/messages?userId=${userId}`;
        
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            reconnectAttempts = 0;
            socket.send(JSON.stringify({ type: "init", userId, projectId: projectID }));
            heartbeatInterval = setInterval(() => sendHeartbeat(socket), 30000);
        };

        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === "pong") return;
                if (message.DateSent) {
                    message.DateSent = convertFirestoreTimestamp(message.DateSent);
                }
                onMessageReceived(message);
            } catch (error) {
                console.error("Error parsing WebSocket message:", error);
            }
        };

        socket.onerror = (error) => {
            console.error("WebSocket error:", error);
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        };

        socket.onclose = (event) => {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
            
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                const delay = Math.min(30000, 1000 * Math.pow(1.5, reconnectAttempts));
                reconnectAttempts++;
                
                setTimeout(() => {
                    if (document.visibilityState !== 'hidden') {
                        subscribeToMessageStream(userId, projectID, onMessageReceived);
                    }
                }, delay);
            }
        };

        return socket;
    } catch (error) {
        console.error("Error establishing WebSocket connection:", error);
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
