# API Reference

This document describes the backend endpoints available in this project, including request payloads and response shapes.

## Authentication

### POST /api/signup
Create a new user account and receive a bearer token.

Request body:
```json
{
  "username": "alice",
  "password": "strongpassword123",
  "email": "alice@example.com"
}
```

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
- 400: missing username/password or invalid email/password length
- 409: username already exists

### POST /api/login
Authenticate an existing user and receive a bearer token.

Request body:
```json
{
  "username": "alice",
  "password": "strongpassword123"
}
```

Success response (200):
```json
{
  "username": "alice",
  "token": "<bearer-token>"
}
```

Error responses:
- 400: missing username/password
- 401: invalid credentials

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

### GET /api/me
Get the currently authenticated user identity.

Headers:
```http
Authorization: Bearer <token>
```

Success response (200):
```json
{
  "username": "alice"
}
```

Error response:
- 401: missing/invalid token

## Storage

All storage routes below require a bearer token in the Authorization header.

### PUT /api/storage/:key
Create or update a storage value for the authenticated user.

Headers:
```http
Authorization: Bearer <token>
Content-Type: application/json
```

Request body:
```json
{
  "value": "some-string-value"
}
```

Success response (200):
```json
{
  "key": "customers",
  "value": "some-string-value"
}
```

Error responses:
- 400: value is not a string
- 401: missing/invalid token

### GET /api/storage/:key
Fetch a storage value for the authenticated user.

Headers:
```http
Authorization: Bearer <token>
```

Success response (200):
```json
{
  "key": "customers",
  "value": "some-string-value"
}
```

Error responses:
- 404: key not found for this user
- 401: missing/invalid token

### DELETE /api/storage/:key
Delete a storage value for the authenticated user.

Headers:
```http
Authorization: Bearer <token>
```

Success response (200):
```json
{
  "key": "customers",
  "deleted": true
}
```

### GET /api/storage
List storage keys for the authenticated user with an optional prefix filter.

Headers:
```http
Authorization: Bearer <token>
```

Query parameters:
- prefix: optional string prefix for filtering keys

Example:
```http
GET /api/storage?prefix=customer
```

Success response (200):
```json
{
  "keys": ["customer:1", "customer:2"],
  "prefix": "customer"
}
```

### GET /api/storage/keys
List all storage keys created by the authenticated user.

Headers:
```http
Authorization: Bearer <token>
```

Success response (200):
```json
{
  "keys": ["customer:1", "customer:2", "notes"]
}
```

## Notes

- Storage keys are scoped per authenticated user.
- The token is expected in the Authorization header as:
```http
Authorization: Bearer <token>
```
