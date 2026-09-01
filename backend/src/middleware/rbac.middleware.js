const ApiError = require('../utils/apiError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants/statusCodes');
const logger = require('../config/logger');

/**
 * RBAC Authorization Guard
 * @param {...string} allowedRoles - Permitted roles for the target route
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Authentication required before authorization check', ERROR_CODES.AUTH_REQUIRED));
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      logger.warn(`Unauthorized access attempt by user ${req.user.id} (${userRole}) to ${req.originalUrl}`, {
        userId: req.user.id,
        role: userRole,
        url: req.originalUrl,
        allowedRoles,
      });

      return next(
        new ApiError(
          HTTP_STATUS.FORBIDDEN,
          `Access forbidden: Role '${userRole}' does not have sufficient clearance for this resource. Required: [${allowedRoles.join(', ')}]`,
          ERROR_CODES.INSUFFICIENT_PERMISSIONS
        )
      );
    }

    next();
  };
}

module.exports = {
  authorizeRoles,
};
