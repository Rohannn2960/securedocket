import api from './api';

export const caseService = {
  getCases: async (params = {}) => {
    return api.get('/cases', { params });
  },

  getCaseById: async (id) => {
    return api.get(`/cases/${id}`);
  },

  createCase: async (caseData) => {
    return api.post('/cases', caseData);
  },

  updateCase: async (id, updateData) => {
    return api.patch(`/cases/${id}`, updateData);
  },

  assignOfficers: async (id, officerIds) => {
    return api.post(`/cases/${id}/officers`, { officerIds });
  },

  getOfficersRoster: async () => {
    return api.get('/cases/roster/officers');
  },

  getCaseStatistics: async () => {
    return api.get('/cases/statistics');
  },
};
