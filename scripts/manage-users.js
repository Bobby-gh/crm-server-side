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

const DATA_DIR = path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'wafi-crm.db');

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const [, , command, username, password] = process.argv;

function usage() {
  console.log('Utilisation :');
  console.log('  node scripts/manage-users.js add <identifiant> <mot-de-passe>');
  console.log('  node scripts/manage-users.js remove <identifiant>');
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
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
    console.log(`Utilisateur « ${username} » créé.`);
  }
} else if (command === 'remove') {
  if (!username) { usage(); process.exit(1); }
  const result = db.prepare('DELETE FROM users WHERE username = ?').run(username);
  console.log(result.changes > 0 ? `Utilisateur « ${username} » supprimé.` : `Aucun utilisateur « ${username} » trouvé.`);
} else if (command === 'list') {
  const rows = db.prepare('SELECT username, created_at FROM users ORDER BY username').all();
  if (!rows.length) {
    console.log('Aucun utilisateur enregistré.');
  } else {
    console.log('Utilisateurs enregistrés :');
    rows.forEach(r => console.log(`  - ${r.username}  (créé le ${r.created_at})`));
  }
} else {
  usage();
  process.exit(1);
}
