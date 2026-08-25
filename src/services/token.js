const crypto = require('crypto');
const { SESSION_SECRET } = require('../config/runtime');

function createAuthToken(user) {
  const payload = {
    sub: user.id,
    username: user.username,
    exp: Date.now() + 12 * 60 * 60 * 1000
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(encodedPayload).digest('hex');
  return `${encodedPayload}.${signature}`;
}

function parseAuthToken(token) {
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
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload || typeof payload.sub !== 'number' || payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

module.exports = {
  createAuthToken,
  parseAuthToken
};
