import express from 'express';
import cron from 'node-cron';
import type { JobData, WorkerConfig, JobStats, HealthResponse } from './lib/types.js';

// Environment configuration
const config: WorkerConfig = {
  port: Number(process.env.PORT) || 3000,
  environment: process.env.NODE_ENV || 'development',
  jobScanInterval: '*/30 * * * * *', // Every 30 seconds
  maxConcurrentJobs: 5,
  initialScanDelay: 10000, // 10 seconds
};

// Health check server
const app = express();

app.get('/health', (_req, res) => {
  const response: HealthResponse = {
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

// Start health server
app.listen(config.port, () => {
  console.log(`🏥 Worker health server running on port ${config.port}`);
});

console.log('🚀 StoryCanvas Job Worker Starting...');
console.log(`📊 Environment: ${config.environment}`);
console.log(`⚙️ Config:`, config);

// Job processing statistics
const stats: JobStats = {
  totalProcessed: 0,
  successful: 0,
  failed: 0,
  lastProcessedAt: null,
};

// Dynamic import function for job modules
async function loadJobModules() {
  try {
    const [jobManagerModule, jobProcessorModule] = await Promise.all([
      import('@/lib/background-jobs/job-manager.js'),
      import('@/lib/background-jobs/job-processor.js')
    ]);
    
    return {
      jobManager: jobManagerModule.jobManager || jobManagerModule.default,
      jobProcessor: jobProcessorModule.jobProcessor || jobProcessorModule.default
    };
  } catch (error) {
    console.error('❌ Failed to load job processing modules:', error);
    throw error;
  }
}

// Validate job processor modules
async function validateJobSystem(): Promise<boolean> {
  try {
    const { jobManager, jobProcessor } = await loadJobModules();
    
    // Basic validation that modules loaded
    if (!jobManager || !jobProcessor) {
      console.error('❌ Job modules not properly loaded');
      return false;
    }

    console.log('✅ Job processing modules validated successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to validate job processing modules:', error);
    return false;
  }
}

// Main worker function with proper error handling
async function processJobs(): Promise<void> {
  try {
    console.log('🔄 Worker: Scanning for pending jobs...');
    
    const { jobManager, jobProcessor } = await loadJobModules();
    
    // Get pending jobs
    const pendingJobs = await jobManager.getPendingJobs({}, 10);
    
    if (pendingJobs.length === 0) {
      console.log('📭 Worker: No pending jobs found');
      return;
    }
    
    console.log(`📋 Worker: Found ${pendingJobs.length} pending jobs`);
    
    // Process jobs with concurrency limit
    const jobsToProcess = pendingJobs.slice(0, config.maxConcurrentJobs);
    
    const results = await Promise.allSettled(
      jobsToProcess.map(async (job: JobData) => {
        try {
          console.log(`🔄 Worker: Starting job ${job.id} (${job.type})`);
          
          // Process the job
          await jobProcessor.processJobAsync(job);
          
          console.log(`✅ Worker: Successfully completed job ${job.id}`);
          stats.successful++;
          return { jobId: job.id, status: 'completed' };
        } catch (error) {
          console.error(`❌ Worker: Failed to process job ${job.id}:`, error);
          stats.failed++;
          return { jobId: job.id, status: 'failed', error };
        }
      })
    );
    
    // Update statistics
    stats.totalProcessed += jobsToProcess.length;
    stats.lastProcessedAt = new Date();
    
    // Log summary
    const completed = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`📊 Worker: Batch complete - ${completed} succeeded, ${failed} failed`);
    console.log(`📈 Total stats: ${stats.successful} successful, ${stats.failed} failed`);
    
  } catch (error) {
    console.error('❌ Worker: Critical error during job processing:', error);
    stats.failed++;
  }
}

// Initialize worker with proper startup sequence
async function initializeWorker(): Promise<void> {
  try {
    console.log('🔧 Initializing job worker...');
    
    // Validate job processing system
    const isValid = await validateJobSystem();
    if (!isValid) {
      console.error('❌ Worker initialization failed - job system validation failed');
      process.exit(1);
    }
    
    console.log('⏰ Setting up job processing schedule...');
    console.log(`📅 Scan interval: ${config.jobScanInterval}`);
    
    // Set up continuous job processing
    cron.schedule(config.jobScanInterval, () => {
      processJobs().catch(error => {
        console.error('❌ Unhandled error in job processing:', error);
      });
    });
    
    // Initial job scan after delay
    setTimeout(() => {
      console.log('🎬 Running initial job scan...');
      processJobs().catch(error => {
        console.error('❌ Error in initial job scan:', error);
      });
    }, config.initialScanDelay);
    
    console.log('✅ StoryCanvas Job Worker initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize worker:', error);
    process.exit(1);
  }
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the worker
initializeWorker().catch(error => {
  console.error('❌ Failed to start worker:', error);
  process.exit(1);
});
