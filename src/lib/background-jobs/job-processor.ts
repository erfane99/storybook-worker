import { jobManager } from './job-manager.js';
import { JobData, JobType, StorybookJobData, AutoStoryJobData, SceneJobData, CartoonizeJobData, ImageJobData } from '../types.js';
import { cartoonizeService } from '../services/cartoonize-service.js';
import { characterService } from '../services/character-service.js';
import { storyService } from '../services/story-service.js';
import { sceneService } from '../services/scene-service.js';
import { imageService } from '../services/image-service.js';
import { storybookService } from '../services/storybook-service.js';

// ENHANCED: Timeout configuration for different service types
interface ServiceTimeouts {
  openai: number;
  database: number;
  imageGeneration: number;
  storyGeneration: number;
  sceneGeneration: number;
  cartoonize: number;
}

// ENHANCED: Job processing result with detailed error information
interface JobProcessingResult {
  success: boolean;
  jobId: string;
  error?: {
    type: 'timeout' | 'ai_service' | 'database' | 'validation' | 'unknown';
    message: string;
    details?: any;
  };
  duration?: number;
}

class BackgroundJobProcessor {
  private isProcessing = false;
  private maxConcurrentJobs = 3;
  
  // FIXED: Use Map for atomic operations and better tracking
  private currentlyProcessing = new Map<string, {
    jobId: string;
    jobType: JobType;
    startTime: number;
    timeoutId?: NodeJS.Timeout;
  }>();

  // ENHANCED: Configurable timeouts for different service types
  private readonly serviceTimeouts: ServiceTimeouts = {
    openai: 120000,        // 2 minutes for OpenAI API calls
    database: 30000,       // 30 seconds for database operations
    imageGeneration: 180000, // 3 minutes for image generation
    storyGeneration: 90000,  // 1.5 minutes for story generation
    sceneGeneration: 120000, // 2 minutes for scene generation
    cartoonize: 150000,    // 2.5 minutes for cartoonization
  };

