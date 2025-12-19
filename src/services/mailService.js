// src/services/mailService.js
import { api } from '../lib/apiClient.ts';
import { ENDPOINTS } from '../config';

/**
 * @function sendEmail
 * @description Sends an email using the Go backend mail service
 * @param {Object} emailData - The email data
 * @param {string} emailData.to - Recipient email address
 * @param {string} emailData.subject - Email subject
 * @param {string} emailData.body - Plain text body
 * @param {string} [emailData.html] - HTML body (optional)
 * @returns {Promise<Object>} - The response from the mail service
 */
export const sendEmail = async (emailData) => {
  try {
    const payload = {
      to: emailData.to,
      subject: emailData.subject,
      body: emailData.body,
      ...(emailData.html && { html: emailData.html })
    };

    console.log("📧 Sending email:", payload);

    const response = await api.post(ENDPOINTS.MAIL_SEND, payload);

    console.log("✅ Email sent successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error sending email:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * @function sendPasswordResetEmail
 * @description Sends a password reset email with a reset link
 * @param {string} email - Recipient email address
 * @param {string} resetToken - Password reset token
 * @param {string} [userName] - User's name for personalization
 * @returns {Promise<Object>} - The response from the mail service
 */
export const sendPasswordResetEmail = async (email, resetToken, userName = 'User') => {
  const resetLink = `${window.location.origin}/reset-password?token=${resetToken}`;
  
  const emailData = {
    to: email,
    subject: 'DevHive - Password Reset Request',
    body: `Hello ${userName},\n\nYou requested a password reset for your DevHive account.\n\nClick the link below to reset your password:\n${resetLink}\n\nThis link will expire in 24 hours.\n\nIf you didn't request this reset, please ignore this email.\n\nBest regards,\nThe DevHive Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hello ${userName},</p>
        <p>You requested a password reset for your DevHive account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't request this reset, please ignore this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 14px;">Best regards,<br>The DevHive Team</p>
      </div>
    `
  };

  return sendEmail(emailData);
};

/**
 * @function sendWelcomeEmail
 * @description Sends a welcome email to new users
 * @param {string} email - Recipient email address
 * @param {string} userName - User's name
 * @returns {Promise<Object>} - The response from the mail service
 */
export const sendWelcomeEmail = async (email, userName) => {
  const emailData = {
    to: email,
    subject: 'Welcome to DevHive!',
    body: `Hello ${userName},\n\nWelcome to DevHive! Your account has been successfully created.\n\nYou can now start collaborating with your team and managing your projects.\n\nIf you have any questions, feel free to reach out to our support team.\n\nBest regards,\nThe DevHive Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to DevHive!</h2>
        <p>Hello ${userName},</p>
        <p>Welcome to DevHive! Your account has been successfully created.</p>
        <p>You can now start collaborating with your team and managing your projects.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">What's next?</h3>
          <ul style="color: #666;">
            <li>Create your first project</li>
            <li>Invite team members</li>
            <li>Set up your first sprint</li>
            <li>Start tracking tasks</li>
          </ul>
        </div>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 14px;">Best regards,<br>The DevHive Team</p>
      </div>
    `
  };

  return sendEmail(emailData);
};

/**
 * @function sendProjectInviteEmail
 * @description Sends a project invitation email
 * @param {string} email - Recipient email address
 * @param {string} projectName - Name of the project
 * @param {string} inviterName - Name of the person who invited them
 * @param {string} [projectId] - Project ID for the invite link
 * @returns {Promise<Object>} - The response from the mail service
 */
export const sendProjectInviteEmail = async (email, projectName, inviterName, projectId = null) => {
  const inviteLink = projectId ? `${window.location.origin}/projects/${projectId}` : `${window.location.origin}/projects`;
  
  const emailData = {
    to: email,
    subject: `You've been invited to join "${projectName}" on DevHive`,
    body: `Hello,\n\n${inviterName} has invited you to join the project "${projectName}" on DevHive.\n\nClick the link below to view the project:\n${inviteLink}\n\nIf you don't have a DevHive account yet, you'll need to create one first.\n\nBest regards,\nThe DevHive Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Project Invitation</h2>
        <p>Hello,</p>
        <p><strong>${inviterName}</strong> has invited you to join the project <strong>"${projectName}"</strong> on DevHive.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" 
             style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            View Project
          </a>
        </div>
        <p>If you don't have a DevHive account yet, you'll need to create one first.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 14px;">Best regards,<br>The DevHive Team</p>
      </div>
    `
  };

  return sendEmail(emailData);
};

const mailService = {
  sendEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendProjectInviteEmail
};

export default mailService;
