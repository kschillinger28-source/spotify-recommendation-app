import { logger } from "../middleware/requestLogger.js";
import { ApiError } from "../middleware/requestLogger.js";

/**
 * Circuit Breaker pattern for Spotify API.
 *
 * States:
 * - CLOSED: Normal operation. Requests pass through.
 * - OPEN: Too many errors detected. Requests fail fast with fallback response.
 * - HALF_OPEN: Testing recovery. Next request attempts to restore service.
 *
 * Triggering:
 * If error rate > 50% in the last 5 seconds (with 10+ requests), trip OPEN.
 *
 * Recovery:
 * After 30 seconds in OPEN state, transition to HALF_OPEN to test recovery.
 * If HALF_OPEN request succeeds, return to CLOSED. If fails, return to OPEN.
 *
 * Metrics:
 * - Prevents cascading failures when Spotify API is down
 * - Returns fast (no hanging requests) when circuit is OPEN
 * - Provides visibility into API health via getState()
 */

class CircuitBreaker {
  constructor(config = {}) {
    // Configuration
    this.errorThreshold = config.errorThreshold ?? 0.5; // Trip if > 50% errors
    this.windowMs = config.windowMs ?? 5000; // Error window: 5 seconds
    this.halfOpenTimeoutMs = config.halfOpenTimeoutMs ?? 30000; // Wait 30s before half-open
    this.minRequests = config.minRequests ?? 10; // Need 10 requests before considering trip

    // State
    this.state = 'CLOSED'; // CLOSED | OPEN | HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.windowStartAt = Date.now();
    this.lastTrippedAt = null;
    this.lastHalfOpenAttemptAt = null;
  }

  recordSuccess() {
    this.successCount += 1;
    this._checkAndTransition();
  }

  recordFailure() {
    this.failureCount += 1;
    this._checkAndTransition();
  }

  _checkAndTransition() {
    const now = Date.now();

    // Reset window every windowMs
    if (now - this.windowStartAt > this.windowMs) {
      this.failureCount = 0;
      this.successCount = 0;
      this.windowStartAt = now;
    }

    const totalRequests = this.failureCount + this.successCount;

    // Not enough data yet
    if (totalRequests < this.minRequests) {
      return;
    }

    const errorRate = this.failureCount / totalRequests;

    // Transition: CLOSED → OPEN
    if (this.state === 'CLOSED' && errorRate > this.errorThreshold) {
      this._trip();
      return;
    }

    // Transition: OPEN → HALF_OPEN
    if (
      this.state === 'OPEN' &&
      now - this.lastTrippedAt > this.halfOpenTimeoutMs
    ) {
      this._halfOpen();
      return;
    }

    // Transition: HALF_OPEN → CLOSED (if last request succeeded)
    if (
      this.state === 'HALF_OPEN' &&
      this.lastHalfOpenAttemptAt &&
      this.successCount > 0
    ) {
      this._close();
      return;
    }

    // Transition: HALF_OPEN → OPEN (if last request failed)
    if (
      this.state === 'HALF_OPEN' &&
      this.lastHalfOpenAttemptAt &&
      this.failureCount > 0
    ) {
      this._trip();
      return;
    }
  }

  _trip() {
    this.state = 'OPEN';
    this.lastTrippedAt = Date.now();

    logger.warn('circuit_breaker_tripped', {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      errorRate: (this.failureCount / (this.failureCount + this.successCount)).toFixed(2),
      message: 'Spotify API error rate exceeded threshold. Circuit opened.',
    });
  }

  _halfOpen() {
    this.state = 'HALF_OPEN';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastHalfOpenAttemptAt = Date.now();

    logger.info('circuit_breaker_half_open', {
      state: this.state,
      message: 'Testing Spotify API recovery.',
    });
  }

  _close() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;

    logger.info('circuit_breaker_closed', {
      state: this.state,
      message: 'Spotify API recovered. Circuit closed.',
    });
  }

  canMakeRequest() {
    // CLOSED and HALF_OPEN allow requests; OPEN rejects
    return this.state !== 'OPEN';
  }

  getState() {
    const totalRequests = this.failureCount + this.successCount;
    const errorRate = totalRequests > 0 ? this.failureCount / totalRequests : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests,
      errorRate: parseFloat(errorRate.toFixed(2)),
      config: {
        errorThreshold: this.errorThreshold,
        windowMs: this.windowMs,
        halfOpenTimeoutMs: this.halfOpenTimeoutMs,
        minRequests: this.minRequests,
      },
    };
  }
}

export default CircuitBreaker;
