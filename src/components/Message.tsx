import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { fetchUserById } from "../services/userService";
import { getUserId } from "../services/authService";
import useMessages from "../hooks/useMessages.js";
import { User, Message as MessageType } from "../types/hooks.ts";
import { useAutoResizeTextarea } from "../hooks/useAutoResizeTextarea.ts";
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
const Message: React.FC = () => {
  /**
   * useParams
   * 
   * Extracts `userId` and `projectId` from route parameters for context-aware messaging
   */
  const { userId: toUserID, projectId: projectID } = useParams<{ userId: string; projectId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const loggedInUserId = getUserId();
  
  // Use the new TypeScript hook
  const { messages, newMessage, setNewMessage, handleSendMessage, messagesEndRef } = useMessages(toUserID || '', projectID || '');
  
  // Auto-resize textarea for message input
  const messageTextareaRef = useAutoResizeTextarea(newMessage, 1);

  /**
   * formatMessageTime
   * 
   * Converts various datetime formats (Firestore, ISO string, Date) into a human-readable string
   * Used for displaying message timestamps
   * 
   * @param {Date | string | object} dateTime - The original timestamp value
   * @returns {string} Formatted timestamp
   */
  const formatMessageTime = (dateTime: Date | string | any): string => {
    // First ensure we're working with a valid date
    let date: Date;
    
    if (dateTime instanceof Date) {
      date = dateTime;
    } else if (typeof dateTime === 'object' && dateTime.seconds) {
      // Firestore Timestamp format
      date = new Date(dateTime.seconds * 1000);
    } else if (typeof dateTime === 'string') {
      date = new Date(dateTime);
    } else {
      console.warn('Unknown date format:', dateTime);
      return 'Unknown time';
    }
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', dateTime);
      return 'Invalid time';
    }
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    // Less than 1 minute
    if (diffInSeconds < 60) {
      return 'Just now';
    }
    
    // Less than 1 hour
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    }
    
    // Less than 24 hours
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    }
    
    // More than 24 hours - show date
    return date.toLocaleDateString();
  };

  /**
   * useEffect - Load Recipient User
   * 
   * Fetches recipient user data using the provided user ID when component mounts
   * 
   * @dependencies [toUserID]
   */
  useEffect(() => {
    const loadUser = async (): Promise<void> => {
      try {
        const userData = await fetchUserById(toUserID || '');
        setUser(userData);
      } catch (error: any) {
        console.error("❌ Error fetching user:", error);
      }
    };

    if (toUserID) {
      loadUser();
    }
  }, [toUserID]);

  // Messages are now handled by the useMessages hook

  /**
   * useEffect - Auto Scroll on Message Update
   * 
   * Automatically scrolls to the bottom of the message list when a new message arrives
   * 
   * @dependencies [messages]
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, messagesEndRef]);


  /**
   * handleKeyPress
   * 
   * Handles Enter key press for sending messages
   * 
   * @param {React.KeyboardEvent} e - Keyboard event
   */
  const handleKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!toUserID || !projectID) {
    return (
      <div className="message-container with-footer-pad scroll-pad-bottom">
        <div className="error-message">
          <h2>Invalid Message Parameters</h2>
          <p>Please ensure you have a valid user ID and project ID in the URL.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="message-container with-footer-pad scroll-pad-bottom">
        <div className="loading-message">
          <FontAwesomeIcon icon={faSpinner} spin />
          <p>Loading user information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="message-container with-footer-pad scroll-pad-bottom">
      <div className="message-header">
        <div className="user-info">
          <FontAwesomeIcon icon={faComments} />
          <h2>Chat with {user.firstName} {user.lastName}</h2>
        </div>
      </div>

      <div className="message-list">
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message: MessageType) => (
            <div
              key={message.id}
              className={`message-item ${
                message.userId === loggedInUserId ? 'sent' : 'received'
              }`}
            >
              <div className="message-content">
                <p>{message.content}</p>
                <span className="message-time">
                  {formatMessageTime(message.createdAt)}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>


      <div className="message-input">
        <textarea
          ref={messageTextareaRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          className="message-textarea"
          disabled={sending}
          rows={1}
          style={{ resize: 'none', overflow: 'hidden' }}
        />
        <button
          onClick={handleSendMessage}
          disabled={!newMessage.trim() || sending}
          className="send-button"
        >
          {sending ? (
            <FontAwesomeIcon icon={faSpinner} spin />
          ) : (
            <FontAwesomeIcon icon={faPaperPlane} />
          )}
        </button>
      </div>
    </div>
  );
};

export default Message;
