import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { fetchUserById } from "../services/userService.ts";
import { getUserId } from "../services/authService.ts";
import { fetchMessages, sendMessage, subscribeToMessageStream } from "../services/messageService";
import "../styles/message.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComments, faPaperPlane, faSpinner } from "@fortawesome/free-solid-svg-icons";

const Message = () => {
  const { userId: toUserID, projectId: projectID } = useParams();
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const loggedInUserId = getUserId();
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const messagePollingRef = useRef(null);

  // Load user data
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await fetchUserById(toUserID);
        setUser(userData);
      } catch (error) {
        console.error("❌ Error fetching user:", error);
      }
    };

    loadUser();
  }, [toUserID]);

  // Initial message load and WebSocket setup
  useEffect(() => {
    // Clear any existing polling interval
    if (messagePollingRef.current) {
      clearInterval(messagePollingRef.current);
    }

    const loadMessages = async () => {
      try {
        console.log("🔄 Fetching messages between users:", loggedInUserId, toUserID);
        const fetchedMessages = await fetchMessages(loggedInUserId, toUserID, projectID);
        console.log("✅ Fetched messages:", fetchedMessages.length);
        setMessages(fetchedMessages);
      } catch (error) {
        console.error("❌ Error fetching messages:", error);
        setError("Failed to load messages. Please try again.");
      }
    };

    loadMessages();

    // Set up polling as a backup in case WebSocket fails
    messagePollingRef.current = setInterval(() => {
      loadMessages();
    }, 10000); // Poll every 10 seconds

    // Set up WebSocket
    socketRef.current = subscribeToMessageStream(loggedInUserId, projectID, (newMsg) => {
      console.log("📥 Received WebSocket message:", newMsg);
      // Only add the message if it's relevant to this conversation
      if ((newMsg.fromUserID === loggedInUserId && newMsg.toUserID === toUserID) || 
          (newMsg.fromUserID === toUserID && newMsg.toUserID === loggedInUserId)) {
        setMessages(prevMessages => {
          // Check if message already exists to avoid duplicates
          const msgExists = prevMessages.some(m => 
            m.id === newMsg.id || 
            (m.dateCreated === newMsg.dateCreated && m.message === newMsg.message)
          );
          
          if (msgExists) {
            return prevMessages;
          }
          return [...prevMessages, newMsg];
        });
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.close();
      if (messagePollingRef.current) clearInterval(messagePollingRef.current);
    };
  }, [loggedInUserId, toUserID, projectID]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle sending a message with optimistic update
  const handleSendMessage = async () => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || sending) return;

    // Create message object
    const messageData = {
      message: trimmedMessage,
      fromUserID: loggedInUserId,
      toUserID,
      projectID,
    };

    // Create temporary message for optimistic update
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      id: tempId,
      message: trimmedMessage,
      Message: trimmedMessage,
      fromUserID: loggedInUserId,
      toUserID,
      projectID,
      DateSent: new Date(),
      pending: true
    };

    // Optimistically add message to UI
    setMessages(prevMessages => [...prevMessages, tempMessage]);
    setNewMessage("");
    setError(null);
    setSending(true);

    try {
      // Send message to API
      await sendMessage(messageData);
      console.log("✅ Message sent successfully");
      
      // Replace the temporary message with the real one from server
      const updatedMessages = await fetchMessages(loggedInUserId, toUserID, projectID);
      
      setMessages(updatedMessages);
    } catch (error) {
      console.error("❌ Error sending message:", error);
      
      // Show error and remove pending status from temp message
      setError("Failed to send message. Please try again.");
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === tempId 
            ? { ...msg, pending: false, failed: true } 
            : msg
        )
      );
    } finally {
      setSending(false);
    }
  };

  // Handle retry for failed messages
  const handleRetry = async (failedMsg) => {
    // Remove the failed message
    setMessages(prevMessages => prevMessages.filter(msg => msg.id !== failedMsg.id));
    
    // Reset the message input
    setNewMessage(failedMsg.message || failedMsg.Message);
    
    // Clear error
    setError(null);
  };

  return (
    <div className="message-page">
      <div className="chat-container">
        <h2 className="chat-header">
          <FontAwesomeIcon icon={faComments} /> Chat with {user?.firstName} {user?.lastName}
        </h2>

        <div className="messages-container">
          {error && <div className="error-message">{error}</div>}
          
          {messages.length > 0 ? (
            messages.map((msg, index) => {
              const isSender = msg.fromUserID === loggedInUserId;
              const isPending = !!msg.pending;
              const hasFailed = !!msg.failed;
              
              return (
                <div
                  key={msg.id || index}
                  className={`message-wrapper ${isSender ? "sent-wrapper" : "received-wrapper"}`}
                >
                  <div className={`message ${isSender ? "sent" : "received"} ${isPending ? "pending" : ""} ${hasFailed ? "failed" : ""}`}>
                    <p className="message-text">{msg.message || msg.Message}</p>
                    <div className="message-meta">
                      {isPending && (
                        <span className="message-status">
                          <FontAwesomeIcon icon={faSpinner} spin /> Sending...
                        </span>
                      )}
                      {hasFailed && (
                        <span className="message-status failed" onClick={() => handleRetry(msg)}>
                          Failed to send. Click to retry.
                        </span>
                      )}
                      <span className="message-time">
                        {msg.DateSent ? new Date(msg.DateSent).toLocaleTimeString() : "Invalid Date"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="no-messages">No messages yet.</p>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="message-input">
          <input
            type="text"
            className="form-control"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            disabled={sending}
          />
          <button 
            className={`btn btn-primary ${sending ? "sending" : ""}`} 
            onClick={handleSendMessage}
            disabled={sending || !newMessage.trim()}
          >
            {sending ? (
              <>Sending <FontAwesomeIcon icon={faSpinner} spin /></>
            ) : (
              <>Send <FontAwesomeIcon icon={faPaperPlane} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Message;