  // ENHANCED: Processing statistics with error tracking
  private stats = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    timeouts: 0,
    concurrentPeak: 0,
    lastProcessedAt: null as Date | null,
    errorsByType: new Map<string, number>(),
  };

  constructor() {
    console.log('🔧 Background job processor initialized with enhanced concurrency safety');
    
    // ENHANCED: Periodic cleanup of stale job tracking
    setInterval(() => this.cleanupStaleJobs(), 300000); // Every 5 minutes
  }

  /**
   * ENHANCED: Atomic job tracking operations
   */
  private addToProcessing(jobId: string, jobType: JobType): boolean {
    // FIXED: Atomic check and add operation
    if (this.currentlyProcessing.has(jobId)) {
      console.warn(`⚠️ Job ${jobId} already being processed - skipping duplicate`);
      return false;
    }

    if (this.currentlyProcessing.size >= this.maxConcurrentJobs) {
      console.log(`📊 Concurrency limit reached (${this.maxConcurrentJobs}) - skipping job ${jobId}`);
      return false;
    }

    // ENHANCED: Track job with metadata
    this.currentlyProcessing.set(jobId, {
      jobId,
      jobType,
      startTime: Date.now(),
    });

    // Update peak concurrency tracking
    this.stats.concurrentPeak = Math.max(this.stats.concurrentPeak, this.currentlyProcessing.size);
    
    console.log(`📈 Added job ${jobId} to processing queue (${this.currentlyProcessing.size}/${this.maxConcurrentJobs})`);
    return true;
  }

  /**
   * FIXED: Guaranteed cleanup regardless of success/failure
   */
  private removeFromProcessing(jobId: string): void {
    const jobInfo = this.currentlyProcessing.get(jobId);
    if (jobInfo) {
      // Clear any timeout
      if (jobInfo.timeoutId) {
        clearTimeout(jobInfo.timeoutId);
      }
      
      // Calculate processing duration
      const duration = Date.now() - jobInfo.startTime;
      
      // FIXED: Atomic removal
      this.currentlyProcessing.delete(jobId);
      
      console.log(`📉 Removed job ${jobId} from processing queue (duration: ${duration}ms, remaining: ${this.currentlyProcessing.size})`);
    } else {
      console.warn(`⚠️ Attempted to remove job ${jobId} that wasn't in processing queue`);
    }
  }

  /**
   * ENHANCED: Cleanup stale jobs that may have leaked
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
   * ENHANCED: Create timeout wrapper for service calls
   */
  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operation: string,
    jobId: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new Error(`Operation '${operation}' timed out after ${timeoutMs}ms for job ${jobId}`);
        (error as any).type = 'timeout';
        reject(error);
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * ENHANCED: Classify and handle different error types
   */
  private handleJobError(jobId: string, error: any, operation: string): JobProcessingResult {
    let errorType: JobProcessingResult['error']['type'] = 'unknown';
    let errorMessage = error.message || 'Unknown error occurred';

    // ENHANCED: Classify error types for better handling
    if (error.type === 'timeout') {
      errorType = 'timeout';
      this.stats.timeouts++;
    } else if (error.message?.includes('OpenAI') || error.message?.includes('API')) {
      errorType = 'ai_service';
    } else if (error.message?.includes('database') || error.message?.includes('Supabase')) {
      errorType = 'database';
    } else if (error.message?.includes('validation') || error.message?.includes('invalid')) {
      errorType = 'validation';
    }

    // Track error statistics
    const errorKey = `${errorType}_${operation}`;
    this.stats.errorsByType.set(errorKey, (this.stats.errorsByType.get(errorKey) || 0) + 1);

    console.error(`❌ Job ${jobId} failed in ${operation} (${errorType}):`, errorMessage);

    return {
      success: false,
      jobId,
      error: {
        type: errorType,
        message: errorMessage,
        details: error.details || error.stack,
      },
    };
  }

  // Main processing function - processes one step at a time
  async processNextJobStep(): Promise<boolean> {
    if (this.isProcessing || this.currentlyProcessing.size >= this.maxConcurrentJobs) {
      return false;
    }

    this.isProcessing = true;
    let processedAny = false;

    try {
      // Get pending jobs with timeout protection
      const pendingJobs = await this.withTimeout(
        jobManager.getPendingJobs({}, 10),
        this.serviceTimeouts.database,
        'getPendingJobs',
        'batch'
      );
      
      for (const job of pendingJobs) {
        // FIXED: Atomic check and add to processing
        if (!this.addToProcessing(job.id, job.type)) {
          continue; // Skip if already processing or at limit
        }

        processedAny = true;

        // ENHANCED: Process job with guaranteed cleanup
        this.processJobWithCleanup(job);
      }
    } catch (error: any) {
      console.error('❌ Error in processNextJobStep:', error);
      this.handleJobError('batch', error, 'processNextJobStep');
    } finally {
      this.isProcessing = false;
    }

    return processedAny;
  }

  /**
   * ENHANCED: Process job with guaranteed cleanup and timeout protection
   */
  private async processJobWithCleanup(job: JobData): Promise<void> {
    const startTime = Date.now();
    let result: JobProcessingResult;

    try {
      // ENHANCED: Process with timeout protection
      result = await this.processJobWithTimeout(job);
      
      if (result.success) {
        this.stats.successful++;
        console.log(`✅ Job ${job.id} completed successfully in ${Date.now() - startTime}ms`);
      } else {
        this.stats.failed++;
        
        // ENHANCED: Determine if job should be retried based on error type
        const shouldRetry = result.error?.type !== 'validation' && result.error?.type !== 'timeout';
        
        await jobManager.markJobFailed(
          job.id, 
          result.error?.message || 'Job processing failed', 
          shouldRetry
        );
      }
    } catch (error: any) {
      // FIXED: Handle unexpected errors with proper classification
      result = this.handleJobError(job.id, error, 'processJobWithCleanup');
      this.stats.failed++;
      
      await jobManager.markJobFailed(job.id, result.error?.message || 'Unexpected error', true);
    } finally {
      // FIXED: GUARANTEED cleanup regardless of success/failure
      this.removeFromProcessing(job.id);
      this.stats.totalProcessed++;
      this.stats.lastProcessedAt = new Date();
    }
  }

  /**
   * ENHANCED: Process job with comprehensive timeout protection
   */
  private async processJobWithTimeout(job: JobData): Promise<JobProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Processing job: ${job.id} (${job.type}) with timeout protection`);

      // Update job to processing status if still pending
      if (job.status === 'pending') {
        await this.withTimeout(
          jobManager.updateJobProgress(job.id, 1, 'Starting job processing'),
          this.serviceTimeouts.database,
          'updateJobProgress',
          job.id
        );
      }

      // ENHANCED: Route to appropriate processor with timeout protection
      switch (job.type) {
        case 'storybook':
          await this.withTimeout(
            this.processStorybookJob(job as StorybookJobData),
            this.serviceTimeouts.storyGeneration + this.serviceTimeouts.imageGeneration,
            'processStorybookJob',
            job.id
          );
          break;
        case 'auto-story':
          await this.withTimeout(
            this.processAutoStoryJob(job as AutoStoryJobData),
            this.serviceTimeouts.storyGeneration + this.serviceTimeouts.imageGeneration,
            'processAutoStoryJob',
            job.id
          );
          break;
        case 'scenes':
          await this.withTimeout(
            this.processSceneJob(job as SceneJobData),
            this.serviceTimeouts.sceneGeneration,
            'processSceneJob',
            job.id
          );
          break;
        case 'cartoonize':
          await this.withTimeout(
            this.processCartoonizeJob(job as CartoonizeJobData),
            this.serviceTimeouts.cartoonize,
            'processCartoonizeJob',
            job.id
          );
          break;
        case 'image-generation':
          await this.withTimeout(
            this.processImageJob(job as ImageJobData),
            this.serviceTimeouts.imageGeneration,
            'processImageJob',
            job.id
          );
          break;
        default:
          throw new Error(`Unknown job type: ${(job as JobData).type}`);
      }

      return {
        success: true,
        jobId: job.id,
        duration: Date.now() - startTime,
      };

    } catch (error: any) {
      return this.handleJobError(job.id, error, `process${job.type}Job`);
    }
  }

  // Process a single job asynchronously - EXPOSED FOR WORKER
  async processJobAsync(job: JobData): Promise<void> {
    // FIXED: Use the new safe processing method
    await this.processJobWithCleanup(job);
  }

  // ENHANCED: Process storybook generation job with timeout protection
  async processStorybookJob(job: StorybookJobData): Promise<void> {
    const { 
      title, 
      story, 
      characterImage, 
      pages, 
      audience, 
      isReusedImage,
      characterArtStyle = 'storybook',
      layoutType = 'comic-book-panels'
    } = job.input_data;

    try {
      console.log(`📚 Processing comic book storybook job: ${job.id}`);
      console.log(`🎨 Art Style: ${characterArtStyle}, Layout: ${layoutType}`);
      
      await this.withTimeout(
        jobManager.updateJobProgress(job.id, 5, 'Starting comic book storybook creation'),
        this.serviceTimeouts.database,
        'updateJobProgress',
        job.id
      );

      // ENHANCED: Use internal storybook service with timeout protection
      const result = await this.withTimeout(
        storybookService.createStorybook({
          title,
          story,
          characterImage,
          pages,
          audience,
          isReusedImage,
          userId: job.user_id,
          characterArtStyle,
          layoutType,
        }),
        this.serviceTimeouts.storyGeneration + this.serviceTimeouts.imageGeneration,
        'createStorybook',
        job.id
      );

      await this.withTimeout(
        jobManager.updateJobProgress(job.id, 75, 'Comic book storybook generated, saving to database'),
        this.serviceTimeouts.database,
        'updateJobProgress',
        job.id
      );

      // ENHANCED: Save to database with timeout protection
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing required Supabase environment variables');
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: storybookEntry, error: supabaseError } = await this.withTimeout(
        supabase
          .from('storybook_entries')
          .insert({
            title: result.title,
            story: result.story,
            pages: result.pages,
            user_id: job.user_id || null,
            audience: result.audience,
            character_description: result.character_description,
            has_errors: result.has_errors,
            created_at: new Date().toISOString(),
          })
          .select()
          .single(),
        this.serviceTimeouts.database,
        'saveStorybook',
        job.id
      );

      if (supabaseError) {
        const error = new Error(`Database save failed: ${supabaseError.message}`);
        (error as any).type = 'database';
        throw error;
      }

      await this.withTimeout(
        jobManager.updateJobProgress(job.id, 100, 'Comic book storybook saved successfully'),
        this.serviceTimeouts.database,
        'updateJobProgress',
        job.id
      );

      // Mark job as completed
      await this.withTimeout(
        jobManager.markJobCompleted(job.id, {
          storybook_id: storybookEntry.id,
          pages: result.pages,
          has_errors: result.has_errors,
          warning: result.warning,
          character_art_style: characterArtStyle,
          layout_type: layoutType,
        }),
        this.serviceTimeouts.database,
        'markJobCompleted',
        job.id
      );

      console.log(`✅ Comic book storybook job completed: ${job.id} (Style: ${characterArtStyle})`);

    } catch (error: any) {
      console.error(`❌ Comic book storybook job failed: ${job.id}`, error);
      throw error;
    }
  }

  // ENHANCED: Process auto-story generation job with timeout protection
  async processAutoStoryJob(job: AutoStoryJobData): Promise<void> {
    const { 
      genre, 
      characterDescription, 
      cartoonImageUrl, 
      audience,
      characterArtStyle = 'storybook',
      layoutType = 'comic-book-panels'
    } = job.input_data;

    try {
      console.log(`🤖 Processing comic book auto-story job: ${job.id}`);
      console.log(`🎨 Genre: ${genre}, Art Style: ${characterArtStyle}, Layout: ${layoutType}`);
      
      await this.withTimeout(
        jobManager.updateJobProgress(job.id, 5, 'Starting comic book auto-story generation'),
        this.serviceTimeouts.database,
        'updateJobProgress',
        job.id
      );

      // ENHANCED: Use internal storybook service with timeout protection
      const result = await this.withTimeout(
        storybookService.createAutoStory({
          genre: genre as any,
          characterDescription,
          cartoonImageUrl,
          audience,
          userId: job.user_id,
          characterArtStyle,
          layoutType,
        }),
        this.serviceTimeouts.storyGeneration + this.serviceTimeouts.imageGeneration,
        'createAutoStory',
        job.id
      );

      await this.withTimeout(
        jobManager.updateJobProgress(job.id, 75, 'Comic book auto-story generated, saving to database'),
        this.serviceTimeouts.database,
        'updateJobProgress',
        job.id
      );

      // ENHANCED: Save to database with timeout protection
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing required Supabase environment variables');
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: storybook, error: supabaseError } = await this.withTimeout(
        supabase
          .from('storybook_entries')
          .insert({
            title: result.title,
            story: result.story,
            pages: result.pages,
            user_id: job.user_id || null,
            audience: result.audience,
            character_description: result.character_description,
            has_errors: result.has_errors,
            created_at: new Date().toISOString(),
          })
          .select()
          .single(),
        this.serviceTimeouts.database,
        'saveAutoStory',
        job.id
      );

      if (supabaseError) {
        const error = new Error(`Database save failed: ${supabaseError.message}`);
        (error as any).type = 'database';
        throw error;
      }

      await this.withTimeout(
        jobManager.updateJobProgress(job.id, 100, 'Comic book auto-story generation complete'),
        this.serviceTimeouts.database,
        'updateJobProgress',
        job.id
      );

      // Mark job as completed
      await this.withTimeout(
        jobManager.markJobCompleted(job.id, {
          storybook_id: storybook.id,
          generated_story: result.story,
          character_art_style: characterArtStyle,
          layout_type: layoutType,
        }),
        this.serviceTimeouts.database,
        'markJobCompleted',
        job.id
      );

      console.log(`✅ Comic book auto-story job completed: ${job.id} (Style: ${characterArtStyle})`);

    } catch (error: any) {
      console.error(`❌ Comic book auto-story job failed: ${job.id}`, error);
      throw error;
    }
  }

  // ENHANCED: Process scene generation job with timeout protection
  async processSceneJob(job: SceneJobData): Promise<void> {
    const { 
      story, 
      characterImage, 
      audience,
      characterArtStyle = 'storybook',
      layoutType = 'comic-book-panels' 
    } = job.input_data;

    try {
      console.log(`🎬 Processing comic book scene job: ${job.id}`);
      console.log(`🎨 Art Style: ${characterArtStyle}, Layout: ${layoutType}`);
      
      await this.withTimeout(
        jobManager.updateJobProgress(job.id, 10, 'Starting comic book scene generation'),
        this.serviceTimeouts.database,
        'updateJobProgress',
        job.id
      );

      // ENHANCED: Use internal storybook service with timeout protection
      const result = await this.withTimeout(
        storybookService.generateScenesFromStory({
          story,
          characterImage,
          audience,
          characterArtStyle,
          layoutType,
        }),
        this.serviceTimeouts.sceneGeneration,
        'generateScenesFromStory',
        job.id
      );

      await this.withTimeout(
        jobManager.updateJobProgress(job.id, 100, 'Comic book scene generation complete'),
        this.serviceTimeouts.database,
        'updateJobProgress',
        job.id
      );

      // Mark job as completed
      await this.withTimeout(
        jobManager.markJobCompleted(job.id, {
          pages: result.pages,
          character_description: result.character_description,
          character_art_style: characterArtStyle,
          layout_type: layoutType,
        }),
        this.serviceTimeouts.database,
        'markJobCompleted',
        job.id
      );

      console.log(`✅ Comic book scene job completed: ${job.id} (Style: ${characterArtStyle})`);

    } catch (error: any) {
      console.error(`❌ Comic book scene job failed: ${job.id}`, error);
      throw error;
    }
  }

  // ENHANCED: Process image cartoonization job with timeout protection
  async processCartoonizeJob(job: CartoonizeJobData): Promise<void> {
    const { prompt, style, imageUrl } = job.input_data;

    try {
      console.log(`🎨 Processing cartoonize job: ${job.id} (Style: ${style})`);
      
      await this.withTimeout(
        jobManager.updateJobProgress(job.id, 10, 'Preparing image for processing'),
        this.serviceTimeouts.database,
        'updateJobProgress',
        job.id
      );

      await this.withTimeout(
        jobManager.updateJobProgress(job.id, 40, 'Generating cartoon image'),
        this.serviceTimeouts.database,
        'updateJobProgress',
        job.id
      );

      const result = await this.withTimeout(
        cartoonizeService.processCartoonize({
          prompt,
          style,
          imageUrl,
          userId: job.user_id,
        }),
        this.serviceTimeouts.cartoonize,
        'processCartoonize',
        job.id
      );

      await this.withTimeout(
        jobManager.updateJobProgress(job.id, 90, 'Cartoon generation complete'),
        this.serviceTimeouts.database,
        'updateJobProgress',
        job.id
      );

      await this.withTimeout(
        jobManager.updateJobProgress(job.id, 100, 'Cartoonization complete'),
        this.serviceTimeouts.database,
        'updateJobProgress',
        job.id
      );

      // Mark job as completed with style information
      await this.withTimeout(
        jobManager.markJobCompleted(job.id, {
          url: result.url,
          cached: result.cached,
          style: style,
        }),
        this.serviceTimeouts.database,
        'markJobCompleted',
        job.id
      );

      console.log(`✅ Cartoonize job completed: ${job.id} (Style: ${style})`);

    } catch (error: any) {
      console.error(`❌ Cartoonize job failed: ${job.id}`, error);
      throw error;
    }
  }

  // ENHANCED: Process single image generation job with timeout protection
  async processImageJob(job: ImageJobData): Promise<void> {
    const { 
      image_prompt, 
      character_description, 
      emotion, 
      audience, 
      isReusedImage, 
      cartoon_image, 
      style,
      characterArtStyle = 'storybook',
      layoutType = 'individual-scene'
    } = job.input_data;

    try {
      console.log(`🖼️ Processing image job: ${job.id} (Style: ${characterArtStyle})`);
      
      await this.withTimeout(
        jobManager.updateJobProgress(job.id, 10, 'Starting image generation'),
        this.serviceTimeouts.database,
        'updateJobProgress',
        job.id
      );

      // ENHANCED: Use internal image service with timeout protection
      const result = await this.withTimeout(
        imageService.generateSceneImage({
          image_prompt,
          character_description,
          emotion,
          audience,
          isReusedImage,
          cartoon_image,
          user_id: job.user_id,
          style,
          characterArtStyle,
          layoutType,
        }),
        this.serviceTimeouts.imageGeneration,
        'generateSceneImage',
        job.id
      );

      await this.withTimeout(
        jobManager.updateJobProgress(job.id, 100, 'Image generation complete'),
        this.serviceTimeouts.database,
        'updateJobProgress',
        job.id
      );

      // Mark job as completed
      await this.withTimeout(
        jobManager.markJobCompleted(job.id, {
          url: result.url,
          prompt_used: result.prompt_used,
          reused: result.reused,
          character_art_style: characterArtStyle,
          layout_type: layoutType,
        }),
        this.serviceTimeouts.database,
        'markJobCompleted',
        job.id
      );

      console.log(`✅ Image job completed: ${job.id} (Style: ${characterArtStyle})`);

    } catch (error: any) {
      console.error(`❌ Image job failed: ${job.id}`, error);
      throw error;
    }
  }

  // ENHANCED: Get processing statistics with comprehensive metrics
  getProcessingStats() {
    const errorStats = Object.fromEntries(this.stats.errorsByType);
    
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
      errorsByType: errorStats,
      features: {
        comicBookSupport: true,
        characterConsistency: true,
        multiPanelLayouts: true,
        variableArtStyles: true,
        timeoutProtection: true,
        concurrencySafety: true,
        memoryLeakPrevention: true,
      },
      serviceTimeouts: this.serviceTimeouts,
    };
  }

  // ENHANCED: Health check with comprehensive service monitoring
  isHealthy(): boolean {
    const baseHealth = this.currentlyProcessing.size < this.maxConcurrentJobs;
    const servicesHealth = storybookService.isHealthy();
    
    // Check for excessive failures
    const recentFailureRate = this.stats.totalProcessed > 0 
      ? this.stats.failed / this.stats.totalProcessed 
      : 0;
    const healthyFailureRate = recentFailureRate < 0.5; // Less than 50% failure rate
    
    // Check for excessive timeouts
    const timeoutRate = this.stats.totalProcessed > 0 
      ? this.stats.timeouts / this.stats.totalProcessed 
      : 0;
    const healthyTimeoutRate = timeoutRate < 0.2; // Less than 20% timeout rate
    
    let cartoonizeHealth = true;
    try {
      cartoonizeHealth = cartoonizeService.isHealthy ? cartoonizeService.isHealthy() : true;
    } catch (error) {
      console.warn('⚠️ Cartoonize service health check failed:', error);
    }
    
    const overallHealth = baseHealth && servicesHealth && cartoonizeHealth && healthyFailureRate && healthyTimeoutRate;
    
    console.log(`🔧 Job Processor Health: Base(${baseHealth}) + Services(${servicesHealth}) + Cartoonize(${cartoonizeHealth}) + FailureRate(${healthyFailureRate}) + TimeoutRate(${healthyTimeoutRate}) = ${overallHealth}`);
    
    return overallHealth;
  }
}

// Export singleton instance
export const jobProcessor = new BackgroundJobProcessor();
export default jobProcessor;