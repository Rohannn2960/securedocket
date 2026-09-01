const logger = require('../config/logger');

/**
 * Audit Logging Interceptor Middleware
 * Helper to record high-level operational events during API execution.
 */
function auditAction(actionType) {
  return (req, res, next) => {
    // Attach audit context to request for consumption by controller / post-response hook
    req.auditContext = {
      action: actionType,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date(),
    };

    logger.audit(actionType, `Operation initiated on ${req.originalUrl}`, {
      userId: req.user ? req.user.id : undefined,
      ip: req.ip,
    });

    next();
  };
}

module.exports = {
  auditAction,
};
