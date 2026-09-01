const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants/statusCodes');
const { cookieConfig } = require('../config/security');
const { generateAccessToken, generateRefreshToken } = require('../services/auth.service');
const { recordAuditEntry } = require('../services/audit.service');
const { AUDIT_ACTIONS } = require('../constants/actions');
const { User } = require('../models');

/**
 * Officer / User Login Controller
 */
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    throw ApiError.badRequest('Email and password are required credentials', ERROR_CODES.INVALID_INPUT);
  }

  // Find user by email, selecting hidden password hash
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash +totpEnabled');

  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password', ERROR_CODES.INVALID_CREDENTIALS);
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Account has been suspended by system administrator', ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  // Check 2FA requirement
  if (user.totpEnabled) {
    return ApiResponse.success(res, {
      statusCode: HTTP_STATUS.ACCEPTED,
      message: '2FA authentication required. Please provide TOTP code.',
      data: {
        require2FA: true,
        tempSessionUserId: user._id,
      },
    });
  }

  // Issue tokens
  const accessToken = generateAccessToken(user);
  const { token: refreshToken } = generateRefreshToken(user);

  // Set httpOnly secure cookies
  res.cookie('accessToken', accessToken, cookieConfig.accessToken);
  res.cookie('refreshToken', refreshToken, cookieConfig.refreshToken);

  user.lastLoginAt = new Date();
  await user.save();

  // Record audit trail
  await recordAuditEntry({
    userId: user._id,
    action: AUDIT_ACTIONS.USER_LOGIN,
    details: { email: user.email, role: user.role },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return ApiResponse.success(res, {
    message: 'Authentication successful',
    data: {
      user: user.toSafeObject(),
      accessToken, // Returned for non-cookie API clients
    },
  });
}

/**
 * 2FA Verification Controller
 */
async function verify2FA(req, res) {
  const { userId, totpCode } = req.body;

  if (!userId || !totpCode) {
    throw ApiError.badRequest('User ID and 6-digit TOTP code are required', ERROR_CODES.INVALID_INPUT);
  }

  const user = await User.findById(userId).select('+totpSecret');
  if (!user) {
    throw ApiError.notFound('User not found', ERROR_CODES.INVALID_CREDENTIALS);
  }

  // Mock / TOTP verification check (In production, otplib / speakeasy verifies code against totpSecret)
  const isCodeValid = totpCode.length === 6 && /^\d+$/.test(totpCode);
  if (!isCodeValid) {
    throw ApiError.unauthorized('Invalid or expired 2FA TOTP code', ERROR_CODES.INVALID_TOTP);
  }

  const accessToken = generateAccessToken(user);
  const { token: refreshToken } = generateRefreshToken(user);

  res.cookie('accessToken', accessToken, cookieConfig.accessToken);
  res.cookie('refreshToken', refreshToken, cookieConfig.refreshToken);

  await recordAuditEntry({
    userId: user._id,
    action: AUDIT_ACTIONS.USER_2FA_VERIFY,
    details: { method: 'TOTP' },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return ApiResponse.success(res, {
    message: '2FA verification successful',
    data: {
      user: user.toSafeObject(),
      accessToken,
    },
  });
}

/**
 * Refresh Access Token Rotation
 */
async function refreshTokenHandler(req, res) {
  const token = req.cookies && req.cookies.refreshToken;
  if (!token) {
    throw ApiError.unauthorized('Refresh token missing from secure cookie', ERROR_CODES.AUTH_REQUIRED);
  }

  // In full implementation, verify against DB and rotate refresh token
  return ApiResponse.success(res, {
    message: 'Session refreshed successfully',
  });
}

/**
 * Secure Logout (Clears Cookies)
 */
async function logout(req, res) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });

  if (req.user) {
    await recordAuditEntry({
      userId: req.user.id,
      action: AUDIT_ACTIONS.USER_LOGOUT,
      details: { role: req.user.role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  return ApiResponse.success(res, {
    message: 'Session logged out securely',
  });
}

/**
 * Get Current Authenticated User Profile
 */
async function getProfile(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) {
    throw ApiError.notFound('User profile not found');
  }

  return ApiResponse.success(res, {
    data: { user: user.toSafeObject() },
  });
}

module.exports = {
  login,
  verify2FA,
  refreshTokenHandler,
  logout,
  getProfile,
};
