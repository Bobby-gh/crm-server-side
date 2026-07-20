// server.js — Registre des Demandes Clientèle WAFI CAPITAL
// Serveur Express + base de données SQLite + authentification par
// identifiant/mot de passe individuel (session côté serveur).
//
// Démarrage :
//   npm install
//   node scripts/manage-users.js add alice "un-mot-de-passe-solide"
//   npm start


require("dotenv").config();

const express = require("express");
const app = express();

const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const Database = require("better-sqlite3");
const crypto = require("crypto");

const envAllowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = [
  ...new Set([
    ...envAllowedOrigins,
    "https://wafi-crm-server-client.vercel.app",
    "https://*.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173"
  ])
];

function isAllowedOrigin(origin) {
  if (!origin) return true;

  return ALLOWED_ORIGINS.some((allowedOrigin) => {
    if (allowedOrigin === origin) return true;
    if (!allowedOrigin.includes("*")) return false;

    const escapedPattern = allowedOrigin
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\\\*/g, ".*");
    const regex = new RegExp(`^${escapedPattern}$`);
    return regex.test(origin);
  });
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-auth-token"]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const isProduction = process.env.NODE_ENV === "production";

// En production, définissez SESSION_SECRET dans l'environnement (valeur fixe et secrète).
// Sans cela, une valeur aléatoire est générée à chaque démarrage : tout le monde est
// déconnecté à chaque redémarrage du serveur.
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('⚠️  SESSION_SECRET non définie : une valeur temporaire est utilisée. ' +
    'Définissez SESSION_SECRET dans l\'environnement pour éviter de déconnecter tout le monde à chaque redémarrage.');
}

const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'wafi-crm.db');

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    user_id INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const usersColumns = db.prepare('PRAGMA table_info(users)').all();
if (!usersColumns.some((column) => column.name === 'email')) {
  db.exec('ALTER TABLE users ADD COLUMN email TEXT');
}

const kvColumns = db.prepare('PRAGMA table_info(kv_store)').all();
if (!kvColumns.some((column) => column.name === 'user_id')) {
  db.exec('ALTER TABLE kv_store ADD COLUMN user_id INTEGER');
}

app.set('trust proxy', 1); // utile derrière un reverse proxy Nginx/Apache
app.use(express.json({ limit: '10mb' })); // pièces jointes PDF encodées en base64

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 12 * 60 * 60 * 1000,
  }
}));

function createAuthToken(user) {
  const payload = {
    sub: user.id,
    username: user.username,
    exp: Date.now() + 12 * 60 * 60 * 1000
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(encodedPayload).digest('hex');
  return `${encodedPayload}.${signature}`;
}

function parseAuthToken(token) {
  if (typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(encodedPayload).digest('hex');
  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload || typeof payload.sub !== 'number' || payload.exp <= Date.now()) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const authHeader = req.get('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = bearerToken || req.get('x-auth-token') || req.query.token;
  const tokenPayload = parseAuthToken(token);

  if (tokenPayload) {
    req.user = {
      id: tokenPayload.sub,
      username: tokenPayload.username
    };
    return next();
  }

  return res.status(401).json({
    success: false,
    error: "Unauthorized"
  });
}

function createDatabaseBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `wafi-crm-${timestamp}.db`);
  fs.copyFileSync(DB_PATH, backupPath);
  return backupPath;
}

app.get("/", (req, res) => {
    res.json({
        status: "OK",
        service: "WAFI CRM Backend",
    });
});

// --- Authentification ---

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  if (!normalizedUsername || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(normalizedUsername);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
  }
  const token = createAuthToken(user);
  res.json({ username: user.username, token });
});

app.post('/api/signup', (req, res) => {
  const { username, name, password, email } = req.body || {};
  const normalizedUsername = typeof (username ?? name) === 'string' ? (username ?? name).trim() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim() : '';

  if (!normalizedUsername || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  }

  if (normalizedUsername.length < 3) {
    return res.status(400).json({ error: 'L’identifiant doit contenir au moins 3 caractères.' });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  }

  if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(normalizedUsername);
  if (existing) {
    return res.status(409).json({ error: 'Ce nom d’utilisateur est déjà utilisé.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)').run(normalizedUsername, normalizedEmail || null, passwordHash);

  const token = createAuthToken({ id: info.lastInsertRowid, username: normalizedUsername });

  res.status(201).json({
    username: normalizedUsername,
    email: normalizedEmail || null,
    token,
    message: 'Compte créé avec succès.'
  });
});

app.post('/api/logout', requireAuth, (req, res) => {
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username });
});


// --- À partir d'ici, tout nécessite une session valide ---
app.use(requireAuth);

// --- API générique clé/valeur, compatible avec l'interface de stockage utilisée par le front-end React ---

app.get('/api/storage/:key', requireAuth, (req, res) => {
  const row = db.prepare('SELECT value FROM kv_store WHERE key = ? AND user_id = ?').get(req.params.key, req.user.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json({ key: req.params.key, value: row.value });
});

app.put('/api/storage/:key', requireAuth, (req, res) => {
  const { value } = req.body || {};
  if (typeof value !== 'string') {
    return res.status(400).json({ error: 'Le champ "value" doit être une chaîne de caractères' });
  }

  const existing = db.prepare('SELECT key FROM kv_store WHERE key = ? AND user_id = ?').get(req.params.key, req.user.id);
  if (existing) {
    db.prepare('UPDATE kv_store SET value = ?, updated_at = datetime(\'now\') WHERE key = ? AND user_id = ?').run(value, req.params.key, req.user.id);
  } else {
    db.prepare('INSERT INTO kv_store (key, value, user_id, updated_at) VALUES (?, ?, ?, datetime(\'now\'))').run(req.params.key, value, req.user.id);
  }

  res.json({ key: req.params.key, value });
});

app.delete('/api/storage/:key', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM kv_store WHERE key = ? AND user_id = ?').run(req.params.key, req.user.id);
  res.json({ key: req.params.key, deleted: result.changes > 0 });
});

app.get('/api/storage', requireAuth, (req, res) => {
  const prefix = req.query.prefix || '';
  const rows = db.prepare('SELECT key FROM kv_store WHERE user_id = ? AND key LIKE ? ORDER BY key').all(req.user.id, prefix + '%');
  res.json({ keys: rows.map(r => r.key), prefix });
});

app.get('/api/storage/keys', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT key FROM kv_store WHERE user_id = ? ORDER BY key').all(req.user.id);
  res.json({ keys: rows.map(r => r.key) });
});



app.listen(PORT, HOST, () => {
  console.log(`Registre WAFI CAPITAL disponible sur http://localhost:${PORT}`);
  console.log(`Base de données SQLite : ${DB_PATH}`);
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count === 0) {
    console.warn('⚠️  Aucun utilisateur enregistré. Créez-en un avec :');
    console.warn('    node scripts/manage-users.js add <identifiant> <mot-de-passe>');
  }
});
