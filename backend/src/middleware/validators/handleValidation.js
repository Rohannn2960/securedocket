const { validationResult } = require('express-validator');
const ApiError = require('../../utils/apiError');
const { ERROR_CODES } = require('../../constants/statusCodes');

/**
 * Middleware that extracts errors from express-validator chains and throws ApiError
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      location: err.location,
    }));
    return next(ApiError.badRequest('Validation failed for one or more fields', ERROR_CODES.VALIDATION_ERROR, formatted));
  }
  next();
}

module.exports = handleValidationErrors;
