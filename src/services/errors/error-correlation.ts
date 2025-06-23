// Error correlation system for tracking errors across service boundaries
// Integrates with existing Service Registry and Interface Segregation architecture

import { BaseServiceError, StructuredError } from './error-types.js';
import { Result } from './result-pattern.js';

// ===== CORRELATION CONTEXT =====

export interface CorrelationContext {
  correlationId: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  jobId?: string;
  operation?: string;
  service?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ErrorCorrelation {
  correlationId: string;
  errors: StructuredError[];
  context: CorrelationContext;
  rootCause?: StructuredError;
  errorChain: string[];
  firstOccurrence: string;
  lastOccurrence: string;
  occurrenceCount: number;
  affectedServices: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ===== CORRELATION MANAGER =====

export class ErrorCorrelationManager {
  private correlations = new Map<string, ErrorCorrelation>();
  private contextStack: CorrelationContext[] = [];
  private maxCorrelations = 10000; // Prevent memory leaks
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup old correlations every hour
    this.cleanupInterval = setInterval(() => this.cleanup(), 3600000);
  }

  /**
   * Create a new correlation context
   */
  createContext(options: Partial<CorrelationContext> = {}): CorrelationContext {
    const correlationId = options.correlationId || this.generateCorrelationId();
    
    return {
      correlationId,
      traceId: options.traceId || this.generateTraceId(),
      spanId: options.spanId || this.generateSpanId(),
      userId: options.userId,
      sessionId: options.sessionId,
      requestId: options.requestId,
      jobId: options.jobId,
      operation: options.operation,
      service: options.service,
      timestamp: new Date().toISOString(),
      metadata: options.metadata || {},
    };
  }

  /**
   * Push a context onto the stack (for nested operations)
   */
  pushContext(context: CorrelationContext): void {
    this.contextStack.push(context);
  }

  /**
   * Pop the current context from the stack
   */
  popContext(): CorrelationContext | undefined {
    return this.contextStack.pop();
  }

  /**
   * Get the current context
   */
  getCurrentContext(): CorrelationContext | undefined {
    return this.contextStack[this.contextStack.length - 1];
  }

  /**
   * Execute a function with a correlation context
   */
  async withContext<T>(
    context: CorrelationContext,
    fn: () => Promise<T>
  ): Promise<T> {
    this.pushContext(context);
    try {
      return await fn();
    } finally {
      this.popContext();
    }
  }

  /**
   * Execute a function with a correlation context and return a Result
   */
  async withContextResult<T, E extends BaseServiceError>(
    context: CorrelationContext,
    fn: () => Promise<Result<T, E>>
  ): Promise<Result<T, E>> {
    this.pushContext(context);
    try {
      const result = await fn();
      
      // Track error if result is failure
      if (!result.success) {
        this.trackError(result.error, context);
      }
      
      return result;
    } catch (error) {
      // Handle unexpected errors
      const serviceError = this.createCorrelatedError(error, context);
      this.trackError(serviceError, context);
      return Result.failure(serviceError as E);
    } finally {
      this.popContext();
    }
  }

  /**
   * Track an error with correlation
   */
  trackError(error: BaseServiceError, context?: CorrelationContext): void {
    const correlationContext = context || this.getCurrentContext();
    if (!correlationContext) {
      console.warn('No correlation context available for error tracking');
      return;
    }

    const correlationId = correlationContext.correlationId;
    const structuredError = error.toStructured();
    
    let correlation = this.correlations.get(correlationId);
    
    if (!correlation) {
      correlation = {
        correlationId,
        errors: [],
        context: correlationContext,
        errorChain: [],
        firstOccurrence: structuredError.timestamp,
        lastOccurrence: structuredError.timestamp,
        occurrenceCount: 0,
        affectedServices: [],
        severity: structuredError.severity,
      };
      
      this.correlations.set(correlationId, correlation);
    }

    // Update correlation
    correlation.errors.push(structuredError);
    correlation.lastOccurrence = structuredError.timestamp;
    correlation.occurrenceCount++;
    correlation.errorChain.push(structuredError.type);
    
    // Track affected services
    if (structuredError.service && !correlation.affectedServices.includes(structuredError.service)) {
      correlation.affectedServices.push(structuredError.service);
    }

    // Update severity (take highest)
    if (this.getSeverityLevel(structuredError.severity) > this.getSeverityLevel(correlation.severity)) {
      correlation.severity = structuredError.severity;
    }

    // Determine root cause (first error or highest severity)
    if (!correlation.rootCause || 
        this.getSeverityLevel(structuredError.severity) > this.getSeverityLevel(correlation.rootCause.severity)) {
      correlation.rootCause = structuredError;
    }

    // Log correlation for monitoring
    this.logCorrelation(correlation);
  }

  /**
   * Get error correlation by ID
   */
  getCorrelation(correlationId: string): ErrorCorrelation | undefined {
    return this.correlations.get(correlationId);
  }

  /**
   * Get all correlations for a service
   */
  getCorrelationsByService(service: string): ErrorCorrelation[] {
    return Array.from(this.correlations.values())
      .filter(correlation => correlation.affectedServices.includes(service));
  }

  /**
   * Get correlations by severity
   */
  getCorrelationsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): ErrorCorrelation[] {
    return Array.from(this.correlations.values())
      .filter(correlation => correlation.severity === severity);
  }

