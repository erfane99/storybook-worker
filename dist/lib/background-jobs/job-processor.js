import { jobManager } from './job-manager.js';
import { cartoonizeService } from '../services/cartoonize-service.js';
import { imageService } from '../services/image-service.js';
import { storybookService } from '../services/storybook-service.js';
class BackgroundJobProcessor {
    isProcessing = false;
    maxConcurrentJobs = 3;
    currentlyProcessing = new Set();
    constructor() {
        console.log('🔧 Background job processor initialized');
    }
    async processNextJobStep() {
        if (this.isProcessing || this.currentlyProcessing.size >= this.maxConcurrentJobs) {
            return false;
        }
        this.isProcessing = true;
        let processedAny = false;
        try {
            const pendingJobs = await jobManager.getPendingJobs({}, 10);
            for (const job of pendingJobs) {
                if (this.currentlyProcessing.has(job.id)) {
                    continue;
                }
                if (this.currentlyProcessing.size >= this.maxConcurrentJobs) {
                    break;
                }
                this.currentlyProcessing.add(job.id);
                processedAny = true;
                this.processJobAsync(job).finally(() => {
                    this.currentlyProcessing.delete(job.id);
                });
            }
        }
        catch (error) {
            console.error('❌ Error in processNextJobStep:', error);
        }
        finally {
            this.isProcessing = false;
        }
        return processedAny;
    }
    async processJobAsync(job) {
        try {
            console.log(`🔄 Processing job: ${job.id} (${job.type})`);
            if (job.status === 'pending') {
                await jobManager.updateJobProgress(job.id, 1, 'Starting job processing');
            }
            switch (job.type) {
                case 'storybook':
                    await this.processStorybookJob(job);
                    break;
                case 'auto-story':
                    await this.processAutoStoryJob(job);
                    break;
                case 'scenes':
                    await this.processSceneJob(job);
                    break;
                case 'cartoonize':
                    await this.processCartoonizeJob(job);
                    break;
                case 'image-generation':
                    await this.processImageJob(job);
                    break;
                default:
                    const jobType = job.type;
                    throw new Error(`Unknown job type: ${jobType}`);
            }
        }
        catch (error) {
            console.error(`❌ Job processing failed: ${job.id}`, error);
            await jobManager.markJobFailed(job.id, error.message || 'Job processing failed', true);
        }
    }
    async processStorybookJob(job) {
        const { title, story, characterImage, pages, audience, isReusedImage } = job.input_data;
        try {
            console.log(`📚 Processing storybook job: ${job.id}`);
            await jobManager.updateJobProgress(job.id, 5, 'Starting storybook creation');
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
            if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
                throw new Error('Missing required Supabase environment variables');
            }
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
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
            await jobManager.markJobCompleted(job.id, {
                storybook_id: storybookEntry.id,
                pages: result.pages,
                has_errors: result.has_errors,
                warning: result.warning,
            });
            console.log(`✅ Storybook job completed: ${job.id}`);
        }
        catch (error) {
            console.error(`❌ Storybook job failed: ${job.id}`, error);
            throw error;
        }
    }
    async processAutoStoryJob(job) {
        const { genre, characterDescription, cartoonImageUrl, audience } = job.input_data;
        try {
            console.log(`🤖 Processing auto-story job: ${job.id}`);
            await jobManager.updateJobProgress(job.id, 5, 'Starting auto-story generation');
            const result = await storybookService.createAutoStory({
                genre: genre,
                characterDescription,
                cartoonImageUrl,
                audience,
                userId: job.user_id,
            });
            await jobManager.updateJobProgress(job.id, 75, 'Auto-story generated, saving to database');
            if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
                throw new Error('Missing required Supabase environment variables');
            }
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
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
            await jobManager.markJobCompleted(job.id, {
                storybook_id: storybook.id,
                generated_story: result.story,
            });
            console.log(`✅ Auto-story job completed: ${job.id}`);
        }
        catch (error) {
            console.error(`❌ Auto-story job failed: ${job.id}`, error);
            throw error;
        }
    }
    async processSceneJob(job) {
        const { story, characterImage, audience } = job.input_data;
        try {
            console.log(`🎬 Processing scene job: ${job.id}`);
            await jobManager.updateJobProgress(job.id, 10, 'Starting scene generation');
            const result = await storybookService.generateScenesFromStory({
                story,
                characterImage,
                audience,
            });
            await jobManager.updateJobProgress(job.id, 100, 'Scene generation complete');
            await jobManager.markJobCompleted(job.id, {
                pages: result.pages,
                character_description: result.character_description,
            });
            console.log(`✅ Scene job completed: ${job.id}`);
        }
        catch (error) {
            console.error(`❌ Scene job failed: ${job.id}`, error);
            throw error;
        }
    }
    async processCartoonizeJob(job) {
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
            await jobManager.markJobCompleted(job.id, {
                url: result.url,
                cached: result.cached,
            });
            console.log(`✅ Cartoonize job completed: ${job.id}`);
        }
        catch (error) {
            console.error(`❌ Cartoonize job failed: ${job.id}`, error);
            throw error;
        }
    }
    async processImageJob(job) {
        const { image_prompt, character_description, emotion, audience, isReusedImage, cartoon_image, style } = job.input_data;
        try {
            console.log(`🖼️ Processing image job: ${job.id}`);
            await jobManager.updateJobProgress(job.id, 10, 'Starting image generation');
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
            await jobManager.markJobCompleted(job.id, {
                url: result.url,
                prompt_used: result.prompt_used,
                reused: result.reused,
            });
            console.log(`✅ Image job completed: ${job.id}`);
        }
        catch (error) {
            console.error(`❌ Image job failed: ${job.id}`, error);
            throw error;
        }
    }
    getProcessingStats() {
        return {
            isProcessing: this.isProcessing,
            currentlyProcessing: this.currentlyProcessing.size,
            maxConcurrentJobs: this.maxConcurrentJobs,
            activeJobs: Array.from(this.currentlyProcessing),
        };
    }
    isHealthy() {
        const baseHealth = this.currentlyProcessing.size < this.maxConcurrentJobs;
        const servicesHealth = storybookService.isHealthy();
        let cartoonizeHealth = true;
        try {
            cartoonizeHealth = cartoonizeService.isHealthy ? cartoonizeService.isHealthy() : true;
        }
        catch (error) {
            console.warn('⚠️ Cartoonize service health check failed:', error);
        }
        return baseHealth && servicesHealth && cartoonizeHealth;
    }
}
export const jobProcessor = new BackgroundJobProcessor();
export default jobProcessor;
//# sourceMappingURL=job-processor.js.map