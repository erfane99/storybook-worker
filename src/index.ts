import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import type { JobData, WorkerConfig, JobStats, HealthResponse } from './lib/types.js';
import { environmentManager } from './lib/config/environment.js';
import { ServiceRegistry } from './services/registry/service-registry.js';
import { serviceContainer } from './services/container/service-container.js';
import { SERVICE_TOKENS } from './services/interfaces/service-interfaces.js';

// Environment configuration with graceful degradation
const envConfig = environmentManager.getConfig();
const config: WorkerConfig = envConfig.worker;

// Log configuration status at startup
environmentManager.logConfigurationStatus();

// Health check server
const app = express();

app.get('/health', async (_req, res) => {
  const healthStatus = environmentManager.getHealthStatus();
  const serviceHealth = await ServiceRegistry.getServiceHealth();
  
  const response: HealthResponse = {
    status: serviceHealth.overall === 'healthy' ? 'healthy' : 'unhealthy',
    service: 'storybook-worker',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.environment,
    config: {
      maxConcurrentJobs: config.maxConcurrentJobs,
      scanInterval: config.jobScanInterval,
    },
    features: {
      comicBookSupport: true,
      characterConsistency: true,
      multiPanelLayouts: true,
      variableArtStyles: true,
    }
  };
  
  // Include detailed service status
  res.json({
    ...response,
    services: serviceHealth.services,
    configuration: healthStatus.configuration,
    containerStats: ServiceRegistry.getContainerStats(),
  });
});

app.get('/metrics', async (_req, res) => {
  const healthStatus = environmentManager.getHealthStatus();
  const serviceHealth = await ServiceRegistry.getServiceHealth();
  
  res.json({
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    timestamp: new Date().toISOString(),
    stats,
    services: serviceHealth.services,
    configuration: healthStatus.configuration,
    containerStats: ServiceRegistry.getContainerStats(),
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

// Dynamic import function for job modules with dependency injection
async function loadJobModules() {
  try {
    const jobProcessorModule = await import('./lib/background-jobs/job-processor-with-di.js');
    
    return {
      jobProcessor: jobProcessorModule.dependencyInjectedJobProcessor || jobProcessorModule.default
    };
  } catch (error) {
    console.error('❌ Failed to load job processing modules:', error);
    throw error;
  }
}

// Validate job system with service container
async function validateJobSystem(): Promise<boolean> {
  try {
    const { jobProcessor } = await loadJobModules();
    
    // Basic validation that modules loaded
    if (!jobProcessor) {
      console.error('❌ Job processor not properly loaded');
      return false;
    }

    // Check if job processor can access services through container
    const isProcessorHealthy = await jobProcessor.isHealthy();
    
    if (!isProcessorHealthy) {
      console.warn('⚠️ Job processor not fully healthy (some services may be unavailable)');
    }

    // Worker can start with partial functionality (graceful degradation)
    console.log('✅ Job processing modules loaded with dependency injection');
    if (!isProcessorHealthy) {
      console.warn('⚠️ Worker starting with limited functionality - some services unavailable');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to validate job processing modules:', error);
    return false;
  }
}

// Main worker function with service container
async function processJobs(): Promise<void> {
  try {
    console.log('🔄 Worker: Scanning for pending jobs using service container...');
    
    const { jobProcessor } = await loadJobModules();
    
    // Check if job processor is available
    const isHealthy = await jobProcessor.isHealthy();
    if (!isHealthy) {
      console.warn('⚠️ Worker: Job processor not healthy, skipping job scan');
      return;
    }
    
    // Process jobs using dependency injection
    const processedAny = await jobProcessor.processNextJobStep();
    
    if (!processedAny) {
      console.log('📭 Worker: No pending jobs found or concurrency limit reached');
      return;
    }
    
    // Update statistics from processor
    const processorStats = jobProcessor.getProcessingStats();
    stats.totalProcessed = processorStats.totalProcessed || 0;
    stats.successful = processorStats.successful || 0;
    stats.failed = processorStats.failed || 0;
    stats.lastProcessedAt = processorStats.lastProcessedAt || new Date();
    
    console.log(`📊 Worker: Batch processing complete`);
    console.log(`📈 Total stats: ${stats.successful} successful, ${stats.failed} failed`);
    
  } catch (error: any) {
    console.error('❌ Worker: Critical error during job processing:', error.message);
    stats.failed++;
  }
}

// Initialize worker with service registry
async function initializeWorker(): Promise<void> {
  try {
    console.log('🔧 Initializing job worker with service registry...');
    
    // Register all services with the container
    ServiceRegistry.registerServices();
    
    // Initialize core services
    await ServiceRegistry.initializeCoreServices();
    
    // Validate job processing system
    const isValid = await validateJobSystem();
    if (!isValid) {
      console.warn('⚠️ Worker initialization completed with limited functionality');
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
    console.log(`✅ StoryCanvas Job Worker initialized successfully in ${mode} mode with dependency injection`);
    
  } catch (error: any) {
    console.error('❌ Failed to initialize worker:', error.message);
    console.warn('⚠️ Worker will continue with limited functionality');
  }
}

// Graceful shutdown handling with service cleanup
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  await ServiceRegistry.dispose();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  await ServiceRegistry.dispose();
  process.exit(0);
});

// Handle uncaught errors with graceful degradation
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  console.warn('⚠️ Worker continuing with degraded functionality');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  console.warn('⚠️ Worker continuing with degraded functionality');
});

// Start the worker
initializeWorker().catch(error => {
  console.error('❌ Failed to start worker:', error.message);
  console.warn('⚠️ Worker will attempt to continue with limited functionality');
});