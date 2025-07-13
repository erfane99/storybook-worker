// Main worker entry point - Updated to use ServiceRegistry for lifecycle management
// REFACTORED: Uses ServiceRegistry static methods for all lifecycle operations
import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import type { JobData, WorkerConfig, JobStats, HealthResponse } from './lib/types.js';
import { environmentManager } from './lib/config/environment.js';
import { ServiceRegistry } from './services/registry/service-registry.js';
import { SERVICE_TOKENS } from './services/interfaces/service-contracts.js';
import { StartupValidator } from './validation/index.js';
import { workerBootstrap } from './worker/worker-bootstrap.js';

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
  const startupValidator = StartupValidator.getInstance();
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
    const startupValidator = StartupValidator.getInstance();
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
    console.log('🔧 Initializing job worker with enhanced service container architecture...');
    
    // Enhanced worker bootstrap with service preloading
    console.log('🚀 Starting worker bootstrap process...');
    const bootstrapResult = await workerBootstrap.bootstrap();
    
    if (!bootstrapResult.success) {
      console.error('❌ Worker bootstrap failed:');
      bootstrapResult.errors.forEach(error => console.error(`   - ${error}`));
      
      if (bootstrapResult.warnings.length > 0) {
        console.warn('⚠️ Bootstrap warnings:');
        bootstrapResult.warnings.forEach(warning => console.warn(`   - ${warning}`));
      }
      
      throw new Error('Worker bootstrap failed - cannot start job processing');
    }
    
    console.log('✅ Worker bootstrap completed successfully');
    console.log(`📊 Ready services: ${bootstrapResult.readyServices.length}/${bootstrapResult.readyServices.length + bootstrapResult.failedServices.length}`);
    
    if (bootstrapResult.warnings.length > 0) {
      console.warn('⚠️ Bootstrap warnings:');
      bootstrapResult.warnings.forEach(warning => console.warn(`   - ${warning}`));
    }
    
    // Run startup validation
    console.log('🔍 Running startup validation...');
    const startupValidator = StartupValidator.getInstance();
    const validationResult = await startupValidator.validateStartup();
    
    if (!validationResult.ready) {
      console.error('❌ Startup validation failed - system not ready for production');
      console.error('Errors:', validationResult.errors || []);
      
      // Check if rollback is needed using optional chaining
      if (validationResult.report?.rollbackRequired) {
        console.log('🔄 Rollback recommended - disposing services...');
        await ServiceRegistry.disposeServices();
        throw new Error('Startup validation failed - rollback executed');
      }
      
      console.warn('⚠️ Continuing with degraded functionality...');
    } else {
      console.log('✅ Startup validation passed - system ready for production');
    }
    
    // Restore continuous monitoring since the method now exists
    try {
      const stopMonitoring = await startupValidator.startContinuousMonitoring(300000); // Every 5 minutes
      console.log('✅ Continuous monitoring started');
      
      // Store the stop function for graceful shutdown
      process.on('beforeExit', () => {
        if (stopMonitoring) {
          stopMonitoring();
        }
      });
    } catch (monitoringError) {
      console.warn('⚠️ Could not start continuous monitoring:', monitoringError);
      console.log('ℹ️ Continuing without continuous monitoring - relying on periodic health checks');
    }
    
    // Validate job processing system
    const isValid = await validateJobSystem();
    if (!isValid) {
      console.warn('⚠️ Job processing system validation failed - worker may have limited functionality');
      
      // Get detailed service debug info
      const debugInfo = workerBootstrap.getServiceDebugInfo();
      console.log('🔍 Service debug information:');
      Object.entries(debugInfo).forEach(([service, info]) => {
        console.log(`   ${service}:`, info);
      });
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
    console.log(`✅ StoryCanvas Job Worker initialized successfully in ${mode} mode with Enhanced Service Container Architecture`);
    
  } catch (error: any) {
    console.error('❌ Failed to initialize worker:', error.message);
    
    // Get detailed service debug info for troubleshooting
    try {
      const debugInfo = workerBootstrap.getServiceDebugInfo();
      console.log('🔍 Service debug information for troubleshooting:');
      Object.entries(debugInfo).forEach(([service, info]) => {
        console.log(`   ${service}:`, info);
      });
    } catch (debugError) {
      console.warn('⚠️ Could not get service debug info:', debugError);
    }
    
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