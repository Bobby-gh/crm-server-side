import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Organization } from './Organization';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'text', unique: true })
  username!: string;

  @Column({ type: 'text', nullable: true })
  email!: string | null;

  @Column({ name: 'organization_id', type: 'int', nullable: true })
  organizationId!: number | null;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  @Column({ name: 'is_admin', type: 'boolean', default: false })
  isAdmin!: boolean;

  @Column({ name: 'must_change_password', type: 'boolean', default: false })
  mustChangePassword!: boolean;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash!: string;

  @Column({ name: 'created_by_user_id', type: 'int', nullable: true })
  createdByUserId!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'password_changed_at', type: 'timestamptz', nullable: true })
  passwordChangedAt!: Date | null;
}

export interface PublicUser {
  id: number;
  username: string;
  email: string | null;
  organizationId: number | null;
  isAdmin: boolean;
  mustChangePassword: boolean;
  createdByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
  passwordChangedAt: Date | null;
}

export function toPublicUser(user: User | null): PublicUser | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email || null,
    organizationId: user.organizationId || null,
    isAdmin: Boolean(user.isAdmin),
    mustChangePassword: Boolean(user.mustChangePassword),
    createdByUserId: user.createdByUserId || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    passwordChangedAt: user.passwordChangedAt || null
  };
}
