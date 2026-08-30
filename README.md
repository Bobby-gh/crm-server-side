# WAFI CAPITAL CRM Server

Self-hosted customer request management backend built with **TypeScript**, **Express**, **TypeORM**, and **PostgreSQL**.

Multi-tenant: every organization has its own isolated data. Users manage customer requests (applications) with full status tracking, exchange history, and document attachments.

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 12+

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your PostgreSQL connection string and session secret
```

### 3. Build and start

```bash
npm run build    # Compile TypeScript
npm start        # Start production server
```

Or for development:

```bash
npm run dev      # Run with ts-node (auto-reload not included)
```

The API is available at `http://localhost:3000`.

### 4. Create the first account

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"securepass123","email":"admin@example.com","organizationName":"My Company"}'
```

This creates the first admin user and organization. All subsequent users are created by the admin via `POST /api/users`.

## Project Structure

```
src/
├── server.ts              Entry point
├── app.ts                 Express routes and middleware
├── data-source.ts         TypeORM data source (PostgreSQL)
├── config/
│   └── runtime.ts         Environment variables
├── entities/
│   ├── User.ts            User entity
│   ├── Organization.ts    Organization entity
│   └── StorageRecord.ts   Key-value storage entity + Application types
├── services/
│   ├── users.ts           User CRUD, auth helpers
│   ├── organizations.ts   Organization CRUD
│   ├── storage.ts         Storage CRUD with filtering
│   ├── token.ts           HMAC token creation/parsing
│   └── passwords.ts       Bcrypt hashing
├── middleware/
│   └── auth.ts            Authentication and authorization
└── db/
    └── schema.ts          Raw SQL migrations
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled server from `dist/` |
| `npm run dev` | Run with `tsx` (development) |
| `npm run typecheck` | Type-check without emitting |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Secret for signing auth tokens |
| `PORT` | No | Server port (default: 3000) |
| `HOST` | No | Bind address (default: 0.0.0.0) |
| `NODE_ENV` | No | Set to `production` for secure cookies |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |

## API Overview

See [API.md](./API.md) for full documentation.

- `POST /api/signup` — Create organization + admin
- `POST /api/login` — Authenticate, get token
- `POST /api/auth/change-password` — Change password (required on first login for invited users)
- `GET /api/me` — Get current user
- `GET/POST /api/users` — List/create users (admin only)
- `PUT/GET/DELETE /api/storage/:key` — CRUD for applications
- `GET /api/storage` — List applications (with status/search filters)

## Production Deployment

1. Build: `npm run build`
2. Set `NODE_ENV=production` and a strong `SESSION_SECRET`
3. Run with a process manager:

```bash
npm install -g pm2
pm2 start dist/server.js --name wafi-crm
pm2 save
pm2 startup
```

4. Put Nginx or Caddy in front with HTTPS:

```nginx
server {
    listen 443 ssl;
    server_name crm.your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**HTTPS is required in production.** User credentials and customer data travel in plaintext over HTTP.
