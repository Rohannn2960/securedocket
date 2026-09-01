const { createRateLimiter } = require('../config/security');
const config = require('../config/env');

const isTest = process.env.NODE_ENV === 'test';

// Standard API Rate Limiter (100 requests / 15 minutes)
const apiRateLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  max: isTest ? 5000 : config.rateLimit.max,
});

// Sensitive Authentication Rate Limiter for Login & 2FA Gateways
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 100 : config.rateLimit.authMax,
});

// Dedicated Burst Limiter to explicitly test brute-force protection
const burstTestLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
});

// Verification / Tamper Checking Limiter
const verificationRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 30,
});

module.exports = {
  apiRateLimiter,
  authRateLimiter,
  burstTestLimiter,
  verificationRateLimiter,
};
