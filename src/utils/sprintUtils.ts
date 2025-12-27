import { Sprint } from '../types/hooks.ts';

export type SprintStatus = 'planned' | 'active' | 'completed';

/**
 * Get the status of a sprint
 * 
 * @param sprint - The sprint object
 * @returns The sprint status: 'planned', 'active', or 'completed'
 */
export function getSprintStatus(sprint: Sprint): SprintStatus {
  if (sprint.isCompleted) {
    return 'completed';
  }
  if (sprint.isStarted) {
    return 'active';
  }
  return 'planned';
}

/**
 * Check if a sprint is active
 * 
 * @param sprint - The sprint object
 * @returns true if sprint is active (isStarted && !isCompleted)
 */
export function isSprintActive(sprint: Sprint): boolean {
  return sprint.isStarted && !sprint.isCompleted;
}

/**
 * Check if a sprint is inactive (planned or completed)
 * 
 * @param sprint - The sprint object
 * @returns true if sprint is planned or completed
 */
export function isSprintInactive(sprint: Sprint): boolean {
  return !isSprintActive(sprint);
}

/**
 * Check if a sprint is planned (not started, not completed)
 * 
 * @param sprint - The sprint object
 * @returns true if sprint is planned (!isStarted && !isCompleted)
 */
export function isSprintPlanned(sprint: Sprint): boolean {
  return !sprint.isStarted && !sprint.isCompleted;
}

/**
 * Check if a sprint is completed
 * 
 * @param sprint - The sprint object
 * @returns true if sprint is completed
 */
export function isSprintCompleted(sprint: Sprint): boolean {
  return sprint.isCompleted;
}

/**
 * Get days remaining in sprint (if active)
 * 
 * @param sprint - The sprint object
 * @returns Number of days remaining, or null if sprint is not active
 */
export function getDaysRemaining(sprint: Sprint): number | null {
  if (!isSprintActive(sprint)) {
    return null;
  }

  const endDate = new Date(sprint.endDate);
  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
}

/**
 * Get sprint progress percentage (based on dates)
 * 
 * @param sprint - The sprint object
 * @returns Progress percentage (0-100)
 */
export function getSprintProgress(sprint: Sprint): number {
  if (!isSprintActive(sprint)) {
    return sprint.isCompleted ? 100 : 0;
  }

  const startDate = new Date(sprint.startDate);
  const endDate = new Date(sprint.endDate);
  const now = new Date();

  const totalDuration = endDate.getTime() - startDate.getTime();
  const elapsed = now.getTime() - startDate.getTime();

  if (totalDuration <= 0) return 0;
  if (elapsed <= 0) return 0;
  if (elapsed >= totalDuration) return 100;

  return Math.round((elapsed / totalDuration) * 100);
}

/**
 * Get status label for display
 * 
 * @param sprint - The sprint object
 * @returns Human-readable status label
 */
export function getSprintStatusLabel(sprint: Sprint): string {
  const status = getSprintStatus(sprint);
  const labels = {
    active: 'Active',
    planned: 'Planned',
    completed: 'Completed',
  };
  return labels[status];
}

/**
 * Get status color class for styling
 * 
 * @param sprint - The sprint object
 * @returns CSS class name for status styling
 */
export function getSprintStatusColorClass(sprint: Sprint): string {
  const status = getSprintStatus(sprint);
  const classes = {
    active: 'status-active',
    planned: 'status-planned',
    completed: 'status-completed',
  };
  return classes[status];
}






