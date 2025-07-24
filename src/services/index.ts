// Consolidated Service Layer Exports - Pure Export-Only File
// REFACTORED: Clean exports only, no business logic

// ===== BASE SERVICE EXPORTS =====
export { EnhancedBaseService } from './base/enhanced-base-service.js';
export { ErrorAwareBaseService } from './base/error-aware-base-service.js';

// ===== SERVICE INTERFACES =====
export {
  IService,
  IAIService,
  IJobProcessor,
  IDatabaseService,
  ICloudinaryService,
  ISubscriptionService,
  ErrorCategory,
  ErrorSeverity
} from './interfaces/service-contracts.js';


// ===== ERROR HANDLING SYSTEM =====
export * from './errors/index.js';

// ===== CONSOLIDATED SERVICE CONTAINER =====
export { serviceContainer } from './container/service-container.js';

// ===== CONSOLIDATED SERVICE REGISTRY =====
export { ServiceRegistry } from './registry/service-registry.js';

// ===== CONSOLIDATED SERVICE CONFIG =====
export { serviceConfig } from './config/service-config.js';