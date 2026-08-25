const { generateTemporaryPassword, hashPassword, verifyPassword } = require('./passwords');
const { createOrganization } = require('./organizations');

function toPublicUser(user) {
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

function userRepository(dataSource) {
  return dataSource.getRepository('User');
}

async function countUsers(dataSource) {
  return userRepository(dataSource).count();
}

async function getUserById(dataSource, userId) {
  const user = await userRepository(dataSource).findOne({ where: { id: userId } });
  return toPublicUser(user);
}

async function getUserByIdentifier(dataSource, identifier) {
  const user = await userRepository(dataSource)
    .createQueryBuilder('user')
    .where('LOWER(user.username) = LOWER(:identifier)', { identifier })
    .orWhere('LOWER(COALESCE(user.email, \'\')) = LOWER(:identifier)', { identifier })
    .getOne();

  return toPublicUser(user);
}

async function listUsers(dataSource, organizationId) {
  const users = await userRepository(dataSource).find({
    where: {
      organizationId
    },
    order: {
      username: 'ASC'
    }
  });

  return users.map(toPublicUser);
}

async function createInitialAdmin(dataSource, { username, email, password, organizationName }) {
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
  await dataSource.getRepository('Organization').update(
    { id: organization.id },
    { createdByUserId: user.id }
  );

  organization.createdByUserId = user.id;

  return {
    organization,
    user: toPublicUser(user)
  };
}

async function createUserWithTemporaryPassword(dataSource, { username, email, createdByUserId, organizationId }) {
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
    user: toPublicUser(user),
    temporaryPassword
  };
}

async function changePassword(dataSource, { userId, currentPassword, newPassword }) {
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

async function verifyUserPassword(dataSource, identifier, password) {
  const user = await userRepository(dataSource)
    .createQueryBuilder('user')
    .where('LOWER(user.username) = LOWER(:identifier)', { identifier })
    .orWhere('LOWER(COALESCE(user.email, \'\')) = LOWER(:identifier)', { identifier })
    .getOne();

  if (!user) {
    return null;
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return toPublicUser(user);
}

async function getUserRecordByIdentifier(dataSource, identifier) {
  const user = await userRepository(dataSource)
    .createQueryBuilder('user')
    .where('LOWER(user.username) = LOWER(:identifier)', { identifier })
    .orWhere('LOWER(COALESCE(user.email, \'\')) = LOWER(:identifier)', { identifier })
    .getOne();

  return user || null;
}

module.exports = {
  changePassword,
  countUsers,
  createInitialAdmin,
  createUserWithTemporaryPassword,
  getUserById,
  getUserByIdentifier,
  getUserRecordByIdentifier,
  listUsers,
  toPublicUser,
  verifyUserPassword
};
