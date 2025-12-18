/**
 * @file normalize.ts
 * @description Utility functions to normalize API responses and prevent crashes
 */

/**
 * Normalizes projects data to ensure it's always an array
 * Handles various API response formats: array, { projects: [...] }, { items: [...] }, etc.
 * 
 * @param payload - The API response payload (unknown type)
 * @returns Normalized array of projects
 */
export function normalizeProjects(payload: unknown): any[] {
  let arr: unknown = payload;
  
  // If payload is an object but not an array, try to extract array from common properties
  if (arr && typeof arr === "object" && !Array.isArray(arr)) {
    const obj = arr as Record<string, unknown>;
    arr = obj.projects ?? obj.items ?? obj.data ?? obj.results ?? [];
  }
  
  // Ensure we return an array
  return Array.isArray(arr) ? arr : [];
}

/**
 * Normalizes any array-like data from API responses
 * 
 * @param payload - The API response payload
 * @param arrayKey - The key to look for in object responses (default: 'data')
 * @returns Normalized array
 */
export function normalizeArray(payload: unknown, arrayKey: string = 'data'): any[] {
  let arr: unknown = payload;
  
  if (arr && typeof arr === "object" && !Array.isArray(arr)) {
    const obj = arr as Record<string, unknown>;
    arr = obj[arrayKey] ?? obj.items ?? obj.results ?? [];
  }
  
  return Array.isArray(arr) ? arr : [];
}