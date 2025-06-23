// Database service implementation with dependency injection support
import { createClient, SupabaseClient, PostgrestSingleResponse } from '@supabase/supabase-js';
import { BaseService, ServiceConfig, RetryConfig } from '../base/base-service.js';
import { IDatabaseService, IServiceContainer, SERVICE_TOKENS } from '../interfaces/service-interfaces.js';
import { environmentManager } from '../../lib/config/environment.js';
import { JobData, JobType, JobStatus, JobFilter, JobUpdateData } from '../../lib/types.js';

export interface DatabaseConfig extends ServiceConfig {
  maxConnections: number;
  connectionTimeout: number;
  queryTimeout: number;
}

export class DatabaseService extends BaseService implements IDatabaseService {
  private supabase: SupabaseClient | null = null;
  private connectionPool: Map<string, SupabaseClient> = new Map();
  private container: IServiceContainer | null = null;
  private readonly defaultRetryConfig: RetryConfig = {
    attempts: 3,
    delay: 1000,
    backoffMultiplier: 2,
    maxDelay: 10000,
  };

  constructor() {
    const config: DatabaseConfig = {
      name: 'DatabaseService',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      circuitBreakerThreshold: 5,
      maxConnections: 10,
      connectionTimeout: 5000,
      queryTimeout: 30000,
    };
    
    super(config);
  }

