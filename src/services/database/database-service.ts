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
  SuccessPattern,
  LearningMetrics
} from '../interfaces/service-contracts';
import { 
  Result,
  DatabaseConnectionError,
  DatabaseQueryError,
  DatabaseTimeoutError,
  JobNotFoundError,
  ErrorFactory
} from '../errors/index';
import { JobData, JobType, JobStatus } from '../../lib/types';

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
      const missingVars = [];
      if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
      if (!supabaseKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
      
      throw new Error(`Supabase not configured for worker environment: Missing ${missingVars.join(', ')} environment variables`);
    }

    // ✅ DIRECT VALIDATION: Simple environment variable validation
    if (supabaseUrl.length < 10 || supabaseKey.length < 20) {
      throw new Error(`Supabase environment variables appear to be invalid: URL length=${supabaseUrl.length}, Key length=${supabaseKey.length}`);
    }

    this.log('info', `Initializing Supabase client for worker environment...`);
    this.log('info', `Supabase URL: ${supabaseUrl.substring(0, 30)}...`);
    this.log('info', `Service Key: ${supabaseKey.substring(0, 10)}...`);

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      db: { schema: 'public' },
      global: {
        headers: { 'x-client-info': 'storybook-worker/1.0.0' },
      },
    });

    // Test connection
    this.log('info', 'Testing Supabase connection...');
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
    const qualityMetrics = {
      characterConsistency: result.character_consistency_score || 75,
      storyCoherence: result.narrative_flow_score || 75,
      panelCount: result.automated_scores?.analysisDetails?.panelsAnalyzed || 0,
      professionalStandards: result.quality_grade !== 'F',
      automatedScores: result.automated_scores,
      generationMetrics: result.generation_metrics,
      // Add missing required fields with safe defaults
      narrativeCoherence: result.narrative_flow_score || 75,
      visualQuality: 0,
      emotionalResonance: 0,
      technicalExecution: 0,
      audienceAlignment: 0,
      dialogueEffectiveness: 0,
      environmentalCoherence: 0,
      overallScore: result.overall_technical_quality || 75,
      grade: result.quality_grade || 'C',
      professionalGrade: result.quality_grade || 'C',
      recommendations: []
    };

    return qualityMetrics;
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

  // ===== SUCCESS PATTERN LEARNING SYSTEM IMPLEMENTATION =====

  async saveSuccessPattern(pattern: SuccessPattern): Promise<boolean> {
    const result = await this.executeQuery<{ id: string }>(
      'Save success pattern',
      async (supabase) => {
        const patternRecord = {
          pattern_type: pattern.patternType,
          context_signature: pattern.contextSignature,
          success_criteria: pattern.successCriteria || {},
          pattern_data: pattern.patternData || {},
          usage_context: pattern.usageContext || {},
          quality_scores: pattern.qualityScores || {},
          effectiveness_score: pattern.effectivenessScore || 0,
          usage_count: pattern.usageCount || 1,
          success_rate: pattern.successRate || 100,
          audience_type: pattern.usageContext.audience,
          story_genre: pattern.usageContext.genre,
          art_style: pattern.usageContext.artStyle,
          environmental_setting: pattern.usageContext.environmentalSetting,
          character_type: pattern.usageContext.characterType,
          created_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        };

        const response = await supabase
          .from('success_patterns')
          .upsert(patternRecord, { onConflict: 'context_signature,pattern_type' })
          .select('id')
          .single();
        return { data: response.data, error: response.error };
      }
    );

    return !!result?.id;
  }

  async getSuccessPatterns(
    context: {
      audience?: string;
      genre?: string;
      artStyle?: string;
      environmentalSetting?: string;
      characterType?: string;
    },
    limit: number = 10
  ): Promise<SuccessPattern[]> {
    const result = await this.executeQuery<any[]>(
      'Get success patterns',
      async (supabase) => {
        let query = supabase
          .from('success_patterns')
          .select('*')
          .order('effectiveness_score', { ascending: false })
          .limit(limit);

        // Apply context filters
        if (context.audience) {
          query = query.eq('audience_type', context.audience);
        }
        if (context.genre) {
          query = query.eq('story_genre', context.genre);
        }
        if (context.artStyle) {
          query = query.eq('art_style', context.artStyle);
        }
        if (context.environmentalSetting) {
          query = query.eq('environmental_setting', context.environmentalSetting);
        }
        if (context.characterType) {
          query = query.eq('character_type', context.characterType);
        }

        const response = await query;
        return { data: response.data, error: response.error };
      }
    );

    if (!result || !Array.isArray(result)) return [];

    return result.map(record => ({
      id: record.id,
      patternType: record.pattern_type,
      contextSignature: record.context_signature,
      successCriteria: record.success_criteria || {},
      patternData: record.pattern_data || {},
      usageContext: record.usage_context || {},
      qualityScores: record.quality_scores || {},
      effectivenessScore: record.effectiveness_score || 0,
      usageCount: record.usage_count || 0,
      successRate: record.success_rate || 0,
      createdAt: record.created_at,
      lastUsedAt: record.last_used_at,
    }));
  }

  async updatePatternEffectiveness(
    patternId: string,
    comicId: string,
    effectivenessData: {
      qualityImprovement: any;
      beforeScores: any;
      afterScores: any;
      userSatisfactionImpact: number;
      technicalQualityImpact: number;
      effectivenessRating: number;
    }
  ): Promise<boolean> {
    const result = await this.executeQuery<{ id: string }>(
      'Update pattern effectiveness',
      async (supabase) => {
        const effectivenessRecord = {
          pattern_id: patternId,
          comic_id: comicId,
          application_context: {},
          quality_improvement: effectivenessData.qualityImprovement || {},
          before_scores: effectivenessData.beforeScores || {},
          after_scores: effectivenessData.afterScores || {},
          user_satisfaction_impact: effectivenessData.userSatisfactionImpact || 0,
          technical_quality_impact: effectivenessData.technicalQualityImpact || 0,
          effectiveness_rating: effectivenessData.effectivenessRating || 0,
          created_at: new Date().toISOString(),
        };

        const response = await supabase
          .from('pattern_effectiveness')
          .insert(effectivenessRecord)
          .select('id')
          .single();
        return { data: response.data, error: response.error };
      }
    );

    return !!result?.id;
  }

  async logPromptEvolution(
    evolutionData: {
      evolutionType: string;
      originalPrompt: string;
      evolvedPrompt: string;
      improvementRationale: string;
      patternsApplied: string[];
      contextMatch: any;
      expectedImprovements: any;
      comicId?: string;
    }
  ): Promise<boolean> {
    const result = await this.executeQuery<{ id: string }>(
      'Log prompt evolution',
      async (supabase) => {
        const evolutionRecord = {
          evolution_type: evolutionData.evolutionType,
          original_prompt: evolutionData.originalPrompt,
          evolved_prompt: evolutionData.evolvedPrompt,
          improvement_rationale: evolutionData.improvementRationale,
          patterns_applied: evolutionData.patternsApplied || [],
          context_match: evolutionData.contextMatch || {},
          expected_improvements: evolutionData.expectedImprovements || {},
          comic_id: evolutionData.comicId,
          created_at: new Date().toISOString(),
        };

        const response = await supabase
          .from('prompt_evolution_log')
          .insert(evolutionRecord)
          .select('id')
          .single();
        return { data: response.data, error: response.error };
      }
    );

    return !!result?.id;
  }

  async getLearningMetrics(): Promise<LearningMetrics> {
    const result = await this.executeQuery<any>(
      'Get learning metrics',
      async (supabase) => {
        // Get pattern statistics
        const { data: patternStats, error: patternError } = await supabase
          .from('success_patterns')
          .select('pattern_type, effectiveness_score, success_rate, created_at')
          .order('created_at', { ascending: false });

        if (patternError) {
          throw new Error(`Failed to get pattern stats: ${patternError.message}`);
        }

        // Get recent effectiveness data
        const { data: recentEffectiveness, error: effectivenessError } = await supabase
          .from('pattern_effectiveness')
          .select('effectiveness_rating, created_at')
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
          .order('created_at', { ascending: false });

        if (effectivenessError) {
          throw new Error(`Failed to get effectiveness data: ${effectivenessError.message}`);
        }

        return { data: { patternStats, recentEffectiveness }, error: null };
      }
    );

    if (!result) {
      return {
        totalPatternsStored: 0,
        activePatterns: 0,
        averageEffectiveness: 0,
        improvementRate: 0,
        patternsByType: {},
        recentSuccesses: 0,
        learningTrend: 'stable',
      };
    }

    const { patternStats, recentEffectiveness } = result;

    // Calculate metrics
    const totalPatterns = patternStats?.length || 0;
    const activePatterns = patternStats?.filter((p: any) => p.effectiveness_score >= 75).length || 0;
    const averageEffectiveness = totalPatterns > 0 
      ? patternStats.reduce((sum: number, p: any) => sum + (p.effectiveness_score || 0), 0) / totalPatterns 
      : 0;

    const patternsByType = patternStats?.reduce((acc: any, p: any) => {
      acc[p.pattern_type] = (acc[p.pattern_type] || 0) + 1;
      return acc;
    }, {}) || {};

    const recentSuccesses = recentEffectiveness?.filter((e: any) => e.effectiveness_rating >= 75).length || 0;

    // Calculate improvement trend
    const recentAvg = recentEffectiveness?.length > 0 
      ? recentEffectiveness.reduce((sum: number, e: any) => sum + (e.effectiveness_rating || 0), 0) / recentEffectiveness.length 
      : 0;
    
    let learningTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (recentAvg > averageEffectiveness + 5) {
      learningTrend = 'improving';
    } else if (recentAvg < averageEffectiveness - 5) {
      learningTrend = 'declining';
    }

    return {
      totalPatternsStored: totalPatterns,
      activePatterns,
      averageEffectiveness: Math.round(averageEffectiveness * 100) / 100,
      improvementRate: Math.round((recentAvg - averageEffectiveness) * 100) / 100,
      patternsByType,
      recentSuccesses,
      learningTrend,
    };
  }

  async query<T>(queryFn: (supabase: any) => Promise<{ data: T | null; error: any }>): Promise<T | null> {
    return this.executeQuery<T>('Generic query operation', queryFn);
  }

  // ===== PRIVATE HELPER METHODS =====

  private async testConnection(): Promise<void> {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized');
    }

    this.log('info', 'Testing database connection with storybook_entries table...');
    
    const { error } = await this.supabase
      .from('storybook_entries')
      .select('id')
      .limit(1);

    if (error) {
      this.log('error', 'Database connection test failed:', error);
      throw new Error(`Database connection test failed: ${error.message} (Code: ${error.code})`);
    }
    
    this.log('info', 'Database connection test successful');
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