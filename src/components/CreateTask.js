import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createTask, fetchProjectMembers, fetchProjectSprints, getSelectedProject } from "../services/projectService";
import "../styles/create_task.css";

const CreateTask = ({ projectId }) => {
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [assigneeID, setAssigneeID] = useState("");
  const [sprintID, setSprintID] = useState("");
  const [members, setMembers] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  // ✅ Get Project ID (from props or localStorage)
  const selectedProjectId = projectId || getSelectedProject();

  useEffect(() => {
    console.log("🔍 Using Project ID:", selectedProjectId);

    if (!selectedProjectId) {
      console.error("❌ No Project ID found.");
      setErrorMessage("No Project ID found. Please select a project.");
      return;
    }

    const loadData = async () => {
      try {
        console.log("🔄 Fetching project members...");
        const projectMembers = await fetchProjectMembers(selectedProjectId);
        console.log("✅ Members Loaded:", projectMembers);

        console.log("🔄 Fetching project sprints...");
        const projectSprints = await fetchProjectSprints(selectedProjectId);
        console.log("✅ Sprints Loaded:", projectSprints);

        setMembers(projectMembers || []);
        setSprints(projectSprints || []);
      } catch (error) {
        console.error("❌ Error loading members or sprints:", error);
        setErrorMessage("Failed to load project data.");
      }
    };

    loadData();
  }, [selectedProjectId]); // ✅ Dependency Updated

  const handleCreateTask = async () => {
    if (!description || !assigneeID || !sprintID) {
      setErrorMessage("All fields are required!");
      setTimeout(() => setErrorMessage(""), 2000);
      return;
    }

    try {
      const taskData = {
        description,
        assigneeID,
        dateCreated: new Date().toISOString(), // ✅ Automatically generate date
        status: 0, // Default status
        sprintID,
      };

      await createTask(taskData);
      navigate("/backlog"); // ✅ Redirect to backlog after creation
    } catch (error) {
      console.error("❌ Error creating task:", error);
      setErrorMessage("Task creation failed.");
      setTimeout(() => setErrorMessage(""), 2000);
    }
  };

  return (
    <div className="create-task-container">
      {errorMessage && <div className="error-popup">{errorMessage}</div>}

      <div className="create-task-card">
        <h2>Create Task</h2>

        <input
          type="text"
          placeholder="Enter Task Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <label>Assignee:</label>
        <select value={assigneeID} onChange={(e) => setAssigneeID(e.target.value)}>
          <option value="">Select Assignee</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.firstName} {member.lastName}
            </option>
          ))}
        </select>

        <label>Sprint:</label>
        <select value={sprintID} onChange={(e) => setSprintID(e.target.value)}>
          <option value="">Select Sprint</option>
          {sprints.map((sprint) => (
            <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
          ))}
        </select>

        <button className="create-task-btn" onClick={handleCreateTask}>
          Create Task
        </button>
      </div>
    </div>
  );
};

export default CreateTask;
