import { useState, useEffect, useRef } from "react";
import { fetchMessages, sendMessage, subscribeToMessageStream } from "../services/messageService";
import { getUserId } from "../services/authService.ts";

// Explicitly define the function with a function declaration
function useMessages(toUserID, projectID) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const loggedInUserId = getUserId();
  const messagesEndRef = useRef(null);

  // Fetch messages on mount and subscribe to real-time updates
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const fetchedMessages = await fetchMessages(loggedInUserId, toUserID, projectID);
        setMessages(fetchedMessages);
      } catch (error) {
        console.error("❌ Error fetching messages:", error);
      }
    };

    loadMessages();

    const socket = subscribeToMessageStream(loggedInUserId, projectID, (newMsg) => {
      setMessages((prevMessages) => [...prevMessages, newMsg]);
    });

    return () => {
      if (socket) socket.close();
    };
  }, [loggedInUserId, toUserID, projectID]);

  // Auto-scroll to the bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle sending a new message
  const handleSendMessage = async () => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage) return;

    const messageData = {
      message: trimmedMessage,
      fromUserID: loggedInUserId,
      toUserID,
      projectID,
    };

    try {
      await sendMessage(messageData);
      const updatedMessages = await fetchMessages(loggedInUserId, toUserID, projectID);
      setMessages(updatedMessages);
      setNewMessage("");
    } catch (error) {
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
}

// Make sure there's a clear default export
export default useMessages;