const ApiError = require('../utils/apiError');
const { ERROR_CODES } = require('../constants/statusCodes');

/**
 * Lightweight Schema / Field Validation Middleware
 * @param {object} rules - Object containing validators for body, query, or params
 */
function validate(rules = {}) {
  return (req, res, next) => {
    const errors = [];

    // Validate body fields
    if (rules.body) {
      for (const [field, validator] of Object.entries(rules.body)) {
        const value = req.body ? req.body[field] : undefined;
        const result = typeof validator === 'function' ? validator(value) : (value !== undefined && value !== null && value !== '');

        if (!result || (typeof result === 'object' && !result.valid)) {
          const message = typeof result === 'object' && result.message
            ? result.message
            : `Field '${field}' is required and must be valid`;
          errors.push({ field, location: 'body', message });
        }
      }
    }

    // Validate params
    if (rules.params) {
      for (const [field, validator] of Object.entries(rules.params)) {
        const value = req.params ? req.params[field] : undefined;
        const result = typeof validator === 'function' ? validator(value) : Boolean(value);

        if (!result || (typeof result === 'object' && !result.valid)) {
          const message = typeof result === 'object' && result.message
            ? result.message
            : `URL parameter '${field}' is invalid`;
          errors.push({ field, location: 'params', message });
        }
      }
    }

    if (errors.length > 0) {
      return next(ApiError.badRequest('Request validation failed', ERROR_CODES.VALIDATION_ERROR, errors));
    }

    next();
  };
}

module.exports = {
  validate,
};
