import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  return bcrypt.compareSync(password, passwordHash);
}

export function generateTemporaryPassword(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12);
}
