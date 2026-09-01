const jwt = require('jsonwebtoken');
const config = require('../config/env');
const ApiError = require('../utils/apiError');
const { ERROR_CODES, HTTP_STATUS } = require('../constants/statusCodes');
const { User } = require('../models');

/**
 * Authentication Middleware (requireAuth)
 * Validates JWT access token from httpOnly secure cookie or Authorization Bearer header.
 */
async function authenticate(req, res, next) {
  try {
    let token = null;

    // 1. Check httpOnly cookie first (primary secure storage)
    if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }
    // 2. Check Authorization Bearer header (programmatic / API fallback)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Authentication token missing. Please sign in.', ERROR_CODES.AUTH_REQUIRED));
    }

    // Verify token signature and expiration
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.accessSecret);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return next(new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Access token has expired. Please refresh session.', ERROR_CODES.TOKEN_EXPIRED));
      }
      return next(new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid authentication token signature.', ERROR_CODES.TOKEN_INVALID));
    }

    // Attach decoded user payload to request context
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
      badgeNumber: decoded.badgeNumber,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Require Pre-2FA Temporary Token Middleware
 */
function requirePre2fa(req, res, next) {
  const token = req.body.tempToken || (req.headers['x-temp-token']);

  if (!token) {
    return next(new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Pre-2FA temporary token missing.', ERROR_CODES.AUTH_REQUIRED));
  }

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    if (!decoded.isPre2FA) {
      return next(new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid pre-2FA token state.', ERROR_CODES.TOKEN_INVALID));
    }
    req.pre2faUser = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new ApiError(HTTP_STATUS.UNAUTHORIZED, '2FA authentication window expired. Please log in again.', ERROR_CODES.TOKEN_EXPIRED));
    }
    return next(new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid 2FA temporary token.', ERROR_CODES.TOKEN_INVALID));
  }
}

module.exports = {
  authenticate,
  requireAuth: authenticate, // Alias as specified in requirements
  requirePre2fa,
};
