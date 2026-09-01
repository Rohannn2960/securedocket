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
};
