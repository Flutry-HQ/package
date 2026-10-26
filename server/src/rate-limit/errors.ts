/** Throwing stops an awaited route handler through Fastify's existing error pipeline. */
export class RateLimitExceededError extends Error {
  public readonly statusCode = 429;
  public readonly code = 'FLUTRY_RATE_LIMIT_EXCEEDED';

  constructor(public readonly retryAfter: number) {
    super('Too Many Requests');
    this.name = 'RateLimitExceededError';
  }
}

/** Storage failures are fail-closed and never reveal backend details in the HTTP message. */
export class RateLimitUnavailableError extends Error {
  public readonly statusCode = 503;
  public readonly code = 'FLUTRY_RATE_LIMIT_UNAVAILABLE';

  constructor(public readonly cause?: unknown) {
    super('Rate limiting is temporarily unavailable');
    this.name = 'RateLimitUnavailableError';
  }
}
