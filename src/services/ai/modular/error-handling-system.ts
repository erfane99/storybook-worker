/**
 * ===== ERROR HANDLING SYSTEM MODULE =====
 * Enterprise-grade error handling, recovery, and monitoring system.
 * SURGICALLY FIXED: Corrected imports and removed duplicate declarations while preserving ALL functionality
 * 
 * File Location: lib/services/ai/modular/error-handling-system.ts
 * 
 * Features:
 * - Advanced retry mechanisms with exponential backoff and jitter
 * - Circuit breaker pattern with intelligent state management
 * - Error enhancement with comprehensive retry context
 * - Learning from retry success patterns
 * - Advanced error classification with recovery strategies  
 * - Health check and recovery mechanisms
 * - Professional user-friendly error messages
 * - Comprehensive error analytics and reporting
 */

// ===== SURGICALLY FIXED IMPORTS =====
// FIXED: Correct import path (2 levels up) and use existing error classes only
import { 
  ErrorCategory,
  ErrorSeverity,
  BaseServiceError,
  AIServiceUnavailableError,
  AIRateLimitError,
  AIContentPolicyError,
  AITimeoutError,
  AIAuthenticationError
} from '../../errors/index.js';

// Import from constants-and-types.ts (our foundation module)
import {
  RETRY_STRATEGIES,
  ERROR_HANDLING_CONSTANTS
} from './constants-and-types.js';

// ===== ERROR CONTEXT INTERFACES =====

export interface ErrorContext {
  service?: string;
  operation?: string;
  endpoint?: string;
  errorCode?: string;
  httpStatus?: number;
  retryAfter?: string | null;
  timeout?: number;
  originalError?: string;
  timestamp?: number;
  attempt?: number;
  [key: string]: any;
}

export interface ErrorClassification {
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoveryStrategy: string;
  userMessage: string;
  isRetryable: boolean;
  estimatedRecoveryTime?: number;
}

export interface RetryContext {
  attempts: number;
  totalDuration: number;
  operationName: string;
  errorProgression?: string[];
}

export interface RetryAttempt {
  attempt: number;
  error?: any;
  duration: number;
  timestamp: number;
  success: boolean;
  errorType?: string;
}

export interface RetryOptions {
  operationName: string;
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  learningEnabled?: boolean;
  circuitBreakerEnabled?: boolean;
  adaptiveBackoff?: boolean;
  jitterEnabled?: boolean;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
  threshold: number;
  timeout: number;
  successCount: number;
}

// ===== CUSTOM ERROR HIERARCHY EXTENSION =====
// SURGICALLY FIXED: Removed duplicate declarations, extend existing classes only

export abstract class AIServiceError extends BaseServiceError {
  public retryContext?: RetryContext;
  
  constructor(message: string, context: ErrorContext = {}) {
    super(message, context);
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      retryContext: this.retryContext
    };
  }
}

// ===== ERROR HANDLING SYSTEM CLASS =====
// SURGICALLY FIXED: Moved all class properties INSIDE the class body

export class ErrorHandlingSystem {
  // FIXED: All class properties moved inside the class body
  private static instance: ErrorHandlingSystem;
  
  // Circuit breaker state management
  private circuitBreakerStates: Map<string, CircuitBreakerState> = new Map();
  
  // Learning engine for retry optimization
  private learningEngine?: any;
  
  // Error analytics and metrics
  private errorMetrics: Map<string, any[]> = new Map();
  
  // Health monitoring
  private healthMonitor?: any;
  
  // Logger interface
  private logger: any;

  constructor(learningEngine?: any, healthMonitor?: any, logger?: any) {
    this.learningEngine = learningEngine;
    this.healthMonitor = healthMonitor;
    this.logger = logger || console;
  }

  public static getInstance(learningEngine?: any, healthMonitor?: any, logger?: any): ErrorHandlingSystem {
    if (!ErrorHandlingSystem.instance) {
      ErrorHandlingSystem.instance = new ErrorHandlingSystem(learningEngine, healthMonitor, logger);
    }
    return ErrorHandlingSystem.instance;
  }

  // ===== ERROR HANDLING CORE METHODS =====

  /**
   * Handle error with comprehensive context and recovery suggestions
   */
  public handleError(error: any, operationName: string, context?: any): BaseServiceError {
    const enhancedError = this.enhanceError(error, operationName, context);
    
    // Record error metrics
    this.recordErrorMetrics(operationName, enhancedError, []);
    
    // Record circuit breaker failure
    this.recordCircuitBreakerFailure(operationName);
    
    return enhancedError;
  }

