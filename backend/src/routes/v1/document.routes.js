const express = require('express');
const {
  uploadDocument,
  getDocuments,
  getDocument,
  getDocumentViewUrl,
  getDocumentDownloadUrl,
  streamVaultDocument,
} = require('../../controllers/document.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { handleSingleUpload } = require('../../middleware/upload.middleware');
const { ROLES } = require('../../constants/roles');
const asyncWrapper = require('../../utils/asyncWrapper');

const router = express.Router();

// GET /api/v1/documents/vault-stream/:id (Time-limited Cryptographically Signed Presigned Stream)
// Publicly accessible via presigned signature and expiry parameters
router.get('/vault-stream/:id', asyncWrapper(streamVaultDocument));

// Require authentication across standard API endpoints
router.use(requireAuth);

// GET /api/v1/documents (List documents scoped by clearance)
router.get(
  '/',
  requireRole(ROLES.OFFICER, ROLES.VERIFIER, ROLES.ADMIN, ROLES.AUDITOR),
  asyncWrapper(getDocuments)
);

// POST /api/v1/documents (Secure Ingestion: OFFICER or ADMIN only)
router.post(
  '/',
  requireRole(ROLES.OFFICER, ROLES.ADMIN),
  handleSingleUpload('file'),
  asyncWrapper(uploadDocument)
);

// GET /api/v1/documents/:id/view (Generate 5-Minute Presigned View URL)
router.get(
  '/:id/view',
  requireRole(ROLES.OFFICER, ROLES.VERIFIER, ROLES.ADMIN, ROLES.AUDITOR),
  asyncWrapper(getDocumentViewUrl)
);

// GET /api/v1/documents/:id/download-url (Generate 5-Minute Presigned Download URL)
router.get(
  '/:id/download-url',
  requireRole(ROLES.OFFICER, ROLES.VERIFIER, ROLES.ADMIN, ROLES.AUDITOR),
  asyncWrapper(getDocumentDownloadUrl)
);

// GET /api/v1/documents/:id (Get document metadata dossier)
router.get(
  '/:id',
  requireRole(ROLES.OFFICER, ROLES.VERIFIER, ROLES.ADMIN, ROLES.AUDITOR),
  asyncWrapper(getDocument)
);

module.exports = router;
