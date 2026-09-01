const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const documentService = require('../services/document.service');
const { recordAuditEntry } = require('../services/audit.service');
const { AUDIT_ACTIONS } = require('../constants/actions');

/**
 * Ingest document with SHA-256 calculation & SSE-S3 storage
 */
async function uploadDocument(req, res) {
  const { caseId, title, documentType, description, tags } = req.body;

  if (!caseId) {
    throw ApiError.badRequest('Target caseId is required for document ingestion');
  }

  let parsedTags = [];
  if (tags) {
    parsedTags = Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim());
  }

  const doc = await documentService.ingestDocument({
    caseId,
    title,
    documentType,
    file: req.file,
    description,
    tags: parsedTags,
    user: req.user,
  });

  await recordAuditEntry({
    userId: req.user.id,
    documentId: doc._id,
    caseId: doc.caseId._id || doc.caseId,
    action: AUDIT_ACTIONS.DOCUMENT_UPLOAD,
    details: {
      fileName: doc.fileName,
      originalName: doc.originalName,
      documentType: doc.documentType,
      sha256Hash: doc.sha256Hash,
      fileSizeBytes: doc.fileSize,
      s3Key: doc.s3Key,
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return ApiResponse.created(res, {
    message: 'Document ingested and cryptographically hashed successfully',
    data: doc,
  });
}

/**
 * List documents scoped by role clearance
 */
async function getDocuments(req, res) {
  const { caseId, documentType, status, page, limit, search } = req.query;
  const result = await documentService.listDocuments(
    { caseId, documentType, status, page, limit, search },
    req.user
  );

  return ApiResponse.success(res, {
    message: 'Documents retrieved from vault',
    data: result.documents,
    meta: result.pagination,
  });
}

/**
 * Get single document metadata
 */
async function getDocument(req, res) {
  const { id } = req.params;
  const doc = await documentService.getDocumentById(id, req.user);

  return ApiResponse.success(res, {
    message: 'Document dossier retrieved',
    data: doc,
  });
}

/**
 * Generate 5-minute Presigned View URL
 */
async function getDocumentViewUrl(req, res) {
  const { id } = req.params;
  const result = await documentService.generatePresignedViewUrl(id, req.user, 300);

  await recordAuditEntry({
    userId: req.user.id,
    documentId: result.document._id,
    caseId: result.document.caseId._id || result.document.caseId,
    action: AUDIT_ACTIONS.DOCUMENT_VIEW,
    details: {
      s3Key: result.document.s3Key,
      sha256Hash: result.document.sha256Hash,
      expiresInSeconds: 300,
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return ApiResponse.success(res, {
    message: 'Presigned S3 view URL generated (Valid for 5 minutes)',
    data: {
      url: result.url,
      expiresInSeconds: result.expiresInSeconds,
      expiresAt: result.expiresAt,
      sha256Expected: result.sha256Hash,
      fileName: result.fileName,
      mimeType: result.mimeType,
    },
  });
}

/**
 * Generate 5-minute Presigned Download URL
 */
async function getDocumentDownloadUrl(req, res) {
  const { id } = req.params;
  const result = await documentService.generatePresignedViewUrl(id, req.user, 300, 'attachment');

  await recordAuditEntry({
    userId: req.user.id,
    documentId: result.document._id,
    caseId: result.document.caseId._id || result.document.caseId,
    action: AUDIT_ACTIONS.DOCUMENT_DOWNLOAD,
    details: {
      s3Key: result.document.s3Key,
      sha256Hash: result.document.sha256Hash,
      expiresInSeconds: 300,
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return ApiResponse.success(res, {
    message: 'Presigned S3 download URL generated (Valid for 5 minutes)',
    data: {
      downloadUrl: result.url,
      expiresInSeconds: result.expiresInSeconds,
      expiresAt: result.expiresAt,
      sha256Expected: result.sha256Hash,
    },
  });
}

/**
 * Stream vaulted document with Presigned HMAC token validation (5-minute TTL)
 * Accessible via presigned signature
 */
async function streamVaultDocument(req, res) {
  const { id } = req.params;
  const { expires, signature, disposition } = req.query;

  const result = await documentService.getVaultStreamFile({
    documentIdOrKey: id,
    expires,
    signature,
  });

  await recordAuditEntry({
    userId: result.document.uploadedBy?._id || result.document.uploadedBy || null,
    documentId: result.document._id,
    caseId: result.document.caseId?._id || result.document.caseId,
    action: disposition === 'attachment' ? AUDIT_ACTIONS.DOCUMENT_DOWNLOAD : AUDIT_ACTIONS.DOCUMENT_VIEW,
    details: {
      s3Key: result.document.s3Key,
      sha256Hash: result.document.sha256Hash,
      streamingMethod: 'LOCAL_VAULT_STREAM',
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  const mimeType = result.mimeType || 'application/octet-stream';
  res.setHeader('Content-Type', mimeType);
  res.setHeader(
    'Content-Disposition',
    `${disposition === 'attachment' ? 'attachment' : 'inline'}; filename="${encodeURIComponent(result.fileName)}"`
  );
  res.setHeader('Content-Length', result.buffer.length);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  return res.status(200).send(result.buffer);
}

module.exports = {
  uploadDocument,
  getDocuments,
  getDocument,
  getDocumentViewUrl,
  getDocumentDownloadUrl,
  streamVaultDocument,
};
