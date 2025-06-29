// Consolidated Service Registry - Production Implementation
// REFACTORED: Added all lifecycle management functions as static methods
import { serviceContainer } from '../container/service-container.js';
import { SERVICE_TOKENS, ContainerHealthReport } from '../interfaces/service-contracts.js';
import { serviceConfig } from '../config/service-config.js';

// Import consolidated service implementations
import { DatabaseService } from '../database/database-service.js';
import { AIService } from '../ai/ai-service.js';
import { StorageService } from '../storage/storage-service.js';
import { JobService } from '../job/job-service.js';
import { AuthService } from '../auth/auth-service.js';
import { SubscriptionService } from '../subscription/subscription-service.js';
import { ServiceConfigManager } from '../config/service-config.js';
import { SubscriptionConfigService } from '../config/subscription-config.js';
import { EnvironmentService } from '../environment/environment-service.js'; // ✅ NEW: Environment service

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

    // ✅ NEW: Register Environment Service (highest priority - no dependencies)
    serviceContainer.register(
      SERVICE_TOKENS.ENVIRONMENT,
      () => new EnvironmentService(),
      {
        singleton: true,
        lazy: false, // Load immediately - needed by all other services
        dependencies: [],
        healthCheck: true,
      }
    );

    // Register Configuration Service (depends on environment)
    serviceContainer.register(
      SERVICE_TOKENS.CONFIG,
      () => new ServiceConfigManager(),
      {
        singleton: true,
        lazy: false, // Load immediately
        dependencies: [SERVICE_TOKENS.ENVIRONMENT], // ✅ NEW: Depends on environment
        healthCheck: true,
      }
    );

    // Register Subscription Configuration Service (depends on environment)
    serviceContainer.register(
      'ISubscriptionConfigService',
      () => new SubscriptionConfigService(),
      {
        singleton: true,
        lazy: false, // Load immediately for configuration
        dependencies: [SERVICE_TOKENS.ENVIRONMENT], // ✅ NEW: Depends on environment
        healthCheck: true,
      }
    );

    // Register Database Service (depends on config and environment)
    serviceContainer.register(
      SERVICE_TOKENS.DATABASE,
      () => new DatabaseService(),
      {
        singleton: true,
        lazy: true,
        dependencies: [SERVICE_TOKENS.CONFIG, SERVICE_TOKENS.ENVIRONMENT], // ✅ NEW: Added environment dependency
        healthCheck: true,
      }
    );

    // Register AI Service (depends on config and environment)
    serviceContainer.register(
      SERVICE_TOKENS.AI,
      () => new AIService(),
      {
        singleton: true,
        lazy: true,
        dependencies: [SERVICE_TOKENS.CONFIG, SERVICE_TOKENS.ENVIRONMENT], // ✅ NEW: Added environment dependency
        healthCheck: true,
      }
    );

    // Register Storage Service (depends on config and environment)
    serviceContainer.register(
      SERVICE_TOKENS.STORAGE,
      () => new StorageService(),
      {
        singleton: true,
        lazy: true,
        dependencies: [SERVICE_TOKENS.CONFIG, SERVICE_TOKENS.ENVIRONMENT], // ✅ NEW: Added environment dependency
        healthCheck: true,
      }
    );

    // Register Auth Service (depends on config and environment)
    serviceContainer.register(
      SERVICE_TOKENS.AUTH,
      () => new AuthService(),
      {
        singleton: true,
        lazy: true,
        dependencies: [SERVICE_TOKENS.CONFIG, SERVICE_TOKENS.ENVIRONMENT], // ✅ NEW: Added environment dependency
        healthCheck: true,
      }
    );

    // Register Subscription Service (depends on config, database, and environment)
    serviceContainer.register(
      SERVICE_TOKENS.SUBSCRIPTION,
      () => new SubscriptionService(),
      {
        singleton: true,
        lazy: true,
        dependencies: [SERVICE_TOKENS.CONFIG, SERVICE_TOKENS.DATABASE, SERVICE_TOKENS.ENVIRONMENT, 'ISubscriptionConfigService'], // ✅ NEW: Added environment dependency
        healthCheck: true,
      }
    );

    // Register Job Service (depends on database, config, and environment)
    serviceContainer.register(
      SERVICE_TOKENS.JOB,
      async (container) => {
        const jobService = new JobService();
        return jobService;
      },
      {
        singleton: true,
        lazy: true,
        dependencies: [SERVICE_TOKENS.CONFIG, SERVICE_TOKENS.DATABASE, SERVICE_TOKENS.ENVIRONMENT], // ✅ NEW: Added environment dependency
        healthCheck: true,
      }
    );

    this.registered = true;
    console.log('✅ All services registered successfully with environment service integration');
  }

  /**
   * Initialize core services that should be loaded immediately
   */
  static async initializeCoreServices(): Promise<void> {
    console.log('🚀 Initializing core services...');
    
    try {
      // ✅ NEW: Initialize environment service first (highest priority)
      await serviceContainer.resolve(SERVICE_TOKENS.ENVIRONMENT);
      console.log('✅ Environment service initialized');
      
      // Initialize configuration services
      await serviceContainer.resolve(SERVICE_TOKENS.CONFIG);
      await serviceContainer.resolve('ISubscriptionConfigService');
      console.log('✅ Core services initialized with environment integration');
    } catch (error: any) {
      console.error('❌ Failed to initialize core services:', error.message);
      throw error;
    }
  }

  // ===== LIFECYCLE MANAGEMENT FUNCTIONS =====

  /**
   * Initialize all services (moved from services/index.ts)
   */
  static async initializeServices(): Promise<void> {
    console.log('🚀 Initializing consolidated service layer with environment integration...');
    
    try {
      // Register all services
      this.registerServices();
      
      // Initialize core services
      await this.initializeCoreServices();
      
      // Log configuration
      serviceConfig.logConfiguration();
      
      console.log('✅ Consolidated service layer initialization complete with environment service');
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
      registeredServices: ['environment', 'database', 'ai', 'storage', 'job', 'auth', 'subscription'], // ✅ NEW: Added environment
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
        environmentService: true, // ✅ NEW: Environment service feature
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
   * ✅ NEW: Get environment service status
   */
  static async getEnvironmentServiceStatus() {
    try {
      const environmentService = serviceContainer.resolveSync(SERVICE_TOKENS.ENVIRONMENT);
      if (environmentService && typeof (environmentService as any).getServiceAvailabilitySummary === 'function') {
        return (environmentService as any).getServiceAvailabilitySummary();
      }
      return null;
    } catch (error) {
      console.warn('⚠️ Failed to get environment service status:', error);
      return null;
    }
  }

  /**
   * ✅ NEW: Validate environment configuration
   */
  static async validateEnvironmentConfiguration(): Promise<{
    valid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    try {
      const environmentService = serviceContainer.resolveSync(SERVICE_TOKENS.ENVIRONMENT);
      if (environmentService && typeof (environmentService as any).validateServiceConfiguration === 'function') {
        const openaiValidation = (environmentService as any).validateServiceConfiguration('openai');
        const supabaseValidation = (environmentService as any).validateServiceConfiguration('supabase');
        
        const allIssues = [...openaiValidation.issues, ...supabaseValidation.issues];
        const allRecommendations = [...openaiValidation.recommendations, ...supabaseValidation.recommendations];
        
        return {
          valid: openaiValidation.valid && supabaseValidation.valid,
          issues: allIssues,
          recommendations: allRecommendations
        };
      }
      return { valid: false, issues: ['Environment service not available'], recommendations: ['Initialize environment service'] };
    } catch (error) {
      console.warn('⚠️ Failed to validate environment configuration:', error);
      return { valid: false, issues: ['Environment validation failed'], recommendations: ['Check environment service'] };
    }
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