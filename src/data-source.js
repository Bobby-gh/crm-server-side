require('reflect-metadata');

const { DataSource } = require('typeorm');
const { DATABASE_URL, IS_PRODUCTION } = require('./config/runtime');
const { AppMigrationSchema } = require('./entities/AppMigration');
const { OrganizationSchema } = require('./entities/Organization');
const { StorageRecordSchema } = require('./entities/StorageRecord');
const { UserSchema } = require('./entities/User');

const AppDataSource = new DataSource({
  type: 'postgres',
  url: DATABASE_URL || undefined,
  ssl: process.env.PGSSLMODE === 'require' || process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false,
  synchronize: true,
  logging: !IS_PRODUCTION,
  entities: [OrganizationSchema, UserSchema, StorageRecordSchema, AppMigrationSchema]
});

module.exports = {
  AppDataSource
};
