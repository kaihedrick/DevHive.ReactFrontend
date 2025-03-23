import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProjectMembers } from "../services/projectService";
import { fetchUserById } from "../services/userService";
import { getSelectedProject } from "../services/storageService";

import "../styles/contacts.css";

const Contacts = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loggedInUserId = localStorage.getItem("userId"); // Get logged-in user ID

  useEffect(() => {
    const loadContacts = async () => {
      setLoading(true);
      try {
        const projectId = getSelectedProject();
        if (!projectId) throw new Error("No project selected.");

        console.log(`Fetching members for project: ${projectId}`);
        const members = await fetchProjectMembers(projectId);
        console.log("Project Members Response:", members);

        // Ensure we only extract user IDs
        const memberIds = members.map(member => member.id);
        console.log("Extracted Member IDs:", memberIds);

        // Fetch user details based on IDs
        const membersDetails = await Promise.all(
          memberIds.map(async (userId) => {
            try {
              return await fetchUserById(userId);
            } catch (error) {
              console.error(`Error fetching user details for ${userId}:`, error);
              return null;
            }
          })
        );

        // Filter out null responses and hide logged-in user
        const filteredContacts = membersDetails
          .filter((user) => user !== null && user.id !== loggedInUserId);

        setContacts(filteredContacts);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadContacts();
  }, [loggedInUserId]); // Depend on loggedInUserId to reload if it changes

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
      
      <div className="contacts-page">
        <div className="contact-container">
          <div className="contact-header">
            <h1>📇 Project Contacts</h1>
            <p>Manage your project contacts here</p>
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
