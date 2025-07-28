// Comprehensive error handling exports
// Central export point for all error handling functionality
// CONSOLIDATED: Updated to use consolidated service contracts

// ===== VALUE IMPORTS (for runtime use) =====
import { 
  ErrorCategory,
  ErrorSeverity,
  ErrorFactory,
  BaseServiceError,
  DatabaseConnectionError,
  DatabaseQueryError,
  DatabaseTimeoutError,
  DatabaseTransactionError,
  JobNotFoundError,
  AIServiceUnavailableError,
  AIRateLimitError,
  AIContentPolicyError,
  AITimeoutError,
  AIAuthenticationError,
  StorageUploadError,
  StorageQuotaExceededError,
  StorageFileNotFoundError,
  StorageConfigurationError,
  JobValidationError,
  JobProcessingError,
  JobTimeoutError,
  JobConcurrencyLimitError,
  AuthenticationError,
  AuthorizationError,
  TokenValidationError,
  ConfigurationError,
  EnvironmentVariableError,
  ServiceNotRegisteredError,
  ServiceInitializationError,
  CircularDependencyError,
  ContainerDisposedError,
  CircuitBreakerOpenError,
  SystemError,
  UnknownError
} from './error-types.js';

import { 
  Result,
  AsyncResult
} from './result-pattern.js';

import {
  ErrorCorrelationManager,
  errorCorrelationManager,
  withCorrelation,
  withCorrelationResult,
  createJobCorrelationContext,
  createServiceCorrelationContext,
  trackError,
  getCorrelationStatistics,
} from './error-correlation.js';

import {
  CentralizedErrorHandler,
  centralizedErrorHandler,
  handleError,
  withErrorHandling,
  withRetry,
  createServiceErrorHandler,
} from './error-handler.js';

import {
  ErrorAwareBaseService,
} from '../base/error-aware-base-service.js';

// ===== TYPE-ONLY EXPORTS =====
export type {
  StructuredError,
  ServiceError,
  BaseServiceError,
  ValidationError,
  NetworkError,
  DatabaseError,
  ExternalServiceError,
  BusinessLogicError,
  ContainerError,
  InvalidTokenError,
  ServiceLifecycleError,
  ErrorContext
} from './error-types.js';

export type {
  Success,
  Failure
} from './result-pattern.js';

export type {
  CorrelationContext,
  ErrorCorrelation,
} from './error-correlation.js';

export type {
  ErrorHandlerConfig,
  ErrorHandlerMetrics,
} from './error-handler.js';

// CONSOLIDATED: Updated to use consolidated service contracts
export type {
  IEnhancedServiceHealth,
  IEnhancedServiceMetrics,
  ErrorAwareServiceConfig,
} from '../base/error-aware-base-service.js';

// ===== VALUE EXPORTS =====

export { 
  ErrorCategory,
  ErrorSeverity
};

export {
  ErrorFactory,
  BaseServiceError,
  // Database Errors
  DatabaseConnectionError,
  DatabaseQueryError,
  DatabaseTimeoutError,
  DatabaseTransactionError,
  JobNotFoundError,
  
  // AI Service Errors
  AIServiceUnavailableError,
  AIRateLimitError,
  AIContentPolicyError,
  AITimeoutError,
  AIAuthenticationError,
  
  // Storage Service Errors
  StorageUploadError,
  StorageQuotaExceededError,
  StorageFileNotFoundError,
  StorageConfigurationError,
  
  // Job Service Errors
  JobValidationError,
  JobProcessingError,
  JobTimeoutError,
  JobConcurrencyLimitError,
  
  // Auth Service Errors
  AuthenticationError,
  AuthorizationError,
  TokenValidationError,
  
  // Configuration Errors
  ConfigurationError,
  EnvironmentVariableError,
  
  // Container Errors
  ServiceNotRegisteredError,
  ServiceInitializationError,
  CircularDependencyError,
  ContainerDisposedError,
  
  // System Errors
  CircuitBreakerOpenError,
  SystemError,
  UnknownError,
};

export {
  Result,
  AsyncResult,
};

export {
  ErrorCorrelationManager,
  errorCorrelationManager,
  withCorrelation,
  withCorrelationResult,
  createJobCorrelationContext,
  createServiceCorrelationContext,
  trackError,
  getCorrelationStatistics,
};

