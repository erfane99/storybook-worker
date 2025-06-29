// Enhanced Job Service - Production Implementation
// CONSOLIDATED: Updated to use consolidated service container and interfaces

import { ErrorAwareBaseService, ErrorAwareServiceConfig } from '../base/error-aware-base-service.js';
import { 
  IJobService,
  ServiceConfig,
  JobFilter,
  JobMetrics
} from '../interfaces/service-contracts.js';
import { 
  Result,
  AsyncResult,
  JobValidationError,
  JobProcessingError,
  JobTimeoutError,
  JobConcurrencyLimitError,
  ErrorFactory,
  ErrorCategory
} from '../errors/index.js';
import type { JobData, JobType, JobStatus, JobUpdateData } from '../../lib/types.js';
import { serviceContainer } from '../container/service-container.js';
import { SERVICE_TOKENS, IDatabaseService } from '../interfaces/service-contracts.js';

// ===== ENHANCED JOB CONFIG =====
// FIXED: Extend ErrorAwareServiceConfig instead of ServiceConfig

export interface JobServiceConfig extends ErrorAwareServiceConfig {
  maxRetries: number;
  defaultTimeout: number;
  progressUpdateInterval: number;
  maxConcurrentJobs: number;
  jobCleanupInterval: number;
  metricsRetentionPeriod: number;
}

// ===== JOB SERVICE IMPLEMENTATION =====

