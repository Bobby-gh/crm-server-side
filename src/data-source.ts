import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { DATABASE_URL, IS_PRODUCTION } from './config/runtime';
import { Organization } from './entities/Organization';
import { StorageRecord } from './entities/StorageRecord';
import { User } from './entities/User';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: DATABASE_URL || undefined,
  ssl: process.env.PGSSLMODE === 'require' || process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false,
  synchronize: true,
  logging: !IS_PRODUCTION,
  entities: [Organization, User, StorageRecord]
});
