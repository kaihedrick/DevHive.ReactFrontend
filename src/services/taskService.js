// TaskService.js
// This module handles task-related API calls for DevHive task management.

import { api } from '../lib/apiClient';
import { ENDPOINTS } from '../config';

/**
 * Fetches all tasks for a specific project with pagination.
 *
 * @param {string} projectId - The ID of the project
 * @param {Object} [options] - Pagination options
 * @param {number} [options.limit] - Number of tasks to fetch (default: 20, max: 100)
 * @param {number} [options.offset] - Number of tasks to skip (default: 0)
 * @returns {Promise<Object>} - Object containing tasks array and pagination info
 * @throws {Error} - Throws an error if fetching tasks fails
 */
export const fetchProjectTasks = async (projectId, options = {}) => {
    try {
        if (!projectId) {
            throw new Error("Project ID is required");
        }

        const params = {
            limit: options.limit || 20,
            offset: options.offset || 0
        };

        console.log(`📡 Fetching tasks for project ${projectId}:`, params);

        const response = await api.get(`${ENDPOINTS.PROJECTS}/${projectId}/tasks`, { params });

        console.log("✅ Tasks fetched successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error fetching project tasks:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Fetches all tasks for a specific sprint with pagination.
 *
 * @param {string} sprintId - The ID of the sprint
 * @param {Object} [options] - Pagination options
 * @param {number} [options.limit] - Number of tasks to fetch (default: 20, max: 100)
 * @param {number} [options.offset] - Number of tasks to skip (default: 0)
 * @returns {Promise<Object>} - Object containing tasks array and pagination info
 * @throws {Error} - Throws an error if fetching tasks fails
 */
export const fetchSprintTasks = async (sprintId, options = {}) => {
    try {
        if (!sprintId) {
            throw new Error("Sprint ID is required");
        }

        const params = {
            limit: options.limit || 20,
            offset: options.offset || 0
        };

        console.log(`📡 Fetching tasks for sprint ${sprintId}:`, params);

        const response = await api.get(`${ENDPOINTS.SPRINTS}/${sprintId}/tasks`, { params });

        console.log("✅ Sprint tasks fetched successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error fetching sprint tasks:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Fetches a single task by its ID.
 *
 * @param {string} taskId - The ID of the task to retrieve
 * @returns {Promise<Object>} - The task data object
 * @throws {Error} - Throws an error if the task cannot be retrieved
 */
export const fetchTaskById = async (taskId) => {
    try {
        if (!taskId) {
            throw new Error("Task ID is required");
        }

        console.log(`📡 Fetching task: ${taskId}`);

        const response = await api.get(ENDPOINTS.TASK_BY_ID(taskId));

        console.log("✅ Task fetched successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error fetching task:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Creates a new task for a project.
 *
 * @param {string} projectId - The ID of the project
 * @param {Object} taskData - Data for the new task
 * @param {string} taskData.description - Description of the task
 * @param {string} [taskData.sprintId] - ID of the sprint to assign the task to
 * @param {string} [taskData.assigneeId] - ID of the user to assign the task to
 * @param {number} [taskData.status] - Status of the task (default: 0)
 * @returns {Promise<Object>} - The created task object
 * @throws {Error} - Throws an error if task creation fails
 */
export const createTask = async (projectId, taskData) => {
    try {
        if (!projectId) {
            throw new Error("Project ID is required");
        }

        if (!taskData.description) {
            throw new Error("Task description is required");
        }

        const payload = {
            description: taskData.description,
            status: taskData.status || 0,
            ...(taskData.sprintId && { sprintId: taskData.sprintId }),
            ...(taskData.assigneeId && { assigneeId: taskData.assigneeId })
        };

        console.log(`📤 Creating task for project ${projectId}:`, payload);

        const response = await api.post(`${ENDPOINTS.PROJECTS}/${projectId}/tasks`, payload);

        console.log("✅ Task created successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error creating task:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Updates an existing task.
 *
 * @param {string} taskId - The ID of the task to update
 * @param {Object} taskData - Updated task data
 * @param {string} [taskData.description] - New description for the task
 * @param {string} [taskData.assigneeId] - New assignee ID for the task
 * @returns {Promise<Object>} - The updated task object
 * @throws {Error} - Throws an error if task update fails
 */
export const updateTask = async (taskId, taskData) => {
    try {
        if (!taskId) {
            throw new Error("Task ID is required");
        }

        const payload = {};
        if (taskData.description !== undefined) payload.description = taskData.description;
        if (taskData.assigneeId !== undefined) payload.assigneeId = taskData.assigneeId;

        console.log(`📤 Updating task ${taskId}:`, payload);

        const response = await api.patch(ENDPOINTS.TASK_BY_ID(taskId), payload);

        console.log("✅ Task updated successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error updating task:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Updates the status of a task.
 *
 * @param {string} taskId - The ID of the task to update
 * @param {number} status - The new status (0 = Pending, 1 = In Progress, 2 = Completed)
 * @returns {Promise<Object>} - The updated task object
 * @throws {Error} - Throws an error if status update fails
 */
export const updateTaskStatus = async (taskId, status) => {
    try {
        if (!taskId) {
            throw new Error("Task ID is required");
        }

        if (status === undefined || status === null) {
            throw new Error("Status is required");
        }

        // Validate status values
        if (![0, 1, 2].includes(Number(status))) {
            throw new Error("Status must be 0 (Pending), 1 (In Progress), or 2 (Completed)");
        }

        const payload = { status: Number(status) };

        console.log(`📤 Updating task ${taskId} status to ${status}:`, payload);

        const response = await api.patch(ENDPOINTS.TASK_STATUS(taskId), payload);

        console.log("✅ Task status updated successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error updating task status:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Deletes a task.
 *
 * @param {string} taskId - The ID of the task to delete
 * @returns {Promise<Object>} - Confirmation response
 * @throws {Error} - Throws an error if task deletion fails
 */
export const deleteTask = async (taskId) => {
    try {
        if (!taskId) {
            throw new Error("Task ID is required");
        }

        console.log(`📤 Deleting task: ${taskId}`);

        const response = await api.delete(ENDPOINTS.TASK_BY_ID(taskId));

        console.log("✅ Task deleted successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error deleting task:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Assigns a task to a user.
 *
 * @param {string} taskId - The ID of the task
 * @param {string} assigneeId - The ID of the user to assign the task to
 * @returns {Promise<Object>} - The updated task object
 * @throws {Error} - Throws an error if assignment fails
 */
export const assignTask = async (taskId, assigneeId) => {
    try {
        if (!taskId) {
            throw new Error("Task ID is required");
        }

        if (!assigneeId) {
            throw new Error("Assignee ID is required");
        }

        console.log(`📤 Assigning task ${taskId} to user ${assigneeId}`);

        // Use the standard updateTask endpoint instead of /assign
        const response = await api.patch(ENDPOINTS.TASK_BY_ID(taskId), { assigneeId });

        console.log("✅ Task assigned successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error assigning task:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Unassigns a task from its current assignee.
 *
 * @param {string} taskId - The ID of the task
 * @returns {Promise<Object>} - The updated task object
 * @throws {Error} - Throws an error if unassignment fails
 */
export const unassignTask = async (taskId) => {
    try {
        if (!taskId) {
            throw new Error("Task ID is required");
        }

        console.log(`📤 Unassigning task: ${taskId}`);

        // Use the standard updateTask endpoint instead of /unassign
        const response = await api.patch(ENDPOINTS.TASK_BY_ID(taskId), { assigneeId: null });

        console.log("✅ Task unassigned successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error unassigning task:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Moves a task to a different sprint.
 *
 * @param {string} taskId - The ID of the task
 * @param {string} sprintId - The ID of the sprint to move the task to
 * @returns {Promise<Object>} - The updated task object
 * @throws {Error} - Throws an error if move fails
 */
export const moveTaskToSprint = async (taskId, sprintId) => {
    try {
        if (!taskId) {
            throw new Error("Task ID is required");
        }

        if (!sprintId) {
            throw new Error("Sprint ID is required");
        }

        console.log(`📤 Moving task ${taskId} to sprint ${sprintId}`);

        const response = await api.patch(`${ENDPOINTS.TASK_BY_ID(taskId)}/sprint`, { sprintId });

        console.log("✅ Task moved successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error moving task:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Removes a task from its current sprint.
 *
 * @param {string} taskId - The ID of the task
 * @returns {Promise<Object>} - The updated task object
 * @throws {Error} - Throws an error if removal fails
 */
export const removeTaskFromSprint = async (taskId) => {
    try {
        if (!taskId) {
            throw new Error("Task ID is required");
        }

        console.log(`📤 Removing task ${taskId} from sprint`);

        const response = await api.patch(`${ENDPOINTS.TASK_BY_ID(taskId)}/sprint`, { sprintId: null });

        console.log("✅ Task removed from sprint successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error removing task from sprint:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Gets tasks with assignee information for display purposes.
 * This is a helper function that fetches tasks and enriches them with assignee details.
 *
 * @param {string} projectId - The ID of the project
 * @param {Object} [options] - Pagination options
 * @returns {Promise<Array>} - Array of tasks with assignee information
 * @throws {Error} - Throws an error if fetching fails
 */
export const fetchProjectTasksWithAssignees = async (projectId, options = {}) => {
    try {
        const response = await fetchProjectTasks(projectId, options);
        
        // The backend already includes assignee information in the response
        // so we can return the tasks directly
        return response.tasks || [];
    } catch (error) {
        console.error("❌ Error fetching tasks with assignees:", error);
        throw error;
    }
};

/**
 * Gets the status name for a given status code.
 *
 * @param {number} status - The status code
 * @returns {string} - The status name
 */
export const getStatusName = (status) => {
    const statusMap = {
        0: "Pending",
        1: "In Progress", 
        2: "Completed"
    };
    return statusMap[status] || "Unknown";
};

/**
 * Gets the status color for a given status code.
 *
 * @param {number} status - The status code
 * @returns {string} - The status color class
 */
export const getStatusColor = (status) => {
    const colorMap = {
        0: "text-yellow-600 bg-yellow-100",
        1: "text-blue-600 bg-blue-100",
        2: "text-green-600 bg-green-100"
    };
    return colorMap[status] || "text-gray-600 bg-gray-100";
};

// Legacy functions for backward compatibility
export const editTask = async (taskData) => {
    console.warn("⚠️ editTask is deprecated. Use updateTask instead.");
    return updateTask(taskData.id, taskData);
};

export const updateTaskAssignee = async (taskId, newAssigneeId) => {
    console.warn("⚠️ updateTaskAssignee is deprecated. Use assignTask instead.");
    return assignTask(taskId, newAssigneeId);
};

const taskService = {
    fetchProjectTasks,
    fetchSprintTasks,
    fetchTaskById,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
    assignTask,
    unassignTask,
    moveTaskToSprint,
    removeTaskFromSprint,
    fetchProjectTasksWithAssignees,
    getStatusName,
    getStatusColor,
    // Legacy functions
    editTask,
    updateTaskAssignee
};

export default taskService;