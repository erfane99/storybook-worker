// Job processor implementation using dependency injection and service registry
import { serviceContainer } from '../../services/container/service-container.js';
import { SERVICE_TOKENS, IDatabaseService, IAIService, IJobService } from '../../services/interfaces/service-interfaces.js';
import { JobData, JobType, StorybookJobData, AutoStoryJobData, SceneJobData, CartoonizeJobData, ImageJobData } from '../types.js';

// Enhanced job processing result with service layer context
interface JobProcessingResult {
  success: boolean;
  jobId: string;
  error?: {
    type: 'timeout' | 'ai_service' | 'database' | 'validation' | 'storage' | 'auth' | 'unknown';
    message: string;
    details?: any;
    service?: string;
  };
  duration?: number;
  servicesUsed?: string[];
}

class DependencyInjectedJobProcessor {
  private isProcessing = false;
  private readonly maxConcurrentJobs = 5;
  
  // Use Map for atomic operations and better tracking
  private currentlyProcessing = new Map<string, {
    jobId: string;
    jobType: JobType;
    startTime: number;
    servicesUsed: Set<string>;
  }>();

  // Enhanced processing statistics
  private stats = {
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
    console.log('🔧 Dependency Injected job processor initialized with service registry');
    
    // Periodic cleanup of stale jobs
    setInterval(() => this.cleanupStaleJobs(), 300000); // Every 5 minutes
  }

  /**
   * Atomic job tracking operations
   */
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

    this.stats.concurrentPeak = Math.max(this.stats.concurrentPeak, this.currentlyProcessing.size);
    
