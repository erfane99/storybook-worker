// Base service class with common functionality for all services
import { environmentManager } from '../../lib/config/environment.js';

export interface ServiceConfig {
  name: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  circuitBreakerThreshold: number;
}

export interface ServiceError {
  type: 'timeout' | 'connection' | 'authentication' | 'rate_limit' | 'validation' | 'unknown';
  message: string;
  details?: any;
  retryable: boolean;
}

export interface RetryConfig {
  attempts: number;
  delay: number;
  backoffMultiplier: number;
  maxDelay: number;
}

export abstract class BaseService {
  protected config: ServiceConfig;
  protected isInitialized: boolean = false;
  private circuitBreakerFailures: number = 0;
  private circuitBreakerLastFailure: number = 0;
  private readonly circuitBreakerResetTime = 60000; // 1 minute

  constructor(config: ServiceConfig) {
    this.config = config;
  }

  /**
   * Initialize the service - must be implemented by subclasses
   */
  protected abstract initialize(): Promise<void> | void;

  /**
   * Health check - must be implemented by subclasses
   */
  abstract isHealthy(): boolean;

  /**
   * Get service status
   */
  abstract getStatus(): any;

  /**
   * Ensure service is initialized
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
      this.isInitialized = true;
    }
  }

  /**
   * Circuit breaker pattern implementation
   */
  protected isCircuitBreakerOpen(): boolean {
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

  /**
   * Record circuit breaker failure
   */
  protected recordCircuitBreakerFailure(): void {
    this.circuitBreakerFailures++;
    this.circuitBreakerLastFailure = Date.now();
  }

  /**
   * Reset circuit breaker on success
   */
  protected resetCircuitBreaker(): void {
    this.circuitBreakerFailures = 0;
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

    for (let attempt = 1; attempt <= retryConfig.attempts; attempt++) {
      try {
        const result = await operation();
        if (attempt > 1) {
          console.log(`✅ ${this.config.name}: ${operationName} succeeded on attempt ${attempt}`);
        }
        return result;
      } catch (error: any) {
        lastError = error;
        
        if (attempt === retryConfig.attempts) {
          console.error(`❌ ${this.config.name}: ${operationName} failed after ${attempt} attempts:`, error.message);
          break;
        }

        // Check if error is retryable
        const serviceError = this.classifyError(error);
        if (!serviceError.retryable) {
          console.warn(`⚠️ ${this.config.name}: ${operationName} failed with non-retryable error:`, error.message);
          break;
        }

        console.warn(`⚠️ ${this.config.name}: ${operationName} attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
        
        await this.sleep(delay);
        delay = Math.min(delay * retryConfig.backoffMultiplier, retryConfig.maxDelay);
      }
    }

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
        const error = new Error(`${this.config.name}: ${operationName} timed out after ${timeoutMs}ms`);
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
    const logMessage = `[${this.config.name}] ${message}`;
    
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
}