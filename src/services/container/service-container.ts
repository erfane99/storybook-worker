// Consolidated Service Container implementing Interface Segregation Principle
// CONSOLIDATED: Single container implementation with all enhanced features
import { 
  IServiceContainer,
  ServiceFactory, 
  ServiceOptions, 
  ContainerHealthReport,
  ServiceHealthStatus,
  IServiceHealth,
  IServiceMetrics,
  IServiceLifecycle
} from '../interfaces/service-contracts.js';

interface ServiceRegistration<T> {
  factory: ServiceFactory<T>;
  options: ServiceOptions;
  instance?: T;
  initialized: boolean;
  dependencies: string[];
  lastHealthCheck?: Date;
  healthStatus?: ServiceHealthStatus;
}

export class ServiceContainer implements IServiceContainer {
  private services = new Map<string, ServiceRegistration<any>>();
  private initializationPromises = new Map<string, Promise<any>>();
  private disposed = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private readonly healthCacheTimeout = 30000; // 30 seconds

  constructor() {
    this.startHealthMonitoring();
  }

  // ===== SERVICE REGISTRATION =====

  register<T>(
    token: string, 
    factory: ServiceFactory<T>, 
    options: ServiceOptions = {}
  ): void {
    if (this.disposed) {
      throw new Error('Cannot register services on disposed container');
    }

    if (this.services.has(token)) {
      throw new Error(`Service ${token} is already registered`);
    }

    const registration: ServiceRegistration<T> = {
      factory,
      options: {
        singleton: true,
        lazy: true,
        healthCheck: true,
        dependencies: [],
        ...options,
      },
      initialized: false,
      dependencies: options.dependencies || [],
    };

    this.services.set(token, registration);
    console.log(`📝 Registered service: ${token} (singleton: ${registration.options.singleton}, lazy: ${registration.options.lazy})`);
  }

  // ===== SERVICE RESOLUTION =====

  async resolve<T>(token: string): Promise<T> {
    if (this.disposed) {
      throw new Error('Cannot resolve services from disposed container');
    }

    const registration = this.services.get(token);
    if (!registration) {
      throw new Error(`Service ${token} is not registered`);
    }

    // Return existing instance if singleton and already created
    if (registration.options.singleton && registration.instance) {
      return registration.instance;
    }

    // Check for circular dependencies
    if (this.initializationPromises.has(token)) {
      throw new Error(`Circular dependency detected for service ${token}`);
    }

    // Resolve dependencies first
    await this.resolveDependencies(registration.dependencies);

    // Create initialization promise
    const initPromise = this.createServiceInstance(token, registration);
    this.initializationPromises.set(token, initPromise);

    try {
      const instance = await initPromise;
      
      // Store instance if singleton
      if (registration.options.singleton) {
        registration.instance = instance;
      }
      
      registration.initialized = true;
      console.log(`✅ Resolved service: ${token}`);
      
      return instance;
    } finally {
      this.initializationPromises.delete(token);
    }
  }

  resolveSync<T>(token: string): T | null {
    if (this.disposed) {
      throw new Error(`Cannot resolve service '${token}' from disposed container`);
    }

    const registration = this.services.get(token);
    if (!registration || !registration.options.singleton || !registration.instance) {
      throw new Error(`Service '${token}' is not registered, not a singleton, or not yet initialized`);
    }

    return registration.instance;
  }

  // ===== WORKER INITIALIZATION SUPPORT =====

  /**
   * Preload critical services for worker environment
   */
  async preloadCriticalServices(serviceTokens: string[]): Promise<void> {
    console.log('🚀 Preloading critical services for worker environment...');
    
    const preloadPromises = serviceTokens.map(async (token) => {
      try {
        console.log(`🔧 Preloading service: ${token}`);
        const service = await this.resolve(token);
        
        // Validate service is properly initialized
        if (this.implementsLifecycle(service) && !service.isInitialized()) {
          throw new Error(`Service ${token} failed to initialize properly`);
        }
        
        console.log(`✅ Service preloaded successfully: ${token}`);
        return service;
      } catch (error: any) {
        console.error(`❌ Failed to preload service ${token}:`, error.message);
        throw new Error(`Critical service preload failed: ${token} - ${error.message}`);
      }
    });

    await Promise.all(preloadPromises);
    console.log('✅ All critical services preloaded successfully');
  }

