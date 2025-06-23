// Comprehensive error type hierarchy for the service layer
// Integrates with existing Service Registry and Interface Segregation architecture

// ===== BASE ERROR TYPES =====

export abstract class BaseServiceError extends Error {
  abstract readonly type: string;
  abstract readonly category: ErrorCategory;
  abstract readonly retryable: boolean;
  abstract readonly severity: ErrorSeverity;
  
  public readonly timestamp: string;
  public readonly correlationId: string;
  public readonly service?: string;
  public readonly operation?: string;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    options: {
      service?: string;
      operation?: string;
      details?: Record<string, any>;
      correlationId?: string;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.correlationId = options.correlationId || this.generateCorrelationId();
    this.service = options.service;
    this.operation = options.operation;
    this.details = options.details;
    
    if (options.cause) {
      this.cause = options.cause;
    }
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  private generateCorrelationId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Convert error to structured format for logging/monitoring
   */
  toStructured(): StructuredError {
    return {
      type: this.type,
      category: this.category,
      severity: this.severity,
      retryable: this.retryable,
      message: this.message,
      timestamp: this.timestamp,
      correlationId: this.correlationId,
      service: this.service,
      operation: this.operation,
      details: this.details,
      stack: this.stack,
    };
  }

  /**
   * Check if error should be retried
   */
  shouldRetry(): boolean {
    return this.retryable;
  }

  /**
   * Get retry delay in milliseconds
   */
  getRetryDelay(attempt: number): number {
    if (!this.retryable) return 0;
    
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = Math.random() * 0.1 * delay; // 10% jitter
    
    return Math.floor(delay + jitter);
  }
}

// ===== ERROR CATEGORIES =====

export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  RESOURCE = 'resource',
  CONFIGURATION = 'configuration',
  BUSINESS_LOGIC = 'business_logic',
  EXTERNAL_SERVICE = 'external_service',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// ===== STRUCTURED ERROR INTERFACE =====

export interface StructuredError {
  type: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  retryable: boolean;
  message: string;
  timestamp: string;
  correlationId: string;
  service?: string;
  operation?: string;
  details?: Record<string, any>;
  stack?: string;
}

// ===== DATABASE SERVICE ERRORS =====

export class DatabaseConnectionError extends BaseServiceError {
  readonly type = 'DATABASE_CONNECTION_ERROR';
  readonly category = ErrorCategory.NETWORK;
  readonly severity = ErrorSeverity.HIGH;
  readonly retryable = true;
}

export class DatabaseQueryError extends BaseServiceError {
  readonly type = 'DATABASE_QUERY_ERROR';
  readonly category = ErrorCategory.SYSTEM;
  readonly severity = ErrorSeverity.MEDIUM;
  readonly retryable = false;
}

export class DatabaseTimeoutError extends BaseServiceError {
  readonly type = 'DATABASE_TIMEOUT_ERROR';
  readonly category = ErrorCategory.TIMEOUT;
  readonly severity = ErrorSeverity.MEDIUM;
  readonly retryable = true;
}

export class DatabaseTransactionError extends BaseServiceError {
  readonly type = 'DATABASE_TRANSACTION_ERROR';
  readonly category = ErrorCategory.SYSTEM;
  readonly severity = ErrorSeverity.HIGH;
  readonly retryable = false;
}

export class JobNotFoundError extends BaseServiceError {
  readonly type = 'JOB_NOT_FOUND_ERROR';
  readonly category = ErrorCategory.RESOURCE;
  readonly severity = ErrorSeverity.LOW;
  readonly retryable = false;
}

// ===== AI SERVICE ERRORS =====

export class AIServiceUnavailableError extends BaseServiceError {
  readonly type = 'AI_SERVICE_UNAVAILABLE_ERROR';
  readonly category = ErrorCategory.EXTERNAL_SERVICE;
  readonly severity = ErrorSeverity.HIGH;
  readonly retryable = true;
}

export class AIRateLimitError extends BaseServiceError {
  readonly type = 'AI_RATE_LIMIT_ERROR';
  readonly category = ErrorCategory.RATE_LIMIT;
  readonly severity = ErrorSeverity.MEDIUM;
  readonly retryable = true;

