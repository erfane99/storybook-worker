// Startup Validation System
// Validates system readiness before accepting requests

import IntegrationValidator, { ValidationConfig, ValidationReport } from './integration-validator.js';
import { enhancedServiceContainer } from '../services/container/enhanced-service-container.js';
import { EnhancedServiceRegistry } from '../services/registry/enhanced-service-registry.js';
import { productionJobProcessor } from '../lib/background-jobs/job-processor.js';
import { environmentManager } from '../lib/config/environment.js';

export interface StartupValidationResult {
  ready: boolean;
  report: ValidationReport;
  warnings: string[];
  errors: string[];
  degradedServices: string[];
  recommendations: string[];
}

export class StartupValidator {
  private static instance: StartupValidator | null = null;
  private validationResult: StartupValidationResult | null = null;
  private isValidating = false;

  private constructor() {}

  static getInstance(): StartupValidator {
    if (!StartupValidator.instance) {
      StartupValidator.instance = new StartupValidator();
    }
    return StartupValidator.instance;
  }

  // ===== MAIN STARTUP VALIDATION =====

  async validateStartup(config?: Partial<ValidationConfig>): Promise<StartupValidationResult> {
    if (this.isValidating) {
      throw new Error('Startup validation already in progress');
    }

    this.isValidating = true;
    console.log('🚀 Starting comprehensive startup validation...');

    try {
      // Phase 1: Environment Check
      const envStatus = this.validateEnvironment();
      
      // Phase 2: Quick Health Check
      await this.quickHealthCheck();
      
      // Phase 3: Integration Validation
      const validationConfig: Partial<ValidationConfig> = {
        enableRollback: true,
        criticalFailureThreshold: 1,
        timeoutMs: 120000, // 2 minutes for startup
        skipNonCritical: false,
        ...config,
      };
      
      const validator = new IntegrationValidator(validationConfig);
      const report = await validator.validateIntegration();
      
      // Phase 4: Analyze Results
      const result = this.analyzeValidationResults(report, envStatus);
      
      this.validationResult = result;
      this.logValidationSummary(result);
      
      return result;
      
    } catch (error: any) {
      console.error('❌ Startup validation failed:', error);
      
      const failedResult: StartupValidationResult = {
        ready: false,
        report: {
          overall: 'failed',
          timestamp: new Date().toISOString(),
          duration: 0,
          results: [],
          summary: { total: 0, passed: 0, failed: 1, critical: 1, warnings: 0 },
          rollbackRequired: true,
          rollbackReason: error.message,
        },
        warnings: [],
        errors: [error.message],
        degradedServices: [],
        recommendations: ['Check system configuration and dependencies'],
      };
      
      this.validationResult = failedResult;
      return failedResult;
      
    } finally {
      this.isValidating = false;
    }
  }

  // ===== ENVIRONMENT VALIDATION =====

  private validateEnvironment(): {
    valid: boolean;
    warnings: string[];
    errors: string[];
    degradedServices: string[];
  } {
    console.log('🔧 Validating environment configuration...');
    
    const envConfig = environmentManager.getConfig();
    const warnings: string[] = [];
    const errors: string[] = [];
    const degradedServices: string[] = [];
    
    // Check service configurations
    Object.entries(envConfig.services).forEach(([serviceName, serviceConfig]) => {
      if (!serviceConfig.isAvailable) {
        if (serviceConfig.status === 'placeholder') {
          warnings.push(`${serviceName} using placeholder configuration`);
          degradedServices.push(serviceName);
        } else {
          errors.push(`${serviceName} not configured: ${serviceConfig.message}`);
          degradedServices.push(serviceName);
        }
      }
    });
    
    // Check worker configuration
    const workerConfig = envConfig.worker;
    if (workerConfig.maxConcurrentJobs < 1) {
      errors.push('Invalid maxConcurrentJobs configuration');
    }
    
    if (workerConfig.port < 1000 || workerConfig.port > 65535) {
      warnings.push('Worker port outside recommended range (1000-65535)');
    }
    
    const valid = errors.length === 0;
    
    console.log(`🔧 Environment validation: ${valid ? 'PASSED' : 'FAILED'}`);
    if (warnings.length > 0) {
      console.warn(`⚠️ Environment warnings: ${warnings.length}`);
    }
    if (errors.length > 0) {
      console.error(`❌ Environment errors: ${errors.length}`);
    }
    
    return { valid, warnings, errors, degradedServices };
  }

  // ===== QUICK HEALTH CHECK =====

  private async quickHealthCheck(): Promise<void> {
    console.log('⚡ Running quick health check...');
    
    try {
      // Check if services are registered
      if (!enhancedServiceContainer.isRegistered('IDatabaseService')) {
        throw new Error('Services not registered - call EnhancedServiceRegistry.registerServices() first');
      }
      
      // Check container health
      const containerHealth = await enhancedServiceContainer.getHealth();
      if (containerHealth.overall === 'unhealthy') {
        throw new Error(`Container unhealthy: ${JSON.stringify(containerHealth.summary)}`);
      }
      
      // Check job processor
      if (!productionJobProcessor.isHealthy()) {
        console.warn('⚠️ Job processor not fully healthy - may have limited functionality');
      }
      
      console.log('⚡ Quick health check passed');
      
    } catch (error: any) {
      console.error('❌ Quick health check failed:', error.message);
      throw error;
    }
  }

