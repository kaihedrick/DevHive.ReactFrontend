import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProject } from "../services/projectService";
import DevHiveLogo from "./assets/DevHiveLogo.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"; // ✅ FontAwesome import
import { faArrowRotateLeft } from "@fortawesome/free-solid-svg-icons"; // ✅ Specific icon import
import "../styles/create_project.css"; // ✅ Import CSS file

const CreateProject = () => {
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createProject(projectName, projectDescription);
      alert("Project created successfully!");
      navigate("/projects");
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Failed to create project. Please try again.");
    }
  };

  return (
    <div className="create-project-container">
      {/*  Back arrow moved inside the card, in the top-right */}
      <div className="back-arrow" onClick={() => navigate("/projects")}>
        <FontAwesomeIcon icon={faArrowRotateLeft} />
      </div>

      <img src={DevHiveLogo} alt="DevHive Logo" className="logo" />
      <h2>Create Project</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Enter Project Name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          required
        />

        <textarea
          placeholder="Enter Description"
          value={projectDescription}
          onChange={(e) => setProjectDescription(e.target.value)}
          required
        ></textarea>

        <button type="submit" className="create-project-btn">
          Create Project
        </button>
      </form>

      <footer>Copyright</footer>
    </div>
  );
};

export default CreateProject;
