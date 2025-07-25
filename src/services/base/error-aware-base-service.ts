// Error-aware base service extending Enhanced Base Service with comprehensive error handling
// Integrates Result pattern and error correlation with existing Interface Segregation
// CONSOLIDATED: Updated to use consolidated service contracts

import { EnhancedBaseService } from './enhanced-base-service.js';
import { 
  IServiceHealth, 
  IServiceMetrics,
  ServiceHealthStatus,
  ServiceMetrics
} from '../interfaces/service-contracts.js';
// FIXED: Import Result and AsyncResult as values, not types
import { Result, AsyncResult } from '../errors/index.js';
import { 
  BaseServiceError, 
  ServiceError, 
  ErrorFactory,
  ErrorCategory,
  ErrorSeverity 
} from '../errors/index.js';
import { 
  createServiceCorrelationContext,
  errorCorrelationManager,
  CorrelationContext 
} from '../errors/index.js';
import { createServiceErrorHandler } from '../errors/index.js';
import { ServiceConfig, RetryConfig } from '../interfaces/service-contracts.js';

// ===== ERROR-AWARE SERVICE CONFIGURATION =====

export interface ErrorAwareServiceConfig extends ServiceConfig {
  errorHandling?: {
    enableRetry?: boolean;
    maxRetries?: number;
    enableCircuitBreaker?: boolean;
    enableCorrelation?: boolean;
    enableMetrics?: boolean;
    retryableCategories?: ErrorCategory[];
  };
}

// FIXED: Proper type for error configuration
interface RequiredErrorHandlingConfig {
  enableRetry: boolean;
  maxRetries: number;
  enableCircuitBreaker: boolean;
  enableCorrelation: boolean;
  enableMetrics: boolean;
  retryableCategories: ErrorCategory[];
}

// ===== ENHANCED HEALTH INTERFACE =====

export interface IEnhancedServiceHealth extends IServiceHealth {
  /**
   * Get health status as Result (never fails)
   */
  getHealthStatusSafe(): Result<ServiceHealthStatus, never>;
  
  /**
   * Perform deep health check with error details
   */
  performHealthCheck(): Promise<Result<ServiceHealthStatus, BaseServiceError>>;
}

// ===== ENHANCED METRICS INTERFACE =====

export interface IEnhancedServiceMetrics extends IServiceMetrics {
  /**
   * Get metrics as Result (never fails)
   */
  getMetricsSafe(): Result<ServiceMetrics, never>;
  
  /**
   * Get error statistics
   */
  getErrorMetrics(): Result<{
    totalErrors: number;
    errorsByType: Record<string, number>;
    lastError?: string;
    errorRate: number;
  }, never>;
}

// ===== ERROR-AWARE BASE SERVICE =====

export abstract class ErrorAwareBaseService extends EnhancedBaseService implements IEnhancedServiceHealth, IEnhancedServiceMetrics {
  protected errorHandler: ReturnType<typeof createServiceErrorHandler>;
  // FIXED: Proper type that's never undefined
  protected readonly errorConfig: RequiredErrorHandlingConfig;
  
  // Error tracking (internal state, exposed through computed properties)
  private errorStats = {
    totalErrors: 0,
    errorsByType: new Map<string, number>(),
    errorsByCategory: new Map<ErrorCategory, number>(),
    errorsBySeverity: new Map<ErrorSeverity, number>(),
    lastError: null as BaseServiceError | null,
    lastErrorTime: null as Date | null,
  };

  constructor(config: ErrorAwareServiceConfig) {
    super(config);
    
    // FIXED: Define default error handling configuration separately
    const defaultErrorHandlingConfig: RequiredErrorHandlingConfig = {
      enableRetry: true,
      maxRetries: 3,
      enableCircuitBreaker: true,
      enableCorrelation: true,
      enableMetrics: true,
      retryableCategories: [
        ErrorCategory.NETWORK,
        ErrorCategory.TIMEOUT,
        ErrorCategory.RATE_LIMIT,
        ErrorCategory.EXTERNAL_SERVICE
      ],
    };

    // FIXED: Proper config merging without duplicate properties
    this.errorConfig = {
      ...defaultErrorHandlingConfig,
      ...(config.errorHandling || {}),
    };

    this.errorHandler = createServiceErrorHandler(this.getName());
  }

  // ===== ENHANCED HEALTH INTERFACE IMPLEMENTATION =====

  getHealthStatusSafe(): Result<ServiceHealthStatus, never> {
    try {
      const healthStatus = this.getHealthStatus();
      return Result.success(healthStatus);
    } catch (error) {
      // Fallback health status if health check fails
      const fallbackStatus: ServiceHealthStatus = {
        status: 'unhealthy',
        message: 'Health check failed',
        lastCheck: new Date().toISOString(),
        availability: 0,
      };
      return Result.success(fallbackStatus);
    }
  }

