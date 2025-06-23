// Validation System Exports
export { default as IntegrationValidator } from './integration-validator.js';
export { default as StartupValidator } from './startup-validator.js';
export type { 
  ValidationResult, 
  ValidationReport, 
  ValidationConfig 
} from './integration-validator.js';
export type { 
  StartupValidationResult 
} from './startup-validator.js';

// Convenience functions
export async function validateSystemStartup() {
  const validator = StartupValidator.getInstance();
  return validator.validateStartup();
}

export async function runFullIntegrationValidation() {
  const validator = new IntegrationValidator();
  return validator.validateIntegration();
}