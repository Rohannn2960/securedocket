const { Case, User, Document, CASE_STATUS, CASE_PRIORITY } = require('../models');
const ApiError = require('../utils/apiError');
const { ERROR_CODES, HTTP_STATUS } = require('../constants/statusCodes');
const { ROLES } = require('../constants/roles');
const logger = require('../config/logger');
const { decryptDocumentFields } = require('../utils/crypto');
const config = require('../config/env');

class CaseService {
  /**
   * List cases scoped by user clearance role
   */
  async listCases({ page = 1, limit = 20, status, priority, search, jurisdiction }, user) {
    const queryConditions = [];

    // Role-based data scoping: Officers only see assigned cases
    if (user.role === ROLES.OFFICER) {
      queryConditions.push({
        $or: [
          { leadOfficer: user.id },
          { assignedOfficers: user.id },
        ],
      });
    }

    if (status) {
      queryConditions.push({ status });
    }

    if (priority) {
      queryConditions.push({ 'metadata.priority': priority });
    }

    if (jurisdiction) {
      queryConditions.push({ jurisdiction: { $regex: jurisdiction, $options: 'i' } });
    }

    if (search) {
      queryConditions.push({
        $or: [
          { caseNumber: { $regex: search, $options: 'i' } },
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ],
      });
    }

    const query = queryConditions.length > 0 ? { $and: queryConditions } : {};

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [cases, total] = await Promise.all([
      Case.find(query)
        .populate('assignedOfficers', 'name email badgeNumber department role')
        .populate('leadOfficer', 'name email badgeNumber department role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Case.countDocuments(query),
    ]);

    // Attach linked document count to each case
    const caseIds = cases.map((c) => c._id);
    const docCounts = await Document.aggregate([
      { $match: { caseId: { $in: caseIds } } },
      { $group: { _id: '$caseId', count: { $sum: 1 } } },
    ]);

    const docCountMap = new Map(docCounts.map((d) => [d._id.toString(), d.count]));
    const casesWithCounts = cases.map((c) => ({
      ...c,
      documentsCount: docCountMap.get(c._id.toString()) || 0,
    }));

    return {
      cases: casesWithCounts,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Get single case file with strict access boundary checking
   */
  async getCaseById(caseId, user) {
    const caseItem = await Case.findById(caseId)
      .populate('assignedOfficers', 'name email badgeNumber department role')
      .populate('leadOfficer', 'name email badgeNumber department role')
      .lean();

    if (!caseItem) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Legal case file not found in registry', ERROR_CODES.CASE_NOT_FOUND);
    }

    // Role-based boundary enforcement: Officers MUST be assigned
    if (user.role === ROLES.OFFICER) {
      const leadId = caseItem.leadOfficer?._id ? caseItem.leadOfficer._id.toString() : caseItem.leadOfficer?.toString();
      const isLead = leadId === user.id.toString();
      const isAssigned = Array.isArray(caseItem.assignedOfficers) && caseItem.assignedOfficers.some(
        (o) => (o._id ? o._id.toString() : o.toString()) === user.id.toString()
      );

      if (!isLead && !isAssigned) {
        logger.warn(`Unauthorized case access attempt: Officer ${user.id} attempted to view unassigned case ${caseId}`);
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Access forbidden: You do not have clearance for this case dossier.',
          ERROR_CODES.INSUFFICIENT_PERMISSIONS
        );
      }
    }

    // Fetch linked documents for this case dossier
    const documents = await Document.find({ caseId })
      .populate('uploadedBy', 'name email badgeNumber role')
      .populate('verifiedBy', 'name email badgeNumber role')
      .sort({ createdAt: -1 })
      .lean();

    const decryptedDocs = documents.map((doc) => decryptDocumentFields(doc, config.masterEncryptionKey));

    return {
      ...caseItem,
      documents: decryptedDocs,
      documentsCount: decryptedDocs.length,
    };
  }

  /**
   * Register new case with lead and assigned officers
   */
  async createCase(data, user) {
    const caseNum = data.caseNumber.trim().toUpperCase();
    const existing = await Case.findOne({ caseNumber: caseNum });
    if (existing) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        `Case number ${caseNum} already exists in registry`,
        ERROR_CODES.DUPLICATE_CASE_NUMBER
      );
    }

    let assignedList = [user.id];
    if (Array.isArray(data.assignedOfficers) && data.assignedOfficers.length > 0) {
      // Validate that all assigned user IDs exist
      const validUsers = await User.find({
        _id: { $in: data.assignedOfficers },
        isActive: true,
      }).select('_id');

      const validUserIds = validUsers.map((u) => u._id.toString());
      assignedList = Array.from(new Set([...assignedList, ...validUserIds]));
    }

    const newCase = await Case.create({
      caseNumber: caseNum,
      title: data.title.trim(),
      description: data.description?.trim() || '',
      status: data.status || CASE_STATUS.OPEN,
      jurisdiction: data.jurisdiction?.trim() || 'Central Cyber Crime Police Station',
      incidentDate: data.incidentDate || new Date(),
      leadOfficer: user.id,
      assignedOfficers: assignedList,
      metadata: {
        priority: data.priority || CASE_PRIORITY.MEDIUM,
        tags: Array.isArray(data.tags) ? data.tags : [],
      },
    });

    const populatedCase = await Case.findById(newCase._id)
      .populate('assignedOfficers', 'name email badgeNumber department role')
      .populate('leadOfficer', 'name email badgeNumber department role')
      .lean();

