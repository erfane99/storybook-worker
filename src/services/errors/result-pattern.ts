// Result pattern implementation for error handling
// Provides type-safe error handling without exceptions

import { BaseServiceError, ServiceError } from './error-types.js';

// ===== RESULT TYPE DEFINITIONS =====

export type Result<T, E extends BaseServiceError = ServiceError> = Success<T> | Failure<E>;

export interface Success<T> {
  readonly success: true;
  readonly data: T;
  readonly error?: never;
}

export interface Failure<E extends BaseServiceError> {
  readonly success: false;
  readonly data?: never;
  readonly error: E;
}

// ===== RESULT CONSTRUCTORS =====

export const Result = {
  /**
   * Create a successful result
   */
  success: <T>(data: T): Success<T> => ({
    success: true,
    data,
  }),

  /**
   * Create a failure result
   */
  failure: <E extends BaseServiceError>(error: E): Failure<E> => ({
    success: false,
    error,
  }),

  /**
   * Wrap a function that might throw into a Result
   */
  from: <T, E extends BaseServiceError = ServiceError>(
    fn: () => T,
    errorContext?: { service?: string; operation?: string; correlationId?: string }
  ): Result<T, E> => {
    try {
      const data = fn();
      return Result.success(data);
    } catch (error) {
      const serviceError = ErrorFactory.fromUnknown(error, errorContext || {}) as E;
      return Result.failure(serviceError);
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
      return Result.success(data);
    } catch (error) {
      const serviceError = ErrorFactory.fromUnknown(error, errorContext || {}) as E;
      return Result.failure(serviceError);
    }
  },

  /**
   * Combine multiple results into one
   */
  combine: <T extends readonly unknown[], E extends BaseServiceError>(
    results: { [K in keyof T]: Result<T[K], E> }
  ): Result<T, E> => {
    const data: any[] = [];
    
    for (const result of results) {
      if (!result.success) {
        return result;
      }
      data.push(result.data);
    }
    
    return Result.success(data as T);
  },

  /**
   * Execute multiple async operations and combine results
   */
  combineAsync: async <T extends readonly unknown[], E extends BaseServiceError>(
    operations: { [K in keyof T]: () => Promise<Result<T[K], E>> }
  ): Promise<Result<T, E>> => {
    const results = await Promise.all(operations.map(op => op()));
    return Result.combine(results);
  },
};

// Import ErrorFactory for use in Result.from methods
import { ErrorFactory } from './error-types.js';

// ===== RESULT UTILITY METHODS =====

declare module './result-pattern' {
  interface Success<T> {
    /**
     * Transform the success value
     */
    map<U>(fn: (data: T) => U): Result<U, never>;
    
    /**
     * Chain another operation that returns a Result
     */
    flatMap<U, E extends BaseServiceError>(fn: (data: T) => Result<U, E>): Result<U, E>;
    
    /**
     * Execute a side effect if successful
     */
    tap(fn: (data: T) => void): Success<T>;
    
    /**
     * Get the value or throw the error
     */
    unwrap(): T;
    
    /**
     * Get the value or return a default
     */
    unwrapOr(defaultValue: T): T;
    
    /**
     * Check if result is success
     */
    isSuccess(): this is Success<T>;
    
    /**
     * Check if result is failure
     */
    isFailure(): this is never;
  }

  interface Failure<E extends BaseServiceError> {
    /**
     * Transform the success value (no-op for failures)
     */
    map<U>(fn: (data: never) => U): Failure<E>;
    
    /**
     * Chain another operation (no-op for failures)
     */
    flatMap<U, E2 extends BaseServiceError>(fn: (data: never) => Result<U, E2>): Failure<E>;
    
    /**
     * Execute a side effect if successful (no-op for failures)
     */
    tap(fn: (data: never) => void): Failure<E>;
    
    /**
     * Get the value or throw the error
     */
    unwrap(): never;
    
    /**
     * Get the value or return a default
     */
    unwrapOr<T>(defaultValue: T): T;
    
    /**
     * Check if result is success
     */
    isSuccess(): this is never;
    
    /**
     * Check if result is failure
     */
    isFailure(): this is Failure<E>;
    
    /**
     * Transform the error
     */
    mapError<E2 extends BaseServiceError>(fn: (error: E) => E2): Failure<E2>;
    
    /**
     * Execute a side effect on error
     */
    tapError(fn: (error: E) => void): Failure<E>;
  }
}

// ===== RESULT PROTOTYPE EXTENSIONS =====

// Success methods
Object.defineProperty(Object.prototype, 'map', {
  value: function<T, U>(this: Success<T>, fn: (data: T) => U): Result<U, never> {
    if (this.success) {
      try {
        return Result.success(fn(this.data));
      } catch (error) {
        return Result.failure(ErrorFactory.fromUnknown(error) as never);
      }
    }
    return this as any;
  },
  enumerable: false,
  configurable: true,
});

