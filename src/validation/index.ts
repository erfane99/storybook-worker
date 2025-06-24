// Validation System Exports
// FIXED: Export the full-featured StartupValidator and IntegrationValidator

// ===== EXPORT FULL VALIDATORS =====
export { StartupValidator } from './startup-validator.js';
export { IntegrationValidator } from './integration-validator.js';

// ===== EXPORT TYPES =====
export type { 
  StartupValidationResult,
} from './startup-validator.js';

export type {
  ValidationResult
} from './integration-validator.js';

// ===== CONVENIENCE FUNCTIONS =====

export async function validateSystemStartup() {
  const { StartupValidator } = await import('./startup-validator.js');
  const validator = StartupValidator.getInstance();
  return validator.validateStartup();
}

export async function runFullIntegrationValidation() {
  const { IntegrationValidator } = await import('./integration-validator.js');
  const validator = new IntegrationValidator();
  return validator.validateIntegration();
}

// ===== VALIDATION RUNNER =====

export async function runCompleteValidation() {
  console.log('🚀 Running complete validation suite...');
  
  const { StartupValidator } = await import('./startup-validator.js');
  const { IntegrationValidator } = await import('./integration-validator.js');
  
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