export {
  CentralizedErrorHandler,
  centralizedErrorHandler,
  handleError,
  withErrorHandling,
  withRetry,
  createServiceErrorHandler,
};

export {
  ErrorAwareBaseService,
};

// ===== UTILITY FUNCTIONS =====
// FIXED: Use static imports instead of require() for proper type narrowing

/**
 * Create a standardized error for service operations
 */
export function createServiceError(
  type: 'database' | 'ai' | 'storage' | 'job' | 'auth' | 'container',
  subtype: string,
  message: string,
  context?: {
    service?: string;
    operation?: string;
    correlationId?: string;
    metadata?: Record<string, any>;
  }
): import('./error-types.js').ServiceError {
  const factory = ErrorFactory[type as keyof typeof ErrorFactory];
  if (typeof factory === 'object' && subtype in factory) {
    return (factory as any)[subtype](message, context);
  }
  
  return ErrorFactory.fromUnknown(new Error(message), context || {});
}

/**
 * Check if an error is retryable
 * FIXED: Use static import for proper type narrowing
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof BaseServiceError) {
    return error.shouldRetry();
  }
  return false;
}

/**
 * Get error severity level
 * FIXED: Use static import for proper type narrowing
 */
export function getErrorSeverityLevel(error: unknown): number {
  if (error instanceof BaseServiceError) {
    const levels = { 
      [ErrorSeverity.LOW]: 1, 
      [ErrorSeverity.MEDIUM]: 2, 
      [ErrorSeverity.HIGH]: 3, 
      [ErrorSeverity.CRITICAL]: 4 
    };
    return levels[error.severity] || 0;
  }
  return 0;
}

/**
 * Convert any error to a structured format
 * FIXED: Use static import for proper type narrowing
 */
export function toStructuredError(error: unknown): import('./error-types.js').StructuredError {
  if (error instanceof BaseServiceError) {
    return error.toStructured();
  }
  
  const serviceError = ErrorFactory.fromUnknown(error);
  return serviceError.toStructured();
}

/**
 * Create a Result from a potentially throwing operation
 */
export function safeExecute<T>(
  operation: () => T,
  errorContext?: {
    service?: string;
    operation?: string;
    correlationId?: string;
  }
): Result<T, import('./error-types.js').ServiceError> {
  return Result.from(operation, errorContext);
}

/**
 * Create an AsyncResult from a potentially throwing async operation
 */
export function safeExecuteAsync<T>(
  operation: () => Promise<T>,
  errorContext?: {
    service?: string;
    operation?: string;
    correlationId?: string;
  }
): AsyncResult<T, import('./error-types.js').ServiceError> {
  return AsyncResult.fromAsync(operation, errorContext);
}

// ===== ERROR HANDLING BEST PRACTICES =====

export const ERROR_HANDLING_BEST_PRACTICES = {
  useResultPattern: `
    // ✅ Good
    async function getUser(id: string): Promise<Result<User, DatabaseError>> {
      return this.withErrorHandling(
        () => this.database.findUser(id),
        'getUser'
      );
    }
    
    // ❌ Bad
    async function getUser(id: string): Promise<User> {
      return this.database.findUser(id); // Can throw
    }
  `,
  
  useCorrelation: `
    // ✅ Good
    @withCorrelationResult('user-service', 'createUser')
    async function createUser(userData: UserData): Promise<Result<User, ServiceError>> {
      // Errors will be automatically correlated
      return this.withErrorHandling(
        () => this.processUserCreation(userData),
        'createUser'
      );
    }
  `,
  
  handleAtRightLevel: `
    // ✅ Good - Handle at service boundary
    class UserController {
      async createUser(req: Request, res: Response) {
        const result = await this.userService.createUser(req.body);
        
        if (result.success) {
          res.json(result.data);
        } else {
          // Convert service error to HTTP response
          res.status(this.getHttpStatus(result.error)).json({
            error: result.error.message,
            correlationId: result.error.correlationId
          });
        }
      }
    }
  `,
  
  useSpecificErrors: `
    // ✅ Good
    if (result.error instanceof DatabaseConnectionError) {
      // Retry logic
    } else if (result.error instanceof ValidationError) {
      // Don't retry, return to user
    }
    
    // ❌ Bad
    if (result.error.message.includes('connection')) {
      // Fragile string matching
    }
  `,
} as const;