import { useState, useCallback, useEffect } from 'react';
import { fetchProjectMembers, removeMemberFromProject } from '../services/projectService';
import { fetchUserById } from '../services/userService';

export const useProjectMembers = (projectId, projectOwnerID) => {
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

      // Format member data with full names
      const formattedMembers = await Promise.all(
        membersData.map(async (member) => {
          const userData = await fetchUserById(member.id);
          return {
            id: member.id,
            name: `${userData.firstName} ${userData.lastName}`,
            isOwner: member.id === projectOwnerID, // Explicitly check if the member is the project owner
          };
        })
      );

      // Sort members to ensure the owner is always at the top
      const sortedMembers = formattedMembers.sort((a, b) => {
        if (a.isOwner) return -1; // Owner comes first
        if (b.isOwner) return 1;
        return a.name.localeCompare(b.name); // Sort others alphabetically
      });

      setMembers(sortedMembers);
      setIsCurrentUserOwner(loggedInUserId === projectOwnerID); // Check if the logged-in user is the owner
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('❌ Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, projectOwnerID]);

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
