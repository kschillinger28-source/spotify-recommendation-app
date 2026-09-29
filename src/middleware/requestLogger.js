import crypto from 'crypto';

// Simple structured logger (can be replaced with pino/winston in future)
class StructuredLogger {
  constructor(level = 'info') {
    this.level = level;
  }

  _formatLog(logLevel, message, data) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: logLevel,
      message,
      ...data
    });
  }

  info(message, data = {}) {
    console.log(this._formatLog('INFO', message, data));
  }

  warn(message, data = {}) {
    console.warn(this._formatLog('WARN', message, data));
  }

  error(message, data = {}) {
    console.error(this._formatLog('ERROR', message, data));
  }

  debug(message, data = {}) {
    if (process.env.DEBUG) {
      console.debug(this._formatLog('DEBUG', message, data));
    }
  }
}

export const logger = new StructuredLogger(process.env.LOG_LEVEL || 'info');

/**
 * Request logger middleware: adds request ID, measures latency, logs all requests
 */
export function requestLoggerMiddleware(req, res, next) {
  // Generate unique request ID for tracing
  req.id = crypto.randomUUID();

  // Capture request start time
  const startMs = Date.now();

  // Log request details
  logger.info('request_start', {
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || 'unknown'
  });

  // Hook into response finish to log completion
  res.on('finish', () => {
    const durationMs = Date.now() - startMs;
    const statusCode = res.statusCode;
    const isError = statusCode >= 400;

    logger.info('request_finish', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode,
      durationMs,
      ip: req.ip
    });

    // Log errors separately for easier filtering
    if (isError) {
      logger.warn('request_error_status', {
        requestId: req.id,
        method: req.method,
        path: req.path,
        statusCode,
        durationMs
      });
    }
  });

  next();
}

/**
 * Error handler: sanitizes errors, logs fully internally, returns minimal client response
 */
export function errorHandler(err, req, res, next) {
  const requestId = req?.id || 'unknown';
  const statusCode = err.statusCode || 500;

  // Log full error internally for debugging
  logger.error('unhandled_error', {
    requestId,
    message: err.message,
    stack: err.stack,
    category: err.category || 'UNKNOWN',
    details: err.details || {}
  });

  // Return minimal, safe response to client (no error details)
  const clientMessage = getClientErrorMessage(err.category || 'UNKNOWN');
  return res.status(statusCode).json({
    error: clientMessage,
    requestId // For support ticket lookup
  });
}

/**
 * Map error categories to safe client messages (no sensitive details)
 */
function getClientErrorMessage(category) {
  const messages = {
    'AUTH': 'Authentication failed. Please reconnect your Spotify account.',
    'SPOTIFY_API': 'Could not connect to Spotify. Please try again.',
    'VALIDATION': 'Invalid request. Please check your input.',
    'RATE_LIMIT': 'Too many requests. Please wait before retrying.',
    'CIRCUIT_OPEN': 'Service temporarily unavailable. Please try again in a moment.',
    'TIMEOUT': 'Request timed out. Please try again.',
    'UNKNOWN': 'An error occurred. Please try again.'
  };
  return messages[category] || messages['UNKNOWN'];
}

export class ApiError extends Error {
  constructor(statusCode, category, message, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.category = category;
    this.details = details;
  }
}
