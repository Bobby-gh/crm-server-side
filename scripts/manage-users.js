// scripts/manage-users.js — gestion des comptes utilisateurs du Registre WAFI CAPITAL
//
// Utilisation :
//   node scripts/manage-users.js add <identifiant> <mot-de-passe>
//   node scripts/manage-users.js remove <identifiant>
//   node scripts/manage-users.js list


const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const fs = require('fs');

function resolveDatabasePath() {
  const legacyDbPath = path.join(__dirname, '..', 'data', 'wafi-crm.db');
  const configuredDbPath = process.env.DB_PATH
    || process.env.DATABASE_PATH
    || (process.env.RAILWAY_VOLUME_MOUNT_PATH ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'wafi-crm.db') : null);
  const dbPath = configuredDbPath || legacyDbPath;

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  return dbPath;
}

const DB_PATH = resolveDatabasePath();

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const usersColumns = db.prepare('PRAGMA table_info(users)').all();
if (!usersColumns.some((column) => column.name === 'is_admin')) {
  db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
}

const [, , command, username, password, flag] = process.argv;

function usage() {
  console.log('Utilisation :');
  console.log('  node scripts/manage-users.js add <identifiant> <mot-de-passe> [--admin]');
  console.log('  node scripts/manage-users.js remove <identifiant>');
  console.log('  node scripts/manage-users.js promote <identifiant>');
  console.log('  node scripts/manage-users.js demote <identifiant>');
  console.log('  node scripts/manage-users.js list');
}

if (command === 'add') {
  if (!username || !password) { usage(); process.exit(1); }
  if (password.length < 8) {
    console.error('Le mot de passe doit contenir au moins 8 caractères.');
    process.exit(1);
  }
  const hash = bcrypt.hashSync(password, 10);
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(hash, username);
    console.log(`Mot de passe mis à jour pour « ${username} ».`);
  } else {
    const isAdmin = flag === '--admin' ? 1 : 0;
    db.prepare('INSERT INTO users (username, is_admin, password_hash) VALUES (?, ?, ?)').run(username, isAdmin, hash);
    console.log(`Utilisateur « ${username} » créé${isAdmin ? ' avec droits administrateur' : ''}.`);
  }
} else if (command === 'remove') {
  if (!username) { usage(); process.exit(1); }
  const result = db.prepare('DELETE FROM users WHERE username = ?').run(username);
  console.log(result.changes > 0 ? `Utilisateur « ${username} » supprimé.` : `Aucun utilisateur « ${username} » trouvé.`);
} else if (command === 'promote') {
  if (!username) { usage(); process.exit(1); }
  const result = db.prepare('UPDATE users SET is_admin = 1 WHERE username = ?').run(username);
  console.log(result.changes > 0 ? `Utilisateur « ${username} » promu administrateur.` : `Aucun utilisateur « ${username} » trouvé.`);
} else if (command === 'demote') {
  if (!username) { usage(); process.exit(1); }
  const result = db.prepare('UPDATE users SET is_admin = 0 WHERE username = ?').run(username);
  console.log(result.changes > 0 ? `Droits administrateur retirés pour « ${username} ».` : `Aucun utilisateur « ${username} » trouvé.`);
} else if (command === 'list') {
  const rows = db.prepare('SELECT username, is_admin, created_at FROM users ORDER BY username').all();
  if (!rows.length) {
    console.log('Aucun utilisateur enregistré.');
  } else {
    console.log('Utilisateurs enregistrés :');
    rows.forEach(r => console.log(`  - ${r.username}${r.is_admin ? ' [admin]' : ''}  (créé le ${r.created_at})`));
  }
} else {
  usage();
  process.exit(1);
}
