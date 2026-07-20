# Customer Request Log — WAFI CAPITAL (self-hosted version, React)

This version replaces Claude.ai-specific storage with a real web server
(Node.js / Express), a local SQLite database, username/password authentication,
and a **React** interface (built with Vite). You can install it on any server
(VPS, internal server, Node.js hosting).

## Contents

```
wafi-crm-server/
├── server.js          → Express server: storage API, authentication
├── package.json        → server dependencies
├── scripts/
│   └── manage-users.js  → user account management
└── data/
    └── wafi-crm.db      → SQLite database (created automatically)
```

## Installation

Prerequisite: Node.js 18 or newer (https://nodejs.org).

### 1. Install the server

```bash
npm install
```

### 3. Create user accounts

Each user has their own username and password. New accounts can be created
through the signup page at `/signup` or via the API endpoint `/api/signup`.
The CLI helper remains available for administration tasks.

```bash
node scripts/manage-users.js add alice "a-strong-password"
node scripts/manage-users.js list
node scripts/manage-users.js remove alice
```

Passwords must be at least 8 characters long. Running `add` again with an
existing username simply updates that user's password.

### 4. Start the server

```bash
npm start
```

The API is then available at `http://localhost:3000`.

The SQLite database file (`data/wafi-crm.db`) is created automatically on
the first startup — it contains both customer records and user accounts.
It is a single file, so remember to include it in your regular backups.

### Important environment variable: SESSION_SECRET

Set a fixed secret value to keep users logged in across server restarts:

```bash
SESSION_SECRET="a-long-random-secret-string" npm start
```

Without this variable, a temporary value is generated at each startup and
all users are logged out when the server restarts.

## Production deployment

1. Copy the `wafi-crm-server` folder to your server.
2. Install dependencies: `npm install --production`
3. Keep the process running with a process manager, for example [PM2](https://pm2.keymetrics.io/):
   ```bash
   npm install -g pm2
   pm2 start server.js --name wafi-crm
   pm2 save
   pm2 startup
   ```
4. Put a web server (Nginx, Apache) in front of the application as a reverse
   proxy, with an HTTPS certificate (for example using Let's Encrypt /
   Certbot). Minimal Nginx configuration example:
   ```nginx
   server {
     listen 443 ssl;
     server_name crm.wafi-your-domain.com;

     ssl_certificate     /etc/letsencrypt/live/your-domain/fullchain.pem;
     ssl_certificate_key /etc/letsencrypt/live/your-domain/privkey.pem;

     location / {
       proxy_pass http://localhost:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
     }
   }
   ```

**Do not deploy this server over plain HTTP on the public Internet**: client
data (contacts, exchanges, attachments) would travel in clear text. HTTPS is
required once the tool leaves your local network.

## Security — access to the tool

Each user now logs in with their own username and password (see "Create
user accounts" above). Passwords are stored encrypted with bcrypt, never as
plain text.

Additional recommendations:

- **HTTPS is mandatory in production** (see the previous section): without it,
  usernames and passwords would travel unencrypted over the network.
- **One account per person**, not shared accounts — this allows you to know
  who created or modified each record if needed, and to revoke access for one
  person without affecting others.
- **12-hour session lifetime**: after that, users must log in again. This can
  be adjusted in `server.js` (`cookie.maxAge`).
- This version remains a simple authentication setup (no separate roles, no
  self-service password reset, no login audit log). If you need any of those
  features, return to Claude to add them.

## Backups

The file `data/wafi-crm.db` contains all data (records, exchanges, PDF
attachments encoded as base64). Back it up regularly (daily automated copy
recommended).

## Updating the tool

This backend serves the API and authentication layer only.
