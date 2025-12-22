/**
 * MessageService.js
 *
 * This module handles message-related REST API calls for DevHive.
 *
 * Architecture (per REALTIME_MESSAGING_ARCHITECTURE.md):
 * - Messages are sent via REST API (POST /api/v1/projects/{projectId}/messages)
 * - Backend broadcasts cache_invalidate via WebSocket to all project members
 * - Frontend receives cache_invalidate and refetches messages via React Query
 * - WebSocket connection is managed by cacheInvalidationService.ts
 */

import { api } from '../lib/apiClient.ts';
import { ENDPOINTS } from '../config';

/**
 * Sends a new message to a project.
 *
 * @param {Object} messageData - The message data
 * @param {string} messageData.projectId - The project ID
 * @param {string} messageData.content - The message content
 * @param {string} [messageData.messageType] - The message type (default: "text")
 * @param {string} [messageData.parentMessageId] - Parent message ID for replies
 * @returns {Promise<Object>} - The response object from the backend
 * @throws {Error} - Throws an error if the request fails
 */
export const sendMessage = async (messageData) => {
    try {
        const payload = {
            content: messageData.content,
            messageType: messageData.messageType || "text",
            ...(messageData.parentMessageId && { parentMessageId: messageData.parentMessageId })
        };

        console.log("📤 Sending message:", payload);

        const response = await api.post(`${ENDPOINTS.PROJECTS}/${messageData.projectId}/messages`, payload);

        console.log("✅ Message sent successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error sending message:", error.response?.status, error.response?.data || error.message);

        if (error.response?.status === 500) {
            throw new Error("Server error - The messaging service is currently unavailable. Our team has been notified.");
        } else if (error.response?.status === 401 || error.response?.status === 403) {
            throw new Error("Authentication error - Please try logging out and back in.");
        } else {
            throw new Error(`Failed to send message: ${error.response?.data?.message || error.message}`);
        }
    }
};

/**
 * Fetches messages for a specific project with pagination.
 *
 * @param {string} projectId - The project ID
 * @param {Object} [options] - Pagination options
 * @param {number} [options.limit] - Number of messages to fetch (default: 20, max: 100)
 * @param {number} [options.offset] - Number of messages to skip (default: 0)
 * @returns {Promise<Object>} - Object containing messages array and pagination info
 * @throws {Error} - Throws an error if fetching messages fails
 */
export const fetchProjectMessages = async (projectId, options = {}) => {
    try {
        const params = {
            limit: options.limit || 20,
            offset: options.offset || 0
        };

        console.log(`📡 Fetching messages for project ${projectId}:`, params);

        const response = await api.get(`${ENDPOINTS.PROJECTS}/${projectId}/messages`, { params });

        console.log("✅ Messages fetched successfully:", response.data);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            return { messages: [], limit: 0, offset: 0 };
        }
        console.error("❌ Error fetching project messages:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Fetches messages with cursor-based pagination for real-time updates.
 *
 * @param {string} projectId - The project ID
 * @param {Object} [options] - Pagination options
 * @param {string} [options.afterId] - Get messages after this message ID
 * @param {number} [options.limit] - Number of messages to fetch (default: 20, max: 100)
 * @returns {Promise<Object>} - Object containing messages array and pagination info
 * @throws {Error} - Throws an error if fetching messages fails
 */
export const fetchMessages = async (projectId, options = {}) => {
    try {
        const params = {
            projectId,
            limit: options.limit || 20,
            ...(options.afterId && { afterId: options.afterId })
        };

        console.log(`📡 Fetching messages with cursor pagination:`, params);

        const response = await api.get(ENDPOINTS.MESSAGES, { params });

        console.log("✅ Messages fetched successfully:", response.data);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            return { messages: [], limit: 0 };
        }
        console.error("❌ Error fetching messages:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Sends a reply to a specific message.
 *
 * @param {Object} replyData - The reply data
 * @param {string} replyData.projectId - The project ID
 * @param {string} replyData.parentMessageId - The parent message ID
 * @param {string} replyData.content - The reply content
 * @param {string} [replyData.messageType] - The message type (default: "text")
 * @returns {Promise<Object>} - The response object from the backend
 * @throws {Error} - Throws an error if the request fails
 */
export const sendReply = async (replyData) => {
    try {
        const payload = {
            content: replyData.content,
            messageType: replyData.messageType || "text",
            parentMessageId: replyData.parentMessageId
        };

        console.log("📤 Sending reply:", payload);

        const response = await api.post(`${ENDPOINTS.PROJECTS}/${replyData.projectId}/messages`, payload);

        console.log("✅ Reply sent successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error sending reply:", error.response?.data || error.message);
        throw error;
    }
};

const messageService = {
    sendMessage,
    fetchProjectMessages,
    fetchMessages,
    sendReply,
};

export default messageService;
