const express = require('express');
const {
  getCases,
  getCase,
  createCase,
  updateCase,
  assignOfficers,
  getCaseStatistics,
} = require('../../controllers/case.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const {
  validateCreateCase,
  validateUpdateCase,
  validateAssignOfficers,
  validateCaseIdParam,
} = require('../../middleware/validators/case.validator');
const { ROLES } = require('../../constants/roles');
const asyncWrapper = require('../../utils/asyncWrapper');

const router = express.Router();

// Require authentication on all case routes
router.use(requireAuth);

// GET /api/v1/cases/statistics (Role-scoped aggregate metrics)
router.get(
  '/statistics',
  requireRole(ROLES.OFFICER, ROLES.VERIFIER, ROLES.ADMIN, ROLES.AUDITOR),
  asyncWrapper(getCaseStatistics)
);

// GET /api/v1/cases (Role-scoped case list)
router.get(
  '/',
  requireRole(ROLES.OFFICER, ROLES.VERIFIER, ROLES.ADMIN, ROLES.AUDITOR),
  asyncWrapper(getCases)
);

// POST /api/v1/cases (Case registration by Officer or Admin)
router.post(
  '/',
  requireRole(ROLES.OFFICER, ROLES.ADMIN),
  validateCreateCase,
  asyncWrapper(createCase)
);

// GET /api/v1/cases/:id (Single case dossier - access boundary enforced)
router.get(
  '/:id',
  validateCaseIdParam,
  requireRole(ROLES.OFFICER, ROLES.VERIFIER, ROLES.ADMIN, ROLES.AUDITOR),
  asyncWrapper(getCase)
);

// PATCH /api/v1/cases/:id (Permitted case updates by Assigned Officer or Admin)
router.patch(
  '/:id',
  requireRole(ROLES.OFFICER, ROLES.ADMIN),
  validateUpdateCase,
  asyncWrapper(updateCase)
);

// POST /api/v1/cases/:id/officers (Assign personnel to case)
router.post(
  '/:id/officers',
  requireRole(ROLES.OFFICER, ROLES.ADMIN),
  validateAssignOfficers,
  asyncWrapper(assignOfficers)
);

module.exports = router;
