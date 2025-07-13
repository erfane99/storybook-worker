// Main worker entry point - Updated to use ServiceRegistry for lifecycle management
// REFACTORED: Uses ServiceRegistry static methods for all lifecycle operations
import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import type { JobData, WorkerConfig, JobStats, HealthResponse } from './lib/types.js';
import { environmentManager } from './lib/config/environment.js';
import { ServiceRegistry } from './services/registry/service-registry.js';
import { SERVICE_TOKENS } from './services/interfaces/service-contracts.js';

// Environment configuration with graceful degradation
const envConfig = environmentManager.getConfig();
const config: WorkerConfig = envConfig.worker;

// Log configuration status at startup
environmentManager.logConfigurationStatus();

// Health check server
const app = express();

app.get('/health', async (_req, res) => {
  // ✅ UPDATED: Use new environment status method
  const environmentStatus = environmentManager.getEnvironmentStatus();
  const serviceHealth = await ServiceRegistry.getServiceHealth();
  const systemHealth = await ServiceRegistry.getSystemHealth();
  
  // Get startup validation status
  const startupValidator = startupValidator.getInstance();
  const validationResult = startupValidator.getLastValidationResult() || null;
  
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
  
  // Include comprehensive health information
  res.json({
    ...response,
    services: serviceHealth.services,
    // ✅ UPDATED: Use new environment status format
    environment: environmentStatus.environment,
    environmentServices: environmentStatus.services,
    containerStats: ServiceRegistry.getContainerStats(),
    systemHealth: systemHealth,
    validation: {
      ready: validationResult?.ready || false,
      warnings: validationResult?.warnings || [],
      errors: validationResult?.errors || [],
      lastValidation: validationResult?.report?.timestamp,
    },
  });
});

app.get('/metrics', async (_req, res) => {
  // ✅ UPDATED: Use new environment status method
  const environmentStatus = environmentManager.getEnvironmentStatus();
  const serviceHealth = await ServiceRegistry.getServiceHealth();
  const systemHealth = await ServiceRegistry.getSystemHealth();
  
  res.json({
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    timestamp: new Date().toISOString(),
    stats,
    services: serviceHealth.services,
    // ✅ UPDATED: Use new environment status format
    environment: environmentStatus.environment,
    environmentServices: environmentStatus.services,
    containerStats: ServiceRegistry.getContainerStats(),
    systemHealth: systemHealth,
  });
});

// Validation endpoint
app.get('/validate', async (_req, res) => {
  try {
    const startupValidator = startupValidator.getInstance();
    const result = await startupValidator.validateStartup();
    
    res.json({
      success: result.ready,
      validation: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Start health server
app.listen(config.port, () => {
  console.log(`🏥 Worker health server running on port ${config.port}`);
  console.log(`📊 Health endpoint: http://localhost:${config.port}/health`);
  console.log(`📈 Metrics endpoint: http://localhost:${config.port}/metrics`);
  console.log(`🔍 Validation endpoint: http://localhost:${config.port}/validate`);
});

console.log('🚀 StoryCanvas Job Worker Starting with Consolidated Architecture...');
console.log(`📊 Environment: ${config.environment}`);
console.log(`⚙️ Config:`, config);

// Job processing statistics
const stats: JobStats = {
  totalProcessed: 0,
  successful: 0,
  failed: 0,
  lastProcessedAt: null,
};

// Dynamic import function for production job processor
async function loadJobProcessor() {
  try {
    const jobProcessorModule = await import('./lib/background-jobs/job-processor.js');
    
    return {
      jobProcessor: jobProcessorModule.productionJobProcessor || jobProcessorModule.default
    };
  } catch (error) {
    console.error('❌ Failed to load production job processor:', error);
    throw error;
  }
}

// Validate job system with consolidated service container
async function validateJobSystem(): Promise<boolean> {
  try {
    const { jobProcessor } = await loadJobProcessor();
    
    // Basic validation that modules loaded
    if (!jobProcessor) {
      console.error('❌ Production job processor not properly loaded');
      return false;
    }

    // Check if job processor can access services through consolidated container
    const isProcessorHealthy = jobProcessor.isHealthy();
    
    if (!isProcessorHealthy) {
      console.warn('⚠️ Production job processor not fully healthy (some services may be unavailable)');
    }

    // Worker can start with partial functionality (graceful degradation)
    console.log('✅ Production job processing system loaded with Consolidated Service Architecture');
    if (!isProcessorHealthy) {
      console.warn('⚠️ Worker starting with limited functionality - some services unavailable');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to validate production job processing system:', error);
    return false;
  }
}

// Main worker function with consolidated service container
async function processJobs(): Promise<void> {
  try {
    console.log('🔄 Worker: Scanning for pending jobs using consolidated service container...');
    
    const { jobProcessor } = await loadJobProcessor();
    
    // Check if job processor is available
    const isHealthy = jobProcessor.isHealthy();
    if (!isHealthy) {
      console.warn('⚠️ Worker: Production job processor not healthy, skipping job scan');
      return;
    }
    
    // Process jobs using production architecture
    const processedAny = await jobProcessor.processNextJobStep();
    
    if (!processedAny) {
      console.log('📭 Worker: No pending jobs found or concurrency limit reached');
      return;
    }
    
    // Update statistics from processor (computed properties, not internal state)
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

// Initialize worker with consolidated service registry and validation
async function initializeWorker(): Promise<void> {
  try {
    console.log('🔧 Initializing job worker...');
    
    // Simple service registration and initialization
    console.log('📝 Registering services...');
    ServiceRegistry.registerServices();
    
    // Initialize core services needed for job processing
    console.log('🔧 Initializing core services...');
    await ServiceRegistry.initializeCoreServices();
    
    // Simple job system validation
    console.log('🔍 Validating job processing system...');
    const isValid = await validateJobSystem();
    if (!isValid) {
      console.warn('⚠️ Job processing system validation failed - continuing with limited functionality');
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
    console.log(`✅ StoryCanvas Job Worker initialized successfully in ${mode} mode`);
    
  } catch (error: any) {
    console.error('❌ Failed to initialize worker:', error.message);
    
    // Attempt graceful shutdown using ServiceRegistry
    try {
      await ServiceRegistry.disposeServices();
    } catch (disposeError) {
      console.error('❌ Failed to dispose services during error handling:', disposeError);
    }
    
    throw error;
  }
}

// Graceful shutdown handling with consolidated service cleanup
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  await ServiceRegistry.disposeServices();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  await ServiceRegistry.disposeServices();
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
  process.exit(1);
});