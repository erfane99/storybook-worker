// Startup Validation System
// CONSOLIDATED: Updated to use consolidated service container

import { IntegrationValidator, ValidationConfig, ValidationReport } from './integration-validator.js';

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
      const envStatus = await this.validateEnvironment();
      
      // Phase 2: Quick Health Check
      await this.quickHealthCheck();
      
      // Phase 3: Integration Validation
      const validationConfig: Partial<ValidationConfig> = {
        enableRollback: false, // Don't rollback during startup validation
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
          rollbackRequired: false,
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

  private async validateEnvironment(): Promise<{
    valid: boolean;
    warnings: string[];
    errors: string[];
    degradedServices: string[];
  }> {
    console.log('🔧 Validating environment configuration...');
    
    const warnings: string[] = [];
    const errors: string[] = [];
    const degradedServices: string[] = [];
    
    try {
      // Check Node.js version
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      if (majorVersion < 18) {
        warnings.push(`Node.js version ${nodeVersion} is below recommended v18+`);
      }

      // Check environment variables
      const requiredEnvVars = ['NODE_ENV'];
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        warnings.push(`Missing environment variables: ${missingVars.join(', ')}`);
      }

      // Check memory
      const memUsage = process.memoryUsage();
      const availableMemoryMB = memUsage.heapTotal / 1024 / 1024;
      if (availableMemoryMB < 512) {
        warnings.push(`Low available memory: ${availableMemoryMB.toFixed(2)}MB`);
      }

      // Check if running in development mode
      if (process.env.NODE_ENV === 'development') {
        warnings.push('Running in development mode');
      }

      // Validate port availability (if configured)
      const port = parseInt(process.env.PORT || '3000');
      if (port < 1000 || port > 65535) {
        warnings.push('Port outside recommended range (1000-65535)');
      }

    } catch (error: any) {
      errors.push(`Environment validation error: ${error.message}`);
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
      // Check if we can import services
      try {
        // CONSOLIDATED: Import from consolidated services
        const { serviceContainer } = await import('../services/index.js');
        
        // Quick container health check
        const containerHealth = await serviceContainer.getHealth();
        if (!containerHealth) {
          throw new Error('Container health check returned no data');
        }
        
        if (containerHealth.overall === 'unhealthy') {
          console.warn(`⚠️ Container health: ${containerHealth.overall}`);
        }
        
      } catch (importError: any) {
        throw new Error(`Could not import services: ${importError.message}`);
      }

      // Check basic process health
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      
      if (heapUsedMB > 1000) { // More than 1GB
        console.warn(`⚠️ High memory usage during startup: ${heapUsedMB.toFixed(2)}MB`);
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
      r.component === 'service-container' || 
      r.component === 'error-handling' ||
      (r.component === 'consolidated-services' && r.test.includes('resolution'))
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
    
    if (envStatus.warnings.length > 0) {
      recommendations.push('Review environment configuration warnings');
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

  getDegradedServices(): string[] {
    return this.validationResult?.degradedServices || [];
  }

  getRecommendations(): string[] {
    return this.validationResult?.recommendations || [];
  }

  // ===== CONTINUOUS MONITORING =====

  async startContinuousMonitoring(intervalMs: number = 300000): Promise<() => void> {
    console.log(`🔄 Starting continuous monitoring (every ${intervalMs / 1000}s)...`);
    
    const interval = setInterval(async () => {
      try {
        const quickCheck = await this.performQuickHealthCheck();
        
        if (!quickCheck.healthy) {
          console.warn('⚠️ System health degraded:', quickCheck.issues);
          
          // Optionally trigger re-validation if too many issues
          if (quickCheck.issues.length > 3) {
            console.log('🔄 Too many issues detected, triggering re-validation...');
            await this.validateStartup({ skipNonCritical: true, timeoutMs: 60000 });
          }
        }
        
      } catch (error: any) {
        console.error('❌ Continuous monitoring error:', error.message);
      }
    }, intervalMs);

    // Return a function to stop monitoring
    return () => {
      clearInterval(interval);
      console.log('🛑 Continuous monitoring stopped');
    };
  }

  private async performQuickHealthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    try {
      // Check container health
      // CONSOLIDATED: Import from consolidated services
      const { serviceContainer } = await import('../services/index.js');
      const containerHealth = await serviceContainer.getHealth();
      
      if (containerHealth.overall === 'unhealthy') {
        issues.push('Container unhealthy');
      }
      
      // Check memory usage
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      if (heapUsedMB > 1000) { // More than 1GB
        issues.push(`High memory usage: ${heapUsedMB.toFixed(2)}MB`);
      }
      
      // Check if services are still available
      const serviceCount = Object.keys(containerHealth.services).length;
      if (serviceCount === 0) {
        issues.push('No services available');
      }
      
    } catch (error: any) {
      issues.push(`Health check error: ${error.message}`);
    }
    
    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  // ===== VALIDATION PRESETS =====

  async validateForProduction(): Promise<StartupValidationResult> {
    return this.validateStartup({
      enableRollback: false,
      criticalFailureThreshold: 0, // No failures allowed in production
      timeoutMs: 180000, // 3 minutes
      skipNonCritical: false,
    });
  }

  async validateForDevelopment(): Promise<StartupValidationResult> {
    return this.validateStartup({
      enableRollback: false,
      criticalFailureThreshold: 3, // Allow some failures in development
      timeoutMs: 120000, // 2 minutes
      skipNonCritical: true,
    });
  }

  async validateQuick(): Promise<StartupValidationResult> {
    return this.validateStartup({
      enableRollback: false,
      criticalFailureThreshold: 1,
      timeoutMs: 30000, // 30 seconds
      skipNonCritical: true,
    });
  }

  // ===== STATIC CONVENIENCE METHODS =====

  static async quickValidation(): Promise<boolean> {
    const validator = StartupValidator.getInstance();
    const result = await validator.validateQuick();
    return result.ready;
  }

  static async validateEnvironment(): Promise<boolean> {
    const validator = StartupValidator.getInstance();
    try {
      const envStatus = await validator.validateEnvironment();
      return envStatus.valid;
    } catch (error) {
      console.error('Environment validation failed:', error);
      return false;
    }
  }
}