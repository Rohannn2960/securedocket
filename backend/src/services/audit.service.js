const mongoose = require('mongoose');
const { AsyncLocalStorage } = require('async_hooks');
const { AuditLog } = require('../models');
const { calculateAuditHash, GENESIS_HASH } = require('../utils/crypto');
const logger = require('../config/logger');

// AsyncLocalStorage storage for request-scoped audit context
const auditContextStorage = new AsyncLocalStorage();

/**
 * Safely extracts the server-derived client IP from an Express request.
 * Disregards client-supplied bodies or query parameters.
 * Uses Express's trust proxy configuration for req.ip,
 * falling back to direct connection socket remoteAddress.
 * Normalizes IPv4-mapped IPv6 (::ffff:) addresses.
 */
function extractClientIp(req) {
  if (!req) return null;
  let rawIp = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
  if (!rawIp || typeof rawIp !== 'string') return null;

  rawIp = rawIp.trim();

  // Normalize IPv4-mapped IPv6 (e.g. ::ffff:192.168.1.1) to clean IPv4 (192.168.1.1)
  if (rawIp.startsWith('::ffff:')) {
    rawIp = rawIp.substring(7);
  }

  return rawIp || null;
}

/**
 * Express middleware that scopes the active HTTP request into AsyncLocalStorage,
 * enabling downstream controllers and services to record server-derived IP addresses automatically.
 */
function auditContextMiddleware(req, res, next) {
  auditContextStorage.run(req, next);
}

/**
 * Record a Cryptographic Hash-Chained Audit Log Entry
 * Server-side IP address tracking is enforced and sealed in currentHash.
 */
async function recordAuditEntry({
  userId,
  action,
  documentId = null,
  caseId = null,
  details = {},
  ipAddress = null,
  userAgent = null,
  req = null,
}) {
  try {
    // 1. Resolve Server-Side Client IP & User Agent
    // Priority:
    // a. Explicit req passed in options (if provided)
    // b. Active async request context from auditContextStorage
    // c. Explicitly supplied ipAddress ONLY if no HTTP request context exists (e.g. test environments)
    const activeReq = (req && (req.ip !== undefined || req.socket !== undefined))
      ? req
      : auditContextStorage.getStore();

    let resolvedIp = null;
    let resolvedUserAgent = null;

    if (activeReq) {
      // NEVER allow body or query parameters to override the server-side detected IP
      resolvedIp = extractClientIp(activeReq);
      resolvedUserAgent = activeReq.headers?.['user-agent'] || null;
    } else if (ipAddress && ipAddress !== 'unknown') {
      resolvedIp = String(ipAddress).trim();
      if (resolvedIp.startsWith('::ffff:')) {
        resolvedIp = resolvedIp.substring(7);
      }
      resolvedUserAgent = userAgent || null;
    }

    let auditRecord;
    let retries = 0;

    while (retries < 5) {
      try {
        const lastEntry = await AuditLog.findOne({}, {}, { sort: { timestamp: -1, _id: -1 } }).lean();
        const previousHash = lastEntry ? lastEntry.currentHash : GENESIS_HASH;
        const timestamp = new Date();

        // Canonical payload participating in cryptographic currentHash
        // ipAddress is strictly included so modifying the stored IP causes chain verification to fail
        const normalizedDetails = (details && typeof details === 'object') ? details : {};
        const payload = {
          userId: userId ? userId.toString() : null,
          action,
          documentId: documentId ? documentId.toString() : null,
          caseId: caseId ? caseId.toString() : null,
          details: normalizedDetails,
          ipAddress: resolvedIp,
          timestamp: timestamp.toISOString(),
        };
        const currentHash = calculateAuditHash(previousHash, payload);

        const created = await AuditLog.create({
          userId,
          action,
          documentId,
          caseId,
          timestamp,
          previousHash,
          currentHash,
          details: normalizedDetails,
          ipAddress: resolvedIp,
          userAgent: resolvedUserAgent,
          isChainValid: true,
        });

        auditRecord = created;
        return auditRecord;
      } catch (error) {
        if (error && error.code === 11000) {
          retries += 1;
          continue;
        }
        throw error;
      }
    }

    throw new Error('Concurrent audit write retry limit exceeded');
  } catch (error) {
    logger.error('Failed to record cryptographic audit entry', { error, action, userId });
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
    return { valid: true, checkedEntries: 0, firstBrokenEntry: null };
  }

  let previousHash = GENESIS_HASH;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    // Check if recorded previousHash matches expected previous block hash
    if (record.previousHash !== previousHash) {
      logger.error(`Audit chain broken at index ${i}: previousHash mismatch`, { recordId: record._id });
      return {
        valid: false,
        checkedEntries: records.length,
        firstBrokenEntry: record._id,
        brokenIndex: i,
        reason: 'PREVIOUS_HASH_MISMATCH',
      };
    }

    // Recompute payload hash including ipAddress
    const payload = {
      userId: record.userId ? record.userId.toString() : null,
      action: record.action,
      documentId: record.documentId ? record.documentId.toString() : null,
      caseId: record.caseId ? record.caseId.toString() : null,
      details: (record.details && typeof record.details === 'object') ? record.details : {},
      ipAddress: record.ipAddress || null,
      timestamp: new Date(record.timestamp).toISOString(),
    };

    const recomputedHash = calculateAuditHash(previousHash, payload);
    if (recomputedHash !== record.currentHash) {
      logger.error(`Audit payload tampering detected at index ${i}`, { recordId: record._id });
      return {
        valid: false,
        checkedEntries: records.length,
        firstBrokenEntry: record._id,
        brokenIndex: i,
        reason: 'PAYLOAD_HASH_TAMPERED',
      };
    }

    previousHash = record.currentHash;
  }

  return {
    valid: true,
    checkedEntries: records.length,
    latestHash: previousHash,
  };
}

module.exports = {
  recordAuditEntry,
  verifyAuditChainIntegrity,
  auditContextMiddleware,
  extractClientIp,
};
