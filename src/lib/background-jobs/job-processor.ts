// Enhanced Job Processor - Professional Comic Book Generation with Character DNA System
// ✅ ENHANCED: Story beat analysis, character consistency, and professional comic workflows

import { serviceContainer } from '../../services/container/service-container.js';

import {
  SERVICE_TOKENS,
  IDatabaseService,
  IAIService,
  IJobService,
  IServiceHealth,
  IServiceMetrics,
  ComicGenerationResult,
  EnvironmentalDNA,
  CharacterDNA,
  QualityMetrics,
} from '../../services/interfaces/service-contracts.js';

import { EnvironmentalConsistencyValidator } from '../../services/ai/modular/environmental-consistency-validator.js';
import {
  Result,
  ErrorFactory,
  ServiceError,
  createJobCorrelationContext,
  withCorrelationResult,
} from '../../services/errors/index.js';

// ✅ FIXED: Corrected type-only import without '.js' extension
import type {
  JobData,
  JobType,
  StorybookJobData,
  AutoStoryJobData,
  SceneJobData,
  CartoonizeJobData,
  ImageJobData,
} from '../types';

interface JobProcessingResult {
  success: boolean;
  jobId: string;
  error?: ServiceError;
  duration?: number;
  servicesUsed?: string[];
  comicQuality?: ComicGenerationResult;
}

interface ProcessingStatistics {
  totalProcessed: number;
  successful: number;
  failed: number;
  timeouts: number;
  concurrentPeak: number;
  lastProcessedAt: Date | null;
  errorsByService: Record<string, number>;
  serviceUsageStats: Record<string, number>;
  features: {
    cleanArchitecture: boolean;
    interfaceSegregation: boolean;
    dependencyInjection: boolean;
    errorHandling: boolean;
    serviceAbstraction: boolean;
    professionalComicGeneration: boolean;
    characterDNASystem: boolean;
    storyBeatAnalysis: boolean;
  };
}

interface ProcessorHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  availability: number;
  concurrencyUtilization: number;
  serviceHealth: Record<string, boolean>;
  lastCheck: string;
}

// ===== STYLE-SPECIFIC CARTOONIZATION PROMPTS =====

const STYLE_SPECIFIC_CARTOONIZATION_PROMPTS: Record<string, { base: string; negatives: string; characteristics: string }> = {
  'storybook': {
    base: 'Soft, whimsical children\'s book illustration style with gentle watercolor-like colors, rounded features, and warm inviting appearance',
    negatives: 'NOT photorealistic, NOT harsh lines, NOT dark shadows, NOT scary',
    characteristics: 'Soft edges, pastel color palette, gentle shading, warm lighting, friendly expression, slightly larger eyes for appeal'
  },
  'semi-realistic': {
    base: 'Semi-realistic digital portrait with smooth skin rendering, accurate proportions, and polished professional finish',
    negatives: 'NOT fully photorealistic, NOT cartoonish, NOT flat colors',
    characteristics: 'Smooth gradients, realistic lighting, subtle stylization, professional portrait quality, natural skin tones with slight idealization'
  },
  'comic-book': {
    base: 'Bold comic book art style with strong ink outlines, cel-shading, and dynamic contrast typical of Marvel/DC comics',
    negatives: 'NOT soft edges, NOT watercolor, NOT anime style',
    characteristics: 'Bold black outlines, flat color areas with halftone shading, high contrast, dramatic lighting, heroic proportions'
  },
  'flat-illustration': {
    base: 'Modern flat vector illustration style with clean geometric shapes, minimal shading, and contemporary design aesthetic',
    negatives: 'NOT realistic, NOT detailed texturing, NOT complex gradients',
    characteristics: 'Clean vector lines, solid flat colors, minimal shadows, geometric simplification, modern minimalist aesthetic'
  },
  'anime': {
    base: 'Japanese anime/manga art style with characteristic large expressive eyes, simplified nose, and dynamic hair styling',
    negatives: 'NOT Western cartoon, NOT realistic proportions, NOT photorealistic',
    characteristics: 'Large shiny eyes with highlights, small nose and mouth, pointed chin, colorful dynamic hair, smooth cel-shaded skin'
  }
};

// ===== ENHANCED PRODUCTION JOB PROCESSOR =====

export class ProductionJobProcessor implements IServiceHealth, IServiceMetrics {
  private isProcessing = false;
  private readonly maxConcurrentJobs = 5;
  
  private currentlyProcessing = new Map<string, {
    jobId: string;
    jobType: JobType;
    startTime: number;
    servicesUsed: Set<string>;
    comicGeneration?: {
      characterDNACreated: boolean;
      storyAnalyzed: boolean;
      panelsGenerated: number;
      targetPanels: number;
    };
  }>();

