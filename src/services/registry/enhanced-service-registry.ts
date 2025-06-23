// Enhanced Service Registry implementing Interface Segregation Principle
import { enhancedServiceContainer } from '../container/enhanced-service-container.js';
import { SERVICE_TOKENS, ContainerHealthReport } from '../interfaces/service-contracts.js';

// Import enhanced service implementations
import { EnhancedDatabaseService } from '../database/enhanced-database-service.js';
import { AIService } from '../ai/ai-service.js';
import { StorageService } from '../storage/storage-service.js';
import { JobService } from '../job/job-service.js';
import { AuthService } from '../auth/auth-service.js';
import { ServiceConfigManager } from '../config/service-config.js';

export class EnhancedServiceRegistry {
  private static registered = false;

  /**
   * Register all services with the enhanced container
   */
  static registerServices(): void {
    if (this.registered) {
      console.log('⚠️ Services already registered, skipping...');
      return;
    }

    console.log('📋 Registering services with enhanced container...');

    // Register Configuration Service (no dependencies)
    enhancedServiceContainer.register(
      SERVICE_TOKENS.CONFIG,
      () => new ServiceConfigManager(),
      {
        singleton: true,
        lazy: false, // Load immediately
        dependencies: [],
        healthCheck: true,
      }
    );

    // Register Enhanced Database Service (depends on config)
    enhancedServiceContainer.register(
      SERVICE_TOKENS.DATABASE,
      () => new EnhancedDatabaseService(),
      {
        singleton: true,
        lazy: true,
        dependencies: [SERVICE_TOKENS.CONFIG],
        healthCheck: true,
      }
    );

    // Register AI Service (depends on config)
    enhancedServiceContainer.register(
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
    enhancedServiceContainer.register(
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
    enhancedServiceContainer.register(
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
    enhancedServiceContainer.register(
      SERVICE_TOKENS.JOB,
      async (container) => {
        const jobService = new JobService();
        
        // Inject database service dependency
        const databaseService = await container.resolve(SERVICE_TOKENS.DATABASE);
        (jobService as any).setDatabaseService(databaseService);
        
        return jobService;
      },
      {
        singleton: true,
        lazy: true,
        dependencies: [SERVICE_TOKENS.CONFIG, SERVICE_TOKENS.DATABASE],
        healthCheck: true,
      }
    );

    this.registered = true;
    console.log('✅ All services registered successfully with enhanced container');
  }

  /**
   * Initialize core services that should be loaded immediately
   */
  static async initializeCoreServices(): Promise<void> {
    console.log('🚀 Initializing core services with enhanced container...');
    
    try {
      // Initialize configuration service first
      await enhancedServiceContainer.resolve(SERVICE_TOKENS.CONFIG);
      console.log('✅ Core services initialized with enhanced container');
    } catch (error: any) {
      console.error('❌ Failed to initialize core services:', error.message);
      throw error;
    }
  }

  /**
   * Get service health report (computed properties, not internal state)
   */
  static async getServiceHealth(): Promise<ContainerHealthReport> {
    return enhancedServiceContainer.getHealth();
  }

  /**
   * Get container statistics (computed properties)
   */
  static getContainerStats() {
    return enhancedServiceContainer.getStats();
  }

  /**
   * Get individual service metrics (if supported)
   */
  static async getServiceMetrics(serviceToken: string) {
    try {
      const service = enhancedServiceContainer.resolveSync(serviceToken);
      if (service && typeof (service as any).getMetrics === 'function') {
        return (service as any).getMetrics();
      }
      return null;
    } catch (error) {
      console.warn(`⚠️ Failed to get metrics for service ${serviceToken}:`, error);
      return null;
    }
  }

  /**
   * Reset metrics for a specific service (if supported)
   */
  static async resetServiceMetrics(serviceToken: string): Promise<boolean> {
    try {
      const service = enhancedServiceContainer.resolveSync(serviceToken);
      if (service && typeof (service as any).resetMetrics === 'function') {
        (service as any).resetMetrics();
        return true;
      }
      return false;
    } catch (error) {
      console.warn(`⚠️ Failed to reset metrics for service ${serviceToken}:`, error);
      return false;
    }
  }

  /**
   * Get comprehensive system health report
   */
  static async getSystemHealth() {
    const containerHealth = await this.getServiceHealth();
    const containerStats = this.getContainerStats();
    
    return {
      container: containerHealth,
      stats: containerStats,
      timestamp: new Date().toISOString(),
      features: {
        interfaceSegregation: true,
        encapsulationCompliance: true,
        cleanArchitecture: true,
        dependencyInjection: true,
        healthMonitoring: true,
        metricsCollection: true,
        circuitBreakerPattern: true,
        gracefulDegradation: true,
      },
    };
  }

  /**
   * Dispose all services with proper cleanup
   */
  static async dispose(): Promise<void> {
    await enhancedServiceContainer.dispose();
    this.registered = false;
  }
}

export default EnhancedServiceRegistry;