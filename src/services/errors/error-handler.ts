// Centralized error handler integrating with Service Registry and Interface Segregation
// Provides consistent error handling across all services

import { 
  BaseServiceError, 
  ServiceError, 
  ErrorFactory, 
  ErrorCategory, 
  ErrorSeverity 
} from './error-types.js';
import { Result, AsyncResult } from './result-pattern.js';
import { 
  errorCorrelationManager, 
  CorrelationContext,
  createServiceCorrelationContext,
  trackError 
} from './error-correlation.js';
import { IServiceHealth, IServiceMetrics } from '../interfaces/service-contracts.js';

// ===== ERROR HANDLING CONFIGURATION =====

export interface ErrorHandlerConfig {
  enableCorrelation: boolean;
  enableRetry: boolean;
  enableCircuitBreaker: boolean;
  enableMetrics: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  maxRetryAttempts: number;
  retryDelayMs: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetTimeMs: number;
}

export interface ErrorHandlerMetrics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByService: Record<string, number>;
  retriedErrors: number;
  circuitBreakerTrips: number;
  lastErrorTime: string | null;
}

// ===== CENTRALIZED ERROR HANDLER =====

export class CentralizedErrorHandler implements IServiceHealth, IServiceMetrics {
  private config: ErrorHandlerConfig;
  private metrics: ErrorHandlerMetrics;
  private circuitBreakers = new Map<string, {
    failures: number;
    lastFailure: number;
    state: 'closed' | 'open' | 'half-open';
  }>();

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      enableCorrelation: true,
      enableRetry: true,
      enableCircuitBreaker: true,
      enableMetrics: true,
      logLevel: 'error',
      maxRetryAttempts: 3,
      retryDelayMs: 1000,
      circuitBreakerThreshold: 5,
      circuitBreakerResetTimeMs: 60000,
      ...config,
    };

    this.metrics = {
      totalErrors: 0,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      errorsByService: {},
      retriedErrors: 0,
      circuitBreakerTrips: 0,
      lastErrorTime: null,
    };
  }

  // ===== HEALTH INTERFACE IMPLEMENTATION =====

  isHealthy(): boolean {
    // Consider handler healthy if error rate is not too high
    const recentErrors = this.getRecentErrorCount();
    const errorThreshold = 100; // errors per minute
    
    return recentErrors < errorThreshold;
  }

  getHealthStatus() {
    const recentErrors = this.getRecentErrorCount();
    const errorRate = recentErrors / 60; // errors per second
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;
    let availability: number;

    if (errorRate < 1) {
      status = 'healthy';
      message = 'Error handler operating normally';
      availability = 100;
    } else if (errorRate < 5) {
      status = 'degraded';
      message = `Elevated error rate: ${errorRate.toFixed(2)} errors/sec`;
      availability = 75;
    } else {
      status = 'unhealthy';
      message = `High error rate: ${errorRate.toFixed(2)} errors/sec`;
      availability = 25;
    }

    return {
      status,
      message,
      lastCheck: new Date().toISOString(),
      availability,
      responseTime: 0, // Error handler doesn't have response time
    };
  }

  // ===== METRICS INTERFACE IMPLEMENTATION =====

  getMetrics() {
    return {
      requestCount: this.metrics.totalErrors,
      successCount: 0, // Error handler doesn't track successes
      errorCount: this.metrics.totalErrors,
      averageResponseTime: 0,
      uptime: Date.now(),
      lastActivity: this.metrics.lastErrorTime || new Date().toISOString(),
    };
  }

  resetMetrics(): void {
    this.metrics = {
      totalErrors: 0,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      errorsByService: {},
      retriedErrors: 0,
      circuitBreakerTrips: 0,
      lastErrorTime: null,
    };
  }

  // ===== ERROR HANDLING METHODS =====

  /**
   * Handle an error with full processing pipeline
   */
  async handleError<E extends BaseServiceError>(
    error: E,
    context?: {
      service?: string;
      operation?: string;
      correlationId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<E> {
    // Update metrics
    this.updateMetrics(error, context?.service);

    // Create or use correlation context
    let correlationContext: CorrelationContext | undefined;
    if (this.config.enableCorrelation) {
      correlationContext = context?.correlationId 
        ? errorCorrelationManager.getCurrentContext()
        : createServiceCorrelationContext(
            context?.service || 'unknown',
            context?.operation || 'unknown',
            context?.metadata
          );
      
      if (correlationContext) {
        trackError(error);
      }
    }

    // Update circuit breaker
    if (this.config.enableCircuitBreaker && context?.service) {
      this.updateCircuitBreaker(context.service, error);
    }

    // Log error
    this.logError(error, context);

    return error;
  }

  /**
   * Handle error and convert to Result
   */
  async handleErrorAsResult<T, E extends BaseServiceError>(
    error: E,
    context?: {
      service?: string;
      operation?: string;
      correlationId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<Result<T, E>> {
    const handledError = await this.handleError(error, context);
    return Result.failure(handledError);
  }

  /**
   * Wrap a function with error handling
   */
  async withErrorHandling<T>(
    fn: () => Promise<T>,
    context: {
      service: string;
      operation: string;
      metadata?: Record<string, any>;
    }
  ): Promise<Result<T, ServiceError>> {
    try {
      // Check circuit breaker
      if (this.config.enableCircuitBreaker && this.isCircuitBreakerOpen(context.service)) {
        const error = ErrorFactory.container.circuitBreakerOpen(
          `Circuit breaker open for service: ${context.service}`,
          { service: context.service, operation: context.operation }
        );
        return this.handleErrorAsResult(error, context);
      }

      const result = await fn();
      
      // Reset circuit breaker on success
      if (this.config.enableCircuitBreaker) {
        this.resetCircuitBreaker(context.service);
      }
      
      return Result.success(result);
    } catch (error) {
      const serviceError = ErrorFactory.fromUnknown(error, context);
      return this.handleErrorAsResult(serviceError, context);
    }
  }

  /**
   * Wrap a function with retry logic
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    context: {
      service: string;
      operation: string;
      maxAttempts?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<Result<T, ServiceError>> {
    const maxAttempts = context.maxAttempts || this.config.maxRetryAttempts;
    let lastError: ServiceError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await this.withErrorHandling(fn, {
        ...context,
        metadata: { ...context.metadata, attempt },
      });

      if (result.success) {
        if (attempt > 1) {
          this.metrics.retriedErrors++;
          console.log(`✅ Operation succeeded on attempt ${attempt}: ${context.service}.${context.operation}`);
        }
        return result;
      }

      lastError = result.error;

      // Check if error is retryable
      if (!lastError.shouldRetry() || attempt === maxAttempts) {
        break;
      }

      // Wait before retry
      const delay = lastError.getRetryDelay(attempt);
      console.warn(`⏳ Retrying ${context.service}.${context.operation} in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
      await this.sleep(delay);
    }

    return Result.failure(lastError!);
  }

  /**
   * Create a service-specific error handler
   */
  createServiceHandler(serviceName: string) {
    return {
      handle: <E extends BaseServiceError>(error: E, operation?: string, metadata?: Record<string, any>) =>
        this.handleError(error, { service: serviceName, operation, metadata }),

      handleAsResult: <T, E extends BaseServiceError>(error: E, operation?: string, metadata?: Record<string, any>) =>
        this.handleErrorAsResult<T, E>(error, { service: serviceName, operation, metadata }),

      withErrorHandling: <T>(fn: () => Promise<T>, operation: string, metadata?: Record<string, any>) =>
        this.withErrorHandling(fn, { service: serviceName, operation, metadata }),

      withRetry: <T>(fn: () => Promise<T>, operation: string, maxAttempts?: number, metadata?: Record<string, any>) =>
        this.withRetry(fn, { service: serviceName, operation, maxAttempts, metadata }),

      isCircuitBreakerOpen: () => this.isCircuitBreakerOpen(serviceName),
      
      getServiceMetrics: () => ({
        totalErrors: this.metrics.errorsByService[serviceName] || 0,
        circuitBreakerState: this.getCircuitBreakerState(serviceName),
      }),
    };
  }

  // ===== CIRCUIT BREAKER METHODS =====

  private isCircuitBreakerOpen(service: string): boolean {
    if (!this.config.enableCircuitBreaker) return false;

    const breaker = this.circuitBreakers.get(service);
    if (!breaker) return false;

    if (breaker.state === 'open') {
      // Check if we should transition to half-open
      const timeSinceLastFailure = Date.now() - breaker.lastFailure;
      if (timeSinceLastFailure > this.config.circuitBreakerResetTimeMs) {
        breaker.state = 'half-open';
        console.log(`🔄 Circuit breaker for ${service} transitioning to half-open`);
        return false;
      }
      return true;
    }

    return false;
  }

  private updateCircuitBreaker(service: string, error: BaseServiceError): void {
    if (!this.config.enableCircuitBreaker) return;

    let breaker = this.circuitBreakers.get(service);
    if (!breaker) {
      breaker = { failures: 0, lastFailure: 0, state: 'closed' };
      this.circuitBreakers.set(service, breaker);
    }

    breaker.failures++;
    breaker.lastFailure = Date.now();

    if (breaker.failures >= this.config.circuitBreakerThreshold && breaker.state === 'closed') {
      breaker.state = 'open';
      this.metrics.circuitBreakerTrips++;
      console.error(`🚨 Circuit breaker opened for ${service} after ${breaker.failures} failures`);
    } else if (breaker.state === 'half-open') {
      breaker.state = 'open';
      console.warn(`🔄 Circuit breaker for ${service} returning to open state`);
    }
  }

  private resetCircuitBreaker(service: string): void {
    const breaker = this.circuitBreakers.get(service);
    if (breaker && breaker.state !== 'closed') {
      breaker.failures = 0;
      breaker.state = 'closed';
      console.log(`✅ Circuit breaker for ${service} reset to closed state`);
    }
  }

  private getCircuitBreakerState(service: string): 'closed' | 'open' | 'half-open' {
    const breaker = this.circuitBreakers.get(service);
    return breaker?.state || 'closed';
  }

  // ===== UTILITY METHODS =====

  private updateMetrics(error: BaseServiceError, service?: string): void {
    if (!this.config.enableMetrics) return;

    this.metrics.totalErrors++;
    this.metrics.lastErrorTime = new Date().toISOString();

    // Update by category
    this.metrics.errorsByCategory[error.category] = 
      (this.metrics.errorsByCategory[error.category] || 0) + 1;

    // Update by severity
    this.metrics.errorsBySeverity[error.severity] = 
      (this.metrics.errorsBySeverity[error.severity] || 0) + 1;

    // Update by service
    if (service) {
      this.metrics.errorsByService[service] = 
        (this.metrics.errorsByService[service] || 0) + 1;
    }
  }

  private logError(error: BaseServiceError, context?: any): void {
    const logData = {
      type: error.type,
      category: error.category,
      severity: error.severity,
      message: error.message,
      correlationId: error.correlationId,
      service: context?.service,
      operation: context?.operation,
      timestamp: error.timestamp,
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('🚨 CRITICAL ERROR:', logData);
        break;
      case ErrorSeverity.HIGH:
        console.error('❌ HIGH SEVERITY ERROR:', logData);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('⚠️ MEDIUM SEVERITY ERROR:', logData);
        break;
      case ErrorSeverity.LOW:
        if (this.config.logLevel === 'info' || this.config.logLevel === 'debug') {
          console.info('ℹ️ LOW SEVERITY ERROR:', logData);
        }
        break;
    }
  }

  private getRecentErrorCount(): number {
    // This is a simplified implementation
    // In a real system, you'd track errors in a time window
    return this.metrics.totalErrors;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get comprehensive error handler statistics
   */
  getErrorHandlerStatistics() {
    return {
      ...this.metrics,
      circuitBreakers: Object.fromEntries(
        Array.from(this.circuitBreakers.entries()).map(([service, breaker]) => [
          service,
          {
            state: breaker.state,
            failures: breaker.failures,
            lastFailure: new Date(breaker.lastFailure).toISOString(),
          },
        ])
      ),
      configuration: this.config,
      correlationStatistics: errorCorrelationManager.getStatistics(),
    };
  }
}

// ===== GLOBAL ERROR HANDLER =====

export const centralizedErrorHandler = new CentralizedErrorHandler();

// ===== CONVENIENCE FUNCTIONS =====

/**
 * Handle an error globally
 */
export function handleError<E extends BaseServiceError>(
  error: E,
  context?: {
    service?: string;
    operation?: string;
    correlationId?: string;
    metadata?: Record<string, any>;
  }
): Promise<E> {
  return centralizedErrorHandler.handleError(error, context);
}

/**
 * Wrap a function with global error handling
 */
export function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: {
    service: string;
    operation: string;
    metadata?: Record<string, any>;
  }
): Promise<Result<T, ServiceError>> {
  return centralizedErrorHandler.withErrorHandling(fn, context);
}

/**
 * Wrap a function with retry logic
 */
export function withRetry<T>(
  fn: () => Promise<T>,
  context: {
    service: string;
    operation: string;
    maxAttempts?: number;
    metadata?: Record<string, any>;
  }
): Promise<Result<T, ServiceError>> {
  return centralizedErrorHandler.withRetry(fn, context);
}

/**
 * Create a service-specific error handler
 */
export function createServiceErrorHandler(serviceName: string) {
  return centralizedErrorHandler.createServiceHandler(serviceName);
}