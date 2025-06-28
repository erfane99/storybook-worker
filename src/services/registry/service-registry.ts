// Consolidated Service Registry - Production Implementation
// CONSOLIDATED: Single registry with all enhanced features
import { serviceContainer } from '../container/service-container.js';
import { SERVICE_TOKENS, ContainerHealthReport } from '../interfaces/service-contracts.js';

// Import consolidated service implementations
import { DatabaseService } from '../database/database-service.js';
import { AIService } from '../ai/ai-service.js';
import { StorageService } from '../storage/storage-service.js';
import { JobService } from '../job/job-service.js';
import { AuthService } from '../auth/auth-service.js';
import { SubscriptionService } from '../subscription/subscription-service.js';
import { ServiceConfigManager } from '../config/service-config.js';
import { SubscriptionConfigService } from '../config/subscription-config.js';

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

    // Register Subscription Configuration Service (no dependencies)
    serviceContainer.register(
      'ISubscriptionConfigService',
      () => new SubscriptionConfigService(),
      {
        singleton: true,
        lazy: false, // Load immediately for configuration
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

    // Register Subscription Service (depends on config and database)
    serviceContainer.register(
      SERVICE_TOKENS.SUBSCRIPTION,
      () => new SubscriptionService(),
      {
        singleton: true,
        lazy: true,
        dependencies: [SERVICE_TOKENS.CONFIG, SERVICE_TOKENS.DATABASE, 'ISubscriptionConfigService'],
        healthCheck: true,
      }
    );

    // Register Job Service (depends on database)
    serviceContainer.register(
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
    console.log('✅ All services registered successfully');
  }

  /**
   * Initialize core services that should be loaded immediately
   */
  static async initializeCoreServices(): Promise<void> {
    console.log('🚀 Initializing core services...');
    
    try {
      // Initialize configuration services first
      await serviceContainer.resolve(SERVICE_TOKENS.CONFIG);
      await serviceContainer.resolve('ISubscriptionConfigService');
      console.log('✅ Core services initialized');
    } catch (error: any) {
      console.error('❌ Failed to initialize core services:', error.message);
      throw error;
    }
  }

  /**
   * Get service health report (computed properties, not internal state)
   */
  static async getServiceHealth(): Promise<ContainerHealthReport> {
    return serviceContainer.getHealth();
  }

  /**
   * Get container statistics (computed properties)
   */
  static getContainerStats() {
    return serviceContainer.getStats();
  }

  /**
   * Get individual service metrics (if supported)
   */
  static async getServiceMetrics(serviceToken: string) {
    try {
      const service = serviceContainer.resolveSync(serviceToken);
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
      const service = serviceContainer.resolveSync(serviceToken);
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
        configurationManagement: true,
        environmentBasedConfig: true,
        hotConfigReload: true,
      },
    };
  }

  /**
   * Get subscription configuration status
   */
  static async getSubscriptionConfigStatus() {
    try {
      const subscriptionService = serviceContainer.resolveSync(SERVICE_TOKENS.SUBSCRIPTION);
      if (subscriptionService && typeof (subscriptionService as any).getConfigurationSummary === 'function') {
        const summary = (subscriptionService as any).getConfigurationSummary();
        return summary.success ? summary.data : null;
      }
      return null;
    } catch (error) {
      console.warn('⚠️ Failed to get subscription configuration status:', error);
      return null;
    }
  }

  /**
   * Reload subscription configuration from environment
   */
  static async reloadSubscriptionConfig(): Promise<boolean> {
    try {
      const configService = serviceContainer.resolveSync('ISubscriptionConfigService');
      if (configService && typeof (configService as any).reloadConfiguration === 'function') {
        const result = await (configService as any).reloadConfiguration();
        return result.success;
      }
      return false;
    } catch (error) {
      console.warn('⚠️ Failed to reload subscription configuration:', error);
      return false;
    }
  }

  /**
   * Dispose all services with proper cleanup
   */
  static async dispose(): Promise<void> {
    await serviceContainer.dispose();
    this.registered = false;
  }
}

export default ServiceRegistry;