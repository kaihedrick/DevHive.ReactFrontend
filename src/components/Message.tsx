import React, { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useMessages } from "../hooks/useMessages.ts";
import { useUser } from "../hooks/useUsers.ts";
import { User, Message as MessageType } from "../types/hooks.ts";
import { useAutoResizeTextarea } from "../hooks/useAutoResizeTextarea.ts";
import "../styles/message.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane, faSpinner } from "@fortawesome/free-solid-svg-icons";

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
  
  // Use cached user hook instead of direct fetch - caches for 2 minutes
  const { data: userData, isLoading: userLoading, error: userError } = useUser(toUserID);
  
  // Debug: Log raw userData to see what we're getting from the API
  // CRITICAL FIX: Backend returns camelCase (firstName), not PascalCase (FirstName)
  useEffect(() => {
    if (userData) {
      console.log('📋 Raw userData from API:', userData);
      console.log('✅ firstName (camelCase - used):', (userData as any).firstName);
      console.log('✅ lastName (camelCase - used):', (userData as any).lastName);
      console.log('✅ username (camelCase - used):', (userData as any).username);
      // Backward compatibility check: PascalCase (legacy, should be undefined)
      console.log('ℹ️ FirstName (PascalCase - legacy check, expected undefined):', userData.FirstName);
      console.log('ℹ️ LastName (PascalCase - legacy check, expected undefined):', userData.LastName);
      console.log('ℹ️ Username (PascalCase - legacy check, expected undefined):', userData.Username);
    }
  }, [userData]);
  
  // Convert UserModel to User type for compatibility
  // CRITICAL FIX: Backend returns camelCase, prioritize camelCase over PascalCase
  const user: User | null = userData ? {
    id: (userData as any).id || userData.ID || '',
    username: (userData as any).username || userData.Username || '',
    email: (userData as any).email || userData.Email || '',
    firstName: ((userData as any).firstName || userData.FirstName || '').trim(),
    lastName: ((userData as any).lastName || userData.LastName || '').trim(),
    avatarUrl: undefined // UserModel doesn't have avatarUrl
  } : null;

  // Get display name for header - check for non-empty strings
  const displayName = user 
    ? (user.firstName && user.lastName && user.firstName.length > 0 && user.lastName.length > 0
        ? `${user.firstName} ${user.lastName}`
        : (user.firstName && user.firstName.length > 0) 
          ? user.firstName
          : (user.lastName && user.lastName.length > 0)
            ? user.lastName
            : (user.username && user.username.length > 0)
              ? user.username
              : 'Unknown User')
    : userLoading 
      ? 'Loading...'
      : 'Unknown User';

  // Use the TypeScript hook for project-wide messaging
  // Architecture: Messages are fetched via REST API and updated via WebSocket cache invalidation
  const {
    messages,
    newMessage,
    setNewMessage,
    handleSendMessage,
    messagesEndRef,
    sending,
    loggedInUserId
  } = useMessages(projectID);
  
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

  // User data is now handled by the cached useUser hook

  /**
   * useEffect - Auto Scroll on Message Update
   *
   * Automatically scrolls to the bottom of the message list when a new message arrives
   *
   * @dependencies [messages]
   */
  useEffect(() => {
    // Scroll to bottom when messages change
    const timer = setTimeout(() => {
      // Use block: "end" to ensure we scroll all the way to the bottom
      // Use inline: "nearest" to only scroll the immediate scroll container (.message-list)
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Scroll to bottom on initial mount
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        // Use block: "end" to ensure we scroll all the way to the bottom
        // Use inline: "nearest" to only scroll the immediate scroll container (.message-list)
        messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end", inline: "nearest" });
      }, 100);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);


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

  if (userLoading) {
    return (
      <div className="message-container with-footer-pad scroll-pad-bottom">
        <div className="loading-message">
          <FontAwesomeIcon icon={faSpinner} spin />
          <p>Loading user information...</p>
        </div>
      </div>
    );
  }

  if (userError || !user) {
    return (
      <div className="message-container with-footer-pad scroll-pad-bottom">
        <div className="error-message">
          <h2>User Not Found</h2>
          <p>Unable to load user information. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="message-container with-footer-pad scroll-pad-bottom">
      <div className="message-header">
        <div className="user-info">
          <h2>{displayName}</h2>
        </div>
      </div>

      <div className="message-list">
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          (() => {
            // Sort messages oldest → newest
            const orderedMessages = [...messages].sort((a, b) => {
              const getTime = (dateTime: any): number => {
                if (dateTime instanceof Date) {
                  return dateTime.getTime();
                }
                if (typeof dateTime === "string") {
                  return new Date(dateTime).getTime();
                }
                if (dateTime && typeof dateTime === "object" && 'seconds' in dateTime) {
                  return (dateTime as { seconds: number }).seconds * 1000;
                }
                return 0;
              };

              const ta = getTime(a.createdAt);
              const tb = getTime(b.createdAt);

              return ta - tb; // oldest -> newest
            });

            return orderedMessages.map((message: MessageType) => (
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
            ));
          })()
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="message-input">
        <textarea
          ref={messageTextareaRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Message"
          className="message-textarea"
          disabled={sending}
          rows={1}
          style={{ resize: 'none', overflow: 'hidden' }}
        />
        <button
          onClick={handleSendMessage}
          disabled={!newMessage.trim() || sending}
          className="send-button"
          aria-label="Send message"
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
