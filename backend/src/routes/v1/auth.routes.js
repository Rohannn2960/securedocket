const express = require('express');
const { login, verify2FA, refreshTokenHandler, logout, getProfile } = require('../../controllers/auth.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authRateLimiter } = require('../../middleware/rateLimiter');
const asyncWrapper = require('../../utils/asyncWrapper');

const router = express.Router();

// Public auth endpoints protected with strict rate limiting
router.post('/login', authRateLimiter, asyncWrapper(login));
router.post('/verify-2fa', authRateLimiter, asyncWrapper(verify2FA));
router.post('/refresh', authRateLimiter, asyncWrapper(refreshTokenHandler));
router.post('/logout', asyncWrapper(logout));

// Authenticated session profile endpoint
router.get('/profile', authenticate, asyncWrapper(getProfile));

module.exports = router;
