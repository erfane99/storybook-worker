// Consolidated Service Layer Exports - Pure Export-Only File
// FIXED: Corrected type re-exports for isolatedModules compatibility

// ===== BASE SERVICE EXPORTS =====
export { EnhancedBaseService } from './base/enhanced-base-service.js';
export { ErrorAwareBaseService } from './base/error-aware-base-service.js';

// ===== SERVICE INTERFACES =====
export type {
  IAIService,
  IJobProcessor,
  ICloudinaryService,
  ISceneGenerationService,
  ICartoonizationService,
  IService,
} from './interfaces/service-contracts.js';

// ===== ERROR HANDLING SYSTEM =====
export * from './errors/index.js';

// ===== CONSOLIDATED SERVICE CONTAINER =====
export { serviceContainer } from './container/service-container.js';

// ===== CONSOLIDATED SERVICE REGISTRY =====
export { ServiceRegistry } from './registry/service-registry.js';

// ===== CONSOLIDATED SERVICE CONFIG =====
export { serviceConfig } from './config/service-config.js';

// ===== TYPE ALIASES FOR BACKWARDS COMPATIBILITY =====
export type {
  IJobProcessor,
  ICloudinaryService,
  ISceneGenerationService,
  ICartoonizationService,
} from './interfaces/service-contracts.js';