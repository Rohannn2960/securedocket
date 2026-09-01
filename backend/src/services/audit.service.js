const { AuditLog } = require('../models');
const { calculateAuditHash, GENESIS_HASH } = require('../utils/crypto');
const logger = require('../config/logger');

/**
 * Record a Cryptographic Hash-Chained Audit Log Entry
 */
async function recordAuditEntry({
  userId,
  action,
  documentId = null,
  caseId = null,
  details = {},
  ipAddress = 'unknown',
  userAgent = 'unknown',
}) {
  try {
    // 1. Fetch latest audit block to obtain previousHash
    const lastEntry = await AuditLog.findOne().sort({ timestamp: -1, _id: -1 }).lean();
    const previousHash = lastEntry ? lastEntry.currentHash : GENESIS_HASH;

    // 2. Build payload object
    const timestamp = new Date();
    const payload = {
      userId: userId ? userId.toString() : null,
      action,
      documentId: documentId ? documentId.toString() : null,
      caseId: caseId ? caseId.toString() : null,
      details,
      timestamp: timestamp.toISOString(),
    };

    // 3. Compute chained currentHash
    const currentHash = calculateAuditHash(previousHash, payload);

    // 4. Persist to MongoDB
    const auditRecord = await AuditLog.create({
      userId,
      action,
      documentId,
      caseId,
      timestamp,
      previousHash,
      currentHash,
      details,
      ipAddress,
      userAgent,
      isChainValid: true,
    });

    logger.audit(action, `Audit record ${auditRecord._id} chained with hash ${currentHash.substring(0, 12)}...`, {
      userId,
      documentId,
      action,
    });

    return auditRecord;
  } catch (error) {
    logger.error('Failed to record cryptographic audit entry', { error, action, userId });
    // In strict compliance environments, we do not swallow audit failures silently
    throw error;
  }
}

/**
 * Verify Integrity of the Complete Audit Log Hash Chain
 * Traverses historical records in chronological order and checks cryptographic links
 */
async function verifyAuditChainIntegrity(limit = 1000) {
  const records = await AuditLog.find().sort({ timestamp: 1, _id: 1 }).limit(limit).lean();

  if (records.length === 0) {
    return { valid: true, totalRecords: 0, corruptedIndex: -1 };
  }

  let previousHash = GENESIS_HASH;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    // Check if recorded previousHash matches expected previous block hash
    if (record.previousHash !== previousHash) {
      logger.error(`Audit chain broken at index ${i}: previousHash mismatch`, { recordId: record._id });
      return {
        valid: false,
        totalRecords: records.length,
        corruptedRecordId: record._id,
        brokenIndex: i,
        reason: 'PREVIOUS_HASH_MISMATCH',
      };
    }

    // Recompute payload hash
    const payload = {
      userId: record.userId ? record.userId.toString() : null,
      action: record.action,
      documentId: record.documentId ? record.documentId.toString() : null,
      caseId: record.caseId ? record.caseId.toString() : null,
      details: record.details,
      timestamp: new Date(record.timestamp).toISOString(),
    };

    const recomputedHash = calculateAuditHash(previousHash, payload);
    if (recomputedHash !== record.currentHash) {
      logger.error(`Audit payload tampering detected at index ${i}`, { recordId: record._id });
      return {
        valid: false,
        totalRecords: records.length,
        corruptedRecordId: record._id,
        brokenIndex: i,
        reason: 'PAYLOAD_HASH_TAMPERED',
      };
    }

    previousHash = record.currentHash;
  }

  return {
    valid: true,
    totalRecords: records.length,
    latestHash: previousHash,
  };
}

module.exports = {
  recordAuditEntry,
  verifyAuditChainIntegrity,
};