  getRetryDelay(attempt: number): number {
    // Longer delays for rate limit errors
    const baseDelay = 5000; // 5 seconds
    const maxDelay = 300000; // 5 minutes
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    return delay;
  }
}

export class AIContentPolicyError extends BaseServiceError {
  readonly type = 'AI_CONTENT_POLICY_ERROR';
  readonly category = ErrorCategory.VALIDATION;
  readonly severity = ErrorSeverity.LOW;
  readonly retryable = false;
}

export class AITimeoutError extends BaseServiceError {
  readonly type = 'AI_TIMEOUT_ERROR';
  readonly category = ErrorCategory.TIMEOUT;
  readonly severity = ErrorSeverity.MEDIUM;
  readonly retryable = true;
}

export class AIAuthenticationError extends BaseServiceError {
  readonly type = 'AI_AUTHENTICATION_ERROR';
  readonly category = ErrorCategory.AUTHENTICATION;
  readonly severity = ErrorSeverity.CRITICAL;
  readonly retryable = false;
}

// ===== STORAGE SERVICE ERRORS =====

export class StorageUploadError extends BaseServiceError {
  readonly type = 'STORAGE_UPLOAD_ERROR';
  readonly category = ErrorCategory.EXTERNAL_SERVICE;
  readonly severity = ErrorSeverity.MEDIUM;
  readonly retryable = true;
}

export class StorageQuotaExceededError extends BaseServiceError {
  readonly type = 'STORAGE_QUOTA_EXCEEDED_ERROR';
  readonly category = ErrorCategory.RESOURCE;
  readonly severity = ErrorSeverity.HIGH;
  readonly retryable = false;
}

export class StorageFileNotFoundError extends BaseServiceError {
  readonly type = 'STORAGE_FILE_NOT_FOUND_ERROR';
  readonly category = ErrorCategory.RESOURCE;
  readonly severity = ErrorSeverity.LOW;
  readonly retryable = false;
}

export class StorageConfigurationError extends BaseServiceError {
  readonly type = 'STORAGE_CONFIGURATION_ERROR';
  readonly category = ErrorCategory.CONFIGURATION;
  readonly severity = ErrorSeverity.CRITICAL;
  readonly retryable = false;
}

// ===== JOB SERVICE ERRORS =====

export class JobValidationError extends BaseServiceError {
  readonly type = 'JOB_VALIDATION_ERROR';
  readonly category = ErrorCategory.VALIDATION;
  readonly severity = ErrorSeverity.LOW;
  readonly retryable = false;
}

export class JobProcessingError extends BaseServiceError {
  readonly type = 'JOB_PROCESSING_ERROR';
  readonly category = ErrorCategory.BUSINESS_LOGIC;
  readonly severity = ErrorSeverity.MEDIUM;
  readonly retryable = true;
}

export class JobTimeoutError extends BaseServiceError {
  readonly type = 'JOB_TIMEOUT_ERROR';
  readonly category = ErrorCategory.TIMEOUT;
  readonly severity = ErrorSeverity.MEDIUM;
  readonly retryable = true;
}

export class JobConcurrencyLimitError extends BaseServiceError {
  readonly type = 'JOB_CONCURRENCY_LIMIT_ERROR';
  readonly category = ErrorCategory.RESOURCE;
  readonly severity = ErrorSeverity.LOW;
  readonly retryable = true;

