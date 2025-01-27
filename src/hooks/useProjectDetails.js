import { useState, useEffect } from "react";
import { fetchProjectById, fetchProjectMembers } from "../services/projectService";

const useProjectDetails = (projectId) => {
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({
    projectError: null,
    membersError: null,
  });

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      setErrors({ projectError: null, membersError: null });

      try {
        const projectData = await fetchProjectById(projectId);
        setProject(projectData);
      } catch (err) {
        setErrors((prev) => ({
          ...prev,
          projectError: `Failed to fetch project details: ${err.response?.status} ${err.response?.statusText || err.message}`,
        }));
      }

      try {
        const membersData = await fetchProjectMembers(projectId);
        setMembers(membersData);
      } catch (err) {
        setErrors((prev) => ({
          ...prev,
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
