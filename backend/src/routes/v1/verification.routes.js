const express = require('express');
const {
  getVerificationQueue,
  getDocumentExtraction,
  triggerExtraction,
  updateFieldCorrection,
  approveField,
  verifyDocument,
  flagDocument,
} = require('../../controllers/verification.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { ROLES } = require('../../constants/roles');
const asyncWrapper = require('../../utils/asyncWrapper');

const router = express.Router();

// Require authentication across all verification endpoints
router.use(requireAuth);

// GET /api/v1/verification/queue (List verification queue - Verifier, Admin, Auditor)
router.get(
  '/queue',
  requireRole(ROLES.VERIFIER, ROLES.ADMIN, ROLES.AUDITOR),
  asyncWrapper(getVerificationQueue)
);

// GET /api/v1/verification/:id (Get single document extraction dossier)
router.get(
  '/:id',
  requireRole(ROLES.VERIFIER, ROLES.ADMIN, ROLES.AUDITOR, ROLES.OFFICER),
  asyncWrapper(getDocumentExtraction)
);

// POST /api/v1/verification/:id/extract (Trigger / Re-run AI OCR pipeline)
router.post(
  '/:id/extract',
  requireRole(ROLES.VERIFIER, ROLES.ADMIN),
  asyncWrapper(triggerExtraction)
);

// PATCH /api/v1/verification/:id/fields (Correct extracted field - Verifier / Admin only)
router.patch(
  '/:id/fields',
  requireRole(ROLES.VERIFIER, ROLES.ADMIN),
  asyncWrapper(updateFieldCorrection)
);

// POST /api/v1/verification/:id/fields/approve (Approve field - Verifier / Admin only)
router.post(
  '/:id/fields/approve',
  requireRole(ROLES.VERIFIER, ROLES.ADMIN),
  asyncWrapper(approveField)
);

// POST /api/v1/verification/:id/verify (Finalize verification and certify document)
router.post(
  '/:id/verify',
  requireRole(ROLES.VERIFIER, ROLES.ADMIN),
  asyncWrapper(verifyDocument)
);

// POST /api/v1/verification/:id/flag (Flag document for discrepancy / tamper)
router.post(
  '/:id/flag',
  requireRole(ROLES.VERIFIER, ROLES.ADMIN),
  asyncWrapper(flagDocument)
);

module.exports = router;
