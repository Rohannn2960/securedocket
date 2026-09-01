import api from './api';

export const authService = {
  login: async (email, password) => {
    return api.post('/auth/login', { email, password });
  },

  verify2FA: async (userId, totpCode) => {
    return api.post('/auth/verify-2fa', { userId, totpCode });
  },

  logout: async () => {
    return api.post('/auth/logout');
  },

  getProfile: async () => {
    return api.get('/auth/profile');
  },
};
