import { useState, useEffect } from "react";
import { fetchProjectById, fetchProjectMembers } from "../services/projectService";
import { fetchUserById } from "../services/userService";

const useProjectDetails = (projectId) => {
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({
    projectError: null,
    membersError: null,
  });

  useEffect(() => {
    if (!projectId) {
      setErrors({ projectError: "No project selected.", membersError: null });
      setLoading(false);
      return;
    }

    const fetchDetails = async () => {
      setLoading(true);
      setErrors({ projectError: null, membersError: null });

      try {
        console.log("Fetching project details for ID:", projectId);
        const projectData = await fetchProjectById(projectId);
        setProject(projectData);

        let ownerFullName = "Unknown Owner";
        let ownerId = projectData?.projectOwnerID;

        let formattedMembers = [];

        // Fetch Members
        console.log("Fetching project members...");
        const membersData = await fetchProjectMembers(projectId);
        formattedMembers = membersData.map((member) => ({
          id: member.id,
          name: `${member.firstName} ${member.lastName}`,
          isOwner: false,
        }));

        // Fetch Project Owner
        if (ownerId) {
          console.log("Fetching project owner details...");
          const ownerData = await fetchUserById(ownerId);
          ownerFullName = `${ownerData.firstName} ${ownerData.lastName}`;

          // Ensure the owner is included **only once**
          const ownerObject = {
            id: ownerId,
            name: ownerFullName,
            isOwner: true,
          };

          formattedMembers = [ownerObject, ...formattedMembers.filter((m) => m.id !== ownerId)];
        }

        // Set Members
        setMembers(formattedMembers);
      } catch (err) {
        setErrors((prev) => ({
          ...prev,
          projectError: `Failed to fetch project details: ${err.response?.status} ${err.response?.statusText || err.message}`,
          membersError: `Failed to fetch project members: ${err.response?.status} ${err.response?.statusText || err.message}`,
        }));
      }

      setLoading(false);
    };

    fetchDetails();
  }, [projectId]);

  return {
    project,
    members,
    loading,
    errors,
  };
};

export default useProjectDetails;