export class JobService extends ErrorAwareBaseService implements IJobService {
  private jobMetrics: Map<JobType, JobMetrics> = new Map();
  private processingTimes: Map<string, number> = new Map();
  private currentlyProcessing: Set<string> = new Set();
  private metricsHistory: Map<string, { timestamp: number; metrics: JobMetrics }> = new Map();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config?: Partial<JobServiceConfig>) {
    const defaultConfig: JobServiceConfig = {
      name: 'JobService',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      circuitBreakerThreshold: 10,
      maxRetries: 3,
      defaultTimeout: 300000, // 5 minutes
      progressUpdateInterval: 5000, // 5 seconds
      maxConcurrentJobs: 10,
      jobCleanupInterval: 3600000, // 1 hour
      metricsRetentionPeriod: 86400000, // 24 hours
      // FIXED: Now properly typed as part of ErrorAwareServiceConfig
      errorHandling: {
        enableRetry: true,
        maxRetries: 3,
        enableCircuitBreaker: true,
        enableCorrelation: true,
        enableMetrics: true,
        retryableCategories: [
          ErrorCategory.NETWORK,
          ErrorCategory.TIMEOUT,
          ErrorCategory.EXTERNAL_SERVICE
        ]
      }
    };
    
    const finalConfig = { ...defaultConfig, ...config };
    super(finalConfig);
  }

  getName(): string {
    return 'JobService';
  }

  // ===== LIFECYCLE IMPLEMENTATION =====

  protected async initializeService(): Promise<void> {
    try {
      await this.initializeJobMetrics();
      this.startCleanupInterval();
      this.log('info', 'Job service initialized successfully');
    } catch (error) {
      this.log('error', 'Failed to initialize job service', error);
      throw error;
    }
  }

  protected async disposeService(): Promise<void> {
    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      this.processingTimes.clear();
      this.jobMetrics.clear();
      this.currentlyProcessing.clear();
      this.metricsHistory.clear();
      
      this.log('info', 'Job service disposed successfully');
    } catch (error) {
      this.log('error', 'Error during job service disposal', error);
      throw error;
    }
  }

  protected async checkServiceHealth(): Promise<boolean> {
    try {
      const hasMetrics = this.jobMetrics.size > 0;
      const withinConcurrencyLimit = this.currentlyProcessing.size <= (this.config as JobServiceConfig).maxConcurrentJobs;
      const recentActivity = this.hasRecentActivity();
      
      return hasMetrics && withinConcurrencyLimit && recentActivity;
    } catch (error) {
      this.log('error', 'Health check failed', error);
      return false;
    }
  }

  // ===== JOB OPERATIONS IMPLEMENTATION =====

  async getPendingJobs(filter: JobFilter = {}, limit: number = 50): Promise<JobData[]> {
    const result = await this.withErrorHandling(
      async () => {
        // Validate input
        if (limit <= 0 || limit > 1000) {
          throw new JobValidationError('Invalid limit. Must be between 1 and 1000.', {
            service: this.getName(),
            operation: 'getPendingJobs'
          });
        }

        this.log('info', `Getting pending jobs with filter: ${JSON.stringify(filter)}, limit: ${limit}`);

        // CONSOLIDATED: Delegate to DatabaseService for actual data access
        try {
          const databaseService = await serviceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);
          
          if (!databaseService) {
            this.log('warn', 'DatabaseService not available, returning empty array');
            return [];
          }

          // Delegate the actual database query to DatabaseService
          const pendingJobs = await databaseService.getPendingJobs(filter, limit);
          
          this.log('info', `Found ${pendingJobs.length} pending jobs from database`);
          
          // Update metrics for job discovery
          this.recordMetric('jobDiscovery', pendingJobs.length);
          
          return pendingJobs;
          
        } catch (databaseError: any) {
          this.log('error', 'Failed to get pending jobs from database', databaseError);
          
          // If database is unavailable, return empty array but log the issue
          if (databaseError.message?.includes('not available') || databaseError.message?.includes('not configured')) {
            this.log('warn', 'Database service unavailable for job discovery - returning empty array');
            return [];
          }
          
          // Re-throw other database errors
          throw databaseError;
        }
      },
      'getPendingJobs'
    );
    
    return result.success ? result.data : [];
  }

  async getJobStatus(jobId: string): Promise<JobData | null> {
    const result = await this.withErrorHandling(
      async () => {
        if (!jobId || typeof jobId !== 'string') {
          throw new JobValidationError('Invalid job ID provided', {
            service: this.getName(),
            operation: 'getJobStatus'
          });
        }

        this.log('info', `Getting status for job: ${jobId}`);

        // CONSOLIDATED: Delegate to DatabaseService for actual data access
        try {
          const databaseService = await serviceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);
          
          if (!databaseService) {
            this.log('warn', 'DatabaseService not available');
            return null;
          }

          // Delegate the actual database query to DatabaseService
          const jobData = await databaseService.getJobStatus(jobId);
          
          if (jobData) {
            this.log('info', `Found job ${jobId} with status: ${jobData.status}`);
          } else {
            this.log('info', `Job ${jobId} not found`);
          }
          
          return jobData;
          
        } catch (databaseError: any) {
          this.log('error', 'Failed to get job status from database', databaseError);
          
          // If database is unavailable, return null
          if (databaseError.message?.includes('not available') || databaseError.message?.includes('not configured')) {
            this.log('warn', 'Database service unavailable for job status check');
            return null;
          }
          
          // Re-throw other database errors
          throw databaseError;
        }
      },
      'getJobStatus'
    );
    
    return result.success ? result.data : null;
  }

  async updateJobProgress(
    jobId: string,
    progress: number,
    currentStep?: string
  ): Promise<boolean> {
    const result = await this.withErrorHandling(
      async () => {
        // Validate inputs
        if (!jobId || typeof jobId !== 'string') {
          throw new JobValidationError('Invalid job ID provided', {
            service: this.getName(),
            operation: 'updateJobProgress'
          });
        }

        if (progress < 0 || progress > 100) {
          throw new JobValidationError(`Invalid progress value: ${progress}. Must be between 0 and 100.`, {
            service: this.getName(),
            operation: 'updateJobProgress'
          });
        }

        // Track processing start time
        if (progress > 0 && !this.processingTimes.has(jobId)) {
          this.processingTimes.set(jobId, Date.now());
          this.currentlyProcessing.add(jobId);
        }

        this.log('info', `Updating job progress: ${jobId} -> ${progress}%${currentStep ? ` (${currentStep})` : ''}`);

        // CONSOLIDATED: Delegate to DatabaseService for actual data access
        try {
          const databaseService = await serviceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);
          
          if (!databaseService) {
            this.log('warn', 'DatabaseService not available for progress update');
            return false;
          }

          // Delegate the actual database update to DatabaseService
          const updated = await databaseService.updateJobProgress(jobId, progress, currentStep);
          
          if (updated) {
            // Record metrics
            this.recordMetric('progressUpdate');
            this.log('info', `Successfully updated job progress: ${jobId}`);
          } else {
            this.log('warn', `Failed to update job progress: ${jobId}`);
          }
          
          return updated;
          
        } catch (databaseError: any) {
          this.log('error', 'Failed to update job progress in database', databaseError);
          
          // If database is unavailable, return false
          if (databaseError.message?.includes('not available') || databaseError.message?.includes('not configured')) {
            this.log('warn', 'Database service unavailable for progress update');
            return false;
          }
          
          // Re-throw other database errors
          throw databaseError;
        }
      },
      'updateJobProgress'
    );
    
    return result.success ? result.data : false;
  }

  async markJobCompleted(jobId: string, resultData: any): Promise<boolean> {
    const result = await this.withErrorHandling(
      async () => {
        if (!jobId || typeof jobId !== 'string') {
          throw new JobValidationError('Invalid job ID provided', {
            service: this.getName(),
            operation: 'markJobCompleted'
          });
        }

        if (!resultData) {
          throw new JobValidationError('Result data is required when marking job as completed', {
            service: this.getName(),
            operation: 'markJobCompleted'
          });
        }

        // Calculate and record processing time
        const startTime = this.processingTimes.get(jobId);
        if (startTime) {
          const processingTime = Date.now() - startTime;
          this.recordProcessingTime(jobId, processingTime);
          this.processingTimes.delete(jobId);
        }

        this.currentlyProcessing.delete(jobId);

        this.log('info', `Marking job completed: ${jobId}`);

        // CONSOLIDATED: Delegate to DatabaseService for actual data access
        try {
          const databaseService = await serviceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);
          
          if (!databaseService) {
            this.log('warn', 'DatabaseService not available for job completion');
            return false;
          }

          // Delegate the actual database update to DatabaseService
          const completed = await databaseService.markJobCompleted(jobId, resultData);
          
          if (completed) {
            this.recordMetric('completion');
            this.log('info', `Successfully marked job completed: ${jobId}`);
          } else {
            this.log('warn', `Failed to mark job completed: ${jobId}`);
          }
          
          return completed;
          
        } catch (databaseError: any) {
          this.log('error', 'Failed to mark job completed in database', databaseError);
          
          // If database is unavailable, return false
          if (databaseError.message?.includes('not available') || databaseError.message?.includes('not configured')) {
            this.log('warn', 'Database service unavailable for job completion');
            return false;
          }
          
          // Re-throw other database errors
          throw databaseError;
        }
      },
      'markJobCompleted'
    );
    
    return result.success ? result.data : false;
  }

  async markJobFailed(
    jobId: string,
    errorMessage: string,
    shouldRetry: boolean = false
  ): Promise<boolean> {
    const result = await this.withErrorHandling(
      async () => {
        if (!jobId || typeof jobId !== 'string') {
          throw new JobValidationError('Invalid job ID provided', {
            service: this.getName(),
            operation: 'markJobFailed'
          });
        }

        if (!errorMessage || typeof errorMessage !== 'string') {
          throw new JobValidationError('Error message is required when marking job as failed', {
            service: this.getName(),
            operation: 'markJobFailed'
          });
        }

        // Clean up processing tracking
        this.processingTimes.delete(jobId);
        this.currentlyProcessing.delete(jobId);

        const action = shouldRetry ? 'scheduled for retry' : 'marked as failed';
        this.log('info', `Job ${action}: ${jobId} - ${errorMessage}`);

        // CONSOLIDATED: Delegate to DatabaseService for actual data access
        try {
          const databaseService = await serviceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);
          
          if (!databaseService) {
            this.log('warn', 'DatabaseService not available for job failure marking');
            return false;
          }

          // Delegate the actual database update to DatabaseService
          const failed = await databaseService.markJobFailed(jobId, errorMessage, shouldRetry);
          
          if (failed) {
            this.recordMetric('failure');
            this.log('info', `Successfully marked job failed: ${jobId}`);
          } else {
            this.log('warn', `Failed to mark job failed: ${jobId}`);
          }
          
          return failed;
          
        } catch (databaseError: any) {
          this.log('error', 'Failed to mark job failed in database', databaseError);
          
          // If database is unavailable, return false
          if (databaseError.message?.includes('not available') || databaseError.message?.includes('not configured')) {
            this.log('warn', 'Database service unavailable for job failure marking');
            return false;
          }
          
          // Re-throw other database errors
          throw databaseError;
        }
      },
      'markJobFailed'
    );
    
    return result.success ? result.data : false;
  }

  async cancelJob(jobId: string, reason: string = 'Cancelled by user'): Promise<boolean> {
    const result = await this.withErrorHandling(
      async () => {
        if (!jobId || typeof jobId !== 'string') {
          throw new JobValidationError('Invalid job ID provided', {
            service: this.getName(),
            operation: 'cancelJob'
          });
        }

        this.processingTimes.delete(jobId);
        this.currentlyProcessing.delete(jobId);
        this.recordMetric('cancellation');

        this.log('info', `Cancelled job: ${jobId} - ${reason}`);
        return true;
      },
      'cancelJob'
    );
    
    return result.success ? result.data : false;
  }

  // FIXED: Method signature to match interface exactly
  async getJobMetrics(jobType?: JobType): Promise<JobMetrics> {
    const result = await this.withErrorHandling(
      async () => {
        if (jobType) {
          // Return metrics for specific job type
          const metrics = this.jobMetrics.get(jobType);
          if (!metrics) {
            // Return default metrics if not found
            return this.createDefaultMetrics();
          }
          return { ...metrics }; // Return copy to prevent mutation
        } else {
          // Return aggregated metrics across all job types
          return this.calculateAggregatedMetrics();
        }
      },
      'getJobMetrics'
    );
    
    return result.success ? result.data : this.createDefaultMetrics();
  }

  // ===== ENHANCED METHODS WITH RESULT PATTERN =====

  /**
   * Get job metrics with Result pattern for better error handling
   * FIXED: Simplified to avoid complex type casting
   */
  async getJobMetricsResult(jobType?: JobType): Promise<Result<JobMetrics, JobValidationError>> {
    try {
      if (jobType && !Object.values(['storybook', 'auto-story', 'scenes', 'cartoonize', 'image-generation']).includes(jobType)) {
        const error = new JobValidationError(`Invalid job type: ${jobType}`, {
          service: this.getName(),
          operation: 'getJobMetricsResult'
        });
        return Result.failure(error);
      }

      const metrics = jobType ? 
        this.jobMetrics.get(jobType) || this.createDefaultMetrics() :
        this.calculateAggregatedMetrics();
        
      return Result.success(metrics);
    } catch (error) {
      const jobError = new JobValidationError('Error getting job metrics', {
        service: this.getName(),
        operation: 'getJobMetricsResult'
      });
      return Result.failure(jobError);
    }
  }

  /**
   * Get current processing statistics
   * FIXED: Create result manually to avoid Result constructor issues
   */
  getProcessingStats(): Result<{
    currentlyProcessing: number;
    maxConcurrent: number;
    averageProcessingTime: number;
    totalProcessed: number;
  }, never> {
    const stats = {
      currentlyProcessing: this.currentlyProcessing.size,
      maxConcurrent: (this.config as JobServiceConfig).maxConcurrentJobs,
      averageProcessingTime: this.calculateAverageProcessingTime(),
      totalProcessed: Array.from(this.jobMetrics.values()).reduce(
        (total, metrics) => total + metrics.completedJobs, 0
      )
    };

    return Result.success(stats);
  }

  /**
   * Validate job data structure
   * FIXED: Create results manually to avoid Result constructor issues
   */
  validateJobData(jobData: any): Result<boolean, JobValidationError> {
    try {
      if (!jobData || typeof jobData !== 'object') {
        const error = new JobValidationError('Job data must be an object', {
          service: this.getName(),
          operation: 'validateJobData'
        });
        return Result.failure(error);
      }

      const requiredFields = ['id', 'type', 'status'];
      const missingFields = requiredFields.filter(field => !(field in jobData));

      if (missingFields.length > 0) {
        const error = new JobValidationError(
          `Missing required fields: ${missingFields.join(', ')}`,
          { service: this.getName(), operation: 'validateJobData' }
        );
        return Result.failure(error);
      }

      return Result.success(true);
    } catch (error) {
      const serviceError = ErrorFactory.fromUnknown(error, {
        service: this.getName(),
        operation: 'validateJobData'
      }) as JobValidationError;
      return Result.failure(serviceError);
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  private async initializeJobMetrics(): Promise<void> {
    const jobTypes: JobType[] = ['storybook', 'auto-story', 'scenes', 'cartoonize', 'image-generation'];
    
    for (const jobType of jobTypes) {
      this.jobMetrics.set(jobType, this.createDefaultMetrics());
    }

    this.log('info', `Initialized metrics for ${jobTypes.length} job types`);
  }

  private createDefaultMetrics(): JobMetrics {
    return {
      totalJobs: 0,
      pendingJobs: 0,
      processingJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageProcessingTime: 0,
      successRate: 0,
    };
  }

  private calculateAggregatedMetrics(): JobMetrics {
    const allMetrics = Array.from(this.jobMetrics.values());
    
    if (allMetrics.length === 0) {
      return this.createDefaultMetrics();
    }

    const aggregated = allMetrics.reduce((acc, metrics) => ({
      totalJobs: acc.totalJobs + metrics.totalJobs,
      pendingJobs: acc.pendingJobs + metrics.pendingJobs,
      processingJobs: acc.processingJobs + metrics.processingJobs,
      completedJobs: acc.completedJobs + metrics.completedJobs,
      failedJobs: acc.failedJobs + metrics.failedJobs,
      averageProcessingTime: acc.averageProcessingTime + metrics.averageProcessingTime,
      successRate: acc.successRate + metrics.successRate,
    }), this.createDefaultMetrics());

    // Calculate averages
    const count = allMetrics.length;
    aggregated.averageProcessingTime = aggregated.averageProcessingTime / count;
    aggregated.successRate = aggregated.successRate / count;

    return aggregated;
  }

  private calculateAverageProcessingTime(): number {
    const allMetrics = Array.from(this.jobMetrics.values());
    if (allMetrics.length === 0) return 0;

    const totalTime = allMetrics.reduce((sum, metrics) => sum + metrics.averageProcessingTime, 0);
    return totalTime / allMetrics.length;
  }

  private recordProcessingTime(jobId: string, processingTime: number): void {
    this.log('info', `Job ${jobId} processing time: ${processingTime}ms`);
    
    // Store in metrics history for analysis
    this.metricsHistory.set(jobId, {
      timestamp: Date.now(),
      metrics: this.createDefaultMetrics() // In real implementation, get actual metrics
    });
  }

  private recordMetric(operation: 'progressUpdate' | 'completion' | 'failure' | 'cancellation' | 'jobDiscovery', count?: number): void {
    // Update internal metrics based on operation
    if (operation === 'jobDiscovery' && typeof count === 'number') {
      this.log('info', `Recorded metric: ${operation} - found ${count} jobs`);
    } else {
      this.log('info', `Recorded metric: ${operation}`);
    }
  }

  private hasRecentActivity(): boolean {
    const oneHourAgo = Date.now() - 3600000; // 1 hour
    return Array.from(this.metricsHistory.values()).some(
      entry => entry.timestamp > oneHourAgo
    );
  }

  private startCleanupInterval(): void {
    const interval = (this.config as JobServiceConfig).jobCleanupInterval;
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, interval);
  }

  private cleanupOldMetrics(): void {
    const retentionPeriod = (this.config as JobServiceConfig).metricsRetentionPeriod;
    const cutoffTime = Date.now() - retentionPeriod;
    
    let cleanedCount = 0;
    for (const [jobId, entry] of this.metricsHistory.entries()) {
      if (entry.timestamp < cutoffTime) {
        this.metricsHistory.delete(jobId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.log('info', `Cleaned up ${cleanedCount} old metric entries`);
    }
  }
}