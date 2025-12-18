import { useState, useEffect, useRef } from "react";
import { fetchProjectMessages, sendMessage, subscribeToMessageStream } from "../services/messageService";
import { getUserId } from "../services/authService";
import { UseMessagesReturn, Message } from "../types/hooks.ts";

/**
 * useMessages
 *
 * Custom React hook for managing messaging state and real-time updates within a project.
 *
 * @param {string} toUserID - ID of the recipient user.
 * @param {string} projectID - ID of the current project.
 * @returns {UseMessagesReturn} Messaging state and handlers.
 */
const useMessages = (toUserID: string, projectID: string): UseMessagesReturn => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>("");
  const loggedInUserId = getUserId();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages on mount and subscribe to real-time updates
  useEffect(() => {
    const loadMessages = async (): Promise<void> => {
      try {
        const response = await fetchProjectMessages(projectID, { limit: 50, offset: 0 });
        setMessages(response.messages || []);
      } catch (error: any) {
        console.error("❌ Error fetching messages:", error);
      }
    };

    loadMessages();

    const socket = subscribeToMessageStream(projectID, (newMsg: Message) => {
      setMessages((prevMessages) => [...prevMessages, newMsg]);
    });

    return () => {
      if (socket) socket.close();
    };
  }, [projectID]);

  // Auto-scroll to the bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle sending a new message
  const handleSendMessage = async (): Promise<void> => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage) return;

    try {
      await sendMessage({
        projectId: projectID,
        content: trimmedMessage,
        messageType: "text"
      });
      
      // Refresh messages after sending
      const response = await fetchProjectMessages(projectID, { limit: 50, offset: 0 });
      setMessages(response.messages || []);
      setNewMessage("");
    } catch (error: any) {
      console.error("❌ Error sending message:", error);
    }
  };

  return {
    messages,
    newMessage,
    setNewMessage,
    handleSendMessage,
    messagesEndRef,
  };
};

export default useMessages;
