// Production-ready job processor using enhanced service architecture
// Consolidates all previous implementations with clean architecture principles

import { enhancedServiceContainer } from '../../services/container/enhanced-service-container.js';
import { 
  SERVICE_TOKENS, 
  IDatabaseService, 
  IAIService, 
  IJobService,
  IServiceHealth,
  IServiceMetrics
} from '../../services/interfaces/service-contracts.js';
import { 
  Result,
  ErrorFactory,
  ServiceError,
  createJobCorrelationContext,
  withCorrelationResult
} from '../../services/errors/index.js';
import { JobData, JobType, StorybookJobData, AutoStoryJobData, SceneJobData, CartoonizeJobData, ImageJobData } from '../types.js';

// ===== JOB PROCESSING INTERFACES =====

interface JobProcessingResult {
  success: boolean;
  jobId: string;
  error?: ServiceError;
  duration?: number;
  servicesUsed?: string[];
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

// ===== PRODUCTION JOB PROCESSOR =====

export class ProductionJobProcessor implements IServiceHealth, IServiceMetrics {
  private isProcessing = false;
  private readonly maxConcurrentJobs = 5;
  
  // Internal state (encapsulated, not exposed directly)
  private currentlyProcessing = new Map<string, {
    jobId: string;
    jobType: JobType;
    startTime: number;
    servicesUsed: Set<string>;
  }>();

  // Metrics (internal state, exposed through computed properties)
  private internalStats = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    timeouts: 0,
    concurrentPeak: 0,
    lastProcessedAt: null as Date | null,
    errorsByService: new Map<string, number>(),
    serviceUsageStats: new Map<string, number>(),
  };

  constructor() {
    console.log('🏗️ Production job processor initialized with enhanced service architecture');
    
    // Periodic cleanup of stale jobs
    setInterval(() => this.cleanupStaleJobs(), 300000); // Every 5 minutes
  }

  // ===== HEALTH INTERFACE IMPLEMENTATION =====

  isHealthy(): boolean {
    try {
      // Check basic processor health
      const baseHealth = this.currentlyProcessing.size < this.maxConcurrentJobs;
      
      // Check failure rates (computed, not exposing internal state)
      const recentFailureRate = this.internalStats.totalProcessed > 0 
        ? this.internalStats.failed / this.internalStats.totalProcessed 
        : 0;
      const healthyFailureRate = recentFailureRate < 0.5;
      
      const timeoutRate = this.internalStats.totalProcessed > 0 
        ? this.internalStats.timeouts / this.internalStats.totalProcessed 
        : 0;
      const healthyTimeoutRate = timeoutRate < 0.2;
      
      return baseHealth && healthyFailureRate && healthyTimeoutRate;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return false;
    }
  }

  getHealthStatus(): ProcessorHealthStatus {
    const concurrencyUtilization = (this.currentlyProcessing.size / this.maxConcurrentJobs) * 100;
    const failureRate = this.internalStats.totalProcessed > 0 
      ? (this.internalStats.failed / this.internalStats.totalProcessed) * 100 
      : 0;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;
    let availability: number;

    if (this.isHealthy()) {
      if (failureRate > 10) {
        status = 'degraded';
        message = `High failure rate: ${failureRate.toFixed(1)}%`;
        availability = Math.max(50, 100 - failureRate);
      } else {
        status = 'healthy';
        message = 'Processor operating normally';
        availability = 100;
      }
    } else {
      status = 'unhealthy';
      message = 'Processor health check failed';
      availability = 0;
    }

    return {
      status,
      message,
      availability,
      concurrencyUtilization,
      serviceHealth: {}, // Would be populated with actual service health
      lastCheck: new Date().toISOString(),
    };
  }

  // ===== METRICS INTERFACE IMPLEMENTATION =====

  getMetrics() {
    return {
      requestCount: this.internalStats.totalProcessed,
      successCount: this.internalStats.successful,
      errorCount: this.internalStats.failed,
      averageResponseTime: 0, // Would calculate from processing times
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
    };
    
    console.log('📊 Processor metrics reset');
  }

  // ===== PUBLIC PROCESSING INTERFACE =====

