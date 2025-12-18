// ProjectService.js
// This module handles project-related API calls for DevHive project management.

import { api } from '../lib/api.ts';
import { ENDPOINTS } from '../config';
import { normalizeProjects } from '../utils/normalize.js';

/**
 * Fetches all projects for the authenticated user with pagination.
 *
 * @param {Object} [options] - Pagination options
 * @param {number} [options.limit] - Number of projects to fetch (default: 20, max: 100)
 * @param {number} [options.offset] - Number of projects to skip (default: 0)
 * @returns {Promise<Object>} - Object containing projects array and pagination info
 * @throws {Error} - Throws an error if fetching projects fails
 */
export const fetchUserProjects = async (options = {}) => {
    try {
        const params = {
            limit: options.limit || 20,
            offset: options.offset || 0
        };

        console.log("📡 Fetching user projects:", params);

        const response = await api.get(ENDPOINTS.PROJECTS, { params });

        console.log("✅ Projects fetched successfully:", response.data);
        
        // Normalize the response to always return a Project array
        const normalizedProjects = normalizeProjects(response.data);
        console.log("📋 Normalized projects:", normalizedProjects);
        
        return normalizedProjects;
    } catch (error) {
        console.error("❌ Error fetching user projects:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Fetches a single project by its ID.
 *
 * @param {string} projectId - The ID of the project to retrieve
 * @returns {Promise<Object>} - The project data object
 * @throws {Error} - Throws an error if the project cannot be retrieved
 */
export const fetchProjectById = async (projectId) => {
    try {
        console.log(`📡 Fetching project: ${projectId}`);

        const response = await api.get(ENDPOINTS.PROJECT_BY_ID(projectId));

        console.log("✅ Project fetched successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error fetching project:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Creates a new project.
 *
 * @param {Object} projectData - Data for the new project
 * @param {string} projectData.name - Name of the project
 * @param {string} projectData.description - Description of the project
 * @returns {Promise<Object>} - The created project object
 * @throws {Error} - Throws an error if project creation fails
 */
export const createProject = async (projectData) => {
    try {
        if (!projectData.name) {
            throw new Error("Project name is required");
        }

        const payload = {
            name: projectData.name,
            description: projectData.description || ""
        };

        console.log("📤 Creating project:", payload);

        const response = await api.post(ENDPOINTS.PROJECTS, payload);

        console.log("✅ Project created successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error creating project:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Updates an existing project.
 *
 * @param {string} projectId - The ID of the project to update
 * @param {Object} projectData - Updated project data
 * @param {string} [projectData.name] - New name for the project
 * @param {string} [projectData.description] - New description for the project
 * @returns {Promise<Object>} - The updated project object
 * @throws {Error} - Throws an error if project update fails
 */
export const updateProject = async (projectId, projectData) => {
    try {
        if (!projectId) {
            throw new Error("Project ID is required");
        }

        const payload = {};
        if (projectData.name !== undefined) payload.name = projectData.name;
        if (projectData.description !== undefined) payload.description = projectData.description;

        console.log(`📤 Updating project ${projectId}:`, payload);

        const response = await api.patch(ENDPOINTS.PROJECT_BY_ID(projectId), payload);

        console.log("✅ Project updated successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error updating project:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Deletes a project.
 *
 * @param {string} projectId - The ID of the project to delete
 * @returns {Promise<Object>} - Confirmation response
 * @throws {Error} - Throws an error if project deletion fails
 */
export const deleteProject = async (projectId) => {
    try {
        if (!projectId) {
            throw new Error("Project ID is required");
        }

        console.log(`📤 Deleting project: ${projectId}`);

        const response = await api.delete(ENDPOINTS.PROJECT_BY_ID(projectId));

        console.log("✅ Project deleted successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error deleting project:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Adds a member to a project.
 *
 * @param {string} projectId - The ID of the project
 * @param {string} userId - The ID of the user to add
 * @param {string} [role] - The role for the member (default: "member")
 * @returns {Promise<Object>} - Confirmation response
 * @throws {Error} - Throws an error if adding member fails
 */
export const addProjectMember = async (projectId, userId, role = "member") => {
    try {
        if (!projectId || !userId) {
            throw new Error("Project ID and User ID are required");
        }

        console.log(`📤 Adding member ${userId} to project ${projectId} with role: ${role}`);

        // Use PUT instead of POST for adding members (per new API spec)
        const response = await api.put(`${ENDPOINTS.PROJECT_BY_ID(projectId)}/members/${userId}`, {}, {
            params: { role }
        });

        console.log("✅ Member added successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error adding member:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Removes a member from a project.
 *
 * @param {string} projectId - The ID of the project
 * @param {string} userId - The ID of the user to remove
 * @returns {Promise<Object>} - Confirmation response
 * @throws {Error} - Throws an error if removing member fails
 */
export const removeProjectMember = async (projectId, userId) => {
    try {
        if (!projectId || !userId) {
            throw new Error("Project ID and User ID are required");
        }

        console.log(`📤 Removing member ${userId} from project ${projectId}`);

        const response = await api.delete(`${ENDPOINTS.PROJECT_BY_ID(projectId)}/members/${userId}`);

        console.log("✅ Member removed successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error removing member:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Fetches all members of a project.
 *
 * @param {string} projectId - The ID of the project
 * @returns {Promise<Object>} - Object containing members array and count
 * @throws {Error} - Throws an error if fetching members fails
 */
export const fetchProjectMembers = async (projectId) => {
    try {
        if (!projectId) {
            throw new Error("Project ID is required");
        }

        console.log(`📡 Fetching members for project: ${projectId}`);

        const response = await api.get(`${ENDPOINTS.PROJECT_BY_ID(projectId)}/members`);

        console.log("✅ Project members fetched successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error fetching project members:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Checks whether the currently logged-in user is the owner of the specified project.
 *
 * @param {string} projectId - The ID of the project to check
 * @returns {Promise<boolean>} - True if the user is the project owner, false otherwise
 */
export const isProjectOwner = async (projectId) => {
    try {
        const project = await fetchProjectById(projectId);
        const currentUserId = getUserId();

        return project.ownerId === currentUserId;
    } catch (error) {
        console.error("❌ Error checking project ownership:", error);
        return false;
    }
};

/**
 * Stores the selected project ID in localStorage for state persistence.
 *
 * @param {string} projectId - The project ID to be saved
 */
export const setSelectedProject = (projectId) => {
    localStorage.setItem("selectedProjectId", projectId);
};

/**
 * Sets the currently selected project ID for the session.
 *
 * @param {string} projectId - The ID of the project to select
 * @returns {boolean} - Returns true if the project was successfully selected, false otherwise
 */
export const selectProject = async (projectId) => {
    try {
        setSelectedProject(projectId);
        return true;
    } catch (error) {
        console.error("❌ Error selecting project:", error);
        return false;
    }
};

/**
 * Retrieves the currently selected project ID from localStorage.
 *
 * @returns {string|null} - The stored project ID or null if not found
 */
export const getSelectedProject = () => {
    try {
        return localStorage.getItem("selectedProjectId");
    } catch (error) {
        console.error('Error getting selected project:', error);
        return null;
    }
};

/**
 * Removes the selected project ID from localStorage.
 */
export const clearSelectedProject = () => {
    localStorage.removeItem("selectedProjectId");
};

/**
 * Retrieves the stored authentication token from localStorage.
 *
 * @returns {string|null} - JWT token or null if not found
 */
export const getAuthToken = () => {
    return localStorage.getItem("token");
};

/**
 * Retrieves the current user ID from localStorage.
 *
 * @returns {string|null} - The user ID or null if not found
 */
export const getUserId = () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
        console.warn("Warning: User ID not found in localStorage.");
    }
    return userId;
};

// Legacy functions for backward compatibility
export const joinProject = async (projectId, userId) => {
    console.warn("⚠️ joinProject is deprecated. Use addProjectMember instead.");
    return addProjectMember(projectId, userId);
};

export const leaveProject = async (projectId) => {
    console.warn("⚠️ leaveProject is deprecated. Use removeProjectMember instead.");
    const userId = getUserId();
    if (!userId) {
        throw new Error("User ID not found");
    }
    return removeProjectMember(projectId, userId);
};

export const editProject = async (project) => {
    console.warn("⚠️ editProject is deprecated. Use updateProject instead.");
    return updateProject(project.id, project);
};

export const updateProjectOwner = async (projectId, newOwnerId) => {
    console.warn("⚠️ updateProjectOwner is not supported in the new API. Use member management instead.");
    throw new Error("updateProjectOwner is not supported in the new API");
};

export const removeMemberFromProject = async (projectId, memberId) => {
    console.warn("⚠️ removeMemberFromProject is deprecated. Use removeProjectMember instead.");
    return removeProjectMember(projectId, memberId);
};

// Legacy task functions (should be moved to taskService)
export const editTask = async (taskData) => {
    console.warn("⚠️ editTask is deprecated in projectService. Use taskService.editTask instead.");
    throw new Error("editTask should be imported from taskService, not projectService");
};

export const fetchTaskById = async (taskId) => {
    console.warn("⚠️ fetchTaskById is deprecated in projectService. Use taskService.fetchTaskById instead.");
    throw new Error("fetchTaskById should be imported from taskService, not projectService");
};

export const fetchProjectSprints = async (projectId) => {
    console.warn("⚠️ fetchProjectSprints is deprecated in projectService. Use sprintService.fetchProjectSprints instead.");
    throw new Error("fetchProjectSprints should be imported from sprintService, not projectService");
};

const projectService = {
    fetchUserProjects,
    fetchProjectById,
    createProject,
    updateProject,
    deleteProject,
    addProjectMember,
    removeProjectMember,
    fetchProjectMembers,
    isProjectOwner,
    setSelectedProject,
    selectProject,
    getSelectedProject,
    clearSelectedProject,
    getAuthToken,
    getUserId,
    // Legacy functions
    joinProject,
    leaveProject,
    editProject,
    updateProjectOwner,
    removeMemberFromProject,
    editTask,
    fetchTaskById,
    fetchProjectSprints
};

export default projectService;
