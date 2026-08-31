import crypto from 'crypto';
import { SESSION_SECRET } from '../config/runtime';

interface AuthTokenPayload {
  sub: number;
  username: string;
  exp: number;
  v: string; // user version — passwordChangedAt timestamp used to invalidate tokens across DB resets
}

export function createAuthToken(user: { id: number; username: string; passwordChangedAt: Date | null }): string {
  const payload: AuthTokenPayload = {
    sub: user.id,
    username: user.username,
    exp: Date.now() + 12 * 60 * 60 * 1000,
    v: user.passwordChangedAt ? user.passwordChangedAt.toISOString() : ''
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(encodedPayload).digest('hex');
  return `${encodedPayload}.${signature}`;
}

export function parseAuthToken(token: string | null | undefined): AuthTokenPayload | null {
  if (typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(encodedPayload).digest('hex');
  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload: AuthTokenPayload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload || typeof payload.sub !== 'number' || payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
