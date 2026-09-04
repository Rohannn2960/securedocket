const path = require('path');
const dotenv = require('dotenv');

// Load .env file from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Validate and export environment variables with type casting and fallbacks.
 * Ensures the system fails fast if critical security parameters are omitted in production.
 */
function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';

  const config = {
    env: process.env.NODE_ENV || 'development',
    isProduction: isProd,
    port: parseInt(process.env.PORT, 10) || 5000,
    clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

    // Database
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/secure_dms_dev',
    },

    // Authentication & Cryptography
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_jwt_access_secret_change_in_production_min_32_chars',
      refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret_change_in_production_min_32_chars',
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRATION || '15m',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
    },
    masterEncryptionKey: process.env.MASTER_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,

    // AWS S3
    aws: {
      region: process.env.AWS_REGION || 'ap-south-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      bucketName: process.env.AWS_S3_BUCKET_NAME || 'sih26190-secure-documents-vault',
    },

    // AI & OCR
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      modelName: process.env.GEMINI_MODEL_NAME || 'gemini-3.6-flash',
      embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
      confidenceThreshold: parseFloat(process.env.OCR_CONFIDENCE_THRESHOLD) || 0.80,
    },

    // Rate Limiting
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
      authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS, 10) || 10,
    },

    // Reverse Proxy & Network Trust
    trustProxy: process.env.TRUST_PROXY !== undefined
      ? (process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY === 'false' ? false : (!isNaN(Number(process.env.TRUST_PROXY)) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY))
      : 1,
  };

  // Fail-fast checks in production
  if (isProd) {
    const requiredInProd = [
      ['MONGODB_URI', process.env.MONGODB_URI],
      ['JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET],
      ['JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET],
      ['AWS_S3_BUCKET_NAME', process.env.AWS_S3_BUCKET_NAME],
    ];

    const missing = requiredInProd.filter(([, val]) => !val);
    if (missing.length > 0) {
      throw new Error(`CRITICAL CONFIGURATION ERROR: Missing required production environment variables: ${missing.map(([key]) => key).join(', ')}`);
    }

    if (config.jwt.accessSecret.length < 32 || config.jwt.refreshSecret.length < 32) {
      throw new Error('CRITICAL SECURITY ERROR: JWT secrets must be at least 32 characters long in production.');
    }

    if (!/^[a-f0-9]{64}$/i.test(config.masterEncryptionKey)) {
      throw new Error('CRITICAL SECURITY ERROR: MASTER_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes) for AES-256.');
    }
  }

  return Object.freeze(config);
}

module.exports = validateEnv();
