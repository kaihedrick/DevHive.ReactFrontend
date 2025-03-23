/**
 * Represents a user in the system
 * Maps to the C# UserModel in the backend
 */
export interface UserModel {
  ID: string;  // Capital ID to match C# property
  Username: string;  // Capital U to match C# property
  Password: string;  // Capital P to match C# property
  Email: string;  // Capital E to match C# property
  FirstName: string;  // Capital F and N to match C# property
  LastName: string;  // Capital L and N to match C# property
  Active: boolean;  // Capital A to match C# property
  ConfirmPassword?: string; // Added for frontend use only
}

/**
 * For user login
 * Maps to C# LoginModel
 */
export interface LoginModel {
  Username: string;  // Capital U to match C# property
  Password: string;  // Capital P to match C# property
}

/**
 * Interface for user profile display with computed properties
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
 * Interface for user authentication credentials
 */
export interface UserCredentials {
  username: string;
  password: string;
}

/**
 * Interface for user registration form data
 */
export interface UserRegistration extends Omit<UserModel, 'ID' | 'Active'> {
  password: string;
  confirmPassword: string;
}

// Create an empty user model
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

// Frontend-specific model for registration form
export interface RegistrationFormModel {
  Username: string;
  Password: string;
  ConfirmPassword: string;
  Email: string;
  FirstName: string;
  LastName: string;
}

// Create an empty registration form model
export const createEmptyRegistrationForm = (): RegistrationFormModel => ({
  Username: '',
  Password: '',
  ConfirmPassword: '',
  Email: '',
  FirstName: '',
  LastName: ''
});

// Convert registration form to UserModel for API calls
export const convertToUserModel = (form: RegistrationFormModel): UserModel => ({
  ID: '',
  Username: form.Username,
  Password: form.Password,
  Email: form.Email,
  FirstName: form.FirstName,
  LastName: form.LastName,
  Active: true
});

