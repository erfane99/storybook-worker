import { createClient } from '@supabase/supabase-js';
const JOB_TABLE_MAP = {
    'storybook': 'storybook_jobs',
    'auto-story': 'auto_story_jobs',
    'scenes': 'scene_generation_jobs',
    'cartoonize': 'cartoonize_jobs',
    'image-generation': 'image_generation_jobs'
};
class BackgroundJobManager {
    supabase = null;
    initialized = false;
    constructor() {
        this.initializeSupabase();
    }
    initializeSupabase() {
        try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            if (!supabaseUrl || !supabaseKey) {
                console.warn('⚠️ Supabase environment variables not configured for job management');
                return;
            }
            this.supabase = createClient(supabaseUrl, supabaseKey, {
                auth: { persistSession: false }
            });
            this.initialized = true;
            console.log('✅ Background job manager initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize background job manager:', error);
        }
    }
    generateJobId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    getTableName(jobType) {
        return JOB_TABLE_MAP[jobType];
    }
    mapToTableFormat(jobType, jobData) {
        const tableData = {
            id: jobData.id,
            user_id: jobData.user_id,
            status: jobData.status,
            progress: jobData.progress,
            current_step: jobData.current_step,
            error_message: jobData.error_message,
            retry_count: jobData.retry_count,
            max_retries: jobData.max_retries,
            created_at: jobData.created_at,
            updated_at: jobData.updated_at,
            started_at: jobData.started_at,
            completed_at: jobData.completed_at
        };
        if (jobType === 'cartoonize') {
            tableData.original_image_data = jobData.input_data?.prompt || '';
            tableData.style = jobData.input_data?.style || 'cartoon';
            tableData.original_cloudinary_url = jobData.input_data?.imageUrl;
            if (jobData.result_data?.url) {
                tableData.generated_image_url = jobData.result_data.url;
            }
        }
        else if (jobType === 'auto-story') {
            tableData.genre = jobData.input_data?.genre;
            tableData.character_description = jobData.input_data?.characterDescription;
            tableData.cartoon_image_url = jobData.input_data?.cartoonImageUrl;
            tableData.audience = jobData.input_data?.audience;
            if (jobData.result_data?.storybook_id) {
                tableData.storybook_entry_id = jobData.result_data.storybook_id;
            }
        }
        else if (jobType === 'image-generation') {
            tableData.image_prompt = jobData.input_data?.image_prompt;
            tableData.character_description = jobData.input_data?.character_description;
            tableData.emotion = jobData.input_data?.emotion;
            tableData.audience = jobData.input_data?.audience;
            tableData.is_reused_image = jobData.input_data?.isReusedImage;
            tableData.cartoon_image = jobData.input_data?.cartoon_image;
            tableData.style = jobData.input_data?.style;
            if (jobData.result_data?.url) {
                tableData.generated_image_url = jobData.result_data.url;
            }
        }
        else if (jobType === 'storybook') {
            tableData.title = jobData.input_data?.title;
            tableData.story = jobData.input_data?.story;
            tableData.character_image = jobData.input_data?.characterImage;
            tableData.pages = jobData.input_data?.pages;
            tableData.audience = jobData.input_data?.audience;
            tableData.is_reused_image = jobData.input_data?.isReusedImage;
            if (jobData.result_data?.storybook_id) {
                tableData.storybook_entry_id = jobData.result_data.storybook_id;
            }
        }
        else if (jobType === 'scenes') {
            tableData.story = jobData.input_data?.story;
            tableData.character_image = jobData.input_data?.characterImage;
            tableData.audience = jobData.input_data?.audience;
            if (jobData.result_data?.pages) {
                tableData.generated_scenes = jobData.result_data.pages;
            }
        }
        return tableData;
    }
    mapFromTableFormat(jobType, tableData) {
        const baseJob = {
            id: tableData.id?.toString() || this.generateJobId(),
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
            input_data: {},
            result_data: {}
        };
        if (jobType === 'cartoonize') {
            baseJob.input_data = {
                prompt: tableData.original_image_data || '',
                style: tableData.style || 'cartoon',
                imageUrl: tableData.original_cloudinary_url
            };
            if (tableData.generated_image_url) {
                baseJob.result_data = {
                    url: tableData.generated_image_url,
                    cached: !!tableData.final_cloudinary_url
                };
            }
        }
        else if (jobType === 'auto-story') {
            baseJob.input_data = {
                genre: tableData.genre,
                characterDescription: tableData.character_description,
                cartoonImageUrl: tableData.cartoon_image_url,
                audience: tableData.audience
            };
            if (tableData.storybook_entry_id) {
                baseJob.result_data = {
                    storybook_id: tableData.storybook_entry_id,
                    generated_story: tableData.generated_story
                };
            }
        }
        else if (jobType === 'image-generation') {
            baseJob.input_data = {
                image_prompt: tableData.image_prompt,
                character_description: tableData.character_description,
                emotion: tableData.emotion,
                audience: tableData.audience,
                isReusedImage: tableData.is_reused_image,
                cartoon_image: tableData.cartoon_image,
                style: tableData.style
            };
            if (tableData.generated_image_url) {
                baseJob.result_data = {
                    url: tableData.generated_image_url,
                    prompt_used: tableData.final_prompt_used || tableData.image_prompt,
                    reused: tableData.is_reused_image || false
                };
            }
        }
        else if (jobType === 'storybook') {
            baseJob.input_data = {
                title: tableData.title,
                story: tableData.story,
                characterImage: tableData.character_image,
                pages: tableData.pages,
                audience: tableData.audience,
                isReusedImage: tableData.is_reused_image
            };
            if (tableData.storybook_entry_id) {
                baseJob.result_data = {
                    storybook_id: tableData.storybook_entry_id,
                    pages: tableData.pages,
                    has_errors: false
                };
            }
        }
        else if (jobType === 'scenes') {
            baseJob.input_data = {
                story: tableData.story,
                characterImage: tableData.character_image,
                audience: tableData.audience
            };
            if (tableData.generated_scenes) {
                baseJob.result_data = {
                    pages: tableData.generated_scenes,
                    character_description: tableData.character_description
                };
            }
        }
        return baseJob;
    }
    async executeQuery(operation, queryFn) {
        if (!this.initialized || !this.supabase) {
            console.error(`❌ Cannot execute ${operation} - job manager not initialized`);
            return null;
        }
        try {
            const { data, error } = await queryFn(this.supabase);
            if (error) {
                console.error(`❌ ${operation} failed:`, error);
                return null;
            }
            return data;
        }
        catch (error) {
            console.error(`❌ ${operation} error:`, error);
            return null;
        }
    }
    async getPendingJobs(filter = {}, limit = 50) {
        const allPendingJobs = [];
        const jobTypes = ['cartoonize', 'auto-story', 'image-generation', 'storybook', 'scenes'];
        for (const jobType of jobTypes) {
            const tableName = this.getTableName(jobType);
            const result = await this.executeQuery(`Get pending jobs from ${tableName}`, async (supabase) => {
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
            });
            if (result && Array.isArray(result)) {
                const convertedJobs = result.map(job => this.mapFromTableFormat(jobType, job));
                allPendingJobs.push(...convertedJobs);
            }
        }
        allPendingJobs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const finalJobs = allPendingJobs.slice(0, limit);
        console.log(`📋 Retrieved ${finalJobs.length} pending jobs`);
        return finalJobs;
    }
    async getJobStatus(jobId) {
        const jobTypes = ['cartoonize', 'auto-story', 'image-generation', 'storybook', 'scenes'];
        for (const jobType of jobTypes) {
            const tableName = this.getTableName(jobType);
            const result = await this.executeQuery(`Get job status from ${tableName}`, async (supabase) => {
                const response = await supabase
                    .from(tableName)
                    .select('*')
                    .eq('id', jobId)
                    .single();
                return { data: response.data, error: response.error };
            });
            if (result) {
                console.log(`📊 Retrieved job status for: ${jobId} from ${tableName}`);
                return this.mapFromTableFormat(jobType, result);
            }
        }
        console.log(`❌ Job not found: ${jobId}`);
        return null;
    }
    async updateJobProgress(jobId, progress, currentStep) {
        const job = await this.getJobStatus(jobId);
        if (!job) {
            console.error(`❌ Cannot update progress - job not found: ${jobId}`);
            return false;
        }
        const tableName = this.getTableName(job.type);
        const updateData = {
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
        const result = await this.executeQuery('Update job progress', async (supabase) => {
            const response = await supabase
                .from(tableName)
                .update(updateData)
                .eq('id', jobId)
                .select('id')
                .single();
            return { data: response.data, error: response.error };
        });
        if (result?.id) {
            console.log(`📈 Updated job progress: ${jobId} -> ${progress}%`);
            return true;
        }
        return false;
    }
    async markJobCompleted(jobId, resultData) {
        const job = await this.getJobStatus(jobId);
        if (!job) {
            console.error(`❌ Cannot mark completed - job not found: ${jobId}`);
            return false;
        }
        const tableName = this.getTableName(job.type);
        const now = new Date().toISOString();
        const updateData = {
            status: 'completed',
            progress: 100,
            current_step: 'Completed successfully',
            completed_at: now,
            updated_at: now
        };
        if (job.type === 'cartoonize' && resultData?.url) {
            updateData.generated_image_url = resultData.url;
            if (resultData.cached) {
                updateData.final_cloudinary_url = resultData.url;
            }
        }
        else if (job.type === 'auto-story' && resultData?.storybook_id) {
            updateData.storybook_entry_id = resultData.storybook_id;
            updateData.generated_story = resultData.generated_story;
        }
        else if (job.type === 'image-generation' && resultData?.url) {
            updateData.generated_image_url = resultData.url;
            updateData.final_prompt_used = resultData.prompt_used;
        }
        const result = await this.executeQuery('Mark job completed', async (supabase) => {
            const response = await supabase
                .from(tableName)
                .update(updateData)
                .eq('id', jobId)
                .select('id')
                .single();
            return { data: response.data, error: response.error };
        });
        if (result?.id) {
            console.log(`✅ Marked job completed: ${jobId}`);
            return true;
        }
        return false;
    }
    async markJobFailed(jobId, errorMessage, shouldRetry = false) {
        const job = await this.getJobStatus(jobId);
        if (!job) {
            console.error(`❌ Cannot mark failed - job not found: ${jobId}`);
            return false;
        }
        const tableName = this.getTableName(job.type);
        const now = new Date().toISOString();
        const newRetryCount = job.retry_count + 1;
        const canRetry = shouldRetry && newRetryCount <= job.max_retries;
        const updateData = {
            status: canRetry ? 'pending' : 'failed',
            error_message: errorMessage,
            updated_at: now,
            retry_count: newRetryCount
        };
        if (!canRetry) {
            updateData.completed_at = now;
            updateData.current_step = 'Failed after retries';
        }
        else {
            updateData.current_step = `Retrying (${newRetryCount}/${job.max_retries})`;
            updateData.progress = 0;
        }
        const result = await this.executeQuery('Mark job failed', async (supabase) => {
            const response = await supabase
                .from(tableName)
                .update(updateData)
                .eq('id', jobId)
                .select('id')
                .single();
            return { data: response.data, error: response.error };
        });
        if (result?.id) {
            const action = canRetry ? 'scheduled for retry' : 'marked as failed';
            console.log(`❌ Job ${action}: ${jobId} - ${errorMessage}`);
            return true;
        }
        return false;
    }
    isHealthy() {
        return this.initialized && this.supabase !== null;
    }
}
export const jobManager = new BackgroundJobManager();
export default jobManager;
//# sourceMappingURL=job-manager.js.map