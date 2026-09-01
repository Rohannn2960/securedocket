const { Document } = require('../models');
const ApiError = require('../utils/apiError');
const { ERROR_CODES, HTTP_STATUS } = require('../constants/statusCodes');
const { calculateSha256, timingSafeEqual } = require('../utils/crypto');
const logger = require('../config/logger');

class DocumentService {
  async listDocuments({ caseId, documentType, status, page = 1, limit = 20 }) {
    const query = {};
    if (caseId) query.caseId = caseId;
    if (documentType) query.documentType = documentType;
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const [documents, total] = await Promise.all([
      Document.find(query)
        .populate('uploadedBy', 'name email badgeNumber role')
        .populate('caseId', 'caseNumber title status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Document.countDocuments(query),
    ]);

    return {
      documents,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getDocumentById(documentId) {
    const doc = await Document.findById(documentId)
      .populate('uploadedBy', 'name email badgeNumber role')
      .populate('verifiedBy', 'name email badgeNumber role')
      .populate('caseId', 'caseNumber title status')
      .lean();

    if (!doc) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Document not found in vault', ERROR_CODES.DOCUMENT_NOT_FOUND);
    }
    return doc;
  }

  /**
   * Verify document SHA-256 hash against target buffer / downloaded content
   */
  async verifyIntegrity(documentId, targetBuffer) {
    const doc = await this.getDocumentById(documentId);
    const computedHash = calculateSha256(targetBuffer);
    const isValid = timingSafeEqual(doc.sha256Hash, computedHash);

    if (!isValid) {
      logger.error(`DOCUMENT TAMPER ALERT: Hash mismatch for doc ${documentId}`, {
        documentId,
        expectedHash: doc.sha256Hash,
        computedHash,
      });
    }

    return {
      documentId,
      expectedHash: doc.sha256Hash,
      computedHash,
      isValid,
      verifiedAt: new Date().toISOString(),
    };
  }
}

module.exports = new DocumentService();
