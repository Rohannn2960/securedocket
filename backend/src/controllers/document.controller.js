const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const documentService = require('../services/document.service');
const s3Service = require('../services/s3.service');
const { recordAuditEntry } = require('../services/audit.service');
const { AUDIT_ACTIONS } = require('../constants/actions');

async function getDocuments(req, res) {
  const { caseId, documentType, status, page, limit } = req.query;
  const result = await documentService.listDocuments({ caseId, documentType, status, page, limit });

  return ApiResponse.success(res, {
    message: 'Documents retrieved from vault',
    data: result.documents,
    meta: result.pagination,
  });
}

async function getDocument(req, res) {
  const { id } = req.params;
  const doc = await documentService.getDocumentById(id);

  if (req.user) {
    await recordAuditEntry({
      userId: req.user.id,
      documentId: doc._id,
      caseId: doc.caseId._id || doc.caseId,
      action: AUDIT_ACTIONS.DOCUMENT_VIEW,
      details: { sha256Hash: doc.sha256Hash, title: doc.title },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  return ApiResponse.success(res, {
    data: doc,
  });
}

async function getDocumentDownloadUrl(req, res) {
  const { id } = req.params;
  const doc = await documentService.getDocumentById(id);

  const downloadUrl = await s3Service.getPresignedDownloadUrl(doc.s3Key, 300);

  await recordAuditEntry({
    userId: req.user.id,
    documentId: doc._id,
    caseId: doc.caseId._id || doc.caseId,
    action: AUDIT_ACTIONS.DOCUMENT_DOWNLOAD,
    details: { s3Key: doc.s3Key, sha256Hash: doc.sha256Hash },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return ApiResponse.success(res, {
    message: 'Presigned S3 download URL generated (Valid for 5 minutes)',
    data: {
      downloadUrl,
      expiresInSeconds: 300,
      sha256Expected: doc.sha256Hash,
    },
  });
}

module.exports = {
  getDocuments,
  getDocument,
  getDocumentDownloadUrl,
};
