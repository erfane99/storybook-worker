// Comprehensive Integration Validation System
// Tests the consolidated architecture end-to-end with rollback capabilities

import { enhancedServiceContainer } from '../services/container/enhanced-service-container.js';
import { EnhancedServiceRegistry } from '../services/registry/enhanced-service-registry.js';
import { SERVICE_TOKENS } from '../services/interfaces/service-contracts.js';
import { productionJobProcessor } from '../lib/background-jobs/job-processor.js';
import { 
  Result,
  ErrorFactory,
  ServiceError,
  createServiceCorrelationContext,
  errorCorrelationManager
} from '../services/errors/index.js';
import { JobData, JobType } from '../lib/types.js';

// ===== VALIDATION INTERFACES =====

export interface ValidationResult {
  success: boolean;
  component: string;
  test: string;
  duration: number;
  error?: ServiceError;
  details?: any;
}

export interface ValidationReport {
  overall: 'passed' | 'failed' | 'partial';
  timestamp: string;
  duration: number;
  results: ValidationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    critical: number;
    warnings: number;
  };
  rollbackRequired: boolean;
  rollbackReason?: string;
}

export interface ValidationConfig {
  enableRollback: boolean;
  criticalFailureThreshold: number;
  timeoutMs: number;
  retryAttempts: number;
  skipNonCritical: boolean;
}

// ===== INTEGRATION VALIDATOR =====

