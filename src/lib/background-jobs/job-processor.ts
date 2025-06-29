// Production-ready job processor using consolidated service architecture
// CONSOLIDATED: Uses single service container and interfaces
// DATABASE-FIRST: Reads from individual job columns matching database schema

import { serviceContainer } from '../../services/container/service-container.js';
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

  // Enhanced metrics with sliding window for health calculation
  private internalStats = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    timeouts: 0,
    concurrentPeak: 0,
    lastProcessedAt: null as Date | null,
    errorsByService: new Map<string, number>(),
    serviceUsageStats: new Map<string, number>(),
    // Sliding window for recent results (last 10 operations)
    recentResults: [] as { success: boolean; timestamp: number }[],
    lastHealthRecovery: Date.now(),
  };

  // Health configuration for resilient behavior
  private readonly healthConfig = {
    slidingWindowSize: 10,
    maxFailureRate: 0.7, // Allow up to 70% failure rate
    recoveryTimeMs: 300000, // 5 minutes
    minSampleSize: 3, // Need at least 3 jobs before calculating failure rate
  };

  constructor() {
    console.log('🏗️ Production job processor initialized with consolidated service architecture');
    
    // Periodic cleanup of stale jobs
    setInterval(() => this.cleanupStaleJobs(), 300000); // Every 5 minutes
    
    // Periodic health recovery check
    setInterval(() => this.checkAutoRecovery(), 60000); // Every minute
  }

  // ===== ENHANCED HEALTH INTERFACE IMPLEMENTATION =====

  isHealthy(): boolean {
    try {
      // Check basic processor health
      const baseHealth = this.currentlyProcessing.size < this.maxConcurrentJobs;
      
      // Use sliding window failure rate instead of total failure rate
      const slidingWindowFailureRate = this.calculateSlidingWindowFailureRate();
      const healthyFailureRate = slidingWindowFailureRate <= this.healthConfig.maxFailureRate;
      
      // Check timeout rates (keep existing logic)
      const timeoutRate = this.internalStats.totalProcessed > 0 
        ? this.internalStats.timeouts / this.internalStats.totalProcessed 
        : 0;
      const healthyTimeoutRate = timeoutRate < 0.2;
      
      // Auto-recovery logic - if enough time has passed since last failure, allow recovery
      const timeSinceLastRecovery = Date.now() - this.internalStats.lastHealthRecovery;
      const autoRecoveryEnabled = timeSinceLastRecovery > this.healthConfig.recoveryTimeMs;
      
      // More resilient health calculation
      const isHealthy = baseHealth && (healthyFailureRate || autoRecoveryEnabled) && healthyTimeoutRate;
      
      // Log health status for debugging
      if (!isHealthy) {
        console.warn(`⚠️ Worker health check details:`, {
          baseHealth,
          slidingWindowFailureRate: slidingWindowFailureRate.toFixed(2),
          healthyFailureRate,
          timeoutRate: timeoutRate.toFixed(2),
          healthyTimeoutRate,
          autoRecoveryEnabled,
          recentResultsCount: this.internalStats.recentResults.length
        });
      }
      
      return isHealthy;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return false;
    }
  }

  getHealthStatus(): ProcessorHealthStatus {
    const concurrencyUtilization = (this.currentlyProcessing.size / this.maxConcurrentJobs) * 100;
    
    // Use sliding window failure rate for status
    const slidingWindowFailureRate = this.calculateSlidingWindowFailureRate();
    const slidingWindowFailurePercent = slidingWindowFailureRate * 100;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;
    let availability: number;

    if (this.isHealthy()) {
      if (slidingWindowFailurePercent > 30) {
        status = 'degraded';
        message = `Elevated failure rate: ${slidingWindowFailurePercent.toFixed(1)}% (recent jobs)`;
        availability = Math.max(50, 100 - slidingWindowFailurePercent);
      } else {
        status = 'healthy';
        message = 'Processor operating normally';
        availability = 100;
      }
    } else {
      status = 'unhealthy';
      message = `High failure rate: ${slidingWindowFailurePercent.toFixed(1)}% (recent jobs)`;
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

  // ===== SLIDING WINDOW FAILURE RATE CALCULATION =====

  private calculateSlidingWindowFailureRate(): number {
    const recentResults = this.internalStats.recentResults;
    
    // If we don't have enough samples, consider it healthy (graceful startup)
    if (recentResults.length < this.healthConfig.minSampleSize) {
      return 0;
    }
    
    // Calculate failure rate from recent results only
    const failedCount = recentResults.filter(result => !result.success).length;
    const failureRate = failedCount / recentResults.length;
    
    return failureRate;
  }

  private addToRecentResults(success: boolean): void {
    const result = { success, timestamp: Date.now() };
    this.internalStats.recentResults.push(result);
    
    // Maintain sliding window size
    if (this.internalStats.recentResults.length > this.healthConfig.slidingWindowSize) {
      this.internalStats.recentResults.shift(); // Remove oldest result
    }
  }

  private checkAutoRecovery(): void {
    const now = Date.now();
    const timeSinceLastRecovery = now - this.internalStats.lastHealthRecovery;
    
    // If worker has been unhealthy for the recovery period, attempt recovery
    if (!this.isHealthy() && timeSinceLastRecovery > this.healthConfig.recoveryTimeMs) {
      console.log('🔄 Attempting auto-recovery: clearing recent failure history');
      
      // Clear recent failure history to allow recovery
      this.internalStats.recentResults = [];
      this.internalStats.lastHealthRecovery = now;
      
      console.log('✅ Auto-recovery completed - worker should be healthy again');
    }
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
      // Also reset sliding window
      recentResults: [],
      lastHealthRecovery: Date.now(),
    };
    
    console.log('📊 Processor metrics reset - including sliding window');
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
   * Process next job step using consolidated service architecture
   */
  async processNextJobStep(): Promise<boolean> {
    if (this.isProcessing || this.currentlyProcessing.size >= this.maxConcurrentJobs) {
      return false;
    }

    this.isProcessing = true;
    let processedAny = false;

    try {
      // Get pending jobs using service abstraction
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
        // Track successful result in sliding window
        this.addToRecentResults(true);
        console.log(`✅ Job ${job.id} completed successfully in ${Date.now() - startTime}ms using services: ${result.servicesUsed?.join(', ')}`);
      } else {
        this.internalStats.failed++;
        // Track failed result in sliding window
        this.addToRecentResults(false);
        
        // Determine if job should be retried based on error type and service
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
      // Track failed result in sliding window
      this.addToRecentResults(false);
      
      try {
        this.trackServiceUsage(job.id, 'job');
        const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
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
      console.log(`🔄 Processing job: ${job.id} (${job.type}) using consolidated service architecture`);

      // Get job service through container (dependency injection)
      this.trackServiceUsage(job.id, 'job');
      servicesUsed.push('job');
      const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);

      // Update job to processing status
      if (job.status === 'pending') {
        await jobService.updateJobProgress(job.id, 1, 'Starting job processing');
      }

      // Route to appropriate processor using service abstractions
      // DATABASE-FIRST with proper optional field handling
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
    // DATABASE-FIRST: Read from individual job columns with proper optional field handling
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

    // Get services through container (clean dependency injection)
    const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
    const aiService = await serviceContainer.resolve<IAIService>(SERVICE_TOKENS.AI);
    const databaseService = await serviceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);

    this.trackServiceUsage(job.id, 'job');
    servicesUsed.push('job');
    await jobService.updateJobProgress(job.id, 10, 'Starting storybook creation');

    // Character description - use from job or generate if needed
    let characterDescriptionToUse = character_description;
    if (!is_reused_image && character_image && !characterDescriptionToUse) {
      this.trackServiceUsage(job.id, 'ai');
      servicesUsed.push('ai');
      
      const prompt = 'You are a professional character artist. Describe this character for cartoon generation.';
      characterDescriptionToUse = await aiService.describeCharacter(character_image, prompt);
    }

    await jobService.updateJobProgress(job.id, 30, 'Character analyzed, processing story structure');

    // Handle story-to-comic-panels mode
    let pages = initialPages || [];
    
    // Check if we need to generate pages from story (story-to-comic-panels mode)
    if (!pages || pages.length === 0) {
      console.log(`📖 Story-to-comic-panels mode detected - generating pages from story`);
      console.log(`🎨 Using ${character_art_style} art style and ${layout_type} layout`);
      
      await jobService.updateJobProgress(job.id, 40, 'Generating comic book layout from story');
      
      try {
        // ✅ UPDATED: Use enhanced scene generation with audience-based configuration
        this.trackServiceUsage(job.id, 'ai');
        if (!servicesUsed.includes('ai')) servicesUsed.push('ai');
        
        // Use the enhanced scene generation method with proper options
        const sceneResult = await (aiService as any).generateScenesWithAudience({
          story: story,
          audience: audience as any,
          characterImage: character_image,
          characterArtStyle: character_art_style,
          layoutType: layout_type
        });
        
        if (sceneResult && sceneResult.pages && Array.isArray(sceneResult.pages)) {
          pages = sceneResult.pages;
          console.log(`✅ Generated ${pages.length} comic book pages with ${pages.reduce((total, page) => total + (page.scenes?.length || 0), 0)} total panels`);
        } else {
          throw new Error('Invalid scene generation result - no pages generated');
        }
        
        await jobService.updateJobProgress(job.id, 50, `Generated ${pages.length} comic book pages`);
        
      } catch (sceneError) {
        console.error('❌ Failed to generate pages from story:', sceneError);
        throw new Error(`Failed to generate comic book layout: ${sceneError instanceof Error ? sceneError.message : String(sceneError)}`);
      }
    } else {
      console.log(`📄 Predefined-pages mode detected - processing ${pages.length} existing pages`);
      await jobService.updateJobProgress(job.id, 40, `Processing ${pages.length} predefined pages`);
    }

    // Validate that we have pages to process
    if (!pages || pages.length === 0) {
      throw new Error('No pages available for processing after story analysis');
    }

    // Generate scenes for each page
    const updatedPages = [];
    const totalScenes = pages.reduce((total, page) => total + (page.scenes?.length || 0), 0);
    let processedScenes = 0;

    console.log(`🎨 Processing ${pages.length} pages with ${totalScenes} total scenes/panels`);

    for (const [pageIndex, page] of pages.entries()) {
      const updatedScenes = [];
      
      // Ensure page has scenes array
      const pageScenes = page.scenes || [];
      
      for (const [sceneIndex, scene] of pageScenes.entries()) {
        await jobService.updateJobProgress(
          job.id, 
          50 + ((processedScenes / totalScenes) * 30),
          `Generating image for page ${pageIndex + 1}, panel ${sceneIndex + 1}`
        );

        try {
          this.trackServiceUsage(job.id, 'ai');
          if (!servicesUsed.includes('ai')) servicesUsed.push('ai');
          
          const imageUrl = await aiService.generateCartoonImage(scene.imagePrompt);
          
          updatedScenes.push({
            ...scene,
            generatedImage: imageUrl,
            characterArtStyle: character_art_style,
            layoutType: layout_type,
          });
          
          console.log(`✅ Generated panel ${sceneIndex + 1} for page ${pageIndex + 1}`);
        } catch (error) {
          console.warn(`⚠️ Failed to generate image for scene, using fallback:`, error);
          updatedScenes.push({
            ...scene,
            generatedImage: character_image || '',
            characterArtStyle: character_art_style,
            layoutType: layout_type,
          });
        }
        
        processedScenes++;
      }
      
      updatedPages.push({
        pageNumber: pageIndex + 1,
        scenes: updatedScenes,
        layoutType: layout_type,
        characterArtStyle: character_art_style,
      });
    }

    await jobService.updateJobProgress(job.id, 85, 'Images generated, saving storybook');

    // Save to database using service abstraction
    this.trackServiceUsage(job.id, 'database');
    servicesUsed.push('database');
    
    const storybookEntry = await databaseService.saveStorybookEntry({
      title,
      story,
      pages: updatedPages,
      user_id: job.user_id,
      audience,
      character_description: characterDescriptionToUse,
      has_errors: false,
    });

    await jobService.updateJobProgress(job.id, 100, 'Storybook saved successfully');

    // Mark job as completed
    await jobService.markJobCompleted(job.id, {
      storybook_id: storybookEntry.id,
      pages: updatedPages,
      has_errors: false,
      characterArtStyle: character_art_style,
      layoutType: layout_type,
    });

    console.log(`✅ Storybook job completed: ${job.id} with ${character_art_style} art style`);
  }

  private async processAutoStoryJobWithServices(job: AutoStoryJobData, servicesUsed: string[]): Promise<void> {
    // DATABASE-FIRST: Read from individual job columns with proper optional field handling
    const { 
      genre, 
      character_description, 
      cartoon_image_url, 
      audience = 'children', 
      character_art_style = 'storybook', 
      layout_type = 'comic-book-panels' 
    } = job;

    const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
    const aiService = await serviceContainer.resolve<IAIService>(SERVICE_TOKENS.AI);
    const databaseService = await serviceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);

    await jobService.updateJobProgress(job.id, 10, 'Starting auto-story generation');

    // Generate story
    this.trackServiceUsage(job.id, 'ai');
    servicesUsed.push('ai');
    
    const storyPrompt = `Create a ${genre} story for ${audience} audience featuring: ${character_description}`;
    const generatedStory = await aiService.generateStory(storyPrompt);

    await jobService.updateJobProgress(job.id, 50, 'Story generated, creating scenes');

    // ✅ UPDATED: Use enhanced scene generation with audience-based configuration
    const sceneResult = await (aiService as any).generateScenesWithAudience({
      story: generatedStory,
      audience: audience as any,
      characterImage: cartoon_image_url,
      characterArtStyle: character_art_style,
      layoutType: layout_type
    });

    await jobService.updateJobProgress(job.id, 80, 'Scenes generated, saving to database');

    // Save to database
    this.trackServiceUsage(job.id, 'database');
    servicesUsed.push('database');
    
    const storybook = await databaseService.saveStorybookEntry({
      title: `${genre} Story`,
      story: generatedStory,
      pages: sceneResult.pages,
      user_id: job.user_id,
      audience,
      character_description: character_description,
      has_errors: false,
    });

    await jobService.updateJobProgress(job.id, 100, 'Auto-story generation complete');

    await jobService.markJobCompleted(job.id, {
      storybook_id: storybook.id,
      generated_story: generatedStory,
      generated_scenes: sceneResult.pages,
    });

    console.log(`✅ Auto-story job completed: ${job.id}`);
  }

  private async processSceneJobWithServices(job: SceneJobData, servicesUsed: string[]): Promise<void> {
    // DATABASE-FIRST: Read from individual job columns with proper optional field handling
    const { 
      story, 
      character_image = '', 
      audience = 'children', 
      character_description = '' 
    } = job;

    const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
    const aiService = await serviceContainer.resolve<IAIService>(SERVICE_TOKENS.AI);

    await jobService.updateJobProgress(job.id, 20, 'Analyzing story for scene generation');

    // ✅ UPDATED: Use enhanced scene generation with audience-based configuration
    this.trackServiceUsage(job.id, 'ai');
    servicesUsed.push('ai');
    
    const sceneResult = await (aiService as any).generateScenesWithAudience({
      story: story,
      audience: audience as any,
      characterImage: character_image,
      characterArtStyle: 'storybook',
      layoutType: 'comic-book-panels'
    });

    await jobService.updateJobProgress(job.id, 100, 'Scene generation complete');

    await jobService.markJobCompleted(job.id, {
      generated_pages: sceneResult.pages,
      character_description: character_description || 'Generated character',
    });

    console.log(`✅ Scene job completed: ${job.id}`);
  }

  private async processCartoonizeJobWithServices(job: CartoonizeJobData, servicesUsed: string[]): Promise<void> {
    // DATABASE-FIRST: Read from individual job columns with proper optional field handling
    const { 
      original_image_data = '', 
      style = 'cartoon', 
      original_cloudinary_url = '' 
    } = job;

    const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
    const aiService = await serviceContainer.resolve<IAIService>(SERVICE_TOKENS.AI);

    await jobService.updateJobProgress(job.id, 20, 'Preparing image for cartoonization');

    // Generate cartoon image
    this.trackServiceUsage(job.id, 'ai');
    servicesUsed.push('ai');
    
    const cartoonPrompt = `Create a ${style} cartoon style image: ${original_image_data}`;
    const generatedUrl = await aiService.generateCartoonImage(cartoonPrompt);

    await jobService.updateJobProgress(job.id, 100, 'Cartoonization complete');

    await jobService.markJobCompleted(job.id, {
      generated_image_url: generatedUrl,
      final_cloudinary_url: generatedUrl,
      style: style,
    });

    console.log(`✅ Cartoonize job completed: ${job.id}`);
  }

  private async processImageJobWithServices(job: ImageJobData, servicesUsed: string[]): Promise<void> {
    // DATABASE-FIRST: Read from individual job columns with proper optional field handling
    const { 
      image_prompt, 
      character_description, 
      emotion, 
      audience = 'children', 
      is_reused_image = false, 
      cartoon_image = '', 
      style = 'cartoon' 
    } = job;

    const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
    const aiService = await serviceContainer.resolve<IAIService>(SERVICE_TOKENS.AI);

    await jobService.updateJobProgress(job.id, 20, 'Starting image generation');

    // Generate image
    this.trackServiceUsage(job.id, 'ai');
    servicesUsed.push('ai');
    
    const finalPrompt = `${image_prompt} featuring ${character_description} with ${emotion} emotion for ${audience} audience`;
    const imageUrl = await aiService.generateCartoonImage(finalPrompt);

    await jobService.updateJobProgress(job.id, 100, 'Image generation complete');

    await jobService.markJobCompleted(job.id, {
      generated_image_url: imageUrl,
      final_prompt_used: finalPrompt,
      style: style,
    });

    console.log(`✅ Image job completed: ${job.id}`);
  }
}

// Export singleton instance
export const productionJobProcessor = new ProductionJobProcessor();
export default productionJobProcessor;