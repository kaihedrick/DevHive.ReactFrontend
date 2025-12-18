import { useState, useCallback, useEffect } from 'react';
import { fetchProjectMembers, removeMemberFromProject } from '../services/projectService';
/**
 * useProjectMembers
 *
 * Custom hook for managing and retrieving project members.
 *
 * @param {string} projectId - The ID of the project to retrieve members for.
 * @param {string} projectOwnerId - The ID of the user who owns the project.
 * @returns {Object} An object containing:
 *  - members: Array of project members with name and ownership flag.
 *  - loading: Boolean indicating loading state.
 *  - error: Any error encountered during fetch.
 *  - isCurrentUserOwner: Boolean indicating if the logged-in user is the project owner.
 *  - kickMember: Function to remove a member from the project.
 *
 * @example
 * const { members, loading, error, isCurrentUserOwner, kickMember } = useProjectMembers(projectId, ownerId);
 */
export const useProjectMembers = (projectId, projectOwnerId) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCurrentUserOwner, setIsCurrentUserOwner] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const loggedInUserId = localStorage.getItem('userId'); // Get the logged-in user's ID
      const membersData = await fetchProjectMembers(projectId);

      // Format member data - members already contain full user objects from backend
      const formattedMembers = membersData.map((member) => ({
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        isOwner: member.id === projectOwnerId, // Explicitly check if the member is the project owner
      }));

      // Sort members to ensure the owner is always at the top
      const sortedMembers = formattedMembers.sort((a, b) => {
        if (a.isOwner) return -1; // Owner comes first
        if (b.isOwner) return 1;
        return a.name.localeCompare(b.name); // Sort others alphabetically
      });

      setMembers(sortedMembers);
      setIsCurrentUserOwner(loggedInUserId === projectOwnerId); // Check if the logged-in user is the owner
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('❌ Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, projectOwnerId]);

  const kickMember = useCallback(
    async (memberId) => {
      try {
        await removeMemberFromProject(projectId, memberId);
        await fetchMembers();
      } catch (err) {
        setError(err.message);
        console.error('❌ Error kicking member:', err);
      }
    },
    [projectId, fetchMembers]
  );

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return {
    members,
    loading,
    error,
    isCurrentUserOwner, // Return whether the current user is the owner
    kickMember,
  };
};
