const { Case } = require('../models');
const ApiError = require('../utils/apiError');
const { ERROR_CODES, HTTP_STATUS } = require('../constants/statusCodes');
const logger = require('../config/logger');

class CaseService {
  async listCases({ page = 1, limit = 20, status, search }) {
    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { caseNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [cases, total] = await Promise.all([
      Case.find(query)
        .populate('assignedOfficers', 'name email badgeNumber role')
        .populate('leadOfficer', 'name email badgeNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Case.countDocuments(query),
    ]);

    return {
      cases,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getCaseById(caseId) {
    const caseItem = await Case.findById(caseId)
      .populate('assignedOfficers', 'name email badgeNumber role')
      .populate('leadOfficer', 'name email badgeNumber')
      .lean();

    if (!caseItem) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Legal case file not found', ERROR_CODES.CASE_NOT_FOUND);
    }
    return caseItem;
  }

  async createCase(data, userId) {
    const existing = await Case.findOne({ caseNumber: data.caseNumber.trim().toUpperCase() });
    if (existing) {
      throw new ApiError(HTTP_STATUS.CONFLICT, `Case number ${data.caseNumber} already exists in registry`, ERROR_CODES.DUPLICATE_CASE_NUMBER);
    }

    const newCase = await Case.create({
      ...data,
      caseNumber: data.caseNumber.trim().toUpperCase(),
      leadOfficer: userId,
      assignedOfficers: data.assignedOfficers || [userId],
    });

    logger.info(`New legal case registered: ${newCase.caseNumber}`, { caseId: newCase._id, userId });
    return newCase;
  }
}

module.exports = new CaseService();
