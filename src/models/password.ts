/**
 * @interface ResetPasswordModel
 * @property {string} Token - Unique token received via password reset email.
 * @property {string} NewPassword - New password to be set by the user.
 */
export interface ResetPasswordModel {
  Token: string;  // Capital T to match C# property
  NewPassword: string;  // Capital N to match C# property
}

/**
 * @interface ChangePasswordModel
 * @property {string} OldPassword - User's current password.
 * @property {string} NewPassword - Desired new password.
 * @property {string} ConfirmPassword - Confirmation of the new password.
 */

export interface ChangePasswordModel {
  OldPassword: string;  // Capital O to match C# naming convention
  NewPassword: string;  // Capital N to match C# naming convention
  ConfirmPassword: string;  // Capital C to match C# naming convention
}

/**
 * @function createEmptyResetPasswordModel
 * @returns {ResetPasswordModel} An object with empty values for reset password flow.
 */
export const createEmptyResetPasswordModel = (): ResetPasswordModel => ({
  Token: '',
  NewPassword: ''
});

/**
 * @function createEmptyChangePasswordModel
 * @returns {ChangePasswordModel} An object with empty values for change password form.
 */
export const createEmptyChangePasswordModel = (): ChangePasswordModel => ({
  OldPassword: '',
  NewPassword: '',
  ConfirmPassword: ''
});