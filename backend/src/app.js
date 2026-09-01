const express = require('express');
const cookieParser = require('cookie-parser');
const { helmetConfig, corsOptions } = require('./config/security');
const requestLogger = require('./middleware/requestLogger');
const { apiRateLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/error.middleware');
const ApiError = require('./utils/apiError');
const { HTTP_STATUS, ERROR_CODES } = require('./constants/statusCodes');
const apiRoutes = require('./routes');

const app = express();

// Trust reverse proxy (e.g. NGINX, AWS ALB) for accurate client IP in rate limiting & audit logs
app.set('trust proxy', 1);

// 1. Security Headers & CORS
app.use(helmetConfig);
app.use(corsOptions);

// 2. Correlation Tracking & Access Logging
app.use(requestLogger);

// 3. Cookie & Body Parsing
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Global API Rate Limiting
app.use('/api', apiRateLimiter);

// 5. Mount API Routes
app.use('/api', apiRoutes);

// 6. Handle Unknown Route Fallthrough
app.use('*', (req, res, next) => {
  next(new ApiError(HTTP_STATUS.NOT_FOUND, `API endpoint not found: ${req.method} ${req.originalUrl}`, ERROR_CODES.DOCUMENT_NOT_FOUND));
});

// 7. Global Centralized Error Boundary
app.use(errorHandler);

module.exports = app;
