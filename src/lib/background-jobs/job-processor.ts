import { jobManager } from './job-manager.js';
import { JobData, JobType, StorybookJobData, AutoStoryJobData, SceneJobData, CartoonizeJobData, ImageJobData } from '../types.js';
import { cartoonizeService } from '../services/cartoonize-service.js';
import { characterService } from '../services/character-service.js';
import { storyService } from '../services/story-service.js';
import { sceneService } from '../services/scene-service.js';
import { imageService } from '../services/image-service.js';
import { storybookService } from '../services/storybook-service.js';

class BackgroundJobProcessor {
  private isProcessing = false;
  private maxConcurrentJobs = 3;
  private currentlyProcessing = new Set<string>();

  constructor() {
    console.log('🔧 Background job processor initialized with comic book support');
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

  // ENHANCED: Process storybook generation job with comic book layout support
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
      await jobManager.updateJobProgress(job.id, 5, 'Starting comic book storybook creation');

      // ENHANCED: Use internal storybook service with comic book context
      const result = await storybookService.createStorybook({
        title,
        story,
        characterImage,
        pages,
        audience,
        isReusedImage,
        userId: job.user_id,
        characterArtStyle, // NEW: Pass character art style
        layoutType, // NEW: Pass layout type
      });

      await jobManager.updateJobProgress(job.id, 75, 'Comic book storybook generated, saving to database');

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

      await jobManager.updateJobProgress(job.id, 100, 'Comic book storybook saved successfully');

      // Mark job as completed
      await jobManager.markJobCompleted(job.id, {
        storybook_id: storybookEntry.id,
        pages: result.pages,
        has_errors: result.has_errors,
        warning: result.warning,
        character_art_style: characterArtStyle,
        layout_type: layoutType,
      });

      console.log(`✅ Comic book storybook job completed: ${job.id} (Style: ${characterArtStyle})`);

    } catch (error: any) {
      console.error(`❌ Comic book storybook job failed: ${job.id}`, error);
      throw error;
    }
  }

  // ENHANCED: Process auto-story generation job with comic book layout support
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
      await jobManager.updateJobProgress(job.id, 5, 'Starting comic book auto-story generation');

      // ENHANCED: Use internal storybook service for complete auto-story creation with comic book context
      const result = await storybookService.createAutoStory({
        genre: genre as any, // Type assertion for genre compatibility
        characterDescription,
        cartoonImageUrl,
        audience,
        userId: job.user_id,
        characterArtStyle, // NEW: Pass character art style
        layoutType, // NEW: Pass layout type
      });

      await jobManager.updateJobProgress(job.id, 75, 'Comic book auto-story generated, saving to database');

      // Save to database
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing required Supabase environment variables');
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
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

      await jobManager.updateJobProgress(job.id, 100, 'Comic book auto-story generation complete');

      // Mark job as completed
      await jobManager.markJobCompleted(job.id, {
        storybook_id: storybook.id,
        generated_story: result.story,
        character_art_style: characterArtStyle,
        layout_type: layoutType,
      });

      console.log(`✅ Comic book auto-story job completed: ${job.id} (Style: ${characterArtStyle})`);

    } catch (error: any) {
      console.error(`❌ Comic book auto-story job failed: ${job.id}`, error);
      throw error;
    }
  }

  // Process scene generation job - UPDATED TO USE INTERNAL SERVICES WITH COMIC BOOK SUPPORT
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
      await jobManager.updateJobProgress(job.id, 10, 'Starting comic book scene generation');

      // ENHANCED: Use internal storybook service with comic book context
      const result = await storybookService.generateScenesFromStory({
        story,
        characterImage,
        audience,
        characterArtStyle, // NEW: Pass character art style
        layoutType, // NEW: Pass layout type
      });

      await jobManager.updateJobProgress(job.id, 100, 'Comic book scene generation complete');

      // Mark job as completed
      await jobManager.markJobCompleted(job.id, {
        pages: result.pages,
        character_description: result.character_description,
        character_art_style: characterArtStyle,
        layout_type: layoutType,
      });

      console.log(`✅ Comic book scene job completed: ${job.id} (Style: ${characterArtStyle})`);

    } catch (error: any) {
      console.error(`❌ Comic book scene job failed: ${job.id}`, error);
      throw error;
    }
  }

  // Process image cartoonization job - ALREADY USES INTERNAL SERVICE
  async processCartoonizeJob(job: CartoonizeJobData): Promise<void> {
    const { prompt, style, imageUrl } = job.input_data;

    try {
      console.log(`🎨 Processing cartoonize job: ${job.id} (Style: ${style})`);
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

      // Mark job as completed with style information
      await jobManager.markJobCompleted(job.id, {
        url: result.url,
        cached: result.cached,
        style: style, // Include style in completion data
      });

      console.log(`✅ Cartoonize job completed: ${job.id} (Style: ${style})`);

    } catch (error: any) {
      console.error(`❌ Cartoonize job failed: ${job.id}`, error);
      throw error;
    }
  }

  // ENHANCED: Process single image generation job with comic book panel support
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
      layoutType = 'individual-scene' // Images are usually individual, not panels
    } = job.input_data;

    try {
      console.log(`🖼️ Processing image job: ${job.id} (Style: ${characterArtStyle})`);
      await jobManager.updateJobProgress(job.id, 10, 'Starting image generation');

      // ENHANCED: Use internal image service with comic book context
      const result = await imageService.generateSceneImage({
        image_prompt,
        character_description,
        emotion,
        audience,
        isReusedImage,
        cartoon_image,
        user_id: job.user_id,
        style,
        characterArtStyle, // NEW: Pass character art style
        layoutType, // NEW: Pass layout type (usually individual for single images)
      });

      await jobManager.updateJobProgress(job.id, 100, 'Image generation complete');

      // Mark job as completed
      await jobManager.markJobCompleted(job.id, {
        url: result.url,
        prompt_used: result.prompt_used,
        reused: result.reused,
        character_art_style: characterArtStyle,
        layout_type: layoutType,
      });

      console.log(`✅ Image job completed: ${job.id} (Style: ${characterArtStyle})`);

    } catch (error: any) {
      console.error(`❌ Image job failed: ${job.id}`, error);
      throw error;
    }
  }

  // Get processing statistics with comic book context
  getProcessingStats() {
    return {
      isProcessing: this.isProcessing,
      currentlyProcessing: this.currentlyProcessing.size,
      maxConcurrentJobs: this.maxConcurrentJobs,
      activeJobs: Array.from(this.currentlyProcessing),
      features: {
        comicBookSupport: true,
        characterConsistency: true,
        multiPanelLayouts: true,
        variableArtStyles: true,
      },
    };
  }

  // Health check - includes service health with comic book features
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
    
    console.log(`🔧 Job Processor Health: Base(${baseHealth}) + Services(${servicesHealth}) + Cartoonize(${cartoonizeHealth}) + Comic Book Features(✅)`);
    
    return baseHealth && servicesHealth && cartoonizeHealth;
  }
}

// Export singleton instance
export const jobProcessor = new BackgroundJobProcessor();
export default jobProcessor;