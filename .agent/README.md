# DevHive React Frontend - Documentation Index

## Overview

This directory contains comprehensive documentation for the DevHive React Frontend project. All documentation is organized into these categories:

- **System** - Architecture, design, and technical documentation
- **SOP** - Standard Operating Procedures for common development tasks
- **Tasks** - PRD and implementation plans for features
- **CSS** - Styling architecture (bounded subsystem with dedicated docs)

## Quick Navigation

### 🏗️ System Documentation

Core architecture and technical documentation:

- **[Project Architecture](./System/project_architecture.md)** - Complete overview of the system architecture, tech stack, project structure, and core components
- **[Authentication Architecture](./System/authentication_architecture.md)** - Detailed authentication flows, token management, and security measures ⚠️ **Updated 2025-12-28** - Auth error handling fixes: Axios 401 interceptor skips redirect on auth endpoints, UI error extraction prefers backend messages. Previous (2025-12-26): Refresh token expiration event handling, OAuth double refresh fix, auth initialization flag, comprehensive logout cleanup, JWT expiration parsing, iOS Safari fixes
- **[Caching Strategy](./System/caching_strategy.md)** - React Query configuration, WebSocket cache invalidation, predicate-based invalidation, and caching patterns ⚠️ **Updated 2025-12-28** - WebSocket fallback refetch on send success, multi-source projectId extraction, empty-string safety checks, camelCase subscribe payload. Previous (2025-12-27): User-scoped cache persistence prevents cross-user cache leakage
- **[Realtime Messaging](./System/realtime_messaging.md)** - WebSocket implementation, messaging system, and PostgreSQL NOTIFY integration ⚠️ **Updated 2025-12-28** - WebSocket error handling & fallback mechanisms: multi-source projectId extraction, fallback refetch, build version tracking. CamelCase subscribe payload fix (`projectId` not `project_id`). Debug logging for subscribe success/failure
- **[Invite Management](./System/invite_management.md)** - Project invite system, expiration logic, and frontend implementation
- **[File Reference](./System/file_reference.md)** - Quick reference map for key files and line numbers
- **[Risk Analysis](./System/risk_analysis.md)** - Risk areas, testing guidelines, and debugging tools

### 📋 Standard Operating Procedures (SOP)

Development procedures and guides:

- **[Error Handling](./SOP/error_handling.md)** - Error handling patterns for auth, API, and WebSocket errors ⚠️ **NEW 2025-12-28** - Auth 401 handling, error message extraction, WebSocket fallbacks, build version tracking
- **[Environment Setup](./SOP/environment_setup.md)** - Development environment configuration and setup
- **[Development Workflow](./SOP/development_workflow.md)** - Common development tasks, code standards, and best practices
- **[Migration Guide](./SOP/migration_guide.md)** - Backend migration from .NET to Go + PostgreSQL
- **[Responsive Design](./SOP/responsive_design.md)** - Responsive design system, breakpoints, and utility classes

### 📝 Tasks

Feature PRDs and implementation plans:

- **[Google OAuth Implementation](./Tasks/google_oauth.md)** - Google OAuth 2.0 authentication implementation plan with "Remember Me" functionality
- **[Fix Google OAuth Cache Leak](./Tasks/fix_google_oauth_cache_leak.md)** - Fix data leakage where previous user's projects are visible after OAuth login
- **[Fix Authentication 15-Minute Logouts](./Tasks/fix_authentication_15min_logout.md)** - Fix random logouts after 15 minutes, token refresh issues, and operation flow problems ⚠️ **Updated 2025-12-23** with iOS Safari fixes, JWT expiration parsing, and retry logic
- **[Fix Message Realtime Updates](./Tasks/fix_message_realtime_updates.md)** - Investigate and fix messages not updating in real-time (dual system: immediate broadcasts + database triggers)
- **[Fix Realtime Cache Invalidation](./Tasks/fix_realtime_cache_invalidation.md)** - Comprehensive fix for real-time messaging, member updates, and cache invalidation gaps ⚠️ **NEW** - Backend needs `broadcast.Send()` for messages and database trigger for `messages` table

### 🎨 CSS Styling Architecture

**CSS is a first-class subsystem with bounded documentation.**

- **[CSS Architecture](./CSS/architecture.md)** - Design philosophy, CSS methodology, constraints
- **[Design Tokens](./CSS/tokens.md)** - Colors, spacing, typography, shadows
- **[Layout System](./CSS/layout.md)** - Grid, flexbox patterns, breakpoints
- **[Component Styles](./CSS/components.md)** - Reusable UI component styles
- **[Utility Classes](./CSS/utilities.md)** - Helper classes for common patterns
- **[Theming](./CSS/theming.md)** - Dark mode, theme variants, CSS variables
- **[Anti-Patterns](./CSS/anti-patterns.md)** - What NOT to do
- **[Changelog](./CSS/changelog.md)** - Style-impacting changes history

## Documentation Structure

