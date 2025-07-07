// Consolidated Database Service - Production Implementation with Direct Environment Variable Access
import { createClient, SupabaseClient, PostgrestSingleResponse } from '@supabase/supabase-js';
import { EnhancedBaseService } from '../base/enhanced-base-service.js';
import { 
  IDatabaseService, 
  StorybookEntryData, 
  StorybookEntry, 
  DatabaseOperation,
  JobFilter,
  ServiceConfig,
  RetryConfig,
  QualityMetrics,
  UserRating,
  QualityTrendData,
} from '../interfaces/service-contracts.js';
import { 
  Result,
  DatabaseConnectionError,
  DatabaseQueryError,
  DatabaseTimeoutError,
  JobNotFoundError,
  ErrorFactory
} from '../errors/index.js';
import { JobData, JobType, JobStatus } from '../../lib/types.js';

interface DatabaseConfig extends ServiceConfig {
  maxConnections: number;
  connectionTimeout: number;
  queryTimeout: number;
}

export class DatabaseService extends EnhancedBaseService implements IDatabaseService {
  private supabase: SupabaseClient | null = null;
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

  getName(): string {
    return 'DatabaseService';
  }

  // ===== LIFECYCLE IMPLEMENTATION =====

  protected async initializeService(): Promise<void> {
    // ✅ DIRECT ENV VAR ACCESS: No environment service dependency
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase not configured: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }

