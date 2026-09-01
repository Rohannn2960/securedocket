const { body } = require('express-validator');
const handleValidationErrors = require('./handleValidation');

const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors,
];

const validateVerify2fa = [
  body('totpCode')
    .trim()
    .notEmpty()
    .withMessage('6-digit TOTP verification code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('TOTP code must be exactly 6 digits')
    .isNumeric()
    .withMessage('TOTP code must contain digits only'),
  body('tempToken')
    .optional()
    .isString()
    .withMessage('Temporary token must be a string'),
  body('userId')
    .optional()
    .isMongoId()
    .withMessage('User ID must be a valid MongoDB identifier'),
  handleValidationErrors,
];

const validateVerifySetup2fa = [
  body('totpCode')
    .trim()
    .notEmpty()
    .withMessage('6-digit TOTP code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('TOTP code must be exactly 6 digits')
    .isNumeric()
    .withMessage('TOTP code must contain digits only'),
  body('secret')
    .trim()
    .notEmpty()
    .withMessage('TOTP secret key is required for initial verification'),
  handleValidationErrors,
];

module.exports = {
  validateLogin,
  validateVerify2fa,
  validateVerifySetup2fa,
};
