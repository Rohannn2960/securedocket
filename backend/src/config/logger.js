/**
 * Centralized Structured Logger
 * Emits JSON logs suitable for security monitoring, SIEM ingestion, and local debugging.
 */
const SENSITIVE_KEYS = ['password', 'passwordHash', 'token', 'refreshToken', 'totpSecret', 'authorization', 'cookie'];

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((sensitive) => key.toLowerCase().includes(sensitive.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
  AUDIT: 'AUDIT',
};

function formatLog(level, message, meta = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta.requestId ? { requestId: meta.requestId } : {}),
    ...(meta.userId ? { userId: meta.userId } : {}),
    ...(meta.role ? { role: meta.role } : {}),
    ...(meta.action ? { action: meta.action } : {}),
    ...(meta.documentId ? { documentId: meta.documentId } : {}),
    ...(meta.ip ? { ip: meta.ip } : {}),
    meta: sanitizeObject(meta.details || (meta.requestId || meta.userId ? undefined : meta)),
  };

  if (meta.error) {
    logEntry.error = {
      name: meta.error.name,
      message: meta.error.message,
      code: meta.error.code,
      stack: process.env.NODE_ENV === 'development' ? meta.error.stack : undefined,
    };
  }

  return JSON.stringify(logEntry);
}

const logger = {
  info: (message, meta) => console.log(formatLog(LOG_LEVELS.INFO, message, meta)),
  warn: (message, meta) => console.warn(formatLog(LOG_LEVELS.WARN, message, meta)),
  error: (message, meta) => console.error(formatLog(LOG_LEVELS.ERROR, message, meta)),
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatLog(LOG_LEVELS.DEBUG, message, meta));
    }
  },
  audit: (action, message, meta = {}) => {
    console.log(formatLog(LOG_LEVELS.AUDIT, `[AUDIT_EVENT] ${action}: ${message}`, { ...meta, action }));
  },
};

module.exports = logger;
