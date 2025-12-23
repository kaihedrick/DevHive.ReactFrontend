# DevHive React Frontend - Documentation Index

## Overview

This directory contains comprehensive documentation for the DevHive React Frontend project. All documentation is organized into three main categories:

- **System** - Architecture, design, and technical documentation
- **SOP** - Standard Operating Procedures for common development tasks
- **Tasks** - PRD and implementation plans for features (to be added as needed)

## Quick Navigation

### 🏗️ System Documentation

Core architecture and technical documentation:

- **[Project Architecture](./System/project_architecture.md)** - Complete overview of the system architecture, tech stack, project structure, and core components
- **[Authentication Architecture](./System/authentication_architecture.md)** - Detailed authentication flows, token management, and security measures ⚠️ **Updated 2025-12-23** with OAuth double refresh fix, auth initialization flag, comprehensive logout cleanup, JWT expiration parsing, iOS Safari fixes, and logout flow improvements
- **[Caching Strategy](./System/caching_strategy.md)** - React Query configuration, WebSocket cache invalidation, and caching patterns
- **[Realtime Messaging](./System/realtime_messaging.md)** - WebSocket implementation, messaging system, and PostgreSQL NOTIFY integration
- **[Invite Management](./System/invite_management.md)** - Project invite system, expiration logic, and frontend implementation
- **[File Reference](./System/file_reference.md)** - Quick reference map for key files and line numbers
- **[Risk Analysis](./System/risk_analysis.md)** - Risk areas, testing guidelines, and debugging tools

### 📋 Standard Operating Procedures (SOP)

Development procedures and guides:

- **[Environment Setup](./SOP/environment_setup.md)** - Development environment configuration and setup
- **[Development Workflow](./SOP/development_workflow.md)** - Common development tasks, code standards, and best practices
- **[Migration Guide](./SOP/migration_guide.md)** - Backend migration from .NET to Go + PostgreSQL
- **[Responsive Design](./SOP/responsive_design.md)** - Responsive design system, breakpoints, and utility classes

### 📝 Tasks

Feature PRDs and implementation plans:

- **[Google OAuth Implementation](./Tasks/google_oauth.md)** - Google OAuth 2.0 authentication implementation plan with "Remember Me" functionality
- **[Fix Google OAuth Cache Leak](./Tasks/fix_google_oauth_cache_leak.md)** - Fix data leakage where previous user's projects are visible after OAuth login
- **[Fix Authentication 15-Minute Logouts](./Tasks/fix_authentication_15min_logout.md)** - Fix random logouts after 15 minutes, token refresh issues, and operation flow problems ⚠️ **Updated 2025-12-23** with iOS Safari fixes, JWT expiration parsing, and retry logic

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
├── Tasks/                            # Feature PRDs and implementation plans
│   ├── google_oauth.md               # Google OAuth 2.0 implementation
│   ├── fix_google_oauth_cache_leak.md # OAuth cache leak fix
│   └── fix_authentication_15min_logout.md # 15-minute logout fix
└── SOP/                              # Standard Operating Procedures
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

1. Read **[Authentication Architecture](./System/authentication_architecture.md)** for complete auth flows ⚠️ **Updated 2025-12-23** with OAuth double refresh fix, auth initialization flag, comprehensive logout cleanup, JWT expiration parsing, iOS Safari fixes, logout flow improvements, and 401-only logout logic
2. Review **[Risk Analysis](./System/risk_analysis.md)** for critical areas to avoid breaking
3. Check **[File Reference](./System/file_reference.md)** for auth-related file locations

### For Understanding Caching & Real-time Updates

1. Read **[Caching Strategy](./System/caching_strategy.md)** for React Query and cache invalidation
2. Review **[Realtime Messaging](./System/realtime_messaging.md)** for WebSocket implementation
3. Check **[File Reference](./System/file_reference.md)** for cache-related file locations

### For Working on Features

1. Review **[Development Workflow](./SOP/development_workflow.md)** for standard procedures
2. Check relevant System documentation for architecture details
3. Reference **[File Reference](./System/file_reference.md)** for code locations
4. Review **[Risk Analysis](./System/risk_analysis.md)** before making auth/cache changes

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

