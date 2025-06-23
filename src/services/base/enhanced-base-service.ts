// Enhanced base service implementing Interface Segregation Principle
import { 
  IServiceHealth, 
  IServiceMetrics, 
  IServiceLifecycle,
  ServiceHealthStatus,
  ServiceMetrics,
  ServiceConfig,
  RetryConfig 
} from '../interfaces/service-contracts.js';

export interface ServiceError {
  type: 'timeout' | 'connection' | 'authentication' | 'rate_limit' | 'validation' | 'unknown';
  message: string;
  details?: any;
  retryable: boolean;
}

export abstract class EnhancedBaseService implements IServiceHealth, IServiceMetrics, IServiceLifecycle {
  protected config: ServiceConfig;
  private isServiceInitialized: boolean = false;
  private lastHealthCheck: Date = new Date();
  private healthCheckCache: ServiceHealthStatus | null = null;
  private healthCacheTimeout = 30000; // 30 seconds
  
  // Metrics (internal state, exposed through computed properties)
  private metrics = {
    requestCount: 0,
    successCount: 0,
    errorCount: 0,
    totalResponseTime: 0,
    startTime: Date.now(),
    lastActivity: new Date(),
  };

  // Circuit breaker state (internal, aggregated into health status)
  private circuitBreakerFailures: number = 0;
  private circuitBreakerLastFailure: number = 0;
  private readonly circuitBreakerResetTime = 60000; // 1 minute

  constructor(config: ServiceConfig) {
    this.config = config;
  }

  // ===== ABSTRACT METHODS =====
  
  /**
   * Service-specific initialization logic
   */
  protected abstract initializeService(): Promise<void> | void;
  
  /**
   * Service-specific disposal logic
   */
  protected abstract disposeService(): Promise<void> | void;
  
  /**
   * Service name for identification
   */
  abstract getName(): string;
  
  /**
   * Service-specific health check logic
   */
  protected abstract checkServiceHealth(): boolean | Promise<boolean>;

  // ===== LIFECYCLE INTERFACE IMPLEMENTATION =====

  async initialize(): Promise<void> {
    if (this.isServiceInitialized) {
      return;
    }

    try {
      await this.initializeService();
      this.isServiceInitialized = true;
      this.log('info', 'Service initialized successfully');
    } catch (error: any) {
      this.log('error', 'Service initialization failed', error);
      throw new Error(`Failed to initialize ${this.getName()}: ${error.message}`);
    }
  }

  async dispose(): Promise<void> {
    if (!this.isServiceInitialized) {
      return;
    }

    try {
      await this.disposeService();
      this.isServiceInitialized = false;
      this.log('info', 'Service disposed successfully');
    } catch (error: any) {
      this.log('error', 'Service disposal failed', error);
      throw new Error(`Failed to dispose ${this.getName()}: ${error.message}`);
    }
  }

  isInitialized(): boolean {
    return this.isServiceInitialized;
  }

  // ===== HEALTH INTERFACE IMPLEMENTATION =====

  isHealthy(): boolean {
    try {
      // Check initialization
      if (!this.isServiceInitialized) {
        return false;
      }

      // Check circuit breaker (aggregated, not exposing internal state)
      if (this.isCircuitBreakerTripped()) {
        return false;
      }

      // Check service-specific health
      const serviceHealthy = this.checkServiceHealth();
      if (typeof serviceHealthy === 'boolean') {
        return serviceHealthy;
      }

      // For async health checks, use cached result
      return this.healthCheckCache?.status === 'healthy' || false;
    } catch (error) {
      this.log('warn', 'Health check failed', error);
      return false;
    }
  }

  getHealthStatus(): ServiceHealthStatus {
    const now = new Date();
    
    // Use cached health status if recent
    if (this.healthCheckCache && 
        (now.getTime() - this.lastHealthCheck.getTime()) < this.healthCacheTimeout) {
      return this.healthCheckCache;
    }

    // Compute health status (not exposing internal state)
    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;
    let availability: number;

    if (!this.isServiceInitialized) {
      status = 'unhealthy';
      message = 'Service not initialized';
      availability = 0;
    } else if (this.isCircuitBreakerTripped()) {
      status = 'degraded';
      message = 'Circuit breaker active - service temporarily unavailable';
      availability = 25; // Reduced availability
    } else {
      try {
        const serviceHealthy = this.checkServiceHealth();
        const isHealthy = typeof serviceHealthy === 'boolean' ? serviceHealthy : true;
        
        if (isHealthy) {
          // Check error rate for degraded status
          const errorRate = this.metrics.requestCount > 0 
            ? this.metrics.errorCount / this.metrics.requestCount 
            : 0;
          
          if (errorRate > 0.1) { // More than 10% error rate
            status = 'degraded';
            message = `High error rate: ${(errorRate * 100).toFixed(1)}%`;
            availability = Math.max(50, 100 - (errorRate * 100));
          } else {
            status = 'healthy';
            message = 'Service operating normally';
            availability = 100;
          }
        } else {
          status = 'unhealthy';
          message = 'Service health check failed';
          availability = 0;
        }
      } catch (error: any) {
        status = 'unhealthy';
        message = `Health check error: ${error.message}`;
        availability = 0;
      }
    }

    const healthStatus: ServiceHealthStatus = {
      status,
      message,
      lastCheck: now.toISOString(),
      availability,
      responseTime: this.getAverageResponseTime(),
    };

    // Cache the result
    this.healthCheckCache = healthStatus;
    this.lastHealthCheck = now;

    return healthStatus;
  }

