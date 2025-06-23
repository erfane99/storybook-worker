// Job service for managing job lifecycle across all job types
import { BaseService, ServiceConfig } from '../base/base-service.js';
import { databaseService } from '../database/database-service.js';
import { JobData, JobType, JobStatus, JobFilter, JobUpdateData } from '../../lib/types.js';

export interface JobConfig extends ServiceConfig {
  maxRetries: number;
  defaultTimeout: number;
  progressUpdateInterval: number;
}

export interface JobMetrics {
  totalJobs: number;
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  successRate: number;
}

export class JobService extends BaseService {
  private jobMetrics: Map<JobType, JobMetrics> = new Map();
  private processingTimes: Map<string, number> = new Map();

  constructor() {
    const config: JobConfig = {
      name: 'JobService',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      circuitBreakerThreshold: 10,
      maxRetries: 3,
      defaultTimeout: 300000, // 5 minutes
      progressUpdateInterval: 5000, // 5 seconds
    };
    
    super(config);
  }

  protected async initialize(): Promise<void> {
    // Initialize job metrics for all job types
    const jobTypes: JobType[] = ['storybook', 'auto-story', 'scenes', 'cartoonize', 'image-generation'];
    
    for (const jobType of jobTypes) {
      this.jobMetrics.set(jobType, {
        totalJobs: 0,
        pendingJobs: 0,
        processingJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        averageProcessingTime: 0,
        successRate: 0,
      });
    }

    this.log('info', 'Job service initialized successfully');
  }

  /**
   * Get pending jobs with filtering
   */
  async getPendingJobs(filter: JobFilter = {}, limit: number = 50): Promise<JobData[]> {
    await this.ensureInitialized();
    
    if (this.isCircuitBreakerOpen()) {
      throw new Error('Job service circuit breaker is open');
    }

    try {
      const jobs = await databaseService.getPendingJobs(filter, limit);
      
      // Update metrics
      this.updateJobMetrics(jobs);
      
      this.resetCircuitBreaker();
      return jobs;
      
    } catch (error: any) {
      this.recordCircuitBreakerFailure();
      this.log('error', 'Failed to get pending jobs', error);
      throw error;
    }
  }

  /**
   * Get job status with caching
   */
  async getJobStatus(jobId: string): Promise<JobData | null> {
    await this.ensureInitialized();
    
    try {
      const job = await databaseService.getJobStatus(jobId);
      
      if (job) {
        this.log('info', `Retrieved job status: ${jobId} (${job.type}, ${job.status})`);
      }
      
      return job;
      
    } catch (error: any) {
      this.log('error', `Failed to get job status: ${jobId}`, error);
      throw error;
    }
  }

  /**
   * Update job progress with validation
   */
  async updateJobProgress(
    jobId: string,
    progress: number,
    currentStep?: string
  ): Promise<boolean> {
    await this.ensureInitialized();
    
    // Validate progress
    if (progress < 0 || progress > 100) {
      throw new Error(`Invalid progress value: ${progress}. Must be between 0 and 100.`);
    }

    try {
      const success = await databaseService.updateJobProgress(jobId, progress, currentStep);
      
      if (success) {
        this.log('info', `Updated job progress: ${jobId} -> ${progress}%${currentStep ? ` (${currentStep})` : ''}`);
        
        // Track processing start time
        if (progress > 0 && !this.processingTimes.has(jobId)) {
          this.processingTimes.set(jobId, Date.now());
        }
      }
      
      return success;
      
    } catch (error: any) {
      this.log('error', `Failed to update job progress: ${jobId}`, error);
      throw error;
    }
  }

  /**
   * Mark job as completed with result validation
   */
  async markJobCompleted(jobId: string, resultData: any): Promise<boolean> {
    await this.ensureInitialized();
    
    if (!resultData) {
      throw new Error('Result data is required when marking job as completed');
    }

    try {
      const success = await databaseService.markJobCompleted(jobId, resultData);
      
      if (success) {
        this.log('info', `Marked job completed: ${jobId}`);
        
        // Calculate and record processing time
        const startTime = this.processingTimes.get(jobId);
        if (startTime) {
          const processingTime = Date.now() - startTime;
          this.recordProcessingTime(jobId, processingTime);
          this.processingTimes.delete(jobId);
        }
        
        // Update metrics
        await this.updateJobCompletionMetrics(jobId, true);
      }
      
      return success;
      
    } catch (error: any) {
      this.log('error', `Failed to mark job completed: ${jobId}`, error);
      throw error;
    }
  }

