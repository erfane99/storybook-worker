// Service Registry for registering all services with the container
import { serviceContainer } from '../container/service-container.js';
import { SERVICE_TOKENS } from '../interfaces/service-interfaces.js';

// Import service implementations
import { DatabaseService } from '../database/database-service.js';
import { AIService } from '../ai/ai-service.js';
import { StorageService } from '../storage/storage-service.js';
import { JobService } from '../job/job-service.js';
import { AuthService } from '../auth/auth-service.js';
import { ServiceConfigManager } from '../config/service-config.js';

export class ServiceRegistry {
  private static registered = false;

  /**
   * Register all services with the container
   */
  static registerServices(): void {
    if (this.registered) {
      console.log('⚠️ Services already registered, skipping...');
      return;
    }

    console.log('📋 Registering services with container...');

    // Register Configuration Service (no dependencies)
    serviceContainer.register(
      SERVICE_TOKENS.CONFIG,
      () => new ServiceConfigManager(),
      {
        singleton: true,
        lazy: false, // Load immediately
        dependencies: [],
        healthCheck: true,
      }
    );

    // Register Database Service (depends on config)
    serviceContainer.register(
      SERVICE_TOKENS.DATABASE,
      () => new DatabaseService(),
      {
        singleton: true,
        lazy: true,
        dependencies: [SERVICE_TOKENS.CONFIG],
        healthCheck: true,
      }
    );

    // Register AI Service (depends on config)
    serviceContainer.register(
      SERVICE_TOKENS.AI,
      () => new AIService(),
      {
        singleton: true,
        lazy: true,
        dependencies: [SERVICE_TOKENS.CONFIG],
        healthCheck: true,
      }
    );

    // Register Storage Service (depends on config)
    serviceContainer.register(
      SERVICE_TOKENS.STORAGE,
      () => new StorageService(),
      {
        singleton: true,
        lazy: true,
        dependencies: [SERVICE_TOKENS.CONFIG],
        healthCheck: true,
      }
    );

    // Register Auth Service (depends on config)
    serviceContainer.register(
      SERVICE_TOKENS.AUTH,
      () => new AuthService(),
      {
        singleton: true,
        lazy: true,
        dependencies: [SERVICE_TOKENS.CONFIG],
        healthCheck: true,
      }
    );

    // Register Job Service (depends on database)
    serviceContainer.register(
      SERVICE_TOKENS.JOB,
      () => new JobService(),
      {
        singleton: true,
        lazy: true,
        dependencies: [SERVICE_TOKENS.CONFIG, SERVICE_TOKENS.DATABASE],
        healthCheck: true,
      }
    );

    this.registered = true;
    console.log('✅ All services registered successfully');
  }

  /**
   * Initialize core services that should be loaded immediately
   */
  static async initializeCoreServices(): Promise<void> {
    console.log('🚀 Initializing core services...');
    
    try {
      // Initialize configuration service first
      await serviceContainer.resolve(SERVICE_TOKENS.CONFIG);
      console.log('✅ Core services initialized');
    } catch (error: any) {
      console.error('❌ Failed to initialize core services:', error.message);
      throw error;
    }
  }

  /**
   * Get service health report
   */
  static async getServiceHealth() {
    return serviceContainer.getHealth();
  }

  /**
   * Get container statistics
   */
  static getContainerStats() {
    return serviceContainer.getStats();
  }

  /**
   * Dispose all services
   */
  static async dispose(): Promise<void> {
    await serviceContainer.dispose();
    this.registered = false;
  }
}

export default ServiceRegistry;