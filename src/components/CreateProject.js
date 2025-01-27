import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProject } from "../services/projectService";
import DevHiveLogo from './assets/DevHiveLogo.png';

const CreateProject = () => {
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createProject(projectName, projectDescription);
      alert("Project created successfully!");
      navigate("/projects"); // Navigate to project selection after creation
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Failed to create project. Please try again.");
    }
  };

  return (
    <div className="create-project-container">
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

        <button type="submit">Create Project</button>
      </form>

      <div className="back-arrow" onClick={() => navigate("/projects")}>
        &#x21A9;
      </div>

      <footer>copyright</footer>

      <style jsx>{`
        .create-project-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 1px solid #000;
          width: 400px;
          margin: 50px auto;
          padding: 20px;
          background-color: #fff;
        }

        .logo {
          width: 80px;
          margin-bottom: 10px;
        }

        h2 {
          margin-bottom: 20px;
        }

        input, textarea {
          width: 100%;
          padding: 10px;
          margin-bottom: 20px;
          border: 1px solid #000;
        }

        textarea {
          height: 100px;
        }

        button {
          background-color: #f0ad4e;
          color: white;
          border: none;
          padding: 10px 20px;
          cursor: pointer;
        }

        .back-arrow {
          cursor: pointer;
          font-size: 24px;
          margin-top: 10px;
          text-align: right;
          width: 100%;
        }

        footer {
          margin-top: 20px;
          text-align: center;
          border-top: 1px solid #000;
          padding-top: 10px;
          width: 100%;
        }
      `}</style>
    </div>
  );
};

export default CreateProject;
