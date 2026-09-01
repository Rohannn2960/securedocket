const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/env');
const ApiError = require('../utils/apiError');
const { ERROR_CODES, HTTP_STATUS } = require('../constants/statusCodes');
const { calculateSha256 } = require('../utils/crypto');
const { RefreshToken, User } = require('../models');
const logger = require('../config/logger');

/**
 * Generate standard access token (15 minutes)
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user._id ? user._id.toString() : user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      badgeNumber: user.badgeNumber || undefined,
    },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn || '15m' }
  );
}

/**
 * Generate temporary pre-2FA token (5 minutes)
 * Does NOT grant access to protected endpoints; only used to authorize TOTP verification step.
 */
function generatePre2faToken(user) {
  return jwt.sign(
    {
      id: user._id ? user._id.toString() : user.id,
      email: user.email,
      isPre2FA: true,
    },
    config.jwt.accessSecret,
    { expiresIn: '5m' }
  );
}

/**
 * Verify pre-2FA temporary token
 */
function verifyPre2faToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    if (!decoded.isPre2FA) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid pre-2FA token type', ERROR_CODES.TOKEN_INVALID);
    }
    return decoded;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, '2FA authentication window expired. Please sign in again.', ERROR_CODES.TOKEN_EXPIRED);
    }
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid 2FA authentication state.', ERROR_CODES.TOKEN_INVALID);
  }
}

/**
 * Create new Refresh Token Session with Family Tracking
 * @param {string|ObjectId} userId
 * @param {string|null} existingFamilyId
 * @param {object} reqMeta - IP and User Agent
 */
async function createRefreshTokenSession(userId, existingFamilyId = null, reqMeta = {}) {
  const familyId = existingFamilyId || uuidv4();
  const tokenPayload = {
    id: userId.toString(),
    familyId,
    jti: uuidv4(),
    tokenType: 'refresh',
  };

  const token = jwt.sign(tokenPayload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn || '7d',
  });

  const tokenHash = calculateSha256(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await RefreshToken.create({
    userId,
    tokenHash,
    familyId,
    expiresAt,
    ipAddress: reqMeta.ip || 'unknown',
    userAgent: reqMeta.userAgent || 'unknown',
  });

  return { token, familyId };
}

/**
 * Rotate Refresh Token with Cryptographic Replay Attack Protection
 * @param {string} oldTokenString
 * @param {object} reqMeta
 */
async function rotateRefreshToken(oldTokenString, reqMeta = {}) {
  let decoded;
  try {
    decoded = jwt.verify(oldTokenString, config.jwt.refreshSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Refresh token has expired. Please sign in again.', ERROR_CODES.TOKEN_EXPIRED);
    }
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid refresh token signature.', ERROR_CODES.TOKEN_INVALID);
  }

  const oldTokenHash = calculateSha256(oldTokenString);
  const tokenDoc = await RefreshToken.findOne({ tokenHash: oldTokenHash });

  // Replay Attack Detection: If token is not in DB or was already revoked,
  // someone is reusing an old token! Revoke the entire family tree immediately.
  if (!tokenDoc || tokenDoc.isRevoked) {
    const familyIdToPurge = tokenDoc ? tokenDoc.familyId : decoded.familyId;
    if (familyIdToPurge) {
      await RefreshToken.updateMany({ familyId: familyIdToPurge }, { isRevoked: true });
      logger.error('SECURITY ALERT: Refresh token replay attack detected! Revoked entire token family.', {
        userId: decoded.id,
        familyId: familyIdToPurge,
        ip: reqMeta.ip,
      });
    }

    throw new ApiError(
      HTTP_STATUS.UNAUTHORIZED,
      'Security violation: Reused refresh token detected. All associated sessions have been revoked for your safety.',
      ERROR_CODES.TOKEN_INVALID
    );
  }

  // Verify user still exists and is active
  const user = await User.findById(tokenDoc.userId);
  if (!user || !user.isActive) {
    tokenDoc.isRevoked = true;
    await tokenDoc.save();
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'User account is inactive or disabled', ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  // Issue new refresh token within the same family
  const { token: newRefreshToken } = await createRefreshTokenSession(user._id, tokenDoc.familyId, reqMeta);
  const newTokenHash = calculateSha256(newRefreshToken);

  // Invalidate old refresh token and link to new one
  tokenDoc.isRevoked = true;
  tokenDoc.replacedByTokenHash = newTokenHash;
  await tokenDoc.save();

  // Generate new access token
  const newAccessToken = generateAccessToken(user);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: user.toSafeObject(),
  };
}

/**
 * Revoke specific refresh token on logout
 */
async function revokeRefreshToken(tokenString) {
  if (!tokenString) return;
  const tokenHash = calculateSha256(tokenString);
  await RefreshToken.findOneAndUpdate({ tokenHash }, { isRevoked: true });
}

/**
 * Revoke all sessions for a user (e.g. password change, admin suspension)
 */
async function revokeAllUserSessions(userId) {
  await RefreshToken.updateMany({ userId }, { isRevoked: true });
}

module.exports = {
  generateAccessToken,
  generatePre2faToken,
  verifyPre2faToken,
  createRefreshTokenSession,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserSessions,
};