  protected async initialize(): Promise<void> {
    const supabaseStatus = environmentManager.getServiceStatus('supabase');
    
    if (!supabaseStatus.isAvailable) {
      this.log('warn', `Supabase not configured: ${supabaseStatus.message}`);
      return;
    }

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'x-client-info': 'storybook-worker/1.0.0',
          },
        },
      });

      // Test connection
      await this.testConnection();
      this.log('info', 'Database service initialized successfully');
      
    } catch (error: any) {
      this.log('error', 'Failed to initialize database service', error);
      throw error;
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized');
    }

    const { error } = await this.supabase
      .from('storybook_entries')
      .select('id')
      .limit(1);

    if (error) {
      throw new Error(`Database connection test failed: ${error.message}`);
    }
  }

  /**
   * Execute query with retry and timeout protection
   */
  private async executeQuery<T>(
    operation: string,
    queryFn: (supabase: SupabaseClient) => Promise<{ data: T | null; error: any }>
  ): Promise<T | null> {
    await this.ensureInitialized();
    
    if (!this.supabase) {
      throw new Error('Database service not available');
    }

    if (this.isCircuitBreakerOpen()) {
      throw new Error('Database service circuit breaker is open');
    }

    try {
      const result = await this.withRetry(
        async () => {
          const { data, error } = await this.withTimeout(
            queryFn(this.supabase!),
            (this.config as DatabaseConfig).queryTimeout,
            operation
          );
          
          if (error) {
            const serviceError = this.classifyError(error);
            const errorWithType = new Error(serviceError.message);
            (errorWithType as any).type = serviceError.type;
            (errorWithType as any).retryable = serviceError.retryable;
            throw errorWithType;
          }
          
          return data;
        },
        this.defaultRetryConfig,
        operation
      );

      this.resetCircuitBreaker();
      return result;
      
    } catch (error: any) {
      this.recordCircuitBreakerFailure();
      this.log('error', `Database operation failed: ${operation}`, error);
      throw error;
    }
  }

  /**
   * Get pending jobs across all job tables
   */
  async getPendingJobs(filter: JobFilter = {}, limit: number = 50): Promise<JobData[]> {
    const allPendingJobs: JobData[] = [];
    const jobTypes: JobType[] = ['cartoonize', 'auto-story', 'image-generation', 'storybook', 'scenes'];
    
    for (const jobType of jobTypes) {
      const tableName = this.getTableName(jobType);
      
      const result = await this.executeQuery<any[]>(
        `Get pending jobs from ${tableName}`,
        async (supabase) => {
          let query = supabase
            .from(tableName)
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(Math.ceil(limit / jobTypes.length));

          if (filter.user_id) {
            query = query.eq('user_id', filter.user_id);
          }

          const response = await query;
          return { data: response.data, error: response.error };
        }
      );

      if (result && Array.isArray(result)) {
        const convertedJobs = result.map(job => this.mapFromTableFormat(jobType, job));
        allPendingJobs.push(...convertedJobs);
      }
    }

    allPendingJobs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return allPendingJobs.slice(0, limit);
  }

  /**
   * Get job status from appropriate table
   */
  async getJobStatus(jobId: string): Promise<JobData | null> {
    await this.ensureInitialized();
    
    if (!this.supabase) {
      throw new Error('Database service not available');
    }

    const jobTypes: JobType[] = ['cartoonize', 'auto-story', 'image-generation', 'storybook', 'scenes'];
    
    this.log('info', `Searching for job ${jobId} across ${jobTypes.length} tables`);
    
    for (const jobType of jobTypes) {
      const tableName = this.getTableName(jobType);
      
      try {
        this.log('info', `Checking ${tableName} for job ${jobId}`);
        
        const { data, error } = await this.supabase
          .from(tableName)
          .select('*')
          .eq('id', jobId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            this.log('info', `Job ${jobId} not found in ${tableName} (expected - continuing search)`);
            continue;
          } else {
            this.log('warn', `Database error searching ${tableName} for job ${jobId}`, error.message);
            continue;
          }
        }

        if (data && data.id) {
          this.log('info', `Found job ${jobId} in ${tableName}`);
          return this.mapFromTableFormat(jobType, data);
        } else {
          this.log('info', `Job ${jobId} query successful but no data in ${tableName} - continuing search`);
          continue;
        }

      } catch (error: any) {
        this.log('warn', `Unexpected error searching ${tableName} for job ${jobId}`, error.message);
        continue;
      }
    }

    this.log('warn', `Job not found: ${jobId} (searched all ${jobTypes.length} job tables)`);
    return null;
  }

  /**
   * Update job progress
   */
  async updateJobProgress(jobId: string, progress: number, currentStep?: string): Promise<boolean> {
    const job = await this.getJobStatus(jobId);
    if (!job) {
      throw new Error(`Cannot update progress - job not found: ${jobId}`);
    }

    const tableName = this.getTableName(job.type);
    const updateData: any = {
      progress: Math.max(0, Math.min(100, progress)),
      updated_at: new Date().toISOString()
    };

    if (currentStep) {
      updateData.current_step = currentStep;
    }

    if (progress > 0) {
      updateData.status = 'processing';
      if (!job.started_at) {
        updateData.started_at = new Date().toISOString();
      }
    }

    const result = await this.executeQuery<{ id: string }>(
      'Update job progress',
      async (supabase) => {
        const response = await supabase
          .from(tableName)
          .update(updateData)
          .eq('id', jobId)
          .select('id')
          .single();
        return { data: response.data, error: response.error };
      }
    );

    if (result?.id) {
      this.log('info', `Updated job progress: ${jobId} -> ${progress}%`);
      return true;
    }

    return false;
  }

  /**
   * Mark job as completed
   */
  async markJobCompleted(jobId: string, resultData: any): Promise<boolean> {
    const job = await this.getJobStatus(jobId);
    if (!job) {
      throw new Error(`Cannot mark completed - job not found: ${jobId}`);
    }

    const tableName = this.getTableName(job.type);
    const now = new Date().toISOString();
    
    const updateData: any = {
      status: 'completed',
      progress: 100,
      current_step: 'Completed successfully',
      completed_at: now,
      updated_at: now
    };

    // Add job-type specific result fields
    this.addJobSpecificResultFields(job.type, updateData, resultData);

    const result = await this.executeQuery<{ id: string }>(
      'Mark job completed',
      async (supabase) => {
        const response = await supabase
          .from(tableName)
          .update(updateData)
          .eq('id', jobId)
          .select('id')
          .single();
        return { data: response.data, error: response.error };
      }
    );

    if (result?.id) {
      this.log('info', `Marked job completed: ${jobId}`);
      return true;
    }

    return false;
  }

  /**
   * Mark job as failed
   */
  async markJobFailed(jobId: string, errorMessage: string, shouldRetry: boolean = false): Promise<boolean> {
    const job = await this.getJobStatus(jobId);
    if (!job) {
      throw new Error(`Cannot mark failed - job not found: ${jobId}`);
    }

    const tableName = this.getTableName(job.type);
    const now = new Date().toISOString();
    const newRetryCount = job.retry_count + 1;
    const canRetry = shouldRetry && newRetryCount <= job.max_retries;

    const updateData: any = {
      status: canRetry ? 'pending' : 'failed',
      error_message: errorMessage,
      updated_at: now,
      retry_count: newRetryCount
    };

    if (!canRetry) {
      updateData.completed_at = now;
      updateData.current_step = 'Failed after retries';
    } else {
      updateData.current_step = `Retrying (${newRetryCount}/${job.max_retries})`;
      updateData.progress = 0;
    }

    const result = await this.executeQuery<{ id: string }>(
      'Mark job failed',
      async (supabase) => {
        const response = await supabase
          .from(tableName)
          .update(updateData)
          .eq('id', jobId)
          .select('id')
          .single();
        return { data: response.data, error: response.error };
      }
    );

    if (result?.id) {
      const action = canRetry ? 'scheduled for retry' : 'marked as failed';
      this.log('info', `Job ${action}: ${jobId} - ${errorMessage}`);
      return true;
    }

    return false;
  }

  /**
   * Save storybook entry
   */
  async saveStorybookEntry(data: any): Promise<any> {
    const result = await this.executeQuery<any>(
      'Save storybook entry',
      async (supabase) => {
        const response = await supabase
          .from('storybook_entries')
          .insert({
            title: data.title,
            story: data.story,
            pages: data.pages,
            user_id: data.user_id || null,
            audience: data.audience,
            character_description: data.character_description,
            has_errors: data.has_errors,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();
        return { data: response.data, error: response.error };
      }
    );

    if (!result) {
      throw new Error('Failed to save storybook entry');
    }

    return result;
  }

  /**
   * Execute transaction
   */
  async executeTransaction<T>(
    operations: ((supabase: SupabaseClient) => Promise<T>)[],
    options: any = {}
  ): Promise<T[]> {
    await this.ensureInitialized();
    
    if (!this.supabase) {
      throw new Error('Database service not available');
    }

    const timeout = options.timeout || 60000;
    const retries = options.retries || 1;

    return this.withRetry(
      async () => {
        return this.withTimeout(
          Promise.all(operations.map(op => op(this.supabase!))),
          timeout,
          'transaction'
        );
      },
      { ...this.defaultRetryConfig, attempts: retries },
      'executeTransaction'
    );
  }

  // Helper methods
  private getTableName(jobType: JobType): string {
    const tableMap: Record<JobType, string> = {
      'storybook': 'storybook_jobs',
      'auto-story': 'auto_story_jobs',
      'scenes': 'scene_generation_jobs',
      'cartoonize': 'cartoonize_jobs',
      'image-generation': 'image_generation_jobs'
    };
    return tableMap[jobType];
  }

  private mapFromTableFormat(jobType: JobType, tableData: any): JobData {
    // Implementation matches existing job-manager logic
    const baseJob: any = {
      id: tableData.id?.toString() || '',
      type: jobType,
      status: tableData.status || 'pending',
      progress: tableData.progress || 0,
      current_step: tableData.current_step,
      user_id: tableData.user_id?.toString(),
      created_at: tableData.created_at,
      updated_at: tableData.updated_at,
      started_at: tableData.started_at,
      completed_at: tableData.completed_at,
      error_message: tableData.error_message,
      retry_count: tableData.retry_count || 0,
      max_retries: tableData.max_retries || 3,
      input_data: {},
      result_data: {}
    };

    // Map job-type specific fields
    this.mapJobSpecificFields(jobType, baseJob, tableData);
    
    return baseJob as JobData;
  }

  private mapJobSpecificFields(jobType: JobType, baseJob: any, tableData: any): void {
    if (jobType === 'cartoonize') {
      baseJob.input_data = {
        prompt: tableData.original_image_data || '',
        style: tableData.style || 'cartoon',
        imageUrl: tableData.original_cloudinary_url
      };
      if (tableData.generated_image_url) {
        baseJob.result_data = {
          url: tableData.generated_image_url,
          cached: !!tableData.final_cloudinary_url
        };
      }
    }
    // Add other job type mappings as needed
  }

  private addJobSpecificResultFields(jobType: JobType, updateData: any, resultData: any): void {
    if (jobType === 'cartoonize' && resultData?.url) {
      updateData.generated_image_url = resultData.url;
      if (resultData.cached) {
        updateData.final_cloudinary_url = resultData.url;
      }
    }
    // Add other job type result mappings as needed
  }

  isHealthy(): boolean {
    return this.isInitialized && this.supabase !== null && !this.isCircuitBreakerOpen();
  }

  getStatus() {
    const supabaseStatus = environmentManager.getServiceStatus('supabase');
    return {
      name: this.config.name,
      initialized: this.isInitialized,
      available: this.isHealthy(),
      circuitBreakerOpen: this.isCircuitBreakerOpen(),
      circuitBreakerFailures: this.circuitBreakerFailures,
      supabaseStatus: supabaseStatus.status,
      connectionPoolSize: this.connectionPool.size,
    };
  }
}