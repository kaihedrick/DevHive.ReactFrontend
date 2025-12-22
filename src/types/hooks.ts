// User type
export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

// TaskResponse type - matches complete backend response
export interface TaskResponse {
  id: string;
  projectId: string;
  sprintId?: string; // Always present in update/create responses
  assigneeId?: string; // Always present in update/create responses
  description: string;
  status: number;
  createdAt: string;
  updatedAt: string;
  assignee?: { // Always present in update/create responses if assigned
    username: string;
    firstName: string;
    lastName: string;
  };
  owner: { // Always present in all responses
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

// SprintResponse type - matches complete backend response
export interface SprintResponse {
  id: string;
  projectId: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  isCompleted: boolean;
  isStarted: boolean;
  createdAt: string;
  updatedAt: string;
  owner: { // Always present in update/create responses
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

// Project type - matches complete backend response
export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  // NEW FIELDS:
  userRole?: string; // "owner" | "admin" | "member" | "viewer"
  permissions?: {
    canViewInvites: boolean;
    canCreateInvites: boolean;
    canRevokeInvites: boolean;
    canManageMembers: boolean;
  };
}

// Message type - matches backend response from Go API
export interface Message {
  id: string;
  projectId: string;
  senderId: string;
  content: string;
  messageType: 'text' | 'image' | 'file';
  parentMessageId?: string | null;
  createdAt: string;
  updatedAt: string;
  // Sender info (populated by backend)
  sender?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
  };
  // Alias for component compatibility (maps senderId for display logic)
  userId?: string;
}

// Legacy types for backward compatibility (aliases)
export type Task = TaskResponse;
export type Sprint = SprintResponse;
export type ProjectMember = User;

// Hook return types
export interface UseBoardActionsReturn {
  sprints: Sprint[];
  selectedSprint: string | null;
  tasks: Task[];
  members: User[];
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  draggedTask: Task | null;
  setDraggedTask: (task: Task | null) => void;
  setError: (error: string | null) => void;
  getTasksByStatus: (status: number) => Task[];
  formatDate: (dateString: string) => string;
  getAssigneeName: (task: Task) => string;
  handleSprintChange: (sprintId: string) => void;
  handleAssigneeChange: (task: Task, newAssigneeId: string) => Promise<void>;
  handleStatusUpdate: (taskId: string, newStatus: number) => Promise<boolean>;
  setSuccessMessage: (message: string | null) => void;
}

export interface UseTaskManagementReturn {
  tasks: Task[];
  todoTasks: Task[];
  inProgressTasks: Task[];
  completedTasks: Task[];
  selectedTask: Task | null;
  setSelectedTask: (task: Task | null) => void;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  handleCreateTask: (taskData: CreateTaskData) => Promise<{ success: boolean; error?: string }>;
  handleUpdateTask: (taskData: UpdateTaskData) => Promise<{ success: boolean; error?: string }>;
  handleUpdateTaskStatus: (taskId: string, status: number) => Promise<{ success: boolean; error?: string }>;
  handleUpdateTaskAssignee: (taskId: string, newAssigneeId: string) => Promise<{ success: boolean; error?: string }>;
}

export interface CreateTaskData {
  projectId: string;
  description: string;
  sprintId?: string;
  assigneeId?: string;
  status?: number;
}

export interface UpdateTaskData {
  id: string;
  description?: string;
  sprintId?: string;
  assigneeId?: string;
  status?: number;
}

