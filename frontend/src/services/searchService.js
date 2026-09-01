import api from './api';

const searchService = {
  /**
   * Perform semantic search
   * @param {Object} params - { query: string, caseId?: string }
   */
  semanticSearch: async (params) => {
    const response = await api.post('/search/semantic', params);
    return response.data;
  },
};

export { searchService };
export default searchService;
