const express = require('express');
const {
  uploadDocument,
  getDocuments,
  getDocument,
  getDocumentViewUrl,
  getDocumentDownloadUrl,
  streamVaultDocument,
  createDocumentVersion,
  getDocumentVersions,
  getDocumentVersion,
  getVersionViewUrl,
  compareDocumentVersions,
} = require('../../controllers/document.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { handleSingleUpload } = require('../../middleware/upload.middleware');
const { ROLES } = require('../../constants/roles');
const {
  validateDocumentIdParam,
  validateUploadDocument,
  validateCreateVersion,
  validateCompareVersions,
} = require('../../middleware/validators/document.validator');
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
  validateUploadDocument,
  asyncWrapper(uploadDocument)
);

// GET /api/v1/documents/:id/versions/compare (Compare two versions)
router.get(
  '/:id/versions/compare',
  validateCompareVersions,
  requireRole(ROLES.OFFICER, ROLES.VERIFIER, ROLES.ADMIN, ROLES.AUDITOR),
  asyncWrapper(compareDocumentVersions)
);

// GET /api/v1/documents/:id/versions/:versionNumber/view (Presigned View URL for specific version)
router.get(
  '/:id/versions/:versionNumber/view',
  validateDocumentIdParam,
  requireRole(ROLES.OFFICER, ROLES.VERIFIER, ROLES.ADMIN, ROLES.AUDITOR),
  asyncWrapper(getVersionViewUrl)
);

// GET /api/v1/documents/:id/versions/:versionNumber (Get specific version record)
router.get(
  '/:id/versions/:versionNumber',
  validateDocumentIdParam,
  requireRole(ROLES.OFFICER, ROLES.VERIFIER, ROLES.ADMIN, ROLES.AUDITOR),
  asyncWrapper(getDocumentVersion)
);

// GET /api/v1/documents/:id/versions (List all versions of a document)
router.get(
  '/:id/versions',
  validateDocumentIdParam,
  requireRole(ROLES.OFFICER, ROLES.VERIFIER, ROLES.ADMIN, ROLES.AUDITOR),
  asyncWrapper(getDocumentVersions)
);

// POST /api/v1/documents/:id/versions (Create new document version / revision: Officer, Verifier, Admin)
router.post(
  '/:id/versions',
  requireRole(ROLES.OFFICER, ROLES.VERIFIER, ROLES.ADMIN),
  handleSingleUpload('file'),
  validateCreateVersion,
  asyncWrapper(createDocumentVersion)
);

// GET /api/v1/documents/:id/view (Generate 5-Minute Presigned View URL)
router.get(
  '/:id/view',
  validateDocumentIdParam,
  requireRole(ROLES.OFFICER, ROLES.VERIFIER, ROLES.ADMIN, ROLES.AUDITOR),
  asyncWrapper(getDocumentViewUrl)
);

// GET /api/v1/documents/:id/download-url (Generate 5-Minute Presigned Download URL)
router.get(
  '/:id/download-url',
  validateDocumentIdParam,
  requireRole(ROLES.OFFICER, ROLES.VERIFIER, ROLES.ADMIN, ROLES.AUDITOR),
  asyncWrapper(getDocumentDownloadUrl)
);

// GET /api/v1/documents/:id (Get document metadata dossier)
router.get(
  '/:id',
  validateDocumentIdParam,
  requireRole(ROLES.OFFICER, ROLES.VERIFIER, ROLES.ADMIN, ROLES.AUDITOR),
  asyncWrapper(getDocument)
);

module.exports = router;

