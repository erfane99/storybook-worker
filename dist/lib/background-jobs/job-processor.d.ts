import { JobData, StorybookJobData, AutoStoryJobData, SceneJobData, CartoonizeJobData, ImageJobData } from '../types.js';
declare class BackgroundJobProcessor {
    private isProcessing;
    private maxConcurrentJobs;
    private currentlyProcessing;
    constructor();
    processNextJobStep(): Promise<boolean>;
    processJobAsync(job: JobData): Promise<void>;
    processStorybookJob(job: StorybookJobData): Promise<void>;
    processAutoStoryJob(job: AutoStoryJobData): Promise<void>;
    processSceneJob(job: SceneJobData): Promise<void>;
    processCartoonizeJob(job: CartoonizeJobData): Promise<void>;
    processImageJob(job: ImageJobData): Promise<void>;
    getProcessingStats(): {
        isProcessing: boolean;
        currentlyProcessing: number;
        maxConcurrentJobs: number;
        activeJobs: string[];
    };
    isHealthy(): boolean;
}
export declare const jobProcessor: BackgroundJobProcessor;
export default jobProcessor;
