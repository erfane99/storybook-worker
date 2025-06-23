// Validation System Exports
// FIXED: Proper ES module exports and type handling

// ===== CLASS EXPORTS =====
export { IntegrationValidator } from './integration-validator.js';
export { StartupValidator } from './startup-validator.js';

// ===== TYPE EXPORTS =====
export type { 
  ValidationResult, 
  ValidationReport, 
  ValidationConfig 
} from './integration-validator.js';

export type { 
  StartupValidationResult 
} from './startup-validator.js';

// ===== CONVENIENCE FUNCTIONS =====

export async function validateSystemStartup() {
  const validator = StartupValidator.getInstance();
  return validator.validateStartup();
}

export async function runFullIntegrationValidation() {
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
    // Import locally to avoid circular dependencies
    const { enhancedServiceContainer } = await import('../services/index.js');
    
    // Quick container health check
    const health = await enhancedServiceContainer.getHealth();
    if (health.overall !== 'healthy') {
      issues.push(`Container health: ${health.overall}`);
    }
    
    // Memory check
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    if (heapUsedMB > 500) {
      issues.push(`High memory usage: ${heapUsedMB.toFixed(2)}MB`);
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