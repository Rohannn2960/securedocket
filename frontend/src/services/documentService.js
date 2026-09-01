import api from './api';

export const documentService = {
  getDocuments: async (params = {}) => {
    return api.get('/documents', { params });
  },

  getDocumentById: async (id) => {
    return api.get(`/documents/${id}`);
  },

  uploadDocument: async (formData, onProgress) => {
    return api.post('/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
  },

  getDocumentViewUrl: async (id) => {
    return api.get(`/documents/${id}/view`);
  },

  getDocumentDownloadUrl: async (id) => {
    return api.get(`/documents/${id}/download-url`);
  },
};