  getRetryDelay(attempt: number): number {
    // Shorter delays for concurrency limits
    const baseDelay = 500; // 500ms
    const maxDelay = 5000; // 5 seconds
    const delay = Math.min(baseDelay * attempt, maxDelay);
    return delay;
  }
}

// ===== AUTH SERVICE ERRORS =====

export class AuthenticationError extends BaseServiceError {
  readonly type = 'AUTHENTICATION_ERROR';
  readonly category = ErrorCategory.AUTHENTICATION;
  readonly severity = ErrorSeverity.HIGH;
  readonly retryable = false;
}

export class AuthorizationError extends BaseServiceError {
  readonly type = 'AUTHORIZATION_ERROR';
  readonly category = ErrorCategory.AUTHORIZATION;
  readonly severity = ErrorSeverity.MEDIUM;
  readonly retryable = false;
}

export class TokenValidationError extends BaseServiceError {
  readonly type = 'TOKEN_VALIDATION_ERROR';
  readonly category = ErrorCategory.AUTHENTICATION;
  readonly severity = ErrorSeverity.MEDIUM;
  readonly retryable = false;
}

// ===== CONFIGURATION SERVICE ERRORS =====

export class ConfigurationError extends BaseServiceError {
  readonly type = 'CONFIGURATION_ERROR';
  readonly category = ErrorCategory.CONFIGURATION;
  readonly severity = ErrorSeverity.CRITICAL;
  readonly retryable = false;
}

export class EnvironmentVariableError extends BaseServiceError {
  readonly type = 'ENVIRONMENT_VARIABLE_ERROR';
  readonly category = ErrorCategory.CONFIGURATION;
  readonly severity = ErrorSeverity.CRITICAL;
  readonly retryable = false;
}

// ===== CONTAINER SERVICE ERRORS =====

export class ServiceNotRegisteredError extends BaseServiceError {
  readonly type = 'SERVICE_NOT_REGISTERED_ERROR';
  readonly category = ErrorCategory.CONFIGURATION;
  readonly severity = ErrorSeverity.HIGH;
  readonly retryable = false;
}

export class ServiceInitializationError extends BaseServiceError {
  readonly type = 'SERVICE_INITIALIZATION_ERROR';
  readonly category = ErrorCategory.SYSTEM;
  readonly severity = ErrorSeverity.HIGH;
  readonly retryable = false;
}

export class CircularDependencyError extends BaseServiceError {
  readonly type = 'CIRCULAR_DEPENDENCY_ERROR';
  readonly category = ErrorCategory.CONFIGURATION;
  readonly severity = ErrorSeverity.CRITICAL;
  readonly retryable = false;
}

export class ContainerDisposedError extends BaseServiceError {
  readonly type = 'CONTAINER_DISPOSED_ERROR';
  readonly category = ErrorCategory.SYSTEM;
  readonly severity = ErrorSeverity.HIGH;
  readonly retryable = false;
}

// ===== CIRCUIT BREAKER ERRORS =====

export class CircuitBreakerOpenError extends BaseServiceError {
  readonly type = 'CIRCUIT_BREAKER_OPEN_ERROR';
  readonly category = ErrorCategory.SYSTEM;
  readonly severity = ErrorSeverity.MEDIUM;
  readonly retryable = true;

  getRetryDelay(attempt: number): number {
    // Circuit breaker specific delays
    return 60000; // 1 minute fixed delay
  }
}

// ===== GENERIC SYSTEM ERRORS =====

export class SystemError extends BaseServiceError {
  readonly type = 'SYSTEM_ERROR';
  readonly category = ErrorCategory.SYSTEM;
  readonly severity = ErrorSeverity.HIGH;
  readonly retryable = false;
}

export class UnknownError extends BaseServiceError {
  readonly type = 'UNKNOWN_ERROR';
  readonly category = ErrorCategory.UNKNOWN;
  readonly severity = ErrorSeverity.MEDIUM;
  readonly retryable = false;
}

// ===== ERROR TYPE UNION =====

export type ServiceError = 
  | DatabaseConnectionError
  | DatabaseQueryError
  | DatabaseTimeoutError
  | DatabaseTransactionError
  | JobNotFoundError
  | AIServiceUnavailableError
  | AIRateLimitError
  | AIContentPolicyError
  | AITimeoutError
  | AIAuthenticationError
  | StorageUploadError
  | StorageQuotaExceededError
  | StorageFileNotFoundError
  | StorageConfigurationError
  | JobValidationError
  | JobProcessingError
  | JobTimeoutError
  | JobConcurrencyLimitError
  | AuthenticationError
  | AuthorizationError
  | TokenValidationError
  | ConfigurationError
  | EnvironmentVariableError
  | ServiceNotRegisteredError
  | ServiceInitializationError
  | CircularDependencyError
  | ContainerDisposedError
  | CircuitBreakerOpenError
  | SystemError
  | UnknownError;

// ===== ERROR FACTORY =====

export class ErrorFactory {
  /**
   * Create appropriate error from unknown error
   */
  static fromUnknown(
    error: unknown,
    context: {
      service?: string;
      operation?: string;
      correlationId?: string;
    } = {}
  ): ServiceError {
    if (error instanceof BaseServiceError) {
      return error;
    }

    if (error instanceof Error) {
      // Try to classify based on error message
      const message = error.message.toLowerCase();
      
      if (message.includes('timeout')) {
        if (context.service === 'database') {
          return new DatabaseTimeoutError(error.message, context);
        } else if (context.service === 'ai') {
          return new AITimeoutError(error.message, context);
        } else {
          return new JobTimeoutError(error.message, context);
        }
      }
      
      if (message.includes('rate limit') || message.includes('429')) {
        return new AIRateLimitError(error.message, context);
      }
      
      if (message.includes('authentication') || message.includes('401')) {
        if (context.service === 'ai') {
          return new AIAuthenticationError(error.message, context);
        } else {
          return new AuthenticationError(error.message, context);
        }
      }
      
      if (message.includes('authorization') || message.includes('403')) {
        return new AuthorizationError(error.message, context);
      }
      
      if (message.includes('connection') || message.includes('econnrefused')) {
        if (context.service === 'database') {
          return new DatabaseConnectionError(error.message, context);
        } else {
          return new AIServiceUnavailableError(error.message, context);
        }
      }
      
      if (message.includes('not found') || message.includes('404')) {
        if (context.operation?.includes('job')) {
          return new JobNotFoundError(error.message, context);
        } else {
          return new StorageFileNotFoundError(error.message, context);
        }
      }
      
      // Default to system error for unclassified errors
      return new SystemError(error.message, { ...context, cause: error });
    }

    // Handle non-Error objects
    const message = typeof error === 'string' ? error : 'Unknown error occurred';
    return new UnknownError(message, context);
  }

