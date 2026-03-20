/**
 * Generic retry with exponential backoff.
 */
export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Called before each retry. Return false to abort. */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => boolean | void;
}

const DEFAULTS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 30000,
};

/**
 * Returns true if the error is retryable (transient network/API issues).
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Network errors
    if (msg.includes('fetch failed') || msg.includes('econnreset') ||
        msg.includes('econnrefused') || msg.includes('etimedout') ||
        msg.includes('socket hang up') || msg.includes('network') ||
        msg.includes('abort')) {
      return true;
    }
    // API rate limit / server errors
    if (msg.includes('429') || msg.includes('rate limit') ||
        msg.includes('quota') || msg.includes('resource exhausted') ||
        msg.includes('500') || msg.includes('502') || msg.includes('503') ||
        msg.includes('internal server error') || msg.includes('overloaded') ||
        msg.includes('unavailable') || msg.includes('deadline exceeded')) {
      return true;
    }
  }
  // Check for HTTP status in error objects
  const anyErr = error as any;
  if (anyErr?.status === 429 || anyErr?.status >= 500) return true;
  if (anyErr?.code === 'ECONNRESET' || anyErr?.code === 'ETIMEDOUT') return true;

  return false;
}

/**
 * Execute fn with retry + exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  opts?: Partial<RetryOptions>
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs, onRetry } = { ...DEFAULTS, ...opts };

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !isRetryable(error)) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        maxDelayMs,
        baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000
      );

      if (onRetry) {
        const shouldContinue = onRetry(attempt + 1, error, delay);
        if (shouldContinue === false) throw error;
      }

      console.warn(
        `[retry] ${label} — attempt ${attempt + 1}/${maxRetries} failed: ${error instanceof Error ? error.message : error}. Retrying in ${(delay / 1000).toFixed(1)}s...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
