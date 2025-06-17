import { jobManager } from './job-manager.js';
import { JobData, JobType, StorybookJobData, AutoStoryJobData, SceneJobData, CartoonizeJobData, ImageJobData } from '@/lib/types.js';
import { cartoonizeService } from '@/lib/services/cartoonize-service.js';
import { characterService } from '@/lib/services/character-service.js';
import { storyService } from '@/lib/services/story-service.js';
import { sceneService } from '@/lib/services/scene-service.js';
import { imageService } from '@/lib/services/image-service.js';
import { storybookService } from '@/lib/services/storybook-service.js';

class BackgroundJobProcessor {
  private isProcessing = false;
  private maxConcurrentJobs = 3;
  private currentlyProcessing = new Set<string>();

  constructor() {
    console.log('🔧 Background job processor initialized');
  }

  // Main processing function - processes one step at a time
  async processNextJobStep(): Promise<boolean> {
    if (this.isProcessing || this.currentlyProcessing.size >= this.maxConcurrentJobs) {
      return false;
    }

    this.isProcessing = true;
    let processedAny = false;

    try {
      // Get pending jobs
      const pendingJobs = await jobManager.getPendingJobs({}, 10);
      
      for (const job of pendingJobs) {
        if (this.currentlyProcessing.has(job.id)) {
          continue; // Skip if already processing
        }

        if (this.currentlyProcessing.size >= this.maxConcurrentJobs) {
          break; // Respect concurrency limit
        }

        // Process this job
        this.currentlyProcessing.add(job.id);
        processedAny = true;

        // Process job in background (don't await to allow parallel processing)
        this.processJobAsync(job).finally(() => {
          this.currentlyProcessing.delete(job.id);
        });
      }
    } catch (error) {
      console.error('❌ Error in processNextJobStep:', error);
    } finally {
      this.isProcessing = false;
    }

    return processedAny;
  }

  // Process a single job asynchronously - EXPOSED FOR WORKER
  async processJobAsync(job: JobData): Promise<void> {
    try {
      console.log(`🔄 Processing job: ${job.id} (${job.type})`);

      // Update job to processing status if still pending
      if (job.status === 'pending') {
        await jobManager.updateJobProgress(job.id, 1, 'Starting job processing');
      }

      // Route to appropriate processor with proper type checking
      switch (job.type) {
        case 'storybook':
          await this.processStorybookJob(job as StorybookJobData);
          break;
        case 'auto-story':
          await this.processAutoStoryJob(job as AutoStoryJobData);
          break;
        case 'scenes':
          await this.processSceneJob(job as SceneJobData);
          break;
        case 'cartoonize':
          await this.processCartoonizeJob(job as CartoonizeJobData);
          break;
        case 'image-generation':
          await this.processImageJob(job as ImageJobData);
          break;
        default:
          // Use type assertion to help TypeScript understand this is a valid job type
          const jobType = (job as JobData).type;
          throw new Error(`Unknown job type: ${jobType}`);
      }
    } catch (error: any) {
      console.error(`❌ Job processing failed: ${job.id}`, error);
      await jobManager.markJobFailed(job.id, error.message || 'Job processing failed', true);
    }
  }

