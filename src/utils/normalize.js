// src/utils/normalize.js
// Universal normalizer for project data

/**
 * Coerce any API payload into a Project array
 * @param {unknown} input - The API response data
 * @returns {Array} - Array of normalized project objects
 */
export function normalizeProjects(input) {
  // Extract an array from common wrappers
  let arr = input;
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const o = input;
    arr = o.projects ?? o.items ?? o.data ?? o.results ?? [];
  }
  if (!Array.isArray(arr)) return [];

  // Map loose shapes into our Project type
  return arr.map((p) => ({
    id: String(p.id ?? p.projectId ?? p.guid ?? cryptoRandom()),
    name: (p.name ?? p.title ?? "Untitled Project").toString(),
    created_at: p.created_at ?? p.createdAt,
    updated_at: p.updated_at ?? p.updatedAt,
  }));
}

function cryptoRandom() {
  // Fallback id when upstream omits one
  return Math.random().toString(36).slice(2);
}
