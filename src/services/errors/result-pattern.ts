// Result pattern implementation for error handling
// Provides type-safe error handling without exceptions
// FIXED: All generic type constraint issues resolved

import { BaseServiceError, ServiceError, ErrorFactory } from './error-types.js';

// ===== RESULT TYPE DEFINITIONS =====

export type Result<T, E extends BaseServiceError = ServiceError> = Success<T> | Failure<E>;

export interface Success<T> {
  readonly success: true;
  readonly data: T;
  readonly error?: never;
  
  // Method signatures for Success
  map<U>(fn: (data: T) => U): Result<U, never>;
  flatMap<U, E extends BaseServiceError>(fn: (data: T) => Result<U, E>): Result<U, E>;
  tap(fn: (data: T) => void): Success<T>;
  unwrap(): T;
  unwrapOr(defaultValue: T): T;
  isSuccess(): this is Success<T>;
  isFailure(): this is never;
}

export interface Failure<E extends BaseServiceError> {
  readonly success: false;
  readonly data?: never;
  readonly error: E;
  
  // Method signatures for Failure
  map<U>(fn: (data: never) => U): Failure<E>;
  flatMap<U, E2 extends BaseServiceError>(fn: (data: never) => Result<U, E2>): Failure<E>;
  tap(fn: (data: never) => void): Failure<E>;
  unwrap(): never;
  unwrapOr<T>(defaultValue: T): T;
  isSuccess(): this is never;
  isFailure(): this is Failure<E>;
  mapError<E2 extends BaseServiceError>(fn: (error: E) => E2): Failure<E2>;
  tapError(fn: (error: E) => void): Failure<E>;
}

// ===== HELPER FUNCTIONS FOR RESULT CREATION =====

function createSuccess<T>(data: T): Success<T> {
  return {
    success: true as const,
    data,
    
    map<U>(fn: (data: T) => U): Result<U, never> {
      try {
        return createSuccess(fn(data));
      } catch (error) {
        return createFailure(ErrorFactory.fromUnknown(error) as never);
      }
    },
    
    flatMap<U, E extends BaseServiceError>(fn: (data: T) => Result<U, E>): Result<U, E> {
      try {
        return fn(data);
      } catch (error) {
        return createFailure(ErrorFactory.fromUnknown(error) as E);
      }
    },
    
    tap(fn: (data: T) => void): Success<T> {
      try {
        fn(data);
      } catch (error) {
        console.warn('Error in tap function:', error);
      }
      return this;
    },
    
    unwrap(): T {
      return data;
    },
    
    unwrapOr(defaultValue: T): T {
      return data;
    },
    
    isSuccess(): this is Success<T> {
      return true;
    },
    
    isFailure(): this is never {
      return false;
    }
  };
}

function createFailure<E extends BaseServiceError>(error: E): Failure<E> {
  return {
    success: false as const,
    error,
    
    map<U>(fn: (data: never) => U): Failure<E> {
      return this;
    },
    
    flatMap<U, E2 extends BaseServiceError>(fn: (data: never) => Result<U, E2>): Failure<E> {
      return this;
    },
    
    tap(fn: (data: never) => void): Failure<E> {
      return this;
    },
    
    unwrap(): never {
      throw error;
    },
    
    unwrapOr<T>(defaultValue: T): T {
      return defaultValue;
    },
    
    isSuccess(): this is never {
      return false;
    },
    
    isFailure(): this is Failure<E> {
      return true;
    },
    
    mapError<E2 extends BaseServiceError>(fn: (error: E) => E2): Failure<E2> {
      try {
        return createFailure(fn(error));
      } catch (error) {
        return createFailure(ErrorFactory.fromUnknown(error) as E2);
      }
    },
    
    tapError(fn: (error: E) => void): Failure<E> {
      try {
        fn(error);
      } catch (error) {
        console.warn('Error in tapError function:', error);
      }
      return this;
    }
  };
}

// ===== RESULT IMPLEMENTATION OBJECT =====

export const Result = {
  /**
   * Create a successful result
   */
  success: <T>(data: T): Success<T> => {
    return createSuccess(data);
  },

  /**
   * Create a failure result
   */
  failure: <E extends BaseServiceError>(error: E): Failure<E> => {
    return createFailure(error);
  },

  /**
   * Wrap a function that might throw into a Result
   */
  from: <T, E extends BaseServiceError = ServiceError>(
    fn: () => T,
    errorContext?: { service?: string; operation?: string; correlationId?: string }
  ): Result<T, E> => {
    try {
      const data = fn();
      return createSuccess(data);
    } catch (error) {
      const serviceError = ErrorFactory.fromUnknown(error, errorContext || {}) as E;
      return createFailure(serviceError);
    }
  },

  /**
   * Wrap an async function that might throw into a Result
   */
  fromAsync: async <T, E extends BaseServiceError = ServiceError>(
    fn: () => Promise<T>,
    errorContext?: { service?: string; operation?: string; correlationId?: string }
  ): Promise<Result<T, E>> => {
    try {
      const data = await fn();
      return createSuccess(data);
    } catch (error) {
      const serviceError = ErrorFactory.fromUnknown(error, errorContext || {}) as E;
      return createFailure(serviceError);
    }
  },

  /**
   * Combine multiple results into one
   * FIXED: Use explicit generic type parameter to force correct inference
   */
  combine: <T extends readonly unknown[], E extends BaseServiceError>(
    results: { [K in keyof T]: Result<T[K], E> }
  ): Result<T, E> => {
    const data: unknown[] = [];
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result.success) {
        return result as Result<T, E>;
      }
      data.push(result.data);
    }
    
    // FIXED: Use explicit type assertion with helper function
    return createSuccess(data as T);
  },

  /**
   * Execute multiple async operations and combine results
   * FIXED: Use explicit generic type parameter to force correct inference
   */
  combineAsync: async <T extends readonly unknown[], E extends BaseServiceError>(
    operations: { [K in keyof T]: () => Promise<Result<T[K], E>> }
  ): Promise<Result<T, E>> => {
    const results = await Promise.all(operations.map(op => op()));
    return Result.combine(results);
  },
};