```
.agent/
├── README.md                          # This file - documentation index
├── System/                            # System architecture documentation
│   ├── project_architecture.md       # Main architecture overview
│   ├── authentication_architecture.md # Auth system details
│   ├── caching_strategy.md            # Cache system details
│   ├── realtime_messaging.md          # WebSocket and messaging
│   ├── invite_management.md           # Invite system
│   ├── file_reference.md              # Quick file reference
│   └── risk_analysis.md               # Risk areas and testing
├── CSS/                              # CSS styling architecture (bounded subsystem)
│   ├── architecture.md               # Design philosophy & constraints
│   ├── tokens.md                     # Colors, spacing, typography
│   ├── layout.md                     # Grid, flex, breakpoints
│   ├── components.md                 # Reusable UI components
│   ├── utilities.md                  # Utility / helper classes
│   ├── theming.md                    # Dark mode, variants
│   ├── anti-patterns.md              # What NOT to do
│   └── changelog.md                  # Style-impacting changes
├── Tasks/                            # Feature PRDs and implementation plans
│   ├── google_oauth.md               # Google OAuth 2.0 implementation
│   ├── fix_google_oauth_cache_leak.md # OAuth cache leak fix
│   └── fix_authentication_15min_logout.md # 15-minute logout fix
└── SOP/                              # Standard Operating Procedures
    ├── error_handling.md             # Error handling patterns (NEW 2025-12-28)
    ├── environment_setup.md          # Environment configuration
    ├── development_workflow.md       # Development procedures
    ├── migration_guide.md            # Backend migration
    └── responsive_design.md          # Design system
```

## Getting Started

### For New Developers

1. Start with **[Project Architecture](./System/project_architecture.md)** to understand the overall system
2. Read **[Environment Setup](./SOP/environment_setup.md)** to set up your development environment
3. Review **[Development Workflow](./SOP/development_workflow.md)** for common development tasks
4. Reference **[File Reference](./System/file_reference.md)** when looking for specific code locations

### For Understanding Authentication

1. Read **[Authentication Architecture](./System/authentication_architecture.md)** for complete auth flows ⚠️ **Updated 2025-12-28** - Auth error handling fixes (401 interceptor, error extraction)
2. Review **[Error Handling SOP](./SOP/error_handling.md)** for auth error patterns and best practices ⚠️ **NEW 2025-12-28**
3. Review **[Risk Analysis](./System/risk_analysis.md)** for critical areas to avoid breaking
4. Check **[File Reference](./System/file_reference.md)** for auth-related file locations

### For Understanding Caching & Real-time Updates

1. Read **[Caching Strategy](./System/caching_strategy.md)** for React Query, user-scoped persistence, predicate-based invalidation, and cache patterns ⚠️ **Updated 2025-12-28** - WebSocket fallback refetch, multi-source projectId extraction
2. Review **[Realtime Messaging](./System/realtime_messaging.md)** for WebSocket implementation and message flow ⚠️ **Updated 2025-12-28** - WebSocket error handling & fallback mechanisms
3. Review **[Error Handling SOP](./SOP/error_handling.md)** for WebSocket error patterns and fallback mechanisms ⚠️ **NEW 2025-12-28**
4. Check **[File Reference](./System/file_reference.md)** for cache-related file locations

### For Working on Features

1. Review **[Development Workflow](./SOP/development_workflow.md)** for standard procedures
2. Check relevant System documentation for architecture details
3. Reference **[File Reference](./System/file_reference.md)** for code locations
4. Review **[Risk Analysis](./System/risk_analysis.md)** before making auth/cache changes

### For Working on Styling

1. Read **[CSS Architecture](./CSS/architecture.md)** for methodology and constraints
2. Reference **[Design Tokens](./CSS/tokens.md)** - never hardcode values
3. Check **[Layout System](./CSS/layout.md)** for responsive patterns
4. Review **[Anti-Patterns](./CSS/anti-patterns.md)** to avoid common mistakes
5. Update **[Changelog](./CSS/changelog.md)** for any style-impacting changes

---

## CSS Agent Prompting Pattern

**CRITICAL: CSS is a first-class subsystem with bounded documentation.**

### When to Read CSS Docs

Read CSS documentation when the task involves:
- Styling changes (colors, spacing, typography, layout)
- Responsive design or breakpoint adjustments
- Component visual appearance
- Theme modifications (dark mode, variants)
- Adding new UI components with custom styles
- Fixing layout/alignment issues

### When to Write CSS Docs

Update CSS documentation when:
- Adding new design tokens (colors, spacing, etc.)
- Creating new reusable CSS patterns
- Modifying breakpoint behavior
- Adding utility classes
- Changing theming system
- Documenting anti-patterns discovered

### CSS Documentation Isolation Rules

| Rule | Description |
|------|-------------|
| **NEVER** | Mix CSS docs with JS/TS logic documentation |
| **NEVER** | Document API calls, state management, or auth in CSS docs |
| **NEVER** | Update feature PRDs for styling-only changes |
| **ALWAYS** | Update `CSS/changelog.md` for style-impacting changes |
| **ALWAYS** | Reference tokens from `CSS/tokens.md` - never hardcode values |
| **ALWAYS** | Keep CSS docs self-contained within `.agent/CSS/` |

### CSS File Locations

```
src/styles/
├── index.css              # Global styles, CSS variables, resets
├── utilities.css          # Utility classes
├── backlog.css            # Component: Backlog
├── board.css              # Component: Board
├── projectDetails.css     # Component: Project Details
├── taskInspector.css      # Component: Task Inspector
└── ...
```

---

## Documentation Principles

### Single Source of Truth
- Each topic has one primary documentation file
- Related topics cross-reference each other
- No duplicate information across files

### Progressive Detail
- Start with high-level overview (Project Architecture)
- Drill down into specific systems (Authentication, Caching)
- Reference detailed procedures (SOP documents)

### Cross-References
- All documentation files include "Related Documentation" sections
- Clear navigation paths between related topics
- Quick links to relevant files

## Updating Documentation

When updating documentation:

1. **Read existing docs first** - Check if information already exists
2. **Update relevant sections** - Don't create duplicates
3. **Add cross-references** - Link to related documentation
4. **Update this index** - Add new documents to the appropriate section
5. **Update main README** - Ensure main README points to new docs

## Related Documentation

- [Main README](../README.md) - Project overview and quick start
- [CLAUDE.md](../CLAUDE.md) - Documentation standards and structure

