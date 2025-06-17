import express from 'express';
import cron from 'node-cron';
import { jobManager } from '@/lib/background-jobs/job-manager.js';
import { jobProcessor } from '@/lib/background-jobs/job-processor.js';
import type { JobData } from '@/lib/background-jobs/types.js';

// Environment configuration
interface WorkerConfig {
  port: number;
  environment: string;
  jobScanInterval: string;
  maxConcurrentJobs: number;
  initialScanDelay: number;
}

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
  res.json({ 
    status: 'healthy', 
    service: 'storybook-worker',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.environment,
    config: {
      maxConcurrentJobs: config.maxConcurrentJobs,
      scanInterval: config.jobScanInterval,
    }
  });
});

app.get('/metrics', (_req, res) => {
  res.json({
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    timestamp: new Date().toISOString(),
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
interface JobStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  lastProcessedAt: Date | null;
}

const stats: JobStats = {
  totalProcessed: 0,
  successful: 0,
  failed: 0,
  lastProcessedAt: null,
};

// Validate job processor modules
async function validateJobSystem(): Promise<boolean> {
  try {
    const isHealthy = jobManager.isHealthy() && jobProcessor.isHealthy();
    
    if (!isHealthy) {
      console.error('❌ Job system health check failed');
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
          
          // Use the exposed processJobAsync method
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
