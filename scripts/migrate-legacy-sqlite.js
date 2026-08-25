#!/usr/bin/env node
require('reflect-metadata');
require('dotenv').config();

const fs = require('fs');
const { AppDataSource } = require('../src/data-source');
const { LEGACY_SQLITE_PATH } = require('../src/config/runtime');
const { importLegacySqliteData } = require('../src/db/legacyImport');

async function main() {
  await AppDataSource.initialize();

  if (!LEGACY_SQLITE_PATH || !fs.existsSync(LEGACY_SQLITE_PATH)) {
    console.log('No legacy SQLite database found. Nothing to migrate.');
    process.exit(0);
  }

  const result = await importLegacySqliteData(AppDataSource, LEGACY_SQLITE_PATH);
  console.log(JSON.stringify(result, null, 2));
  await AppDataSource.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
