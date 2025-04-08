import axios from "axios";

const API_BASE_URL = "https://localhost:7170/api/Message"; 
let socket = null;
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

        console.log(" Message sent successfully:", response.data);
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

        // Convert timestamps to JavaScript Date objects
        return response.data.map(msg => ({
            ...msg,
            DateSent: msg.DateSent ? new Date(msg.DateSent) : new Date()
        }));
    } catch (error) {
        if (error.response?.status === 404) {
            console.warn("⚠️ No messages found, initializing an empty chat.");
            return [];
        }
        console.error("❌ Error retrieving messages:", error.response?.data || error.message);
        throw error;
    }
};

  
  

// Function to subscribe to real-time messages via WebSocket
// establish WebSocket connection
export const subscribeToMessageStream = (userId, projectID, onMessageReceived) => {
    if (!userId || !projectID) {
      console.error("❌ Missing userId or projectID for WebSocket.");
      return;
    }

    const wsUrl = `wss://localhost:7170/ws/messages?userId=${userId}`;
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log(`🔗 Connected to WebSocket for user ${userId} in project: ${projectID}`);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // ✅ Convert Firestore timestamp to JS Date
        message.DateSent = message.DateSent && message.DateSent.seconds 
                           ? new Date(message.DateSent.seconds * 1000) 
                           : new Date();

        console.log("📨 New real-time message received:", message);
        onMessageReceived(message);
      } catch (error) {
        console.error("❌ Error parsing WebSocket message:", error);
      }
    };

    socket.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
    };

    socket.onclose = () => {
      console.warn("❌ WebSocket closed. Reconnecting in 3s...");
      setTimeout(() => subscribeToMessageStream(userId, projectID, onMessageReceived), 3000);
    };

    return socket;
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
