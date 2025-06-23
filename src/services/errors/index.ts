// Comprehensive error handling exports
// Central export point for all error handling functionality

// ===== ERROR TYPES =====
export {
  BaseServiceError,
  ErrorCategory,
  ErrorSeverity,
  StructuredError,
  ServiceError,
  ErrorFactory,
  
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
} from './error-types.js';

// ===== RESULT PATTERN =====
export {
  Result,
  Success,
  Failure,
  AsyncResult,
} from './result-pattern.js';

// ===== ERROR CORRELATION =====
export {
  CorrelationContext,
  ErrorCorrelation,
  ErrorCorrelationManager,
  errorCorrelationManager,
  withCorrelation,
  withCorrelationResult,
  createJobCorrelationContext,
  createServiceCorrelationContext,
  trackError,
  getCorrelationStatistics,
} from './error-correlation.js';

// ===== ERROR HANDLER =====
export {
  ErrorHandlerConfig,
  ErrorHandlerMetrics,
  CentralizedErrorHandler,
  centralizedErrorHandler,
  handleError,
  withErrorHandling,
  withRetry,
  createServiceErrorHandler,
} from './error-handler.js';

// ===== ENHANCED CONTRACTS =====
export {
  IEnhancedServiceHealth,
  IEnhancedServiceMetrics,
  IEnhancedDatabaseOperations,
  IEnhancedAIOperations,
  IEnhancedStorageOperations,
  IEnhancedJobOperations,
  IEnhancedAuthOperations,
  IEnhancedDatabaseService,
  IEnhancedAIService,
  IEnhancedStorageService,
  IEnhancedJobService,
  IEnhancedAuthService,
  IEnhancedServiceContainer,
  IServiceHealthAggregator,
  ErrorAwareServiceFactory,
  EnhancedServiceOptions,
  ENHANCED_SERVICE_TOKENS,
  EnhancedServiceToken,
} from '../interfaces/enhanced-service-contracts.js';

// ===== ERROR-AWARE BASE SERVICE =====
export {
  ErrorAwareServiceConfig,
  ErrorAwareBaseService,
} from '../base/error-aware-base-service.js';

// ===== UTILITY FUNCTIONS =====

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
): ServiceError {
  const factory = ErrorFactory[type as keyof typeof ErrorFactory];
  if (typeof factory === 'object' && subtype in factory) {
    return (factory as any)[subtype](message, context);
  }
  
  return ErrorFactory.fromUnknown(new Error(message), context || {});
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof BaseServiceError) {
    return error.shouldRetry();
  }
  return false;
}

/**
 * Get error severity level
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
 */
export function toStructuredError(error: unknown): StructuredError {
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
): Result<T, ServiceError> {
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
): AsyncResult<T, ServiceError> {
  return AsyncResult.fromAsync(operation, errorContext);
}

/**
 * Combine multiple Results into one
 */
export function combineResults<T extends readonly unknown[]>(
  results: { [K in keyof T]: Result<T[K], ServiceError> }
): Result<T, ServiceError> {
  return Result.combine(results);
}

/**
 * Execute multiple async operations and combine their Results
 */
export async function combineAsyncResults<T extends readonly unknown[]>(
  operations: { [K in keyof T]: () => Promise<Result<T[K], ServiceError>> }
): Promise<Result<T, ServiceError>> {
  return Result.combineAsync(operations);
}

// ===== ERROR HANDLING BEST PRACTICES =====

/**
 * Best practices documentation for error handling
 */
export const ERROR_HANDLING_BEST_PRACTICES = {
  /**
   * Always use Result pattern for operations that can fail
   */
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
  
  /**
   * Use correlation for tracking errors across service boundaries
   */
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
  
  /**
   * Handle errors at the appropriate level
   */
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
  
  /**
   * Use specific error types for better handling
   */
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