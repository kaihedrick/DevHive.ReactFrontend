import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { fetchUserById } from "../services/userService.ts";
import { getUserId } from "../services/authService.ts";
import { fetchMessages, sendMessage, subscribeToMessageStream } from "../services/messageService";
import "../styles/message.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComments, faPaperPlane, faSpinner } from "@fortawesome/free-solid-svg-icons";
/**
 * Message Component
 * 
 * Handles peer-to-peer messaging within a project context.
 * Supports real-time message updates via WebSocket and optimistic UI updates.
 * 
 * @returns {JSX.Element} Rendered chat interface
 */
const Message = () => {
  /**
   * useParams
   * 
   * Extracts `userId` and `projectId` from route parameters for context-aware messaging
   */
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

  /**
   * formatMessageTime
   * 
   * Converts various datetime formats (Firestore, ISO string, Date) into a human-readable string
   * Used for displaying message timestamps
   * 
   * @param {Date | string | object} dateTime - The original timestamp value
   * @returns {string} Formatted timestamp
   */
  const formatMessageTime = (dateTime) => {
    // First ensure we're working with a valid date
    let date;
    
    if (dateTime instanceof Date) {
      date = dateTime;
    } else if (typeof dateTime === 'object' && dateTime.seconds) {
      // Firestore Timestamp format
      date = new Date(dateTime.seconds * 1000 + (dateTime.nanoseconds || 0) / 1000000);
    } else if (typeof dateTime === 'string') {
      date = new Date(dateTime);
    } else {
      // Fallback to current time
      return "Just now";
    }
    
    if (isNaN(date.getTime())) {
      console.warn("⚠️ Invalid date:", dateTime);
      return "Just now";
    }
    
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    // For messages from today, just show the time
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // For older messages, show date and time
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  /**
   * useEffect - Load Recipient User
   * 
   * Fetches recipient user data using the provided user ID when component mounts
   * 
   * @dependencies [toUserID]
   */
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

  /**
   * useEffect - Initial Message Load and Real-Time Subscription
   * 
   * Fetches initial message history and subscribes to new messages via WebSocket.
   * Also sets up a fallback polling interval every 10 seconds.
   * 
   * @dependencies [loggedInUserId, toUserID, projectID]
   */
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

  /**
   * useEffect - Auto Scroll on Message Update
   * 
   * Automatically scrolls to the bottom of the message list when a new message arrives
   * 
   * @dependencies [messages]
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * handleSendMessage
   * 
   * Sends a message using optimistic UI updates.
   * Displays a pending message in the UI until the backend confirms receipt.
   * 
   * @returns {Promise<void>}
   */
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
    const now = new Date();
    const tempMessage = {
      id: tempId,
      message: trimmedMessage,
      Message: trimmedMessage,
      fromUserID: loggedInUserId,
      toUserID,
      projectID,
      DateSent: now, // Use consistent date object format
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

  /**
   * handleRetry
   * 
   * Allows retrying failed messages by restoring their text into the input field
   * 
   * @param {Object} failedMsg - The message object that failed to send
   * @returns {void}
   */
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
      {/* Chat header positioned absolutely under navbar */}
      <div className="chat-header-absolute">
        <h2 className="chat-header-title">
          <FontAwesomeIcon icon={faComments} /> Chat with {user?.firstName} {user?.lastName}
        </h2>
      </div>

      {/* Main chat container */}
      <div className="chat-container">
        {/* Scrollable messages container */}
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
                        {msg.DateSent ? formatMessageTime(msg.DateSent instanceof Date ? msg.DateSent : new Date(msg.DateSent)) : "Just now"}
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

        {/* Message input - always above footer */}
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
          {/* Send button - hidden on mobile */}
          <button 
            className={`btn btn-primary send-button ${sending ? "sending" : ""}`} 
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
