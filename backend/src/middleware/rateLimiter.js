const { createRateLimiter } = require('../config/security');
const config = require('../config/env');

// Standard API Rate Limiter (100 requests / 15 minutes)
const apiRateLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
});

// Sensitive Authentication Rate Limiter (10 requests / 15 minutes)
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimit.authMax,
});

// Verification / Tamper Checking Limiter
const verificationRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 30,
});

module.exports = {
  apiRateLimiter,
  authRateLimiter,
  verificationRateLimiter,
};