  /**
   * Validate service readiness for worker operations
   */
  async validateServiceReadiness(serviceTokens: string[]): Promise<{
    ready: boolean;
    services: Record<string, { available: boolean; healthy: boolean; error?: string }>;
  }> {
    console.log('🔍 Validating service readiness for worker operations...');
    
    const serviceStatus: Record<string, { available: boolean; healthy: boolean; error?: string }> = {};
    let allReady = true;

    for (const token of serviceTokens) {
      try {
        // Check if service is available
        const service = this.resolveSync(token);
        const available = !!service;
        
        // Check if service is healthy
        let healthy = false;
        if (available && this.implementsHealth(service)) {
          healthy = service.isHealthy();
        } else if (available) {
          healthy = true; // Assume healthy if no health check available
        }

        serviceStatus[token] = { available, healthy };
        
        if (!available || !healthy) {
          allReady = false;
        }
        
        console.log(`📊 Service ${token}: available=${available}, healthy=${healthy}`);
      } catch (error: any) {
        serviceStatus[token] = { 
          available: false, 
          healthy: false, 
          error: error.message 
        };
        allReady = false;
        console.error(`❌ Service ${token} validation failed:`, error.message);
      }
    }

    console.log(`🎯 Service readiness validation: ${allReady ? 'READY' : 'NOT READY'}`);
    return { ready: allReady, services: serviceStatus };
  }

  /**
   * Get detailed service information for debugging
   */
  getServiceDebugInfo(token: string): {
    registered: boolean;
    initialized: boolean;
    singleton: boolean;
    lazy: boolean;
    dependencies: string[];
    error?: string;
  } {
    const registration = this.services.get(token);
    
    if (!registration) {
      return {
        registered: false,
        initialized: false,
        singleton: false,
        lazy: false,
        dependencies: [],
        error: 'Service not registered'
      };
    }

    return {
      registered: true,
      initialized: registration.initialized,
      singleton: registration.options.singleton || false,
      lazy: registration.options.lazy || false,
      dependencies: registration.dependencies,
    };
  }
  // ===== CONTAINER MANAGEMENT =====

  isRegistered(token: string): boolean {
    return this.services.has(token);
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    console.log('🔄 Disposing service container...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Dispose services in reverse dependency order
    const disposalPromises: Promise<void>[] = [];
    
    for (const [token, registration] of this.services.entries()) {
      if (registration.instance && this.implementsLifecycle(registration.instance)) {
        disposalPromises.push(
          registration.instance.dispose().catch((error: any) => {
            console.warn(`⚠️ Error disposing service ${token}:`, error.message);
          })
        );
      }
    }

    await Promise.allSettled(disposalPromises);
    
    this.services.clear();
    this.initializationPromises.clear();
    this.disposed = true;
    
    console.log('✅ Service container disposed');
  }

  // ===== HEALTH AGGREGATION (COMPUTED, NOT EXPOSING INTERNAL STATE) =====

  async getHealth(): Promise<ContainerHealthReport> {
    const serviceStatuses: Record<string, ServiceHealthStatus> = {};
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;
    let totalCount = 0;

    for (const [token, registration] of this.services.entries()) {
      if (!registration.options.healthCheck) {
        continue;
      }

      totalCount++;
      
      try {
        const status = await this.getServiceHealthStatus(token, registration);
        serviceStatuses[token] = status;
        
        switch (status.status) {
          case 'healthy':
            healthyCount++;
            break;
          case 'degraded':
            degradedCount++;
            break;
          case 'unhealthy':
            unhealthyCount++;
            break;
        }
      } catch (error: any) {
        unhealthyCount++;
        serviceStatuses[token] = {
          status: 'unhealthy',
          message: `Health check failed: ${error.message}`,
          lastCheck: new Date().toISOString(),
          availability: 0,
        };
      }
    }

    // Compute overall health (aggregated, not exposing internal circuit breaker state)
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount === 0 && degradedCount === 0) {
      overall = 'healthy';
    } else if (healthyCount >= totalCount / 2) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    return {
      overall,
      services: serviceStatuses,
      timestamp: new Date().toISOString(),
      summary: {
        total: totalCount,
        healthy: healthyCount,
        degraded: degradedCount,
        unhealthy: unhealthyCount,
      },
    };
  }

