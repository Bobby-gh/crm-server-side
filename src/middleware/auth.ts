import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import { parseAuthToken } from '../services/token';
import { getUserById, PublicUser } from '../services/users';

export interface AuthenticatedRequest extends Request {
  user?: PublicUser | null;
}

export function createAuthMiddleware(dataSource: DataSource) {
  return async function authenticate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const authHeader = req.get('Authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = bearerToken || req.get('x-auth-token') || (req.query.token as string | undefined);
    const tokenPayload = parseAuthToken(token);

    if (!tokenPayload) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
      return;
    }

    const user = await getUserById(dataSource, tokenPayload.sub);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
      return;
    }

    req.user = user;
    next();
  };
}

export function requireAuthenticated(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
    return;
  }

  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Admin access required.'
    });
    return;
  }

  next();
}

export function requirePasswordChanged(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.user?.mustChangePassword) {
    res.status(428).json({
      success: false,
      error: 'PASSWORD_CHANGE_REQUIRED',
      message: 'You must change your temporary password before using the app.'
    });
    return;
  }

  next();
}

export function requireOrganization(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user?.organizationId) {
    res.status(409).json({
      success: false,
      error: 'ORGANIZATION_REQUIRED',
      message: 'This account is not attached to an organization.'
    });
    return;
  }

  next();
}
