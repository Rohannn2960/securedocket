const ApiError = require('../utils/apiError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants/statusCodes');
const logger = require('../config/logger');
const config = require('../config/env');

/**
 * Global Centralized Error Handling Middleware
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  // 1. Transform Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    error = ApiError.badRequest(`Invalid resource identifier: ${err.value}`, ERROR_CODES.INVALID_INPUT, {
      path: err.path,
      value: err.value,
    });
  }

  // 2. Transform Mongoose Validation Error
  else if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    error = ApiError.badRequest('Validation failed for one or more fields', ERROR_CODES.VALIDATION_ERROR, details);
  }

  // 3. Transform Mongoose Duplicate Key Error (E11000)
  else if (err.code === 11000) {
    const duplicateFields = Object.keys(err.keyValue || {});
    error = ApiError.conflict(
      `Duplicate value entered for unique field: ${duplicateFields.join(', ')}`,
      ERROR_CODES.DUPLICATE_CASE_NUMBER,
      err.keyValue
    );
  }

  // 4. Transform JWT Errors
  else if (err.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('Invalid authentication token signature', ERROR_CODES.TOKEN_INVALID);
  } else if (err.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('Authentication token has expired', ERROR_CODES.TOKEN_EXPIRED);
  }

  // 5. Fallback for unhandled native / standard Errors
  else if (!(error instanceof ApiError)) {
    const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const message = err.message || 'An unexpected internal server error occurred';
    error = new ApiError(statusCode, message, ERROR_CODES.INTERNAL_ERROR, null, false);
  }

  // Structured logging of error event
  const logMeta = {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user ? req.user.id : undefined,
    statusCode: error.statusCode,
    errorCode: error.errorCode,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
  };

  if (error.statusCode >= 500) {
    logger.error(`Unhandled Server Exception: ${err.message}`, logMeta);
  } else {
    logger.warn(`Operational Client Error: ${error.message} (${error.errorCode})`, logMeta);
  }

  // Standardized JSON response payload
  const responsePayload = {
    success: false,
    statusCode: error.statusCode,
    error: {
      code: error.errorCode || ERROR_CODES.INTERNAL_ERROR,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
      ...(config.env === 'development' && error.stack ? { stack: error.stack } : {}),
    },
    timestamp: error.timestamp || new Date().toISOString(),
  };

  res.status(error.statusCode).json(responsePayload);
}

module.exports = errorHandler;
