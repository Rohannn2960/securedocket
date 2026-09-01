const { HTTP_STATUS, ERROR_CODES } = require('../constants/statusCodes');

/**
 * Custom Operational Error Class for API exceptions
 */
class ApiError extends Error {
  constructor(
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message = 'Internal Server Error',
    errorCode = ERROR_CODES.INTERNAL_ERROR,
    details = null,
    isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', errorCode = ERROR_CODES.INVALID_INPUT, details = null) {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, message, errorCode, details);
  }

  static unauthorized(message = 'Authentication Required', errorCode = ERROR_CODES.AUTH_REQUIRED, details = null) {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, message, errorCode, details);
  }

  static forbidden(message = 'Access Denied', errorCode = ERROR_CODES.INSUFFICIENT_PERMISSIONS, details = null) {
    return new ApiError(HTTP_STATUS.FORBIDDEN, message, errorCode, details);
  }

  static notFound(message = 'Resource Not Found', errorCode = ERROR_CODES.DOCUMENT_NOT_FOUND, details = null) {
    return new ApiError(HTTP_STATUS.NOT_FOUND, message, errorCode, details);
  }

  static conflict(message = 'Resource Conflict', errorCode = ERROR_CODES.DUPLICATE_CASE_NUMBER, details = null) {
    return new ApiError(HTTP_STATUS.CONFLICT, message, errorCode, details);
  }

  static unprocessable(message = 'Unprocessable Entity', errorCode = ERROR_CODES.VALIDATION_ERROR, details = null) {
    return new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, message, errorCode, details);
  }

  static integrityFailure(message = 'Document integrity validation failed: cryptographic hash mismatch or tampering detected', details = null) {
    return new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, message, ERROR_CODES.INTEGRITY_CHECK_FAILED, details);
  }

  static internal(message = 'An unexpected server error occurred', details = null) {
    return new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message, ERROR_CODES.INTERNAL_ERROR, details, false);
  }
}

module.exports = ApiError;