  /**
   * Get processing statistics (computed properties, not internal state)
   */
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
      },
    };
  }

  /**
   * Process next job step using enhanced service architecture
   */
  async processNextJobStep(): Promise<boolean> {
    if (this.isProcessing || this.currentlyProcessing.size >= this.maxConcurrentJobs) {
      return false;
    }

    this.isProcessing = true;
    let processedAny = false;

    try {
      // Get pending jobs using service abstraction
      const jobService = await enhancedServiceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
      const pendingJobs = await jobService.getPendingJobs({}, 10);
      
      for (const job of pendingJobs) {
        if (!this.addToProcessing(job.id, job.type)) {
          continue;
        }

        processedAny = true;
        this.processJobWithCleanup(job);
      }
    } catch (error: any) {
      console.error('❌ Error in processNextJobStep:', error);
      this.handleJobError('batch', error, 'processNextJobStep', 'job');
    } finally {
      this.isProcessing = false;
    }

    return processedAny;
  }

  /**
   * Process individual job (public interface)
   */
  async processJobAsync(job: JobData): Promise<void> {
    await this.processJobWithCleanup(job);
  }

  // ===== PRIVATE IMPLEMENTATION (ENCAPSULATED) =====

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
    });

    this.internalStats.concurrentPeak = Math.max(this.internalStats.concurrentPeak, this.currentlyProcessing.size);
    
    console.log(`📈 Added job ${jobId} to processing queue (${this.currentlyProcessing.size}/${this.maxConcurrentJobs})`);
    return true;
  }

  private removeFromProcessing(jobId: string): void {
    const jobInfo = this.currentlyProcessing.get(jobId);
    if (jobInfo) {
      const duration = Date.now() - jobInfo.startTime;
      
      // Update service usage statistics
      jobInfo.servicesUsed.forEach(service => {
        this.internalStats.serviceUsageStats.set(service, (this.internalStats.serviceUsageStats.get(service) || 0) + 1);
      });
      
      this.currentlyProcessing.delete(jobId);
      
      console.log(`📉 Removed job ${jobId} from processing queue (duration: ${duration}ms, services: ${Array.from(jobInfo.servicesUsed).join(', ')}, remaining: ${this.currentlyProcessing.size})`);
    }
  }

  private trackServiceUsage(jobId: string, serviceName: string): void {
    const jobInfo = this.currentlyProcessing.get(jobId);
    if (jobInfo) {
      jobInfo.servicesUsed.add(serviceName);
    }
  }

  private cleanupStaleJobs(): void {
    const now = Date.now();
    const staleThreshold = 600000; // 10 minutes
    let cleanedCount = 0;

    for (const [jobId, jobInfo] of this.currentlyProcessing.entries()) {
      if (now - jobInfo.startTime > staleThreshold) {
        console.warn(`🧹 Cleaning up stale job ${jobId} (running for ${now - jobInfo.startTime}ms)`);
        this.removeFromProcessing(jobId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} stale jobs`);
    }
  }

  private handleJobError(jobId: string, error: any, operation: string, serviceName?: string): JobProcessingResult {
    let errorType: ServiceError['type'] = 'UNKNOWN_ERROR';
    let errorMessage = error.message || 'Unknown error occurred';

    // Classify error types based on service and error characteristics
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

    // Track error statistics by service
    const errorKey = serviceName ? `${serviceName}_${errorType}` : errorType;
    this.internalStats.errorsByService.set(errorKey, (this.internalStats.errorsByService.get(errorKey) || 0) + 1);

    console.error(`❌ Job ${jobId} failed in ${operation} (${errorType}${serviceName ? ` - ${serviceName}` : ''}):`, errorMessage);

    const serviceError = ErrorFactory.fromUnknown(error, {
      service: serviceName || 'job-processor',
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
        console.log(`✅ Job ${job.id} completed successfully in ${Date.now() - startTime}ms using services: ${result.servicesUsed?.join(', ')}`);
      } else {
        this.internalStats.failed++;
        
        // Determine if job should be retried based on error type and service
        const shouldRetry = result.error?.type !== 'JOB_VALIDATION_ERROR' && 
                           result.error?.type !== 'AUTHENTICATION_ERROR' && 
                           result.error?.type !== 'JOB_TIMEOUT_ERROR';
        
        this.trackServiceUsage(job.id, 'job');
        const jobService = await enhancedServiceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
        await jobService.markJobFailed(job.id, result.error?.message || 'Unknown error', shouldRetry);
      }
    } catch (error: any) {
      result = this.handleJobError(job.id, error, 'processJobWithCleanup');
      this.internalStats.failed++;
      
      try {
        this.trackServiceUsage(job.id, 'job');
        const jobService = await enhancedServiceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
        await jobService.markJobFailed(job.id, result.error?.message || 'Unknown error', true);
      } catch (serviceError) {
        console.error(`❌ Failed to mark job as failed: ${job.id}`, serviceError);
      }
    } finally {
      this.removeFromProcessing(job.id);
      this.internalStats.totalProcessed++;
      this.internalStats.lastProcessedAt = new Date();
    }
  }

  @withCorrelationResult('job-processor', 'processJob')
  private async processJobWithServices(job: JobData): Promise<JobProcessingResult> {
    const startTime = Date.now();
    const servicesUsed: string[] = [];
    
    try {
      console.log(`🔄 Processing job: ${job.id} (${job.type}) using enhanced service architecture`);

      // Get job service through container (dependency injection)
      this.trackServiceUsage(job.id, 'job');
      servicesUsed.push('job');
      const jobService = await enhancedServiceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);

      // Update job to processing status
      if (job.status === 'pending') {
        await jobService.updateJobProgress(job.id, 1, 'Starting job processing');
      }

      // Route to appropriate processor using service abstractions
      switch (job.type) {
        case 'storybook':
          await this.processStorybookJobWithServices(job as StorybookJobData, servicesUsed);
          break;
        case 'auto-story':
          await this.processAutoStoryJobWithServices(job as AutoStoryJobData, servicesUsed);
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
        default:
          throw new Error(`Unknown job type: ${(job as JobData).type}`);
      }

      return {
        success: true,
        jobId: job.id,
        duration: Date.now() - startTime,
        servicesUsed,
      };

    } catch (error: any) {
      return this.handleJobError(job.id, error, `process${job.type}Job`);
    }
  }

  // ===== JOB-SPECIFIC PROCESSORS USING SERVICE ABSTRACTIONS =====

  private async processStorybookJobWithServices(job: StorybookJobData, servicesUsed: string[]): Promise<void> {
    const { title, story, characterImage, pages, audience, isReusedImage } = job.input_data;

    // Get services through container (clean dependency injection)
    const jobService = await enhancedServiceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
    const aiService = await enhancedServiceContainer.resolve<IAIService>(SERVICE_TOKENS.AI);
    const databaseService = await enhancedServiceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);

    this.trackServiceUsage(job.id, 'job');
    servicesUsed.push('job');
    await jobService.updateJobProgress(job.id, 10, 'Starting storybook creation');

    // Character description if needed
    let characterDescription = '';
    if (!isReusedImage && characterImage) {
      this.trackServiceUsage(job.id, 'ai');
      servicesUsed.push('ai');
      
      const prompt = 'You are a professional character artist. Describe this character for cartoon generation.';
      characterDescription = await aiService.describeCharacter(characterImage, prompt);
    }

    await jobService.updateJobProgress(job.id, 30, 'Character analyzed, generating scenes');

    // Generate scenes for each page
    const updatedPages = [];
    for (const [pageIndex, page] of pages.entries()) {
      const updatedScenes = [];
      
      for (const [sceneIndex, scene] of (page.scenes || []).entries()) {
        await jobService.updateJobProgress(
          job.id, 
          30 + ((pageIndex * page.scenes.length + sceneIndex) / pages.reduce((total, p) => total + p.scenes.length, 0)) * 50,
          `Generating image for page ${pageIndex + 1}, scene ${sceneIndex + 1}`
        );

        try {
          this.trackServiceUsage(job.id, 'ai');
          if (!servicesUsed.includes('ai')) servicesUsed.push('ai');
          
          const imageUrl = await aiService.generateCartoonImage(scene.imagePrompt);
          
          updatedScenes.push({
            ...scene,
            generatedImage: imageUrl,
          });
        } catch (error) {
          console.warn(`⚠️ Failed to generate image for scene, using fallback:`, error);
          updatedScenes.push({
            ...scene,
            generatedImage: characterImage,
          });
        }
      }
      
      updatedPages.push({
        pageNumber: pageIndex + 1,
        scenes: updatedScenes,
      });
    }

    await jobService.updateJobProgress(job.id, 80, 'Images generated, saving storybook');

    // Save to database using service abstraction
    this.trackServiceUsage(job.id, 'database');
    servicesUsed.push('database');
    
    const storybookEntry = await databaseService.saveStorybookEntry({
      title,
      story,
      pages: updatedPages,
      user_id: job.user_id,
      audience,
      character_description: characterDescription,
      has_errors: false,
    });

    await jobService.updateJobProgress(job.id, 100, 'Storybook saved successfully');

    // Mark job as completed
    await jobService.markJobCompleted(job.id, {
      storybook_id: storybookEntry.id,
      pages: updatedPages,
      has_errors: false,
    });

    console.log(`✅ Storybook job completed: ${job.id}`);
  }

  private async processAutoStoryJobWithServices(job: AutoStoryJobData, servicesUsed: string[]): Promise<void> {
    const { genre, characterDescription, cartoonImageUrl, audience } = job.input_data;

    const jobService = await enhancedServiceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
    const aiService = await enhancedServiceContainer.resolve<IAIService>(SERVICE_TOKENS.AI);
    const databaseService = await enhancedServiceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);

    await jobService.updateJobProgress(job.id, 10, 'Starting auto-story generation');

    // Generate story
    this.trackServiceUsage(job.id, 'ai');
    servicesUsed.push('ai');
    
    const storyPrompt = `Create a ${genre} story for ${audience} audience featuring: ${characterDescription}`;
    const generatedStory = await aiService.generateStory(storyPrompt);

    await jobService.updateJobProgress(job.id, 50, 'Story generated, creating scenes');

    // Generate scenes
    const scenePrompt = `Create comic book scenes for this story: ${generatedStory}`;
    const scenes = await aiService.generateScenes(scenePrompt, `Generate scenes for ${audience} audience`);

    await jobService.updateJobProgress(job.id, 80, 'Scenes generated, saving to database');

    // Save to database
    this.trackServiceUsage(job.id, 'database');
    servicesUsed.push('database');
    
    const storybook = await databaseService.saveStorybookEntry({
      title: `${genre} Story`,
      story: generatedStory,
      pages: scenes.pages,
      user_id: job.user_id,
      audience,
      character_description: characterDescription,
      has_errors: false,
    });

    await jobService.updateJobProgress(job.id, 100, 'Auto-story generation complete');

    await jobService.markJobCompleted(job.id, {
      storybook_id: storybook.id,
      generated_story: generatedStory,
    });

    console.log(`✅ Auto-story job completed: ${job.id}`);
  }

  private async processSceneJobWithServices(job: SceneJobData, servicesUsed: string[]): Promise<void> {
    const { story, characterImage, audience } = job.input_data;

    const jobService = await enhancedServiceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
    const aiService = await enhancedServiceContainer.resolve<IAIService>(SERVICE_TOKENS.AI);

    await jobService.updateJobProgress(job.id, 20, 'Analyzing story for scene generation');

    // Generate scenes
    this.trackServiceUsage(job.id, 'ai');
    servicesUsed.push('ai');
    
    const systemPrompt = `Generate comic book scenes for ${audience} audience`;
    const scenes = await aiService.generateScenes(systemPrompt, story);

    await jobService.updateJobProgress(job.id, 100, 'Scene generation complete');

    await jobService.markJobCompleted(job.id, {
      pages: scenes.pages,
      character_description: 'Generated character',
    });

    console.log(`✅ Scene job completed: ${job.id}`);
  }

  private async processCartoonizeJobWithServices(job: CartoonizeJobData, servicesUsed: string[]): Promise<void> {
    const { prompt, style, imageUrl } = job.input_data;

    const jobService = await enhancedServiceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
    const aiService = await enhancedServiceContainer.resolve<IAIService>(SERVICE_TOKENS.AI);

    await jobService.updateJobProgress(job.id, 20, 'Preparing image for cartoonization');

    // Generate cartoon image
    this.trackServiceUsage(job.id, 'ai');
    servicesUsed.push('ai');
    
    const cartoonPrompt = `Create a ${style} cartoon style image: ${prompt}`;
    const generatedUrl = await aiService.generateCartoonImage(cartoonPrompt);

    await jobService.updateJobProgress(job.id, 100, 'Cartoonization complete');

    await jobService.markJobCompleted(job.id, {
      url: generatedUrl,
      cached: false,
      style: style,
    });

    console.log(`✅ Cartoonize job completed: ${job.id}`);
  }

  private async processImageJobWithServices(job: ImageJobData, servicesUsed: string[]): Promise<void> {
    const { image_prompt, character_description, emotion, audience } = job.input_data;

    const jobService = await enhancedServiceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
    const aiService = await enhancedServiceContainer.resolve<IAIService>(SERVICE_TOKENS.AI);

    await jobService.updateJobProgress(job.id, 20, 'Starting image generation');

    // Generate image
    this.trackServiceUsage(job.id, 'ai');
    servicesUsed.push('ai');
    
    const finalPrompt = `${image_prompt} featuring ${character_description} with ${emotion} emotion for ${audience} audience`;
    const imageUrl = await aiService.generateCartoonImage(finalPrompt);

    await jobService.updateJobProgress(job.id, 100, 'Image generation complete');

    await jobService.markJobCompleted(job.id, {
      url: imageUrl,
      prompt_used: finalPrompt,
      reused: false,
    });

    console.log(`✅ Image job completed: ${job.id}`);
  }
}

// Export singleton instance
export const productionJobProcessor = new ProductionJobProcessor();
export default productionJobProcessor;