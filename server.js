require('reflect-metadata');
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { PORT, HOST, LEGACY_SQLITE_PATH, IMPORT_LEGACY_SQLITE } = require('./src/config/runtime');
const { AppDataSource } = require('./src/data-source');
const { createApp } = require('./src/app');
const { importLegacySqliteData } = require('./src/db/legacyImport');
const { countUsers } = require('./src/services/users');

async function bootstrap() {
  await AppDataSource.initialize();

  if (IMPORT_LEGACY_SQLITE && LEGACY_SQLITE_PATH && fs.existsSync(LEGACY_SQLITE_PATH)) {
    const importResult = await importLegacySqliteData(AppDataSource, LEGACY_SQLITE_PATH);
    if (importResult.imported) {
      console.log(`Imported legacy SQLite data: ${importResult.users} users, ${importResult.kvRows} records.`);
    }
  }

  const app = createApp(AppDataSource);
  app.listen(PORT, HOST, async () => {
    const usersCount = await countUsers(AppDataSource);
    console.log(`Registre WAFI CAPITAL disponible sur http://${HOST}:${PORT}`);
    console.log(`PostgreSQL datasource initialized.`);
    if (usersCount === 0) {
      console.warn('⚠️  No users exist yet. Use POST /api/setup to create the first administrator account.');
    }
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