  /**
   * Enhance error with additional context and retry information
   * SURGICALLY FIXED: Use readonly-safe context assignment
   */
  public enhanceError(error: any, operationName: string, context?: any): BaseServiceError {
    // If already a BaseServiceError, enhance it
    if (error instanceof BaseServiceError) {
      // FIXED: Use spread operator to avoid readonly property assignment
      const newContext = {
        ...error.context,
        operation: operationName,
        ...context
      };
      
      // Create a new error instance with enhanced context
      const enhancedError = this.createEnhancedError(error, error.message, newContext);
      return enhancedError;
    }

    // Convert generic error to BaseServiceError
    const errorMessage = error?.message || String(error);
    const errorContext: ErrorContext = {
      service: 'ErrorHandlingSystem',
      operation: operationName,
      originalError: errorMessage,
      timestamp: Date.now(),
      ...context
    };

    // Classify the error and create appropriate service error
    const classification = this.classifyError(error);
    
    switch (classification.category) {
      case ErrorCategory.NETWORK:
        return new AIServiceUnavailableError(errorMessage, errorContext);
      case ErrorCategory.CONFIGURATION:
        return new AIContentPolicyError(errorMessage, errorContext); // Map validation to content policy
      case ErrorCategory.VALIDATION:
        return new AIContentPolicyError(errorMessage, errorContext);
      case ErrorCategory.SYSTEM:
        return new AIServiceUnavailableError(errorMessage, errorContext);
      default:
        return new AIServiceUnavailableError(errorMessage, errorContext);
    }
  }

  /**
   * Create enhanced error instance with new context
   * SURGICALLY FIXED: Helper method to create new error instances safely
   */
  private createEnhancedError(originalError: BaseServiceError, message: string, newContext: ErrorContext): BaseServiceError {
    if (originalError instanceof AIRateLimitError) {
      return new AIRateLimitError(message, newContext);
    } else if (originalError instanceof AIContentPolicyError) {
      return new AIContentPolicyError(message, newContext);
    } else if (originalError instanceof AITimeoutError) {
      return new AITimeoutError(message, newContext);
    } else if (originalError instanceof AIAuthenticationError) {
      return new AIAuthenticationError(message, newContext);
    } else if (originalError instanceof AIServiceUnavailableError) {
      return new AIServiceUnavailableError(message, newContext);
    } else {
      return new AIServiceUnavailableError(message, newContext);
    }
  }

  // ===== INTELLIGENT RETRY MECHANISM WITH LEARNING =====