  // Process storybook generation job - UPDATED TO USE INTERNAL SERVICES
  async processStorybookJob(job: StorybookJobData): Promise<void> {
    const { title, story, characterImage, pages, audience, isReusedImage } = job.input_data;

    try {
      console.log(`📚 Processing storybook job: ${job.id}`);
      await jobManager.updateJobProgress(job.id, 5, 'Starting storybook creation');

      // Use internal storybook service
      const result = await storybookService.createStorybook({
        title,
        story,
        characterImage,
        pages,
        audience,
        isReusedImage,
        userId: job.user_id,
      });

      await jobManager.updateJobProgress(job.id, 75, 'Storybook generated, saving to database');

      // Save to database
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing required Supabase environment variables');
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: storybookEntry, error: supabaseError } = await supabase
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
        .single();

      if (supabaseError) {
        throw new Error(`Database save failed: ${supabaseError.message}`);
      }

      await jobManager.updateJobProgress(job.id, 100, 'Storybook saved successfully');

      // Mark job as completed
      await jobManager.markJobCompleted(job.id, {
        storybook_id: storybookEntry.id,
        pages: result.pages,
        has_errors: result.has_errors,
        warning: result.warning,
      });

      console.log(`✅ Storybook job completed: ${job.id}`);

    } catch (error: any) {
      console.error(`❌ Storybook job failed: ${job.id}`, error);
      throw error;
    }
  }

  // Process auto-story generation job - UPDATED TO USE INTERNAL SERVICES
  async processAutoStoryJob(job: AutoStoryJobData): Promise<void> {
    const { genre, characterDescription, cartoonImageUrl, audience } = job.input_data;

    try {
      console.log(`🤖 Processing auto-story job: ${job.id}`);
      await jobManager.updateJobProgress(job.id, 5, 'Starting auto-story generation');

      // Use internal storybook service for complete auto-story creation
      const result = await storybookService.createAutoStory({
        genre: genre as any, // Type assertion for genre compatibility
        characterDescription,
        cartoonImageUrl,
        audience,
        userId: job.user_id,
      });

      await jobManager.updateJobProgress(job.id, 75, 'Auto-story generated, saving to database');

      // Save to database
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing required Supabase environment variables');
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: storybook, error: supabaseError } = await supabase
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
        .single();

      if (supabaseError) {
        throw new Error(`Database save failed: ${supabaseError.message}`);
      }

      await jobManager.updateJobProgress(job.id, 100, 'Auto-story generation complete');

      // Mark job as completed
      await jobManager.markJobCompleted(job.id, {
        storybook_id: storybook.id,
        generated_story: result.story,
      });

      console.log(`✅ Auto-story job completed: ${job.id}`);

    } catch (error: any) {
      console.error(`❌ Auto-story job failed: ${job.id}`, error);
      throw error;
    }
  }

  // Process scene generation job - UPDATED TO USE INTERNAL SERVICES
  async processSceneJob(job: SceneJobData): Promise<void> {
    const { story, characterImage, audience } = job.input_data;

    try {
      console.log(`🎬 Processing scene job: ${job.id}`);
      await jobManager.updateJobProgress(job.id, 10, 'Starting scene generation');

      // Use internal storybook service
      const result = await storybookService.generateScenesFromStory({
        story,
        characterImage,
        audience,
      });

      await jobManager.updateJobProgress(job.id, 100, 'Scene generation complete');

      // Mark job as completed
      await jobManager.markJobCompleted(job.id, {
        pages: result.pages,
        character_description: result.character_description,
      });

      console.log(`✅ Scene job completed: ${job.id}`);

    } catch (error: any) {
      console.error(`❌ Scene job failed: ${job.id}`, error);
      throw error;
    }
  }

  // Process image cartoonization job - ALREADY USES INTERNAL SERVICE
  async processCartoonizeJob(job: CartoonizeJobData): Promise<void> {
    const { prompt, style, imageUrl } = job.input_data;

    try {
      console.log(`🎨 Processing cartoonize job: ${job.id}`);
      await jobManager.updateJobProgress(job.id, 10, 'Preparing image for processing');

      await jobManager.updateJobProgress(job.id, 40, 'Generating cartoon image');

      const result = await cartoonizeService.processCartoonize({
        prompt,
        style,
        imageUrl,
        userId: job.user_id,
      });

      await jobManager.updateJobProgress(job.id, 90, 'Cartoon generation complete');
      await jobManager.updateJobProgress(job.id, 100, 'Cartoonization complete');

      // Mark job as completed
      await jobManager.markJobCompleted(job.id, {
        url: result.url,
        cached: result.cached,
      });

      console.log(`✅ Cartoonize job completed: ${job.id}`);

    } catch (error: any) {
      console.error(`❌ Cartoonize job failed: ${job.id}`, error);
      throw error;
    }
  }

  // Process single image generation job - UPDATED TO USE INTERNAL SERVICES
  async processImageJob(job: ImageJobData): Promise<void> {
    const { 
      image_prompt, 
      character_description, 
      emotion, 
      audience, 
      isReusedImage, 
      cartoon_image, 
      style 
    } = job.input_data;

    try {
      console.log(`🖼️ Processing image job: ${job.id}`);
      await jobManager.updateJobProgress(job.id, 10, 'Starting image generation');

      // Use internal image service
      const result = await imageService.generateSceneImage({
        image_prompt,
        character_description,
        emotion,
        audience,
        isReusedImage,
        cartoon_image,
        user_id: job.user_id,
        style,
      });

      await jobManager.updateJobProgress(job.id, 100, 'Image generation complete');

      // Mark job as completed
      await jobManager.markJobCompleted(job.id, {
        url: result.url,
        prompt_used: result.prompt_used,
        reused: result.reused,
      });

      console.log(`✅ Image job completed: ${job.id}`);

    } catch (error: any) {
      console.error(`❌ Image job failed: ${job.id}`, error);
      throw error;
    }
  }

  // Get processing statistics
  getProcessingStats() {
    return {
      isProcessing: this.isProcessing,
      currentlyProcessing: this.currentlyProcessing.size,
      maxConcurrentJobs: this.maxConcurrentJobs,
      activeJobs: Array.from(this.currentlyProcessing),
    };
  }

  // Health check - includes service health
  isHealthy(): boolean {
    const baseHealth = this.currentlyProcessing.size < this.maxConcurrentJobs;
    const servicesHealth = storybookService.isHealthy();
    
    // cartoonizeService might not have isHealthy method yet
    let cartoonizeHealth = true;
    try {
      cartoonizeHealth = cartoonizeService.isHealthy ? cartoonizeService.isHealthy() : true;
    } catch (error) {
      console.warn('⚠️ Cartoonize service health check failed:', error);
    }
    
    return baseHealth && servicesHealth && cartoonizeHealth;
  }
}

// Export singleton instance
export const jobProcessor = new BackgroundJobProcessor();
export default jobProcessor;
