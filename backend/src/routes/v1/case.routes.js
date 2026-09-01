const express = require('express');
const { getCases, getCase, createCase } = require('../../controllers/case.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizeRoles } = require('../../middleware/rbac.middleware');
const { ROLES } = require('../../constants/roles');
const asyncWrapper = require('../../utils/asyncWrapper');

const router = express.Router();

// Require authentication on all case routes
router.use(authenticate);

// GET /api/v1/cases (Accessible by officer, verifier, admin, auditor)
router.get('/', asyncWrapper(getCases));

// GET /api/v1/cases/:id
router.get('/:id', asyncWrapper(getCase));

// POST /api/v1/cases (Accessible only by officers and admins)
router.post(
  '/',
  authorizeRoles(ROLES.OFFICER, ROLES.ADMIN),
  asyncWrapper(createCase)
);

module.exports = router;