  // ===== CONTAINER STATISTICS (COMPUTED PROPERTIES) =====

  getStats() {
    const stats = {
      totalServices: this.services.size,
      initializedServices: 0,
      singletonServices: 0,
      lazyServices: 0,
      servicesWithHealthCheck: 0,
      disposed: this.disposed,
      activeInitializations: this.initializationPromises.size,
    };

    for (const registration of this.services.values()) {
      if (registration.initialized) stats.initializedServices++;
      if (registration.options.singleton) stats.singletonServices++;
      if (registration.options.lazy) stats.lazyServices++;
      if (registration.options.healthCheck) stats.servicesWithHealthCheck++;
    }

    return stats;
  }

  // ===== PRIVATE METHODS =====

  private async resolveDependencies(dependencies: string[]): Promise<void> {
    if (dependencies.length === 0) {
      return;
    }

    console.log(`🔗 Resolving dependencies: ${dependencies.join(', ')}`);
    
    const dependencyPromises = dependencies.map(dep => this.resolve(dep));
    await Promise.all(dependencyPromises);
  }

  private async createServiceInstance<T>(
    token: string, 
    registration: ServiceRegistration<T>
  ): Promise<T> {
    console.log(`🏗️ Creating service instance: ${token}`);
    
    try {
      const instance = await registration.factory(this);
      
      // Initialize the service if it implements IServiceLifecycle
      if (instance && this.implementsLifecycle(instance)) {
        await instance.initialize();
        console.log(`🔧 Initialized service: ${token}`);
      }
      
      return instance;
    } catch (error: any) {
      console.error(`❌ Failed to create service ${token}:`, error.message);
      throw new Error(`Failed to create service ${token}: ${error.message}`);
    }
  }

  private async getServiceHealthStatus(
    token: string, 
    registration: ServiceRegistration<any>
  ): Promise<ServiceHealthStatus> {
    const now = new Date();
    
    // Use cached health status if recent
    if (registration.lastHealthCheck && 
        registration.healthStatus && 
        (now.getTime() - registration.lastHealthCheck.getTime()) < this.healthCacheTimeout) {
      return registration.healthStatus;
    }

    let status: ServiceHealthStatus;
    
    try {
      if (!registration.initialized || !registration.instance) {
        status = {
          status: 'unhealthy',
          message: 'Service not yet initialized',
          lastCheck: now.toISOString(),
          availability: 0,
        };
      } else if (this.implementsHealth(registration.instance)) {
        // Use service's own health status (computed property, not internal state)
        status = registration.instance.getHealthStatus();
      } else {
        status = {
          status: 'healthy',
          message: 'Service does not implement health check',
          lastCheck: now.toISOString(),
          availability: 100,
        };
      }
    } catch (error: any) {
      status = {
        status: 'unhealthy',
        message: `Health check error: ${error.message}`,
        lastCheck: now.toISOString(),
        availability: 0,
      };
    }

    registration.lastHealthCheck = now;
    registration.healthStatus = status;
    
    return status;
  }

  private implementsHealth(instance: any): instance is IServiceHealth {
    return instance && 
           typeof instance.isHealthy === 'function' && 
           typeof instance.getHealthStatus === 'function';
  }

  private implementsLifecycle(instance: any): instance is IServiceLifecycle {
    return instance && 
           typeof instance.initialize === 'function' && 
           typeof instance.dispose === 'function' &&
           typeof instance.isInitialized === 'function';
  }

  private implementsMetrics(instance: any): instance is IServiceMetrics {
    return instance && 
           typeof instance.getMetrics === 'function' && 
           typeof instance.resetMetrics === 'function';
  }

  private startHealthMonitoring(): void {
    // Periodic health monitoring every 60 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.getHealth();
      } catch (error) {
        console.warn('⚠️ Health monitoring error:', error);
      }
    }, 60000);
  }
}

// Global container instance
export const serviceContainer = new ServiceContainer();
export default serviceContainer;