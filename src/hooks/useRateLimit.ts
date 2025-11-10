import { useRef, useCallback } from "react";

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

interface RequestTimestamp {
  timestamp: number;
}

/**
 * Client-side rate limiting hook
 *
 * Prevents excessive API calls by limiting requests within a time window.
 *
 * @example
 * ```typescript
 * const { checkRateLimit, getRemainingRequests } = useRateLimit({
 *   maxRequests: 10,
 *   windowMs: 60000 // 10 requests per minute
 * });
 *
 * const handleSearch = async () => {
 *   if (!checkRateLimit()) {
 *     toast.error('Too many requests. Please wait.');
 *     return;
 *   }
 *   // Make API call
 * };
 * ```
 */
export function useRateLimit(options: RateLimitOptions) {
  const { maxRequests, windowMs } = options;
  const requestsRef = useRef<RequestTimestamp[]>([]);

  /**
   * Check if a request is allowed under the rate limit
   * @returns true if request is allowed, false if rate limited
   */
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Remove expired timestamps
    requestsRef.current = requestsRef.current.filter(
      (req) => req.timestamp > windowStart
    );

    // Check if under limit
    if (requestsRef.current.length >= maxRequests) {
      return false;
    }

    // Add new timestamp
    requestsRef.current.push({ timestamp: now });
    return true;
  }, [maxRequests, windowMs]);

  /**
   * Get the number of requests remaining in the current window
   */
  const getRemainingRequests = useCallback((): number => {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Remove expired timestamps
    requestsRef.current = requestsRef.current.filter(
      (req) => req.timestamp > windowStart
    );

    return Math.max(0, maxRequests - requestsRef.current.length);
  }, [maxRequests, windowMs]);

  /**
   * Get time until the rate limit resets (in milliseconds)
   */
  const getTimeUntilReset = useCallback((): number => {
    if (requestsRef.current.length === 0) {
      return 0;
    }

    const oldestRequest = requestsRef.current[0];
    const resetTime = oldestRequest.timestamp + windowMs;
    const now = Date.now();

    return Math.max(0, resetTime - now);
  }, [windowMs]);

  /**
   * Reset the rate limit (useful for testing or manual resets)
   */
  const reset = useCallback(() => {
    requestsRef.current = [];
  }, []);

  return {
    checkRateLimit,
    getRemainingRequests,
    getTimeUntilReset,
    reset,
  };
}

/**
 * Preset rate limit configurations
 */
export const RATE_LIMIT_PRESETS = {
  /** Very strict: 5 requests per minute */
  strict: {
    maxRequests: 5,
    windowMs: 60000,
  },
  /** Standard: 10 requests per minute */
  standard: {
    maxRequests: 10,
    windowMs: 60000,
  },
  /** Lenient: 30 requests per minute */
  lenient: {
    maxRequests: 30,
    windowMs: 60000,
  },
  /** Search: 20 requests per minute (for search/autocomplete) */
  search: {
    maxRequests: 20,
    windowMs: 60000,
  },
  /** Auth: 5 attempts per 5 minutes (for login/signup) */
  auth: {
    maxRequests: 5,
    windowMs: 300000,
  },
  /** Upload: 5 uploads per hour */
  upload: {
    maxRequests: 5,
    windowMs: 3600000,
  },
} as const;