  /**
   * Get correlation statistics
   */
  getStatistics(): {
    totalCorrelations: number;
    errorsByService: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    errorsByType: Record<string, number>;
    averageErrorsPerCorrelation: number;
    topErrorChains: Array<{ chain: string; count: number }>;
  } {
    const correlations = Array.from(this.correlations.values());
    const errorsByService: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    const errorsByType: Record<string, number> = {};
    const errorChains: Record<string, number> = {};
    
    let totalErrors = 0;

    for (const correlation of correlations) {
      totalErrors += correlation.errors.length;
      
      // Count by service
      for (const service of correlation.affectedServices) {
        errorsByService[service] = (errorsByService[service] || 0) + correlation.errors.length;
      }
      
      // Count by severity
      errorsBySeverity[correlation.severity] = (errorsBySeverity[correlation.severity] || 0) + 1;
      
      // Count by type
      for (const error of correlation.errors) {
        errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
      }
      
      // Count error chains
      const chainKey = correlation.errorChain.join(' -> ');
      errorChains[chainKey] = (errorChains[chainKey] || 0) + 1;
    }

    const topErrorChains = Object.entries(errorChains)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([chain, count]) => ({ chain, count }));

    return {
      totalCorrelations: correlations.length,
      errorsByService,
      errorsBySeverity,
      errorsByType,
      averageErrorsPerCorrelation: correlations.length > 0 ? totalErrors / correlations.length : 0,
      topErrorChains,
    };
  }

  /**
   * Create a correlated error from unknown error
   */
  private createCorrelatedError(
    error: unknown,
    context: CorrelationContext
  ): BaseServiceError {
    const { ErrorFactory } = require('./error-types.js');
    
    const serviceError = ErrorFactory.fromUnknown(error, {
      service: context.service,
      operation: context.operation,
      correlationId: context.correlationId,
    });

    return serviceError;
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate span ID
   */
  private generateSpanId(): string {
    return `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get numeric severity level for comparison
   */
  private getSeverityLevel(severity: string): number {
    const levels = { low: 1, medium: 2, high: 3, critical: 4 };
    return levels[severity as keyof typeof levels] || 0;
  }

  /**
   * Log correlation for monitoring
   */
  private logCorrelation(correlation: ErrorCorrelation): void {
    if (correlation.severity === 'critical' || correlation.severity === 'high') {
      console.error('🔗 Error Correlation:', {
        correlationId: correlation.correlationId,
        severity: correlation.severity,
        errorCount: correlation.errors.length,
        affectedServices: correlation.affectedServices,
        errorChain: correlation.errorChain,
        rootCause: correlation.rootCause?.type,
      });
    } else {
      console.warn('🔗 Error Correlation:', {
        correlationId: correlation.correlationId,
        severity: correlation.severity,
        errorCount: correlation.errors.length,
        affectedServices: correlation.affectedServices,
      });
    }
  }

  /**
   * Cleanup old correlations
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    let cleanedCount = 0;

    for (const [correlationId, correlation] of this.correlations.entries()) {
      const age = now - new Date(correlation.lastOccurrence).getTime();
      if (age > maxAge) {
        this.correlations.delete(correlationId);
        cleanedCount++;
      }
    }

    // Also enforce max correlations limit
    if (this.correlations.size > this.maxCorrelations) {
      const sortedCorrelations = Array.from(this.correlations.entries())
        .sort(([, a], [, b]) => new Date(a.lastOccurrence).getTime() - new Date(b.lastOccurrence).getTime());
      
      const toRemove = sortedCorrelations.slice(0, this.correlations.size - this.maxCorrelations);
      for (const [correlationId] of toRemove) {
        this.correlations.delete(correlationId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old error correlations`);
    }
  }

  /**
   * Dispose the correlation manager
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.correlations.clear();
    this.contextStack.length = 0;
  }
}

// ===== GLOBAL CORRELATION MANAGER =====

export const errorCorrelationManager = new ErrorCorrelationManager();

// ===== CORRELATION DECORATORS =====

/**
 * Decorator for methods that should be tracked with correlation
 */
export function withCorrelation(
  service: string,
  operation?: string
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context = errorCorrelationManager.createContext({
        service,
        operation: operation || propertyKey,
      });

      return errorCorrelationManager.withContext(context, async () => {
        return originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}

/**
 * Decorator for methods that return Results and should be tracked
 */
export function withCorrelationResult(
  service: string,
  operation?: string
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context = errorCorrelationManager.createContext({
        service,
        operation: operation || propertyKey,
      });

      return errorCorrelationManager.withContextResult(context, async () => {
        return originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}

// ===== UTILITY FUNCTIONS =====

/**
 * Create a correlation context for a job
 */
export function createJobCorrelationContext(
  jobId: string,
  jobType: string,
  userId?: string
): CorrelationContext {
  return errorCorrelationManager.createContext({
    jobId,
    operation: `process_${jobType}_job`,
    service: 'job-processor',
    userId,
    metadata: { jobType },
  });
}

/**
 * Create a correlation context for a service operation
 */
export function createServiceCorrelationContext(
  service: string,
  operation: string,
  metadata?: Record<string, any>
): CorrelationContext {
  return errorCorrelationManager.createContext({
    service,
    operation,
    metadata,
  });
}

/**
 * Track an error with current correlation context
 */
export function trackError(error: BaseServiceError): void {
  errorCorrelationManager.trackError(error);
}

/**
 * Get correlation statistics for monitoring
 */
export function getCorrelationStatistics() {
  return errorCorrelationManager.getStatistics();
}