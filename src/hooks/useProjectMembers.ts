import { useState, useCallback, useEffect } from 'react';
import { fetchProjectMembers, removeProjectMember } from '../services/projectService';
import { fetchUserById } from '../services/userService';
import { UseProjectMembersReturn, ProjectMember, User } from '../types/hooks.ts';

/**
 * useProjectMembers
 *
 * Custom hook for managing and retrieving project members.
 *
 * @param {string} projectId - The ID of the project to retrieve members for.
 * @param {string} projectOwnerID - The ID of the user who owns the project.
 * @returns {UseProjectMembersReturn} Project members state and operations
 */
export const useProjectMembers = (projectId: string, projectOwnerID: string): UseProjectMembersReturn => {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCurrentUserOwner, setIsCurrentUserOwner] = useState<boolean>(false);

  const fetchMembers = useCallback(async (): Promise<void> => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const loggedInUserId = localStorage.getItem('userId'); // Get the logged-in user's ID
      const response = await fetchProjectMembers(projectId);
      
      // Handle new API response structure - extract members array
      const membersData = response.members || response || [];
      
      // Ensure membersData is an array
      if (!Array.isArray(membersData)) {
        console.warn("⚠️ Expected members array but got:", typeof membersData, membersData);
        setMembers([]);
        setError("Invalid members data format");
        return;
      }

      // Format member data with full names
      const formattedMembers = await Promise.all(
        membersData.map(async (member: any): Promise<ProjectMember> => {
          const userData: User = await fetchUserById(member.id);
          return {
            id: member.id,
            name: `${userData.firstName} ${userData.lastName}`,
            isOwner: member.id === projectOwnerID || projectOwnerID, // Explicitly check if the member is the project owner
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
      setIsCurrentUserOwner(loggedInUserId === projectOwnerID || !!projectOwnerID); // Check if the logged-in user is the owner
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load project members');
      console.error('❌ Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, projectOwnerID]);

  const kickMember = useCallback(
    async (memberId: string): Promise<void> => {
      try {
        await removeProjectMember(projectId, memberId);
        await fetchMembers();
      } catch (err: any) {
        setError(err.message || 'Failed to remove member');
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
    isCurrentUserOwner,
    kickMember,
  };
};
