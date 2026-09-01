const jwt = require('jsonwebtoken');
const config = require('../config/env');
const ApiError = require('../utils/apiError');
const { ERROR_CODES, HTTP_STATUS } = require('../constants/statusCodes');
const { calculateSha256 } = require('../utils/crypto');

/**
 * Generate standard access token (15 minutes)
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user._id || user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn }
  );
}

/**
 * Generate refresh token (7 days) with cryptographic hash tracking
 */
function generateRefreshToken(user) {
  const token = jwt.sign(
    {
      id: user._id || user.id,
      tokenType: 'refresh',
    },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );

  const hash = calculateSha256(token);
  return { token, hash };
}

/**
 * Verify refresh token signature
 */
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Refresh token has expired', ERROR_CODES.TOKEN_EXPIRED);
    }
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid refresh token', ERROR_CODES.TOKEN_INVALID);
  }
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
};
