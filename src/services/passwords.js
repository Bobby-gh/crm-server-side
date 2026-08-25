const bcrypt = require('bcryptjs');
const crypto = require('crypto');

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, passwordHash) {
  return bcrypt.compareSync(password, passwordHash);
}

function generateTemporaryPassword() {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12);
}

module.exports = {
  generateTemporaryPassword,
  hashPassword,
  verifyPassword
};
