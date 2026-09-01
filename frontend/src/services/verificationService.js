import api from './api';

export const verificationService = {
  /**
   * Get documents awaiting forensic verification / low confidence review
   */
  async getVerificationQueue(params = {}) {
    const response = await api.get('/verification/queue', { params });
    return response.data;
  },

  /**
   * Get single document extraction dossier with field breakdown
   */
  async getDocumentExtraction(id) {
    const response = await api.get(`/verification/${id}`);
    return response.data;
  },

  /**
   * Trigger / Re-run AI OCR and extraction pipeline
   */
  async triggerExtraction(id) {
    const response = await api.post(`/verification/${id}/extract`);
    return response.data;
  },

  /**
   * Submit human field correction (preserves original AI value)
   */
  async correctField(id, fieldName, correctedValue) {
    const response = await api.patch(`/verification/${id}/fields`, {
      fieldName,
      correctedValue,
    });
    return response.data;
  },

  /**
   * Approve single field extraction without changes
   */
  async approveField(id, fieldName) {
    const response = await api.post(`/verification/${id}/fields/approve`, {
      fieldName,
    });
    return response.data;
  },

  /**
   * Finalize forensic verification and digitally sign off
   */
  async verifyDocument(id, notes = '') {
    const response = await api.post(`/verification/${id}/verify`, { notes });
    return response.data;
  },

  /**
   * Flag document for anomaly, tampering, or illegibility
   */
  async flagDocument(id, reason) {
    const response = await api.post(`/verification/${id}/flag`, { reason });
    return response.data;
  },
};
