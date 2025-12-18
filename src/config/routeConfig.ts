/**
 * @file routeConfig.ts
 * @description Centralized route configuration for DevHive
 */

/**
 * Routes that are accessible without a selected project (project-agnostic)
 * These pages should not render the project shell (Navbar)
 */
export const PROJECT_AGNOSTIC_ROUTES = new Set([
  '/',
  '/projects',
  '/join-project',
  '/join-group', // Alternative route name
  '/create-project',
  '/account-details',
  '/forgot-password',
  '/reset-password'
]);

/**
 * Routes that require a selected project (project-scoped)
 * These pages should only render when a project is selected
 */
export const PROJECT_SCOPED_ROUTES = new Set([
  '/project-details',
  '/backlog',
  '/board',
  '/sprint',
  '/contacts',
  '/messages',
  '/create-sprint',
  '/create-task',
  '/edit-sprint',
  '/edit-task',
  '/invite'
]);

/**
 * Check if a route is project-agnostic
 * @param pathname - The current pathname
 * @returns True if the route is project-agnostic
 */
export function isProjectAgnosticRoute(pathname: string): boolean {
  // Extract base path (e.g., '/backlog' from '/backlog/123')
  const basePath = '/' + pathname.split('/')[1];
  return PROJECT_AGNOSTIC_ROUTES.has(basePath);
}

/**
 * Check if a route is project-scoped
 * @param pathname - The current pathname
 * @returns True if the route is project-scoped
 */
export function isProjectScopedRoute(pathname: string): boolean {
  const basePath = '/' + pathname.split('/')[1];
  return PROJECT_SCOPED_ROUTES.has(basePath);
}




