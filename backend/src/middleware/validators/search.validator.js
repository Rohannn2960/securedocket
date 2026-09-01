const { body } = require('express-validator');
const handleValidationErrors = require('./handleValidation');

const validateSemanticSearch = [
  body('query')
    .trim()
    .notEmpty()
    .withMessage('Search query string is required')
    .isLength({ max: 500 })
    .withMessage('Search query must not exceed 500 characters'),
  body('caseId')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('caseId must be a valid 24-character hexadecimal MongoDB ObjectId'),
  handleValidationErrors,
];

module.exports = {
  validateSemanticSearch,
};
