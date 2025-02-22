import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { fetchUserById } from "../services/userService";
import { fetchMessages, sendMessage, subscribeToMessageStream } from "../services/messageService";
import { getUserId } from "../services/authService"; // ✅ Import authService
import "../styles/chat.css";  // ✅ Add a CSS file for styling

const Message = () => {
  const { userId, projectId } = useParams();
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const loggedInUserId = getUserId(); // ✅ Get authenticated user ID
  const messagesEndRef = useRef(null); // ✅ Auto-scroll ref

  useEffect(() => {
    const loadUserAndMessages = async () => {
      try {
        const userData = await fetchUserById(userId);
        setUser(userData);

        const messagesData = await fetchMessages(loggedInUserId, userId, projectId);
        setMessages(messagesData);
      } catch (error) {
        console.error("❌ Error fetching user or messages:", error);
      }
    };

    loadUserAndMessages();

    // ✅ Subscribe to WebSocket for real-time messages
    const socket = subscribeToMessageStream(loggedInUserId, projectId, (newMsg) => {
      setMessages((prevMessages) => [...prevMessages, newMsg]);
    });

    return () => {
      if (socket) socket.close();
    };
  }, [userId, projectId, loggedInUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); // ✅ Auto-scroll to bottom
  }, [messages]);

  const handleSendMessage = async () => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage) return;

    const messageData = {
        message: trimmedMessage,
        fromUserID: loggedInUserId,
        toUserID: userId,
        projectID: projectId,
    };

    console.log("📤 Sending message:", messageData);

    try {
        // ✅ Send the message to the backend and wait for confirmation
        await sendMessage(messageData);

        // ✅ Once confirmed, re-fetch messages to ensure up-to-date chat history
        const updatedMessages = await fetchMessages(loggedInUserId, userId, projectId);
        setMessages(updatedMessages);

        // ✅ Clear input after sending
        setNewMessage("");
    } catch (error) {
        console.error("❌ Error sending message:", error);
    }
};


  return (
    <div className="chat-container">
      <h2 className="chat-header">💬 Chat with {user?.firstName} {user?.lastName}</h2>

      <div className="messages-container">
        {messages.length > 0 ? (
          messages.map((msg, index) => {
            const isSender = msg.fromUserID === loggedInUserId; // ✅ Correctly check sender
            return (
              <div 
                key={index} 
                className={`message-wrapper ${isSender ? "sent-wrapper" : "received-wrapper"}`}
              >
                <div className={`message ${isSender ? "sent" : "received"}`}>
                  <p className="message-text">{msg.message || msg.Message}</p>
                  <span className="message-time">
                    {msg.DateSent ? new Date(msg.DateSent).toLocaleTimeString() : "Invalid Date"}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <p className="no-messages">No messages yet.</p>
        )}
        <div ref={messagesEndRef} />  {/* ✅ Auto-scroll target */}
      </div>

      <div className="message-input">
        <input
          type="text"
          className="form-control"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button className="btn btn-primary" onClick={handleSendMessage}>Send</button>
      </div>
    </div>
  );
};

export default Message;
