const ApiResponse = require('../utils/apiResponse');
const { getDBState } = require('../config/database');
const config = require('../config/env');

const startTime = Date.now();

/**
 * Health & Diagnostics Controller
 */
function getHealth(req, res) {
  const dbStatus = getDBState();
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  const healthData = {
    status: dbStatus.isConnected ? 'HEALTHY' : 'DEGRADED',
    system: 'SIH-26190 Secure Digital Document Management System API',
    version: '1.0.0-prototype',
    environment: config.env,
    uptimeSeconds,
    database: {
      status: dbStatus.state,
      connected: dbStatus.isConnected,
    },
    security: {
      cookieHttpOnly: true,
      cookieSameSite: 'strict',
      rateLimiting: 'ACTIVE',
      rbacEnforcement: 'STRICT',
    },
    storage: {
      provider: 'AWS S3 (SSE-S3 AES-256)',
      bucket: config.aws.bucketName,
      region: config.aws.region,
    },
    aiEngine: {
      ocrProvider: config.gemini.apiKey ? 'Gemini Vision API (Configured)' : 'Tesseract Fallback Mode',
    },
  };

  return ApiResponse.success(res, {
    message: 'System diagnostics operational',
    data: healthData,
  });
}

module.exports = {
  getHealth,
};
