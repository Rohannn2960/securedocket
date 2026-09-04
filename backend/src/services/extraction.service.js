const { Document, User, DOCUMENT_STATUS } = require('../models');
const aiOcrService = require('./aiOcr.service');
const s3Service = require('./s3.service');
const { recordAuditEntry } = require('./audit.service');
const { AUDIT_ACTIONS } = require('../constants/actions');
const { ROLES } = require('../constants/roles');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants/statusCodes');
const config = require('../config/env');
const logger = require('../config/logger');
const vectorService = require('./vector.service');
const { encryptAES256GCM } = require('../utils/crypto');

const SENSITIVE_FIELDS = new Set([
  'complainant',
  'complainant_name',
  'accused',
  'accused_name',
  'witness',
  'witness_name',
  'address',
  'phone',
  'identification_number',
  'sections_laws',
  'person_name'
]);

/**
 * Helper to encrypt a field object's values if it is sensitive
 */
function encryptFieldValues(fieldObj) {
  if (!SENSITIVE_FIELDS.has(fieldObj.field)) {
    return fieldObj;
  }

  const encryptIfString = (val) => {
    if (typeof val === 'string' && val.trim().length > 0) {
      return encryptAES256GCM(val, config.masterEncryptionKey);
    }
    return val;
  };

  fieldObj.aiValue = encryptIfString(fieldObj.aiValue);
  fieldObj.humanValue = encryptIfString(fieldObj.humanValue);
  fieldObj.value = encryptIfString(fieldObj.value);
  fieldObj.isEncrypted = true;

  return fieldObj;
}

class ExtractionService {
  /**
   * Run OCR, Document Classification, and Field Extraction on a Vault Document
   */
  async extractAndProcessDocument(documentId, requestTrace) {
    const pipelineStartedAt = Date.now();
    const step = requestTrace?.step || ((label, meta={}) => {
      const elapsedMs = Date.now() - pipelineStartedAt;
      console.log(`[OCR TRACE] ${label} elapsedMs=${elapsedMs} meta=${JSON.stringify({ ...meta, elapsedMs })}`);
    });

    const doc = await Document.findById(documentId).populate('caseId uploadedBy');
    if (!doc) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Document not found for OCR processing', ERROR_CODES.DOCUMENT_NOT_FOUND);
    }

    logger.info(`[Extraction Pipeline] Commencing AI OCR & extraction for doc ${doc._id} (${doc.fileName})`);
    const baseTime = requestTrace?.startedAt || pipelineStartedAt;
    const geminiStartElapsed = Date.now() - baseTime;
    console.log(
      `[TIMING] 5. Gemini OCR START | elapsedMs=${geminiStartElapsed} | mimeType=${doc.mimeType} | fileSizeBytes=${doc.fileSize} | geminiModel=${config.gemini.modelName}`
    );
    step('Gemini OCR request START', {
      mimeType: doc.mimeType,
      fileSizeBytes: doc.fileSize,
      modelName: config.gemini.modelName,
      documentTypeHint: doc.documentType,
    });

    // 1. Get file buffer from S3 or local vault
    let fileBuffer = await s3Service.getObjectBuffer(doc.s3Key);
    if (!fileBuffer || fileBuffer.length === 0) {
      fileBuffer = await s3Service.generateFallbackBuffer(doc);
    }

