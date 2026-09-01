const express = require('express');
const { getDocuments, getDocument, getDocumentDownloadUrl } = require('../../controllers/document.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const asyncWrapper = require('../../utils/asyncWrapper');

const router = express.Router();

router.use(authenticate);

// GET /api/v1/documents
router.get('/', asyncWrapper(getDocuments));

// GET /api/v1/documents/:id
router.get('/:id', asyncWrapper(getDocument));

// GET /api/v1/documents/:id/download-url
router.get('/:id/download-url', asyncWrapper(getDocumentDownloadUrl));

module.exports = router;
