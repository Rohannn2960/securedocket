const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./env');
const { HTTP_STATUS, ERROR_CODES } = require('../constants/statusCodes');
const logger = require('./logger');

/**
 * Helmet Security Headers Configuration
 */
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", config.clientUrl],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: config.isProduction ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding if required
  frameguard: { action: 'deny' },   // Prevent clickjacking
  hidePoweredBy: true,              // Suppress X-Powered-By header
  hsts: config.isProduction
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
});

/**
 * Strict CORS Configuration
 */
const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser agents in dev (e.g. curl/Postman) or exact matching client origin
    const allowedOrigins = [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Cross-Origin Request Blocked by Security Policy'));
    }
  },
  credentials: true, // Allow cookies (httpOnly session/refresh tokens)
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Requested-With'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 86400, // 24 hours preflight cache
};

/**
 * Cookie Security Flags Strategy
 */
const cookieConfig = Object.freeze({
  accessToken: {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 15 * 60 * 1000, // 15 minutes
  },
  refreshToken: {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth/refresh', // Scoped only to refresh endpoint
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
});

/**
 * Rate Limiting Factory
 */
function createRateLimiter(options = {}) {
  return rateLimit({
    windowMs: options.windowMs || config.rateLimit.windowMs,
    max: options.max || config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
        ip: req.ip,
        url: req.originalUrl,
      });
      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
        error: {
          code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
          message: 'Too many requests from this IP. Please try again later.',
        },
        timestamp: new Date().toISOString(),
      });
    },
  });
}

module.exports = {
  helmetConfig,
  corsOptions: cors(corsOptions),
  cookieConfig,
  createRateLimiter,
};
