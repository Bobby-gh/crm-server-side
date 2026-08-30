import { DataSource, Repository } from 'typeorm';
import { User, PublicUser, toPublicUser } from '../entities/User';

export { PublicUser, toPublicUser } from '../entities/User';


import { generateTemporaryPassword, hashPassword, verifyPassword } from './passwords';
import { createOrganization } from './organizations';
import { Organization } from '../entities/Organization';

function userRepository(dataSource: DataSource): Repository<User> {
  return dataSource.getRepository(User);
}

export async function countUsers(dataSource: DataSource): Promise<number> {
  return userRepository(dataSource).count();
}

export async function getUserById(dataSource: DataSource, userId: number): Promise<PublicUser | null> {
  const user = await userRepository(dataSource).findOne({ where: { id: userId } });
  return toPublicUser(user);
}

export async function getUserByIdentifier(dataSource: DataSource, identifier: string): Promise<PublicUser | null> {
  const user = await userRepository(dataSource)
    .createQueryBuilder('user')
    .where('LOWER(user.username) = LOWER(:identifier)', { identifier })
    .orWhere("LOWER(COALESCE(user.email, '')) = LOWER(:identifier)", { identifier })
    .getOne();

  return toPublicUser(user);
}

export async function listUsers(dataSource: DataSource, organizationId: number): Promise<PublicUser[]> {
  const users = await userRepository(dataSource).find({
    where: {
      organizationId
    },
    order: {
      username: 'ASC'
    }
  });

  return users.map((u) => toPublicUser(u)!);
}

export async function createInitialAdmin(
  dataSource: DataSource,
  {
    username,
    email,
    password,
    organizationName
  }: {
    username: string;
    email: string | null;
    password: string;
    organizationName: string;
  }
): Promise<{ organization: any; user: PublicUser }> {
  const organization = await createOrganization(dataSource, {
    name: organizationName || username,
    createdByUserId: null
  });

  const repository = userRepository(dataSource);
  const entity = repository.create({
    username,
    email: email || null,
    organizationId: organization.id,
    isAdmin: true,
    mustChangePassword: false,
    passwordHash: hashPassword(password),
    createdByUserId: null,
    passwordChangedAt: new Date()
  });

  const user = await repository.save(entity);
  await dataSource.getRepository(Organization).update(
    { id: organization.id },
    { createdByUserId: user.id }
  );

  organization.createdByUserId = user.id;

  return {
    organization,
    user: toPublicUser(user)!
  };
}

export async function createUserWithTemporaryPassword(
  dataSource: DataSource,
  {
    username,
    email,
    createdByUserId,
    organizationId
  }: {
    username: string;
    email: string | null;
    createdByUserId: number;
    organizationId: number;
  }
): Promise<{ user: PublicUser; temporaryPassword: string }> {
  const repository = userRepository(dataSource);
  const temporaryPassword = generateTemporaryPassword();
  const entity = repository.create({
    username,
    email: email || null,
    organizationId,
    isAdmin: false,
    mustChangePassword: true,
    passwordHash: hashPassword(temporaryPassword),
    createdByUserId: createdByUserId || null,
    passwordChangedAt: null
  });

  const user = await repository.save(entity);
  return {
    user: toPublicUser(user)!,
    temporaryPassword
  };
}

export async function changePassword(
  dataSource: DataSource,
  {
    userId,
    currentPassword,
    newPassword
  }: {
    userId: number;
    currentPassword: string;
    newPassword: string;
  }
): Promise<{ success: boolean; reason?: string }> {
  const repository = userRepository(dataSource);
  const user = await repository.findOne({ where: { id: userId } });

  if (!user) {
    return { success: false, reason: 'not_found' };
  }

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return { success: false, reason: 'invalid_current_password' };
  }

  user.passwordHash = hashPassword(newPassword);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date();
  await repository.save(user);

  return { success: true };
}

export async function verifyUserPassword(
  dataSource: DataSource,
  identifier: string,
  password: string
): Promise<PublicUser | null> {
  const user = await userRepository(dataSource)
    .createQueryBuilder('user')
    .where('LOWER(user.username) = LOWER(:identifier)', { identifier })
    .orWhere("LOWER(COALESCE(user.email, '')) = LOWER(:identifier)", { identifier })
    .getOne();

  if (!user) {
    return null;
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return toPublicUser(user);
}

export async function getUserRecordByIdentifier(
  dataSource: DataSource,
  identifier: string
): Promise<User | null> {
  const user = await userRepository(dataSource)
    .createQueryBuilder('user')
    .where('LOWER(user.username) = LOWER(:identifier)', { identifier })
    .orWhere("LOWER(COALESCE(user.email, '')) = LOWER(:identifier)", { identifier })
    .getOne();

  return user || null;
}
