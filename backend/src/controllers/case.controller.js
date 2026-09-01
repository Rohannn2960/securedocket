const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const caseService = require('../services/case.service');
const { recordAuditEntry } = require('../services/audit.service');
const { AUDIT_ACTIONS } = require('../constants/actions');

async function getCases(req, res) {
  const { page, limit, status, search } = req.query;
  const result = await caseService.listCases({ page, limit, status, search });

  return ApiResponse.success(res, {
    message: 'Cases retrieved successfully',
    data: result.cases,
    meta: result.pagination,
  });
}

async function getCase(req, res) {
  const { id } = req.params;
  const caseItem = await caseService.getCaseById(id);

  return ApiResponse.success(res, {
    data: caseItem,
  });
}

async function createCase(req, res) {
  const { caseNumber, title, description, jurisdiction, priority } = req.body;

  if (!caseNumber || !title) {
    throw ApiError.badRequest('Case number and title are required');
  }

  const newCase = await caseService.createCase(
    { caseNumber, title, description, jurisdiction, metadata: { priority } },
    req.user.id
  );

  await recordAuditEntry({
    userId: req.user.id,
    caseId: newCase._id,
    action: AUDIT_ACTIONS.CASE_CREATE,
    details: { caseNumber: newCase.caseNumber, title: newCase.title },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return ApiResponse.created(res, {
    message: 'Legal case registered successfully',
    data: newCase,
  });
}

module.exports = {
  getCases,
  getCase,
  createCase,
};
