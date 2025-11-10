/**
 * Retry utility with exponential backoff
 * Used for handling rate limits and transient failures
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  onRetry: () => {},
};

/**
 * Execute a function with exponential backoff retry logic
 *
 * @example
 * ```typescript
 * const data = await retryWithBackoff(
 *   async () => {
 *     const { data, error } = await supabase.from('catches').select();
 *     if (error) throw error;
 *     return data;
 *   },
 *   { maxRetries: 3 }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on last attempt
      if (attempt === opts.maxRetries) {
        break;
      }

      // Check if error is retryable
      if (!isRetryableError(error)) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.baseDelay * Math.pow(2, attempt),
        opts.maxDelay
      );

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * delay;
      const totalDelay = delay + jitter;

      opts.onRetry(attempt + 1, lastError);

      await sleep(totalDelay);
    }
  }

  throw lastError || new Error("Retry failed with unknown error");
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  // Network errors are retryable
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return true;
  }

  // Check for rate limit errors
  if (error && typeof error === "object") {
    const err = error as { status?: number; code?: string; message?: string };

    // HTTP 429 (Too Many Requests)
    if (err.status === 429) {
      return true;
    }

    // HTTP 5xx (Server errors)
    if (err.status && err.status >= 500 && err.status < 600) {
      return true;
    }

    // Supabase rate limit error codes
    if (err.code === "PGRST301" || err.code === "PGRST302") {
      return true;
    }

    // Network timeout
    if (err.message?.includes("timeout")) {
      return true;
    }
  }

  return false;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry wrapper specifically for Supabase queries
 *
 * @example
 * ```typescript
 * const { data, error } = await retrySupabaseQuery(
 *   () => supabase.from('catches').select()
 * );
 * ```
 */
export async function retrySupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: Error | null }>,
  options: RetryOptions = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const result = await retryWithBackoff(async () => {
      const { data, error } = await queryFn();
      if (error) {
        throw error;
      }
      return data;
    }, options);

    return { data: result, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