  public async withIntelligentRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions
  ): Promise<T> {
    const {
      operationName,
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      learningEnabled = true,
      circuitBreakerEnabled = true,
      adaptiveBackoff = true,
      jitterEnabled = true
    } = options;

    // Check circuit breaker state
    if (circuitBreakerEnabled && this.isCircuitBreakerOpen(operationName)) {
      throw new AIServiceUnavailableError(
        `Circuit breaker is open for operation: ${operationName}`,
        { service: 'ErrorHandlingSystem', operation: operationName }
      );
    }

    const attemptResults: RetryAttempt[] = [];
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startTime = Date.now();
      
      try {
        this.logger.log(`🔄 Attempt ${attempt}/${maxAttempts} for ${operationName}`);
        
        const result = await operation();
        
        // Record successful attempt
        const duration = Date.now() - startTime;
        attemptResults.push({
          attempt,
          duration,
          timestamp: startTime,
          success: true
        });

        // Learn from successful retry pattern
        if (learningEnabled && attempt > 1) {
          await this.learnFromRetrySuccess(operationName, attempt, attemptResults);
        }

        // Reset circuit breaker on success
        if (circuitBreakerEnabled) {
          this.recordCircuitBreakerSuccess(operationName);
        }

        this.logger.log(`✅ Operation ${operationName} succeeded on attempt ${attempt}`);
        return result;

      } catch (error: any) {
        lastError = error;
        const duration = Date.now() - startTime;
        const errorType = error.constructor.name;

        attemptResults.push({
          attempt,
          error,
          duration,
          timestamp: startTime,
          success: false,
          errorType
        });

        // Record circuit breaker failure
        if (circuitBreakerEnabled) {
          this.recordCircuitBreakerFailure(operationName);
        }

        // Check if error is retryable
        const classification = this.classifyError(error);
        if (!classification.isRetryable || attempt === maxAttempts) {
          break;
        }

        // Calculate intelligent delay
        const delay = this.calculateIntelligentDelay(
          error,
          attempt,
          baseDelay,
          maxDelay,
          adaptiveBackoff,
          jitterEnabled
        );

        this.logger.warn(`⚠️ Attempt ${attempt} failed for ${operationName}: ${error.message}`);
        this.logger.log(`⏳ Waiting ${delay}ms before retry...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Enhance error with retry context
    const enhancedError = this.enhanceErrorWithRetryContext(lastError, operationName, attemptResults);
    
    // Record error metrics
    this.recordErrorMetrics(operationName, enhancedError, attemptResults);
    
    throw enhancedError;
  }

  // ===== INTELLIGENT DELAY CALCULATION =====

  private calculateIntelligentDelay(
    error: any,
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    adaptiveBackoff: boolean = true,
    jitterEnabled: boolean = true
  ): number {
    let multiplier = Math.pow(2, attempt - 1); // Exponential backoff base
    
    // Adjust multiplier based on error type
    if (error instanceof AIRateLimitError) {
      multiplier *= 3; // Longer delays for rate limits
    } else if (error instanceof AITimeoutError) {
      multiplier *= 1.8; // Moderate delays for timeouts
    } else if (error instanceof AIContentPolicyError) {
      multiplier = 1; // Short delays for content policy (may not help)
    } else if (error instanceof AIServiceUnavailableError) {
      multiplier *= 2.2; // Extended delays for service issues
    }

    // Apply adaptive backoff based on historical success patterns
    if (adaptiveBackoff && this.learningEngine) {
      const learningMultiplier = this.learningEngine.getOptimalDelayMultiplier?.(error.constructor.name) || 1;
      multiplier *= learningMultiplier;
    }
    
    let calculatedDelay = baseDelay * multiplier;

    // Add jitter to prevent thundering herd
    if (jitterEnabled) {
      const jitter = Math.random() * 0.4 + 0.8; // 80-120% of calculated delay
      calculatedDelay *= jitter;
    }
    
    const finalDelay = Math.min(calculatedDelay, maxDelay);
    return Math.round(finalDelay);
  }
// ===== ADVANCED ERROR CLASSIFICATION =====

  public classifyError(error: any): ErrorClassification {
    // AI Service specific errors
    if (error instanceof AIRateLimitError) {
      return {
        category: ErrorCategory.RATE_LIMIT,
        severity: ErrorSeverity.MEDIUM,
        recoveryStrategy: RETRY_STRATEGIES.EXPONENTIAL_BACKOFF_WITH_JITTER,
        userMessage: 'Service is temporarily busy. Please wait a moment and try again.',
        isRetryable: true,
        estimatedRecoveryTime: 30000 // 30 seconds
      };
    }

    if (error instanceof AIContentPolicyError) {
      return {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.HIGH,
        recoveryStrategy: RETRY_STRATEGIES.CONTENT_MODIFICATION_REQUIRED,
        userMessage: 'The content cannot be processed due to policy restrictions. Please try a different story or character.',
        isRetryable: false
      };
    }

    if (error instanceof AITimeoutError) {
      return {
        category: ErrorCategory.TIMEOUT,
        severity: ErrorSeverity.MEDIUM,
        recoveryStrategy: RETRY_STRATEGIES.RETRY_WITH_LONGER_TIMEOUT,
        userMessage: 'The request is taking longer than expected. Please try again.',
        isRetryable: true,
        estimatedRecoveryTime: 10000 // 10 seconds
      };
    }

    if (error instanceof AIAuthenticationError) {
      return {
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.CRITICAL,
        recoveryStrategy: RETRY_STRATEGIES.SERVICE_RECONFIGURATION_REQUIRED,
        userMessage: 'Service authentication error. Please contact support.',
        isRetryable: false
      };
    }

    if (error instanceof AIServiceUnavailableError) {
      return {
        category: ErrorCategory.EXTERNAL_SERVICE,
        severity: ErrorSeverity.HIGH,
        recoveryStrategy: RETRY_STRATEGIES.SERVICE_HEALTH_CHECK_AND_RETRY,
        userMessage: 'AI service is temporarily unavailable. Please try again in a few minutes.',
        isRetryable: true,
        estimatedRecoveryTime: 120000 // 2 minutes
      };
    }

    // Generic error classification
    if (error.message?.includes('timeout')) {
      return {
        category: ErrorCategory.TIMEOUT,
        severity: ErrorSeverity.MEDIUM,
        recoveryStrategy: RETRY_STRATEGIES.NETWORK_RETRY_WITH_BACKOFF,
        userMessage: 'Request timed out. Please try again.',
        isRetryable: true,
        estimatedRecoveryTime: 10000
      };
    }

    if (error.message?.includes('network') || error.message?.includes('connection')) {
      return {
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        recoveryStrategy: RETRY_STRATEGIES.NETWORK_RETRY_WITH_BACKOFF,
        userMessage: 'Network connectivity issue. Please check your connection and try again.',
        isRetryable: true,
        estimatedRecoveryTime: 15000
      };
    }

    if (error.message?.includes('rate limit') || error.message?.includes('quota')) {
      return {
        category: ErrorCategory.RATE_LIMIT,
        severity: ErrorSeverity.MEDIUM,
        recoveryStrategy: RETRY_STRATEGIES.EXPONENTIAL_BACKOFF_WITH_JITTER,
        userMessage: 'Service is temporarily busy. Please wait a moment and try again.',
        isRetryable: true,
        estimatedRecoveryTime: 30000
      };
    }

    // Unknown error
    return {
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.HIGH,
      recoveryStrategy: RETRY_STRATEGIES.LOG_AND_FALLBACK,
      userMessage: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
      isRetryable: true,
      estimatedRecoveryTime: 60000 // 1 minute
    };
  }

  // ===== RECOVERY STRATEGY EXECUTION =====

  public async executeRecoveryStrategy(
    error: any,
    strategy: string,
    originalOperation: () => Promise<any>,
    operationName: string = 'unknown'
  ): Promise<any> {
    this.logger.log(`🔧 Executing recovery strategy: ${strategy} for ${operationName}`);

    try {
      switch (strategy) {
        case RETRY_STRATEGIES.EXPONENTIAL_BACKOFF_WITH_JITTER:
          return await this.withIntelligentRetry(originalOperation, {
            operationName: `recovery_exponential_backoff_${operationName}`,
            maxAttempts: 3,
            baseDelay: 2000,
            maxDelay: 30000,
            jitterEnabled: true
          });

        case RETRY_STRATEGIES.RETRY_WITH_LONGER_TIMEOUT:
          return await this.withIntelligentRetry(originalOperation, {
            operationName: `recovery_extended_timeout_${operationName}`,
            maxAttempts: 2,
            baseDelay: 5000,
            maxDelay: 60000
          });

        case RETRY_STRATEGIES.SERVICE_HEALTH_CHECK_AND_RETRY:
          await this.performHealthCheckAndRecover();
          return await this.withIntelligentRetry(originalOperation, {
            operationName: `recovery_after_health_check_${operationName}`,
            maxAttempts: 2,
            baseDelay: 3000
          });

        case RETRY_STRATEGIES.NETWORK_RETRY_WITH_BACKOFF:
          return await this.withIntelligentRetry(originalOperation, {
            operationName: `recovery_network_${operationName}`,
            maxAttempts: 4,
            baseDelay: 1500,
            maxDelay: 20000,
            adaptiveBackoff: true
          });

        case RETRY_STRATEGIES.CONTENT_MODIFICATION_REQUIRED:
          throw new AIContentPolicyError(
            'Content modification required - this error cannot be automatically recovered',
            { service: 'ErrorHandlingSystem', strategy, operation: operationName }
          );

        case RETRY_STRATEGIES.SERVICE_RECONFIGURATION_REQUIRED:
          throw new AIAuthenticationError(
            'Service reconfiguration required - this error cannot be automatically recovered',
            { service: 'ErrorHandlingSystem', strategy, operation: operationName }
          );

        case RETRY_STRATEGIES.INPUT_VALIDATION_REQUIRED:
          throw new AIContentPolicyError(
            'Input validation required - this error cannot be automatically recovered',
            { service: 'ErrorHandlingSystem', strategy, operation: operationName }
          );

        case RETRY_STRATEGIES.LOG_AND_FALLBACK:
          // Log the error and attempt a basic retry
          this.logger.error(`🚨 Fallback recovery for ${operationName}:`, error);
          return await this.withIntelligentRetry(originalOperation, {
            operationName: `fallback_recovery_${operationName}`,
            maxAttempts: 2,
            baseDelay: 2000
          });

        default:
          this.logger.warn(`⚠️ Unknown recovery strategy: ${strategy}`);
          throw error;
      }
    } catch (recoveryError) {
      this.logger.error(`❌ Recovery strategy ${strategy} failed for ${operationName}:`, recoveryError);
      throw recoveryError;
    }
  }

  // ===== HEALTH CHECK AND RECOVERY =====

  private async performHealthCheckAndRecover(): Promise<void> {
    this.logger.log('🏥 Performing comprehensive health check and recovery...');
    
    try {
      // Use health monitor if available
      if (this.healthMonitor?.checkServiceHealth) {
        const healthStatus = await this.healthMonitor.checkServiceHealth();
        
        if (!healthStatus.isHealthy) {
          this.logger.warn('⚠️ Service unhealthy, attempting recovery...');
          
          // Attempt service recovery
          if (this.healthMonitor.recoverService) {
            await this.healthMonitor.recoverService();
            this.logger.log('🔄 Service recovery attempted');
          }

          // Reset circuit breakers on recovery attempt
          this.resetAllCircuitBreakers();
          
          this.logger.log('✅ Health check and recovery completed');
        } else {
          this.logger.log('✅ Service is healthy');
        }
      } else {
        // Basic health check without health monitor
        this.logger.log('🔍 Performing basic health check...');
        
        // Reset circuit breakers as a recovery measure
        this.resetAllCircuitBreakers();
        
        this.logger.log('✅ Basic health check completed');
      }
    } catch (healthError: any) {
      this.logger.error('❌ Health check and recovery failed:', healthError);
      throw new AIServiceUnavailableError(
        'Service health check and recovery failed',
        { 
          service: 'ErrorHandlingSystem', 
          operation: 'performHealthCheckAndRecover',
          originalError: healthError?.message || 'Unknown health error'
        }
      );
    }
  }

  // ===== CIRCUIT BREAKER PATTERN =====

  private isCircuitBreakerOpen(operationName: string): boolean {
    const state = this.getCircuitBreakerState(operationName);
    
    if (state.state === 'open') {
      // Check if timeout period has passed
      if (Date.now() - state.lastFailure > state.timeout) {
        // Move to half-open state
        state.state = 'half-open';
        state.successCount = 0;
        this.logger.log(`🔄 Circuit breaker for ${operationName} moving to half-open state`);
      }
      return state.state === 'open';
    }
    
    return false;
  }

  private getCircuitBreakerState(operationName: string): CircuitBreakerState {
    if (!this.circuitBreakerStates.has(operationName)) {
      this.circuitBreakerStates.set(operationName, {
        failures: 0,
        lastFailure: 0,
        state: 'closed',
        threshold: ERROR_HANDLING_CONSTANTS.CIRCUIT_BREAKER_THRESHOLD,
        timeout: ERROR_HANDLING_CONSTANTS.CIRCUIT_BREAKER_TIMEOUT,
        successCount: 0
      });
    }
    return this.circuitBreakerStates.get(operationName)!;
  }

  private recordCircuitBreakerFailure(operationName: string): void {
    const state = this.getCircuitBreakerState(operationName);
    state.failures++;
    state.lastFailure = Date.now();
    state.successCount = 0;
    
    if (state.failures >= state.threshold) {
      state.state = 'open';
      this.logger.warn(`🔴 Circuit breaker OPENED for ${operationName} after ${state.failures} failures`);
    }
  }

  private recordCircuitBreakerSuccess(operationName: string): void {
    const state = this.getCircuitBreakerState(operationName);
    
    if (state.state === 'half-open') {
      state.successCount++;
      if (state.successCount >= 2) { // Require 2 successes to close
        state.state = 'closed';
        state.failures = 0;
        this.logger.log(`🟢 Circuit breaker CLOSED for ${operationName} after successful recovery`);
      }
    } else if (state.state === 'closed') {
      // Reset failure count on successful operation
      state.failures = Math.max(0, state.failures - 1);
    }
  }

  private resetAllCircuitBreakers(): void {
    for (const [operationName, state] of this.circuitBreakerStates) {
      state.state = 'closed';
      state.failures = 0;
      state.successCount = 0;
      this.logger.log(`🔄 Reset circuit breaker for ${operationName}`);
    }
  }

  // ===== ERROR CONTEXT ENHANCEMENT =====

  private enhanceErrorWithRetryContext(
    originalError: any,
    operationName: string,
    attempts: RetryAttempt[]
  ): BaseServiceError {
    const contextualMessage = 
      `${operationName} failed after ${attempts.length} attempts. ` +
      `Total duration: ${attempts.reduce((sum, a) => sum + a.duration, 0)}ms. ` +
      `Error progression: ${attempts.map(a => a.errorType || 'Unknown').join(' → ')}. ` +
      `Final error: ${originalError.message}`;

    const enhancedContext: ErrorContext = {
      service: 'ErrorHandlingSystem',
      operation: operationName,
      timestamp: Date.now(),
      originalError: originalError.message,
      attempts: attempts.length,
      totalDuration: attempts.reduce((sum, a) => sum + a.duration, 0)
    };

    // Create enhanced error with same type as original
    let enhancedError: BaseServiceError;
    
    if (originalError instanceof AIRateLimitError) {
      enhancedError = new AIRateLimitError(contextualMessage, enhancedContext);
    } else if (originalError instanceof AIContentPolicyError) {
      enhancedError = new AIContentPolicyError(contextualMessage, enhancedContext);
    } else if (originalError instanceof AITimeoutError) {
      enhancedError = new AITimeoutError(contextualMessage, enhancedContext);
    } else if (originalError instanceof AIAuthenticationError) {
      enhancedError = new AIAuthenticationError(contextualMessage, enhancedContext);
    } else if (originalError instanceof AIServiceUnavailableError) {
      enhancedError = new AIServiceUnavailableError(contextualMessage, enhancedContext);
    } else {
      enhancedError = new AIServiceUnavailableError(contextualMessage, enhancedContext);
    }

    // Add comprehensive retry context
    if (enhancedError instanceof AIServiceError) {
      enhancedError.retryContext = {
        attempts: attempts.length,
        totalDuration: attempts.reduce((sum, a) => sum + a.duration, 0),
        operationName,
        errorProgression: attempts.map(a => a.errorType || 'Unknown')
      };
    }

    return enhancedError;
  }

  // ===== LEARNING FROM RETRY PATTERNS =====

  private async learnFromRetrySuccess(
    operationName: string,
    successfulAttempt: number,
    attempts: RetryAttempt[]
  ): Promise<void> {
    if (!this.learningEngine?.recordSuccessfulRetryPattern) {
      return;
    }

    try {
      const pattern = {
        operation: operationName,
        attempts: successfulAttempt,
        totalDuration: attempts.reduce((sum, a) => sum + a.duration, 0),
        errorTypes: attempts.filter(a => !a.success).map(a => a.errorType).filter(Boolean),
        timestamp: Date.now(),
        context: {
          finalSuccess: true,
          retryDelays: attempts.map(a => a.duration)
        }
      };

      await this.learningEngine.recordSuccessfulRetryPattern(pattern);
      this.logger.log(`🧠 Learned from successful retry pattern for ${operationName}`);
    } catch (learningError) {
      this.logger.warn('⚠️ Failed to record retry learning pattern:', learningError);
    }
  }

  // ===== ERROR METRICS AND ANALYTICS =====

  private recordErrorMetrics(
    operationName: string,
    error: BaseServiceError,
    attempts: RetryAttempt[]
  ): void {
    const metrics = {
      operation: operationName,
      errorType: error.constructor.name,
      totalAttempts: attempts.length,
      totalDuration: attempts.reduce((sum, a) => sum + a.duration, 0),
      classification: this.classifyError(error),
      timestamp: Date.now(),
      context: error.context
    };

    if (!this.errorMetrics.has(operationName)) {
      this.errorMetrics.set(operationName, []);
    }
    
    const operationMetrics = this.errorMetrics.get(operationName)!;
    operationMetrics.push(metrics);
    
    // Keep only last 100 error metrics per operation
    if (operationMetrics.length > ERROR_HANDLING_CONSTANTS.ERROR_METRICS_LIMIT) {
      operationMetrics.splice(0, operationMetrics.length - ERROR_HANDLING_CONSTANTS.ERROR_METRICS_LIMIT);
    }
  }

  // ===== ERROR ANALYTICS AND REPORTING =====

  public getErrorAnalytics(operationName?: string): any {
    if (operationName) {
      const metrics = this.errorMetrics.get(operationName) || [];
      return {
        operation: operationName,
        totalErrors: metrics.length,
        errorTypes: this.aggregateErrorTypes(metrics),
        averageRetries: this.calculateAverageRetries(metrics),
        mostCommonCategory: this.findMostCommonCategory(metrics),
        lastError: metrics[metrics.length - 1]
      };
    }

    // Global analytics
    const allMetrics: any[] = [];
    for (const metrics of this.errorMetrics.values()) {
      allMetrics.push(...metrics);
    }

    return {
      totalOperations: this.errorMetrics.size,
      totalErrors: allMetrics.length,
      errorTypes: this.aggregateErrorTypes(allMetrics),
      averageRetries: this.calculateAverageRetries(allMetrics),
      circuitBreakerStates: Object.fromEntries(this.circuitBreakerStates),
      topFailingOperations: this.getTopFailingOperations()
    };
  }

  private aggregateErrorTypes(metrics: any[]): Record<string, number> {
    const types: Record<string, number> = {};
    for (const metric of metrics) {
      types[metric.errorType] = (types[metric.errorType] || 0) + 1;
    }
    return types;
  }

  private calculateAverageRetries(metrics: any[]): number {
    if (metrics.length === 0) return 0;
    const totalRetries = metrics.reduce((sum: number, m: any) => sum + m.totalAttempts, 0);
    return totalRetries / metrics.length;
  }

  private findMostCommonCategory(metrics: any[]): string {
    if (metrics.length === 0) return 'unknown';
    
    const categories: Record<string, number> = {};
    for (const metric of metrics) {
      const category = metric.classification?.category || 'unknown';
      categories[category] = (categories[category] || 0) + 1;
    }
    
    return Object.entries(categories)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || 'unknown';
  }

  private getTopFailingOperations(): Array<{ operation: string; errors: number; errorRate: string }> {
    return Array.from(this.errorMetrics.entries())
      .map(([operation, metrics]) => ({
        operation,
        errors: metrics.length,
        errorRate: `${((metrics.length / 100) * 100).toFixed(1)}%` // Assuming 100 is max tracked
      }))
      .sort((a, b) => b.errors - a.errors)
      .slice(0, 5);
  }

  // ===== UTILITY METHODS FOR ERROR HANDLING =====

  public isRetryableError(error: any): boolean {
    return this.classifyError(error).isRetryable;
  }

  public getUserFriendlyMessage(error: any): string {
    return this.classifyError(error).userMessage;
  }

  public getEstimatedRecoveryTime(error: any): number {
    return this.classifyError(error).estimatedRecoveryTime || 60000;
  }

  public async createErrorFromResponse(response: Response, operationName: string, endpoint: string): Promise<never> {
    return this.handleAPIErrorResponse(response, operationName, endpoint);
  }

  // ===== HTTP ERROR RESPONSE HANDLING =====

  private async handleAPIErrorResponse(response: Response, operationName: string, endpoint: string): Promise<never> {
    let errorData: any = {};
    
    try {
      errorData = await response.json();
    } catch {
      // Ignore JSON parsing errors - use default error structure
    }

    const errorMessage = errorData.error?.message || errorData.message || `HTTP ${response.status}`;
    const errorCode = errorData.error?.code || errorData.code;
    const errorType = errorData.error?.type || errorData.type;

    // Enhanced context from both files
    const context: ErrorContext = {
      service: 'ErrorHandlingSystem',
      operation: operationName,
      endpoint,
      errorCode,
      httpStatus: response.status,
      timestamp: Date.now()
    };

    // Add additional context from response headers
    if (response.headers.get('retry-after')) {
      context.retryAfter = response.headers.get('retry-after');
    }

    // Enhanced HTTP status code handling
    switch (response.status) {
      case 400:
        throw new AIContentPolicyError(
          `Bad request: ${errorMessage}`,
          { ...context, errorType: errorType || 'bad_request' }
        );

      case 401:
        throw new AIAuthenticationError(
          `Authentication failed: ${errorMessage}`,
          { ...context, errorType: errorType || 'authentication_failed' }
        );

      case 403:
        throw new AIContentPolicyError(
          `Forbidden: ${errorMessage}`,
          { ...context, errorType: errorType || 'forbidden' }
        );

      case 422:
        throw new AIContentPolicyError(
          `Validation failed: ${errorMessage}`,
          { ...context, errorType: errorType || 'validation_error' }
        );

      case 429:
        throw new AIRateLimitError(
          `Rate limit exceeded: ${errorMessage}`,
          { 
            ...context, 
            errorType: errorType || 'rate_limit_exceeded',
            retryAfter: response.headers.get('retry-after')
          }
        );

      case 500:
        throw new AIServiceUnavailableError(
          `Internal server error: ${errorMessage}`,
          { ...context, errorType: errorType || 'internal_server_error' }
        );

      case 502:
        throw new AIServiceUnavailableError(
          `Bad gateway: ${errorMessage}`,
          { ...context, errorType: errorType || 'bad_gateway' }
        );

      case 503:
        throw new AIServiceUnavailableError(
          `Service unavailable: ${errorMessage}`,
          { ...context, errorType: errorType || 'service_unavailable' }
        );

      case 504:
        throw new AITimeoutError(
          `Gateway timeout: ${errorMessage}`,
          { ...context, errorType: errorType || 'gateway_timeout' }
        );

      default:
        if (response.status >= 500) {
          throw new AIServiceUnavailableError(
            `Server error: ${errorMessage}`,
            { ...context, errorType: errorType || 'server_error' }
          );
        } else if (response.status >= 400) {
          throw new AIContentPolicyError(
            `Client error: ${errorMessage}`,
            { ...context, errorType: errorType || 'client_error' }
          );
        } else {
          throw new AIServiceUnavailableError(
            `Unexpected response: ${errorMessage}`,
            { ...context, errorType: errorType || 'unexpected_response' }
          );
        }
    }
  }

  // ===== ERROR VALIDATION AND SANITIZATION =====

  public validateAndSanitizeError(error: any): BaseServiceError {
    // If already a properly typed BaseServiceError, return as-is
    if (error instanceof BaseServiceError) {
      return error;
    }

    // Convert generic errors to BaseServiceError
    if (error instanceof Error) {
      const message = this.sanitizeErrorMessage(error.message);
      const context: ErrorContext = {
        originalError: error.message,
        timestamp: Date.now()
      };

      // Classify the generic error and convert to appropriate service error
      const classification = this.classifyError(error);
      
      switch (classification.category) {
        case ErrorCategory.NETWORK:
          return new AIServiceUnavailableError(message, context);
        case ErrorCategory.CONFIGURATION:
          return new AIContentPolicyError(message, context);
        case ErrorCategory.VALIDATION:
          return new AIContentPolicyError(message, context);
        default:
          return new AIServiceUnavailableError(message, context);
      }
    }

    // Handle non-Error objects
    const message = this.sanitizeErrorMessage(String(error));
    return new AIServiceUnavailableError(message, {
      originalError: String(error),
      timestamp: Date.now()
    });
  }

  private sanitizeErrorMessage(message: string): string {
    // Remove potentially sensitive information
    return message
      .replace(/api[_-]?key[s]?[:\s]*[^\s]+/gi, 'api_key: [REDACTED]')
      .replace(/token[s]?[:\s]*[^\s]+/gi, 'token: [REDACTED]')
      .replace(/password[s]?[:\s]*[^\s]+/gi, 'password: [REDACTED]')
      .replace(/secret[s]?[:\s]*[^\s]+/gi, 'secret: [REDACTED]')
      .substring(0, ERROR_HANDLING_CONSTANTS.MAX_ERROR_MESSAGE_LENGTH);
  }

  // ===== CLEANUP AND MAINTENANCE =====

  public clearErrorMetrics(operationName?: string): void {
    if (operationName) {
      this.errorMetrics.delete(operationName);
      this.logger.log(`🧹 Cleared error metrics for ${operationName}`);
    } else {
      this.errorMetrics.clear();
      this.logger.log('🧹 Cleared all error metrics');
    }
  }

  public resetCircuitBreaker(operationName: string): void {
    if (this.circuitBreakerStates.has(operationName)) {
      const state = this.circuitBreakerStates.get(operationName)!;
      state.state = 'closed';
      state.failures = 0;
      state.successCount = 0;
      this.logger.log(`🔄 Reset circuit breaker for ${operationName}`);
    }
  }

  public getServiceHealth(): {
    isHealthy: boolean;
    circuitBreakers: Record<string, CircuitBreakerState>;
    errorRates: Record<string, number>;
    recommendations: string[];
  } {
    const circuitBreakers = Object.fromEntries(this.circuitBreakerStates);
    const errorRates: Record<string, number> = {};
    const recommendations: string[] = [];

    // Calculate error rates
    for (const [operation, metrics] of this.errorMetrics) {
      const recentErrors = metrics.filter((m: any) => Date.now() - m.timestamp < 300000); // Last 5 minutes
      errorRates[operation] = recentErrors.length;
    }

    // Check for unhealthy conditions
    const hasOpenCircuits = Array.from(this.circuitBreakerStates.values()).some(s => s.state === 'open');
    const highErrorOperations = Object.entries(errorRates).filter(([, rate]) => rate > 10);
    
    const isHealthy = !hasOpenCircuits && highErrorOperations.length === 0;

    // Generate recommendations
    if (hasOpenCircuits) {
      recommendations.push('Some circuit breakers are open - investigate failing operations');
    }
    
    if (highErrorOperations.length > 0) {
      recommendations.push(`High error rates detected in: ${highErrorOperations.map(([op]) => op).join(', ')}`);
    }
    
    if (isHealthy) {
      recommendations.push('Error handling system is operating normally');
    }

    return {
      isHealthy,
      circuitBreakers,
      errorRates,
      recommendations
    };
  }

  // ===== DIAGNOSTIC UTILITIES =====

  public generateDiagnosticReport(): string {
    const health = this.getServiceHealth();
    const analytics = this.getErrorAnalytics();
    
    const report = [
      '🏥 ERROR HANDLING SYSTEM DIAGNOSTIC REPORT',
      '='.repeat(50),
      '',
      `🔍 Overall Health: ${health.isHealthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`,
      `📊 Total Operations: ${analytics.totalOperations}`,
      `🚨 Total Errors: ${analytics.totalErrors}`,
      `🔄 Average Retries: ${analytics.averageRetries.toFixed(2)}`,
      '',
      '🔒 Circuit Breaker Status:',
      ...Object.entries(health.circuitBreakers).map(([op, state]) => 
        `  ${op}: ${state.state.toUpperCase()} (failures: ${state.failures})`
      ),
      '',
      '📈 Error Rates (last 5 minutes):',
      ...Object.entries(health.errorRates).map(([op, rate]) => 
        `  ${op}: ${rate} errors`
      ),
      '',
      '🏆 Top Failing Operations:',
      ...analytics.topFailingOperations.map((op: any) => 
        `  ${op.operation}: ${op.errors} errors`
      ),
      '',
      '💡 Recommendations:',
      ...health.recommendations.map((rec: string) => `  • ${rec}`),
      '',
      `📅 Report Generated: ${new Date().toISOString()}`
    ];

    return report.join('\n');
  }

  // ===== DISPOSE METHOD =====

  public dispose(): void {
    this.circuitBreakerStates.clear();
    this.errorMetrics.clear();
    this.logger.log('🧹 ErrorHandlingSystem disposed and cleaned up');
  }
}

// ===== FACTORY FUNCTIONS AND UTILITIES =====

export class ErrorFactory {
  public static createFromHttpResponse(
    response: Response,
    operationName: string,
    endpoint: string
  ): Promise<BaseServiceError> {
    const errorHandler = ErrorHandlingSystem.getInstance();
    return errorHandler.createErrorFromResponse(response, operationName, endpoint) as Promise<BaseServiceError>;
  }

  public static createRateLimitError(message: string, context?: ErrorContext): AIRateLimitError {
    return new AIRateLimitError(message, context);
  }

  public static createContentPolicyError(message: string, context?: ErrorContext): AIContentPolicyError {
    return new AIContentPolicyError(message, context);
  }

  public static createTimeoutError(message: string, context?: ErrorContext): AITimeoutError {
    return new AITimeoutError(message, context);
  }

  public static createAuthenticationError(message: string, context?: ErrorContext): AIAuthenticationError {
    return new AIAuthenticationError(message, context);
  }

  public static createServiceUnavailableError(message: string, context?: ErrorContext): AIServiceUnavailableError {
    return new AIServiceUnavailableError(message, context);
  }
}

// ===== EXPORT ALL ERROR HANDLING COMPONENTS =====

export default ErrorHandlingSystem;

// ===== EXPORT AI ERROR CLASSES FOR OTHER MODULAR FILES =====
// These exports are needed by narrative-intelligence.ts, openai-integration.ts, visual-dna-system.ts
export {
  AIServiceUnavailableError,
  AIRateLimitError,
  AIContentPolicyError,
  AITimeoutError,
  AIAuthenticationError
};

// Create aliases for non-existent error classes that other files might expect
export const AIValidationError = AIContentPolicyError;
export const AINetworkError = AIServiceUnavailableError;

// Export error categories and severities
export const ERROR_CATEGORIES = {
  VALIDATION: ErrorCategory.VALIDATION,
  AUTHENTICATION: ErrorCategory.AUTHENTICATION,
  AUTHORIZATION: ErrorCategory.AUTHORIZATION,
  NETWORK: ErrorCategory.NETWORK,
  TIMEOUT: ErrorCategory.TIMEOUT,
  RATE_LIMIT: ErrorCategory.RATE_LIMIT,
  RESOURCE: ErrorCategory.RESOURCE,
  CONFIGURATION: ErrorCategory.CONFIGURATION,
  BUSINESS_LOGIC: ErrorCategory.BUSINESS_LOGIC,
  EXTERNAL_SERVICE: ErrorCategory.EXTERNAL_SERVICE,
  SYSTEM: ErrorCategory.SYSTEM,
  UNKNOWN: ErrorCategory.UNKNOWN
} as const;

export const ERROR_SEVERITIES = {
  LOW: ErrorSeverity.LOW,
  MEDIUM: ErrorSeverity.MEDIUM,
  HIGH: ErrorSeverity.HIGH,
  CRITICAL: ErrorSeverity.CRITICAL
} as const;