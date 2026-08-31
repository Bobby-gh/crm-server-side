import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import session from 'express-session';
import { DataSource } from 'typeorm';
import { ALLOWED_ORIGINS, IS_PRODUCTION, SESSION_SECRET, isAllowedOrigin } from './config/runtime';
import {
  createAuthMiddleware,
  requireAdmin,
  requireOrganization,
  requirePasswordChanged,
  AuthenticatedRequest
} from './middleware/auth';
import {
  validate,
  signupSchema,
  loginSchema,
  changePasswordSchema,
  createUserSchema,
  storagePutSchema,
  storageQuerySchema,
} from './middleware/validate';
import { createAuthToken } from './services/token';
import { verifyPassword } from './services/passwords';
import {
  changePassword,
  createInitialAdmin,
  createUserWithTemporaryPassword,
  getUserById,
  getUserRecordByIdentifier,
  listUsers,
  toPublicUser,
  PublicUser
} from './services/users';
import {
  deleteStorageRecord,
  getStorageRecord,
  listStorageKeys,
  listStorageRecords,
  upsertStorageRecord
} from './services/storage';

function asyncRoute(handler: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) =>
    Promise.resolve(handler(req, res, next)).catch(next);
}

function createCorsOptions() {
  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
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

function normalizeIdentifier(value: string): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function createApp(dataSource: DataSource) {
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

  app.get('/', (_req: Request, res: Response) => {
    res.json({
      status: 'OK',
      service: 'WAFI CRM Backend',
      database: 'postgres',
      orm: 'typeorm'
    });
  });

  const handleSignup = asyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const { username, email, password, organizationName } = req.body;

    const existingUser = await getUserRecordByIdentifier(dataSource, username);
    if (existingUser) {
      res.status(409).json({ error: "Ce nom d'utilisateur est déjà utilisé." });
      return;
    }

    const user = await createInitialAdmin(dataSource, {
      username,
      email: email || null,
      password,
      organizationName: organizationName || '',
    });

    const token = createAuthToken(user.user);
    res.status(201).json({
      username: user.user.username,
      email: user.user.email,
      token,
      message: 'Compte créé avec succès.'
    });
  });

  app.post('/api/signup', validate(signupSchema), handleSignup);

  app.post('/api/login', validate(loginSchema), asyncRoute(async (req: Request, res: Response) => {
    const { username, email, password } = req.body;
    const loginIdentifier = normalizeIdentifier(username || email || '');

    const userRecord = await getUserRecordByIdentifier(dataSource, loginIdentifier);
    if (!userRecord) {
      res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
      return;
    }

    if (!verifyPassword(password, userRecord.passwordHash)) {
      res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
      return;
    }

    const user = toPublicUser(userRecord);
    const token = createAuthToken(user!);
    res.json({
      username: user!.username,
      token,
      user,
      mustChangePassword: user!.mustChangePassword
    });
  }));

  app.post('/api/logout', authenticate, (_req: AuthenticatedRequest, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
    res.json({
      user: req.user
    });
  });

  app.post('/api/auth/change-password', authenticate, validate(changePasswordSchema), asyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;

    const result = await changePassword(dataSource, {
      userId: req.user!.id,
      currentPassword,
      newPassword
    });

    if (!result.success) {
      res.status(401).json({
        error: 'INVALID_CURRENT_PASSWORD',
        message: 'The current password is incorrect.'
      });
      return;
    }

    const refreshedUser = await getUserById(dataSource, req.user!.id);
    res.json({
      user: refreshedUser,
      message: 'Password updated successfully.'
    });
  }));

  app.get('/api/users', authenticate, requireOrganization, requirePasswordChanged, requireAdmin, asyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const users = await listUsers(dataSource, req.user!.organizationId!);
    res.json({ users });
  }));

  app.post('/api/users', authenticate, requireOrganization, requirePasswordChanged, requireAdmin, validate(createUserSchema), asyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const { username, email } = req.body;

    const existingUser = await getUserRecordByIdentifier(dataSource, username);
    if (existingUser) {
      res.status(409).json({ error: "Ce nom d'utilisateur est déjà utilisé." });
      return;
    }

    const result = await createUserWithTemporaryPassword(dataSource, {
      username,
      email: email || null,
      createdByUserId: req.user!.id,
      organizationId: req.user!.organizationId!
    });

    res.status(201).json({
      user: result.user,
      temporaryPassword: result.temporaryPassword,
      message: 'Utilisateur créé. Partagez le mot de passe temporaire avec la personne concernée.'
    });
  }));

  app.get('/api/storage/:key', authenticate, requireOrganization, requirePasswordChanged, asyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const key = req.params.key as string;
    const row = await getStorageRecord(dataSource, {
      key,
      organizationId: req.user!.organizationId!,
      isAdmin: req.user!.isAdmin
    });

    if (!row) {
      res.status(404).json({ error: 'not found' });
      return;
    }

    res.json(row);
  }));

  app.put('/api/storage/:key', authenticate, requireOrganization, requirePasswordChanged, validate(storagePutSchema), asyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const { value } = req.body;
    const key = req.params.key as string;
    const record = await upsertStorageRecord(dataSource, {
      key,
      value,
      userId: req.user!.id,
      organizationId: req.user!.organizationId!
    });

    res.json(record);
  }));

  app.delete('/api/storage/:key', authenticate, requireOrganization, requirePasswordChanged, asyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const key = req.params.key as string;
    const deleted = await deleteStorageRecord(dataSource, {
      key,
      organizationId: req.user!.organizationId!
    });

    res.json({ key, deleted });
  }));

  app.get('/api/storage', authenticate, requireOrganization, requirePasswordChanged, asyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const prefix = typeof req.query.prefix === 'string' ? req.query.prefix : '';
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const records = await listStorageRecords(dataSource, {
      prefix,
      organizationId: req.user!.organizationId!,
      isAdmin: req.user!.isAdmin,
      status,
      search
    });

    if (req.user!.isAdmin) {
      res.json({
        keys: records.map((record) => record.key),
        records,
        prefix,
        scope: 'organization'
      });
      return;
    }

    res.json({
      keys: records.map((record) => record.key),
      prefix
    });
  }));

  app.get('/api/storage/keys', authenticate, requireOrganization, requirePasswordChanged, asyncRoute(async (req: AuthenticatedRequest, res: Response) => {
    const keys = await listStorageKeys(dataSource, {
      organizationId: req.user!.organizationId!,
      isAdmin: req.user!.isAdmin
    });

    if (req.user!.isAdmin) {
      const records = await listStorageRecords(dataSource, {
        prefix: '',
        organizationId: req.user!.organizationId!,
        isAdmin: true
      });

      res.json({
        keys,
        records,
        scope: 'organization'
      });
      return;
    }

    res.json({ keys });
  }));

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res.status(500).json({
      error: 'internal_server_error',
      message: 'An unexpected error occurred.'
    });
  });

  return app;
}
