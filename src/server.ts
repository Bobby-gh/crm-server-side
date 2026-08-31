import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import { PORT, HOST } from './config/runtime';
import { AppDataSource } from './data-source';
import { createApp } from './app';
import { countUsers } from './services/users';

async function bootstrap(): Promise<void> {
  await AppDataSource.initialize();
  await AppDataSource.runMigrations();
  console.log('Migrations applied successfully.');

  const app = createApp(AppDataSource);
  app.listen(PORT, HOST, async () => {
    const usersCount = await countUsers(AppDataSource);
    console.log(`Registre WAFI CAPITAL disponible sur http://${HOST}:${PORT}`);
    console.log('PostgreSQL datasource initialized.');
    if (usersCount === 0) {
      console.warn('⚠️  No users exist yet. Use POST /api/signup to create the first administrator account.');
    }
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