    console.log(`📈 Added job ${jobId} to processing queue (${this.currentlyProcessing.size}/${this.maxConcurrentJobs})`);
    return true;
  }

  private removeFromProcessing(jobId: string): void {
    const jobInfo = this.currentlyProcessing.get(jobId);
    if (jobInfo) {
      const duration = Date.now() - jobInfo.startTime;
      
      // Update service usage statistics
      jobInfo.servicesUsed.forEach(service => {
        this.stats.serviceUsageStats.set(service, (this.stats.serviceUsageStats.get(service) || 0) + 1);
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

  /**
   * Cleanup stale jobs
   */
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

  /**
   * Handle job errors with service context
   */
  private handleJobError(jobId: string, error: any, operation: string, serviceName?: string): JobProcessingResult {
    let errorType: JobProcessingResult['error']['type'] = 'unknown';
    let errorMessage = error.message || 'Unknown error occurred';

    // Classify error types based on service and error characteristics
    if (error.type === 'timeout') {
      errorType = 'timeout';
      this.stats.timeouts++;
    } else if (serviceName === 'ai' || error.message?.includes('OpenAI')) {
      errorType = 'ai_service';
    } else if (serviceName === 'database' || error.message?.includes('database') || error.message?.includes('Supabase')) {
      errorType = 'database';
    } else if (serviceName === 'storage' || error.message?.includes('Cloudinary')) {
      errorType = 'storage';
    } else if (serviceName === 'auth' || error.message?.includes('authentication')) {
      errorType = 'auth';
    } else if (error.message?.includes('validation') || error.message?.includes('invalid')) {
      errorType = 'validation';
    }

    // Track error statistics by service
    const errorKey = serviceName ? `${serviceName}_${errorType}` : errorType;
    this.stats.errorsByService.set(errorKey, (this.stats.errorsByService.get(errorKey) || 0) + 1);

    console.error(`❌ Job ${jobId} failed in ${operation} (${errorType}${serviceName ? ` - ${serviceName}` : ''}):`, errorMessage);

    return {
      success: false,
      jobId,
      error: {
        type: errorType,
        message: errorMessage,
        details: error.details || error.stack,
        service: serviceName,
      },
    };
  }

  /**
   * Main processing function using service container
   */
  async processNextJobStep(): Promise<boolean> {
    if (this.isProcessing || this.currentlyProcessing.size >= this.maxConcurrentJobs) {
      return false;
    }

    this.isProcessing = true;
    let processedAny = false;

    try {
      // Get pending jobs using job service from container
      this.trackServiceUsage('batch', 'job');
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
   * Process job with guaranteed cleanup using service container
   */
  private async processJobWithCleanup(job: JobData): Promise<void> {
    const startTime = Date.now();
    let result: JobProcessingResult;

    try {
      result = await this.processJobWithServices(job);
      
      if (result.success) {
        this.stats.successful++;
        console.log(`✅ Job ${job.id} completed successfully in ${Date.now() - startTime}ms using services: ${result.servicesUsed?.join(', ')}`);
      } else {
        this.stats.failed++;
        
        // Determine if job should be retried based on error type and service
        const shouldRetry = result.error?.type !== 'validation' && 
                           result.error?.type !== 'auth' && 
                           result.error?.type !== 'timeout';
        
        this.trackServiceUsage(job.id, 'job');
        const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
        await jobService.markJobFailed(job.id, result.error?.message || 'Unknown error', shouldRetry);
      }
    } catch (error: any) {
      result = this.handleJobError(job.id, error, 'processJobWithCleanup');
      this.stats.failed++;
      
      try {
        this.trackServiceUsage(job.id, 'job');
        const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
        await jobService.markJobFailed(job.id, result.error?.message || 'Unknown error', true);
      } catch (serviceError) {
        console.error(`❌ Failed to mark job as failed: ${job.id}`, serviceError);
      }
    } finally {
      this.removeFromProcessing(job.id);
      this.stats.totalProcessed++;
      this.stats.lastProcessedAt = new Date();
    }
  }

  /**
   * Process job using service container for dependency resolution
   */
  private async processJobWithServices(job: JobData): Promise<JobProcessingResult> {
    const startTime = Date.now();
    const servicesUsed: string[] = [];
    
    try {
      console.log(`🔄 Processing job: ${job.id} (${job.type}) using service container`);

      // Get job service from container
      this.trackServiceUsage(job.id, 'job');
      servicesUsed.push('job');
      const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);

      // Update job to processing status
      if (job.status === 'pending') {
        await jobService.updateJobProgress(job.id, 1, 'Starting job processing');
      }

      // Route to appropriate processor using services from container
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

  /**
   * Process storybook job using services from container
   */
  private async processStorybookJobWithServices(job: StorybookJobData, servicesUsed: string[]): Promise<void> {
    const { title, story, characterImage, pages, audience, isReusedImage } = job.input_data;

    // Get services from container
    const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
    const aiService = await serviceContainer.resolve<IAIService>(SERVICE_TOKENS.AI);
    const databaseService = await serviceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);

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

    // Save to database using database service
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

  /**
   * Process auto-story job using services from container
   */
  private async processAutoStoryJobWithServices(job: AutoStoryJobData, servicesUsed: string[]): Promise<void> {
    const { genre, characterDescription, cartoonImageUrl, audience } = job.input_data;

    // Get services from container
    const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
    const aiService = await serviceContainer.resolve<IAIService>(SERVICE_TOKENS.AI);
    const databaseService = await serviceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);

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

  /**
   * Process scene job using services from container
   */
  private async processSceneJobWithServices(job: SceneJobData, servicesUsed: string[]): Promise<void> {
    const { story, characterImage, audience } = job.input_data;

    const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
    const aiService = await serviceContainer.resolve<IAIService>(SERVICE_TOKENS.AI);

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

  /**
   * Process cartoonize job using services from container
   */
  private async processCartoonizeJobWithServices(job: CartoonizeJobData, servicesUsed: string[]): Promise<void> {
    const { prompt, style, imageUrl } = job.input_data;

    const jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);
    const aiService = await serviceContainer.resolve<IAIService>(SERVICE_TOKENS.AI);

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

  /**
   * Process image generation job using services from container
   */
  private async processImageJobWithServices(job: ImageJobData, servicesUsed: string[]): Promise<void> {
    const { image_prompt, character_description, emotion, audience } = job.input_data;

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
      url: imageUrl,
      prompt_used: finalPrompt,
      reused: false,
    });

    console.log(`✅ Image job completed: ${job.id}`);
  }

  /**
   * Public method for external worker usage
   */
  async processJobAsync(job: JobData): Promise<void> {
    await this.processJobWithCleanup(job);
  }

  /**
   * Get comprehensive processing statistics
   */
  getProcessingStats() {
    const errorStats = Object.fromEntries(this.stats.errorsByService);
    const serviceStats = Object.fromEntries(this.stats.serviceUsageStats);
    
    return {
      isProcessing: this.isProcessing,
      currentlyProcessing: this.currentlyProcessing.size,
      maxConcurrentJobs: this.maxConcurrentJobs,
      activeJobs: Array.from(this.currentlyProcessing.keys()),
      totalProcessed: this.stats.totalProcessed,
      successful: this.stats.successful,
      failed: this.stats.failed,
      timeouts: this.stats.timeouts,
      concurrentPeak: this.stats.concurrentPeak,
      lastProcessedAt: this.stats.lastProcessedAt,
      errorsByService: errorStats,
      serviceUsageStats: serviceStats,
      features: {
        dependencyInjection: true,
        serviceRegistry: true,
        centralizedErrorHandling: true,
        serviceHealthMonitoring: true,
        configurationManagement: true,
        circuitBreakerPattern: true,
        retryWithBackoff: true,
        comprehensiveLogging: true,
      },
    };
  }

  /**
   * Health check with service container awareness
   */
  async isHealthy(): Promise<boolean> {
    const baseHealth = this.currentlyProcessing.size < this.maxConcurrentJobs;
    
    try {
      // Check service container health
      const healthReport = await serviceContainer.getHealth();
      const containerHealthy = healthReport.overall === 'healthy' || healthReport.overall === 'degraded';
      
      // Check failure rates
      const recentFailureRate = this.stats.totalProcessed > 0 
        ? this.stats.failed / this.stats.totalProcessed 
        : 0;
      const healthyFailureRate = recentFailureRate < 0.5;
      
      const timeoutRate = this.stats.totalProcessed > 0 
        ? this.stats.timeouts / this.stats.totalProcessed 
        : 0;
      const healthyTimeoutRate = timeoutRate < 0.2;
      
      const overallHealth = baseHealth && containerHealthy && healthyFailureRate && healthyTimeoutRate;
      
      console.log(`🔧 DI Job Processor Health: Base(${baseHealth}) + Container(${containerHealthy}) + FailureRate(${healthyFailureRate}) + TimeoutRate(${healthyTimeoutRate}) = ${overallHealth}`);
      
      return overallHealth;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const dependencyInjectedJobProcessor = new DependencyInjectedJobProcessor();
export default dependencyInjectedJobProcessor;