const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const caseService = require('../services/case.service');
const { recordAuditEntry } = require('../services/audit.service');
const { AUDIT_ACTIONS } = require('../constants/actions');

async function getCases(req, res) {
  const { page, limit, status, priority, search, jurisdiction } = req.query;
  const result = await caseService.listCases(
    { page, limit, status, priority, search, jurisdiction },
    req.user
  );

  return ApiResponse.success(res, {
    message: 'Cases retrieved successfully',
    data: result.cases,
    meta: result.pagination,
  });
}

async function getCase(req, res) {
  const { id } = req.params;
  const caseItem = await caseService.getCaseById(id, req.user);

  return ApiResponse.success(res, {
    message: 'Case dossier retrieved successfully',
    data: caseItem,
  });
}

async function createCase(req, res) {
  const newCase = await caseService.createCase(req.body, req.user);

  await recordAuditEntry({
    userId: req.user.id,
    caseId: newCase._id,
    action: AUDIT_ACTIONS.CASE_CREATE,
    details: {
      caseNumber: newCase.caseNumber,
      title: newCase.title,
      status: newCase.status,
      assignedOfficersCount: newCase.assignedOfficers?.length || 1,
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return ApiResponse.created(res, {
    message: 'Legal case registered successfully in repository',
    data: newCase,
  });
}

async function updateCase(req, res) {
  const { id } = req.params;
  const updatedCase = await caseService.updateCase(id, req.body, req.user);

  await recordAuditEntry({
    userId: req.user.id,
    caseId: updatedCase._id,
    action: req.body.status ? AUDIT_ACTIONS.CASE_STATUS_CHANGE : AUDIT_ACTIONS.CASE_UPDATE,
    details: {
      caseNumber: updatedCase.caseNumber,
      updatedFields: Object.keys(req.body),
      status: updatedCase.status,
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return ApiResponse.success(res, {
    message: 'Case file updated successfully',
    data: updatedCase,
  });
}

async function assignOfficers(req, res) {
  const { id } = req.params;
  const { officerIds } = req.body;

  const updatedCase = await caseService.assignOfficers(id, officerIds, req.user);

  await recordAuditEntry({
    userId: req.user.id,
    caseId: updatedCase._id,
    action: AUDIT_ACTIONS.CASE_OFFICER_ASSIGN,
    details: {
      caseNumber: updatedCase.caseNumber,
      assignedOfficerIds: officerIds,
      totalAssigned: updatedCase.assignedOfficers?.length || 0,
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return ApiResponse.success(res, {
    message: 'Personnel assigned to case successfully',
    data: updatedCase,
  });
}

async function getCaseStatistics(req, res) {
  const stats = await caseService.getCaseStatistics(req.user);

  return ApiResponse.success(res, {
    message: 'Case statistics calculated successfully',
    data: stats,
  });
}

async function getOfficersRoster(req, res) {
  const roster = await caseService.getOfficersRoster();

  return ApiResponse.success(res, {
    message: 'Active officers roster retrieved successfully',
    data: roster,
  });
}

const intelligenceService = require('../services/intelligence.service');

async function getCaseIntelligence(req, res) {
  const { id } = req.params;
  const intelligence = await intelligenceService.getCaseIntelligence(id, req.user);

  return ApiResponse.success(res, {
    message: 'Case intelligence dossier compiled successfully',
    data: intelligence,
  });
}

async function getCaseTimeline(req, res) {
  const { id } = req.params;
  const timeline = await intelligenceService.generateCaseTimeline(id, req.user);

  return ApiResponse.success(res, {
    message: 'Case chronological timeline generated successfully',
    data: timeline,
  });
}

async function getCaseEntities(req, res) {
  const { id } = req.params;
  const entities = await intelligenceService.extractCaseEntities(id, req.user);

  return ApiResponse.success(res, {
    message: 'Cross-document entity linking extracted successfully',
    data: entities,
  });
}

async function getCaseRelationships(req, res) {
  const { id } = req.params;
  const relationships = await intelligenceService.getCaseRelationships(id, req.user);

  return ApiResponse.success(res, {
    message: 'Case-to-case relationship intelligence compiled successfully',
    data: relationships,
  });
}

module.exports = {
  getCases,
  getCase,
  createCase,
  updateCase,
  assignOfficers,
  getCaseStatistics,
  getOfficersRoster,
  getCaseIntelligence,
  getCaseTimeline,
  getCaseEntities,
  getCaseRelationships,
};