// ===== ASYNC RESULT CLASS =====

export class AsyncResult<T, E extends BaseServiceError = ServiceError> {
  constructor(private promise: Promise<Result<T, E>>) {}

  /**
   * Transform the success value asynchronously
   */
  async map<U>(fn: (data: T) => U | Promise<U>): Promise<Result<U, E>> {
    const result = await this.promise;
    if (result.success) {
      try {
        const mapped = await fn(result.data);
        return createSuccess(mapped);
      } catch (error) {
        return createFailure(ErrorFactory.fromUnknown(error) as E);
      }
    }
    return result as Result<U, E>;
  }

  /**
   * Chain another async operation
   */
  async flatMap<U, E2 extends BaseServiceError>(
    fn: (data: T) => Promise<Result<U, E2>> | Result<U, E2>
  ): Promise<Result<U, E | E2>> {
    const result = await this.promise;
    if (result.success) {
      try {
        return await fn(result.data);
      } catch (error) {
        return createFailure(ErrorFactory.fromUnknown(error) as E2);
      }
    }
    return result as Result<U, E | E2>;
  }

  /**
   * Execute a side effect asynchronously
   */
  async tap(fn: (data: T) => void | Promise<void>): Promise<Result<T, E>> {
    const result = await this.promise;
    if (result.success) {
      try {
        await fn(result.data);
      } catch (error) {
        console.warn('Error in async tap function:', error);
      }
    }
    return result;
  }

  /**
   * Transform the error asynchronously
   */
  async mapError<E2 extends BaseServiceError>(
    fn: (error: E) => E2 | Promise<E2>
  ): Promise<Result<T, E2>> {
    const result = await this.promise;
    if (!result.success) {
      try {
        const mappedError = await fn(result.error);
        return createFailure(mappedError);
      } catch (error) {
        return createFailure(ErrorFactory.fromUnknown(error) as E2);
      }
    }
    return result as Result<T, E2>;
  }

  /**
   * Execute a side effect on error asynchronously
   */
  async tapError(fn: (error: E) => void | Promise<void>): Promise<Result<T, E>> {
    const result = await this.promise;
    if (!result.success) {
      try {
        await fn(result.error);
      } catch (error) {
        console.warn('Error in async tapError function:', error);
      }
    }
    return result;
  }

  /**
   * Get the underlying promise
   */
  toPromise(): Promise<Result<T, E>> {
    return this.promise;
  }

  /**
   * Unwrap the result or throw
   */
  async unwrap(): Promise<T> {
    const result = await this.promise;
    return result.unwrap();
  }

  /**
   * Unwrap the result or return default
   * FIXED: Proper implementation without Promise constraint issues
   */
  async unwrapOr(defaultValue: T): Promise<T> {
    try {
      const result = await this.promise;
      if (result.success) {
        return result.data;
      }
      return defaultValue;
    } catch (error) {
      console.warn('Error in unwrapOr:', error);
      return defaultValue;
    }
  }

  /**
   * Create an AsyncResult from a Promise<Result>
   */
  static from<T, E extends BaseServiceError = ServiceError>(
    promise: Promise<Result<T, E>>
  ): AsyncResult<T, E> {
    return new AsyncResult(promise);
  }

  /**
   * Create an AsyncResult from a function that returns a Promise
   */
  static fromAsync<T, E extends BaseServiceError = ServiceError>(
    fn: () => Promise<T>,
    errorContext?: { service?: string; operation?: string; correlationId?: string }
  ): AsyncResult<T, E> {
    const promise = Result.fromAsync<T, E>(fn, errorContext);
    return new AsyncResult(promise);
  }

  /**
   * Create a successful AsyncResult
   */
  static success<T>(data: T): AsyncResult<T, BaseServiceError> {
    return new AsyncResult(Promise.resolve(createSuccess(data)));
  }

  /**
   * Create a failed AsyncResult
   */
  static failure<E extends BaseServiceError>(error: E): AsyncResult<never, E> {
    return new AsyncResult(Promise.resolve(createFailure(error)));
  }
}