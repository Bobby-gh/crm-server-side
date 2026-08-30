# API Reference

This document describes all backend endpoints, request payloads, and response shapes.

Every authenticated endpoint requires a bearer token in the `Authorization` header:

```http
Authorization: Bearer <token>
```

---

## Authentication

### POST /api/signup

Create a new user account, organization, and receive a bearer token.
Anyone can sign up — each signup creates its own organization with the user as admin.

Request body:
```json
{
  "username": "alice",
  "password": "strongpassword123",
  "email": "alice@example.com",
  "organizationName": "Acme Corp"
}
```

`organizationName` is optional. Defaults to the username if omitted.

Success response (201):
```json
{
  "username": "alice",
  "email": "alice@example.com",
  "token": "<bearer-token>",
  "message": "Compte créé avec succès."
}
```

Error responses:
- **400** — missing username/password, password < 8 chars, or invalid email
- **409** — username already exists

---

### POST /api/login

Authenticate an existing user and receive a bearer token.

Request body:
```json
{
  "username": "alice",
  "password": "strongpassword123"
}
```

You can also login with `email` instead of `username`.

Success response (200):
```json
{
  "username": "alice",
  "token": "<bearer-token>",
  "user": {
    "id": 1,
    "username": "alice",
    "email": "alice@example.com",
    "organizationId": 1,
    "isAdmin": true,
    "mustChangePassword": false,
    "createdByUserId": null,
    "createdAt": "2026-08-30T23:14:00.000Z",
    "updatedAt": "2026-08-30T23:14:00.000Z",
    "passwordChangedAt": "2026-08-30T23:14:00.000Z"
  },
  "mustChangePassword": false
}
```

**Important:** If `mustChangePassword` is `true`, the user must call `POST /api/auth/change-password` before accessing any other endpoint (they will receive 428 otherwise).

Error responses:
- **400** — missing username/password
- **401** — invalid credentials

---

### POST /api/logout

Log out the current authenticated user.

Headers:
```http
Authorization: Bearer <token>
```

Success response (200):
```json
{
  "ok": true
}
```

---

### GET /api/me

Get the currently authenticated user identity.

Headers:
```http
Authorization: Bearer <token>
```

Success response (200):
```json
{
  "user": {
    "id": 1,
    "username": "alice",
    "email": "alice@example.com",
    "organizationId": 1,
    "isAdmin": true,
    "mustChangePassword": false,
    "createdByUserId": null,
    "createdAt": "2026-08-30T23:14:00.000Z",
    "updatedAt": "2026-08-30T23:14:00.000Z",
    "passwordChangedAt": "2026-08-30T23:14:00.000Z"
  }
}
```

Error response:
- **401** — missing/invalid token

---

### POST /api/auth/change-password

Change the authenticated user's password. Required on first login when `mustChangePassword` is `true`.

Headers:
```http
Authorization: Bearer <token>
Content-Type: application/json
```

Request body:
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

Success response (200):
```json
{
  "user": { ... },
  "message": "Password updated successfully."
}
```

Error responses:
- **400** — missing fields or new password < 8 chars
- **401** — current password incorrect

---

## User Management

Admin-only endpoints for managing users within the current organization.

### GET /api/users

List all users in the authenticated user's organization.

Headers:
```http
Authorization: Bearer <token>
```

Success response (200):
```json
{
  "users": [
    {
      "id": 1,
      "username": "alice",
      "email": "alice@example.com",
      "organizationId": 1,
      "isAdmin": true,
      "mustChangePassword": false,
      "createdByUserId": null,
      "createdAt": "2026-08-30T23:14:00.000Z",
      "updatedAt": "2026-08-30T23:14:00.000Z",
      "passwordChangedAt": "2026-08-30T23:14:00.000Z"
    }
  ]
}
```

Requires: admin, organization, password changed

Error responses:
- **403** — not an admin
- **409** — no organization attached to account

---

### POST /api/users

Create a new user in the admin's organization. Returns a one-time temporary password.

Headers:
```http
Authorization: Bearer <token>
Content-Type: application/json
```

Request body:
```json
{
  "username": "agent1",
  "email": "agent1@acme.fr"
}
```

`email` is optional.

Success response (201):
```json
{
  "user": {
    "id": 2,
    "username": "agent1",
    "email": "agent1@acme.fr",
    "organizationId": 1,
    "isAdmin": false,
    "mustChangePassword": true,
    "createdByUserId": 1,
    "createdAt": "2026-08-31T10:00:00.000Z",
    "updatedAt": "2026-08-31T10:00:00.000Z",
    "passwordChangedAt": null
  },
  "temporaryPassword": "a1b2c3d4e5f6",
  "message": "Utilisateur créé. Partagez le mot de passe temporaire avec la personne concernée."
}
```

**Important:** Share `temporaryPassword` with the user manually. The user must change it on first login.

