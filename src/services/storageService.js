export const setSelectedProject = (projectId) => {
    localStorage.setItem("selectedProjectId", projectId);
  };
  
  export const getSelectedProject = () => {
    return localStorage.getItem("selectedProjectId");
  };
  
  
  export const clearSelectedProject = () => {
    localStorage.removeItem("selectedProjectId");
  };
  