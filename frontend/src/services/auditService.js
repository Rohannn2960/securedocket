import api from './api';

export const auditService = {
  getAuditLogs: async (params = {}) => {
    return await api.get('/audit', { params });
  },

  verifyAuditChain: async () => {
    return await api.get('/audit/verify-chain');
  },
};
