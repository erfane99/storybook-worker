// Service Container implementation with dependency injection and lifecycle management
import { 
  IServiceContainer, 
  IBaseService,
  ServiceFactory, 
  ServiceOptions, 
  ServiceHealthReport, 
  ServiceHealthStatus 
} from '../interfaces/service-interfaces.js';

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

  constructor() {
    this.startHealthMonitoring();
  }

  /**
   * Register a service with the container
   */
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

  /**
   * Resolve a service instance (async)
   */
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

  /**
   * Resolve a service instance synchronously (for already initialized services)
   */
  resolveSync<T>(token: string): T | null {
    if (this.disposed) {
      return null;
    }

    const registration = this.services.get(token);
    if (!registration || !registration.options.singleton || !registration.instance) {
      return null;
    }

    return registration.instance;
  }

  /**
   * Check if a service is registered
   */
  isRegistered(token: string): boolean {
    return this.services.has(token);
  }

  /**
   * Get aggregated health status of all services
   */
  async getHealth(): Promise<ServiceHealthReport> {
    const serviceStatuses: Record<string, ServiceHealthStatus> = {};
    let healthyCount = 0;
    let totalCount = 0;

    for (const [token, registration] of this.services.entries()) {
      if (!registration.options.healthCheck) {
        continue;
      }

      totalCount++;
      
      try {
        const status = await this.checkServiceHealth(token, registration);
        serviceStatuses[token] = status;
        
        if (status.status === 'healthy') {
          healthyCount++;
        }
      } catch (error: any) {
        serviceStatuses[token] = {
          status: 'unhealthy',
          message: `Health check failed: ${error.message}`,
          lastCheck: new Date().toISOString(),
          dependencies: registration.dependencies,
        };
      }
    }

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalCount) {
      overall = 'healthy';
    } else if (healthyCount > totalCount / 2) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    return {
      overall,
      services: serviceStatuses,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Dispose the container and all services
   */
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
      if (registration.instance && typeof registration.instance.dispose === 'function') {
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

  /**
   * Get container statistics
   */
  getStats() {
    const stats = {
      totalServices: this.services.size,
      initializedServices: 0,
      singletonServices: 0,
      lazyServices: 0,
      servicesWithHealthCheck: 0,
      disposed: this.disposed,
    };

    for (const registration of this.services.values()) {
      if (registration.initialized) stats.initializedServices++;
      if (registration.options.singleton) stats.singletonServices++;
      if (registration.options.lazy) stats.lazyServices++;
      if (registration.options.healthCheck) stats.servicesWithHealthCheck++;
    }

    return stats;
  }

  // Private methods
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
      
      // Initialize the service if it implements IBaseService
      if (instance && typeof (instance as any).initialize === 'function') {
        await (instance as any).initialize();
        console.log(`🔧 Initialized service: ${token}`);
      }
      
      return instance;
    } catch (error: any) {
      console.error(`❌ Failed to create service ${token}:`, error.message);
      throw new Error(`Failed to create service ${token}: ${error.message}`);
    }
  }

  private async checkServiceHealth(
    token: string, 
    registration: ServiceRegistration<any>
  ): Promise<ServiceHealthStatus> {
    const now = new Date();
    
    // Use cached health status if recent
    if (registration.lastHealthCheck && 
        registration.healthStatus && 
        (now.getTime() - registration.lastHealthCheck.getTime()) < 30000) {
      return registration.healthStatus;
    }

    let status: ServiceHealthStatus;
    
    try {
      if (!registration.initialized || !registration.instance) {
        status = {
          status: 'not_initialized',
          message: 'Service not yet initialized',
          lastCheck: now.toISOString(),
          dependencies: registration.dependencies,
        };
      } else if (typeof registration.instance.isHealthy === 'function') {
        const isHealthy = registration.instance.isHealthy();
        status = {
          status: isHealthy ? 'healthy' : 'unhealthy',
          message: isHealthy ? 'Service is healthy' : 'Service health check failed',
          lastCheck: now.toISOString(),
          dependencies: registration.dependencies,
        };
      } else {
        status = {
          status: 'healthy',
          message: 'Service does not implement health check',
          lastCheck: now.toISOString(),
          dependencies: registration.dependencies,
        };
      }
    } catch (error: any) {
      status = {
        status: 'unhealthy',
        message: `Health check error: ${error.message}`,
        lastCheck: now.toISOString(),
        dependencies: registration.dependencies,
      };
    }

    registration.lastHealthCheck = now;
    registration.healthStatus = status;
    
    return status;
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