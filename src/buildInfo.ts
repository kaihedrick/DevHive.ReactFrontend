/**
 * Build information for version tracking and debugging
 *
 * This file is auto-generated during build time.
 * The BUILD_ID is used to identify which version of the frontend is running,
 * which helps with debugging when multiple clients might be running different versions.
 */

// Version from package.json
export const VERSION = '0.1.0';

// Build timestamp - updated at build time
// In production, this would be replaced by the build process with the actual build timestamp
export const BUILD_TIMESTAMP = new Date().toISOString();

// Unique build ID combining version and timestamp
export const BUILD_ID = `${VERSION}`;

/**
 * Logs build information to console at startup
 * This helps identify which version of the frontend is running in browser dev tools
 */
export function logBuildInfo(): void {
  console.log(`
╔════════════════════════════════════════╗
║         DevHive Frontend Build         ║
╠════════════════════════════════════════╣
║ Version:    ${VERSION.padEnd(27)}║
║ Build ID:   ${BUILD_ID.padEnd(27)}║
║ Timestamp:  ${BUILD_TIMESTAMP.substring(0, 19).padEnd(27)}║
╚════════════════════════════════════════╝
  `);
}
