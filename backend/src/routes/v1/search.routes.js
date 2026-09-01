const express = require('express');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { ROLES } = require('../../constants/roles');
const { performSemanticSearch } = require('../../controllers/search.controller');
const asyncWrapper = require('../../utils/asyncWrapper');

const router = express.Router();

/**
 * @route   POST /api/v1/search/semantic
 * @desc    Perform a semantic document search based on a natural language query
 * @access  Private (Officer, Verifier, Admin)
 */
router.post(
  '/semantic',
  requireAuth,
  requireRole(ROLES.OFFICER, ROLES.VERIFIER, ROLES.ADMIN, ROLES.AUDITOR),
  asyncWrapper(performSemanticSearch)
);

module.exports = router;
