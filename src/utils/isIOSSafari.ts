/**
 * iOS Safari Detection Utility
 * 
 * Detects if the current browser is iOS Safari (not Chrome, Firefox, or Edge on iOS).
 * This is used to force persistent refresh cookies on iOS Safari since session cookies
 * are deleted when the app is closed.
 * 
 * @returns {boolean} True if the browser is iOS Safari, false otherwise
 */
export function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);

  return isIOS && isSafari;
}

