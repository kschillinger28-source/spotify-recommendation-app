import http from 'http';
import https from 'https';

/**
 * HTTP/HTTPS agents with connection pooling and keepalive
 * Reuses TCP connections instead of opening/closing per request
 * Target: ~30% latency reduction by amortizing connection overhead
 */

export const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000, // Keep sockets alive for 30s
  maxSockets: 50,        // Max concurrent connections
  maxFreeSockets: 10,    // Max idle sockets to keep in pool
  timeout: 8000          // 8s socket timeout
});

export const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 8000
});

/**
 * Get appropriate agent for a URL
 */
export function getAgent(url) {
  if (typeof url === 'string' && url.startsWith('https')) {
    return httpsAgent;
  }
  return httpAgent;
}

/**
 * Graceful shutdown: drain pooled sockets
 */
export function closeAgents() {
  httpAgent.destroy();
  httpsAgent.destroy();
}
