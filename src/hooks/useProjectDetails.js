import { useState, useEffect, useCallback } from "react";
import { fetchProjectById, fetchProjectMembers, removeMemberFromProject } from "../services/projectService";
import { fetchUserById } from "../services/userService";

const useProjectDetails = (projectId) => {
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({
    projectError: null,
    membersError: null,
  });

  // ✅ Wrap fetchDetails in useCallback to avoid unnecessary re-renders
  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setErrors({ projectError: null, membersError: null });

    try {
      console.log("Fetching project details for ID:", projectId);
      const projectData = await fetchProjectById(projectId);
      setProject(projectData);

      let ownerFullName = "Unknown Owner";
      let ownerId = projectData?.projectOwnerID;

      console.log("Fetching project members...");
      const membersData = await fetchProjectMembers(projectId);
      let formattedMembers = membersData.map((member) => ({
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        isOwner: false,
      }));

      if (ownerId) {
        console.log("Fetching project owner details...");
        const ownerData = await fetchUserById(ownerId);
        ownerFullName = `${ownerData.firstName} ${ownerData.lastName}`;

        const ownerObject = { id: ownerId, name: ownerFullName, isOwner: true };
        formattedMembers = [ownerObject, ...formattedMembers.filter((m) => m.id !== ownerId)];
      }

      setMembers(formattedMembers);
    } catch (err) {
      setErrors({ projectError: err.message, membersError: err.message });
    }

    setLoading(false);
  }, [projectId]); // ✅ `useCallback` prevents unnecessary recreation of fetchDetails

  // ✅ Now useEffect correctly uses fetchDetails
  useEffect(() => {
    if (!projectId) {
      setErrors({ projectError: "No project selected.", membersError: null });
      setLoading(false);
      return;
    }

    fetchDetails();
  }, [projectId, fetchDetails]); // ✅ Now fetchDetails is correctly placed

  // ✅ Function to remove a member and refresh the list
  const kickMember = async (userId) => {
    if (!projectId || !userId) return;

    try {
      console.log(`🔥 Removing user ${userId} from project ${projectId}`);
      await removeMemberFromProject(projectId, userId);
      console.log(`✅ Successfully removed user ${userId}`);
      await fetchDetails();
    } catch (error) {
      console.error(`❌ Failed to remove user ${userId}:`, error.message);
    }
  };

  return { project, members, loading, errors, refreshProjectDetails: fetchDetails, kickMember };
};

export default useProjectDetails;