  // ===== RESULT ANALYSIS =====

  private analyzeValidationResults(
    report: ValidationReport,
    envStatus: { valid: boolean; warnings: string[]; errors: string[]; degradedServices: string[] }
  ): StartupValidationResult {
    const warnings = [...envStatus.warnings];
    const errors = [...envStatus.errors];
    const degradedServices = [...envStatus.degradedServices];
    const recommendations: string[] = [];
    
    // Analyze validation results
    const failedTests = report.results.filter(r => !r.success);
    const criticalFailures = failedTests.filter(r => 
      r.component === 'service-registry' || 
      r.component === 'job-processor' ||
      (r.component === 'enhanced-services' && r.test.includes('resolution'))
    );
    
    // Add errors from failed tests
    failedTests.forEach(test => {
      if (criticalFailures.includes(test)) {
        errors.push(`Critical: ${test.component}.${test.test} - ${test.error?.message}`);
      } else {
        warnings.push(`${test.component}.${test.test} - ${test.error?.message}`);
      }
    });
    
    // Determine readiness
    const ready = report.overall !== 'failed' && 
                  criticalFailures.length === 0 && 
                  envStatus.valid;
    
    // Generate recommendations
    if (!ready) {
      recommendations.push('System not ready for production use');
      recommendations.push('Review and fix critical errors before proceeding');
    }
    
    if (degradedServices.length > 0) {
      recommendations.push(`Configure missing services: ${degradedServices.join(', ')}`);
    }
    
    if (report.summary.warnings > 0) {
      recommendations.push('Review warnings for potential issues');
    }
    
    if (report.duration > 60000) {
      recommendations.push('Startup validation took longer than expected - check system performance');
    }
    
    return {
      ready,
      report,
      warnings,
      errors,
      degradedServices,
      recommendations,
    };
  }

  // ===== LOGGING =====

  private logValidationSummary(result: StartupValidationResult): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 STARTUP VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    // Overall status
    const statusIcon = result.ready ? '✅' : '❌';
    const statusText = result.ready ? 'READY' : 'NOT READY';
    console.log(`${statusIcon} System Status: ${statusText}`);
    
    // Test results
    const { summary } = result.report;
    console.log(`📋 Tests: ${summary.total} total, ${summary.passed} passed, ${summary.failed} failed`);
    
    if (summary.critical > 0) {
      console.log(`🚨 Critical Failures: ${summary.critical}`);
    }
    
    if (summary.warnings > 0) {
      console.log(`⚠️ Warnings: ${summary.warnings}`);
    }
    
    // Duration
    console.log(`⏱️ Validation Duration: ${result.report.duration}ms`);
    
    // Degraded services
    if (result.degradedServices.length > 0) {
      console.log(`🔧 Degraded Services: ${result.degradedServices.join(', ')}`);
    }
    
    // Errors
    if (result.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      result.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    // Warnings
    if (result.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      result.warnings.forEach(warning => console.log(`   - ${warning}`));
    }
    
    // Recommendations
    if (result.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      result.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }
    
    console.log('='.repeat(60) + '\n');
  }

  // ===== GETTERS =====

  getLastValidationResult(): StartupValidationResult | null {
    return this.validationResult;
  }

  isSystemReady(): boolean {
    return this.validationResult?.ready || false;
  }

  getSystemWarnings(): string[] {
    return this.validationResult?.warnings || [];
  }

  getSystemErrors(): string[] {
    return this.validationResult?.errors || [];
  }

  // ===== CONTINUOUS MONITORING =====

  async startContinuousMonitoring(intervalMs: number = 300000): Promise<void> {
    console.log(`🔄 Starting continuous monitoring (every ${intervalMs / 1000}s)...`);
    
    setInterval(async () => {
      try {
        const quickCheck = await this.performQuickHealthCheck();
        
        if (!quickCheck.healthy) {
          console.warn('⚠️ System health degraded:', quickCheck.issues);
        }
        
      } catch (error: any) {
        console.error('❌ Continuous monitoring error:', error.message);
      }
    }, intervalMs);
  }

  private async performQuickHealthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    try {
      // Check container health
      const containerHealth = await enhancedServiceContainer.getHealth();
      if (containerHealth.overall === 'unhealthy') {
        issues.push('Container unhealthy');
      }
      
      // Check job processor
      if (!productionJobProcessor.isHealthy()) {
        issues.push('Job processor unhealthy');
      }
      
      // Check memory usage
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      if (heapUsedMB > 1000) { // More than 1GB
        issues.push(`High memory usage: ${heapUsedMB.toFixed(2)}MB`);
      }
      
    } catch (error: any) {
      issues.push(`Health check error: ${error.message}`);
    }
    
    return {
      healthy: issues.length === 0,
      issues,
    };
  }
}

export default StartupValidator;