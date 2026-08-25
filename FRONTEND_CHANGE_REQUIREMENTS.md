# Frontend Change Requirements

This document describes the frontend changes needed to match the current backend behavior.

## Core Behavior

- The app is now organization-scoped.
- Every user belongs to exactly one organization.
- Users can only see users and records from their own organization.
- Admin access is still required for user management.

## Authentication Flow

- `POST /api/signup` creates the first organization and the first admin account when no users exist yet.
- `POST /api/login` returns `user`, `token`, and `mustChangePassword`.
- `GET /api/me` returns the authenticated `user` object.
- `POST /api/auth/change-password` must be used before the app is usable when `mustChangePassword` is `true`.

## Required Frontend Changes

- Add a first-run signup screen for creating the initial admin and organization.
- Update the login flow to inspect `mustChangePassword` in the login response.
- Redirect users with `mustChangePassword: true` to a password change screen before showing the app.
- Add a password change form that calls `POST /api/auth/change-password`.
- Add an admin-only user management screen.
- When an admin adds a user, show the returned `temporaryPassword` immediately in the UI.
- Do not expect email delivery for new user passwords yet.
- Display the current organization name in the UI once it is available from the setup response or user context.

## User Management

- `GET /api/users` returns the users in the current organization only.
- `POST /api/users` creates a new user in the admin's organization.
- The frontend should treat `temporaryPassword` as a one-time secret for manual sharing.
- The frontend should make it clear that the new user must change the password on first login.

## Storage / Records

- Storage records are organization-scoped.
- The frontend does not need to change the basic record editing flow, but it must keep sending the authenticated token with every request.
- Admin users may receive additional record metadata such as `records`, `scope`, `userId`, and `username`.

## Environment

- The backend now expects PostgreSQL and TypeORM.
- Add the backend example environment file to the repository root as `.env.example`.
- The frontend should continue to use the configured API base URL and not hardcode storage paths.

## Suggested UI States

- Signup required.
- Login.
- Force password change.
- Normal application shell.
- Admin user management.
- Temporary password confirmation after creating a user.
