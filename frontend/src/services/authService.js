import api from './api';

export const authService = {
  login: async (email, password) => {
    return api.post('/auth/login', { email, password });
  },

  verify2FA: async (totpCode, tempToken, userId) => {
    return api.post('/auth/verify-2fa', { totpCode, tempToken, userId });
  },

  setup2FA: async (tempToken) => {
    return api.post('/auth/setup-2fa', { tempToken });
  },

  verifySetup2FA: async (totpCode, secret, tempToken) => {
    return api.post('/auth/verify-setup-2fa', { totpCode, secret, tempToken });
  },

  refreshToken: async () => {
    return api.post('/auth/refresh');
  },

  logout: async () => {
    return api.post('/auth/logout');
  },

  getProfile: async () => {
    return api.get('/auth/profile');
  },
};

export const userService = {
  getUsers: async (params = {}) => {
    return api.get('/users', { params });
  },

  getUserById: async (id) => {
    return api.get(`/users/${id}`);
  },

  createUser: async (userData) => {
    return api.post('/users', userData);
  },

  updateUserRole: async (id, role) => {
    return api.patch(`/users/${id}/role`, { role });
  },

  updateUserStatus: async (id, isActive) => {
    return api.patch(`/users/${id}/status`, { isActive });
  },
};
