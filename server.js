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
app.use(cors({
  origin: "https://wafi-crm-server-client.vercel.app",
  credentials: true
}));
const PORT = process.env.PORT || 3000;

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

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'wafi-crm.db');

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

app.set('trust proxy', 1); // utile derrière un reverse proxy Nginx/Apache
app.use(express.json({ limit: '10mb' })); // pièces jointes PDF encodées en base64

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 12 * 60 * 60 * 1000,
}
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: "Unauthorized",
  });
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
  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({ username: user.username });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Non authentifié' });
  res.json({ username: req.session.username });
});


// --- À partir d'ici, tout nécessite une session valide ---
app.use(requireAuth);

// --- API générique clé/valeur, compatible avec l'interface de stockage utilisée par le front-end React ---

app.get('/api/storage/:key', (req, res) => {
  const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get(req.params.key);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json({ key: req.params.key, value: row.value });
});

app.put('/api/storage/:key', (req, res) => {
  const { value } = req.body || {};
  if (typeof value !== 'string') {
    return res.status(400).json({ error: 'Le champ "value" doit être une chaîne de caractères' });
  }
  db.prepare(`
    INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(req.params.key, value);
  res.json({ key: req.params.key, value });
});

app.delete('/api/storage/:key', (req, res) => {
  db.prepare('DELETE FROM kv_store WHERE key = ?').run(req.params.key);
  res.json({ key: req.params.key, deleted: true });
});

app.get('/api/storage', (req, res) => {
  const prefix = req.query.prefix || '';
  const rows = db.prepare('SELECT key FROM kv_store WHERE key LIKE ?').all(prefix + '%');
  res.json({ keys: rows.map(r => r.key), prefix });
});



app.listen(PORT, () => {
  console.log(`Registre WAFI CAPITAL disponible sur http://localhost:${PORT}`);
  console.log(`Base de données SQLite : ${DB_PATH}`);
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count === 0) {
    console.warn('⚠️  Aucun utilisateur enregistré. Créez-en un avec :');
    console.warn('    node scripts/manage-users.js add <identifiant> <mot-de-passe>');
  }
});
