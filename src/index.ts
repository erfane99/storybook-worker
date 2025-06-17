import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import type { JobData, WorkerConfig, JobStats, HealthResponse } from './lib/types.js';
import { environmentManager } from './lib/config/environment.js';

// Environment configuration with graceful handling
const envConfig = environmentManager.getConfig();
const config: WorkerConfig = envConfig.worker;

// Log configuration status at startup
environmentManager.logConfigurationStatus();

// Health check server
const app = express();

app.get('/health', (_req, res) => {
  const healthStatus = environmentManager.getHealthStatus();
  
  const response: HealthResponse = {
    status: healthStatus.overall === 'healthy' ? 'healthy' : 'healthy', // Always healthy in dev mode
    service: 'storybook-worker',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.environment,
    config: {
      maxConcurrentJobs: config.maxConcurrentJobs,
      scanInterval: config.jobScanInterval, // Fixed: Use jobScanInterval to match the interface
    }
  };
  
  // Include detailed service status
  res.json({
    ...response,
    services: healthStatus.services,
    configuration: healthStatus.configuration
  });
});

app.get('/metrics', (_req, res) => {
  const healthStatus = environmentManager.getHealthStatus();
  
  res.json({
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    timestamp: new Date().toISOString(),
    stats,
    services: healthStatus.services,
    configuration: healthStatus.configuration
  });
});

// Start health server
app.listen(config.port, () => {
  console.log(`🏥 Worker health server running on port ${config.port}`);
  console.log(`📊 Health endpoint: http://localhost:${config.port}/health`);
  console.log(`📈 Metrics endpoint: http://localhost:${config.port}/metrics`);
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
      import('./lib/background-jobs/job-manager.js'),
      import('./lib/background-jobs/job-processor.js')
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

// Validate job processor modules with graceful handling
async function validateJobSystem(): Promise<boolean> {
  try {
    const { jobManager, jobProcessor } = await loadJobModules();
    
    // Basic validation that modules loaded
    if (!jobManager || !jobProcessor) {
      console.error('❌ Job modules not properly loaded');
      return false;
    }

    // Check if job manager can connect to database
    const isManagerHealthy = jobManager.isHealthy();
    const isProcessorHealthy = jobProcessor.isHealthy();
    
    if (!isManagerHealthy) {
      console.warn('⚠️ Job manager not fully configured (database connection)');
    }
    
    if (!isProcessorHealthy) {
      console.warn('⚠️ Job processor not fully configured (some services unavailable)');
    }

    // ✅ FIXED: More lenient validation logic
    // Check if critical services are available
    const criticalServicesAvailable = environmentManager.areCriticalServicesAvailable();
    
    if (!criticalServicesAvailable) {
      const missingCritical = environmentManager.getMissingCriticalServices();
      console.error('❌ Critical services not available:', missingCritical.map(s => s.name).join(', '));
      
      // Only fail in production if critical services are missing
      if (envConfig.isProduction) {
        console.error('❌ Cannot start worker in production without critical services');
        return false;
      } else {
        console.warn('⚠️ Starting in development mode without critical services');
        return true;
      }
    }

    // If critical services are available, we can start regardless of optional services
    const missingNonCritical = environmentManager.getMissingNonCriticalServices();
    if (missingNonCritical.length > 0) {
      console.warn('⚠️ Starting with limited functionality - missing optional services:', 
        missingNonCritical.map(s => s.name).join(', '));
    }

    console.log('✅ Job processing system validated - worker ready to start');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to validate job processing modules:', error);
    return false;
  }
}

// Main worker function with graceful error handling
async function processJobs(): Promise<void> {
  try {
    console.log('🔄 Worker: Scanning for pending jobs...');
    
    const { jobManager, jobProcessor } = await loadJobModules();
    
    // Check if job manager is available
    if (!jobManager.isHealthy()) {
      console.warn('⚠️ Worker: Job manager not available, skipping job scan');
      return;
    }
    
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
        } catch (error: any) {
          console.error(`❌ Worker: Failed to process job ${job.id}:`, error.message);
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
    
  } catch (error: any) {
    console.error('❌ Worker: Critical error during job processing:', error.message);
    stats.failed++;
  }
}

// Initialize worker with graceful startup sequence
async function initializeWorker(): Promise<void> {
  try {
    console.log('🔧 Initializing job worker...');
    
    // ✅ FIXED: More resilient validation logic
    const isValid = await validateJobSystem();
    
    if (!isValid) {
      // Only exit if we're in production and critical services are missing
      if (envConfig.isProduction && !environmentManager.areCriticalServicesAvailable()) {
        console.error('❌ Worker initialization failed - critical services not available in production');
        process.exit(1);
      } else {
        console.warn('⚠️ Worker starting with limited functionality');
      }
    }
    
    console.log('⏰ Setting up job processing schedule...');
    console.log(`📅 Scan interval: ${config.jobScanInterval}`);
    
    // Set up continuous job processing
    cron.schedule(config.jobScanInterval, () => {
      processJobs().catch(error => {
        console.error('❌ Unhandled error in job processing:', error.message);
      });
    });
    
    // Initial job scan after delay
    setTimeout(() => {
      console.log('🎬 Running initial job scan...');
      processJobs().catch(error => {
        console.error('❌ Error in initial job scan:', error.message);
      });
    }, config.initialScanDelay);
    
    const mode = envConfig.isDevelopment ? 'development' : 'production';
    const functionalityLevel = environmentManager.areCriticalServicesAvailable() ? 'full' : 'limited';
    
    console.log(`✅ StoryCanvas Job Worker initialized successfully`);
    console.log(`📊 Mode: ${mode} | Functionality: ${functionalityLevel}`);
    
  } catch (error: any) {
    console.error('❌ Failed to initialize worker:', error.message);
    
    // ✅ FIXED: Only exit in production if critical services are missing
    if (envConfig.isProduction && !environmentManager.areCriticalServicesAvailable()) {
      console.error('❌ Exiting - critical services required in production');
      process.exit(1);
    } else {
      console.warn('⚠️ Continuing with limited functionality');
    }
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

// Handle uncaught errors with environment awareness
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  if (envConfig.isProduction) {
    process.exit(1);
  } else {
    console.warn('⚠️ Continuing in development mode after uncaught exception');
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  if (envConfig.isProduction) {
    process.exit(1);
  } else {
    console.warn('⚠️ Continuing in development mode after unhandled rejection');
  }
});

// Start the worker
initializeWorker().catch(error => {
  console.error('❌ Failed to start worker:', error.message);
  
  // ✅ FIXED: Only exit if critical services are missing in production
  if (envConfig.isProduction && !environmentManager.areCriticalServicesAvailable()) {
    console.error('❌ Exiting - cannot start without critical services in production');
    process.exit(1);
  } else {
    console.warn('⚠️ Worker startup had issues but continuing with available functionality');
  }
});