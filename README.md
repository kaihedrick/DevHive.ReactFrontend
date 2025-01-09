# DevHive: React Frontend

The **React Frontend** for DevHive is a web-based user interface designed to empower agile teams through efficient communication and collaboration. This frontend is built to integrate seamlessly with the DevHive backend and provides tools for managing projects, tasks, and team interactions.

_Login Registration Iteration 1:_
![LoginRegistration](https://github.com/user-attachments/assets/7985909c-980b-43f3-8f63-ece0e19c0596)


---

## 🚀 Features

### User Authentication
- Register, log in, and manage user accounts.
- Secure authentication integrated with RESTful APIs.

### Project Management
- Create, edit, and view projects.
- Manage project details, including descriptions, team members, and tasks.

### Kanban Board Integration
- Interactive drag-and-drop Kanban board for task visualization and sprint planning.
- Real-time updates for collaborative task management.

### Task Management
- CRUD operations for tasks with assignment and progress tracking.
- Live updates using WebSockets or Firebase.

### Communication
- Direct messaging between users via Firebase's real-time database.
- Group chat integration within project workflows.

### Sprint Tracking
- Timeline and progress tracking for agile sprints.
- View sprint details and completion statuses.

### Responsive Design
- Optimized for desktop and tablet devices.
- Styled with modern CSS frameworks like Material-UI or Tailwind CSS.

---

## 🛠️ Tech Stack

- **React**: Version 18.x with functional components and React Hooks.
- **State Management**: Redux or Context API for global state handling.
- **Routing**: React Router for seamless navigation.
- **Backend API**: RESTful API communication with the ASP.NET backend.
- **Database**: Firebase for real-time messaging.
- **Styling**: Material-UI / Tailwind CSS for a modern, responsive design.

---

## 📈 Development Goals

1. Deliver a polished and scalable frontend aligned with DevHive's ecosystem.
2. Ensure extensibility for future feature enhancements.
3. Maintain accessibility compliance (WCAG standards).

---

## 📂 Project Structure

```plaintext
src/
├── components/      # Reusable React components
├── pages/           # Application pages (e.g., Dashboard, Login, Projects)
├── hooks/           # Custom React hooks
├── context/         # Global state management (Context API or Redux)
├── services/        # API and Firebase integration
├── utils/           # Utility functions and helpers
├── assets/          # Static files (images, CSS, etc.)
└── App.js           # Main application component
