// SprintService.js
// This module handles sprint-related API calls for DevHive sprint management.

import { api } from '../lib/apiClient.ts';
import { ENDPOINTS } from '../config';

/**
 * Fetches all sprints for a specific project with pagination.
 *
 * @param {string} projectId - The ID of the project
 * @param {Object} [options] - Pagination options
 * @param {number} [options.limit] - Number of sprints to fetch (default: 20, max: 100)
 * @param {number} [options.offset] - Number of sprints to skip (default: 0)
 * @returns {Promise<Object>} - Object containing sprints array and pagination info
 * @throws {Error} - Throws an error if fetching sprints fails
 */
export const fetchProjectSprints = async (projectId, options = {}) => {
    try {
        if (!projectId) {
            throw new Error("Project ID is required");
        }

        const params = {
            limit: options.limit || 20,
            offset: options.offset || 0
        };

        console.log(`📡 Fetching sprints for project ${projectId}:`, params);

        const response = await api.get(`${ENDPOINTS.PROJECTS}/${projectId}/sprints`, { params });

        console.log("✅ Sprints fetched successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error fetching project sprints:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Fetches a single sprint by its ID.
 *
 * @param {string} sprintId - The ID of the sprint to retrieve
 * @returns {Promise<Object>} - The sprint data object
 * @throws {Error} - Throws an error if the sprint cannot be retrieved
 */
export const fetchSprintById = async (sprintId) => {
    try {
        if (!sprintId) {
            throw new Error("Sprint ID is required");
        }

        console.log(`📡 Fetching sprint: ${sprintId}`);

        const response = await api.get(`${ENDPOINTS.SPRINTS}/${sprintId}`);

        console.log("✅ Sprint fetched successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error fetching sprint:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Creates a new sprint for a project.
 *
 * @param {string} projectId - The ID of the project
 * @param {Object} sprintData - Data for the new sprint
 * @param {string} sprintData.name - Name of the sprint
 * @param {string} sprintData.description - Description of the sprint
 * @param {string} sprintData.startDate - Start date (YYYY-MM-DD or RFC3339 format)
 * @param {string} sprintData.endDate - End date (YYYY-MM-DD or RFC3339 format)
 * @returns {Promise<Object>} - The created sprint object
 * @throws {Error} - Throws an error if sprint creation fails
 */
export const createSprint = async (projectId, sprintData) => {
    try {
        if (!projectId) {
            throw new Error("Project ID is required");
        }

        if (!sprintData || typeof sprintData !== 'object') {
            throw new Error("Invalid sprint payload passed to createSprint");
        }
        if (!sprintData.name || !sprintData.startDate || !sprintData.endDate) {
            throw new Error("Sprint name, start date, and end date are required");
        }

        const payload = {
            name: sprintData.name,
            description: sprintData.description || "",
            startDate: sprintData.startDate,
            endDate: sprintData.endDate
        };

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3b72928f-107f-4672-aa90-6d4285c21018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sprintService.js:97',message:'createSprint called',data:{projectId,projectIdType:typeof projectId,projectIdValue:String(projectId),isNull:projectId===null,isUndefined:projectId===undefined,payload},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        
        // #region agent log
        const apiUrl = `${ENDPOINTS.PROJECTS}/${projectId}/sprints`;
        fetch('http://127.0.0.1:7242/ingest/3b72928f-107f-4672-aa90-6d4285c21018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sprintService.js:101',message:'API URL constructed',data:{apiUrl,projectId,ENDPOINTS_PROJECTS:ENDPOINTS.PROJECTS},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
        // #endregion
        
        console.log(`📤 Creating sprint for project ${projectId}:`, payload);

        const response = await api.post(apiUrl, payload);

        console.log("✅ Sprint created successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error creating sprint:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Updates an existing sprint.
 *
 * @param {string} sprintId - The ID of the sprint to update
 * @param {Object} sprintData - Updated sprint data
 * @param {string} [sprintData.name] - New name for the sprint
 * @param {string} [sprintData.description] - New description for the sprint
 * @param {string} [sprintData.startDate] - New start date (YYYY-MM-DD or RFC3339 format)
 * @param {string} [sprintData.endDate] - New end date (YYYY-MM-DD or RFC3339 format)
 * @returns {Promise<Object>} - The updated sprint object
 * @throws {Error} - Throws an error if sprint update fails
 */
export const updateSprint = async (sprintId, sprintData) => {
    try {
        if (!sprintId) {
            throw new Error("Sprint ID is required");
        }

        const payload = {};
        if (sprintData.name !== undefined) payload.name = sprintData.name;
        if (sprintData.description !== undefined) payload.description = sprintData.description;
        if (sprintData.startDate !== undefined) payload.startDate = sprintData.startDate;
        if (sprintData.endDate !== undefined) payload.endDate = sprintData.endDate;

        console.log(`📤 Updating sprint ${sprintId}:`, payload);

        const response = await api.patch(`${ENDPOINTS.SPRINTS}/${sprintId}`, payload);

        console.log("✅ Sprint updated successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error updating sprint:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Deletes a sprint.
 *
 * @param {string} sprintId - The ID of the sprint to delete
 * @returns {Promise<Object>} - Confirmation response
 * @throws {Error} - Throws an error if sprint deletion fails
 */
export const deleteSprint = async (sprintId) => {
    try {
        if (!sprintId) {
            throw new Error("Sprint ID is required");
        }

        console.log(`📤 Deleting sprint: ${sprintId}`);

        const response = await api.delete(`${ENDPOINTS.SPRINTS}/${sprintId}`);

        console.log("✅ Sprint deleted successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error deleting sprint:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Starts a sprint (sets isStarted to true).
 * NOTE: This endpoint (/sprints/{id}/start) is not in the new API spec.
 * It may need to be replaced with PATCH /sprints/{id} with status update.
 *
 * @param {string} sprintId - The ID of the sprint to start
 * @returns {Promise<Object>} - The updated sprint object
 * @throws {Error} - Throws an error if starting sprint fails
 */
export const startSprint = async (sprintId) => {
    try {
        if (!sprintId) {
            throw new Error("Sprint ID is required");
        }

        console.log(`📤 Starting sprint: ${sprintId}`);

        const response = await api.patch(`${ENDPOINTS.SPRINTS}/${sprintId}/start`);

        console.log("✅ Sprint started successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error starting sprint:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Updates sprint status (sets isStarted to true/false).
 * Uses the new PATCH /sprints/{id}/status endpoint.
 *
 * @param {string} sprintId - The ID of the sprint to update
 * @param {boolean} isStarted - Whether the sprint should be started
 * @returns {Promise<Object>} - The updated sprint object
 * @throws {Error} - Throws an error if updating sprint status fails
 */
export const updateSprintStatus = async (sprintId, isStarted) => {
    try {
        if (!sprintId) {
            throw new Error("Sprint ID is required");
        }

        console.log(`📤 Updating sprint status: ${sprintId}, isStarted: ${isStarted}`);

        const response = await api.patch(ENDPOINTS.SPRINT_STATUS(sprintId), {
            isStarted: isStarted
        });

        console.log("✅ Sprint status updated successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error updating sprint status:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Completes a sprint (sets isCompleted to true).
 * NOTE: This endpoint (/sprints/{id}/complete) is not in the new API spec.
 * It may need to be replaced with PATCH /sprints/{id} with status update.
 *
 * @param {string} sprintId - The ID of the sprint to complete
 * @returns {Promise<Object>} - The updated sprint object
 * @throws {Error} - Throws an error if completing sprint fails
 */
export const completeSprint = async (sprintId) => {
    try {
        if (!sprintId) {
            throw new Error("Sprint ID is required");
        }

        console.log(`📤 Completing sprint: ${sprintId}`);

        const response = await api.patch(`${ENDPOINTS.SPRINTS}/${sprintId}/complete`);

        console.log("✅ Sprint completed successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error completing sprint:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Gets the current active sprint for a project.
 * NOTE: This endpoint (/projects/{id}/sprints/active) is not in the new API spec.
 * You may need to filter sprints client-side or use a different endpoint.
 *
 * @param {string} projectId - The ID of the project
 * @returns {Promise<Object|null>} - The active sprint object or null if none
 * @throws {Error} - Throws an error if fetching active sprint fails
 */
export const getActiveSprint = async (projectId) => {
    try {
        if (!projectId) {
            throw new Error("Project ID is required");
        }

        console.log(`📡 Fetching active sprint for project: ${projectId}`);

        const response = await api.get(`${ENDPOINTS.PROJECTS}/${projectId}/sprints/active`);

        console.log("✅ Active sprint fetched successfully:", response.data);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            console.log("No active sprint found for project");
            return null;
        }
        console.error("❌ Error fetching active sprint:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Gets the next sprint to start for a project.
 * NOTE: This endpoint (/projects/{id}/sprints/next) is not in the new API spec.
 * You may need to filter sprints client-side or use a different endpoint.
 *
 * @param {string} projectId - The ID of the project
 * @returns {Promise<Object|null>} - The next sprint object or null if none
 * @throws {Error} - Throws an error if fetching next sprint fails
 */
export const getNextSprint = async (projectId) => {
    try {
        if (!projectId) {
            throw new Error("Project ID is required");
        }

        console.log(`📡 Fetching next sprint for project: ${projectId}`);

        const response = await api.get(`${ENDPOINTS.PROJECTS}/${projectId}/sprints/next`);

        console.log("✅ Next sprint fetched successfully:", response.data);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            console.log("No next sprint found for project");
            return null;
        }
        console.error("❌ Error fetching next sprint:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Formats a date string to ensure consistent format for API calls.
 *
 * @param {string|Date} date - The date to format
 * @returns {string} - Formatted date string (YYYY-MM-DD)
 */
export const formatDateForAPI = (date) => {
    if (!date) return null;
    
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
};

/**
 * Formats a date string to RFC3339 format for API calls.
 *
 * @param {string|Date} date - The date to format
 * @returns {string} - Formatted date string (RFC3339)
 */
export const formatDateForAPIRFC3339 = (date) => {
    if (!date) return null;
    
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toISOString();
};

/**
 * Checks if a sprint date range overlaps with existing sprints.
 *
 * @param {string|Date} startDate - The start date to check
 * @param {string|Date} endDate - The end date to check
 * @param {Array} existingSprints - Array of existing sprints
 * @param {string} [excludeSprintId] - Sprint ID to exclude from overlap check
 * @returns {boolean} - True if there's an overlap, false otherwise
 */
export const checkSprintDateOverlap = (startDate, endDate, existingSprints, excludeSprintId = null) => {
    if (!startDate || !endDate || !existingSprints || existingSprints.length === 0) {
        return false;
    }

    const newStart = new Date(startDate);
    const newEnd = new Date(endDate);

    // Check if start date is after end date
    if (newStart >= newEnd) {
        return true; // Invalid date range
    }

    for (const sprint of existingSprints) {
        // Skip the sprint we're excluding (for updates)
        if (excludeSprintId && sprint.id === excludeSprintId) {
            continue;
        }

        const existingStart = new Date(sprint.startDate);
        const existingEnd = new Date(sprint.endDate);

        // Check for overlap: new sprint starts before existing ends AND new sprint ends after existing starts
        if (newStart < existingEnd && newEnd > existingStart) {
            return true;
        }
    }

    return false;
};

/**
 * Gets disabled dates for a date picker based on existing sprints.
 *
 * @param {Array} existingSprints - Array of existing sprints
 * @param {string} [excludeSprintId] - Sprint ID to exclude from disabled dates
 * @returns {Array} - Array of disabled date ranges
 */
export const getDisabledDates = (existingSprints, excludeSprintId = null) => {
    if (!existingSprints || existingSprints.length === 0) {
        return [];
    }

    const disabledRanges = [];

    for (const sprint of existingSprints) {
        // Skip the sprint we're excluding (for updates)
        if (excludeSprintId && sprint.id === excludeSprintId) {
            continue;
        }

        const startDate = new Date(sprint.startDate);
        const endDate = new Date(sprint.endDate);

        // Add the date range to disabled dates
        disabledRanges.push({
            start: startDate,
            end: endDate
        });
    }

    return disabledRanges;
};

// Legacy functions for backward compatibility
export const editSprint = async (sprintData) => {
    console.warn("⚠️ editSprint is deprecated. Use updateSprint instead.");
    return updateSprint(sprintData.id, sprintData);
};

const sprintService = {
    fetchProjectSprints,
    fetchSprintById,
    createSprint,
    updateSprint,
    updateSprintStatus,
    deleteSprint,
    startSprint,
    completeSprint,
    getActiveSprint,
    getNextSprint,
    formatDateForAPI,
    formatDateForAPIRFC3339,
    checkSprintDateOverlap,
    getDisabledDates,
    // Legacy functions
    editSprint
};

export default sprintService;