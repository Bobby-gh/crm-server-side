import { DataSource, Repository } from 'typeorm';
import {
  StorageRecord,
  NormalizedStorageRecord,
  normalizeStorageRecord,
  CustomerRequest,
  parseCustomerRequest
} from '../entities/StorageRecord';

function storageRepository(dataSource: DataSource): Repository<StorageRecord> {
  return dataSource.getRepository(StorageRecord);
}

// ── Get single record ────────────────────────────────────────────────────

export async function getStorageRecord(
  dataSource: DataSource,
  { key, organizationId, isAdmin }: { key: string; organizationId: number; isAdmin: boolean }
): Promise<NormalizedStorageRecord | null> {
  const repository = storageRepository(dataSource);

  if (isAdmin) {
    const records = await repository
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
      .where('record.organization_id = :organizationId', { organizationId })
      .andWhere('record.key = :key', { key })
      .orderBy('record.updated_at', 'DESC')
      .getRawMany();

    if (records.length === 0) return null;
    const rec = records[0];
    return {
      key: rec.key,
      value: rec.value,
      parsedValue: parseCustomerRequest(rec.value),
      organizationId: rec.organizationId || null,
      userId: rec.userId || null,
      username: rec.username || null,
      updatedAt: rec.updatedAt
    };
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

  const normalized = normalizeStorageRecord(record);
  if (normalized) {
    normalized.parsedValue = parseCustomerRequest(record?.value || '');
  }
  return normalized;
}

// ── List records (with optional status/date filter) ───────────────────────

export interface ListStorageOptions {
  prefix?: string;
  organizationId: number;
  isAdmin: boolean;
  status?: string;
  search?: string;
}

export async function listStorageRecords(
  dataSource: DataSource,
  options: ListStorageOptions
): Promise<NormalizedStorageRecord[]> {
  const { prefix = '', organizationId, isAdmin } = options;
  const repository = storageRepository(dataSource);

  let records: any[];

  if (isAdmin) {
    records = await repository
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
  } else {
    records = await repository
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

  let normalized = records.map((r) => normalizeStorageRecord(r)!);

  // Apply status filter (parsed from JSON value)
  if (options.status) {
    normalized = normalized.filter((r) => {
      const parsed = parseCustomerRequest(r.value);
      return parsed?.status === options.status;
    });
  }

  // Apply search filter (across company, contact, subject)
  if (options.search) {
    const term = options.search.toLowerCase();
    normalized = normalized.filter((r) => {
      const parsed = parseCustomerRequest(r.value);
      if (!parsed) return false;
      return (
        parsed.companyName.toLowerCase().includes(term) ||
        parsed.contactName.toLowerCase().includes(term) ||
        parsed.subject.toLowerCase().includes(term) ||
        parsed.email.toLowerCase().includes(term)
      );
    });
  }

  return normalized;
}

// ── List keys ────────────────────────────────────────────────────────────

export async function listStorageKeys(
  dataSource: DataSource,
  { organizationId, isAdmin }: { organizationId: number; isAdmin: boolean }
): Promise<string[]> {
  const repository = storageRepository(dataSource);

  if (isAdmin) {
    const records = await repository
      .createQueryBuilder('record')
      .where('record.organization_id = :organizationId', { organizationId })
      .select('DISTINCT record.key', 'key')
      .orderBy('record.key', 'ASC')
      .getRawMany();

    return records.map((row: any) => row.key);
  }

  const records = await repository
    .createQueryBuilder('record')
    .select('record.key', 'key')
    .where('record.organization_id = :organizationId', { organizationId })
    .orderBy('record.key', 'ASC')
    .getRawMany();

  return records.map((row: any) => row.key);
}

// ── Upsert ───────────────────────────────────────────────────────────────

export async function upsertStorageRecord(
  dataSource: DataSource,
  { key, value, userId, organizationId }: { key: string; value: string; userId: number; organizationId: number }
): Promise<NormalizedStorageRecord | null> {
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

// ── Delete ───────────────────────────────────────────────────────────────

export async function deleteStorageRecord(
  dataSource: DataSource,
  { key, organizationId }: { key: string; organizationId: number }
): Promise<boolean> {
  const result = await storageRepository(dataSource).delete({ key, organizationId });
  return (result.affected ?? 0) > 0;
}
