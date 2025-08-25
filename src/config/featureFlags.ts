// Feature flags configuration
// Toggle features on/off for gradual rollout

export const FEATURE_FLAGS = {
  // Toggle between old LoginRegister and new AuthPage
  USE_NEW_AUTH_PAGE: process.env.REACT_APP_USE_NEW_AUTH_PAGE === 'true' || true,
  
  // Toggle new InputField component
  USE_NEW_INPUT_FIELD: process.env.REACT_APP_USE_NEW_INPUT_FIELD === 'true' || true,
  
  // Toggle CSS Modules architecture
  USE_CSS_MODULES: process.env.REACT_APP_USE_CSS_MODULES === 'true' || true,
} as const;

// Helper function to check if a feature is enabled
export const isFeatureEnabled = (feature: keyof typeof FEATURE_FLAGS): boolean => {
  return FEATURE_FLAGS[feature];
};

// Helper function to get feature flag value
export const getFeatureFlag = <K extends keyof typeof FEATURE_FLAGS>(
  feature: K
): typeof FEATURE_FLAGS[K] => {
  return FEATURE_FLAGS[feature];
};
