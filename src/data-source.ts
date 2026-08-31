import 'reflect-metadata';
import path from 'path';
import { DataSource } from 'typeorm';
import { DATABASE_URL, IS_PRODUCTION } from './config/runtime';
import { Organization } from './entities/Organization';
import { StorageRecord } from './entities/StorageRecord';
import { User } from './entities/User';
import { InitialSchema1725148800000 } from './migrations/1725148800000-InitialSchema';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: DATABASE_URL || undefined,
  ssl: process.env.PGSSLMODE === 'require' || process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false,
  synchronize: false,
  logging: !IS_PRODUCTION,
  entities: [Organization, User, StorageRecord],
  migrations: [InitialSchema1725148800000],
  migrationsTableName: 'typeorm_migrations'
});