  async performHealthCheck(): Promise<Result<ServiceHealthStatus, BaseServiceError>> {
    return this.withErrorHandling(
      async () => {
        const isHealthy = await this.checkServiceHealth();
        const healthStatus = this.getHealthStatus();
        
        if (!isHealthy) {
          throw ErrorFactory.fromUnknown(
            new Error('Service health check failed'),
            { service: this.getName(), operation: 'performHealthCheck' }
          );
        }
        
        return healthStatus;
      },
      'performHealthCheck'
    );
  }

  // ===== ENHANCED METRICS INTERFACE IMPLEMENTATION =====

  getMetricsSafe(): Result<ServiceMetrics, never> {
    try {
      const metrics = this.getMetrics();
      return Result.success(metrics);
    } catch (error) {
      // Fallback metrics if metrics collection fails
      const fallbackMetrics: ServiceMetrics = {
        requestCount: 0,
        successCount: 0,
        errorCount: this.errorStats.totalErrors,
        averageResponseTime: 0,
        uptime: 0,
        lastActivity: new Date().toISOString(),
      };
      return Result.success(fallbackMetrics);
    }
  }

  getErrorMetrics(): Result<{
    totalErrors: number;
    errorsByType: Record<string, number>;
    lastError?: string;
    errorRate: number;
  }, never> {
    const totalRequests = this.getMetrics().requestCount;
    const errorRate = totalRequests > 0 ? this.errorStats.totalErrors / totalRequests : 0;
    
    const errorMetrics = {
      totalErrors: this.errorStats.totalErrors,
      errorsByType: Object.fromEntries(this.errorStats.errorsByType),
      lastError: this.errorStats.lastError?.type,
      errorRate,
    };
    
    return Result.success(errorMetrics);
  }

  // ===== ERROR-AWARE OPERATION WRAPPERS =====