    logger.info(`New legal case registered: ${newCase.caseNumber}`, { caseId: newCase._id, userId: user.id });
    return populatedCase;
  }

  /**
   * Update permitted fields of a case (whitelisted to prevent mass assignment)
   */
  async updateCase(caseId, updateData, user) {
    const caseItem = await Case.findById(caseId);
    if (!caseItem) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Legal case file not found', ERROR_CODES.CASE_NOT_FOUND);
    }

    // Role-based boundary enforcement: Officers can only update cases they are assigned to
    if (user.role === ROLES.OFFICER) {
      const isLead = caseItem.leadOfficer.toString() === user.id.toString();
      const isAssigned = caseItem.assignedOfficers.some((id) => id.toString() === user.id.toString());

      if (!isLead && !isAssigned) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Access forbidden: You cannot modify an unassigned case dossier.',
          ERROR_CODES.INSUFFICIENT_PERMISSIONS
        );
      }
    }

    // Whitelisted permitted field updates
    if (updateData.title) caseItem.title = updateData.title.trim();
    if (updateData.description !== undefined) caseItem.description = updateData.description.trim();
    if (updateData.jurisdiction) caseItem.jurisdiction = updateData.jurisdiction.trim();
    if (updateData.incidentDate) caseItem.incidentDate = updateData.incidentDate;
    if (updateData.status) caseItem.status = updateData.status;

    if (updateData.priority) {
      caseItem.metadata.priority = updateData.priority;
    }
    if (Array.isArray(updateData.tags)) {
      caseItem.metadata.tags = updateData.tags;
    }

    await caseItem.save();

    const populated = await Case.findById(caseItem._id)
      .populate('assignedOfficers', 'name email badgeNumber department role')
      .populate('leadOfficer', 'name email badgeNumber department role')
      .lean();

    logger.info(`Case ${caseItem.caseNumber} updated by ${user.email}`, { caseId: caseItem._id, userId: user.id });
    return populated;
  }

  /**
   * Assign additional officers to an active case file
   */
  async assignOfficers(caseId, officerIds, user) {
    const caseItem = await Case.findById(caseId);
    if (!caseItem) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Legal case file not found', ERROR_CODES.CASE_NOT_FOUND);
    }

    // Clearance check: Only assigned lead officer or Admin can assign officers
    if (user.role === ROLES.OFFICER) {
      const isLead = caseItem.leadOfficer.toString() === user.id.toString();
      const isAssigned = caseItem.assignedOfficers.some((id) => id.toString() === user.id.toString());
      if (!isLead && !isAssigned) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Access forbidden: Clearance insufficient to assign personnel to this case.',
          ERROR_CODES.INSUFFICIENT_PERMISSIONS
        );
      }
    }

    // Validate that officerIds exist in database
    const validUsers = await User.find({
      _id: { $in: officerIds },
      isActive: true,
    }).select('_id');

    if (validUsers.length === 0) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'No valid active personnel found for provided IDs');
    }

    const currentIds = caseItem.assignedOfficers.map((id) => (id._id ? id._id.toString() : id.toString()));
    const newIds = validUsers.map((u) => u._id.toString());
    const merged = Array.from(new Set([...currentIds, ...newIds]));

    caseItem.assignedOfficers = merged;
    await caseItem.save();

    const populated = await Case.findById(caseItem._id)
      .populate('assignedOfficers', 'name email badgeNumber department role')
      .populate('leadOfficer', 'name email badgeNumber department role')
      .lean();

    logger.info(`Assigned ${newIds.length} officers to case ${caseItem.caseNumber}`, { caseId, userId: user.id });
    return populated;
  }

  /**
   * Get active officers roster for case assignment
   */
  async getOfficersRoster() {
    return User.find({
      role: { $in: [ROLES.OFFICER, ROLES.ADMIN] },
      isActive: true,
    })
      .select('_id name email badgeNumber department role')
      .sort({ name: 1 })
      .lean();
  }

  /**
   * Aggregate case statistics scoped to clearance role
   */
  async getCaseStatistics(user) {
    const matchStage = {};
    if (user.role === ROLES.OFFICER) {
      matchStage.$or = [
        { leadOfficer: user.id },
        { assignedOfficers: user.id },
      ];
    }

    const [statusStats, priorityStats, totalCases, recentWeekCount] = await Promise.all([
      Case.aggregate([
        { $match: matchStage },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Case.aggregate([
        { $match: matchStage },
        { $group: { _id: '$metadata.priority', count: { $sum: 1 } } },
      ]),
      Case.countDocuments(matchStage),
      Case.countDocuments({
        ...matchStage,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    const statusMap = Object.values(CASE_STATUS).reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {});
    statusStats.forEach((s) => {
      if (statusMap[s._id] !== undefined) {
        statusMap[s._id] = s.count;
      }
    });

    const priorityMap = Object.values(CASE_PRIORITY).reduce((acc, p) => {
      acc[p] = 0;
      return acc;
    }, {});
    priorityStats.forEach((p) => {
      if (priorityMap[p._id] !== undefined) {
        priorityMap[p._id] = p.count;
      }
    });

    return {
      total: totalCases,
      recentThisWeek: recentWeekCount,
      byStatus: statusMap,
      byPriority: priorityMap,
      activeInvestigations: (statusMap.open || 0) + (statusMap.under_investigation || 0),
      pendingTrial: statusMap.pending_trial || 0,
      closed: (statusMap.closed || 0) + (statusMap.archived || 0),
    };
  }
}

module.exports = new CaseService();
