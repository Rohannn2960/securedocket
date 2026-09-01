const logger = require('../config/logger');
const config = require('../config/env');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Semantic Embedding & Vector Search Service Contract
 */
class VectorService {
  constructor() {
    this.apiKey = config.gemini.apiKey || '';
    this.genAI = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
    this.modelName = 'text-embedding-004';
  }

  /**
   * Calculate Cosine Similarity between two numerical vectors
   * @param {number[]} vecA
   * @param {number[]} vecB
   * @returns {number} Value between -1.0 and 1.0 (typically 0.0 to 1.0 for embeddings)
   */
  calculateCosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Generate 768-dimensional text embedding vector
   */
  async generateEmbedding(text) {
    if (!text || text.trim() === '') {
      return null;
    }

    if (!this.genAI) {
      logger.warn('[Vector Service] Gemini API key not configured. Returning empty vector.');
      return null;
    }

    try {
      logger.info(`[Vector Service] Generating semantic embedding for text (${text.length} chars)`);
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      
      const result = await model.embedContent(text);
      const embedding = result.embedding;
      return embedding.values; // Should be a 768-dimensional array
    } catch (error) {
      logger.error(`[Vector Service] Failed to generate embedding: ${error.message}`);
      return null; // Return null instead of failing the whole pipeline
    }
  }
}

module.exports = new VectorService();