    // 2. Execute AI OCR Intelligence Pipeline
    let ocrResult;
    try {
      ocrResult = await aiOcrService.processDocument({
        fileBuffer,
        mimeType: doc.mimeType,
        fileName: doc.fileName,
        documentTypeHint: doc.documentType,
      });
      const geminiEndElapsed = Date.now() - baseTime;
      const isGeminiSuccess = ocrResult?.ocrMetadata?.engine === 'gemini-vision';
      console.log(
        `[TIMING] 6. Gemini OCR END | elapsedMs=${geminiEndElapsed} | geminiModel=${config.gemini.modelName} | geminiSuccess=${isGeminiSuccess} | ocrTextLength=${ocrResult?.rawText?.length || 0} | engine=${ocrResult?.ocrMetadata?.engine}`
      );
      step('Gemini OCR request END', {
        mimeType: doc.mimeType,
        fileSizeBytes: doc.fileSize,
        modelName: config.gemini.modelName,
        geminiSuccess: isGeminiSuccess,
        rawTextLength: ocrResult?.rawText?.length || 0,
        finalClassification: ocrResult?.classification?.predictedType,
      });
    } catch (err) {
      const geminiFailElapsed = Date.now() - baseTime;
      console.log(
        `[TIMING] 6. Gemini OCR END | elapsedMs=${geminiFailElapsed} | geminiModel=${config.gemini.modelName} | geminiSuccess=false | error=${err.message}`
      );
      logger.error(`[Extraction Pipeline] OCR processing failure for doc ${doc._id}`, { error: err.message });
      await recordAuditEntry({
        userId: doc.uploadedBy?._id || doc.uploadedBy,
        documentId: doc._id,
        caseId: doc.caseId?._id || doc.caseId,
        action: AUDIT_ACTIONS.OCR_EXTRACTION_FAILURE,
        details: { fileName: doc.fileName, error: err.message },
      });
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, `AI OCR extraction failed: ${err.message}`);
    }

    // 3. Transform extracted fields into non-destructive audit dictionary
    const structuredFields = {};
    const threshold = config.gemini.confidenceThreshold || 0.80;
    let hasLowConfidenceField = false;

    const classStartElapsed = Date.now() - baseTime;
    console.log(`[TIMING] 7. classification START | elapsedMs=${classStartElapsed}`);
    step('classification START', {
      mimeType: doc.mimeType,
      fileSizeBytes: doc.fileSize,
      rawTextLength: ocrResult?.rawText?.length || 0,
      documentTypeHint: doc.documentType,
    });

    logger.info(`[Extraction Pipeline] OCR result summary`, {
      documentId: doc._id,
      provider: ocrResult?.ocrMetadata?.engine || 'unknown',
      textLength: ocrResult?.rawText?.length || 0,
      classification: ocrResult?.classification?.predictedType || 'unknown',
      classificationConfidence: ocrResult?.classification?.confidence || 0,
      fieldCount: Array.isArray(ocrResult?.fields) ? ocrResult.fields.length : 0,
      averageConfidence: ocrResult?.ocrMetadata?.averageConfidence || 0,
      needsHumanReview: ocrResult?.ocrMetadata?.needsHumanReview || false,
    });

    const isLegitimateContent = ocrResult.classification?.predictedType !== 'unknown' && ocrResult.rawText && ocrResult.rawText.trim().length > 0;
    const classEndElapsed = Date.now() - baseTime;
    console.log(
      `[TIMING] 7. classification END | elapsedMs=${classEndElapsed} | classification=${ocrResult?.classification?.predictedType} | confidence=${ocrResult?.classification?.confidence}`
    );
    step('classification END', {
      finalClassification: ocrResult?.classification?.predictedType,
      classificationConfidence: ocrResult?.classification?.confidence,
      rawTextLength: ocrResult?.rawText?.length || 0,
      fieldCount: Array.isArray(ocrResult?.fields) ? ocrResult.fields.length : 0,
    });

    const fieldStartElapsed = Date.now() - baseTime;
    console.log(
      `[TIMING] 8. field extraction START | elapsedMs=${fieldStartElapsed} | fieldCount=${Array.isArray(ocrResult.fields) ? ocrResult.fields.length : 0}`
    );
    if (Array.isArray(ocrResult.fields)) {
      step('field extraction START', {
        fieldCount: ocrResult.fields.length,
        classification: ocrResult.classification?.predictedType,
      });
      for (const f of ocrResult.fields) {
        const conf = typeof f.confidence === 'number' ? f.confidence : 0.85;
        if (conf < threshold) {
          hasLowConfidenceField = true;
        }

        // Preserve previous human corrections if re-running extraction
        const existingField = doc.extractedFields && doc.extractedFields[f.field];
        const shouldAutoApprove = isLegitimateContent && conf >= 0.90 && (ocrResult.classification?.predictedType || doc.documentType) !== 'unknown';

        if (existingField && existingField.isCorrected) {
          structuredFields[f.field] = encryptFieldValues({
            field: f.field,
            aiValue: f.value,
            humanValue: existingField.humanValue,
            value: existingField.humanValue,
            confidence: conf,
            sourceReference: f.sourceReference || 'Document Body',
            status: existingField.status || 'corrected',
            isCorrected: true,
            correctedBy: existingField.correctedBy,
            correctedAt: existingField.correctedAt,
          });
        } else {
          structuredFields[f.field] = encryptFieldValues({
            field: f.field,
            aiValue: f.value,
            humanValue: null,
            value: f.value,
            confidence: conf,
            sourceReference: f.sourceReference || 'Document Body',
            status: shouldAutoApprove ? 'approved' : 'pending',
            isCorrected: false,
            correctedBy: null,
            correctedAt: null,
          });
        }
      }
      step('field extraction END', {
        extractedFieldCount: Object.keys(structuredFields).length,
      });
    }
    const fieldEndElapsed = Date.now() - baseTime;
    console.log(
      `[TIMING] 8. field extraction END | elapsedMs=${fieldEndElapsed} | fieldCount=${Object.keys(structuredFields).length}`
    );

    // 4. Evaluate Review Threshold & Priority
    const avgConfidence = ocrResult.ocrMetadata?.averageConfidence || 0.85;
    const isBelowThreshold = avgConfidence < threshold || hasLowConfidenceField || ocrResult.classification?.predictedType === 'unknown';

    let reviewPriority = 'low';
    if (avgConfidence < 0.65) reviewPriority = 'critical';
    else if (avgConfidence < 0.80 || hasLowConfidenceField) reviewPriority = 'high';
    else if (avgConfidence < 0.90) reviewPriority = 'medium';

    // 5. Update MongoDB Record
    doc.extractedFields = structuredFields;
    doc.classification = {
      predictedType: ocrResult.classification?.predictedType || doc.documentType,
      confidence: ocrResult.classification?.confidence || avgConfidence,
      reasoning: ocrResult.classification?.reasoning || 'Extracted via Document Intelligence Engine',
      classifiedAt: new Date(),
    };
    doc.ocrConfidence = Math.round(avgConfidence * 100);
    doc.ocrMetadata = {
      engine: ocrResult.ocrMetadata?.engine || 'local-legal-ocr-engine',
      processedAt: new Date(),
      averageConfidence: avgConfidence,
      needsHumanReview: isBelowThreshold || doc.status === DOCUMENT_STATUS.PENDING_REVIEW,
      reviewPriority,
      rawTextLength: ocrResult.ocrMetadata?.rawTextLength || (ocrResult.rawText ? ocrResult.rawText.length : 0),
    };
    doc.extractedText = ocrResult.rawText || '';

    const mongoSaveStartElapsed = Date.now() - baseTime;
    console.log(`[TIMING] 9. MongoDB save START | elapsedMs=${mongoSaveStartElapsed}`);
    step('MongoDB document save START', {
      documentId: doc._id,
      finalClassification: doc.classification.predictedType,
      fieldCount: Object.keys(structuredFields).length,
      averageConfidence: avgConfidence,
    });

    logger.info(`[Extraction Pipeline] Persisting OCR result to MongoDB`, {
      documentId: doc._id,
      finalClassification: doc.classification.predictedType,
      classificationConfidence: doc.classification.confidence,
      averageConfidence: avgConfidence,
      fieldCount: Object.keys(structuredFields).length,
      finalStatus: doc.status,
      finalConfidenceSaved: doc.ocrConfidence,
      needsHumanReview: doc.ocrMetadata.needsHumanReview,
    });

    // Generate semantic embedding
    if (doc.extractedText) {
      const vecStart = Date.now();
      const embedding = await vectorService.generateEmbedding(doc.extractedText);
      const vecElapsed = Date.now() - vecStart;
      console.log(`[TIMING] (embedding) vector embedding duration: ${vecElapsed}ms`);
      if (embedding) {
        doc.embeddingVector = embedding;
        doc.markModified('embeddingVector');
      }
    }

    // Mark modified for mixed schema
    doc.markModified('extractedFields');
    doc.markModified('classification');
    doc.markModified('ocrMetadata');

    await doc.save();

    const mongoSaveEndElapsed = Date.now() - baseTime;
    console.log(
      `[TIMING] 9. MongoDB save END | elapsedMs=${mongoSaveEndElapsed} | classification=${doc.classification.predictedType} | fieldCount=${Object.keys(structuredFields).length}`
    );
    step('MongoDB document save END', {
      documentId: doc._id,
      finalClassification: doc.classification.predictedType,
      fieldCount: Object.keys(structuredFields).length,
      averageConfidence: avgConfidence,
    });

    await recordAuditEntry({
      userId: doc.uploadedBy?._id || doc.uploadedBy,
      documentId: doc._id,
      caseId: doc.caseId?._id || doc.caseId,
      action: AUDIT_ACTIONS.OCR_EXTRACTION_SUCCESS,
      details: {
        engine: doc.ocrMetadata.engine,
        averageConfidence: avgConfidence,
        classifiedAs: doc.classification.predictedType,
        needsHumanReview: doc.ocrMetadata.needsHumanReview,
        fieldCount: Object.keys(structuredFields).length,
      },
    });

    logger.info(`[Extraction Pipeline] Successfully processed doc ${doc._id}. Avg Conf: ${(avgConfidence * 100).toFixed(1)}%. Review Needed: ${doc.ocrMetadata.needsHumanReview}`);

    return doc;
  }

  /**
   * Correct a single extracted field (Preserves original AI value)
   * Only Forensic Verifier or Administrator can perform corrections
   */
  async correctField({ documentId, fieldName, correctedValue, user }) {
    if (![ROLES.VERIFIER, ROLES.ADMIN].includes(user.role)) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        `Access forbidden: Role '${user.role}' is not authorized to modify forensic extraction values. Only Verifiers and Admins may correct fields.`,
        ERROR_CODES.INSUFFICIENT_PERMISSIONS
      );
    }

    const doc = await Document.findById(documentId).populate('caseId');
    if (!doc) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Document not found', ERROR_CODES.DOCUMENT_NOT_FOUND);
    }

    if (!doc.extractedFields) {
      doc.extractedFields = {};
    }

    const existing = doc.extractedFields[fieldName] || {
      field: fieldName,
      aiValue: null,
      confidence: 1.0,
      sourceReference: 'Manual Entry',
    };

    const previousValue = existing.value;
    const aiOriginalValue = existing.aiValue !== undefined ? existing.aiValue : previousValue;
    const sourceReference = existing.sourceReference || 'Manual correction';
    const ledgerConfidence = typeof existing.confidence === 'number' ? existing.confidence : 0.85;

    doc.extractedFields[fieldName] = encryptFieldValues({
      ...existing,
      field: fieldName,
      aiValue: aiOriginalValue,
      humanValue: correctedValue,
      value: correctedValue,
      confidence: ledgerConfidence,
      sourceReference,
      isCorrected: true,
      status: 'corrected',
      correctedBy: user.id,
      correctedAt: new Date(),
    });

    doc.markModified('extractedFields');
    await doc.save();

    await recordAuditEntry({
      userId: user.id,
      documentId: doc._id,
      caseId: doc.caseId?._id || doc.caseId,
      action: AUDIT_ACTIONS.DOCUMENT_FIELD_CORRECT,
      details: {
        fieldName,
        originalAiValue: aiOriginalValue,
        previousValue,
        correctedValue,
        correctedByRole: user.role,
        sourceReference: existing.sourceReference || 'Manual correction',
        confidence: existing.confidence,
      },
    });

    logger.info(`[Verifier Action] Field '${fieldName}' corrected for doc ${doc._id} by ${user.role} ${user.id}`);

    return doc;
  }

  /**
   * Approve a field extraction without modification
   */
  async approveField({ documentId, fieldName, user }) {
    if (![ROLES.VERIFIER, ROLES.ADMIN].includes(user.role)) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        `Access forbidden: Role '${user.role}' is not authorized to approve forensic fields.`,
        ERROR_CODES.INSUFFICIENT_PERMISSIONS
      );
    }

    const doc = await Document.findById(documentId);
    if (!doc || !doc.extractedFields || !doc.extractedFields[fieldName]) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, `Field '${fieldName}' not found in document extraction`);
    }

    doc.extractedFields[fieldName].status = 'approved';
    doc.extractedFields[fieldName].approvedBy = user.id;
    doc.extractedFields[fieldName].approvedAt = new Date();

    doc.markModified('extractedFields');
    await doc.save();

    return doc;
  }

  /**
   * Finalize verification and certify document dossier
   */
  async verifyDocument({ documentId, user, notes = '' }) {
    if (![ROLES.VERIFIER, ROLES.ADMIN].includes(user.role)) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        `Access forbidden: Role '${user.role}' cannot certify or verify legal evidence documents.`,
        ERROR_CODES.INSUFFICIENT_PERMISSIONS
      );
    }

    const doc = await Document.findById(documentId).populate('caseId uploadedBy');
    if (!doc) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Document not found', ERROR_CODES.DOCUMENT_NOT_FOUND);
    }

    doc.status = DOCUMENT_STATUS.VERIFIED;
    doc.verifiedBy = user.id;
    doc.verifiedAt = new Date();
    doc.verificationNotes = notes.trim();
    if (doc.ocrMetadata) {
      doc.ocrMetadata.needsHumanReview = false;
    }

    doc.markModified('ocrMetadata');
    await doc.save();

    await recordAuditEntry({
      userId: user.id,
      documentId: doc._id,
      caseId: doc.caseId?._id || doc.caseId,
      action: AUDIT_ACTIONS.DOCUMENT_VERIFY,
      details: {
        verifiedByBadge: user.badgeNumber,
        verifiedByRole: user.role,
        notes: doc.verificationNotes,
        sha256Hash: doc.sha256Hash,
      },
    });

    logger.info(`[Forensic Verification] Document ${doc._id} certified and verified by ${user.name}`);

    return doc;
  }

  /**
   * Flag document for discrepancy, tampering, or illegibility
   */
  async flagDocument({ documentId, user, reason }) {
    if (![ROLES.VERIFIER, ROLES.ADMIN].includes(user.role)) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        `Access forbidden: Role '${user.role}' cannot flag legal documents.`,
        ERROR_CODES.INSUFFICIENT_PERMISSIONS
      );
    }

    if (!reason || reason.trim().length < 5) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'A detailed reason (min 5 characters) is required when flagging a document.');
    }

    const doc = await Document.findById(documentId).populate('caseId');
    if (!doc) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Document not found', ERROR_CODES.DOCUMENT_NOT_FOUND);
    }

    doc.status = DOCUMENT_STATUS.FLAGGED_TAMPERED;
    doc.isTampered = true;
    doc.tamperFlags.push({
      flaggedAt: new Date(),
      flaggedBy: user.id,
      reason: reason.trim(),
      expectedHash: doc.sha256Hash,
      computedHash: doc.sha256Hash,
    });

    if (doc.ocrMetadata) {
      doc.ocrMetadata.needsHumanReview = true;
      doc.ocrMetadata.reviewPriority = 'critical';
    }

    doc.markModified('ocrMetadata');
    await doc.save();

    await recordAuditEntry({
      userId: user.id,
      documentId: doc._id,
      caseId: doc.caseId?._id || doc.caseId,
      action: AUDIT_ACTIONS.DOCUMENT_TAMPER_FLAG,
      details: {
        reason: reason.trim(),
        flaggedByRole: user.role,
        flaggedByBadge: user.badgeNumber,
      },
    });

    logger.warn(`[Tamper Flag] Document ${doc._id} flagged by verifier ${user.id}: ${reason}`);

    return doc;
  }

  /**
   * Retrieve documents in the Verifier Review Queue
   */
  async getVerificationQueue({ status, priority, documentType, page = 1, limit = 20, search }) {
    const query = {};

    if (status) {
      query.status = status;
    } else {
      // Default: documents pending review or flagged
      query.status = { $in: [DOCUMENT_STATUS.PENDING_REVIEW, DOCUMENT_STATUS.FLAGGED_TAMPERED] };
    }

    if (priority) {
      query['ocrMetadata.reviewPriority'] = priority;
    }

    if (documentType) {
      query.documentType = documentType;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { fileName: { $regex: search, $options: 'i' } },
        { sha256Hash: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [documents, total] = await Promise.all([
      Document.find(query)
        .populate('uploadedBy', 'name email badgeNumber role')
        .populate('caseId', 'caseNumber title status leadOfficer')
        .populate('verifiedBy', 'name email badgeNumber role')
        .sort({ 'ocrMetadata.needsHumanReview': -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Document.countDocuments(query),
    ]);

    const { decryptDocumentFields } = require('../utils/crypto');
    const decryptedDocs = documents.map(doc => decryptDocumentFields(doc, config.masterEncryptionKey));

    return {
      documents: decryptedDocs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    };
  }
}

module.exports = new ExtractionService();
