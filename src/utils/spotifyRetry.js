import { logger } from "../middleware/requestLogger.js";

/**
 * Exponential backoff with full jitter for Spotify API calls.
 * Handles transient errors: 429, 503, 504, timeouts, network errors.
 *
 * Strategy:
 * - 429 (rate limit): retry with backoff
 * - 503/504 (service unavailable): retry with backoff
 * - Timeout/network errors: retry with backoff
 * - 4xx (client errors): fail immediately
 *
 * Backoff formula: exponentialMs = baseDelayMs * 2^attempt
 *                 jitter = random(0, exponentialMs)
 *                 totalDelay = exponentialMs + jitter
 *
 * Example: baseDelayMs=100, maxRetries=3
 *   Attempt 0 failed → wait 100-200ms → retry
 *   Attempt 1 failed → wait 200-400ms → retry
 *   Attempt 2 failed → wait 400-800ms → retry
 *   Attempt 3 failed → throw
 */

const RETRYABLE_STATUS_CODES = new Set([429, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH']);

function isRetryableError(error) {
  if (RETRYABLE_STATUS_CODES.has(error.statusCode)) {
    return true;
  }

  if (error.code && RETRYABLE_ERROR_CODES.has(error.code)) {
    return true;
  }

  // AbortError from fetch timeout
  if (error.name === 'AbortError') {
    return true;
  }

  return false;
}

export async function withExponentialBackoff(
  fn,
  maxRetries = 3,
  baseDelayMs = 100,
  requestId = 'unknown'
) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRetryable = isRetryableError(error);

      if (!isRetryable || attempt === maxRetries) {
        // Don't retry or last attempt — throw immediately
        throw error;
      }

      // Calculate exponential backoff with full jitter
      const exponentialMs = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * exponentialMs;
      const delayMs = exponentialMs + jitter;

      logger.debug(
        `Retrying Spotify API after transient error (attempt ${attempt + 1}/${maxRetries})`,
        {
          requestId,
          attempt: attempt + 1,
          maxRetries,
          statusCode: error.statusCode,
          errorCode: error.code,
          errorName: error.name,
          delayMs: Math.round(delayMs),
        }
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Get retry configuration by error type.
 * Some errors should be retried more aggressively than others.
 */
export function getRetryConfig(error) {
  if (error.statusCode === 429) {
    // Rate limit — higher backoff to respect Spotify's limits
    return { maxRetries: 5, baseDelayMs: 500 };
  }

  if (error.statusCode === 503 || error.statusCode === 504) {
    // Service unavailable — standard backoff
    return { maxRetries: 3, baseDelayMs: 100 };
  }

  if (error.name === 'AbortError' || error.code === 'ETIMEDOUT') {
    // Timeout — retry a few times
    return { maxRetries: 2, baseDelayMs: 100 };
  }

  // Default for other network errors
  return { maxRetries: 3, baseDelayMs: 100 };
}
