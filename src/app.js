const express = require('express');
const cors = require('cors');
const session = require('express-session');

const { ALLOWED_ORIGINS, IS_PRODUCTION, SESSION_SECRET, isAllowedOrigin } = require('./config/runtime');
const { createAuthMiddleware, requireAdmin, requireOrganization, requirePasswordChanged } = require('./middleware/auth');
const { createAuthToken } = require('./services/token');
const { verifyPassword } = require('./services/passwords');
const {
  changePassword,
  countUsers,
  createInitialAdmin,
  createUserWithTemporaryPassword,
  getUserById,
  getUserRecordByIdentifier,
  listUsers,
  toPublicUser
} = require('./services/users');
const {
  deleteStorageRecord,
  getStorageRecord,
  listStorageKeys,
  listStorageRecords,
  upsertStorageRecord
} = require('./services/storage');

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createCorsOptions() {
  return {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-auth-token']
  };
}

function normalizeIdentifier(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validateUsername(username) {
  if (!username) {
    return 'Identifiant et mot de passe requis';
  }

  if (username.length < 3) {
    return 'L’identifiant doit contenir au moins 3 caractères.';
  }

  return null;
}

function createApp(dataSource) {
  const app = express();
  const authenticate = createAuthMiddleware(dataSource);

  app.use(cors(createCorsOptions()));
  app.options('*', cors(createCorsOptions()));
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));
  app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: IS_PRODUCTION ? 'none' : 'lax',
      maxAge: 12 * 60 * 60 * 1000
    }
  }));

  app.get('/', (req, res) => {
    res.json({
      status: 'OK',
      service: 'WAFI CRM Backend',
      database: 'postgres',
      orm: 'typeorm'
    });
  });

  const handleSignup = asyncRoute(async (req, res) => {
    const totalUsers = await countUsers(dataSource);
    if (totalUsers > 0) {
      return res.status(409).json({
        error: 'signup_already_completed',
        message: 'An administrator already exists.'
      });
    }

    const { username, email, password } = req.body || {};
    const normalizedUsername = typeof username === 'string' ? username.trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim() : '';
    const usernameError = validateUsername(normalizedUsername);
    if (usernameError) {
      return res.status(400).json({ error: usernameError });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Adresse email invalide.' });
    }

    const user = await createInitialAdmin(dataSource, {
      username: normalizedUsername,
      email: normalizedEmail || null,
      password,
      organizationName: typeof req.body?.organizationName === 'string' ? req.body.organizationName.trim() : ''
    });

    const token = createAuthToken(user.user);
    res.status(201).json({
      organization: user.organization,
      user: user.user,
      token,
      message: 'Compte administrateur créé avec succès.'
    });
  });

  app.post('/api/signup', handleSignup);

  app.post('/api/login', asyncRoute(async (req, res) => {
    const { username, email, password } = req.body || {};
    const loginIdentifier = normalizeIdentifier(typeof username === 'string' ? username : typeof email === 'string' ? email : '');

    if (!loginIdentifier || !password) {
      return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
    }

    const userRecord = await getUserRecordByIdentifier(dataSource, loginIdentifier);
    if (!userRecord) {
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    }

    if (!verifyPassword(password, userRecord.passwordHash)) {
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    }

    const user = toPublicUser(userRecord);
    const token = createAuthToken(user);
    res.json({
      username: user.username,
      token,
      user,
      mustChangePassword: user.mustChangePassword
    });
  }));

  app.post('/api/logout', authenticate, (req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/me', authenticate, (req, res) => {
    res.json({
      user: req.user
    });
  });

  app.post('/api/auth/change-password', authenticate, asyncRoute(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required.' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'The new password must be at least 8 characters long.' });
    }

    const result = await changePassword(dataSource, {
      userId: req.user.id,
      currentPassword,
      newPassword
    });

    if (!result.success) {
      return res.status(401).json({
        error: 'INVALID_CURRENT_PASSWORD',
        message: 'The current password is incorrect.'
      });
    }

    const refreshedUser = await getUserById(dataSource, req.user.id);
    res.json({
      user: refreshedUser,
      message: 'Password updated successfully.'
    });
  }));

  app.get('/api/users', authenticate, requireOrganization, requirePasswordChanged, requireAdmin, asyncRoute(async (req, res) => {
    const users = await listUsers(dataSource, req.user.organizationId);
    res.json({ users });
  }));

  app.post('/api/users', authenticate, requireOrganization, requirePasswordChanged, requireAdmin, asyncRoute(async (req, res) => {
    const { username, email } = req.body || {};
    const normalizedUsername = typeof username === 'string' ? username.trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim() : '';

    const validationError = validateUsername(normalizedUsername);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Adresse email invalide.' });
    }

    const existingUser = await getUserRecordByIdentifier(dataSource, normalizedUsername);
    if (existingUser) {
      return res.status(409).json({ error: 'Ce nom d’utilisateur est déjà utilisé.' });
    }

    const result = await createUserWithTemporaryPassword(dataSource, {
      username: normalizedUsername,
      email: normalizedEmail || null,
      createdByUserId: req.user.id,
      organizationId: req.user.organizationId
    });

    res.status(201).json({
      user: result.user,
      temporaryPassword: result.temporaryPassword,
      message: 'Utilisateur créé. Partagez le mot de passe temporaire avec la personne concernée.'
    });
  }));

  app.get('/api/storage/:key', authenticate, requireOrganization, requirePasswordChanged, asyncRoute(async (req, res) => {
    const row = await getStorageRecord(dataSource, {
      key: req.params.key,
      organizationId: req.user.organizationId,
      isAdmin: req.user.isAdmin
    });

    if (!row) {
      return res.status(404).json({ error: 'not found' });
    }

    res.json(row);
  }));

  app.put('/api/storage/:key', authenticate, requireOrganization, requirePasswordChanged, asyncRoute(async (req, res) => {
    const { value } = req.body || {};
    if (typeof value !== 'string') {
      return res.status(400).json({ error: 'Le champ "value" doit être une chaîne de caractères' });
    }

    const record = await upsertStorageRecord(dataSource, {
      key: req.params.key,
      value,
      userId: req.user.id,
      organizationId: req.user.organizationId
    });

    res.json(record);
  }));

  app.delete('/api/storage/:key', authenticate, requireOrganization, requirePasswordChanged, asyncRoute(async (req, res) => {
    const deleted = await deleteStorageRecord(dataSource, {
      key: req.params.key,
      organizationId: req.user.organizationId
    });

    res.json({ key: req.params.key, deleted });
  }));

  app.get('/api/storage', authenticate, requireOrganization, requirePasswordChanged, asyncRoute(async (req, res) => {
    const prefix = typeof req.query.prefix === 'string' ? req.query.prefix : '';
    const records = await listStorageRecords(dataSource, {
      prefix,
      organizationId: req.user.organizationId,
      isAdmin: req.user.isAdmin
    });

    if (req.user.isAdmin) {
      return res.json({
        keys: records.map((record) => record.key),
        records,
        prefix,
        scope: 'organization'
      });
    }

    res.json({
      keys: records.map((record) => record.key),
      prefix
    });
  }));

  app.get('/api/storage/keys', authenticate, requireOrganization, requirePasswordChanged, asyncRoute(async (req, res) => {
    const keys = await listStorageKeys(dataSource, {
      organizationId: req.user.organizationId,
      isAdmin: req.user.isAdmin
    });

    if (req.user.isAdmin) {
      const records = await listStorageRecords(dataSource, {
        prefix: '',
        organizationId: req.user.organizationId,
        isAdmin: true
      });

      return res.json({
        keys,
        records,
        scope: 'organization'
      });
    }

    res.json({ keys });
  }));

  app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({
      error: 'internal_server_error',
      message: 'An unexpected error occurred.'
    });
  });

  return app;
}

module.exports = {
  createApp
};
