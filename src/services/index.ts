// Enhanced Service Layer Exports - Production Implementation
export { EnhancedBaseService } from './base/enhanced-base-service.js';
export { databaseService } from './database/database-service.js';
export { aiService } from './ai/ai-service.js';
export { storageService } from './storage/storage-service.js';
export { jobService } from './job/job-service.js';
export { authService } from './auth/auth-service.js';
export { serviceConfig } from './config/service-config.js';

// Enhanced service registry
export { EnhancedServiceRegistry } from './registry/enhanced-service-registry.js';

// Enhanced service container
export { enhancedServiceContainer } from './container/enhanced-service-container.js';

// Service interfaces
export * from './interfaces/service-contracts.js';

// Error handling system
export * from './errors/index.js';

// Service health check aggregator
export async function checkAllServicesHealth(): Promise<{
  overall: boolean;
  services: Record<string, any>;
}> {
  const healthReport = await enhancedServiceContainer.getHealth();
  
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

// Initialize all enhanced services
export async function initializeServices(): Promise<void> {
  console.log('🚀 Initializing enhanced service layer...');
  
  try {
    // Register all enhanced services
    EnhancedServiceRegistry.registerServices();
    
    // Initialize core services
    await EnhancedServiceRegistry.initializeCoreServices();
    
    // Log configuration
    serviceConfig.logConfiguration();
    
    console.log('✅ Enhanced service layer initialization complete');
  } catch (error) {
    console.error('❌ Enhanced service layer initialization failed:', error);
    throw error;
  }
}

// Dispose all services
export async function disposeServices(): Promise<void> {
  console.log('🔄 Disposing enhanced service layer...');
  
  try {
    await EnhancedServiceRegistry.dispose();
    console.log('✅ Enhanced service layer disposed successfully');
  } catch (error) {
    console.error('❌ Enhanced service layer disposal failed:', error);
    throw error;
  }
}