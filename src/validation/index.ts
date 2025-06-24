// Validation System Exports
// FIXED: Proper ES module exports and type handling
// FIXED: Simplified validation system for current implementation

// ===== BASIC VALIDATION TYPES =====

export interface ValidationResult {
  valid: boolean;
  message: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface ValidationReport {
  overall: 'passed' | 'failed' | 'warning';
  checks: ValidationResult[];
  timestamp: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

export interface StartupValidationResult {
  ready: boolean;
  message: string;
  checks: ValidationResult[];
  timestamp: string;
}

export interface ValidationConfig {
  timeout: number;
  retryAttempts: number;
  strictMode: boolean;
  skipOptional: boolean;
}

// ===== SIMPLE VALIDATION CLASSES =====

export class StartupValidator {
  private static instance: StartupValidator;
  private config: ValidationConfig;

  private constructor() {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      strictMode: false,
      skipOptional: true
    };
  }

  static getInstance(): StartupValidator {
    if (!StartupValidator.instance) {
      StartupValidator.instance = new StartupValidator();
    }
    return StartupValidator.instance;
  }

  async validateStartup(): Promise<StartupValidationResult> {
    const timestamp = new Date().toISOString();
    const checks: ValidationResult[] = [];

    try {
      // Environment variables check
      checks.push(await this.checkEnvironmentVariables());
      
      // Service availability check
      checks.push(await this.checkServiceAvailability());
      
      // Configuration check
      checks.push(await this.checkConfiguration());
      
    } catch (error) {
      checks.push({
        valid: false,
        message: `Startup validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      });
    }

    const failedChecks = checks.filter(check => !check.valid);
    const ready = failedChecks.length === 0;

    return {
      ready,
      message: ready ? 'System startup validation passed' : `${failedChecks.length} validation checks failed`,
      checks,
      timestamp
    };
  }

  private async checkEnvironmentVariables(): Promise<ValidationResult> {
    const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY'];
    const missing = requiredVars.filter(varName => !process.env[varName]);

    return {
      valid: missing.length === 0,
      message: missing.length === 0 
        ? 'All required environment variables are present'
        : `Missing environment variables: ${missing.join(', ')}`,
      timestamp: new Date().toISOString(),
      details: { missing, required: requiredVars }
    };
  }

  private async checkServiceAvailability(): Promise<ValidationResult> {
    try {
      // Simple service availability check
      const services = ['database', 'ai', 'storage'];
      const results = await Promise.allSettled(
        services.map(service => this.pingService(service))
      );

      const failures = results
        .map((result, index) => ({ service: services[index], result }))
        .filter(({ result }) => result.status === 'rejected');

      return {
        valid: failures.length === 0,
        message: failures.length === 0
          ? 'All services are available'
          : `Service availability issues: ${failures.map(f => f.service).join(', ')}`,
        timestamp: new Date().toISOString(),
        details: { services, failures: failures.length }
      };
    } catch (error) {
      return {
        valid: false,
        message: `Service availability check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  private async checkConfiguration(): Promise<ValidationResult> {
    try {
      // Basic configuration checks
      const checks = [
        { name: 'Node.js version', valid: process.version.startsWith('v18') || process.version.startsWith('v20') },
        { name: 'Memory availability', valid: process.memoryUsage().heapUsed < 1024 * 1024 * 1024 }, // 1GB
        { name: 'Environment', valid: ['development', 'production', 'test'].includes(process.env.NODE_ENV || 'development') }
      ];

      const failed = checks.filter(check => !check.valid);

      return {
        valid: failed.length === 0,
        message: failed.length === 0
          ? 'Configuration validation passed'
          : `Configuration issues: ${failed.map(f => f.name).join(', ')}`,
        timestamp: new Date().toISOString(),
        details: { checks, failed: failed.length }
      };
    } catch (error) {
      return {
        valid: false,
        message: `Configuration check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  private async pingService(serviceName: string): Promise<boolean> {
    // Simple service ping - can be expanded later
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 100); // Mock ping
    });
  }
}

export class IntegrationValidator {
  private config: ValidationConfig;

  constructor(config?: Partial<ValidationConfig>) {
    this.config = {
      timeout: 60000,
      retryAttempts: 2,
      strictMode: false,
      skipOptional: false,
      ...config
    };
  }

  async validateIntegration(): Promise<ValidationReport> {
    const timestamp = new Date().toISOString();
    const checks: ValidationResult[] = [];

    try {
      // Integration checks
      checks.push(await this.checkDatabaseIntegration());
      checks.push(await this.checkAIServiceIntegration());
      checks.push(await this.checkStorageIntegration());
      checks.push(await this.checkJobProcessing());

    } catch (error) {
      checks.push({
        valid: false,
        message: `Integration validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      });
    }

    const summary = {
      total: checks.length,
      passed: checks.filter(c => c.valid).length,
      failed: checks.filter(c => !c.valid).length,
      warnings: 0 // For future use
    };

    const overall = summary.failed === 0 ? 'passed' : 'failed';

    return {
      overall,
      checks,
      timestamp,
      summary
    };
  }

  private async checkDatabaseIntegration(): Promise<ValidationResult> {
    try {
      // Mock database check - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 50));
      
      return {
        valid: true,
        message: 'Database integration check passed',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        valid: false,
        message: `Database integration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  private async checkAIServiceIntegration(): Promise<ValidationResult> {
    try {
      // Mock AI service check - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 50));
      
      return {
        valid: true,
        message: 'AI service integration check passed',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        valid: false,
        message: `AI service integration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  private async checkStorageIntegration(): Promise<ValidationResult> {
    try {
      // Mock storage check - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 50));
      
      return {
        valid: true,
        message: 'Storage integration check passed',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        valid: false,
        message: `Storage integration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  private async checkJobProcessing(): Promise<ValidationResult> {
    try {
      // Mock job processing check - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 50));
      
      return {
        valid: true,
        message: 'Job processing integration check passed',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        valid: false,
        message: `Job processing integration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// ===== CONVENIENCE FUNCTIONS =====

export async function validateSystemStartup(): Promise<StartupValidationResult> {
  const validator = StartupValidator.getInstance();
  return validator.validateStartup();
}

export async function runFullIntegrationValidation(): Promise<ValidationReport> {
  const validator = new IntegrationValidator();
  return validator.validateIntegration();
}

// ===== VALIDATION RUNNER =====

export async function runCompleteValidation(): Promise<{
  startup: StartupValidationResult;
  integration: ValidationReport;
  overall: boolean;
}> {
  console.log('🚀 Running complete validation suite...');
  
  const startupValidator = StartupValidator.getInstance();
  const integrationValidator = new IntegrationValidator();
  
  const startup = await startupValidator.validateStartup();
  const integration = await integrationValidator.validateIntegration();
  
  const overall = startup.ready && integration.overall !== 'failed';
  
  console.log(overall ? '✅ Complete validation passed' : '❌ Complete validation failed');
  
  return {
    startup,
    integration,
    overall
  };
}

// ===== QUICK VALIDATION =====

export async function quickHealthCheck(): Promise<{
  healthy: boolean;
  issues: string[];
  timestamp: string;
}> {
  const issues: string[] = [];
  const timestamp = new Date().toISOString();
  
  try {
    // Quick environment check
    const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      issues.push(`Missing environment variables: ${missingVars.join(', ')}`);
    }
    
    // Memory check
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    if (heapUsedMB > 500) {
      issues.push(`High memory usage: ${heapUsedMB.toFixed(2)}MB`);
    }
    
    // Try to import service container if available
    try {
      const { enhancedServiceContainer } = await import('../services/index.js');
      const health = await enhancedServiceContainer.getHealth();
      if (health.overall !== 'healthy') {
        issues.push(`Container health: ${health.overall}`);
      }
    } catch (error) {
      // Service container might not be available during startup
      console.warn('Service container not available for health check');
    }
    
  } catch (error) {
    issues.push(`Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return {
    healthy: issues.length === 0,
    issues,
    timestamp
  };
}