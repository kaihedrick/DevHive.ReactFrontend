import axios from "axios";

// API base URL for HTTP requests
const API_BASE_URL = "http://18.119.104.29:5000/api/Message"; 
const API_HOST = "18.119.104.29:5000"; // Extract just the host for WebSocket use

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let heartbeatInterval = null;

// Function to send a new message
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

        const response = await axios.post(`${API_BASE_URL}/Send`, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });

        console.log("✅ Message sent successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error sending message:", error.response?.data || error.message);
        throw error;
    }
};

// Function to retrieve messages between two users within a project
export const fetchMessages = async (fromUserID, toUserID, projectID) => {
    try {
        const token = getAuthToken();
        const apiUrl = `${API_BASE_URL}/Retrieve/${encodeURIComponent(fromUserID)}/${encodeURIComponent(toUserID)}/${encodeURIComponent(projectID)}`;
        console.log("📩 Fetching messages from API:", apiUrl);

        const response = await axios.get(apiUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });

        console.log("✅ Retrieved messages:", response.data);
        
        // Log the first message to inspect field names
        if (response.data.length > 0) {
            console.log("📥 Raw message sample:", response.data[0]);
        }

        // Convert Firestore timestamps to JavaScript Date objects
        const processedMessages = response.data.map(msg => {
            // First pick whichever timestamp field exists (camel or pascal case)
            const tsObj = msg.dateSent ?? msg.DateSent;
            
            return {
                ...msg,
                // Normalize to a JS Date and store in a consistent field name
                DateSent: convertFirestoreTimestamp(tsObj)
            };
        });
        
        return processedMessages;
    } catch (error) {
        if (error.response?.status === 404) {
            console.warn("⚠️ No messages found, initializing an empty chat.");
            return [];
        }
        console.error("❌ Error retrieving messages:", error.response?.data || error.message);
        throw error;
    }
};

// Helper function to convert Firestore timestamp to JS Date
const convertFirestoreTimestamp = (timestamp) => {
    // Handle null/undefined case
    if (!timestamp) return new Date();
    
    // Firestore Timestamps from JSON usually come as { seconds, nanoseconds }
    const secs = timestamp.seconds
              ?? timestamp.Seconds
              ?? timestamp._seconds
              ?? 0;
    const nanos = timestamp.nanoseconds
               ?? timestamp.Nanoseconds
               ?? timestamp._nanoseconds
               ?? 0;
              
    // Convert to JS Date
    if (secs) {
        return new Date(secs * 1000 + nanos / 1e6);
    }
    
    // Check if it's already an ISO string
    if (typeof timestamp === 'string') {
        return new Date(timestamp);
    }
    
    // If it's already a Date object, return it
    if (timestamp instanceof Date) {
        return timestamp;
    }
    
    // Return current date as fallback
    return new Date();
};

// Ping function to keep the WebSocket connection alive
const sendHeartbeat = (ws) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
        console.log("💓 Sent heartbeat to WebSocket server");
    }
};

// Function to subscribe to real-time messages via WebSocket with improved connection handling
export const subscribeToMessageStream = (userId, projectID, onMessageReceived) => {
    if (!userId || !projectID) {
        console.error("❌ Missing userId or projectID for WebSocket.");
        return null;
    }

    // Close existing socket and clear intervals if any
    if (socket && socket.readyState !== WebSocket.CLOSED) {
        socket.close();
    }
    
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }

    try {
        // Use dynamic protocol based on current page protocol
        const scheme = window.location.protocol === "https:" ? "wss" : "ws";
        
        // For development, use the hardcoded host
        // In production, you could use window.location.host
        const host = API_HOST;
        
        const wsUrl = `${scheme}://${host}/ws/messages?userId=${userId}`;
        console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
        
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log(`✅ Connected to WebSocket for user ${userId} in project: ${projectID}`);
            reconnectAttempts = 0; // Reset reconnect attempts on successful connection
            
            // Send initial message to keep connection open
            socket.send(JSON.stringify({ 
                type: "init",
                userId: userId,
                projectId: projectID
            }));
            
            // Set up regular heartbeat to prevent server from closing the connection
            heartbeatInterval = setInterval(() => sendHeartbeat(socket), 30000); // Every 30 seconds
        };

        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                
                // Ignore heartbeat responses
                if (message.type === "pong") {
                    console.log("💓 Received heartbeat response from server");
                    return;
                }
                
                // Convert the Firestore timestamp to a JavaScript Date
                if (message.DateSent) {
                    message.DateSent = convertFirestoreTimestamp(message.DateSent);
                }

                console.log("📨 New real-time message received:", message);
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
            console.warn(`❌ WebSocket closed (Code: ${event.code}). ${reconnectAttempts < MAX_RECONNECT_ATTEMPTS ? 'Reconnecting soon...' : 'Max reconnect attempts reached.'}`);
            
            // Clear heartbeat on close
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
                heartbeatInterval = null;
            }
            
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                // Exponential backoff for reconnection attempts
                const delay = Math.min(30000, 1000 * Math.pow(1.5, reconnectAttempts));
                reconnectAttempts++;
                
                console.log(`⏱️ Reconnecting in ${(delay/1000).toFixed(1)}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                
                setTimeout(() => {
                    // Only attempt reconnection if the page is visible
                    if (document.visibilityState !== 'hidden') {
                        subscribeToMessageStream(userId, projectID, onMessageReceived);
                    }
                }, delay);
            } else {
                console.error("❌ Maximum WebSocket reconnection attempts reached. Please refresh the page to reconnect.");
            }
        };

        return socket;
    } catch (error) {
        console.error("❌ Error establishing WebSocket connection:", error);
        return null;
    }
};

// Utility function to get JWT token
export const getAuthToken = () => {
  return localStorage.getItem("token");
};

// Utility function to get stored user ID
export const getUserId = () => {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    console.warn("Warning: User ID not found in localStorage.");
  }
  return userId;
};
