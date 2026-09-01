const express = require('express');
const { getDocuments, getDocument, getDocumentDownloadUrl } = require('../../controllers/document.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { ROLES } = require('../../constants/roles');
const asyncWrapper = require('../../utils/asyncWrapper');

const router = express.Router();

router.use(requireAuth);

// GET /api/v1/documents (Viewable by all authorized roles)
router.get('/', asyncWrapper(getDocuments));

// GET /api/v1/documents/:id
router.get('/:id', asyncWrapper(getDocument));

// GET /api/v1/documents/:id/download-url
router.get('/:id/download-url', asyncWrapper(getDocumentDownloadUrl));

// POST /api/v1/documents (Upload permitted only to OFFICER and ADMIN)
router.post(
  '/',
  requireRole(ROLES.OFFICER, ROLES.ADMIN),
  asyncWrapper((req, res) => {
    res.status(501).json({ success: false, message: 'Document upload pipeline is scheduled for Phase 2.' });
  })
);

// POST /api/v1/documents/:id/verify (Verification permitted only to VERIFIER and ADMIN - Auditor/Officer cannot modify)
router.post(
  '/:id/verify',
  requireRole(ROLES.VERIFIER, ROLES.ADMIN),
  asyncWrapper((req, res) => {
    res.status(501).json({ success: false, message: 'Document verification pipeline is scheduled for Phase 2.' });
  })
);

module.exports = router;
