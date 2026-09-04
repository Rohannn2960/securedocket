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

/**
 * Create a new document version (Authorized Edit)
 */
async function createDocumentVersion(req, res) {
  const { id } = req.params;
  const { changeDescription, updatedFields, title } = req.body;

  let parsedFields = updatedFields;
  if (typeof updatedFields === 'string') {
    try {
      parsedFields = JSON.parse(updatedFields);
    } catch {
      parsedFields = undefined;
    }
  }

  const updatedDoc = await documentService.createDocumentVersion({
    documentId: id,
    file: req.file,
    changeDescription,
    updatedFields: parsedFields,
    title,
    user: req.user,
  });

  return ApiResponse.created(res, {
    message: `Document revision v${updatedDoc.version} created successfully`,
    data: updatedDoc,
  });
}

/**
 * Get all document versions
 */
async function getDocumentVersions(req, res) {
  const { id } = req.params;
  const versionsData = await documentService.getDocumentVersions(id, req.user);

  return ApiResponse.success(res, {
    message: 'Document version history retrieved',
    data: versionsData,
  });
}

/**
 * Get specific version details
 */
async function getDocumentVersion(req, res) {
  const { id, versionNumber } = req.params;
  const versionData = await documentService.getDocumentVersion(id, versionNumber, req.user);

  return ApiResponse.success(res, {
    message: `Document version v${versionNumber} retrieved`,
    data: versionData,
  });
}

/**
 * Generate 5-minute Presigned View URL for specific version
 */
async function getVersionViewUrl(req, res) {
  const { id, versionNumber } = req.params;
  const result = await documentService.generateVersionPresignedViewUrl({
    documentId: id,
    versionNumber,
    user: req.user,
    expiresInSeconds: 300,
  });

  return ApiResponse.success(res, {
    message: `Presigned S3 view URL for version v${versionNumber} generated`,
    data: result,
  });
}

/**
 * Compare two versions of a document
 */
async function compareDocumentVersions(req, res) {
  const { id } = req.params;
  const { v1, v2 } = req.query;

  if (!v1 || !v2) {
    throw ApiError.badRequest('Both v1 and v2 query parameters are required for version comparison');
  }

  const diffData = await documentService.compareDocumentVersions({
    documentId: id,
    versionA: parseInt(v1, 10),
    versionB: parseInt(v2, 10),
    user: req.user,
  });

  return ApiResponse.success(res, {
    message: `Comparison between v${v1} and v${v2} calculated`,
    data: diffData,
  });
}

module.exports = {
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
};
