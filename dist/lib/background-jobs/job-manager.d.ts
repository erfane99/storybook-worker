import { JobData, JobFilter } from '../types.js';
declare class BackgroundJobManager {
    private supabase;
    private initialized;
    constructor();
    private initializeSupabase;
    private generateJobId;
    private getTableName;
    private mapToTableFormat;
    private mapFromTableFormat;
    private executeQuery;
    getPendingJobs(filter?: JobFilter, limit?: number): Promise<JobData[]>;
    getJobStatus(jobId: string): Promise<JobData | null>;
    updateJobProgress(jobId: string, progress: number, currentStep?: string): Promise<boolean>;
    markJobCompleted(jobId: string, resultData: any): Promise<boolean>;
    markJobFailed(jobId: string, errorMessage: string, shouldRetry?: boolean): Promise<boolean>;
    isHealthy(): boolean;
}
export declare const jobManager: BackgroundJobManager;
export default jobManager;
