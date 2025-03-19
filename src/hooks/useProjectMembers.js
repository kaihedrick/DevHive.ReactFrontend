import { useState, useCallback, useEffect } from 'react';
import { fetchProjectMembers, removeMemberFromProject } from '../services/projectService';
import { fetchUserById } from '../services/userService'; // Changed import source

export const useProjectMembers = (projectId) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMembers = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const membersData = await fetchProjectMembers(projectId);
      
      // Format member data with full names
      const formattedMembers = await Promise.all(membersData.map(async (member) => {
        const userData = await fetchUserById(member.id);
        return {
          id: member.id,
          name: `${userData.firstName} ${userData.lastName}`,
          isOwner: member.isOwner || false
        };
      }));

      setMembers(formattedMembers);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('❌ Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const kickMember = useCallback(async (memberId) => {
    try {
      await removeMemberFromProject(projectId, memberId);
      await fetchMembers();
    } catch (err) {
      setError(err.message);
      console.error('❌ Error kicking member:', err);
    }
  }, [projectId, fetchMembers]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return {
    members,
    loading,
    error,
    kickMember
  };
};
