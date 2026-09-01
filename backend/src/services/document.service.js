const crypto = require('crypto');
const { Document, Case, User, DOCUMENT_STATUS, ALL_DOCUMENT_TYPES } = require('../models');
const ApiError = require('../utils/apiError');
const { ERROR_CODES, HTTP_STATUS } = require('../constants/statusCodes');
const { ROLES } = require('../constants/roles');
const { validateUploadedFile, generateServerS3Key } = require('../utils/fileValidator');
const s3Service = require('./s3.service');
const { calculateSha256, timingSafeEqual } = require('../utils/crypto');
const logger = require('../config/logger');

class DocumentService {
  /**
   * Securely ingest and cryptographically hash an evidence document
   */
  async ingestDocument({ caseId, title, documentType, file, description, tags = [], user }) {
    // 1. Verify Case Existence and Clearance
    const caseItem = await Case.findById(caseId);
    if (!caseItem) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Target case file not found in registry', ERROR_CODES.CASE_NOT_FOUND);
    }

    // Role-based boundary: Officer must be assigned to this specific case
    if (user.role === ROLES.OFFICER) {
      const isLead = caseItem.leadOfficer?.toString() === user.id.toString();
      const isAssigned = Array.isArray(caseItem.assignedOfficers) && caseItem.assignedOfficers.some(
        (id) => (id._id ? id._id.toString() : id.toString()) === user.id.toString()
      );

      if (!isLead && !isAssigned) {
        logger.warn(`Unauthorized upload attempt: Officer ${user.id} attempted to upload to unassigned case ${caseId}`);
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Access forbidden: You cannot upload evidence to an unassigned case dossier.',
          ERROR_CODES.INSUFFICIENT_PERMISSIONS
        );
      }
    }

    // 2. Validate Document Category
    if (!documentType || !ALL_DOCUMENT_TYPES.includes(documentType)) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `Invalid document category. Allowed categories: ${ALL_DOCUMENT_TYPES.join(', ')}`,
        ERROR_CODES.INVALID_INPUT
      );
    }

    // 3. Security Validation & Binary Magic-Number Verification
    const fileValidation = validateUploadedFile(file);

    // 4. Calculate Exact SHA-256 Hash of Accepted Bytes
    const sha256Hash = calculateSha256(file.buffer);

    // 5. Generate Server-Controlled S3 Key
    const s3Key = generateServerS3Key(caseItem.caseNumber, fileValidation.sanitizedName);

    // 6. Store File Bytes in AWS S3 Vault with SSE-S3 Encryption
    const s3UploadResult = await s3Service.uploadDocument({
      key: s3Key,
      fileBuffer: file.buffer,
      mimeType: fileValidation.mimeType,
      metadata: {
        caseNumber: caseItem.caseNumber,
        sha256Hash,
        uploadedBy: user.id,
      },
    });

    // 7. Store Metadata only in MongoDB
    const newDoc = await Document.create({
      caseId: caseItem._id,
      title: title ? title.trim() : fileValidation.sanitizedName,
      documentType,
      s3Key,
      s3Bucket: s3UploadResult.bucket,
      fileName: fileValidation.sanitizedName,
      originalName: fileValidation.originalName,
      fileSize: fileValidation.fileSize,
      mimeType: fileValidation.mimeType,
      uploadedBy: user.id,
      sha256Hash,
      status: DOCUMENT_STATUS.PENDING_REVIEW,
      version: 1,
      versions: [
        {
          version: 1,
          s3Key,
          sha256Hash,
          fileSize: fileValidation.fileSize,
          mimeType: fileValidation.mimeType,
          uploadedBy: user.id,
          uploadedAt: new Date(),
          changeNotes: 'Initial secure ingestion',
        },
      ],
      metadata: {
        description: description ? description.trim() : '',
        tags: Array.isArray(tags) ? tags : [],
      },
    });

    // 8. Trigger AI OCR, Classification & Structured Extraction Pipeline
    try {
      const extractionService = require('./extraction.service');
      await extractionService.extractAndProcessDocument(newDoc._id);
    } catch (err) {
      logger.warn(`[Document Ingestion] Automated extraction encountered non-blocking issue: ${err.message}`);
    }

    const populated = await Document.findById(newDoc._id)
      .populate('uploadedBy', 'name email badgeNumber role')
      .populate('caseId', 'caseNumber title status')
      .lean();

    logger.info(`[Document Ingestion] Successfully vaulted document ${newDoc.fileName}`, {
      documentId: newDoc._id,
      caseNumber: caseItem.caseNumber,
      sha256Hash,
      sizeBytes: fileValidation.fileSize,
    });

    return populated;
  }

  /**
   * List vaulted documents with role-based scoping
   */
  async listDocuments({ caseId, documentType, status, page = 1, limit = 20, search }, user) {
    const queryConditions = [];

    // Role-based data scoping for Officers
    if (user.role === ROLES.OFFICER) {
      // Find cases assigned to this officer
      const assignedCases = await Case.find({
        $or: [{ leadOfficer: user.id }, { assignedOfficers: user.id }],
      }).select('_id');
      const assignedCaseIds = assignedCases.map((c) => c._id);
      queryConditions.push({ caseId: { $in: assignedCaseIds } });
    }

    if (caseId) {
      queryConditions.push({ caseId });
    }

    if (documentType) {
      queryConditions.push({ documentType });
    }

    if (status) {
      queryConditions.push({ status });
    }

    if (search) {
      queryConditions.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { fileName: { $regex: search, $options: 'i' } },
          { sha256Hash: { $regex: search, $options: 'i' } },
        ],
      });
    }

    const query = queryConditions.length > 0 ? { $and: queryConditions } : {};

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [documents, total] = await Promise.all([
      Document.find(query)
        .populate('uploadedBy', 'name email badgeNumber role')
        .populate('verifiedBy', 'name email badgeNumber role')
        .populate('caseId', 'caseNumber title status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Document.countDocuments(query),
    ]);

    return {
      documents,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Get single document metadata with clearance check
   */
  async getDocumentById(documentId, user) {
    const doc = await Document.findById(documentId)
      .populate('uploadedBy', 'name email badgeNumber role')
      .populate('verifiedBy', 'name email badgeNumber role')
      .populate('caseId', 'caseNumber title status leadOfficer assignedOfficers')
      .lean();

    if (!doc) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Document not found in vault', ERROR_CODES.DOCUMENT_NOT_FOUND);
    }

    // Role-based boundary enforcement for Officer
    if (user && user.role === ROLES.OFFICER && doc.caseId) {
      const caseItem = doc.caseId;
      const isLead = (caseItem.leadOfficer?._id || caseItem.leadOfficer)?.toString() === user.id.toString();
      const isAssigned = Array.isArray(caseItem.assignedOfficers) && caseItem.assignedOfficers.some(
        (o) => (o._id ? o._id.toString() : o.toString()) === user.id.toString()
      );

      if (!isLead && !isAssigned) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Access forbidden: You do not have clearance for this case file.',
          ERROR_CODES.INSUFFICIENT_PERMISSIONS
        );
      }
    }

    return doc;
  }

  /**
   * Generate 5-Minute Presigned S3 Access URL
   * Enforces clearance check & returns temporary access token
   */
  async generatePresignedViewUrl(documentId, user, expiresInSeconds = 300, disposition = 'inline') {
    const doc = await this.getDocumentById(documentId, user);

    const presignedData = await s3Service.getPresignedDownloadUrl(
      doc.s3Key,
      expiresInSeconds,
      doc._id.toString(),
      disposition
    );

    logger.info(`[Secure Access] Generated presigned view URL for document ${doc._id}`, {
      userId: user.id,
      documentId: doc._id,
      expiresInSeconds,
      disposition,
    });

    return {
      url: presignedData.url,
      expiresInSeconds,
      expiresAt: presignedData.expiresAt,
      sha256Hash: doc.sha256Hash,
      mimeType: doc.mimeType,
      fileName: doc.fileName,
      document: doc,
    };
  }

  /**
   * Validate presigned HMAC token and stream document from vault
   */
  async getVaultStreamFile({ documentIdOrKey, expires, signature }) {
    if (!expires || isNaN(expires)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Presigned URL parameter "expires" is missing or invalid', ERROR_CODES.INVALID_INPUT);
    }

    const expiresNum = parseInt(expires, 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec > expiresNum) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Presigned access URL has expired (5-minute TTL exceeded). Please generate a new access token in the DMS.',
        ERROR_CODES.INSUFFICIENT_PERMISSIONS
      );
    }

    if (!signature) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Missing cryptographic HMAC presigned signature', ERROR_CODES.INVALID_CREDENTIALS);
    }

    const decodedTarget = decodeURIComponent(documentIdOrKey);
    let doc = null;

    const mongoose = require('mongoose');
    if (mongoose.Types.ObjectId.isValid(decodedTarget)) {
      doc = await Document.findById(decodedTarget).populate('caseId uploadedBy').lean();
    }
    if (!doc) {
      doc = await Document.findOne({ s3Key: decodedTarget }).populate('caseId uploadedBy').lean();
    }
    if (!doc) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Evidentiary document not found in vault registry', ERROR_CODES.DOCUMENT_NOT_FOUND);
    }

    // Validate HMAC Signature (check against document ID and s3Key)
    const config = require('../config/env');
    const expectedSigId = crypto
      .createHmac('sha256', config.jwt.accessSecret || 's3_secure_signing_secret')
      .update(`${doc._id.toString()}:${expires}`)
      .digest('hex');

    const expectedSigKey = crypto
      .createHmac('sha256', config.jwt.accessSecret || 's3_secure_signing_secret')
      .update(`${doc.s3Key}:${expires}`)
      .digest('hex');

    const isValidSignature = timingSafeEqual(expectedSigId, signature) || timingSafeEqual(expectedSigKey, signature);

    if (!isValidSignature) {
      logger.warn(`[Vault Security] Invalid presigned signature attempt for document ${doc._id}`);
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Cryptographic signature mismatch: Access token is invalid or has been tampered with.',
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    // Retrieve file buffer from storage
    let buffer = await s3Service.getObjectBuffer(doc.s3Key);
    if (!buffer || buffer.length === 0) {
      logger.info(`[Vault Stream] Serving generated official evidentiary dossier plate for doc ${doc._id}`);
      buffer = await s3Service.generateFallbackBuffer(doc);
    }

    return {
      buffer,
      mimeType: doc.mimeType || 'application/pdf',
      fileName: doc.fileName || `${doc.title || 'document'}.pdf`,
      document: doc,
    };
  }

  /**
   * Verify document SHA-256 hash against target buffer / downloaded content
   */
  async verifyIntegrity(documentId, targetBuffer) {
    const doc = await Document.findById(documentId).lean();
    if (!doc) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Document not found');
    }

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
