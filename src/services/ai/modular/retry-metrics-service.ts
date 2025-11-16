/**
 * ===== RETRY METRICS SERVICE =====
 * Batched metrics collection and persistence for OpenAI retry attempts
 *
 * Features:
 * - Batched insertion to Supabase (every 5 minutes OR 100 operations)
 * - Async/background operation to avoid blocking
 * - In-memory buffering for performance
 * - Automatic cleanup of old metrics
 * - Analytics aggregation support
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface RetryMetric {
  operationName: string;
  errorType: string;
  errorMessage: string;
  httpStatus?: number;
  attemptNumber: number;
  maxAttempts: number;
  delayMs: number;
  durationMs: number;
  success: boolean;
  totalRetryDurationMs: number;
  circuitBreakerState: string;
  retryStrategy: string;
  endpoint: string;
  timestamp: number;
}

export interface RetryStatistics {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  averageDelayMs: number;
  averageDurationMs: number;
  retriesByErrorType: Record<string, number>;
  retriesByOperation: Record<string, number>;
  successRateByErrorType: Record<string, number>;
}

export class RetryMetricsService {
  private supabase: SupabaseClient | null = null;
  private metricsBatch: RetryMetric[] = [];
  private lastBatchTime: number = Date.now();
  private readonly BATCH_SIZE = 100;
  private readonly BATCH_INTERVAL_MS = 300000; // 5 minutes
  private flushInProgress: boolean = false;
  private logger: any;

  constructor(
    supabaseUrl?: string,
    supabaseKey?: string,
    logger?: any
  ) {
    this.logger = logger || {
      log: (...args: any[]) => console.log('[RetryMetrics]', ...args),
      error: (...args: any[]) => console.error('[RetryMetrics-ERROR]', ...args),
      warn: (...args: any[]) => console.warn('[RetryMetrics-WARN]', ...args)
    };

    // Initialize Supabase client if credentials provided
    if (supabaseUrl && supabaseKey) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.logger.log('Retry metrics service initialized with Supabase');
      } catch (error) {
        this.logger.error('Failed to initialize Supabase client:', error);
      }
    } else {
      this.logger.warn('Retry metrics service running without Supabase persistence');
    }
  }

  /**
   * Add a retry metric to the batch
   * This is non-blocking and batches metrics for later persistence
   */
  public recordRetryMetric(metric: RetryMetric): void {
    this.metricsBatch.push(metric);

    // Check if we should flush the batch
    const shouldFlushBySize = this.metricsBatch.length >= this.BATCH_SIZE;
    const shouldFlushByTime = (Date.now() - this.lastBatchTime) >= this.BATCH_INTERVAL_MS;

    if (shouldFlushBySize || shouldFlushByTime) {
      // Flush asynchronously without blocking
      this.flushMetricsAsync();
    }
  }

  /**
   * Flush metrics to Supabase asynchronously
   * This runs in the background and doesn't block operations
   */
  private async flushMetricsAsync(): Promise<void> {
    // Prevent concurrent flushes
    if (this.flushInProgress || this.metricsBatch.length === 0) {
      return;
    }

    if (!this.supabase) {
      this.logger.warn('Skipping metrics flush - Supabase not configured');
      this.metricsBatch = []; // Clear batch even if we can't persist
      return;
    }

    this.flushInProgress = true;
    const batchToFlush = [...this.metricsBatch];
    this.metricsBatch = []; // Clear immediately to accept new metrics
    this.lastBatchTime = Date.now();

    try {
      await this.flushMetricsBatch(batchToFlush);
    } catch (error) {
      this.logger.error('Failed to flush metrics batch:', error);
      // Don't re-add to batch to avoid infinite growth
    } finally {
      this.flushInProgress = false;
    }
  }

  /**
   * Actually persist metrics to Supabase
   */
  private async flushMetricsBatch(metrics: RetryMetric[]): Promise<void> {
    if (!this.supabase || metrics.length === 0) {
      return;
    }

    const startTime = Date.now();

    try {
      // Transform metrics to database format
      const records = metrics.map(m => ({
        operation_name: m.operationName,
        error_type: m.errorType,
        error_message: m.errorMessage.substring(0, 1000), // Limit length
        http_status: m.httpStatus || null,
        attempt_number: m.attemptNumber,
        max_attempts: m.maxAttempts,
        delay_ms: m.delayMs,
        duration_ms: m.durationMs,
        success: m.success,
        total_retry_duration_ms: m.totalRetryDurationMs,
        circuit_breaker_state: m.circuitBreakerState,
        retry_strategy: m.retryStrategy,
        endpoint: m.endpoint,
        created_at: new Date(m.timestamp).toISOString()
      }));

      // Insert in batches of 50 to avoid payload limits
      const CHUNK_SIZE = 50;
      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE);

        const { error } = await this.supabase
          .from('openai_retry_metrics')
          .insert(chunk);

        if (error) {
          this.logger.error(`Failed to insert metrics chunk ${i / CHUNK_SIZE + 1}:`, error);
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(`✅ Flushed ${records.length} retry metrics to Supabase in ${duration}ms`);

    } catch (error) {
      this.logger.error('Error flushing metrics to Supabase:', error);
      throw error;
    }
  }

  /**
   * Force immediate flush of all pending metrics
   * Useful for shutdown or critical operations
   */
  public async flushImmediately(): Promise<void> {
    if (this.metricsBatch.length === 0) {
      return;
    }

    this.logger.log(`Force flushing ${this.metricsBatch.length} pending metrics...`);

    const batchToFlush = [...this.metricsBatch];
    this.metricsBatch = [];

    await this.flushMetricsBatch(batchToFlush);
  }

  /**
   * Get in-memory statistics from current batch
   * Useful for real-time monitoring without database queries
   */
  public getCurrentBatchStats(): RetryStatistics {
    const stats: RetryStatistics = {
      totalRetries: this.metricsBatch.length,
      successfulRetries: 0,
      failedRetries: 0,
      averageDelayMs: 0,
      averageDurationMs: 0,
      retriesByErrorType: {},
      retriesByOperation: {},
      successRateByErrorType: {}
    };

    if (this.metricsBatch.length === 0) {
      return stats;
    }

    let totalDelay = 0;
    let totalDuration = 0;
    const errorTypeCounts: Record<string, { total: number; success: number }> = {};

    for (const metric of this.metricsBatch) {
      // Count successes/failures
      if (metric.success) {
        stats.successfulRetries++;
      } else {
        stats.failedRetries++;
      }

      // Aggregate delays and durations
      totalDelay += metric.delayMs;
      totalDuration += metric.durationMs;

      // Count by error type
      stats.retriesByErrorType[metric.errorType] =
        (stats.retriesByErrorType[metric.errorType] || 0) + 1;

      // Count by operation
      stats.retriesByOperation[metric.operationName] =
        (stats.retriesByOperation[metric.operationName] || 0) + 1;

      // Track error type success rates
      if (!errorTypeCounts[metric.errorType]) {
        errorTypeCounts[metric.errorType] = { total: 0, success: 0 };
      }
      errorTypeCounts[metric.errorType].total++;
      if (metric.success) {
        errorTypeCounts[metric.errorType].success++;
      }
    }

    stats.averageDelayMs = Math.round(totalDelay / this.metricsBatch.length);
    stats.averageDurationMs = Math.round(totalDuration / this.metricsBatch.length);

    // Calculate success rates by error type
    for (const [errorType, counts] of Object.entries(errorTypeCounts)) {
      stats.successRateByErrorType[errorType] =
        Math.round((counts.success / counts.total) * 100);
    }

    return stats;
  }

  /**
   * Query historical retry statistics from Supabase
   * @param hours How many hours of history to retrieve
   */
  public async getHistoricalStats(hours: number = 24): Promise<RetryStatistics> {
    if (!this.supabase) {
      this.logger.warn('Cannot query historical stats - Supabase not configured');
      return this.getCurrentBatchStats();
    }

    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const { data, error } = await this.supabase
        .from('openai_retry_metrics')
        .select('*')
        .gte('created_at', startTime);

      if (error) {
        this.logger.error('Failed to query historical stats:', error);
        return this.getCurrentBatchStats();
      }

      if (!data || data.length === 0) {
        return this.getCurrentBatchStats();
      }

      // Aggregate statistics
      const stats: RetryStatistics = {
        totalRetries: data.length,
        successfulRetries: 0,
        failedRetries: 0,
        averageDelayMs: 0,
        averageDurationMs: 0,
        retriesByErrorType: {},
        retriesByOperation: {},
        successRateByErrorType: {}
      };

      let totalDelay = 0;
      let totalDuration = 0;
      const errorTypeCounts: Record<string, { total: number; success: number }> = {};

      for (const record of data) {
        if (record.success) {
          stats.successfulRetries++;
        } else {
          stats.failedRetries++;
        }

        totalDelay += record.delay_ms || 0;
        totalDuration += record.duration_ms || 0;

        stats.retriesByErrorType[record.error_type] =
          (stats.retriesByErrorType[record.error_type] || 0) + 1;

        stats.retriesByOperation[record.operation_name] =
          (stats.retriesByOperation[record.operation_name] || 0) + 1;

        if (!errorTypeCounts[record.error_type]) {
          errorTypeCounts[record.error_type] = { total: 0, success: 0 };
        }
        errorTypeCounts[record.error_type].total++;
        if (record.success) {
          errorTypeCounts[record.error_type].success++;
        }
      }

      stats.averageDelayMs = Math.round(totalDelay / data.length);
      stats.averageDurationMs = Math.round(totalDuration / data.length);

      for (const [errorType, counts] of Object.entries(errorTypeCounts)) {
        stats.successRateByErrorType[errorType] =
          Math.round((counts.success / counts.total) * 100);
      }

      return stats;

    } catch (error) {
      this.logger.error('Error retrieving historical stats:', error);
      return this.getCurrentBatchStats();
    }
  }

  /**
   * Cleanup old metrics from database
   * @param retentionDays How many days to retain
   */
  public async cleanupOldMetrics(retentionDays: number = 90): Promise<number> {
    if (!this.supabase) {
      this.logger.warn('Cannot cleanup metrics - Supabase not configured');
      return 0;
    }

    try {
      const { data, error } = await this.supabase
        .rpc('cleanup_old_retry_metrics', { p_retention_days: retentionDays });

      if (error) {
        this.logger.error('Failed to cleanup old metrics:', error);
        return 0;
      }

      const deletedCount = data || 0;
      this.logger.log(`🗑️ Cleaned up ${deletedCount} old retry metrics (>${retentionDays} days)`);
      return deletedCount;

    } catch (error) {
      this.logger.error('Error during metrics cleanup:', error);
      return 0;
    }
  }

  /**
   * Get pending batch size
   */
  public getPendingMetricsCount(): number {
    return this.metricsBatch.length;
  }

  /**
   * Check if flush is needed
   */
  public shouldFlush(): boolean {
    const shouldFlushBySize = this.metricsBatch.length >= this.BATCH_SIZE;
    const shouldFlushByTime = (Date.now() - this.lastBatchTime) >= this.BATCH_INTERVAL_MS;
    return shouldFlushBySize || shouldFlushByTime;
  }
}
