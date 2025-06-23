// Enhanced Job Service - Production Implementation
import { EnhancedBaseService } from '../base/enhanced-base-service.js';
import { 
  IJobService,
  ServiceConfig,
  JobFilter,
  JobMetrics
} from '../interfaces/service-contracts.js';
import { 
  Result,
  JobValidationError,
  JobProcessingError,
  JobTimeoutError,
  JobConcurrencyLimitError,
  ErrorFactory
} from '../errors/index.js';
import { JobData, JobType, JobStatus } from '../../lib/types.js';

export interface JobConfig extends ServiceConfig {
  maxRetries: number;
  defaultTimeout: number;
  progressUpdateInterval: number;
}

export class JobService extends EnhancedBaseService implements IJobService {
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

  getName(): string {
    return 'JobService';
  }

  // ===== LIFECYCLE IMPLEMENTATION =====

  protected async initializeService(): Promise<void> {
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
  }

  protected async disposeService(): Promise<void> {
    this.processingTimes.clear();
    this.jobMetrics.clear();
  }

  protected async checkServiceHealth(): Promise<boolean> {
    return this.jobMetrics.size > 0;
  }

  // ===== JOB OPERATIONS IMPLEMENTATION =====

  async getPendingJobs(filter: JobFilter = {}, limit: number = 50): Promise<JobData[]> {
    // This would delegate to the database service in a real implementation
    // For now, return empty array as this is handled by the database service
    return [];
  }

  async getJobStatus(jobId: string): Promise<JobData | null> {
    // This would delegate to the database service in a real implementation
    return null;
  }

  async updateJobProgress(
    jobId: string,
    progress: number,
    currentStep?: string
  ): Promise<boolean> {
    // Validate progress
    if (progress < 0 || progress > 100) {
      throw new Error(`Invalid progress value: ${progress}. Must be between 0 and 100.`);
    }

    // Track processing start time
    if (progress > 0 && !this.processingTimes.has(jobId)) {
      this.processingTimes.set(jobId, Date.now());
    }

    this.log('info', `Updated job progress: ${jobId} -> ${progress}%${currentStep ? ` (${currentStep})` : ''}`);
    return true;
  }

  async markJobCompleted(jobId: string, resultData: any): Promise<boolean> {
    if (!resultData) {
      throw new Error('Result data is required when marking job as completed');
    }

    // Calculate and record processing time
    const startTime = this.processingTimes.get(jobId);
    if (startTime) {
      const processingTime = Date.now() - startTime;
      this.recordProcessingTime(jobId, processingTime);
      this.processingTimes.delete(jobId);
    }

    this.log('info', `Marked job completed: ${jobId}`);
    return true;
  }

  async markJobFailed(
    jobId: string,
    errorMessage: string,
    shouldRetry: boolean = false
  ): Promise<boolean> {
    if (!errorMessage) {
      throw new Error('Error message is required when marking job as failed');
    }

    // Clean up processing time tracking
    this.processingTimes.delete(jobId);

    const action = shouldRetry ? 'scheduled for retry' : 'marked as failed';
    this.log('info', `Job ${action}: ${jobId} - ${errorMessage}`);
    return true;
  }

  async cancelJob(jobId: string, reason: string = 'Cancelled by user'): Promise<boolean> {
    this.processingTimes.delete(jobId);
    this.log('info', `Cancelled job: ${jobId} - ${reason}`);
    return true;
  }

  async getJobMetrics(jobType?: JobType): Promise<JobMetrics | Map<JobType, JobMetrics>> {
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

  // ===== PRIVATE HELPER METHODS =====

  private recordProcessingTime(jobId: string, processingTime: number): void {
    this.log('info', `Job ${jobId} processing time: ${processingTime}ms`);
  }
}

// Export singleton instance
export const jobService = new JobService();
export default jobService;