    // ✅ DIRECT VALIDATION: Simple environment variable validation
    if (supabaseUrl.length < 10 || supabaseKey.length < 20) {
      throw new Error('Supabase environment variables appear to be invalid or too short');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      db: { schema: 'public' },
      global: {
        headers: { 'x-client-info': 'storybook-worker/1.0.0' },
      },
    });

    // Test connection
    await this.testConnection();
    this.log('info', 'Database service initialized with verified Supabase connectivity');
  }

  protected async disposeService(): Promise<void> {
    if (this.supabase) {
      this.supabase = null;
    }
  }

  // ✅ ENTERPRISE HEALTH: Independent service health checking
  protected async checkServiceHealth(): Promise<boolean> {
    if (!this.supabase) {
      return false;
    }

    // ✅ DIRECT ENV VAR CHECK: Verify environment variables are still available
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return false;
    }

    try {
      const { error } = await this.supabase
        .from('storybook_entries')
        .select('id')
        .limit(1);

      return !error;
    } catch (error) {
      return false;
    }
  }

  // ===== DATABASE OPERATIONS IMPLEMENTATION =====

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

  async getJobStatus(jobId: string): Promise<JobData | null> {
    if (!this.supabase) {
      throw new Error('Database service not available');
    }

    const jobTypes: JobType[] = ['cartoonize', 'auto-story', 'image-generation', 'storybook', 'scenes'];
    
    for (const jobType of jobTypes) {
      const tableName = this.getTableName(jobType);
      
      try {
        const { data, error } = await this.supabase
          .from(tableName)
          .select('*')
          .eq('id', jobId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            continue; // Job not in this table
          } else {
            this.log('warn', `Database error searching ${tableName} for job ${jobId}`, error.message);
            continue;
          }
        }

        if (data && data.id) {
          return this.mapFromTableFormat(jobType, data);
        }
      } catch (error: any) {
        this.log('warn', `Unexpected error searching ${tableName} for job ${jobId}`, error.message);
        continue;
      }
    }

    return null;
  }

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

    return !!result?.id;
  }

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

    return !!result?.id;
  }

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

    return !!result?.id;
  }

  async saveStorybookEntry(data: StorybookEntryData): Promise<StorybookEntry> {
    const result = await this.executeQuery<StorybookEntry>(
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

  async getStorybookEntry(id: string): Promise<StorybookEntry | null> {
    const result = await this.executeQuery<StorybookEntry>(
      'Get storybook entry',
      async (supabase) => {
        const response = await supabase
          .from('storybook_entries')
          .select('*')
          .eq('id', id)
          .single();
        return { data: response.data, error: response.error };
      }
    );

    return result;
  }

  async executeTransaction<T>(operations: DatabaseOperation<T>[]): Promise<T[]> {
    if (!this.supabase) {
      throw new Error('Database service not available');
    }

    return this.withRetry(
      async () => {
        return this.withTimeout(
          Promise.all(operations.map(op => op(this.supabase!))),
          (this.config as DatabaseConfig).queryTimeout,
          'transaction'
        );
      },
      this.defaultRetryConfig,
      'executeTransaction'
    );
  }

  // ===== QUALITY MEASUREMENT SYSTEM IMPLEMENTATION =====

  async saveQualityMetrics(comicId: string, qualityData: QualityMetrics): Promise<boolean> {
    const result = await this.executeQuery<{ id: string }>(
      'Save quality metrics',
      async (supabase) => {
        const qualityRecord = {
          comic_id: comicId,
          automated_scores: qualityData.automatedScores || {},
          generation_metrics: qualityData.generationMetrics || {},
          quality_grade: qualityData.automatedScores?.qualityGrade || 'C',
          overall_technical_quality: qualityData.automatedScores?.overallTechnicalQuality || 75,
          character_consistency_score: qualityData.automatedScores?.characterConsistencyScore || 75,
          environmental_coherence_score: qualityData.automatedScores?.environmentalCoherenceScore || 75,
          narrative_flow_score: qualityData.automatedScores?.narrativeFlowScore || 75,
          created_at: new Date().toISOString(),
        };

        const response = await supabase
          .from('comic_quality_metrics')
          .upsert(qualityRecord, { onConflict: 'comic_id' })
          .select('id')
          .single();
        return { data: response.data, error: response.error };
      }
    );

    return !!result?.id;
  }

  async getQualityMetrics(comicId: string): Promise<QualityMetrics | null> {
    const result = await this.executeQuery<any>(
      'Get quality metrics',
      async (supabase) => {
        const response = await supabase
          .from('comic_quality_metrics')
          .select('*')
          .eq('comic_id', comicId)
          .single();
        return { data: response.data, error: response.error };
      }
    );

    if (!result) return null;

    // Convert database format back to QualityMetrics
    return {
      characterConsistency: result.character_consistency_score || 75,
      environmentalConsistency: result.environmental_coherence_score || 75,
      storyCoherence: result.narrative_flow_score || 75,
      panelCount: result.automated_scores?.analysisDetails?.panelsAnalyzed || 0,
      professionalStandards: result.quality_grade !== 'F',
      automatedScores: result.automated_scores,
      generationMetrics: result.generation_metrics,
    };
  }

  async saveUserRating(rating: UserRating): Promise<boolean> {
    const result = await this.executeQuery<{ id: string }>(
      'Save user rating',
      async (supabase) => {
        const ratingRecord = {
          comic_id: rating.comicId,
          user_id: rating.userId,
          ratings: rating.ratings,
          character_consistency_rating: rating.ratings.characterConsistency,
          story_flow_narrative_rating: rating.ratings.storyFlowNarrative,
          art_quality_visual_appeal_rating: rating.ratings.artQualityVisualAppeal,
          scene_background_consistency_rating: rating.ratings.sceneBackgroundConsistency,
          overall_comic_experience_rating: rating.ratings.overallComicExperience,
          comment: rating.comment,
          time_spent_reading: rating.timeSpentReading || 0,
          would_recommend: rating.wouldRecommend,
          rating_date: rating.ratingDate,
        };

        const response = await supabase
          .from('user_ratings')
          .upsert(ratingRecord, { onConflict: 'comic_id,user_id' })
          .select('id')
          .single();
        return { data: response.data, error: response.error };
      }
    );

    return !!result?.id;
  }

  async getUserRatings(comicId: string): Promise<UserRating[]> {
    const result = await this.executeQuery<any[]>(
      'Get user ratings',
      async (supabase) => {
        const response = await supabase
          .from('user_ratings')
          .select('*')
          .eq('comic_id', comicId)
          .order('rating_date', { ascending: false });
        return { data: response.data, error: response.error };
      }
    );

    if (!result || !Array.isArray(result)) return [];

    return result.map(record => ({
      id: record.id,
      comicId: record.comic_id,
      userId: record.user_id,
      ratings: {
        characterConsistency: record.character_consistency_rating,
        storyFlowNarrative: record.story_flow_narrative_rating,
        artQualityVisualAppeal: record.art_quality_visual_appeal_rating,
        sceneBackgroundConsistency: record.scene_background_consistency_rating,
        overallComicExperience: record.overall_comic_experience_rating,
      },
      averageRating: record.average_rating,
      comment: record.comment,
      ratingDate: record.rating_date,
      timeSpentReading: record.time_spent_reading,
      wouldRecommend: record.would_recommend,
    }));
  }

  async getQualityTrends(timeframe: string, limit: number = 30): Promise<QualityTrendData[]> {
    const result = await this.executeQuery<any[]>(
      'Get quality trends',
      async (supabase) => {
        const response = await supabase
          .from('quality_trends')
          .select('*')
          .eq('timeframe', timeframe)
          .order('period_start', { ascending: false })
          .limit(limit);
        return { data: response.data, error: response.error };
      }
    );

    if (!result || !Array.isArray(result)) return [];

    return result.map(record => ({
      timeframe: record.timeframe,
      averageScores: {
        technical: record.technical_score_avg || 0,
        userSatisfaction: record.user_satisfaction_avg || 0,
        combined: record.combined_quality_score || 0,
      },
      improvementRate: record.improvement_rate || 0,
      totalComicsAnalyzed: record.total_comics_analyzed || 0,
      qualityDistribution: record.quality_distribution || {
        excellent: 0,
        good: 0,
        average: 0,
        poor: 0,
        failing: 0,
      },
    }));
  }

  // ===== PRIVATE HELPER METHODS =====

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

  private async executeQuery<T>(
    operation: string,
    queryFn: (supabase: SupabaseClient) => Promise<{ data: T | null; error: any }>
  ): Promise<T | null> {
    if (!this.supabase) {
      throw new Error('Database service not available');
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

      return result;
    } catch (error: any) {
      this.log('error', `Database operation failed: ${operation}`, error);
      throw error;
    }
  }

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
    };

    // Map job-type specific fields
    this.mapJobSpecificFields(jobType, baseJob, tableData);
    
    return baseJob as JobData;
  }

  private mapJobSpecificFields(jobType: JobType, baseJob: any, tableData: any): void {
    if (jobType === 'cartoonize') {
      baseJob.original_image_data = tableData.original_image_data || '';
      baseJob.style = tableData.style || 'cartoon';
      baseJob.original_cloudinary_url = tableData.original_cloudinary_url;
      baseJob.generated_image_url = tableData.generated_image_url;
      baseJob.final_cloudinary_url = tableData.final_cloudinary_url;
    } else if (jobType === 'storybook') {
      baseJob.title = tableData.title;
      baseJob.story = tableData.story;
      baseJob.character_image = tableData.character_image;
      baseJob.pages = tableData.pages || [];
      baseJob.audience = tableData.audience;
      baseJob.is_reused_image = tableData.is_reused_image;
      baseJob.character_description = tableData.character_description;
      baseJob.character_art_style = tableData.character_art_style;
      baseJob.layout_type = tableData.layout_type;
      baseJob.processed_pages = tableData.processed_pages;
      baseJob.storybook_entry_id = tableData.storybook_entry_id;
    }
    // Add other job type mappings as needed
  }

  private addJobSpecificResultFields(jobType: JobType, updateData: any, resultData: any): void {
    if (jobType === 'cartoonize') {
      if (resultData?.generated_image_url) {
        updateData.generated_image_url = resultData.generated_image_url;
      }
      if (resultData?.final_cloudinary_url) {
        updateData.final_cloudinary_url = resultData.final_cloudinary_url;
      }
    } else if (jobType === 'storybook') {
      if (resultData?.storybook_id) {
        updateData.storybook_entry_id = resultData.storybook_id;
      }
      if (resultData?.pages) {
        updateData.processed_pages = resultData.pages;
      }
    }
    // Add other job type result mappings as needed
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
export default databaseService;