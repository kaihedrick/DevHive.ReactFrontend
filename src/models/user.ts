/**
 * @interface UserModel
 * Defines the structure of a user as expected by the backend.
 * @property {string} ID - Unique identifier of the user.
 * @property {string} Username - User's login name.
 * @property {string} Password - User's password.
 * @property {string} Email - User's email address.
 * @property {string} FirstName - User's first name.
 * @property {string} LastName - User's last name.
 * @property {boolean} Active - Indicates if the user account is active.
 * @property {string} [ConfirmPassword] - Used for client-side validation only.
 */
export interface UserModel {
  ID: string;  
  Username: string;  
  Password: string;  
  Email: string;  
  FirstName: string;  
  LastName: string;  
  Active: boolean;  
  ConfirmPassword?: string; 
}
/**
 * @interface LoginModel
 * Defines the structure for login credentials.
 * @property {string} Username - The user's login name.
 * @property {string} Password - The user's password.
 */
export interface LoginModel {
  Username: string;  
  Password: string;  
}

/**
 * @class UserProfile
 * Wrapper for user data with derived properties.
 * @method fullName - Returns full name from first and last name.
 * @method initials - Returns user initials in uppercase.
 * @method data - Returns original UserModel object.
 */
export class UserProfile {
  constructor(private user: UserModel) {}

  get fullName(): string {
    return `${this.user.FirstName} ${this.user.LastName}`;
  }
  
  get initials(): string {
    return `${this.user.FirstName.charAt(0)}${this.user.LastName.charAt(0)}`.toUpperCase();
  }
  
  // Original user data is accessible
  get data(): UserModel {
    return this.user;
  }
}


/**
 * @interface UserCredentials
 * Represents basic login credentials.
 * @property {string} username - Username used for login.
 * @property {string} password - Password used for login.
 */
export interface UserCredentials {
  username: string;
  password: string;
}

/**
 * @interface UserRegistration
 * Extends UserModel without ID and Active fields. Used for frontend form data.
 * @property {string} password - New password for the user.
 * @property {string} confirmPassword - Re-entered password for validation.
 */
export interface UserRegistration extends Omit<UserModel, 'ID' | 'Active'> {
  password: string;
  confirmPassword: string;
}

/**
 * @function createEmptyUserModel
 * Generates an empty user model object with default values.
 * @returns {UserModel}
 */
export const createEmptyUserModel = (): UserModel => ({
  ID: '',
  Username: '',
  Email: '',
  FirstName: '',
  LastName: '',
  Password: '',
  Active: false,
  ConfirmPassword: ''
});

/**
 * @interface RegistrationFormModel
 * Represents user input from the registration form.
 * @property {string} Username - Desired username.
 * @property {string} Password - Password for the account.
 * @property {string} ConfirmPassword - Password confirmation for validation.
 * @property {string} Email - Email address for the account.
 * @property {string} FirstName - User's first name.
 * @property {string} LastName - User's last name.
 */
export interface RegistrationFormModel {
  Username: string;
  Password: string;
  ConfirmPassword: string;
  Email: string;
  FirstName: string;
  LastName: string;
}

/**
 * @function createEmptyRegistrationForm
 * Generates a blank form model for registration inputs.
 * @returns {RegistrationFormModel}
 */
export const createEmptyRegistrationForm = (): RegistrationFormModel => ({
  Username: '',
  Password: '',
  ConfirmPassword: '',
  Email: '',
  FirstName: '',
  LastName: ''
});

/**
 * @function convertToUserModel
 * Converts form input data to a UserModel object for submission.
 * @param {RegistrationFormModel} form - Form values from the registration UI.
 * @returns {UserModel}
 */
export const convertToUserModel = (form: RegistrationFormModel): UserModel => ({
  ID: '',
  Username: form.Username,
  Password: form.Password,
  Email: form.Email,
  FirstName: form.FirstName,
  LastName: form.LastName,
  Active: true
});