  /**
   * Execute operation with comprehensive error handling
   */
  protected async withErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    metadata?: Record<string, any>
  ): Promise<Result<T, ServiceError>> {
    const context = this.createOperationContext(operationName, metadata);
    
    if (this.errorConfig.enableCorrelation) {
      return errorCorrelationManager.withContextResult(context, async () => {
        return this.executeWithErrorHandling(operation, operationName, context);
      });
    } else {
      return this.executeWithErrorHandling(operation, operationName, context);
    }
  }

  /**
   * FIXED: Execute operation with retry logic - Aligned signature to match base class
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    retryConfig: RetryConfig,
    operationName: string
  ): Promise<T> {
    // Use the error handler's retry mechanism but convert back to throwing for base class compatibility
    const result = await this.errorHandler.withRetry(
      operation,
      operationName,
      retryConfig.attempts,
      {}
    );

    if (result.success) {
      return result.data;
    } else {
      throw result.error;
    }
  }

  /**
   * Execute operation with retry logic and return Result
   */
  protected async withRetryResult<T>(
    operation: () => Promise<T>,
    retryConfig: RetryConfig,
    operationName: string,
    metadata?: Record<string, any>
  ): Promise<Result<T, ServiceError>> {
    return this.errorHandler.withRetry(
      operation,
      operationName,
      retryConfig.attempts,
      metadata || {}
    );
  }

  /**
   * Execute operation with circuit breaker protection
   */
  protected async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    operationName: string,
    metadata?: Record<string, any>
  ): Promise<Result<T, ServiceError>> {
    if (this.errorConfig.enableCircuitBreaker && this.errorHandler.isCircuitBreakerOpen()) {
      const error = ErrorFactory.container.circuitBreakerOpen(
        `Circuit breaker open for ${this.getName()}`,
        { service: this.getName(), operation: operationName }
      );
      return Result.failure(error);
    }

    return this.withErrorHandling(operation, operationName, metadata);
  }

  /**
   * Execute operation with full error handling pipeline
   */
  protected async withFullErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    options: {
      enableRetry?: boolean;
      maxRetries?: number;
      enableCircuitBreaker?: boolean;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<Result<T, ServiceError>> {
    const {
      enableRetry = this.errorConfig.enableRetry,
      maxRetries = this.errorConfig.maxRetries,
      enableCircuitBreaker = this.errorConfig.enableCircuitBreaker,
      metadata,
    } = options;

    if (enableCircuitBreaker && this.errorHandler.isCircuitBreakerOpen()) {
      const error = ErrorFactory.container.circuitBreakerOpen(
        `Circuit breaker open for ${this.getName()}`,
        { service: this.getName(), operation: operationName }
      );
      return Result.failure(error);
    }

    if (enableRetry) {
      const retryConfig: RetryConfig = {
        attempts: maxRetries,
        delay: 1000,
        backoffMultiplier: 2,
        maxDelay: 30000,
      };
      return this.withRetryResult(operation, retryConfig, operationName, metadata);
    } else {
      return this.withErrorHandling(operation, operationName, metadata);
    }
  }

  // ===== ASYNC RESULT HELPERS =====

  /**
   * Create an AsyncResult with error handling
   */
  protected createAsyncResult<T>(
    operation: () => Promise<T>,
    operationName: string,
    metadata?: Record<string, any>
  ): AsyncResult<T, ServiceError> {
    const promise = this.withErrorHandling(operation, operationName, metadata);
    return AsyncResult.from(promise);
  }

  /**
   * Create an AsyncResult with retry logic
   */
  protected createAsyncResultWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxAttempts?: number,
    metadata?: Record<string, any>
  ): AsyncResult<T, ServiceError> {
    const retryConfig: RetryConfig = {
      attempts: maxAttempts || this.errorConfig.maxRetries,
      delay: 1000,
      backoffMultiplier: 2,
      maxDelay: 30000,
    };
    const promise = this.withRetryResult(operation, retryConfig, operationName, metadata);
    return AsyncResult.from(promise);
  }

  // ===== ERROR TRACKING =====

  /**
   * Track an error (called automatically by error handling)
   */
  protected trackError(error: BaseServiceError): void {
    if (!this.errorConfig.enableMetrics) return;

    this.errorStats.totalErrors++;
    this.errorStats.lastError = error;
    this.errorStats.lastErrorTime = new Date();

    // Track by type
    this.errorStats.errorsByType.set(
      error.type,
      (this.errorStats.errorsByType.get(error.type) || 0) + 1
    );

    // Track by category
    this.errorStats.errorsByCategory.set(
      error.category,
      (this.errorStats.errorsByCategory.get(error.category) || 0) + 1
    );

    // Track by severity
    this.errorStats.errorsBySeverity.set(
      error.severity,
      (this.errorStats.errorsBySeverity.get(error.severity) || 0) + 1
    );

    // Record error in base service metrics
    this.recordError(error);
  }

  /**
   * Check if error should be retried
   */
  protected shouldRetryError(error: BaseServiceError): boolean {
    if (!this.errorConfig.enableRetry) return false;
    if (!error.shouldRetry()) return false;
    
    return this.errorConfig.retryableCategories.includes(error.category);
  }

  // ===== PRIVATE HELPER METHODS =====

  private createOperationContext(
    operationName: string,
    metadata?: Record<string, any>
  ): CorrelationContext {
    return createServiceCorrelationContext(
      this.getName(),
      operationName,
      metadata
    );
  }

  private async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: CorrelationContext
  ): Promise<Result<T, ServiceError>> {
    try {
      const result = await operation();
      return Result.success(result);
    } catch (error) {
      const serviceError = ErrorFactory.fromUnknown(error, {
        service: this.getName(),
        operation: operationName,
        correlationId: context.correlationId,
      });

      // Track the error
      this.trackError(serviceError);

      // Handle through error handler
      await this.errorHandler.handle(serviceError, operationName);

      return Result.failure(serviceError);
    }
  }

  // ===== ABSTRACT METHODS (MUST BE IMPLEMENTED BY SUBCLASSES) =====

  /**
   * Get service name for error tracking
   */
  abstract getName(): string;

  // ===== UTILITY METHODS =====

  /**
   * Get error statistics for monitoring
   */
  getErrorStatistics() {
    return {
      totalErrors: this.errorStats.totalErrors,
      errorsByType: Object.fromEntries(this.errorStats.errorsByType),
      errorsByCategory: Object.fromEntries(this.errorStats.errorsByCategory),
      errorsBySeverity: Object.fromEntries(this.errorStats.errorsBySeverity),
      lastError: this.errorStats.lastError?.toStructured(),
      lastErrorTime: this.errorStats.lastErrorTime?.toISOString(),
      errorHandlerStats: this.errorHandler.getServiceMetrics(),
    };
  }

  /**
   * Reset error statistics
   */
  resetErrorStatistics(): void {
    this.errorStats = {
      totalErrors: 0,
      errorsByType: new Map(),
      errorsByCategory: new Map(),
      errorsBySeverity: new Map(),
      lastError: null,
      lastErrorTime: null,
    };
    
    this.resetMetrics();
  }

  /**
   * Check if service is in error state
   */
  isInErrorState(): boolean {
    const errorRate = this.getErrorMetrics().unwrap().errorRate;
    return errorRate > 0.5; // More than 50% error rate
  }

  /**
   * Get service health with error context
   */
  getHealthWithErrorContext(): {
    health: ServiceHealthStatus;
    errorContext: {
      recentErrors: number;
      errorRate: number;
      circuitBreakerOpen: boolean;
      lastError?: string;
    };
  } {
    const health = this.getHealthStatus();
    const errorMetrics = this.getErrorMetrics().unwrap();
    
    return {
      health,
      errorContext: {
        recentErrors: errorMetrics.totalErrors,
        errorRate: errorMetrics.errorRate,
        circuitBreakerOpen: this.errorHandler.isCircuitBreakerOpen(),
        lastError: errorMetrics.lastError,
      },
    };
  }
}