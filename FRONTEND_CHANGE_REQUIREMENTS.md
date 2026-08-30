# Frontend Integration Guide

This document describes how the frontend should interact with the current backend.

## Tech Stack

- **Backend:** Node.js, TypeScript, Express, TypeORM, PostgreSQL
- **Auth:** Custom HMAC-signed bearer tokens (not JWT)
- **Storage:** Key-value store used for customer request/application records
- **Multi-tenancy:** Every user belongs to exactly one organization; all data is org-scoped

---

## Authentication Flow

### 1. Signup (first-run or new organization)

`POST /api/signup` creates a new organization and the first admin. Anyone can sign up — each signup creates its own org.

```
POST /api/signup
Body: { username, password, email?, organizationName? }
→ 201: { username, email, token, message }
```

- Store `token` for subsequent requests.
- The user is automatically admin of their new organization.

### 2. Login

```
POST /api/login
Body: { username, password }  (or { email, password })
→ 200: { username, token, user, mustChangePassword }
```

- Check `mustChangePassword`. If `true`, redirect to password change screen before showing the app.

### 3. Force Password Change

New users created by an admin start with `mustChangePassword: true`. All protected endpoints return **428** until the password is changed.

```
POST /api/auth/change-password
Headers: Authorization: Bearer <token>
Body: { currentPassword, newPassword }
→ 200: { user, message }
```

### 4. Authenticated Requests

All protected endpoints require the `Authorization` header:

```
Authorization: Bearer <token>
```

### 5. Logout

```
POST /api/logout
Headers: Authorization: Bearer <token>
→ 200: { ok: true }
```

Clear the stored token on the client side.

---

## UI States

The frontend should handle these screens:

1. **Signup** — Create a new organization and admin account (username, email, password, org name)
2. **Login** — Authenticate with username/email and password
3. **Force Password Change** — Shown when `mustChangePassword: true` after login
4. **Normal Application Shell** — Main app with sidebar, list, and detail views
5. **Admin: User Management** — Admin-only screen to create/list users
6. **Temporary Password Confirmation** — After creating a user, display the `temporaryPassword` immediately

---

## Application (Customer Request) Data Model

Applications are stored as JSON in the key-value storage. Each application has a key like `application:<uuid>`.

### Frontend Types

```typescript
interface Exchange {
  date: string;        // "2026-08-30"
  type: string;        // "Email" | "Note" | "Phone" | ...
  summary: string;
}

interface Application {
  typeOfCustomer: string;   // "Society" | "Company"
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  attachment: string;       // filename, e.g. "attestation.pdf"
  subject: string;
  receivedAt: string;       // ISO datetime, e.g. "2026-08-30T23:14:00"
  processingDays: number;   // statutory processing time
  status: 'New' | 'In Progress' | 'Processed' | 'Rejected';
  closingDate: string | null;  // ISO date or null
  notes: string;
  exchanges: Exchange[];
}
```

### Creating an Application

```
PUT /api/storage/application:<uuid>
Headers: Authorization: Bearer <token>, Content-Type: application/json
Body: { value: JSON.stringify(applicationData) }
→ 200: { key, value, parsedValue, organizationId, userId, updatedAt }
```

Generate a unique key client-side, e.g. `application:${crypto.randomUUID()}`.

### Listing Applications

```
GET /api/storage?prefix=application:
GET /api/storage?status=New
GET /api/storage?search=TechCorp
GET /api/storage?status=In+Progress&search=Acme
```

- Admin users receive full records with `parsedValue`, `userId`, `username`
- Non-admin users only receive `keys` — call `GET /api/storage/:key` for each to get details

### Fetching a Single Application

```
GET /api/storage/application:<uuid>
→ 200: { key, value, parsedValue, organizationId, userId, username?, updatedAt }
```

Use `parsedValue` for the structured data; `value` is the raw JSON string.

### Updating an Application

```
PUT /api/storage/application:<uuid>
Body: { value: JSON.stringify(updatedApplicationData) }
→ 200: { key, value, parsedValue, organizationId, userId, updatedAt }
```

This is a full replace — send the entire application object.

### Deleting an Application

```
DELETE /api/storage/application:<uuid>
→ 200: { key, deleted: true }
```

---

## User Management (Admin Only)

### List Users

```
GET /api/users
Headers: Authorization: Bearer <token>
→ 200: { users: [{ id, username, email, organizationId, isAdmin, mustChangePassword, ... }] }
```

### Create User

```
POST /api/users
Headers: Authorization: Bearer <token>, Content-Type: application/json
Body: { username, email? }
→ 201: { user, temporaryPassword, message }
```

- Show `temporaryPassword` to the admin immediately — it is a one-time secret
- The new user must change their password on first login
- There is no email delivery — the admin must share the password manually

---

## Error Handling

| Status | Meaning | Frontend Action |
|--------|---------|-----------------|
| 400 | Validation error | Display `error` or `message` field |
| 401 | Not authenticated | Redirect to login |
| 403 | Not admin | Show "access denied" |
| 404 | Not found | Show empty state or "not found" |
| 409 | Duplicate | Show "already exists" message |
| 428 | Password change required | Redirect to password change screen |
| 500 | Server error | Show generic error toast |

---

## Environment

```env
VITE_API_URL=http://localhost:3000   # or your deployed backend URL
```

The frontend must send the `Authorization` header with every request. Do not hardcode storage paths — use the configured API base URL.