Error responses:
- **400** — invalid username/email
- **403** — not an admin
- **409** — username already exists

Requires: admin, organization, password changed

---

## Customer Requests (Applications)

Applications are stored as JSON in the key-value storage system. Each application is a record with a key like `application:<uuid>`.

### Application Data Structure

Every storage value for an application is a JSON string containing:

```json
{
  "typeOfCustomer": "Society",
  "companyName": "TechCorp SARL",
  "contactName": "Jean Dupont",
  "email": "jean@techcorp.fr",
  "phone": "+33612345678",
  "attachment": "attestation.pdf",
  "subject": "Demande de traitement fiscal",
  "receivedAt": "2026-08-30T23:14:00",
  "processingDays": 30,
  "status": "New",
  "closingDate": null,
  "notes": "Client urgent",
  "exchanges": [
    {
      "date": "2026-08-30",
      "type": "Email",
      "summary": "Premier contact par email"
    }
  ]
}
```

**Status values:** `"New"`, `"In Progress"`, `"Processed"`, `"Rejected"`

---

### PUT /api/storage/:key

Create or update an application. The `value` must be a JSON string of the application data.

Headers:
```http
Authorization: Bearer <token>
Content-Type: application/json
```

Request body:
```json
{
  "value": "{\"typeOfCustomer\":\"Society\",\"companyName\":\"Acme Corp\",...}"
}
```

Success response (200):
```json
{
  "key": "application:app001",
  "value": "{...}",
  "parsedValue": {
    "typeOfCustomer": "Society",
    "companyName": "Acme Corp",
    "contactName": "Jean Dupont",
    "email": "jean@techcorp.fr",
    "phone": "+33612345678",
    "attachment": "attestation.pdf",
    "subject": "Demande de traitement fiscal",
    "receivedAt": "2026-08-30T23:14:00",
    "processingDays": 30,
    "status": "New",
    "closingDate": null,
    "notes": "Client urgent",
    "exchanges": [...]
  },
  "organizationId": 1,
  "userId": 1,
  "updatedAt": "2026-08-30T23:14:00.000Z"
}
```

The `parsedValue` field is the auto-parsed JSON object, or `null` if the value is not valid JSON.

Error responses:
- **400** — value is not a string
- **401** — missing/invalid token
- **428** — must change password first

Requires: organization, password changed

---

### GET /api/storage/:key

Fetch a single application by key.

Headers:
```http
Authorization: Bearer <token>
```

Success response (200): same shape as PUT response above.

Error responses:
- **404** — key not found in this organization
- **401** — missing/invalid token

Requires: organization, password changed

---

### DELETE /api/storage/:key

Delete an application by key.

Headers:
```http
Authorization: Bearer <token>
```

Success response (200):
```json
{
  "key": "application:app001",
  "deleted": true
}
```

Requires: organization, password changed

---

### GET /api/storage

List all applications with optional filtering. Admin users receive full record details.

Headers:
```http
Authorization: Bearer <token>
```

Query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `prefix` | string | Filter keys by prefix (e.g. `application:`) |
| `status` | string | Filter by application status (`New`, `In Progress`, `Processed`, `Rejected`) |
| `search` | string | Search across `companyName`, `contactName`, `subject`, `email` |

Examples:
```http
GET /api/storage?prefix=application:
GET /api/storage?status=New
GET /api/storage?search=TechCorp
GET /api/storage?status=In+Progress&search=Acme
```

**Admin response (200):**
```json
{
  "keys": ["application:app001", "application:app002"],
  "records": [
    {
      "key": "application:app001",
      "value": "{...}",
      "parsedValue": { ... },
      "organizationId": 1,
      "userId": 1,
      "username": "alice",
      "updatedAt": "2026-08-30T23:14:00.000Z"
    }
  ],
  "prefix": "application:",
  "scope": "organization"
}
```

**Non-admin response (200):**
```json
{
  "keys": ["application:app001", "application:app002"],
  "prefix": ""
}
```

Non-admin users only see keys, not full record data.

Requires: organization, password changed

---

### GET /api/storage/keys

List all storage keys in the organization.

Headers:
```http
Authorization: Bearer <token>
```

**Admin response (200):**
```json
{
  "keys": ["application:app001", "application:app002"],
  "records": [ ... ],
  "scope": "organization"
}
```

**Non-admin response (200):**
```json
{
  "keys": ["application:app001", "application:app002"]
}
```

Requires: organization, password changed

---

## HTTP Status Codes Reference

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Unauthorized (missing/invalid token or credentials) |
| 403 | Forbidden (not admin) |
| 404 | Not found |
| 409 | Conflict (duplicate username or signup) |
| 428 | Password change required before proceeding |
| 500 | Internal server error |

---

## Environment

The backend runs on Node.js with TypeScript, Express, and TypeORM against PostgreSQL.

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wafi_crm
SESSION_SECRET=replace-with-a-long-random-secret
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```
