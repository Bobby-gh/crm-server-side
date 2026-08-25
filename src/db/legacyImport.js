const fs = require('fs');
const Database = require('better-sqlite3');

const MIGRATION_NAME = 'legacy_sqlite_import_v1';

async function ensureLegacyOrganization(dataSource) {
  const organizationRepository = dataSource.getRepository('Organization');
  const existing = await organizationRepository.findOne({ where: { slug: 'legacy-organization' } });
  if (existing) {
    return existing;
  }

  return organizationRepository.save({
    name: 'Legacy Organization',
    slug: 'legacy-organization',
    createdByUserId: null
  });
}

async function targetDatabaseAlreadySeeded(dataSource) {
  const [usersCount, organizationsCount, storageCount] = await Promise.all([
    dataSource.getRepository('User').count(),
    dataSource.getRepository('Organization').count(),
    dataSource.getRepository('StorageRecord').count()
  ]);

  return usersCount > 0 || organizationsCount > 0 || storageCount > 0;
}

function tableExists(sqlite, tableName) {
  return !!sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(tableName);
}

async function importLegacySqliteData(dataSource, legacyPath) {
  if (!legacyPath || !fs.existsSync(legacyPath)) {
    return { imported: false, reason: 'missing_legacy_database' };
  }

  const migrationRepository = dataSource.getRepository('AppMigration');
  const existingMigration = await migrationRepository.findOne({ where: { name: MIGRATION_NAME } });
  if (existingMigration) {
    return { imported: false, reason: 'already_imported' };
  }

  if (await targetDatabaseAlreadySeeded(dataSource)) {
    await migrationRepository.save({ name: MIGRATION_NAME });
    return { imported: false, reason: 'target_database_already_seeded' };
  }

  const sqlite = new Database(legacyPath, { readonly: true, fileMustExist: true });

  try {
    const hasUsers = tableExists(sqlite, 'users');
    const hasKvStore = tableExists(sqlite, 'kv_store');

    if (!hasUsers && !hasKvStore) {
      return { imported: false, reason: 'legacy_tables_missing' };
    }

    const legacyUsers = hasUsers
      ? sqlite.prepare('SELECT * FROM users ORDER BY id').all()
      : [];
    const legacyKvRows = hasKvStore
      ? sqlite.prepare('SELECT * FROM kv_store ORDER BY rowid').all()
      : [];

    if (legacyUsers.length === 0 && legacyKvRows.length === 0) {
      await migrationRepository.save({ name: MIGRATION_NAME });
      return { imported: false, reason: 'legacy_tables_empty' };
    }

    const normalizedUsers = [...legacyUsers].map((user) => ({
      ...user,
      is_admin: user.is_admin === 1 || user.is_admin === true
    }));

    if (normalizedUsers.length > 0 && !normalizedUsers.some((user) => user.is_admin)) {
      normalizedUsers.sort((left, right) => left.id - right.id);
      normalizedUsers[0].is_admin = true;
    }

    const userRepository = dataSource.getRepository('User');
    const userIdMap = new Map();
    const organization = await ensureLegacyOrganization(dataSource);

    for (const user of normalizedUsers) {
      const savedUser = await userRepository.save({
        id: user.id,
        username: user.username,
        email: user.email || null,
        organizationId: organization.id,
        isAdmin: user.is_admin,
        mustChangePassword: false,
        passwordHash: user.password_hash,
        createdByUserId: null,
        createdAt: user.created_at ? new Date(user.created_at) : new Date(),
        updatedAt: user.updated_at ? new Date(user.updated_at) : new Date(),
        passwordChangedAt: user.password_changed_at ? new Date(user.password_changed_at) : null
      });

      userIdMap.set(user.id, savedUser.id);
    }

    const storageRepository = dataSource.getRepository('StorageRecord');
    for (const row of legacyKvRows) {
      const userId = row.user_id ? userIdMap.get(row.user_id) || null : null;
      await storageRepository.save({
        key: row.key,
        value: row.value,
        organizationId: organization.id,
        userId,
        updatedAt: row.updated_at ? new Date(row.updated_at) : new Date()
      });
    }

    await migrationRepository.save({ name: MIGRATION_NAME });

    return {
      imported: true,
      users: normalizedUsers.length,
      kvRows: legacyKvRows.length
    };
  } finally {
    sqlite.close();
  }
}

module.exports = {
  importLegacySqliteData
};
