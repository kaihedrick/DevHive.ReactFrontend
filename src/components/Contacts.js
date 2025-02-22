import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProjectMembers } from "../services/projectService";
import { fetchUserById } from "../services/userService";
import { getSelectedProject } from "../services/projectService";
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
    <div className="container mt-4">
      <h2 className="text-center">📇 Project Contacts</h2>

      {loading && <p className="text-muted text-center">Loading contacts...</p>}
      {error && <p className="text-danger text-center">{error}</p>}

      <ul className="list-group mt-3">
        {contacts.length > 0 ? (
          contacts.map((contact) => (
            <li 
              key={contact.id} 
              className="list-group-item d-flex align-items-center contact-item"
              onClick={() => handleContactClick(contact.id)}
            >
              <strong>{contact.firstName} {contact.lastName}</strong>
            </li>
          ))
        ) : (
          !loading && <p className="text-center text-muted">No contacts found.</p>
        )}
      </ul>
    </div>
  );
};

export default Contacts;
