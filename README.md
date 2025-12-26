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
- Real-time updates via WebSocket cache invalidation.

### Communication
- Project-based messaging with real-time updates.
- PostgreSQL-backed persistent message history.

### Sprint Tracking
- Timeline and progress tracking for agile sprints.
- View sprint details and completion statuses.

### Responsive Design
- Optimized for desktop and tablet devices.
- Styled with modern CSS frameworks like Material-UI or Tailwind CSS.

---

## 🛠️ Tech Stack

- **React**: 18.3.1 - Functional components with React Hooks
- **TypeScript**: 4.9.5 - Type safety and enhanced developer experience
- **React Query**: 5.62.11 - Server state management and caching
- **React Router**: 7.0.2 - Client-side routing and navigation
- **WebSocket**: Real-time cache invalidation and messaging
- **Axios**: 1.7.9 - HTTP client for REST API calls
- **Bootstrap + TailwindCSS**: Modern responsive UI styling

**Backend**: Go + PostgreSQL (migrated from ASP.NET)

*For complete technical details, see [Project Architecture](./.agent/System/project_architecture.md)*

---

## 📈 Development Goals

1. Deliver a polished and scalable frontend aligned with DevHive's ecosystem.
2. Ensure extensibility for future feature enhancements.
3. Maintain accessibility compliance (WCAG standards).

---

## 📂 Project Structure

```plaintext
src/
├── components/      # React components (TypeScript + JavaScript)
├── contexts/        # React Context providers (Auth, Toast)
├── hooks/           # Custom React hooks (TypeScript + JavaScript)
├── services/        # API services and business logic
├── lib/            # Core utilities (API client, React Query)
├── styles/         # CSS stylesheets
├── models/         # TypeScript type definitions
├── utils/          # Utility functions
└── config/         # Configuration files

.agent/            # Comprehensive documentation
├── System/        # Architecture documentation
├── SOP/          # Standard Operating Procedures
├── Tasks/        # Feature PRDs and implementation plans
└── CSS/          # Styling architecture and design tokens
└── App.js           # Main application component
```

---

## 📚 Documentation

Comprehensive documentation for the DevHive React Frontend is available in the [`.agent/`](./.agent/) directory.

### Quick Links

- **[Documentation Index](./.agent/README.md)** - Complete documentation index and navigation
- **[Project Architecture](./.agent/System/project_architecture.md)** - System architecture overview
- **[Development Workflow](./.agent/SOP/development_workflow.md)** - Common development procedures
- **[Environment Setup](./.agent/SOP/environment_setup.md)** - Development environment setup
- **[Google OAuth Troubleshooting](./GOOGLE_OAUTH_TROUBLESHOOTING.md)** - Troubleshooting Google OAuth issues

### Documentation Structure

- **System/** - Architecture, design, and technical documentation
- **SOP/** - Standard Operating Procedures for development tasks
- **Tasks/** - Feature PRDs and implementation plans

For a complete list of all documentation, see the [Documentation Index](./.agent/README.md).
