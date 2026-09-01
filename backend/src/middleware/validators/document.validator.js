const { body, param, query } = require('express-validator');
const handleValidationErrors = require('./handleValidation');
const { ALL_DOCUMENT_TYPES } = require('../../constants/documentTypes');

const validateDocumentIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Document ID must be a valid 24-character hexadecimal MongoDB ObjectId'),
  handleValidationErrors,
];

const validateUploadDocument = [
  body('caseId')
    .isMongoId()
    .withMessage('A valid caseId MongoDB ObjectId is required'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Document title is required')
    .isLength({ max: 200 })
    .withMessage('Document title must not exceed 200 characters'),
  body('documentType')
    .optional()
    .custom((val) => {
      if (!val) return true;
      const normalized = val.toUpperCase();
      const valid = ALL_DOCUMENT_TYPES.some((t) => t.toUpperCase() === normalized);
      if (!valid) {
        throw new Error(`Invalid documentType. Must be one of: ${ALL_DOCUMENT_TYPES.join(', ')}`);
      }
      return true;
    }),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  handleValidationErrors,
];

const validateCreateVersion = [
  param('id')
    .isMongoId()
    .withMessage('Document ID must be a valid MongoDB ObjectId'),
  body('changeDescription')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Change description must not exceed 500 characters'),
  handleValidationErrors,
];

const validateCompareVersions = [
  param('id')
    .isMongoId()
    .withMessage('Document ID must be a valid MongoDB ObjectId'),
  query('v1')
    .isInt({ min: 1 })
    .withMessage('v1 query parameter must be a positive integer version number'),
  query('v2')
    .isInt({ min: 1 })
    .withMessage('v2 query parameter must be a positive integer version number'),
  handleValidationErrors,
];

module.exports = {
  validateDocumentIdParam,
  validateUploadDocument,
  validateCreateVersion,
  validateCompareVersions,
};
