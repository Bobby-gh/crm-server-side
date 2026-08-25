function storageRepository(dataSource) {
  return dataSource.getRepository('StorageRecord');
}

function normalizeStorageRecord(record) {
  if (!record) {
    return null;
  }

  return {
    key: record.key,
    value: record.value,
    organizationId: record.organizationId || null,
    userId: record.userId || null,
    username: record.username || null,
    updatedAt: record.updatedAt
  };
}

async function getStorageRecord(dataSource, { key, organizationId, isAdmin }) {
  const repository = storageRepository(dataSource);

  if (isAdmin) {
    const records = await repository
      .createQueryBuilder('record')
      .leftJoin('users', 'user', 'user.id = record.user_id')
      .leftJoin('organizations', 'organization', 'organization.id = record.organization_id')
      .select([
        'record.key AS key',
        'record.value AS value',
        'record.organization_id AS "organizationId"',
        'record.user_id AS "userId"',
        'user.username AS username',
        'record.updated_at AS "updatedAt"'
      ])
      .where('record.organization_id = :organizationId', { organizationId })
      .andWhere('record.key = :key', { key })
      .orderBy('record.updated_at', 'DESC')
      .getRawMany();

    return records[0] || null;
  }

  const record = await repository
    .createQueryBuilder('record')
    .select([
      'record.key AS key',
      'record.value AS value',
      'record.organization_id AS "organizationId"',
      'record.user_id AS "userId"',
      'record.updated_at AS "updatedAt"'
    ])
    .where('record.key = :key', { key })
    .andWhere('record.organization_id = :organizationId', { organizationId })
    .getRawOne();

  return normalizeStorageRecord(record);
}

async function listStorageRecords(dataSource, { prefix = '', organizationId, isAdmin }) {
  const repository = storageRepository(dataSource);

  if (isAdmin) {
    return repository
      .createQueryBuilder('record')
      .leftJoin('users', 'user', 'user.id = record.user_id')
      .select([
        'record.key AS key',
        'record.value AS value',
        'record.organization_id AS "organizationId"',
        'record.user_id AS "userId"',
        'user.username AS username',
        'record.updated_at AS "updatedAt"'
      ])
      .where('record.key LIKE :prefix', { prefix: `${prefix}%` })
      .andWhere('record.organization_id = :organizationId', { organizationId })
      .orderBy('record.key', 'ASC')
      .addOrderBy('record.updated_at', 'DESC')
      .getRawMany();
  }

  return repository
    .createQueryBuilder('record')
    .select([
      'record.key AS key',
      'record.value AS value',
      'record.organization_id AS "organizationId"',
      'record.user_id AS "userId"',
      'record.updated_at AS "updatedAt"'
    ])
    .where('record.organization_id = :organizationId', { organizationId })
    .andWhere('record.key LIKE :prefix', { prefix: `${prefix}%` })
    .orderBy('record.key', 'ASC')
    .getRawMany();
}

async function listStorageKeys(dataSource, { organizationId, isAdmin }) {
  const repository = storageRepository(dataSource);

  if (isAdmin) {
    const records = await repository
      .createQueryBuilder('record')
      .where('record.organization_id = :organizationId', { organizationId })
      .select('DISTINCT record.key', 'key')
      .orderBy('record.key', 'ASC')
      .getRawMany();

    return records.map((row) => row.key);
  }

  const records = await repository
    .createQueryBuilder('record')
    .select('record.key', 'key')
    .where('record.organization_id = :organizationId', { organizationId })
    .orderBy('record.key', 'ASC')
    .getRawMany();

  return records.map((row) => row.key);
}

async function upsertStorageRecord(dataSource, { key, value, userId, organizationId }) {
  const repository = storageRepository(dataSource);
  await repository.upsert(
    {
      key,
      value,
      organizationId,
      userId,
      updatedAt: new Date()
    },
    ['organizationId', 'key']
  );

  const record = await repository.findOne({
    where: { key, organizationId }
  });

  return normalizeStorageRecord(record);
}

async function deleteStorageRecord(dataSource, { key, organizationId }) {
  const result = await storageRepository(dataSource).delete({ key, organizationId });
  return result.affected > 0;
}

module.exports = {
  deleteStorageRecord,
  getStorageRecord,
  listStorageKeys,
  listStorageRecords,
  upsertStorageRecord
};