Object.defineProperty(Object.prototype, 'flatMap', {
  value: function<T, U, E extends BaseServiceError>(
    this: Result<T, E>, 
    fn: (data: T) => Result<U, E>
  ): Result<U, E> {
    if (this.success) {
      try {
        return fn(this.data);
      } catch (error) {
        return Result.failure(ErrorFactory.fromUnknown(error) as E);
      }
    }
    return this as any;
  },
  enumerable: false,
  configurable: true,
});

Object.defineProperty(Object.prototype, 'tap', {
  value: function<T>(this: Result<T, any>, fn: (data: T) => void): Result<T, any> {
    if (this.success) {
      try {
        fn(this.data);
      } catch (error) {
        // Ignore errors in tap
        console.warn('Error in tap function:', error);
      }
    }
    return this;
  },
  enumerable: false,
  configurable: true,
});

Object.defineProperty(Object.prototype, 'unwrap', {
  value: function<T>(this: Result<T, any>): T {
    if (this.success) {
      return this.data;
    }
    throw this.error;
  },
  enumerable: false,
  configurable: true,
});

Object.defineProperty(Object.prototype, 'unwrapOr', {
  value: function<T>(this: Result<T, any>, defaultValue: T): T {
    if (this.success) {
      return this.data;
    }
    return defaultValue;
  },
  enumerable: false,
  configurable: true,
});

Object.defineProperty(Object.prototype, 'isSuccess', {
  value: function(this: Result<any, any>): boolean {
    return this.success;
  },
  enumerable: false,
  configurable: true,
});

Object.defineProperty(Object.prototype, 'isFailure', {
  value: function(this: Result<any, any>): boolean {
    return !this.success;
  },
  enumerable: false,
  configurable: true,
});

// Failure-specific methods
Object.defineProperty(Object.prototype, 'mapError', {
  value: function<E extends BaseServiceError, E2 extends BaseServiceError>(
    this: Failure<E>, 
    fn: (error: E) => E2
  ): Failure<E2> {
    if (!this.success) {
      try {
        return Result.failure(fn(this.error));
      } catch (error) {
        return Result.failure(ErrorFactory.fromUnknown(error) as E2);
      }
    }
    return this as any;
  },
  enumerable: false,
  configurable: true,
});

Object.defineProperty(Object.prototype, 'tapError', {
  value: function<E extends BaseServiceError>(
    this: Result<any, E>, 
    fn: (error: E) => void
  ): Result<any, E> {
    if (!this.success) {
      try {
        fn(this.error);
      } catch (error) {
        // Ignore errors in tapError
        console.warn('Error in tapError function:', error);
      }
    }
    return this;
  },
  enumerable: false,
  configurable: true,
});

// ===== ASYNC RESULT UTILITIES =====

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
        return Result.success(mapped);
      } catch (error) {
        return Result.failure(ErrorFactory.fromUnknown(error) as E);
      }
    }
    return result as any;
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
        return Result.failure(ErrorFactory.fromUnknown(error) as E2);
      }
    }
    return result as any;
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
        return Result.failure(mappedError);
      } catch (error) {
        return Result.failure(ErrorFactory.fromUnknown(error) as E2);
      }
    }
    return result as any;
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
   */
  async unwrapOr(defaultValue: T): Promise<T> {
    const result = await this.promise;
    return result.unwrapOr(defaultValue);
  }
}

// ===== ASYNC RESULT CONSTRUCTOR =====

export const AsyncResult = {
  /**
   * Create an AsyncResult from a Promise<Result>
   */
  from: <T, E extends BaseServiceError = ServiceError>(
    promise: Promise<Result<T, E>>
  ): AsyncResult<T, E> => {
    return new AsyncResult(promise);
  },

  /**
   * Create an AsyncResult from a function that returns a Promise
   */
  fromAsync: <T, E extends BaseServiceError = ServiceError>(
    fn: () => Promise<T>,
    errorContext?: { service?: string; operation?: string; correlationId?: string }
  ): AsyncResult<T, E> => {
    const promise = Result.fromAsync(fn, errorContext);
    return new AsyncResult(promise);
  },

  /**
   * Create a successful AsyncResult
   */
  success: <T>(data: T): AsyncResult<T, never> => {
    return new AsyncResult(Promise.resolve(Result.success(data)));
  },

  /**
   * Create a failed AsyncResult
   */
  failure: <E extends BaseServiceError>(error: E): AsyncResult<never, E> => {
    return new AsyncResult(Promise.resolve(Result.failure(error)));
  },
};