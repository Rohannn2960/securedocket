import api from './api';

export const documentService = {
  getDocuments: async (params = {}) => {
    return api.get('/documents', { params });
  },

  getDocumentById: async (id) => {
    return api.get(`/documents/${id}`);
  },

  getDownloadUrl: async (id) => {
    return api.get(`/documents/${id}/download-url`);
  },

  getAuditLogs: async (params = {}) => {
    return api.get('/audit', { params });
  },

  verifyAuditChain: async () => {
    return api.get('/audit/verify-chain');
  },
};
