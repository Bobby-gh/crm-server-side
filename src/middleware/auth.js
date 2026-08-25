const { parseAuthToken } = require('../services/token');
const { getUserById } = require('../services/users');

function createAuthMiddleware(dataSource) {
  return async function authenticate(req, res, next) {
    const authHeader = req.get('Authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = bearerToken || req.get('x-auth-token') || req.query.token;
    const tokenPayload = parseAuthToken(token);

    if (!tokenPayload) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const user = await getUserById(dataSource, tokenPayload.sub);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    req.user = user;
    return next();
  };
}

function requireAuthenticated(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Admin access required.'
    });
  }

  return next();
}

function requirePasswordChanged(req, res, next) {
  if (req.user?.mustChangePassword) {
    return res.status(428).json({
      success: false,
      error: 'PASSWORD_CHANGE_REQUIRED',
      message: 'You must change your temporary password before using the app.'
    });
  }

  return next();
}

function requireOrganization(req, res, next) {
  if (!req.user?.organizationId) {
    return res.status(409).json({
      success: false,
      error: 'ORGANIZATION_REQUIRED',
      message: 'This account is not attached to an organization.'
    });
  }

  return next();
}

module.exports = {
  createAuthMiddleware,
  requireAdmin,
  requireAuthenticated,
  requireOrganization,
  requirePasswordChanged
};
