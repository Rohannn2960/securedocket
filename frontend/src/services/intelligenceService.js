import api from './api';

export const intelligenceService = {
  /**
   * Get full case intelligence dossier (timeline & linked entities)
   * @param {string} caseId
   */
  getCaseIntelligence: async (caseId) => {
    return api.get(`/cases/${caseId}/intelligence`);
  },

  /**
   * Get chronological case timeline
   * @param {string} caseId
   */
  getCaseTimeline: async (caseId) => {
    return api.get(`/cases/${caseId}/timeline`);
  },

  /**
   * Get cross-document entity links
   * @param {string} caseId
   */
  getCaseEntities: async (caseId) => {
    return api.get(`/cases/${caseId}/entities`);
  },

  /**
   * Get case-to-case similarity and relationship intelligence
   * @param {string} caseId
   */
  getCaseRelationships: async (caseId) => {
    return api.get(`/cases/${caseId}/relationships`);
  },
};

export default intelligenceService;
