const searchService = require('../services/search.service');
const { ApiError } = require('../utils/ApiError');
const { HTTP_STATUS } = require('../constants/statusCodes');
const logger = require('../config/logger');

/**
 * Controller for Semantic Search
 */
const performSemanticSearch = async (req, res, next) => {
  try {
    const { query, caseId } = req.body;
    const user = req.user;

    const results = await searchService.semanticSearch({ query, caseIdFilter: caseId, user });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        results,
        count: results.length,
      },
    });
  } catch (error) {
    logger.error(`[Search Controller] Semantic search failed: ${error.message}`);
    next(error);
  }
};

module.exports = {
  performSemanticSearch,
};
