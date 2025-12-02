/**
 * Custom API error class with structured error information
 * Provides better error handling and debugging capabilities
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Create ApiError from API response error
   * Handles various error formats from openapi-fetch
   */
  static fromResponse(error: unknown, fallbackMessage: string): ApiError {
    if (typeof error === 'object' && error !== null) {
      const err = error as Record<string, unknown>;
      return new ApiError(
        (err.message as string) ?? fallbackMessage,
        err.statusCode as number,
        err.code as string,
        err.details,
      );
    }
    return new ApiError(fallbackMessage);
  }

  /**
   * Check if error is an ApiError instance
   */
  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
  }
}
