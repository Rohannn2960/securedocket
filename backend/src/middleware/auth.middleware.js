const jwt = require('jsonwebtoken');
const config = require('../config/env');
const ApiError = require('../utils/apiError');
const { ERROR_CODES, HTTP_STATUS } = require('../constants/statusCodes');
const User = require('../models/User');

/**
 * Authentication Middleware
 * Validates JWT access token from httpOnly secure cookie or Authorization Bearer header.
 */
async function authenticate(req, res, next) {
  try {
    let token = null;

    // 1. Check httpOnly cookie first (primary security strategy)
    if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }
    // 2. Check Authorization Bearer header (fallback for non-browser programmatic clients)
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
      return next(new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid authentication token.', ERROR_CODES.TOKEN_INVALID));
    }

    // Attach decoded user payload to request context
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional Authentication Middleware
 * Attaches user context if valid token exists, but does not block unauthenticated access.
 */
async function optionalAuth(req, res, next) {
  try {
    const token = (req.cookies && req.cookies.accessToken) ||
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') && req.headers.authorization.split(' ')[1]);

    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwt.accessSecret);
        req.user = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          name: decoded.name,
        };
      } catch {
        // Silently ignore invalid tokens in optional auth
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  authenticate,
  optionalAuth,
};
