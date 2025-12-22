import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getSelectedProject } from "../services/storageService";
import { useProjectMembers } from "../hooks/useProjects.ts";
import "../styles/contacts.css";
/**
 * Contacts Component
 *
 * Displays a list of project members excluding the currently logged-in user.
 * Enables navigation to the messaging page when a contact is clicked.
 * Now uses TanStack Query for caching.
 *
 * @returns {JSX.Element} A styled list of project contacts with avatars and basic info.
 *
 * @hook useProjectMembers - Fetches project members with caching
 * @hook useNavigate - Used to navigate to the messaging page with selected user and project IDs
 *
 * @function handleContactClick - Redirects to the messaging route for a specific user
 *
 * @styleOverrides - Injects a style override to apply a consistent secondary background color
 */
const Contacts = () => {
  const navigate = useNavigate();
  const loggedInUserId = localStorage.getItem("userId"); // Get logged-in user ID
  
  // Stabilize projectId to prevent remounts during navigation
  // Read once and memoize - don't re-read on every render
  // This prevents hooks from seeing null/value/null flips that cause remounts
  const projectId = useMemo(() => getSelectedProject(), []); // Only read once on mount

  // TanStack Query hook for data fetching
  const { data: membersData, isLoading: loading, error: queryError } = useProjectMembers(projectId);

  // Extract members array from response
  const members = useMemo(() => {
    if (!membersData) return [];
    return membersData.members || membersData || [];
  }, [membersData]);

  // Filter out logged-in user
  const contacts = useMemo(() => {
    return members.filter((member) => member.id !== loggedInUserId);
  }, [members, loggedInUserId]);

  // Convert error to string for display
  const error = queryError ? String(queryError) : null;

  const handleContactClick = (contactId) => {
    const projectId = getSelectedProject(); // Ensure project ID is used
    navigate(`/messages/${contactId}/${projectId}`); // Navigate to Messages Page with user ID & project ID
  };

  return (
    <>
      {/* This style tag will override the main content background */}
      <style>
        {`
          .content, main, body {
            background-color: var(--bg-secondary) !important;
          }
        `}
      </style>
      
      <div className="contacts-page with-footer-pad scroll-pad-bottom">
        <div className="contact-container">
          <div className="contact-header">
            <h1>Project Contacts</h1>
          </div>

          {loading && <p className="text-muted text-center">Loading contacts...</p>}
          {error && <p className="text-danger text-center">{error}</p>}

          <div className="contact-list">
            {contacts.length > 0 ? (
              contacts.map((contact) => (
                <div 
                  key={contact.id} 
                  className="contact-list-item"
                  onClick={() => handleContactClick(contact.id)}
                >
                  <div className="contact-info">
                    <div className="contact-avatar">
                      {contact.firstName.charAt(0)}{contact.lastName.charAt(0)}
                    </div>
                    <div className="contact-details">
                      <span className="contact-name">{contact.firstName} {contact.lastName}</span>
                      <span className="contact-email">{contact.email}</span>
                      <span className="contact-role">{contact.role}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              !loading && <p className="no-contacts-text">No contacts found.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Contacts;
