/**
 * Model for password reset requests
 * Maps to the C# ResetPasswordModel in the backend
 */
export interface ResetPasswordModel {
  Token: string;  // Capital T to match C# property
  NewPassword: string;  // Capital N to match C# property
}

/**
 * Model for password change requests (for authenticated users)
 * Maps to the C# ChangePasswordModel in the backend
 */
export interface ChangePasswordModel {
  OldPassword: string;  // Capital O to match C# naming convention
  NewPassword: string;  // Capital N to match C# naming convention
  ConfirmPassword: string;  // Capital C to match C# naming convention
}

// Helper to create an empty reset password model
export const createEmptyResetPasswordModel = (): ResetPasswordModel => ({
  Token: '',
  NewPassword: ''
});

// Helper to create an empty change password model
export const createEmptyChangePasswordModel = (): ChangePasswordModel => ({
  OldPassword: '',
  NewPassword: '',
  ConfirmPassword: ''
});