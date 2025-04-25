/**
 * @interface EmailRequest
 * @property {string} To - Recipient email address (capitalized to match C# backend).
 * @property {string} Subject - Email subject line.
 * @property {string} Body - Email body content.
 */
export interface EmailRequest {
  To: string;  // Capital T to match C# property
  Subject: string;  // Capital S to match C# property
  Body: string;  // Capital B to match C# property
}

/**
 * @function createEmailRequest
 * @param {string} to - Recipient email address.
 * @param {string} subject - Email subject line.
 * @param {string} body - Email body content.
 * @returns {EmailRequest} A constructed email request object.
 */
export const createEmailRequest = (to: string, subject: string, body: string): EmailRequest => {
  return {
    To: to,
    Subject: subject,
    Body: body
  };
};

/**
 * @function createEmptyEmailRequest
 * @returns {EmailRequest} An empty email request template with default values.
 */
export const createEmptyEmailRequest = (): EmailRequest => ({
  To: '',
  Subject: '',
  Body: ''
});