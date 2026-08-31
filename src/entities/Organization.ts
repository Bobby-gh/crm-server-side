import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity({ name: 'organizations' })
export class Organization {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'text', nullable: true })
  name!: string | null;

  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ name: 'created_by_user_id', type: 'int', nullable: true })
  createdByUserId!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

export interface PublicOrganization {
  id: number;
  name: string | null;
  slug: string;
  createdByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicOrganization(organization: Organization | null): PublicOrganization | null {
  if (!organization) {
    return null;
  }

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    createdByUserId: organization.createdByUserId || null,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt
  };
}
