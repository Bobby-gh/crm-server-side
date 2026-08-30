import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

@Entity({ name: 'kv_store' })
@Index('kv_store_org_key_idx', ['organizationId', 'key'], { unique: true })
@Index('kv_store_key_idx', ['key'])
export class StorageRecord {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'text' })
  key!: string;

  @Column({ type: 'text' })
  value!: string;

  @Column({ name: 'organization_id', type: 'int', nullable: true })
  organizationId!: number | null;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId!: number | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ── Customer request (application) types ──────────────────────────────────

export interface Exchange {
  date: string;
  type: string;
  summary: string;
}

export interface CustomerRequest {
  typeOfCustomer: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  attachment: string;
  subject: string;
  receivedAt: string;
  processingDays: number;
  status: 'New' | 'In Progress' | 'Processed' | 'Rejected';
  closingDate: string | null;
  notes: string;
  exchanges: Exchange[];
}

export interface NormalizedStorageRecord {
  key: string;
  value: string;
  parsedValue: CustomerRequest | null;
  organizationId: number | null;
  userId: number | null;
  username: string | null;
  updatedAt: Date;
}

export function parseCustomerRequest(value: string): CustomerRequest | null {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && typeof parsed.subject === 'string') {
      return parsed as CustomerRequest;
    }
    return null;
  } catch {
    return null;
  }
}

export function normalizeStorageRecord(record: StorageRecord | null): NormalizedStorageRecord | null {
  if (!record) {
    return null;
  }

  return {
    key: record.key,
    value: record.value,
    parsedValue: parseCustomerRequest(record.value),
    organizationId: record.organizationId || null,
    userId: record.userId || null,
    username: null,
    updatedAt: record.updatedAt
  };
}
