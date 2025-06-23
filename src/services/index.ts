// Service layer exports and initialization
export { BaseService } from './base/base-service.js';
export { databaseService } from './database/database-service.js';
export { aiService } from './ai/ai-service.js';
export { storageService } from './storage/storage-service.js';
export { jobService } from './job/job-service.js';
export { authService } from './auth/auth-service.js';
export { serviceConfig } from './config/service-config.js';

// Service health check aggregator
export async function checkAllServicesHealth(): Promise<{
  overall: boolean;
  services: Record<string, any>;
}> {
  const services = {
    database: databaseService.getStatus(),
    ai: aiService.getStatus(),
    storage: storageService.getStatus(),
    job: jobService.getStatus(),
    auth: authService.getStatus(),
  };

  const overall = Object.values(services).every(service => service.available);

  return { overall, services };
}

// Initialize all services
export async function initializeServices(): Promise<void> {
  console.log('🚀 Initializing service layer...');
  
  try {
    // Services will initialize themselves when first used
    // This is just for logging configuration
    serviceConfig.logConfiguration();
    
    console.log('✅ Service layer initialization complete');
  } catch (error) {
    console.error('❌ Service layer initialization failed:', error);
    throw error;
  }
}