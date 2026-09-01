const express = require('express');
const { authenticate, authorizeRoles } = require('../../middlewares/auth.middleware');
const { ROLES } = require('../../constants/roles');
const { performSemanticSearch } = require('../../controllers/search.controller');

const router = express.Router();

/**
 * @route   POST /api/v1/search/semantic
 * @desc    Perform a semantic document search based on a natural language query
 * @access  Private (Officer, Verifier, Admin)
 */
router.post(
  '/semantic',
  authenticate,
  authorizeRoles(ROLES.OFFICER, ROLES.VERIFIER, ROLES.ADMIN),
  performSemanticSearch
);

module.exports = router;
