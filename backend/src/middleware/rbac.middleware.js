const ApiError = require('../utils/apiError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants/statusCodes');
const logger = require('../config/logger');

/**
 * Reusable Role-Based Access Control Middleware
 * Checks if authenticated user possesses one of the authorized roles for the route.
 * @param {...string} allowedRoles - Permitted roles (e.g. 'admin', 'officer', 'verifier', 'auditor')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Authentication required before clearance check', ERROR_CODES.AUTH_REQUIRED));
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      logger.warn(`Clearance violation: User ${req.user.id} (${userRole}) attempted unauthorized access to ${req.method} ${req.originalUrl}`, {
        userId: req.user.id,
        role: userRole,
        url: req.originalUrl,
        allowedRoles,
      });

      return next(
        new ApiError(
          HTTP_STATUS.FORBIDDEN,
          `Access forbidden: Role '${userRole}' does not have clearance for this operation. Required role(s): [${allowedRoles.join(', ')}]`,
          ERROR_CODES.INSUFFICIENT_PERMISSIONS
        )
      );
    }

    next();
  };
}

module.exports = {
  requireRole,
  authorizeRoles: requireRole, // Alias for backward compatibility
};
