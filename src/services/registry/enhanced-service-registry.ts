// Enhanced Service Registry - Production Implementation
import { enhancedServiceContainer } from '../container/enhanced-service-container.js';
import { SERVICE_TOKENS, ContainerHealthReport } from '../interfaces/service-contracts.js';

// Import enhanced service implementations
import { DatabaseService } from '../database/database-service.js';
import { AIService } from '../ai/ai-service.js';
import { StorageService } from '../storage/storage-service.js';
import { JobService } from '../job/job-service.js';
import { AuthService } from '../auth/auth-service.js';
import { SubscriptionService } from '../subscription/subscription-service.js';
import { ServiceConfigManager } from '../config/service-config.js';

export class EnhancedServiceRegistry {
  private static registered = false;

  /**
   * Register all enhanced services with the container
   */
  static registerServices(): void {
    if (this.registered) {
      console.log('⚠️ Enhanced services already registered, skipping...');
      return;
    }

    console.log('📋 Registering enhanced services with container...');

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
      () => new DatabaseService(),
      {
        singleton: true,
        lazy: true,
        dependencies: [SERVICE_TOKENS.CONFIG],
        healthCheck: true,
      }
    );

    // Register Enhanced AI Service (depends on config)
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

    // Register Enhanced Storage Service (depends on config)
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

    // Register Enhanced Auth Service (depends on config)
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

    // Register Enhanced Subscription Service (depends on config and database)
    enhancedServiceContainer.register(
      SERVICE_TOKENS.SUBSCRIPTION,
      () => new SubscriptionService(),
      {
        singleton: true,
        lazy: true,
        dependencies: [SERVICE_TOKENS.CONFIG, SERVICE_TOKENS.DATABASE],
        healthCheck: true,
      }
    );

    // Register Enhanced Job Service (depends on database)
    enhancedServiceContainer.register(
      SERVICE_TOKENS.JOB,
      async (container) => {
        const jobService = new JobService();
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
    console.log('✅ All enhanced services registered successfully');
  }

  /**
   * Initialize core services that should be loaded immediately
   */
  static async initializeCoreServices(): Promise<void> {
    console.log('🚀 Initializing core enhanced services...');
    
    try {
      // Initialize configuration service first
      await enhancedServiceContainer.resolve(SERVICE_TOKENS.CONFIG);
      console.log('✅ Core enhanced services initialized');
    } catch (error: any) {
      console.error('❌ Failed to initialize core enhanced services:', error.message);
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
        enhancedErrorHandling: true,
        resultPattern: true,
        errorCorrelation: true,
        subscriptionManagement: true,
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