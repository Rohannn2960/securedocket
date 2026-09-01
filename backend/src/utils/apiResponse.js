const { HTTP_STATUS } = require('../constants/statusCodes');

/**
 * Standardized API Response Envelopes
 */
class ApiResponse {
  /**
   * Send a successful JSON response
   */
  static success(res, {
    statusCode = HTTP_STATUS.OK,
    message = 'Success',
    data = null,
    meta = null,
  } = {}) {
    const payload = {
      success: true,
      statusCode,
      message,
      ...(data !== null ? { data } : {}),
      ...(meta !== null ? { meta } : {}),
      timestamp: new Date().toISOString(),
    };

    return res.status(statusCode).json(payload);
  }

  /**
   * Send a created JSON response (201)
   */
  static created(res, { message = 'Resource created successfully', data = null, meta = null } = {}) {
    return ApiResponse.success(res, { statusCode: HTTP_STATUS.CREATED, message, data, meta });
  }

  /**
   * Send a standardized error JSON response
   */
  static error(res, {
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message = 'Internal Server Error',
    code = 'INTERNAL_ERROR',
    details = null,
  } = {}) {
    const payload = {
      success: false,
      statusCode,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
      timestamp: new Date().toISOString(),
    };

    return res.status(statusCode).json(payload);
  }
}

module.exports = ApiResponse;