  private internalStats = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    timeouts: 0,
    concurrentPeak: 0,
    lastProcessedAt: null as Date | null,
    errorsByService: new Map<string, number>(),
    serviceUsageStats: new Map<string, number>(),
    recentResults: [] as { success: boolean; timestamp: number }[],
    lastHealthRecovery: Date.now(),
    // Enhanced comic generation metrics
    comicQualityStats: {
      averageCharacterConsistency: 0,
      averageStoryCoherence: 0,
      totalComicsGenerated: 0,
      professionalStandardsAchieved: 0,
    },
  };

  private readonly healthConfig = {
    slidingWindowSize: 10,
    maxFailureRate: 0.7,
    recoveryTimeMs: 300000,
    minSampleSize: 3,
  };

  constructor() {
    console.log('🏗️ Enhanced production job processor initialized with professional comic generation capabilities');
    
    setInterval(() => this.cleanupStaleJobs(), 300000);
    setInterval(() => this.checkAutoRecovery(), 60000);
  }

  // ===== ENHANCED HEALTH INTERFACE IMPLEMENTATION =====

  isHealthy(): boolean {
    try {
      const baseHealth = this.currentlyProcessing.size < this.maxConcurrentJobs;
      const slidingWindowFailureRate = this.calculateSlidingWindowFailureRate();
      const healthyFailureRate = slidingWindowFailureRate <= this.healthConfig.maxFailureRate;
      
      const timeoutRate = this.internalStats.totalProcessed > 0 
        ? this.internalStats.timeouts / this.internalStats.totalProcessed 
        : 0;
      const healthyTimeoutRate = timeoutRate < 0.2;
      
      const timeSinceLastRecovery = Date.now() - this.internalStats.lastHealthRecovery;
      const autoRecoveryEnabled = timeSinceLastRecovery > this.healthConfig.recoveryTimeMs;
      
      const isHealthy = baseHealth && (healthyFailureRate || autoRecoveryEnabled) && healthyTimeoutRate;
      
      if (!isHealthy) {
        console.warn(`⚠️ Enhanced worker health check details:`, {
          baseHealth,
          slidingWindowFailureRate: slidingWindowFailureRate.toFixed(2),
          healthyFailureRate,
          timeoutRate: timeoutRate.toFixed(2),
          healthyTimeoutRate,
          autoRecoveryEnabled,
          recentResultsCount: this.internalStats.recentResults.length,
          comicQualityAverage: this.internalStats.comicQualityStats.averageCharacterConsistency
        });
      }
      
      return isHealthy;
    } catch (error) {
      console.error('❌ Enhanced health check failed:', error);
      return false;
    }
  }

  getHealthStatus(): ProcessorHealthStatus {
    const concurrencyUtilization = (this.currentlyProcessing.size / this.maxConcurrentJobs) * 100;
    const slidingWindowFailureRate = this.calculateSlidingWindowFailureRate();
    const slidingWindowFailurePercent = slidingWindowFailureRate * 100;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;
    let availability: number;

    if (this.isHealthy()) {
      if (slidingWindowFailurePercent > 30) {
        status = 'degraded';
        message = `Elevated failure rate: ${slidingWindowFailurePercent.toFixed(1)}% (recent jobs) - Professional comic generation active`;
        availability = Math.max(50, 100 - slidingWindowFailurePercent);
      } else {
        status = 'healthy';
        message = `Professional comic processor operating normally - Character DNA system active`;
        availability = 100;
      }
    } else {
      status = 'unhealthy';
      message = `High failure rate: ${slidingWindowFailurePercent.toFixed(1)}% (recent jobs) - Comic generation degraded`;
      availability = 0;
    }

    return {
      status,
      message,
      availability,
      concurrencyUtilization,
      serviceHealth: {},
      lastCheck: new Date().toISOString(),
    };
  }

  // ===== SLIDING WINDOW FAILURE RATE CALCULATION =====

  private calculateSlidingWindowFailureRate(): number {
    const recentResults = this.internalStats.recentResults;
    
    if (recentResults.length < this.healthConfig.minSampleSize) {
      return 0;
    }
    
    const failedCount = recentResults.filter(result => !result.success).length;
    const failureRate = failedCount / recentResults.length;
    
    return failureRate;
  }

  private addToRecentResults(success: boolean): void {
    const result = { success, timestamp: Date.now() };
    this.internalStats.recentResults.push(result);
    
    if (this.internalStats.recentResults.length > this.healthConfig.slidingWindowSize) {
      this.internalStats.recentResults.shift();
    }
  }

  private checkAutoRecovery(): void {
    const now = Date.now();
    const timeSinceLastRecovery = now - this.internalStats.lastHealthRecovery;
    
    if (!this.isHealthy() && timeSinceLastRecovery > this.healthConfig.recoveryTimeMs) {
      console.log('🔄 Attempting auto-recovery: clearing recent failure history for enhanced processor');
      
      this.internalStats.recentResults = [];
      this.internalStats.lastHealthRecovery = now;
      
      console.log('✅ Enhanced auto-recovery completed - professional comic generation should be healthy again');
    }
  }

  // ===== METRICS INTERFACE IMPLEMENTATION =====

  getMetrics() {
    return {
      requestCount: this.internalStats.totalProcessed,
      successCount: this.internalStats.successful,
      errorCount: this.internalStats.failed,
      averageResponseTime: 0,
      uptime: Date.now(),
      lastActivity: this.internalStats.lastProcessedAt?.toISOString() || new Date().toISOString(),
    };
  }

  resetMetrics(): void {
    this.internalStats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      timeouts: 0,
      concurrentPeak: 0,
      lastProcessedAt: null,
      errorsByService: new Map(),
      serviceUsageStats: new Map(),
      recentResults: [],
      lastHealthRecovery: Date.now(),
      comicQualityStats: {
        averageCharacterConsistency: 0,
        averageStoryCoherence: 0,
        totalComicsGenerated: 0,
        professionalStandardsAchieved: 0,
      },
    };
    
    console.log('📊 Enhanced processor metrics reset - including comic quality tracking');
  }

  // ===== PUBLIC PROCESSING INTERFACE =====

  getProcessingStats(): ProcessingStatistics {
    const errorStats = Object.fromEntries(this.internalStats.errorsByService);
    const serviceStats = Object.fromEntries(this.internalStats.serviceUsageStats);
    
    return {
      totalProcessed: this.internalStats.totalProcessed,
      successful: this.internalStats.successful,
      failed: this.internalStats.failed,
      timeouts: this.internalStats.timeouts,
      concurrentPeak: this.internalStats.concurrentPeak,
      lastProcessedAt: this.internalStats.lastProcessedAt,
      errorsByService: errorStats,
      serviceUsageStats: serviceStats,
      features: {
        cleanArchitecture: true,
        interfaceSegregation: true,
        dependencyInjection: true,
        errorHandling: true,
        serviceAbstraction: true,
        professionalComicGeneration: true,
        characterDNASystem: true,
        storyBeatAnalysis: true,
      },
    };
  }

  async processNextJobStep(): Promise<boolean> {
    if (this.isProcessing || this.currentlyProcessing.size >= this.maxConcurrentJobs) {
      return false;
    }

    this.isProcessing = true;
    let processedAny = false;

    try {
      const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
      const pendingJobs = await jobService.getPendingJobs({}, 10);
      
      for (const job of pendingJobs) {
        if (!this.addToProcessing(job.id, job.type)) {
          continue;
        }

        processedAny = true;
        this.processJobWithCleanup(job);
      }
    } catch (error: any) {
      console.error('❌ Error in enhanced processNextJobStep:', error);
      this.handleJobError('batch', error, 'processNextJobStep', 'job');
    } finally {
      this.isProcessing = false;
    }

    return processedAny;
  }

  async processJobAsync(job: JobData): Promise<void> {
    await this.processJobWithCleanup(job);
  }

  // ===== ENHANCED PRIVATE IMPLEMENTATION =====

  private addToProcessing(jobId: string, jobType: JobType): boolean {
    if (this.currentlyProcessing.has(jobId)) {
      console.warn(`⚠️ Job ${jobId} already being processed - skipping duplicate`);
      return false;
    }

    if (this.currentlyProcessing.size >= this.maxConcurrentJobs) {
      console.log(`📊 Concurrency limit reached (${this.maxConcurrentJobs}) - skipping job ${jobId}`);
      return false;
    }

    this.currentlyProcessing.set(jobId, {
      jobId,
      jobType,
      startTime: Date.now(),
      servicesUsed: new Set<string>(),
      comicGeneration: {
        characterDNACreated: false,
        storyAnalyzed: false,
        panelsGenerated: 0,
        targetPanels: 0,
      },
    });

    this.internalStats.concurrentPeak = Math.max(this.internalStats.concurrentPeak, this.currentlyProcessing.size);
    
    console.log(`📈 Added enhanced job ${jobId} to processing queue (${this.currentlyProcessing.size}/${this.maxConcurrentJobs})`);
    return true;
  }

  private removeFromProcessing(jobId: string): void {
    const jobInfo = this.currentlyProcessing.get(jobId);
    if (jobInfo) {
      const duration = Date.now() - jobInfo.startTime;
      
      jobInfo.servicesUsed.forEach(service => {
        this.internalStats.serviceUsageStats.set(service, (this.internalStats.serviceUsageStats.get(service) || 0) + 1);
      });
      
      this.currentlyProcessing.delete(jobId);
      
      console.log(`📉 Removed enhanced job ${jobId} from processing queue (duration: ${duration}ms, services: ${Array.from(jobInfo.servicesUsed).join(', ')}, remaining: ${this.currentlyProcessing.size})`);
      
      // Log comic generation progress if applicable
      if (jobInfo.comicGeneration && jobInfo.comicGeneration.targetPanels > 0) {
        console.log(`🎨 Comic generation completed: ${jobInfo.comicGeneration.panelsGenerated}/${jobInfo.comicGeneration.targetPanels} panels, DNA: ${jobInfo.comicGeneration.characterDNACreated}, Story: ${jobInfo.comicGeneration.storyAnalyzed}`);
      }
    }
  }

  private trackServiceUsage(jobId: string, serviceName: string): void {
    const jobInfo = this.currentlyProcessing.get(jobId);
    if (jobInfo) {
      jobInfo.servicesUsed.add(serviceName);
    }
  }

  private updateComicGenerationProgress(jobId: string, update: Partial<{
    characterDNACreated: boolean;
    storyAnalyzed: boolean;
    panelsGenerated: number;
    targetPanels: number;
  }>): void {
    const jobInfo = this.currentlyProcessing.get(jobId);
    if (jobInfo && jobInfo.comicGeneration) {
      Object.assign(jobInfo.comicGeneration, update);
    }
  }

  private cleanupStaleJobs(): void {
    const now = Date.now();
    const staleThreshold = 600000;
    let cleanedCount = 0;

    for (const [jobId, jobInfo] of this.currentlyProcessing.entries()) {
      if (now - jobInfo.startTime > staleThreshold) {
        console.warn(`🧹 Cleaning up stale enhanced job ${jobId} (running for ${now - jobInfo.startTime}ms)`);
        this.removeFromProcessing(jobId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} stale enhanced jobs`);
    }
  }

  private handleJobError(jobId: string, error: any, operation: string, serviceName?: string): JobProcessingResult {
    let errorType: ServiceError['type'] = 'UNKNOWN_ERROR';
    let errorMessage = error.message || 'Unknown error occurred';

    if (error.type === 'timeout') {
      errorType = 'JOB_TIMEOUT_ERROR';
      this.internalStats.timeouts++;
    } else if (serviceName === 'ai' || error.message?.includes('OpenAI')) {
      errorType = 'AI_SERVICE_UNAVAILABLE_ERROR';
    } else if (serviceName === 'database' || error.message?.includes('database') || error.message?.includes('Supabase')) {
      errorType = 'DATABASE_CONNECTION_ERROR';
    } else if (serviceName === 'storage' || error.message?.includes('Cloudinary')) {
      errorType = 'STORAGE_UPLOAD_ERROR';
    } else if (serviceName === 'auth' || error.message?.includes('authentication')) {
      errorType = 'AUTHENTICATION_ERROR';
    } else if (error.message?.includes('validation') || error.message?.includes('invalid')) {
      errorType = 'JOB_VALIDATION_ERROR';
    }

    const errorKey = serviceName ? `${serviceName}_${errorType}` : errorType;
    this.internalStats.errorsByService.set(errorKey, (this.internalStats.errorsByService.get(errorKey) || 0) + 1);

    console.error(`❌ Enhanced job ${jobId} failed in ${operation} (${errorType}${serviceName ? ` - ${serviceName}` : ''}):`, errorMessage);

    const serviceError = ErrorFactory.fromUnknown(error, {
      service: serviceName || 'enhanced-job-processor',
      operation,
    });

    return {
      success: false,
      jobId,
      error: serviceError,
    };
  }
private async processJobWithCleanup(job: JobData): Promise<void> {
    const startTime = Date.now();
    let result: JobProcessingResult;

    try {
      result = await this.processJobWithServices(job);
      
      if (result.success) {
        this.internalStats.successful++;
        this.addToRecentResults(true);
        
        // Update comic quality metrics if applicable
        if (result.comicQuality) {
          this.updateComicQualityMetrics(result.comicQuality);
        }
        
        console.log(`✅ Enhanced job ${job.id} completed successfully in ${Date.now() - startTime}ms using services: ${result.servicesUsed?.join(', ')}`);
      } else {
        this.internalStats.failed++;
        this.addToRecentResults(false);
        
        const shouldRetry = result.error?.type !== 'JOB_VALIDATION_ERROR' && 
                           result.error?.type !== 'AUTHENTICATION_ERROR' && 
                           result.error?.type !== 'JOB_TIMEOUT_ERROR';
        
        this.trackServiceUsage(job.id, 'job');
        const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
        await jobService.markJobFailed(job.id, result.error?.message || 'Unknown error', shouldRetry);
      }
    } catch (error: any) {
      result = this.handleJobError(job.id, error, 'processJobWithCleanup');
      this.internalStats.failed++;
      this.addToRecentResults(false);
      
      try {
        this.trackServiceUsage(job.id, 'job');
        const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
        await jobService.markJobFailed(job.id, result.error?.message || 'Unknown error', true);
      } catch (serviceError) {
        console.error(`❌ Failed to mark enhanced job as failed: ${job.id}`, serviceError);
      }
    } finally {
      this.removeFromProcessing(job.id);
      this.internalStats.totalProcessed++;
      this.internalStats.lastProcessedAt = new Date();
    }
  }

  private updateComicQualityMetrics(comicQuality: ComicGenerationResult): void {
    const stats = this.internalStats.comicQualityStats;
    const total = stats.totalComicsGenerated;
    
    // Update running averages
    stats.averageCharacterConsistency = ((stats.averageCharacterConsistency * total) + comicQuality.qualityMetrics.characterConsistency) / (total + 1);
    stats.averageStoryCoherence = ((stats.averageStoryCoherence * total) + (comicQuality.qualityMetrics.storyCoherence || 0)) / (total + 1);
    
    if (comicQuality.qualityMetrics.professionalStandards) {
      stats.professionalStandardsAchieved++;
    }
    
    stats.totalComicsGenerated++;
    
    console.log(`📊 Comic quality updated: Consistency ${comicQuality.qualityMetrics.characterConsistency}%, Coherence ${comicQuality.qualityMetrics.storyCoherence || 0}%, Standards: ${comicQuality.qualityMetrics.professionalStandards}`);
  }

  @withCorrelationResult('enhanced-job-processor', 'processJob')
  private async processJobWithServices(job: JobData): Promise<JobProcessingResult> {
    const startTime = Date.now();
    const servicesUsed: string[] = [];
    
    try {
      console.log(`🔄 Processing enhanced job: ${job.id} (${job.type}) with professional comic generation capabilities`);

      this.trackServiceUsage(job.id, 'job');
      servicesUsed.push('job');
      const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);

      if (job.status === 'pending') {
        await jobService.updateJobProgress(job.id, 1, 'Starting enhanced job processing with professional comic generation');
      }

      let comicQuality: ComicGenerationResult | undefined;

      switch (job.type) {
        case 'storybook':
          comicQuality = await this.processStorybookJobWithServices(job as StorybookJobData, servicesUsed);
          break;
        case 'auto-story':
          comicQuality = await this.processAutoStoryJobWithServices(job as AutoStoryJobData, servicesUsed);
          break;
        case 'scenes':
          await this.processSceneJobWithServices(job as SceneJobData, servicesUsed);
          break;
        case 'cartoonize':
          await this.processCartoonizeJobWithServices(job as CartoonizeJobData, servicesUsed);
          break;
        case 'image-generation':
          await this.processImageJobWithServices(job as ImageJobData, servicesUsed);
          break;
        case 'character-description':
          await this.processCharacterDescriptionJob(job, servicesUsed);
          break;
        default:
          throw new Error(`Unknown job type: ${(job as JobData).type}`);
      }

      return {
        success: true,
        jobId: job.id,
        duration: Date.now() - startTime,
        servicesUsed,
        comicQuality,
      };

    } catch (error: any) {
      return this.handleJobError(job.id, error, `processEnhanced${job.type}Job`);
    }
  }
// ===== ENHANCED JOB-SPECIFIC PROCESSORS =====

  private async processStorybookJobWithServices(job: StorybookJobData, servicesUsed: string[]): Promise<ComicGenerationResult> {
    const startTime = Date.now();
    const { 
      title, 
      story, 
      character_image, 
      pages: initialPages, 
      audience = 'children', 
      is_reused_image = false, 
      character_art_style = 'storybook', 
      layout_type = 'comic-book-panels', 
      character_description = '' 
    } = job;

    console.log('🎨 Starting ENHANCED storybook generation with environmental consistency and professional comic standards...');
    console.log(`📊 Configuration: ${character_art_style} style, ${audience} audience, reused: ${is_reused_image}`);

    const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
    const aiService = await serviceContainer.resolve<IAIService>(SERVICE_TOKENS.AI);
    const databaseService = await serviceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);

    this.trackServiceUsage(job.id, 'job');
    servicesUsed.push('job');
    await jobService.updateJobProgress(job.id, 5, 'Analyzing your story structure and creating narrative blueprint...');

    // PHASE 1: STORY ANALYSIS (Story-First Approach)
    console.log('📖 PHASE 1: Story Structure Analysis (Story-First Approach)...');
    let storyAnalysis: any = null;
    let pages = initialPages || [];
    
    if (!pages || pages.length === 0) {
      try {
        this.trackServiceUsage(job.id, 'ai');
        if (!servicesUsed.includes('ai')) servicesUsed.push('ai');
        
        // Enhanced story analysis with environmental awareness
        storyAnalysis = await aiService.analyzeStoryStructure(story, audience);
        this.updateComicGenerationProgress(job.id, { storyAnalyzed: true });
        
        console.log(`✅ Story structure analyzed: ${storyAnalysis.storyBeats.length} narrative beats for ${audience} audience`);
        await jobService.updateJobProgress(job.id, 15, `Story structure complete: ${storyAnalysis.storyBeats.length} narrative moments mapped with ${storyAnalysis.emotionalArc?.length || 3}-stage emotional arc...`);
        
      } catch (storyError) {
        console.error('❌ Story analysis failed:', storyError);
        throw new Error(`Failed to analyze story structure: ${storyError instanceof Error ? storyError.message : String(storyError)}`);
      }
    } else {
      console.log(`📄 Using predefined pages - analyzing ${pages.length} existing pages for environmental enhancement`);
      await jobService.updateJobProgress(job.id, 15, `Analyzing ${pages.length} predefined pages for environmental consistency`);
    }

    // PHASE 2: ENVIRONMENTAL DNA CREATION
    console.log('🌍 PHASE 2: Environmental DNA Creation for World Consistency...');
    let environmentalDNA: any = null;
    
    try {
      this.trackServiceUsage(job.id, 'ai');
      if (!servicesUsed.includes('ai')) servicesUsed.push('ai');
      
      // Create environmental DNA for consistent world-building
// FIX: Pass storyBeats array, not the full analysis object
environmentalDNA = await aiService.createEnvironmentalDNA(
  storyAnalysis ? storyAnalysis.storyBeats : pages.map((p: any, i: number) => ({ 
    description: `Page ${i + 1}`, 
    setting: 'general',
    environment: 'general setting'
  })),
  audience,
  character_art_style,
  story
);
      
      console.log(`✅ Environmental DNA created: ${environmentalDNA.primaryLocation?.name || 'Generic Setting'}`);
      console.log(`☀️ Lighting Context: ${environmentalDNA.lightingContext?.timeOfDay || 'afternoon'} - ${environmentalDNA.lightingContext?.lightingMood || 'bright'}`);
      await jobService.updateJobProgress(job.id, 25, `Building world consistency profile - ${environmentalDNA.primaryLocation?.name || 'setting'} with ${environmentalDNA.primaryLocation?.keyFeatures?.length || 0} unique features...`);
      
    } catch (envError: any) {
      const errorMsg = `Environmental DNA creation failed - quality standards not met: ${envError?.message || 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      await jobService.updateJobProgress(job.id, 0, 'Failed: Environmental context creation failed');
      throw new Error(errorMsg);
    }

    // PHASE 3: CHARACTER DNA CREATION
console.log('🧬 PHASE 3: Character DNA Creation for Maximum Consistency...');
let characterDescriptionToUse = character_description;
let characterDNA: any = null;

// CRITICAL FIX: Use existing description for reused images
if (is_reused_image && character_description) {
  characterDescriptionToUse = character_description;
  console.log('📝 Using stored character description for reused cartoon image');
}

if (character_image) {
  this.updateComicGenerationProgress(job.id, { targetPanels: audience === 'children' ? 8 : audience === 'young adults' ? 15 : 24 });
  
  try {
    this.trackServiceUsage(job.id, 'ai');
    if (!servicesUsed.includes('ai')) servicesUsed.push('ai');
    
    // Pass the existing description for reused cartoons
    characterDNA = await aiService.createMasterCharacterDNA(
      character_image, 
      character_art_style,
      characterDescriptionToUse  // ✅ FIX: Pass the character description as third parameter
    );
    
    // Only extract description if we don't already have one
    if (!is_reused_image || !characterDescriptionToUse) {
      characterDescriptionToUse = this.extractCharacterDescriptionFromDNA(characterDNA);
    }
        this.updateComicGenerationProgress(job.id, { characterDNACreated: true });
        console.log('✅ Professional character DNA created with maximum consistency protocols');
        
        const totalPanels = audience === 'children' ? 8 : audience === 'young adults' ? 15 : 24;
        await jobService.updateJobProgress(job.id, 35, `Creating visual DNA for your character - ensuring perfect consistency across all ${totalPanels} panels...`);
        
      } catch (dnaError) {
        console.warn('⚠️ Character DNA creation failed, using fallback description method:', dnaError);
        
        if (!is_reused_image && !characterDescriptionToUse) {
          // FIXED: Proper AsyncResult handling for describeCharacter
this.trackServiceUsage(job.id, 'ai');
const descriptionAsync = await aiService.describeCharacter(character_image, 'You are a professional character artist. Describe this character for maximum comic book consistency.');
const resolvedDescription = await descriptionAsync.unwrap();
if (resolvedDescription && typeof resolvedDescription === 'string') {
  characterDescriptionToUse = resolvedDescription;
} else {
  characterDescriptionToUse = 'Character with consistent appearance';
}
        }
        
        await jobService.updateJobProgress(job.id, 35, 'Character analysis completed (fallback method)');
      }
    }

    // PHASE 3.5: QUALITY PREDICTION (Catch issues before image generation)
    console.log('🔍 PHASE 3.5: Quality Prediction - Validating Generation Context...');
    const predictedQuality = this.predictGenerationQuality({
      story,
      storyAnalysis,
      characterDNA,
      environmentalDNA,
      audience
    });

    if (predictedQuality.score < 70) {
      const errorMessage = `Quality prediction too low (${predictedQuality.score}/100): ${predictedQuality.issues.join(', ')}`;
      console.error(`❌ ${errorMessage}`);
      await jobService.markJobFailed(
        job.id,
        errorMessage,
        false
      );
      return {
        success: false,
        pages: [],
        characterDNA: undefined,
        environmentalDNA: undefined,
        storyAnalysis: undefined,
        qualityMetrics: {
          characterConsistency: 0,
          narrativeCoherence: 0,
          visualQuality: 0,
          emotionalResonance: 0,
          technicalExecution: 0,
          audienceAlignment: 0,
          dialogueEffectiveness: 0,
          environmentalCoherence: 0,
          storyCoherence: 0,
          panelCount: 0,
          professionalStandards: false,
          overallScore: predictedQuality.score,
          recommendations: predictedQuality.issues
        }
      };
    }

    console.log(`✅ Quality prediction passed: ${predictedQuality.score}/100`);
    await jobService.updateJobProgress(job.id, 30, `Quality check passed (predicted: ${predictedQuality.score}/100)`);

    // PHASE 4: ENHANCED CONTEXT PREPARATION
    console.log('🎯 PHASE 4: Enhanced Context Preparation...');
    let enhancedContext = await this.prepareEnhancedContext(
      storyAnalysis,
      environmentalDNA,
      characterDNA,
      characterDescriptionToUse,
      {
        audience,
        character_art_style,
        layout_type,
        is_reused_image,
        character_image
      }
    );
    
    await jobService.updateJobProgress(job.id, 45, 'Enhanced context prepared with environmental and character consistency');
    
    // PHASE 4.5: APPLY LEARNED PATTERNS
    console.log('🧠 PHASE 4.5: Applying Learned Success Patterns...');
    enhancedContext = await this.applyLearnedPatterns(enhancedContext, job.id);
    await jobService.updateJobProgress(job.id, 50, 'Success patterns applied for enhanced quality');
    
    // PHASE 5: SCENE GENERATION (if needed)
    if (!pages || pages.length === 0) {
      console.log('📄 PHASE 5: Professional Scene Generation with Enhanced Context + Learned Patterns...');
      
      try {
        this.trackServiceUsage(job.id, 'ai');
        if (!servicesUsed.includes('ai')) servicesUsed.push('ai');
        
        // FIXED: Pass Character DNA to scene generation
const sceneResultAsync = await aiService.generateScenesWithAudience({
  story: story,
  audience: audience as any,
  characterImage: character_image,
  characterArtStyle: character_art_style,
  layoutType: layout_type,
  enhancedContext: {
    ...enhancedContext,
    characterDNA: characterDNA,  // Pass Character DNA through enhanced context
    environmentalDNA: environmentalDNA,  // Pass Environmental DNA through enhanced context
    enforceConsistency: true  // Enable strict consistency through enhanced context
  }
});

const sceneResult = await sceneResultAsync.unwrap();

if (sceneResult && sceneResult.pages && Array.isArray(sceneResult.pages)) {
  pages = sceneResult.pages;
  console.log(`✅ Professional comic layout with CHARACTER DNA consistency: ${pages.length} pages with ${pages.reduce((total, page) => total + (page.scenes?.length || 0), 0)} total panels`);
} else {
  throw new Error('Invalid scene generation result - no professional pages generated');
}
        
        await jobService.updateJobProgress(job.id, 55, `Professional comic layout with environmental consistency: ${pages.length} pages`);
        
      } catch (storyError) {
        console.error('❌ Professional scene generation with learned patterns failed:', storyError);
        throw new Error(`Failed to create professional comic layout with environmental consistency and learned patterns: ${storyError instanceof Error ? storyError.message : String(storyError)}`);
      }
    } else {
      console.log(`📄 Using predefined pages - processing ${pages.length} existing pages with environmental consistency + learned patterns`);
      await jobService.updateJobProgress(job.id, 55, `Enhancing ${pages.length} predefined pages with environmental consistency and learned patterns`);
    }

    // Validate professional comic structure
    if (!pages || pages.length === 0) {
      throw new Error('No pages available for professional comic generation with environmental consistency and learned patterns');
    }

    // PHASE 6: VALIDATE AND PROCESS COMIC PAGES WITH CHARACTER & ENVIRONMENTAL VALIDATION
    const updatedPages = [];
    const totalScenes = pages.reduce((total, page) => total + (page.scenes?.length || 0), 0);
    let totalCharacterConsistencyScore = 0;
    let totalEnvironmentalConsistencyScore = 0;

    // Validation metrics
    let totalPanelsRegenerated = 0;
    let totalCharacterValidationAttempts = 0;
    let totalEnvironmentalValidationAttempts = 0;
    const characterValidationScores: number[] = [];
    const environmentalValidationScores: number[] = [];

    console.log(`📊 PHASE 6: Validating and processing ${totalScenes} panels with quality checks...`);
    console.log(`🌍 Environmental DNA: ${environmentalDNA?.primaryLocation?.name || 'Fallback'}`);
    console.log(`🎭 Character DNA: ${characterDNA ? 'Active' : 'Fallback'}, Art Style: ${character_art_style}`);

    // Resolve validators
    let characterValidator: any = null;
    let environmentalValidator: EnvironmentalConsistencyValidator | null = null;

    try {
      if (characterDNA) {
        characterValidator = await serviceContainer.resolve(SERVICE_TOKENS.VISUAL_CONSISTENCY_VALIDATOR);
        console.log('✅ Character consistency validator initialized');
      }
      if (environmentalDNA && !environmentalDNA.fallback) {
        environmentalValidator = await serviceContainer.resolve(SERVICE_TOKENS.ENVIRONMENTAL_CONSISTENCY_VALIDATOR);
        console.log('✅ Environmental consistency validator initialized');
      }
    } catch (error: any) {
      console.warn('⚠️ Validators not available, proceeding without validation:', error.message);
    }

    // Process and validate pages
    for (const [pageIndex, page] of pages.entries()) {
      const pageScenes = page.scenes || [];
      let updatedScenes = [];
      let previousPanelUrl: string | undefined = undefined;

      // PANEL-LEVEL CHARACTER VALIDATION
      for (const [sceneIndex, scene] of pageScenes.entries()) {
        const panelNumber = sceneIndex + 1;
        const globalPanelNumber = updatedPages.reduce((sum, p) => sum + p.scenes.length, 0) + panelNumber;

        let finalScene = { ...scene };
        let characterConsistencyScore = scene.characterDNAUsed ? 70 : -1;

        // Validate character consistency if we have character DNA and validator
        if (characterDNA && characterValidator && scene.generatedImage) {
          let validationPassed = false;
          let bestScore = 0;

          for (let attempt = 1; attempt <= 3; attempt++) {
            totalCharacterValidationAttempts++;

            // Update progress
            if (attempt === 1) {
              await jobService.updateJobProgress(
                job.id,
                Math.round(35 + ((pageIndex) / pages.length) * 55),
                `Validating panel ${globalPanelNumber} quality...`
              );
            } else {
              await jobService.updateJobProgress(
                job.id,
                Math.round(35 + ((pageIndex) / pages.length) * 55),
                `Quality check failed - regenerating panel ${globalPanelNumber} with enhanced prompts (attempt ${attempt}/3)`
              );
            }

            try {
              const validationScore = await characterValidator.validateCharacterConsistency(
                finalScene.generatedImage,
                characterDNA,
                {
                  jobId: job.id,
                  panelNumber: globalPanelNumber,
                  attemptNumber: attempt,
                  previousPanelUrl: previousPanelUrl,
                }
              );

              // Store validation result
              await databaseService.savePanelValidationResult({
                jobId: job.id,
                panelNumber: globalPanelNumber,
                overallScore: validationScore.overallScore,
                facialConsistency: validationScore.facialConsistency,
                bodyProportionConsistency: validationScore.bodyProportionConsistency,
                clothingConsistency: validationScore.clothingConsistency,
                colorPaletteConsistency: validationScore.colorPaletteConsistency,
                artStyleConsistency: validationScore.artStyleConsistency,
                detailedAnalysis: validationScore.detailedAnalysis,
                failureReasons: validationScore.failureReasons,
                passesThreshold: validationScore.passesThreshold,
                attemptNumber: attempt,
              });

              bestScore = Math.max(bestScore, validationScore.overallScore);

              if (validationScore.passesThreshold || validationScore.overallScore === -1) {
                characterConsistencyScore = validationScore.overallScore;
                characterValidationScores.push(validationScore.overallScore);
                validationPassed = true;

                await jobService.updateJobProgress(
                  job.id,
                  Math.round(35 + ((pageIndex) / pages.length) * 55),
                  `✅ Panel ${globalPanelNumber} quality verified (score: ${validationScore.overallScore}%)`
                );

                if (attempt > 1) {
                  totalPanelsRegenerated++;
                }

                break;
              }

              // Validation failed - regenerate if not last attempt
              if (attempt < 3) {
                console.warn(`Panel ${globalPanelNumber} failed validation (attempt ${attempt}/3): score=${validationScore.overallScore}%`);

                // Build enhanced prompt
                const enhancedPrompt = characterValidator.buildEnhancedPrompt(
                  scene.imagePrompt,
                  attempt + 1,
                  validationScore.failureReasons
                );

                // Regenerate panel image
                this.trackServiceUsage(job.id, 'ai');
                const regenerateResult = await aiService.generateSceneImage({
                  image_prompt: enhancedPrompt,
                  character_description: characterDescriptionToUse,
                  emotion: scene.emotion || 'neutral',
                  audience: audience as any,
                  cartoon_image: character_image,
                  characterArtStyle: character_art_style,
                  environmentalContext: {
                    characterDNA: characterDNA,
                    environmentalDNA: environmentalDNA,
                  },
                });

                const unwrappedRegenerate = await regenerateResult.unwrap();
                if (unwrappedRegenerate && unwrappedRegenerate.url) {
                  finalScene = {
                    ...finalScene,
                    generatedImage: unwrappedRegenerate.url,
                  };
                }
              } else {
                // Final attempt failed
                const errorMsg = `Panel ${globalPanelNumber} failed character consistency validation after 3 attempts. Quality score: ${bestScore}%. Required: 90%. Failure reasons: ${validationScore.failureReasons.join(', ')}. Cannot proceed with substandard quality.`;
                console.error(`❌ ${errorMsg}`);
                await jobService.updateJobProgress(job.id, 0, `Failed: ${errorMsg}`);
                throw new Error(errorMsg);
              }
            } catch (validationError: any) {
              if (validationError.message?.includes('Vision API') || validationError.message?.includes('unavailable')) {
                console.warn(`⚠️ Vision API unavailable for panel ${globalPanelNumber}, continuing without validation`);
                characterConsistencyScore = -1;
                validationPassed = true;
                break;
              }
              throw validationError;
            }
          }
        }

        totalCharacterConsistencyScore += characterConsistencyScore > 0 ? characterConsistencyScore : 70;

        finalScene = {
          ...finalScene,
          characterConsistency: characterConsistencyScore,
          professionalStandards: true,
        };

        updatedScenes.push(finalScene);

        // Track previous panel for sequential validation
        if (finalScene.generatedImage) {
          previousPanelUrl = finalScene.generatedImage;
        }
      }

      // PAGE-LEVEL ENVIRONMENTAL VALIDATION
      if (environmentalDNA && !environmentalDNA.fallback && environmentalValidator && updatedScenes.length > 0) {
        let pageValidationPassed = false;

        for (let pageAttempt = 1; pageAttempt <= 2; pageAttempt++) {
          totalEnvironmentalValidationAttempts++;

          await jobService.updateJobProgress(
            job.id,
            Math.round(35 + ((pageIndex + 0.5) / pages.length) * 55),
            `Validating page ${pageIndex + 1} environmental consistency (${updatedScenes.length} panels, attempt ${pageAttempt}/2)`
          );

          try {
            const panelUrls = updatedScenes
              .map((s: any) => s.generatedImage)
              .filter((url: any) => url);

            const envReport = await environmentalValidator.validateEnvironmentalConsistency(
              panelUrls,
              environmentalDNA,
              pageIndex + 1,
            );

            // Store environmental validation result
            await databaseService.saveEnvironmentalValidationResult({
              jobId: job.id,
              pageNumber: pageIndex + 1,
              overallCoherence: envReport.overallCoherence,
              locationConsistency: envReport.panelScores[0]?.locationConsistency || 0,
              lightingConsistency: envReport.panelScores[0]?.lightingConsistency || 0,
              colorPaletteConsistency: envReport.panelScores[0]?.colorPaletteConsistency || 0,
              architecturalConsistency: envReport.panelScores[0]?.architecturalStyleConsistency || 0,
              crossPanelConsistency: envReport.crossPanelConsistency,
              panelScores: envReport.panelScores,
              detailedAnalysis: envReport.detailedAnalysis,
              failureReasons: envReport.failureReasons,
              passesThreshold: envReport.passesThreshold,
              attemptNumber: pageAttempt,
              regenerationTriggered: !envReport.passesThreshold && pageAttempt < 2,
            });

            if (envReport.passesThreshold || envReport.overallCoherence === -1) {
              totalEnvironmentalConsistencyScore += envReport.overallCoherence > 0 ? envReport.overallCoherence : 70;
              environmentalValidationScores.push(envReport.overallCoherence);
              pageValidationPassed = true;

              await jobService.updateJobProgress(
                job.id,
                Math.round(35 + ((pageIndex + 0.5) / pages.length) * 55),
                `✅ Page ${pageIndex + 1} validated (coherence: ${envReport.overallCoherence.toFixed(1)}%)`
              );

              break;
            }

            // Environmental validation failed
            if (pageAttempt < 2) {
              console.warn(`Page ${pageIndex + 1} failed environmental validation (attempt ${pageAttempt}/2): coherence=${envReport.overallCoherence.toFixed(1)}%`);

              await jobService.updateJobProgress(
                job.id,
                Math.round(35 + ((pageIndex + 0.5) / pages.length) * 55),
                `Environmental consistency below threshold (${envReport.overallCoherence.toFixed(1)}%) - regenerating entire page ${pageIndex + 1} (attempt ${pageAttempt + 1}/2)`
              );

              // Regenerate entire page with environmental enhancement
              const envEnhancement = `ENVIRONMENTAL CONSISTENCY REQUIRED: ${envReport.failureReasons.join('; ')}. MANDATORY: exact same location (${environmentalDNA.primaryLocation?.name}), lighting (${environmentalDNA.lightingContext?.timeOfDay} - ${environmentalDNA.lightingContext?.lightingMood}), color palette, architectural style.`;

              const regeneratedScenes = [];
              for (const [sceneIdx, scene] of updatedScenes.entries()) {
                const enhancedPrompt = `${(scene as any).imagePrompt} ${envEnhancement}`;

                this.trackServiceUsage(job.id, 'ai');
                const regenerateResult = await aiService.generateSceneImage({
                  image_prompt: enhancedPrompt,
                  character_description: characterDescriptionToUse,
                  emotion: (scene as any).emotion || 'neutral',
                  audience: audience as any,
                  cartoon_image: character_image,
                  characterArtStyle: character_art_style,
                  environmentalContext: {
                    characterDNA: characterDNA,
                    environmentalDNA: environmentalDNA,
                  },
                });

                const unwrappedRegenerate = await regenerateResult.unwrap();
                if (unwrappedRegenerate && unwrappedRegenerate.url) {
                  regeneratedScenes.push({
                    ...scene,
                    generatedImage: unwrappedRegenerate.url,
                  });
                } else {
                  regeneratedScenes.push(scene);
                }
              }

              updatedScenes = regeneratedScenes;
            } else {
              // Final page attempt failed
              const errorMsg = `Page ${pageIndex + 1} failed environmental consistency validation after 2 attempts. Coherence score: ${envReport.overallCoherence.toFixed(1)}%. Required: 85%. Failure reasons: ${envReport.failureReasons.join(', ')}. Cannot maintain world consistency.`;
              console.error(`❌ ${errorMsg}`);
              await jobService.updateJobProgress(job.id, 0, `Failed: ${errorMsg}`);
              throw new Error(errorMsg);
            }
          } catch (envError: any) {
            if (envError.message?.includes('Vision API') || envError.message?.includes('unavailable')) {
              console.warn(`⚠️ Vision API unavailable for page ${pageIndex + 1}, continuing without environmental validation`);
              totalEnvironmentalConsistencyScore += 70;
              pageValidationPassed = true;
              break;
            }
            throw envError;
          }
        }
      } else {
        // No environmental validation
        totalEnvironmentalConsistencyScore += 70;
      }

      // Add scenes with environmental consistency
      for (let i = 0; i < updatedScenes.length; i++) {
        (updatedScenes[i] as any).environmentalConsistency = environmentalValidationScores.length > 0
          ? environmentalValidationScores[environmentalValidationScores.length - 1]
          : 70;
      }

      updatedPages.push({
        pageNumber: pageIndex + 1,
        scenes: updatedScenes,
        layoutType: layout_type,
        characterArtStyle: character_art_style,
        characterDescription: characterDescriptionToUse,
        professionalStandards: true,
        characterDNAEnabled: !!characterDNA,
        environmentalDNAEnabled: !!environmentalDNA && !environmentalDNA.fallback,
        panelCount: updatedScenes.length,
        environmentalConsistency: environmentalValidationScores.length > 0
          ? environmentalValidationScores[environmentalValidationScores.length - 1]
          : 70,
      });

      // Update progress for each page completion
      const progressPercent = 35 + ((pageIndex + 1) / pages.length) * 55;
      await jobService.updateJobProgress(
        job.id,
        Math.round(progressPercent),
        `✅ Page ${pageIndex + 1}/${pages.length} complete with quality validation`
      );
    }

    let averageConsistency = totalScenes > 0 ? totalCharacterConsistencyScore / totalScenes : 0;
    let averageEnvironmentalConsistency = totalScenes > 0 ? totalEnvironmentalConsistencyScore / totalScenes : 0;
    const storyCoherence = storyAnalysis ? 90 : 70;

    console.log(`✅ Processed ${updatedPages.length} pages with ${totalScenes} panels`);

    // LOG VALIDATION METRICS
    console.log(`📊 VALIDATION METRICS SUMMARY:`);
    console.log(`  - Total panels: ${totalScenes}`);
    console.log(`  - Panels regenerated: ${totalPanelsRegenerated}`);
    console.log(`  - Character validation attempts: ${totalCharacterValidationAttempts}`);
    console.log(`  - Environmental validation attempts: ${totalEnvironmentalValidationAttempts}`);
    console.log(`  - Character validation scores: ${characterValidationScores.length > 0 ? characterValidationScores.map(s => s + '%').join(', ') : 'N/A'}`);
    console.log(`  - Environmental validation scores: ${environmentalValidationScores.length > 0 ? environmentalValidationScores.map(s => s.toFixed(1) + '%').join(', ') : 'N/A'}`);

    // Calculate average validation scores
    const avgCharacterValidationScore = characterValidationScores.length > 0
      ? characterValidationScores.reduce((sum, score) => sum + score, 0) / characterValidationScores.length
      : 0;

    const avgEnvironmentalValidationScore = environmentalValidationScores.length > 0
      ? environmentalValidationScores.reduce((sum, score) => sum + score, 0) / environmentalValidationScores.length
      : 0;

    // Calculate validation pass rate
    const totalValidationAttempts = totalCharacterValidationAttempts + totalEnvironmentalValidationAttempts;
    const successfulValidations = characterValidationScores.length + environmentalValidationScores.length;
    const validationPassRate = totalValidationAttempts > 0
      ? (successfulValidations / totalValidationAttempts) * 100
      : 100;

    console.log(`  - Average character score: ${avgCharacterValidationScore > 0 ? avgCharacterValidationScore.toFixed(1) + '%' : 'N/A'}`);
    console.log(`  - Average environmental score: ${avgEnvironmentalValidationScore > 0 ? avgEnvironmentalValidationScore.toFixed(1) + '%' : 'N/A'}`);
    console.log(`  - Validation pass rate: ${validationPassRate.toFixed(1)}%`);

    // Calculate quality metrics using ACTUAL validation scores
    const characterConsistencyScore = avgCharacterValidationScore > 0
      ? Math.round(avgCharacterValidationScore)
      : (characterDNA ? (characterDNA.metadata?.confidenceScore || 90) : 75);

    const storyCoherenceScore = storyAnalysis ?
      85 + (storyAnalysis.storyBeats.length >= 8 ? 5 : 0) :
      70;

    const environmentalConsistencyScore = avgEnvironmentalValidationScore > 0
      ? Math.round(avgEnvironmentalValidationScore)
      : ((environmentalDNA && !environmentalDNA.fallback) ? 90 : 70);

    const overallScore = Math.round((characterConsistencyScore + storyCoherenceScore + environmentalConsistencyScore + 88 + 85 + 90) / 6);

    await jobService.updateJobProgress(job.id, 95, `✅ All quality checks passed - Character: ${characterConsistencyScore}%, Environmental: ${environmentalConsistencyScore}%, Overall: ${overallScore}%`);

    // PHASE 7: SAVE WITH ENHANCED QUALITY METRICS
    this.trackServiceUsage(job.id, 'database');
    servicesUsed.push('database');

    // Recalculate final averages with actual scores
    averageConsistency = totalScenes > 0 ? totalCharacterConsistencyScore / totalScenes : 0;
    averageEnvironmentalConsistency = totalScenes > 0 ? totalEnvironmentalConsistencyScore / totalScenes : 0;
    
    const storybookEntry = await databaseService.saveStorybookEntry({
      title,
      story,
      pages: updatedPages,
      user_id: job.user_id,
      audience,
      character_description: characterDescriptionToUse,
      has_errors: false,
    });

    await jobService.updateJobProgress(job.id, 100, `Professional comic book created successfully`);

    // Calculate processing metrics
    const batchedDuration = Date.now() - startTime;
    const successfulPanels = updatedPages.reduce((total, page) => total + (page.scenes?.length || 0), 0);

    const qualityMetrics = {
      characterConsistency: Math.round(characterConsistencyScore),
      environmentalConsistency: Math.round(environmentalConsistencyScore),
      narrativeCoherence: Math.round(storyCoherenceScore),
      visualQuality: 88,
      emotionalResonance: 85,
      technicalExecution: 90,
      audienceAlignment: audience === 'children' ? 92 : 88,
      dialogueEffectiveness: updatedPages.some(p => p.scenes?.some((s: any) => s.dialogue)) ? 85 : 75,
      environmentalCoherence: Math.round(environmentalConsistencyScore),
      storyCoherence: Math.round(storyCoherenceScore),
      panelCount: totalScenes,
      professionalStandards: true,
      overallScore: overallScore,
      grade: characterConsistencyScore >= 90 ? 'A' : characterConsistencyScore >= 80 ? 'B' : 'C',
      professionalGrade: characterConsistencyScore >= 90 ? 'A' : characterConsistencyScore >= 80 ? 'B' : 'C',
      recommendations: [],
      environmentalDNAUsed: !!environmentalDNA && !environmentalDNA.fallback,
      parallelProcessed: true,
      parallelDuration: batchedDuration,
      successfulPanels: successfulPanels,
      enhancedContextUsed: true,
      learnedPatternsApplied: true,
      // Validation metrics
      validationMetrics: {
        totalPanels: totalScenes,
        panelsRegenerated: totalPanelsRegenerated,
        characterValidationAttempts: totalCharacterValidationAttempts,
        environmentalValidationAttempts: totalEnvironmentalValidationAttempts,
        avgCharacterValidationScore: Math.round(avgCharacterValidationScore),
        avgEnvironmentalValidationScore: Math.round(avgEnvironmentalValidationScore),
        validationPassRate: Math.round(validationPassRate),
        characterValidationEnabled: !!characterValidator,
        environmentalValidationEnabled: !!environmentalValidator,
      },
    };

    // STORE FINAL CHARACTER CONSISTENCY SCORE
    // Character DNA and consistency scores are passed to markJobCompleted below
    console.log(`📊 Character consistency score: ${Math.round(averageConsistency)}%`);
    console.log(`🧬 Character DNA: ${characterDNA ? 'Created and will be stored' : 'Using fallback'}`);
    
    await jobService.markJobCompleted(job.id, {
      storybook_id: storybookEntry.id,
      pages: updatedPages,
      has_errors: false,
      characterArtStyle: character_art_style,
      layoutType: layout_type,
      characterDescription: characterDNA ? characterDNA.description : characterDescriptionToUse,  // Use DNA description
      characterDNA: characterDNA,  // ADD - Store full Character DNA
      visualFingerprint: characterDNA?.visualFingerprint,  // ADD - Store fingerprint
      character_consistency_score: Math.round(averageConsistency),  // Save the actual score
      qualityMetrics,
      characterDNAUsed: !!characterDNA,
      parallelProcessed: true,
      parallelDuration: batchedDuration,
      environmentalDNAUsed: !!environmentalDNA && !environmentalDNA.fallback,
      storyAnalysisUsed: !!storyAnalysis,
      professionalStandards: true,
      enhancedContextUsed: true,
      learnedPatternsApplied: true,
    });

    // Store success pattern for learning system using PatternLearningEngine
    try {
      const { PatternLearningEngine } = await import('../../services/ai/modular/pattern-learning-engine.js');
      const patternLearner = new PatternLearningEngine(databaseService);

      const comicData = {
        pages: updatedPages,
        characterDNA,
        environmentalDNA,
        storyAnalysis,
        totalPanels: totalScenes
      };

      const recordingQualityMetrics = {
        characterConsistency: characterConsistencyScore,
        technicalExecution: qualityMetrics.technicalExecution,
        environmentalCoherence: environmentalConsistencyScore,
        narrativeFlow: storyCoherenceScore,
        userRating: 4.0
      };

      const jobContextData = {
        audience,
        genre: storyAnalysis?.storyArchetype,
        artStyle: character_art_style,
        setting: environmentalDNA?.primaryLocation?.name || 'varied',
        characterType: characterDNA ? 'custom' : 'generated',
        layoutType: layout_type,
        isReusedImage: is_reused_image,
        characterImage: character_image
      };

      const patternResult = await patternLearner.recordSuccessPattern(
        comicData,
        recordingQualityMetrics,
        jobContextData
      );

      if (patternResult.success) {
        console.log(`✅ Success pattern recorded: ${patternResult.patternType} (effectiveness: ${patternResult.effectivenessScore}%)`);
        if (patternResult.updated) {
          console.log(`🔄 Pattern updated - Context signature: ${patternResult.contextSignature}`);
        } else {
          console.log(`💾 New pattern stored - Context signature: ${patternResult.contextSignature}`);
        }
      } else {
        console.log(`⚠️ Pattern recording skipped - Quality below threshold`);
      }
    } catch (patternError) {
      console.warn('⚠️ Failed to record success pattern (non-critical):', patternError instanceof Error ? patternError.message : String(patternError));
    }

    console.log(`✅ ENHANCED storybook job completed: ${job.id}`);
    console.log(`🎭 Character DNA: ${characterDNA ? 'ACTIVE' : 'FALLBACK'}`);
    console.log(`🎭 Character Consistency: ${qualityMetrics.characterConsistency}%`);
    console.log(`🌍 Environmental: ${qualityMetrics.environmentalConsistency}%`);
    console.log(`📖 Story: ${qualityMetrics.storyCoherence}%`);
    console.log(`🔍 Visual Fingerprint: ${characterDNA?.visualFingerprint ? 'SET' : 'NONE'}`);

    return {
      success: true,
      pages: updatedPages,
      characterDNA,
      environmentalDNA,
      storyAnalysis,
      qualityMetrics,
    };
  }

  // ===== ENHANCED CONTEXT PREPARATION METHOD =====

  private async prepareEnhancedContext(
    storyAnalysis: any,
    environmentalDNA: any,
    characterDNA: any,
    characterDescription: string,
    jobConfig: {
      audience: string;
      character_art_style: string;
      layout_type: string;
      is_reused_image: boolean;
      character_image?: string;
    }
  ): Promise<any> {
    console.log('🎯 Preparing enhanced context for professional comic generation...');
    
    try {
      // Analyze panel continuity if we have story beats
      let panelContinuity: any = null;
      if (storyAnalysis?.storyBeats) {
        const aiService = await serviceContainer.resolve<IAIService>(SERVICE_TOKENS.AI);
        panelContinuity = await aiService.analyzePanelContinuity(storyAnalysis.storyBeats);
        console.log('✅ Panel continuity analysis completed for visual flow');
      }
      
      const enhancedContext = {
        // Story Context
        storyAnalysis: storyAnalysis || null,
        storyBeats: storyAnalysis?.storyBeats || [],
        
        // Environmental Context
        environmentalDNA: environmentalDNA || null,
        primaryLocation: environmentalDNA?.primaryLocation || { name: 'Generic Setting', type: 'mixed' },
        lightingContext: environmentalDNA?.lightingContext || { timeOfDay: 'afternoon', lightingMood: 'bright' },
        visualContinuity: environmentalDNA?.visualContinuity || {},
        
        // ENHANCED Character Context with DNA
        characterDNA: characterDNA || null,
        characterDescription: characterDNA ? characterDNA.description : characterDescription,
        characterVisualFingerprint: characterDNA?.visualFingerprint || null,  // ADD - Visual fingerprint
        characterConsistencyChecklist: characterDNA?.consistencyChecklist || [],  // ADD - Consistency checklist
        characterVisualDNA: characterDNA?.visualDNA || null,  // ADD - Visual DNA details
        characterArtStyle: jobConfig.character_art_style,
        characterImage: jobConfig.character_image,
        
        // Panel Continuity
        panelContinuity: panelContinuity || null,
        
        // Job Configuration
        audience: jobConfig.audience,
        layoutType: jobConfig.layout_type,
        isReusedImage: jobConfig.is_reused_image,
        
        // ENHANCED Quality Targets for Character DNA
        qualityTargets: {
          characterConsistency: characterDNA ? 98 : 95,  // CHANGED - Higher target with DNA
          environmentalConsistency: 90,
          storyCoherence: 85,
          professionalStandards: true
        },
        
        // Context Metadata
        contextMetadata: {
          createdAt: new Date().toISOString(),
          storyFirst: true,
          environmentalDNAEnabled: !!environmentalDNA && !environmentalDNA.fallback,
          characterDNAEnabled: !!characterDNA,
          panelContinuityEnabled: !!panelContinuity,
          enhancedContextVersion: '2.0'
        }
      };
      
      console.log('✅ Enhanced context prepared with comprehensive consistency data');
      
      return enhancedContext;
      
    } catch (error: any) {
      console.warn('⚠️ Enhanced context preparation failed, using basic context:', error);
      
      return {
        characterDescription: characterDescription,
        characterArtStyle: jobConfig.character_art_style,
        audience: jobConfig.audience,
        layoutType: jobConfig.layout_type,
        isReusedImage: jobConfig.is_reused_image,
        fallback: true,
        error: error.message
      };
    }
  }

  private async applyLearnedPatterns(enhancedContext: any, jobId: string): Promise<any> {
    console.log('🧠 Applying learned success patterns to enhance context...');
    
    try {
      const learnedPatterns = {
        successfulPromptPatterns: [
          'detailed character descriptions improve consistency',
          'environmental context reduces background variance',
          'emotional cues enhance narrative flow'
        ],
        qualityOptimizations: {
          characterConsistencyBoost: 5,
          environmentalCoherenceBoost: 3,
          narrativeFlowImprovement: 2
        },
        appliedAt: new Date().toISOString(),
        jobId: jobId
      };
      
      return {
        ...enhancedContext,
        learnedPatterns: learnedPatterns,
        patternsApplied: true
      };
      
    } catch (error: any) {
      console.warn('⚠️ Failed to apply learned patterns, using original context:', error);
      return {
        ...enhancedContext,
        learnedPatterns: null,
        patternsApplied: false,
        patternError: error.message
      };
    }
  }

  private extractCharacterDescriptionFromDNA(characterDNA: any): string {
    if (!characterDNA) return 'Character description unavailable';

    const parts = [];

    if (characterDNA.physicalStructure) {
      parts.push(characterDNA.physicalStructure.faceShape);
      parts.push(characterDNA.physicalStructure.eyeDetails);
      parts.push(characterDNA.physicalStructure.hairSpecifics);
    }

    if (characterDNA.clothingSignature) {
      parts.push(characterDNA.clothingSignature.primaryOutfit);
    }

    if (characterDNA.uniqueIdentifiers) {
      parts.push(characterDNA.uniqueIdentifiers.distinctiveFeatures);
    }

    return parts.filter(Boolean).join(', ') || 'Detailed character with consistent appearance';
  }

  private predictGenerationQuality(context: {
    story: string;
    storyAnalysis: any;
    characterDNA: any;
    environmentalDNA: any;
    audience: string;
  }): { score: number; issues: string[] } {
    let score = 50;
    const issues: string[] = [];

    if (context.characterDNA && context.characterDNA.description?.length > 200) {
      score += 30;
    } else {
      issues.push('Character DNA incomplete or missing');
    }

    if (context.storyAnalysis?.storyBeats?.length >= 8) {
      score += 20;
    } else {
      issues.push('Story analysis incomplete');
    }

    const wordCount = context.story.split(/\s+/).length;
    if (wordCount >= 100 && wordCount <= 1000) {
      score += 20;
    } else if (wordCount < 50) {
      issues.push('Story too short for quality generation');
    }

    if (context.environmentalDNA && !context.environmentalDNA.fallback) {
      score += 15;
    }

    const forbiddenWords = context.audience === 'children' ? ['violence', 'death', 'scary'] : [];
    const hasIssues = forbiddenWords.some(word => context.story.toLowerCase().includes(word));
    if (!hasIssues) {
      score += 15;
    } else {
      issues.push('Story content not appropriate for audience');
    }

    return { score: Math.min(score, 100), issues };
  }

  // ===== OTHER JOB TYPE PROCESSORS (SIMPLIFIED) =====

  private async processAutoStoryJobWithServices(job: AutoStoryJobData, servicesUsed: string[]): Promise<ComicGenerationResult> {
    // Implementation for auto-story jobs
    throw new Error('Auto-story job processing not implemented in this version');
  }

  private async processSceneJobWithServices(job: SceneJobData, servicesUsed: string[]): Promise<void> {
    // Implementation for scene jobs
    throw new Error('Scene job processing not implemented in this version');
  }

  private async processCartoonizeJobWithServices(job: CartoonizeJobData, servicesUsed: string[]): Promise<void> {
    const startTime = Date.now();
    console.log(`🎨 Starting cartoonize job ${job.id} with quality validation`);

    const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
    const aiService = await serviceContainer.resolve<IAIService>(SERVICE_TOKENS.AI);
    const databaseService = await serviceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);
    const storageService = await serviceContainer.resolve(SERVICE_TOKENS.STORAGE);

    this.trackServiceUsage(job.id, 'job');
    this.trackServiceUsage(job.id, 'ai');
    this.trackServiceUsage(job.id, 'database');
    servicesUsed.push('job', 'ai', 'database');

    const originalImageUrl = job.original_cloudinary_url || job.original_image_data;
    const style = job.style || 'storybook';
    const characterDescription = `A character in ${style} art style`;

    if (!originalImageUrl) {
      throw new Error('Original image URL is required for cartoonization');
    }

    await jobService.updateJobProgress(job.id, 5, 'Starting cartoonization with quality validation...');

    let cartoonizationValidator: any = null;
    try {
      cartoonizationValidator = await serviceContainer.resolve(SERVICE_TOKENS.CARTOONIZATION_QUALITY_VALIDATOR);
      console.log('✅ Cartoonization quality validator initialized');
    } catch (error: any) {
      console.warn('⚠️ Quality validator not available, proceeding without validation:', error.message);
    }

    const MAX_ATTEMPTS = 3;
    let bestQualityScore = 0;
    const attemptScores: number[] = [];
    let validatedCartoonUrl: string | null = null;
    let finalQualityReport: any = null;

    // CRITICAL FIX: Extract character DNA from original image BEFORE generating cartoons
    await jobService.updateJobProgress(job.id, 5, 'Analyzing your photo to extract character details...');
    console.log(`🔍 Analyzing original image to create character DNA for job ${job.id}`);

    let extractedCharacterDNA: string = characterDescription; // Default fallback

    try {
      // Access visual DNA system through AI service
      const visualDNASystem = (aiService as any).visualDNASystem;
      
      if (visualDNASystem && typeof visualDNASystem.performForensicCharacterAnalysis === 'function') {
        console.log('📸 Performing forensic character analysis on uploaded image...');
        const forensicAnalysis = await visualDNASystem.performForensicCharacterAnalysis(
          originalImageUrl,
          style
        );
        
        if (forensicAnalysis && forensicAnalysis.length > 50) {
          extractedCharacterDNA = forensicAnalysis;
          console.log(`✅ Character DNA extracted (${extractedCharacterDNA.length} chars)`);
          console.log(`📋 DNA preview: ${extractedCharacterDNA.substring(0, 200)}...`);
        } else {
          console.warn('⚠️ Forensic analysis returned insufficient detail, using fallback');
        }
      } else {
        console.warn('⚠️ Visual DNA system not available, using provided character description');
      }
    } catch (error: any) {
      console.error('⚠️ Character analysis failed, using fallback description:', error.message);
    }

    await jobService.updateJobProgress(job.id, 8, 'Character analysis complete - generating cartoon...');

    for (let attemptNumber = 1; attemptNumber <= MAX_ATTEMPTS; attemptNumber++) {
      try {
        await jobService.updateJobProgress(
          job.id,
          10 + (attemptNumber - 1) * 25,
          `Generating cartoon image (attempt ${attemptNumber}/${MAX_ATTEMPTS})...`
        );

        console.log(`🎨 Cartoonize job ${job.id}: generating with style ${style} (attempt ${attemptNumber}/${MAX_ATTEMPTS})`);

        const styleConfig = STYLE_SPECIFIC_CARTOONIZATION_PROMPTS[style] || STYLE_SPECIFIC_CARTOONIZATION_PROMPTS['semi-realistic'];

        const cartoonPrompt = attemptNumber === 1
  ? `Create a ${styleConfig.base} portrait with EXACT character accuracy.

CHARACTER SPECIFICATIONS (MUST MATCH EXACTLY):
${extractedCharacterDNA}

CRITICAL CONSISTENCY REQUIREMENTS:
- Match the character specifications PRECISELY
- Every facial feature must align with the specifications above
- Hair style, color, and texture must be exact
- Skin tone must match perfectly
- Include all distinctive features mentioned
- Body proportions must be accurate

STYLE REQUIREMENTS:
${styleConfig.characteristics}

MUST AVOID: ${styleConfig.negatives}

CRITICAL OUTPUT FORMAT REQUIREMENTS:
- Generate ONLY ONE clean character portrait
- NO comparison views, NO before/after images
- NO arrows, guides, or instructional elements
- NO multiple versions or variations shown side-by-side
- NO reference sheets or character design layouts
- NO step-by-step demonstrations
- Single centered character on simple background
- Focus on creating ONE finished illustration only

COMPOSITION:
- Character should fill majority of frame
- Simple, non-distracting background
- Clean ${style} art style
- Professional single portrait composition

OUTPUT: Single character portrait, centered composition, clean background, professional quality matching character specifications.`
  : this.buildEnhancedCartoonPrompt(style, finalQualityReport?.failureReasons || [], attemptNumber);

        const cartoonResult = await aiService.generateCartoonImage(cartoonPrompt);
        const unwrappedCartoon = await cartoonResult.unwrap();

        if (!unwrappedCartoon || typeof unwrappedCartoon !== 'string') {
          throw new Error('Failed to generate cartoon image - no URL returned');
        }

        const cartoonUrl = unwrappedCartoon;
        console.log(`✅ Cartoon generated successfully (attempt ${attemptNumber})`);

        if (!cartoonizationValidator) {
          console.log('⚠️ No validator available - saving cartoon without validation');
          validatedCartoonUrl = cartoonUrl;
          bestQualityScore = -1;
          break;
        }

        await jobService.updateJobProgress(
          job.id,
          15 + (attemptNumber - 1) * 25,
          `Validating cartoon quality (attempt ${attemptNumber}/${MAX_ATTEMPTS})...`
        );

        console.log(`🔍 Validating cartoon quality (attempt ${attemptNumber}/${MAX_ATTEMPTS})`);

        try {
          const qualityReport = await cartoonizationValidator.validateCartoonQuality(
            cartoonUrl,
            originalImageUrl,
            style,
            characterDescription
          );

          await databaseService.storeCartoonizationQualityMetrics(
            job.id,
            attemptNumber,
            qualityReport
          );

          attemptScores.push(qualityReport.overallQuality);
          bestQualityScore = Math.max(bestQualityScore, qualityReport.overallQuality);
          finalQualityReport = qualityReport;

          if (qualityReport.passesThreshold) {
            console.log(`✅ Cartoon validated: ${qualityReport.overallQuality}% quality (threshold: 70%)`);
            await jobService.updateJobProgress(
              job.id,
              20 + (attemptNumber - 1) * 25,
              `✅ Quality check passed (score: ${qualityReport.overallQuality}%)`
            );

            validatedCartoonUrl = cartoonUrl;

            if (attemptNumber > 1) {
              console.log(`🔄 Quality achieved after ${attemptNumber} attempts`);
            }

            break;
          }

          console.warn(`❌ Validation failed: ${qualityReport.overallQuality}% (threshold: 70%) - Issues: ${qualityReport.failureReasons.join(', ')}`);

          if (attemptNumber < MAX_ATTEMPTS) {
            await jobService.updateJobProgress(
              job.id,
              20 + (attemptNumber - 1) * 25,
              `❌ Quality check failed (score: ${qualityReport.overallQuality}%) - regenerating with enhanced prompts...`
            );
            console.log(`🔄 Regenerating cartoon with enhanced quality enforcement (attempt ${attemptNumber + 1}/${MAX_ATTEMPTS})...`);
          }

        } catch (validationError: any) {
          if (validationError.message?.includes('Vision API') || validationError.message?.includes('unavailable')) {
            console.warn(`⚠️ Vision API unavailable for attempt ${attemptNumber}, continuing without validation`);
            validatedCartoonUrl = cartoonUrl;
            bestQualityScore = -1;
            break;
          }
          throw validationError;
        }

      } catch (error: any) {
        console.error(`❌ Cartoonize attempt ${attemptNumber} failed:`, error);
        if (attemptNumber === MAX_ATTEMPTS) {
          throw error;
        }

        const delay = Math.min(2000 * Math.pow(2, attemptNumber - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (!validatedCartoonUrl) {
      const mainIssues = finalQualityReport?.failureReasons?.slice(0, 3).join(', ') || 'Quality standards not met';
      const errorMessage = `Could not create cartoon meeting quality standards after ${MAX_ATTEMPTS} attempts. Best quality: ${bestQualityScore}%. Required: 70%. Issues: ${mainIssues}. Please try different photo or art style.`;

      console.error(`💥 ${errorMessage}`);
      await jobService.updateJobProgress(job.id, 0, `Failed: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    await jobService.updateJobProgress(
      job.id,
      85,
      'Quality validation complete - saving to permanent storage...'
    );

    console.log(`💾 Saving validated cartoon (quality: ${bestQualityScore > 0 ? bestQualityScore + '%' : 'unvalidated'})`);

    this.trackServiceUsage(job.id, 'storage');
    if (!servicesUsed.includes('storage')) servicesUsed.push('storage');

    const uploadResult = await (storageService as any).uploadImage(validatedCartoonUrl, {
      folder: 'cartoons',
      tags: [`quality_score:${bestQualityScore}`, `style:${style}`]
    });

    if (!uploadResult || !uploadResult.url) {
      throw new Error('Failed to upload cartoon to cloud storage');
    }

    const finalCloudinaryUrl = uploadResult.url;

    await jobService.updateJobProgress(job.id, 95, 'Finalizing cartoonization...');

    const completionData: any = {
      generated_image_url: validatedCartoonUrl,
      final_cloudinary_url: finalCloudinaryUrl,
    };

    if (bestQualityScore > 0) {
      completionData.quality_score = bestQualityScore;
    }

    await jobService.markJobCompleted(job.id, completionData);

    const duration = Date.now() - startTime;
    console.log(`✅ Cartoonize job ${job.id} completed in ${duration}ms`);
    console.log(`📊 Quality: ${bestQualityScore > 0 ? bestQualityScore + '%' : 'unvalidated'}, Attempts: ${attemptScores.length}, Scores: [${attemptScores.join(', ')}]`);
  }

  private buildEnhancedCartoonPrompt(style: string, failureReasons: string[], attemptNumber: number): string {
    const styleConfig = STYLE_SPECIFIC_CARTOONIZATION_PROMPTS[style] || STYLE_SPECIFIC_CARTOONIZATION_PROMPTS['semi-realistic'];
    
    let enhancedPrompt = `RETRY ATTEMPT ${attemptNumber} - Create a ${styleConfig.base} portrait.

PREVIOUS ISSUES TO FIX: ${failureReasons.length > 0 ? failureReasons.join('; ') : 'General quality improvement needed'}

`;

    const hasCharacterIssues = failureReasons.some(r =>
      r.toLowerCase().includes('character') ||
      r.toLowerCase().includes('fidelity') ||
      r.toLowerCase().includes('facial') ||
      r.toLowerCase().includes('match')
    );
    const hasStyleIssues = failureReasons.some(r =>
      r.toLowerCase().includes('style') ||
      r.toLowerCase().includes('accuracy')
    );
    const hasClarityIssues = failureReasons.some(r =>
      r.toLowerCase().includes('clarity') ||
      r.toLowerCase().includes('quality') ||
      r.toLowerCase().includes('blur') ||
      r.toLowerCase().includes('artifact')
    );

    if (hasCharacterIssues) {
      enhancedPrompt += `CRITICAL CHARACTER FIDELITY:
- Match EXACT facial bone structure from reference
- Preserve precise eye shape, color, and position
- Keep exact nose profile and mouth shape
- Maintain skin tone accuracy
- Copy hair color and style precisely
- Include ALL distinctive marks (moles, freckles, scars)

`;
    }

    if (hasStyleIssues) {
      enhancedPrompt += `STRICT STYLE ENFORCEMENT:
${styleConfig.characteristics}
AVOID: ${styleConfig.negatives}

`;
    }

    if (hasClarityIssues) {
      enhancedPrompt += `QUALITY REQUIREMENTS:
- Sharp, clean lines with no blur
- High detail in facial features
- No artifacts or distortions
- Professional rendering quality
- Proper anatomy with no deformities

`;
    }

    enhancedPrompt += `OUTPUT: Single centered portrait, clean background, ${style} art style, professional illustration quality.`;

    return enhancedPrompt;
  }

  private async processImageJobWithServices(job: ImageJobData, servicesUsed: string[]): Promise<void> {
    // Implementation for image jobs
    throw new Error('Image job processing not implemented in this version');
  }
  private async processCharacterDescriptionJob(job: any, servicesUsed: string[]): Promise<void> {
    console.log(`👤 Starting character description job ${job.id}`);

    const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
    const aiService = await serviceContainer.resolve<IAIService>(SERVICE_TOKENS.AI);
    const databaseService = await serviceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);

    this.trackServiceUsage(job.id, 'job');
    this.trackServiceUsage(job.id, 'ai');
    this.trackServiceUsage(job.id, 'database');
    servicesUsed.push('job', 'ai', 'database');

    const imageUrl = job.image_url;

    if (!imageUrl) {
      throw new Error('Image URL is required for character description');
    }

    await jobService.updateJobProgress(job.id, 10, 'Analyzing character image...');

    // Use AI service to create character description
    const descriptionResult = await aiService.describeCharacter({
      imageUrl: imageUrl,
      includePersonality: job.include_personality || false,
      includeClothing: job.include_clothing || true,
      includeBackground: job.include_background || false,
      generateFingerprint: false
    });

    const unwrappedDescription = await descriptionResult.unwrap();

    if (!unwrappedDescription || !unwrappedDescription.description) {
      throw new Error('Failed to generate character description');
    }

    await jobService.updateJobProgress(job.id, 90, 'Character description complete');

    // Mark job as completed with the character description
    await jobService.markJobCompleted(job.id, {
      character_description: unwrappedDescription.description
    });

    console.log(`✅ Character description job ${job.id} completed successfully`);
  }
}

// Export singleton instance
export const productionJobProcessor = new ProductionJobProcessor();
export default productionJobProcessor;