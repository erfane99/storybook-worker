import express from 'express';
import cron from 'node-cron';
const config = {
    port: Number(process.env.PORT) || 3000,
    environment: process.env.NODE_ENV || 'development',
    jobScanInterval: '*/30 * * * * *',
    maxConcurrentJobs: 5,
    initialScanDelay: 10000,
};
const app = express();
app.get('/health', (_req, res) => {
    const response = {
        status: 'healthy',
        service: 'storybook-worker',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: config.environment,
        config: {
            maxConcurrentJobs: config.maxConcurrentJobs,
            scanInterval: config.jobScanInterval,
        }
    };
    res.json(response);
});
app.get('/metrics', (_req, res) => {
    res.json({
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        timestamp: new Date().toISOString(),
        stats,
    });
});
app.listen(config.port, () => {
    console.log(`🏥 Worker health server running on port ${config.port}`);
});
console.log('🚀 StoryCanvas Job Worker Starting...');
console.log(`📊 Environment: ${config.environment}`);
console.log(`⚙️ Config:`, config);
const stats = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    lastProcessedAt: null,
};
async function loadJobModules() {
    try {
        const [jobManagerModule, jobProcessorModule] = await Promise.all([
            import('./lib/background-jobs/job-manager.js'),
            import('./lib/background-jobs/job-processor.js')
        ]);
        return {
            jobManager: jobManagerModule.jobManager || jobManagerModule.default,
            jobProcessor: jobProcessorModule.jobProcessor || jobProcessorModule.default
        };
    }
    catch (error) {
        console.error('❌ Failed to load job processing modules:', error);
        throw error;
    }
}
async function validateJobSystem() {
    try {
        const { jobManager, jobProcessor } = await loadJobModules();
        if (!jobManager || !jobProcessor) {
            console.error('❌ Job modules not properly loaded');
            return false;
        }
        console.log('✅ Job processing modules validated successfully');
        return true;
    }
    catch (error) {
        console.error('❌ Failed to validate job processing modules:', error);
        return false;
    }
}
async function processJobs() {
    try {
        console.log('🔄 Worker: Scanning for pending jobs...');
        const { jobManager, jobProcessor } = await loadJobModules();
        const pendingJobs = await jobManager.getPendingJobs({}, 10);
        if (pendingJobs.length === 0) {
            console.log('📭 Worker: No pending jobs found');
            return;
        }
        console.log(`📋 Worker: Found ${pendingJobs.length} pending jobs`);
        const jobsToProcess = pendingJobs.slice(0, config.maxConcurrentJobs);
        const results = await Promise.allSettled(jobsToProcess.map(async (job) => {
            try {
                console.log(`🔄 Worker: Starting job ${job.id} (${job.type})`);
                await jobProcessor.processJobAsync(job);
                console.log(`✅ Worker: Successfully completed job ${job.id}`);
                stats.successful++;
                return { jobId: job.id, status: 'completed' };
            }
            catch (error) {
                console.error(`❌ Worker: Failed to process job ${job.id}:`, error);
                stats.failed++;
                return { jobId: job.id, status: 'failed', error };
            }
        }));
        stats.totalProcessed += jobsToProcess.length;
        stats.lastProcessedAt = new Date();
        const completed = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`📊 Worker: Batch complete - ${completed} succeeded, ${failed} failed`);
        console.log(`📈 Total stats: ${stats.successful} successful, ${stats.failed} failed`);
    }
    catch (error) {
        console.error('❌ Worker: Critical error during job processing:', error);
        stats.failed++;
    }
}
async function initializeWorker() {
    try {
        console.log('🔧 Initializing job worker...');
        const isValid = await validateJobSystem();
        if (!isValid) {
            console.error('❌ Worker initialization failed - job system validation failed');
            process.exit(1);
        }
        console.log('⏰ Setting up job processing schedule...');
        console.log(`📅 Scan interval: ${config.jobScanInterval}`);
        cron.schedule(config.jobScanInterval, () => {
            processJobs().catch(error => {
                console.error('❌ Unhandled error in job processing:', error);
            });
        });
        setTimeout(() => {
            console.log('🎬 Running initial job scan...');
            processJobs().catch(error => {
                console.error('❌ Error in initial job scan:', error);
            });
        }, config.initialScanDelay);
        console.log('✅ StoryCanvas Job Worker initialized successfully');
    }
    catch (error) {
        console.error('❌ Failed to initialize worker:', error);
        process.exit(1);
    }
}
process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
initializeWorker().catch(error => {
    console.error('❌ Failed to start worker:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map