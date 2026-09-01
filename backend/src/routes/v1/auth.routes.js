const express = require('express');
const {
  login,
  verify2FA,
  setup2FA,
  verifySetup2FA,
  refreshTokenHandler,
  logout,
  getProfile,
} = require('../../controllers/auth.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { authRateLimiter } = require('../../middleware/rateLimiter');
const {
  validateLogin,
  validateVerify2fa,
  validateVerifySetup2fa,
} = require('../../middleware/validators/auth.validator');
const asyncWrapper = require('../../utils/asyncWrapper');

const router = express.Router();

// 1. Primary Authentication Step (Password Check)
router.post('/login', authRateLimiter, validateLogin, asyncWrapper(login));

// 2. Mandatory TOTP 2FA Verification Step
router.post('/verify-2fa', authRateLimiter, validateVerify2fa, asyncWrapper(verify2FA));

// 3. 2FA Onboarding & Setup Endpoints
router.post('/setup-2fa', authRateLimiter, asyncWrapper(setup2FA));
router.post('/verify-setup-2fa', authRateLimiter, validateVerifySetup2fa, asyncWrapper(verifySetup2FA));

// 4. Session Refresh with Rotation & Replay Protection
router.post('/refresh', authRateLimiter, asyncWrapper(refreshTokenHandler));

// 5. Logout & Session Revocation
router.post('/logout', asyncWrapper(logout));

// 6. Authenticated User Profile
router.get('/profile', requireAuth, asyncWrapper(getProfile));

module.exports = router;