  // ===== METRICS INTERFACE IMPLEMENTATION =====

  getMetrics(): ServiceMetrics {
    const now = Date.now();
    const uptime = now - this.metrics.startTime;
    
    return {
      requestCount: this.metrics.requestCount,
      successCount: this.metrics.successCount,
      errorCount: this.metrics.errorCount,
      averageResponseTime: this.getAverageResponseTime(),
      uptime: uptime,
      lastActivity: this.metrics.lastActivity.toISOString(),
    };
  }

  resetMetrics(): void {
    this.metrics = {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      totalResponseTime: 0,
      startTime: Date.now(),
      lastActivity: new Date(),
    };
    
    this.log('info', 'Metrics reset');
  }

  // ===== PROTECTED UTILITY METHODS =====

  /**
   * Record a successful operation
   */
  protected recordSuccess(responseTime?: number): void {
    this.metrics.requestCount++;
    this.metrics.successCount++;
    this.metrics.lastActivity = new Date();
    
    if (responseTime !== undefined) {
      this.metrics.totalResponseTime += responseTime;
    }
    
    this.resetCircuitBreaker();
  }

  /**
   * Record a failed operation
   */
  protected recordError(error: any, responseTime?: number): void {
    this.metrics.requestCount++;
    this.metrics.errorCount++;
    this.metrics.lastActivity = new Date();
    
    if (responseTime !== undefined) {
      this.metrics.totalResponseTime += responseTime;
    }
    
    this.recordCircuitBreakerFailure();
    this.invalidateHealthCache();
  }

  /**
   * Retry wrapper with exponential backoff
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    retryConfig: RetryConfig,
    operationName: string
  ): Promise<T> {
    let lastError: any;
    let delay = retryConfig.delay;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= retryConfig.attempts; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 1) {
          this.log('info', `${operationName} succeeded on attempt ${attempt}`);
        }
        
        this.recordSuccess(Date.now() - startTime);
        return result;
      } catch (error: any) {
        lastError = error;
        
        if (attempt === retryConfig.attempts) {
          this.log('error', `${operationName} failed after ${attempt} attempts`, error.message);
          break;
        }

        // Check if error is retryable
        const serviceError = this.classifyError(error);
        if (!serviceError.retryable) {
          this.log('warn', `${operationName} failed with non-retryable error`, error.message);
          break;
        }

        this.log('warn', `${operationName} attempt ${attempt} failed, retrying in ${delay}ms`, error.message);
        
        await this.sleep(delay);
        delay = Math.min(delay * retryConfig.backoffMultiplier, retryConfig.maxDelay);
      }
    }

    this.recordError(lastError, Date.now() - startTime);
    throw lastError;
  }

  /**
   * Timeout wrapper
   */
  protected withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operationName: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new Error(`${this.getName()}: ${operationName} timed out after ${timeoutMs}ms`);
        (error as any).type = 'timeout';
        reject(error);
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Classify errors for retry logic
   */
  protected classifyError(error: any): ServiceError {
    let type: ServiceError['type'] = 'unknown';
    let retryable = true;

    if (error.type === 'timeout') {
      type = 'timeout';
      retryable = true;
    } else if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
      type = 'connection';
      retryable = true;
    } else if (error.message?.includes('401') || error.message?.includes('403')) {
      type = 'authentication';
      retryable = false;
    } else if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      type = 'rate_limit';
      retryable = true;
    } else if (error.message?.includes('validation') || error.message?.includes('invalid')) {
      type = 'validation';
      retryable = false;
    }

    return {
      type,
      message: error.message || 'Unknown error',
      details: error.details || error.stack,
      retryable,
    };
  }

  /**
   * Sleep utility
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log with service context
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, details?: any): void {
    const logMessage = `[${this.getName()}] ${message}`;
    
    switch (level) {
      case 'info':
        console.log(logMessage, details || '');
        break;
      case 'warn':
        console.warn(logMessage, details || '');
        break;
      case 'error':
        console.error(logMessage, details || '');
        break;
    }
  }

  // ===== PRIVATE METHODS (INTERNAL STATE MANAGEMENT) =====

  private getAverageResponseTime(): number {
    return this.metrics.requestCount > 0 
      ? this.metrics.totalResponseTime / this.metrics.requestCount 
      : 0;
  }

  private isCircuitBreakerTripped(): boolean {
    if (this.circuitBreakerFailures < this.config.circuitBreakerThreshold) {
      return false;
    }

    const timeSinceLastFailure = Date.now() - this.circuitBreakerLastFailure;
    if (timeSinceLastFailure > this.circuitBreakerResetTime) {
      this.circuitBreakerFailures = 0;
      return false;
    }

    return true;
  }

  private recordCircuitBreakerFailure(): void {
    this.circuitBreakerFailures++;
    this.circuitBreakerLastFailure = Date.now();
  }

  private resetCircuitBreaker(): void {
    this.circuitBreakerFailures = 0;
  }

  private invalidateHealthCache(): void {
    this.healthCheckCache = null;
  }
}