  /**
   * Mark job as failed with error classification
   */
  async markJobFailed(
    jobId: string,
    errorMessage: string,
    shouldRetry: boolean = false
  ): Promise<boolean> {
    await this.ensureInitialized();
    
    if (!errorMessage) {
      throw new Error('Error message is required when marking job as failed');
    }

    try {
      const success = await databaseService.markJobFailed(jobId, errorMessage, shouldRetry);
      
      if (success) {
        const action = shouldRetry ? 'scheduled for retry' : 'marked as failed';
        this.log('info', `Job ${action}: ${jobId} - ${errorMessage}`);
        
        // Clean up processing time tracking
        this.processingTimes.delete(jobId);
        
        // Update metrics if not retrying
        if (!shouldRetry) {
          await this.updateJobCompletionMetrics(jobId, false);
        }
      }
      
      return success;
      
    } catch (error: any) {
      this.log('error', `Failed to mark job failed: ${jobId}`, error);
      throw error;
    }
  }

  /**
   * Cancel job
   */
  async cancelJob(jobId: string, reason: string = 'Cancelled by user'): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      // First check if job exists and is cancellable
      const job = await this.getJobStatus(jobId);
      if (!job) {
        throw new Error(`Job not found: ${jobId}`);
      }
      
      if (job.status === 'completed' || job.status === 'failed') {
        throw new Error(`Cannot cancel job in ${job.status} status`);
      }
      
      const success = await databaseService.markJobFailed(jobId, `Cancelled: ${reason}`, false);
      
      if (success) {
        this.log('info', `Cancelled job: ${jobId} - ${reason}`);
        this.processingTimes.delete(jobId);
      }
      
      return success;
      
    } catch (error: any) {
      this.log('error', `Failed to cancel job: ${jobId}`, error);
      throw error;
    }
  }

  /**
   * Get job metrics for monitoring
   */
  async getJobMetrics(jobType?: JobType): Promise<JobMetrics | Map<JobType, JobMetrics>> {
    await this.ensureInitialized();
    
    if (jobType) {
      return this.jobMetrics.get(jobType) || {
        totalJobs: 0,
        pendingJobs: 0,
        processingJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        averageProcessingTime: 0,
        successRate: 0,
      };
    }
    
    return new Map(this.jobMetrics);
  }

  /**
   * Get processing statistics
   */
  getProcessingStats() {
    return {
      activeJobs: this.processingTimes.size,
      totalMetrics: Object.fromEntries(this.jobMetrics),
      circuitBreakerStatus: {
        open: this.isCircuitBreakerOpen(),
        failures: this.circuitBreakerFailures,
      },
    };
  }

  // Private helper methods
  private updateJobMetrics(jobs: JobData[]): void {
    // Reset pending counts
    for (const [jobType, metrics] of this.jobMetrics.entries()) {
      metrics.pendingJobs = 0;
    }
    
    // Count pending jobs by type
    for (const job of jobs) {
      const metrics = this.jobMetrics.get(job.type);
      if (metrics) {
        metrics.pendingJobs++;
      }
    }
  }

  private async updateJobCompletionMetrics(jobId: string, success: boolean): Promise<void> {
    try {
      const job = await this.getJobStatus(jobId);
      if (!job) return;
      
      const metrics = this.jobMetrics.get(job.type);
      if (!metrics) return;
      
      metrics.totalJobs++;
      
      if (success) {
        metrics.completedJobs++;
      } else {
        metrics.failedJobs++;
      }
      
      // Update success rate
      metrics.successRate = metrics.completedJobs / (metrics.completedJobs + metrics.failedJobs);
      
    } catch (error) {
      this.log('warn', 'Failed to update job completion metrics', error);
    }
  }

  private recordProcessingTime(jobId: string, processingTime: number): void {
    // This could be enhanced to maintain rolling averages
    this.log('info', `Job ${jobId} processing time: ${processingTime}ms`);
  }

  isHealthy(): boolean {
    return this.isInitialized && 
           databaseService.isHealthy() && 
           !this.isCircuitBreakerOpen();
  }

  getStatus() {
    return {
      name: this.config.name,
      initialized: this.isInitialized,
      available: this.isHealthy(),
      circuitBreakerOpen: this.isCircuitBreakerOpen(),
      circuitBreakerFailures: this.circuitBreakerFailures,
      databaseServiceHealthy: databaseService.isHealthy(),
      activeProcessingJobs: this.processingTimes.size,
      totalJobTypes: this.jobMetrics.size,
    };
  }
}

// Export singleton instance
export const jobService = new JobService();
export default jobService;