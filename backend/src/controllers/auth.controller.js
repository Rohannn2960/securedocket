const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants/statusCodes');
const { cookieConfig } = require('../config/security');
const {
  generateAccessToken,
  generatePre2faToken,
  verifyPre2faToken,
  createRefreshTokenSession,
  rotateRefreshToken,
  revokeRefreshToken,
} = require('../services/auth.service');
const totpService = require('../services/totp.service');
const { recordAuditEntry } = require('../services/audit.service');
const { AUDIT_ACTIONS } = require('../constants/actions');
const { User } = require('../models');

/**
 * Step 1: Officer/User Login (Email + Password Verification)
 * Validates credentials and issues short-lived pre-2FA token.
 * DOES NOT issue full session cookies until Step 2 (TOTP 2FA) succeeds.
 */
async function login(req, res) {
  const { email, password } = req.body;

  // Find user by email, explicitly requesting hidden passwordHash and totp flags
  const user = await User.findOne({ email: email.toLowerCase().trim() })
    .select('+passwordHash +totpSecret +totpEnabled');

  if (!user || !(await user.comparePassword(password))) {
    // Record failed login audit attempt
    await recordAuditEntry({
      userId: user ? user._id : null,
      action: AUDIT_ACTIONS.USER_LOGIN,
      details: { email, result: 'FAILED_INVALID_CREDENTIALS' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    throw ApiError.unauthorized('Invalid official email or security passphrase', ERROR_CODES.INVALID_CREDENTIALS);
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Your account has been deactivated. Please contact your system administrator.', ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  // Issue short-lived pre-2FA signed token (5 min window)
  const tempToken = generatePre2faToken(user);

  // If 2FA is not yet configured for this user (initial onboarding)
  if (!user.totpEnabled || !user.totpSecret) {
    return ApiResponse.success(res, {
      statusCode: HTTP_STATUS.ACCEPTED,
      message: 'Initial 2FA enrollment required before accessing the vault.',
      data: {
        require2FASetup: true,
        tempToken,
        userId: user._id,
        email: user.email,
      },
    });
  }

  // Mandatory 2FA verification challenge
  return ApiResponse.success(res, {
    statusCode: HTTP_STATUS.ACCEPTED,
    message: 'Passphrase verified. Please provide 6-digit TOTP code from your authenticator device.',
    data: {
      require2FA: true,
      tempToken,
      userId: user._id,
    },
  });
}

/**
 * Step 2: TOTP 2FA Code Verification
 * Verifies 6-digit TOTP code and establishes full authenticated session in httpOnly cookies.
 */
async function verify2FA(req, res) {
  const { totpCode, tempToken, userId } = req.body;

  let targetUserId = userId;

  // Validate pre-2FA token if provided
  if (tempToken) {
    const decoded = verifyPre2faToken(tempToken);
    targetUserId = decoded.id;
  }

  if (!targetUserId) {
    throw ApiError.badRequest('User reference or temporary token is required', ERROR_CODES.INVALID_INPUT);
  }

  const user = await User.findById(targetUserId).select('+totpSecret +totpEnabled');
  if (!user) {
    throw ApiError.notFound('User record not found', ERROR_CODES.INVALID_CREDENTIALS);
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Account is suspended', ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  if (!user.totpSecret) {
    throw ApiError.badRequest('2FA is not initialized for this account. Please complete setup.', ERROR_CODES.TOTP_REQUIRED);
  }

  // Verify TOTP code against stored secret
  const isCodeValid = totpService.verifyCode(totpCode, user.totpSecret);

  if (!isCodeValid) {
    await recordAuditEntry({
      userId: user._id,
      action: AUDIT_ACTIONS.USER_2FA_VERIFY,
      details: { email: user.email, result: 'FAILED_INVALID_TOTP' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    throw ApiError.unauthorized('Invalid or expired 6-digit TOTP code. Please check your authenticator clock sync.', ERROR_CODES.INVALID_TOTP);
  }

  // Establish full authenticated session
  const accessToken = generateAccessToken(user);
  const { token: refreshToken } = await createRefreshTokenSession(user._id, null, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Set httpOnly secure cookies
  res.cookie('accessToken', accessToken, cookieConfig.accessToken);
  res.cookie('refreshToken', refreshToken, cookieConfig.refreshToken);

  user.lastLoginAt = new Date();
  user.lastLoginIp = req.ip;
  await user.save();

  // Record successful login audit trail
  await recordAuditEntry({
    userId: user._id,
    action: AUDIT_ACTIONS.USER_LOGIN,
    details: { email: user.email, role: user.role, result: 'SUCCESS_2FA_VERIFIED' },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return ApiResponse.success(res, {
    message: 'Two-factor authentication successful. Session established.',
    data: {
      user: user.toSafeObject(),
      accessToken, // Also returned for programmatic API clients
    },
  });
}

/**
 * 2FA Onboarding: Generate TOTP Secret and QR Code Data URL
 */
async function setup2FA(req, res) {
  let userEmail;
  let targetUser;

  if (req.user) {
    targetUser = await User.findById(req.user.id);
    userEmail = req.user.email;
  } else if (req.body.tempToken) {
    const decoded = verifyPre2faToken(req.body.tempToken);
    targetUser = await User.findById(decoded.id);
    userEmail = decoded.email;
  }

  if (!targetUser) {
    throw ApiError.unauthorized('Authentication required to generate 2FA credentials');
  }

  const { secret, qrCodeDataUrl, otpauthUrl } = await totpService.generateSecret(userEmail);

  return ApiResponse.success(res, {
    message: 'TOTP 2FA secret and QR code generated',
    data: {
      secret,
      qrCodeDataUrl,
      otpauthUrl,
    },
  });
}

/**
 * 2FA Onboarding Confirmation: Verify first TOTP code and enable 2FA on account
 */
async function verifySetup2FA(req, res) {
  const { totpCode, secret, tempToken } = req.body;

  let targetUser;
  if (req.user) {
    targetUser = await User.findById(req.user.id);
  } else if (tempToken) {
    const decoded = verifyPre2faToken(tempToken);
    targetUser = await User.findById(decoded.id);
  }

  if (!targetUser) {
    throw ApiError.unauthorized('Authentication required to complete 2FA setup');
  }

  const isCodeValid = totpService.verifyCode(totpCode, secret);
  if (!isCodeValid) {
    throw ApiError.unauthorized('Invalid TOTP verification code. Setup aborted.', ERROR_CODES.INVALID_TOTP);
  }

  targetUser.totpSecret = secret;
  targetUser.totpEnabled = true;
  targetUser.totpVerifiedAt = new Date();
  await targetUser.save();

  // Automatically log in user after successful setup
  const accessToken = generateAccessToken(targetUser);
  const { token: refreshToken } = await createRefreshTokenSession(targetUser._id, null, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.cookie('accessToken', accessToken, cookieConfig.accessToken);
  res.cookie('refreshToken', refreshToken, cookieConfig.refreshToken);

  await recordAuditEntry({
    userId: targetUser._id,
    action: AUDIT_ACTIONS.USER_2FA_VERIFY,
    details: { action: 'TOTP_2FA_ENROLLED_AND_ACTIVATED' },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return ApiResponse.success(res, {
    message: '2FA enrollment complete. Account fully secured.',
    data: {
      user: targetUser.toSafeObject(),
      accessToken,
    },
  });
}

/**
 * Refresh Access Token with Token Rotation & Replay Attack Defense
 */
async function refreshTokenHandler(req, res) {
  const token = req.cookies && req.cookies.refreshToken;
  if (!token) {
    throw ApiError.unauthorized('Refresh token missing from secure cookie', ERROR_CODES.AUTH_REQUIRED);
  }

  const { accessToken, refreshToken: newRefreshToken, user } = await rotateRefreshToken(token, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Set rotated cookies
  res.cookie('accessToken', accessToken, cookieConfig.accessToken);
  res.cookie('refreshToken', newRefreshToken, cookieConfig.refreshToken);

  return ApiResponse.success(res, {
    message: 'Session refreshed and token rotated successfully',
    data: {
      user,
      accessToken,
    },
  });
}

/**
 * Secure Logout (Clears Cookies and Revokes Token in DB)
 */
async function logout(req, res) {
  const refreshToken = req.cookies && req.cookies.refreshToken;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

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
    message: 'Logged out successfully. All session tokens invalidated.',
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
  setup2FA,
  verifySetup2FA,
  refreshTokenHandler,
  logout,
  getProfile,
};
