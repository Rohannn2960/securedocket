const ApiResponse = require('../utils/apiResponse');
const { AuditLog } = require('../models');
const { verifyAuditChainIntegrity } = require('../services/audit.service');

async function getAuditLogs(req, res) {
  const { documentId, caseId, userId, action, page = 1, limit = 50 } = req.query;

  const query = {};
  if (documentId) query.documentId = documentId;
  if (caseId) query.caseId = caseId;
  if (userId) query.userId = userId;
  if (action) query.action = action;

  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .populate('userId', 'name email badgeNumber role')
      .populate('documentId', 'title documentType sha256Hash')
      .populate('caseId', 'caseNumber title')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  return ApiResponse.success(res, {
    message: 'Audit logs retrieved',
    data: logs,
    meta: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      pages: Math.ceil(total / limit),
    },
  });
}

async function verifyAuditChain(req, res) {
  const verificationResult = await verifyAuditChainIntegrity();

  return ApiResponse.success(res, {
    message: verificationResult.valid
      ? 'Cryptographic audit chain verified: zero tampering detected'
      : 'AUDIT CHAIN INTEGRITY BREACH DETECTED',
    data: verificationResult,
  });
}

module.exports = {
  getAuditLogs,
  verifyAuditChain,
};
