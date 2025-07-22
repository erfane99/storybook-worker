// Consolidated Service Registry - Production Implementation
// REFACTORED: Removed environment service dependencies, direct env var access
import { serviceContainer } from '../container/service-container.js';
import { SERVICE_TOKENS, ContainerHealthReport } from '../interfaces/service-contracts.js';
import { serviceConfig } from '../config/service-config.js';

// Import consolidated service implementations
import { DatabaseService } from '../database/database-service.js';
import { AIService } from '../ai/ai-service-core.js';
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
        lazy: false,
        dependencies: [SERVICE_TOKENS.CONFIG],
        healthCheck: true,
      }
    );

    // Register AI Service (depends on config)
serviceContainer.register(
  SERVICE_TOKENS.AI,
  () => createEnterpriseAIService(),
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
        healthCheck: false, // Not critical for basic job processing
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
   * Initialize core services needed for job processing
   */
  static async initializeCoreServices(): Promise<void> {
    console.log('🚀 Initializing core services for job processing...');
    
    try {
      // Initialize configuration services first
      await serviceContainer.resolve(SERVICE_TOKENS.CONFIG);
      await serviceContainer.resolve('ISubscriptionConfigService');
      
      // Initialize database service (critical for job processing)
      console.log('🗄️ Initializing database service...');
      const databaseService = await serviceContainer.resolve(SERVICE_TOKENS.DATABASE);
      if (!databaseService) {
        throw new Error('Failed to initialize database service');
      }
      
      // Initialize job service (depends on database)
      console.log('📋 Initializing job service...');
      const jobService = await serviceContainer.resolve(SERVICE_TOKENS.JOB);
      if (!jobService) {
        throw new Error('Failed to initialize job service');
      }
      
      console.log('✅ Core services initialized successfully');
    } catch (error: any) {
      console.error('❌ Failed to initialize core services:', error.message);
      throw error;
    }
  }

  /**

  // ===== LIFECYCLE MANAGEMENT FUNCTIONS =====

  /**
   * Initialize all services (moved from services/index.ts)
   */
  static async initializeServices(): Promise<void> {
    console.log('🚀 Initializing consolidated service layer...');
    
    try {
      // Register all services
      this.registerServices();
      
      // Initialize core services
      await this.initializeCoreServices();
      
      // Log configuration
      serviceConfig.logConfiguration();
      
      console.log('✅ Consolidated service layer initialization complete');
    } catch (error) {
      console.error('❌ Consolidated service layer initialization failed:', error);
      throw error;
    }
  }

  /**
   * Dispose all services (moved from services/index.ts)
   */
  static async disposeServices(): Promise<void> {
    console.log('🔄 Disposing consolidated service layer...');
    
    try {
      await this.dispose();
      console.log('✅ Consolidated service layer disposed successfully');
    } catch (error) {
      console.error('❌ Consolidated service layer disposal failed:', error);
      throw error;
    }
  }

  /**
   * Check all services health (moved from services/index.ts)
   */
  static async checkAllServicesHealth(): Promise<{
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

  /**
   * Get service configuration (moved from services/index.ts)
   */
  static getServiceConfiguration() {
    return {
      environment: serviceConfig.getEnvironment(),
      logLevel: serviceConfig.getLogLevel(),
      registeredServices: ['database', 'ai', 'storage', 'job', 'auth', 'subscription'],
      containerStatus: 'initialized'
    };
  }

  /**
   * Validate service health (moved from services/index.ts)
   */
  static async validateServiceHealth(): Promise<boolean> {
    try {
      const health = await this.checkAllServicesHealth();
      return health.overall;
    } catch (error) {
      console.error('Service health validation failed:', error);
      return false;
    }
  }

  // ===== EXISTING METHODS =====

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