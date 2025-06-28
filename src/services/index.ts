// Consolidated Service Layer Exports - Production Implementation
// CONSOLIDATED: Single source of truth for all service exports

import { ServiceHealthStatus } from './interfaces/service-contracts.js';

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

// ===== CONSOLIDATED SERVICE IMPLEMENTATIONS =====
export { databaseService } from './database/database-service.js';
export { aiService } from './ai/ai-service.js';
export { storageService } from './storage/storage-service.js';
export { jobService } from './job/job-service.js';
export { authService } from './auth/auth-service.js';
export { subscriptionService } from './subscription/subscription-service.js';
export { serviceConfig } from './config/service-config.js';

// ===== SERVICE HEALTH CHECK AGGREGATOR =====
export async function checkAllServicesHealth(): Promise<{
  overall: boolean;
  services: Record<string, any>;
}> {
  const healthReport = await serviceContainer.getHealth();
  
  const services = Object.fromEntries(
    Object.entries(healthReport.services).map(([name, status]) => [
      name,
      {
        available: status.status === 'healthy',
        status: status.status,
        message: status.message,
        availability: status.availability,
      }
    ])
  );

  const overall = healthReport.overall === 'healthy';

  return { overall, services };
}

// ===== SERVICE LIFECYCLE MANAGEMENT =====
export async function initializeServices(): Promise<void> {
  console.log('🚀 Initializing consolidated service layer...');
  
  try {
    // Register all services
    ServiceRegistry.registerServices();
    
    // Initialize core services
    await ServiceRegistry.initializeCoreServices();
    
    // Log configuration
    serviceConfig.logConfiguration();
    
    console.log('✅ Consolidated service layer initialization complete');
  } catch (error) {
    console.error('❌ Consolidated service layer initialization failed:', error);
    throw error;
  }
}

export async function disposeServices(): Promise<void> {
  console.log('🔄 Disposing consolidated service layer...');
  
  try {
    await ServiceRegistry.dispose();
    console.log('✅ Consolidated service layer disposed successfully');
  } catch (error) {
    console.error('❌ Consolidated service layer disposal failed:', error);
    throw error;
  }
}

// ===== DEVELOPMENT HELPERS =====
export function getServiceConfiguration() {
  return {
    environment: serviceConfig.getEnvironment(),
    logLevel: serviceConfig.getLogLevel(),
    registeredServices: ['database', 'ai', 'storage', 'job', 'auth', 'subscription'],
    containerStatus: 'initialized'
  };
}

export async function validateServiceHealth(): Promise<boolean> {
  try {
    const health = await checkAllServicesHealth();
    return health.overall;
  } catch (error) {
    console.error('Service health validation failed:', error);
    return false;
  }
}