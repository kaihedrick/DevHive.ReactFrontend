/**
 * Represents an email request
 * Maps to the C# EmailRequest model in the backend
 */
export interface EmailRequest {
  To: string;  // Capital T to match C# property
  Subject: string;  // Capital S to match C# property
  Body: string;  // Capital B to match C# property
}

/**
 * Factory function to create email requests
 */
export const createEmailRequest = (to: string, subject: string, body: string): EmailRequest => {
  return {
    To: to,
    Subject: subject,
    Body: body
  };
};