  /**
   * Create database-specific errors
   */
  static database = {
    connection: (message: string, context = {}) => new DatabaseConnectionError(message, { service: 'database', ...context }),
    query: (message: string, context = {}) => new DatabaseQueryError(message, { service: 'database', ...context }),
    timeout: (message: string, context = {}) => new DatabaseTimeoutError(message, { service: 'database', ...context }),
    transaction: (message: string, context = {}) => new DatabaseTransactionError(message, { service: 'database', ...context }),
    jobNotFound: (jobId: string, context = {}) => new JobNotFoundError(`Job not found: ${jobId}`, { service: 'database', ...context }),
  };

  /**
   * Create AI service-specific errors
   */
  static ai = {
    unavailable: (message: string, context = {}) => new AIServiceUnavailableError(message, { service: 'ai', ...context }),
    rateLimit: (message: string, context = {}) => new AIRateLimitError(message, { service: 'ai', ...context }),
    contentPolicy: (message: string, context = {}) => new AIContentPolicyError(message, { service: 'ai', ...context }),
    timeout: (message: string, context = {}) => new AITimeoutError(message, { service: 'ai', ...context }),
    authentication: (message: string, context = {}) => new AIAuthenticationError(message, { service: 'ai', ...context }),
  };

  /**
   * Create storage service-specific errors
   */
  static storage = {
    upload: (message: string, context = {}) => new StorageUploadError(message, { service: 'storage', ...context }),
    quotaExceeded: (message: string, context = {}) => new StorageQuotaExceededError(message, { service: 'storage', ...context }),
    fileNotFound: (message: string, context = {}) => new StorageFileNotFoundError(message, { service: 'storage', ...context }),
    configuration: (message: string, context = {}) => new StorageConfigurationError(message, { service: 'storage', ...context }),
  };

  /**
   * Create job service-specific errors
   */
  static job = {
    validation: (message: string, context = {}) => new JobValidationError(message, { service: 'job', ...context }),
    processing: (message: string, context = {}) => new JobProcessingError(message, { service: 'job', ...context }),
    timeout: (message: string, context = {}) => new JobTimeoutError(message, { service: 'job', ...context }),
    concurrencyLimit: (message: string, context = {}) => new JobConcurrencyLimitError(message, { service: 'job', ...context }),
  };

  /**
   * Create auth service-specific errors
   */
  static auth = {
    authentication: (message: string, context = {}) => new AuthenticationError(message, { service: 'auth', ...context }),
    authorization: (message: string, context = {}) => new AuthorizationError(message, { service: 'auth', ...context }),
    tokenValidation: (message: string, context = {}) => new TokenValidationError(message, { service: 'auth', ...context }),
  };

  /**
   * Create container-specific errors
   */
  static container = {
    serviceNotRegistered: (token: string, context = {}) => new ServiceNotRegisteredError(`Service not registered: ${token}`, { service: 'container', ...context }),
    serviceInitialization: (token: string, cause: Error, context = {}) => new ServiceInitializationError(`Failed to initialize service: ${token}`, { service: 'container', cause, ...context }),
    circularDependency: (token: string, context = {}) => new CircularDependencyError(`Circular dependency detected: ${token}`, { service: 'container', ...context }),
    containerDisposed: (context = {}) => new ContainerDisposedError('Container has been disposed', { service: 'container', ...context }),
  };
}