// Consolidated Service Layer Exports - Pure Export-Only File
// REFACTORED: Clean exports only, no business logic

// ===== BASE SERVICE EXPORTS =====
export { EnhancedBaseService } from './base/enhanced-base-service.js';
export { ErrorAwareBaseService } from './base/error-aware-base-service.js';

// ===== SERVICE INTERFACES =====
export * from './interfaces/service-contracts.js';

// ===== ERROR HANDLING SYSTEM =====
export * from './errors/index.js';

// ===== CONSOLIDATED SERVICE CONTAINER =====
export { serviceContainer } from './container/service-container.js';

// ===== CONSOLIDATED SERVICE REGISTRY =====
export { ServiceRegistry } from './registry/service-registry.js';

// ===== CONSOLIDATED SERVICE CONFIG =====
export { serviceConfig } from './config/service-config.js';

// ===== CONSOLIDATED SERVICE IMPLEMENTATIONS =====
export { databaseService } from './database/database-service.js';
export { aiService } from './ai/ai-service.js';
export { storageService } from './storage/storage-service.js';
export { jobService } from './job/job-service.js';
export { authService } from './auth/auth-service.js';
export { subscriptionService } from './subscription/subscription-service.js';