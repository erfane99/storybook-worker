// Main worker entry point - Updated to use ServiceRegistry for lifecycle management
// REFACTORED: Uses ServiceRegistry static methods for all lifecycle operations
import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import type { JobData, WorkerConfig, JobStats, HealthResponse } from './lib/types.js';
import { environmentManager } from './lib/config/environment.js';
import { ServiceRegistry } from './services/registry/service-registry.js';
import { SERVICE_TOKENS } from './services/interfaces/service-contracts.js';
import type { DatabaseService } from './services/database/database-service.js';

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
  
  // Get system validation status using ServiceRegistry
  const validationResult = {
    ready: systemHealth.container.overall === 'healthy',
    warnings: systemHealth.container.overall === 'degraded' ? ['Some services degraded'] : [],
    errors: systemHealth.container.overall === 'unhealthy' ? ['System not fully healthy'] : [],
    lastValidation: systemHealth.timestamp,
  };
  
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
      ready: validationResult.ready,
      warnings: validationResult.warnings,
      errors: validationResult.errors,
      lastValidation: validationResult.lastValidation,
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
    // Use ServiceRegistry for validation instead of StartupValidator
    const systemHealth = await ServiceRegistry.getSystemHealth();
    const serviceHealth = await ServiceRegistry.checkAllServicesHealth();
    
    const result = {
      ready: serviceHealth.overall && systemHealth.container.overall === 'healthy',
      validation: {
        overall: serviceHealth.overall ? 'passed' : 'failed',
        services: serviceHealth.services,
        systemHealth: systemHealth,
        timestamp: new Date().toISOString(),
      },
      warnings: serviceHealth.overall ? [] : ['Some services not fully healthy'],
      errors: systemHealth.container.overall === 'unhealthy' ? ['System unhealthy'] : [],
    };
    
    res.json({
      success: result.ready,
      validation: result.validation,
      ready: result.ready,
      warnings: result.warnings,
      errors: result.errors,
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
/**
 * Mark DB jobs stuck in processing (e.g. after worker crash) as failed via Supabase RPC.
 * Non-critical: failures are logged; worker startup continues.
 */
async function runStaleProcessingJobsCleanupAtStartup(): Promise<void> {
  try {
    const { serviceContainer } = await import('./services/container/service-container.js');
    const db = (await serviceContainer.resolve(
      SERVICE_TOKENS.DATABASE
    )) as DatabaseService;
    let supabase = db.getClient();
    if (!supabase) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseKey) {
        console.warn('⚠️ Stale job cleanup skipped: Supabase client unavailable');
        return;
      }
      supabase = createClient(supabaseUrl, supabaseKey);
    }

    const { data, error } = await supabase.rpc('cleanup_stale_processing_jobs', {
      stale_threshold_minutes: 30,
    });
    if (error) {
      console.warn('⚠️ Stale job cleanup warning:', error.message);
    } else {
      console.log('🧹 Stale job cleanup result:', data);
    }
  } catch (cleanupError) {
    console.warn('⚠️ Stale job cleanup failed (non-critical):', cleanupError);
  }
}

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
  // ✅ FIX: Track initialization state for graceful degradation
  const initializationState = {
    servicesRegistered: false,
    coreServicesInitialized: false,
    jobSystemValidated: false,
    cronScheduled: false,
    criticalFailures: [] as string[],
    warnings: [] as string[]
  };
  
  try {
    console.log('🔧 Initializing job worker with resilient initialization...');
    
    // Step 1: Register services with error handling
    console.log('📝 Registering services...');
    try {
      ServiceRegistry.registerServices();
      initializationState.servicesRegistered = true;
      console.log('✅ Services registered successfully');
    } catch (regError: any) {
      console.error('❌ Service registration failed:', regError.message);
      initializationState.criticalFailures.push(`Service registration: ${regError.message}`);
      // Continue - some services might still work
    }
    
    // Step 2: Initialize core services with partial success handling
    console.log('🔧 Initializing core services...');
    try {
      await ServiceRegistry.initializeCoreServices();
      initializationState.coreServicesInitialized = true;
      console.log('✅ Core services initialized successfully');
    } catch (coreError: any) {
      console.error('⚠️ Core services initialization partially failed:', coreError.message);
      initializationState.warnings.push(`Core services: ${coreError.message}`);
      
      // ✅ NEW: Try to initialize critical services individually
      console.log('🔄 Attempting individual service initialization...');
      
      // Try database service (most critical)
      try {
        const { serviceContainer } = await import('./services/container/service-container.js');
        const databaseService = await serviceContainer.resolve(SERVICE_TOKENS.DATABASE);
        if (databaseService) {
          console.log('✅ Database service recovered');
        }
      } catch (dbError: any) {
        console.error('❌ Database service failed:', dbError.message);
        initializationState.criticalFailures.push(`Database: ${dbError.message}`);
      }
      
      // Try job service
      try {
        const { serviceContainer } = await import('./services/container/service-container.js');
        const jobService = await serviceContainer.resolve(SERVICE_TOKENS.JOB);
        if (jobService) {
          console.log('✅ Job service recovered');
        }
      } catch (jobError: any) {
        console.error('⚠️ Job service failed:', jobError.message);
        initializationState.warnings.push(`Job service: ${jobError.message}`);
      }
    }
    
    // Step 3: Validate job system with graceful degradation
    console.log('🔍 Validating job processing system...');
    try {
      const isValid = await validateJobSystem();
      if (!isValid) {
        console.warn('⚠️ Job processing system validation failed - continuing with limited functionality');
        initializationState.warnings.push('Job system validation failed');
      } else {
        initializationState.jobSystemValidated = true;
        console.log('✅ Job system validated');
      }
    } catch (validationError: any) {
      console.error('⚠️ Job validation error:', validationError.message);
      initializationState.warnings.push(`Validation: ${validationError.message}`);
      // Continue anyway - validation is not critical
    }
    
    // ✅ NEW: Check if we have minimum viable functionality
    const hasDatabase = !initializationState.criticalFailures.some(f => f.includes('Database'));
    const canProcess = initializationState.servicesRegistered || hasDatabase;
    
    if (!canProcess) {
      throw new Error('Cannot proceed: No database connectivity and no services registered');
    }
    
    if (initializationState.criticalFailures.length > 0) {
      console.warn('⚠️ Worker starting with degraded functionality:');
      initializationState.criticalFailures.forEach(f => console.warn(`   - ${f}`));
    }
    
    if (initializationState.warnings.length > 0) {
      console.warn('⚠️ Worker warnings:');
      initializationState.warnings.forEach(w => console.warn(`   - ${w}`));
    }

    // Recover rows left in processing by a previous crashed worker (before first job poll)
    await runStaleProcessingJobsCleanupAtStartup();
    
    // Step 4: Set up job processing with error recovery
    console.log('⏰ Setting up job processing schedule...');
    console.log(`📅 Scan interval: ${config.jobScanInterval}`);
    
    // ✅ NEW: Wrap cron job with error recovery
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 5;
    
    cron.schedule(config.jobScanInterval, async () => {
      try {
        await processJobs();
        consecutiveFailures = 0; // Reset on success
      } catch (error: any) {
        consecutiveFailures++;
        console.error(`❌ Job processing error (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`, error.message);
        
        // Log consecutive failures
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.error(`⚠️ Reached ${MAX_CONSECUTIVE_FAILURES} consecutive failures. Service may need attention.`);
          // Reset counter to continue attempting jobs
          consecutiveFailures = 0;
        }
      }
    });
    
    initializationState.cronScheduled = true;
    
    // Initial job scan after delay with error handling
    setTimeout(async () => {
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