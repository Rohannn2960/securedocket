const { body, param, query } = require('express-validator');
const handleValidation = require('./handleValidation');
const { CASE_STATUS, CASE_PRIORITY } = require('../../models/Case');

const validStatuses = Object.values(CASE_STATUS);
const validPriorities = Object.values(CASE_PRIORITY);

const validateCreateCase = [
  body('caseNumber')
    .trim()
    .notEmpty()
    .withMessage('Case number / Crime reference is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Case number must be between 3 and 50 characters'),

  body('title')
    .trim()
    .notEmpty()
    .withMessage('Case title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Case title must be between 3 and 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description cannot exceed 5000 characters'),

  body('jurisdiction')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Jurisdiction cannot exceed 200 characters'),

  body('incidentDate')
    .optional()
    .isISO8601()
    .withMessage('Incident date must be a valid ISO8601 date'),

  body('status')
    .optional()
    .isIn(validStatuses)
    .withMessage(`Status must be one of: ${validStatuses.join(', ')}`),

  body('priority')
    .optional()
    .isIn(validPriorities)
    .withMessage(`Priority must be one of: ${validPriorities.join(', ')}`),

  body('assignedOfficers')
    .optional()
    .isArray()
    .withMessage('Assigned officers must be an array of user IDs'),

  body('assignedOfficers.*')
    .optional()
    .isMongoId()
    .withMessage('Each assigned officer ID must be a valid Mongo ObjectId'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array of strings'),

  handleValidation,
];

const validateUpdateCase = [
  param('id')
    .isMongoId()
    .withMessage('Invalid case identifier'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Case title must be between 3 and 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description cannot exceed 5000 characters'),

  body('jurisdiction')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Jurisdiction cannot exceed 200 characters'),

  body('incidentDate')
    .optional()
    .isISO8601()
    .withMessage('Incident date must be a valid ISO8601 date'),

  body('status')
    .optional()
    .isIn(validStatuses)
    .withMessage(`Status must be one of: ${validStatuses.join(', ')}`),

  body('priority')
    .optional()
    .isIn(validPriorities)
    .withMessage(`Priority must be one of: ${validPriorities.join(', ')}`),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array of strings'),

  handleValidation,
];

const validateAssignOfficers = [
  param('id')
    .isMongoId()
    .withMessage('Invalid case identifier'),

  body('officerIds')
    .isArray({ min: 1 })
    .withMessage('officerIds must be a non-empty array of user IDs'),

  body('officerIds.*')
    .isMongoId()
    .withMessage('Each officerId must be a valid Mongo ObjectId'),

  handleValidation,
];

const validateCaseIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Invalid case identifier'),
  handleValidation,
];

module.exports = {
  validateCreateCase,
  validateUpdateCase,
  validateAssignOfficers,
  validateCaseIdParam,
};