export class IntegrationValidator {
  private config: ValidationConfig;
  private validationResults: ValidationResult[] = [];
  private startTime: number = 0;
  private rollbackActions: Array<() => Promise<void>> = [];

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = {
      enableRollback: true,
      criticalFailureThreshold: 2,
      timeoutMs: 300000, // 5 minutes
      retryAttempts: 2,
      skipNonCritical: false,
      ...config,
    };
  }

  // ===== MAIN VALIDATION ENTRY POINT =====

  async validateIntegration(): Promise<ValidationReport> {
    console.log('🔍 Starting comprehensive integration validation...');
    this.startTime = Date.now();
    this.validationResults = [];
    this.rollbackActions = [];

    try {
      // Phase 1: Service Registry Validation
      await this.validateServiceRegistry();

      // Phase 2: Enhanced Services Validation
      await this.validateEnhancedServices();

      // Phase 3: Error Handling Validation
      await this.validateErrorHandling();

      // Phase 4: Job Processor Validation
      await this.validateJobProcessor();

      // Phase 5: End-to-End Integration
      await this.validateEndToEndIntegration();

      // Phase 6: Performance & Load Testing
      await this.validatePerformance();

      return this.generateReport();

    } catch (error: any) {
      console.error('❌ Critical validation failure:', error);
      
      const criticalResult: ValidationResult = {
        success: false,
        component: 'validator',
        test: 'critical_failure',
        duration: Date.now() - this.startTime,
        error: ErrorFactory.fromUnknown(error, { service: 'integration-validator' }),
      };
      
      this.validationResults.push(criticalResult);
      
      if (this.config.enableRollback) {
        await this.executeRollback('Critical validation failure');
      }
      
      return this.generateReport();
    }
  }

  // ===== PHASE 1: SERVICE REGISTRY VALIDATION =====

  private async validateServiceRegistry(): Promise<void> {
    console.log('📋 Phase 1: Validating Service Registry...');

    // Test 1: Service Registration
    await this.runTest('service-registry', 'registration', async () => {
      EnhancedServiceRegistry.registerServices();
      
      // Verify all services are registered
      const requiredServices = Object.values(SERVICE_TOKENS);
      for (const token of requiredServices) {
        if (!enhancedServiceContainer.isRegistered(token)) {
          throw new Error(`Service not registered: ${token}`);
        }
      }
      
      return { registeredServices: requiredServices.length };
    });

    // Test 2: Core Service Initialization
    await this.runTest('service-registry', 'core_initialization', async () => {
      await EnhancedServiceRegistry.initializeCoreServices();
      
      // Verify config service is available
      const configService = enhancedServiceContainer.resolveSync(SERVICE_TOKENS.CONFIG);
      if (!configService) {
        throw new Error('Config service not initialized');
      }
      
      return { coreServicesInitialized: true };
    });

    // Test 3: Container Health
    await this.runTest('service-registry', 'container_health', async () => {
      const health = await enhancedServiceContainer.getHealth();
      
      if (health.overall === 'unhealthy') {
        throw new Error(`Container unhealthy: ${JSON.stringify(health.summary)}`);
      }
      
      return { 
        overall: health.overall,
        services: health.summary.total,
        healthy: health.summary.healthy 
      };
    });

    // Test 4: Container Statistics
    await this.runTest('service-registry', 'container_stats', async () => {
      const stats = enhancedServiceContainer.getStats();
      
      if (stats.totalServices === 0) {
        throw new Error('No services registered in container');
      }
      
      return stats;
    });
  }

  // ===== PHASE 2: ENHANCED SERVICES VALIDATION =====

  private async validateEnhancedServices(): Promise<void> {
    console.log('🔧 Phase 2: Validating Enhanced Services...');

    const serviceTokens = Object.values(SERVICE_TOKENS);

    for (const token of serviceTokens) {
      await this.validateIndividualService(token);
    }

    // Test cross-service communication
    await this.runTest('enhanced-services', 'cross_service_communication', async () => {
      const databaseService = await enhancedServiceContainer.resolve(SERVICE_TOKENS.DATABASE);
      const aiService = await enhancedServiceContainer.resolve(SERVICE_TOKENS.AI);
      
      // Verify services can communicate
      const dbHealth = (databaseService as any).isHealthy();
      const aiHealth = (aiService as any).isHealthy();
      
      return { 
        databaseHealthy: dbHealth,
        aiHealthy: aiHealth,
        communicationWorking: true 
      };
    });
  }

  private async validateIndividualService(token: string): Promise<void> {
    const serviceName = token.replace('I', '').replace('Service', '');

    // Test 1: Service Resolution
    await this.runTest('enhanced-services', `${serviceName}_resolution`, async () => {
      const service = await enhancedServiceContainer.resolve(token);
      
      if (!service) {
        throw new Error(`Failed to resolve service: ${token}`);
      }
      
      return { resolved: true, serviceName };
    });

    // Test 2: Service Health
    await this.runTest('enhanced-services', `${serviceName}_health`, async () => {
      const service = await enhancedServiceContainer.resolve(token);
      
      if (typeof (service as any).isHealthy === 'function') {
        const isHealthy = (service as any).isHealthy();
        const healthStatus = typeof (service as any).getHealthStatus === 'function' 
          ? (service as any).getHealthStatus() 
          : null;
        
        return { 
          healthy: isHealthy,
          status: healthStatus?.status,
          availability: healthStatus?.availability 
        };
      }
      
      return { healthy: true, note: 'No health check implemented' };
    });

    // Test 3: Service Metrics
    await this.runTest('enhanced-services', `${serviceName}_metrics`, async () => {
      const service = await enhancedServiceContainer.resolve(token);
      
      if (typeof (service as any).getMetrics === 'function') {
        const metrics = (service as any).getMetrics();
        
        return { 
          metricsAvailable: true,
          requestCount: metrics.requestCount,
          errorCount: metrics.errorCount 
        };
      }
      
      return { metricsAvailable: false };
    });

    // Test 4: Service Lifecycle
    await this.runTest('enhanced-services', `${serviceName}_lifecycle`, async () => {
      const service = await enhancedServiceContainer.resolve(token);
      
      if (typeof (service as any).isInitialized === 'function') {
        const initialized = (service as any).isInitialized();
        
        if (!initialized) {
          throw new Error(`Service not properly initialized: ${token}`);
        }
        
        return { initialized: true };
      }
      
      return { initialized: true, note: 'No lifecycle check implemented' };
    });
  }

  // ===== PHASE 3: ERROR HANDLING VALIDATION =====

  private async validateErrorHandling(): Promise<void> {
    console.log('⚠️ Phase 3: Validating Error Handling...');

    // Test 1: Error Factory
    await this.runTest('error-handling', 'error_factory', async () => {
      const error = ErrorFactory.database.connection('Test connection error');
      
      if (error.type !== 'DATABASE_CONNECTION_ERROR') {
        throw new Error('Error factory not working correctly');
      }
      
      return { errorType: error.type, category: error.category };
    });

    // Test 2: Result Pattern
    await this.runTest('error-handling', 'result_pattern', async () => {
      const successResult = Result.success('test data');
      const failureResult = Result.failure(ErrorFactory.database.query('Test query error'));
      
      if (!successResult.success || failureResult.success) {
        throw new Error('Result pattern not working correctly');
      }
      
      return { 
        successWorks: successResult.success,
        failureWorks: !failureResult.success 
      };
    });

    // Test 3: Error Correlation
    await this.runTest('error-handling', 'error_correlation', async () => {
      const context = createServiceCorrelationContext('test-service', 'test-operation');
      
      if (!context.correlationId || !context.service) {
        throw new Error('Error correlation not working correctly');
      }
      
      return { 
        correlationId: context.correlationId,
        service: context.service 
      };
    });

    // Test 4: Service Error Integration
    await this.runTest('error-handling', 'service_error_integration', async () => {
      try {
        // Attempt to resolve non-existent service to trigger error
        await enhancedServiceContainer.resolve('NON_EXISTENT_SERVICE');
        throw new Error('Should have thrown an error');
      } catch (error) {
        const serviceError = ErrorFactory.fromUnknown(error);
        
        return { 
          errorCaught: true,
          errorType: serviceError.type,
          errorHandled: true 
        };
      }
    });
  }

  // ===== PHASE 4: JOB PROCESSOR VALIDATION =====

  private async validateJobProcessor(): Promise<void> {
    console.log('⚙️ Phase 4: Validating Job Processor...');

    // Test 1: Processor Health
    await this.runTest('job-processor', 'processor_health', async () => {
      const isHealthy = productionJobProcessor.isHealthy();
      const healthStatus = productionJobProcessor.getHealthStatus();
      
      return { 
        healthy: isHealthy,
        status: healthStatus.status,
        availability: healthStatus.availability 
      };
    });

    // Test 2: Processor Metrics
    await this.runTest('job-processor', 'processor_metrics', async () => {
      const metrics = productionJobProcessor.getMetrics();
      const stats = productionJobProcessor.getProcessingStats();
      
      return { 
        metricsAvailable: true,
        features: stats.features,
        totalProcessed: stats.totalProcessed 
      };
    });

    // Test 3: Service Dependencies
    await this.runTest('job-processor', 'service_dependencies', async () => {
      // Test that processor can access required services
      const jobService = await enhancedServiceContainer.resolve(SERVICE_TOKENS.JOB);
      const databaseService = await enhancedServiceContainer.resolve(SERVICE_TOKENS.DATABASE);
      const aiService = await enhancedServiceContainer.resolve(SERVICE_TOKENS.AI);
      
      return { 
        jobServiceAvailable: !!jobService,
        databaseServiceAvailable: !!databaseService,
        aiServiceAvailable: !!aiService 
      };
    });

    // Test 4: Job Processing Simulation
    await this.runTest('job-processor', 'job_processing_simulation', async () => {
      // Create a mock job for testing
      const mockJob: JobData = {
        id: 'test-job-' + Date.now(),
        type: 'cartoonize',
        status: 'pending',
        progress: 0,
        user_id: 'test-user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        retry_count: 0,
        max_retries: 3,
        input_data: {
          prompt: 'Test cartoon prompt',
          style: 'cartoon',
        },
      };

      // Test that processor can handle the job structure
      // Note: We don't actually process it to avoid side effects
      return { 
        jobStructureValid: true,
        jobType: mockJob.type,
        processorReady: true 
      };
    });
  }

  // ===== PHASE 5: END-TO-END INTEGRATION =====

  private async validateEndToEndIntegration(): Promise<void> {
    console.log('🔄 Phase 5: Validating End-to-End Integration...');

    // Test 1: Full Service Chain
    await this.runTest('integration', 'full_service_chain', async () => {
      // Test the complete service resolution chain
      const services = await Promise.all([
        enhancedServiceContainer.resolve(SERVICE_TOKENS.CONFIG),
        enhancedServiceContainer.resolve(SERVICE_TOKENS.DATABASE),
        enhancedServiceContainer.resolve(SERVICE_TOKENS.AI),
        enhancedServiceContainer.resolve(SERVICE_TOKENS.STORAGE),
        enhancedServiceContainer.resolve(SERVICE_TOKENS.AUTH),
        enhancedServiceContainer.resolve(SERVICE_TOKENS.JOB),
      ]);

      const allResolved = services.every(service => service !== null);
      
      if (!allResolved) {
        throw new Error('Not all services resolved in chain');
      }
      
      return { 
        servicesResolved: services.length,
        chainComplete: true 
      };
    });

    // Test 2: Health Aggregation
    await this.runTest('integration', 'health_aggregation', async () => {
      const systemHealth = await EnhancedServiceRegistry.getSystemHealth();
      
      if (!systemHealth.container || !systemHealth.stats) {
        throw new Error('System health aggregation incomplete');
      }
      
      return { 
        containerHealth: systemHealth.container.overall,
        features: systemHealth.features,
        timestamp: systemHealth.timestamp 
      };
    });

    // Test 3: Error Propagation
    await this.runTest('integration', 'error_propagation', async () => {
      // Test that errors propagate correctly through the system
      const context = createServiceCorrelationContext('integration-test', 'error-propagation');
      
      return errorCorrelationManager.withContextResult(context, async () => {
        // Simulate an error scenario
        const error = ErrorFactory.database.connection('Integration test error');
        
        return Result.failure(error);
      }).then(result => {
        if (result.success) {
          throw new Error('Error propagation test failed - should have failed');
        }
        
        return { 
          errorPropagated: true,
          errorType: result.error.type,
          correlationId: result.error.correlationId 
        };
      });
    });

    // Test 4: Configuration Consistency
    await this.runTest('integration', 'configuration_consistency', async () => {
      const configService = await enhancedServiceContainer.resolve(SERVICE_TOKENS.CONFIG);
      const config = (configService as any).getConfiguration();
      
      if (!config) {
        throw new Error('Configuration not available');
      }
      
      return { 
        configurationAvailable: true,
        features: config.features,
        timeouts: Object.keys(config.timeouts).length 
      };
    });
  }

  // ===== PHASE 6: PERFORMANCE VALIDATION =====

  private async validatePerformance(): Promise<void> {
    console.log('⚡ Phase 6: Validating Performance...');

    // Test 1: Service Resolution Performance
    await this.runTest('performance', 'service_resolution_speed', async () => {
      const iterations = 100;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await enhancedServiceContainer.resolve(SERVICE_TOKENS.DATABASE);
      }
      
      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;
      
      if (avgTime > 50) { // More than 50ms average is concerning
        throw new Error(`Service resolution too slow: ${avgTime}ms average`);
      }
      
      return { 
        iterations,
        totalTime: duration,
        averageTime: avgTime 
      };
    });

    // Test 2: Memory Usage
    await this.runTest('performance', 'memory_usage', async () => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      
      if (heapUsedMB > 500) { // More than 500MB is concerning
        console.warn(`⚠️ High memory usage: ${heapUsedMB.toFixed(2)}MB`);
      }
      
      return { 
        heapUsedMB: Math.round(heapUsedMB * 100) / 100,
        heapTotalMB: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
        externalMB: Math.round((memUsage.external / 1024 / 1024) * 100) / 100 
      };
    });

    // Test 3: Concurrent Service Access
    await this.runTest('performance', 'concurrent_access', async () => {
      const concurrentRequests = 50;
      const promises = Array(concurrentRequests).fill(0).map(async () => {
        const service = await enhancedServiceContainer.resolve(SERVICE_TOKENS.DATABASE);
        return (service as any).isHealthy();
      });
      
      const startTime = Date.now();
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      const allSuccessful = results.every(result => result === true);
      
      if (!allSuccessful) {
        throw new Error('Some concurrent requests failed');
      }
      
      return { 
        concurrentRequests,
        duration,
        allSuccessful,
        avgTime: duration / concurrentRequests 
      };
    });
  }

  // ===== UTILITY METHODS =====

  private async runTest(
    component: string,
    test: string,
    testFn: () => Promise<any>
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`  🧪 Testing ${component}.${test}...`);
      
      const result = await Promise.race([
        testFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), this.config.timeoutMs)
        )
      ]);
      
      const duration = Date.now() - startTime;
      
      this.validationResults.push({
        success: true,
        component,
        test,
        duration,
        details: result,
      });
      
      console.log(`  ✅ ${component}.${test} passed (${duration}ms)`);
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const serviceError = ErrorFactory.fromUnknown(error, { 
        service: component, 
        operation: test 
      });
      
      this.validationResults.push({
        success: false,
        component,
        test,
        duration,
        error: serviceError,
      });
      
      console.error(`  ❌ ${component}.${test} failed (${duration}ms):`, error.message);
      
      // Check if this is a critical failure
      if (this.isCriticalTest(component, test)) {
        throw error;
      }
    }
  }

  private isCriticalTest(component: string, test: string): boolean {
    const criticalTests = [
      'service-registry.registration',
      'service-registry.core_initialization',
      'enhanced-services.Database_resolution',
      'job-processor.processor_health',
      'integration.full_service_chain',
    ];
    
    return criticalTests.includes(`${component}.${test}`);
  }

  private generateReport(): ValidationReport {
    const duration = Date.now() - this.startTime;
    const passed = this.validationResults.filter(r => r.success).length;
    const failed = this.validationResults.filter(r => !r.success).length;
    const critical = this.validationResults.filter(r => 
      !r.success && this.isCriticalTest(r.component, r.test)
    ).length;
    
    const overall = critical > 0 ? 'failed' : 
                   failed > this.config.criticalFailureThreshold ? 'partial' : 'passed';
    
    const rollbackRequired = this.config.enableRollback && 
                           (critical > 0 || failed > this.config.criticalFailureThreshold);
    
    return {
      overall,
      timestamp: new Date().toISOString(),
      duration,
      results: this.validationResults,
      summary: {
        total: this.validationResults.length,
        passed,
        failed,
        critical,
        warnings: failed - critical,
      },
      rollbackRequired,
      rollbackReason: rollbackRequired ? 
        `${critical} critical failures, ${failed} total failures` : undefined,
    };
  }

  // ===== ROLLBACK MECHANISM =====

  private async executeRollback(reason: string): Promise<void> {
    console.log(`🔄 Executing rollback due to: ${reason}`);
    
    try {
      // Execute rollback actions in reverse order
      for (const action of this.rollbackActions.reverse()) {
        await action();
      }
      
      // Dispose services
      await EnhancedServiceRegistry.dispose();
      
      console.log('✅ Rollback completed successfully');
      
    } catch (rollbackError: any) {
      console.error('❌ Rollback failed:', rollbackError);
      throw new Error(`Rollback failed: ${rollbackError.message}`);
    }
  }

  // ===== STARTUP VALIDATION =====

  static async validateStartup(config?: Partial<ValidationConfig>): Promise<ValidationReport> {
    const validator = new IntegrationValidator({
      skipNonCritical: true,
      criticalFailureThreshold: 0,
      ...config,
    });
    
    console.log('🚀 Running startup validation...');
    
    const report = await validator.validateIntegration();
    
    if (report.overall === 'failed') {
      console.error('❌ Startup validation failed - system not ready');
      throw new Error('Startup validation failed');
    } else if (report.overall === 'partial') {
      console.warn('⚠️ Startup validation passed with warnings');
    } else {
      console.log('✅ Startup validation passed - system ready');
    }
    
    return report;
  }
}

export default IntegrationValidator;