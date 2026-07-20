#!/usr/bin/env node
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_PATH = path.join(DATA_DIR, 'wafi-crm.db');
const SCHEDULE = process.env.BACKUP_CRON || '0 0 1 * *';

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

if (!fs.existsSync(DB_PATH)) {
  console.error('Database not found:', DB_PATH);
  process.exit(1);
}

function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `wafi-crm-${timestamp}.db`);
  fs.copyFileSync(DB_PATH, backupPath);
  console.log(`Backup created: ${backupPath}`);
}

console.log(`Backup cron schedule: ${SCHEDULE}`);
cron.schedule(SCHEDULE, createBackup);
createBackup();
