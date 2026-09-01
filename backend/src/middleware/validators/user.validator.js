const { body, param } = require('express-validator');
const handleValidationErrors = require('./handleValidation');
const { ALL_ROLES } = require('../../constants/roles');

const validateCreateUser = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Official email is required')
    .isEmail()
    .withMessage('Must be a valid official email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Initial password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(ALL_ROLES)
    .withMessage(`Role must be one of: ${ALL_ROLES.join(', ')}`),
  body('badgeNumber')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Badge number cannot exceed 50 characters'),
  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department cannot exceed 100 characters'),
  handleValidationErrors,
];

const validateUpdateRole = [
  param('id')
    .isMongoId()
    .withMessage('Invalid User ID'),
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(ALL_ROLES)
    .withMessage(`Role must be one of: ${ALL_ROLES.join(', ')}`),
  handleValidationErrors,
];

const validateUpdateStatus = [
  param('id')
    .isMongoId()
    .withMessage('Invalid User ID'),
  body('isActive')
    .notEmpty()
    .withMessage('isActive status is required')
    .isBoolean()
    .withMessage('isActive must be a boolean (true/false)'),
  handleValidationErrors,
];

module.exports = {
  validateCreateUser,
  validateUpdateRole,
  validateUpdateStatus,
};
