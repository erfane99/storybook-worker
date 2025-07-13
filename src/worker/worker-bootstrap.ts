// Worker Bootstrap - Service Preloading and Validation
// Ensures all critical services are ready before job processing begins

import { serviceContainer } from '../services/container/service-container.js';
import { ServiceRegistry } from '../services/registry/service-registry.js';
import { SERVICE_TOKENS } from '../services/interfaces/service-contracts.js';
import { environmentManager } from '../lib/config/environment.js';

// Critical services required for job processing
const CRITICAL_SERVICES = [
  SERVICE_TOKENS.CONFIG,
  SERVICE_TOKENS.DATABASE,
  SERVICE_TOKENS.AI,
  SERVICE_TOKENS.JOB,
  SERVICE_TOKENS.AUTH,
  SERVICE_TOKENS.STORAGE,
];

export interface WorkerBootstrapResult {
  success: boolean;
  readyServices: string[];
  failedServices: string[];
  errors: string[];
  warnings: string[];
  environment: {
    configured: boolean;
    degradedMode: boolean;
    missingServices: string[];
  };
}

export class WorkerBootstrap {
  private static instance: WorkerBootstrap | null = null;
  private bootstrapped = false;

  private constructor() {}

  static getInstance(): WorkerBootstrap {
    if (!WorkerBootstrap.instance) {
      WorkerBootstrap.instance = new WorkerBootstrap();
    }
    return WorkerBootstrap.instance;
  }

  /**
   * Bootstrap worker environment with service preloading and validation
   */
  async bootstrap(): Promise<WorkerBootstrapResult> {
    if (this.bootstrapped) {
      console.log('⚠️ Worker already bootstrapped, skipping...');
      return this.getBootstrapStatus();
    }

    console.log('🚀 Starting worker bootstrap process...');
    
    const result: WorkerBootstrapResult = {
      success: false,
      readyServices: [],
      failedServices: [],
      errors: [],
      warnings: [],
      environment: {
        configured: false,
        degradedMode: false,
        missingServices: [],
      },
    };

    try {
      // Phase 1: Environment Validation
      console.log('📋 Phase 1: Environment validation...');
      await this.validateEnvironment(result);

      // Phase 2: Service Registration
      console.log('📋 Phase 2: Service registration...');
      await this.registerServices(result);

      // Phase 3: Critical Service Preloading
      console.log('📋 Phase 3: Critical service preloading...');
      await this.preloadCriticalServices(result);

      // Phase 4: Service Readiness Validation
      console.log('📋 Phase 4: Service readiness validation...');
      await this.validateServiceReadiness(result);

      // Phase 5: Final Validation
      console.log('📋 Phase 5: Final validation...');
      this.performFinalValidation(result);

      this.bootstrapped = result.success;
      
      if (result.success) {
        console.log('✅ Worker bootstrap completed successfully');
      } else {
        console.error('❌ Worker bootstrap failed');
      }

      return result;

    } catch (error: any) {
      console.error('💥 Critical error during worker bootstrap:', error);
      result.errors.push(`Bootstrap critical error: ${error.message}`);
      result.success = false;
      return result;
    }
  }

  /**
   * Get current bootstrap status
   */
  getBootstrapStatus(): WorkerBootstrapResult {
    if (!this.bootstrapped) {
      return {
        success: false,
        readyServices: [],
        failedServices: [],
        errors: ['Worker not yet bootstrapped'],
        warnings: [],
        environment: {
          configured: false,
          degradedMode: false,
          missingServices: [],
        },
      };
    }

    // Get current service status
    const readyServices: string[] = [];
    const failedServices: string[] = [];

    for (const serviceToken of CRITICAL_SERVICES) {
      try {
        const service = serviceContainer.resolveSync(serviceToken);
        if (service) {
          readyServices.push(serviceToken);
        } else {
          failedServices.push(serviceToken);
        }
      } catch (error) {
        failedServices.push(serviceToken);
      }
    }

    return {
      success: failedServices.length === 0,
      readyServices,
      failedServices,
      errors: [],
      warnings: [],
      environment: {
        configured: true,
        degradedMode: failedServices.length > 0,
        missingServices: failedServices,
      },
    };
  }

  /**
   * Validate environment configuration
   */
  private async validateEnvironment(result: WorkerBootstrapResult): Promise<void> {
    try {
      const envStatus = environmentManager.getEnvironmentStatus();
      
      result.environment.configured = envStatus.environment.fullyConfigured;
      result.environment.degradedMode = envStatus.environment.degradedMode;

      if (!envStatus.environment.fullyConfigured) {
        result.warnings.push('Environment not fully configured - some services may be unavailable');
        
        // Check which services are missing configuration
        Object.entries(envStatus.services).forEach(([serviceName, serviceStatus]) => {
          if (!serviceStatus.configured) {
            result.environment.missingServices.push(serviceName);
            result.warnings.push(`${serviceName} service not configured: ${serviceStatus.message}`);
          }
        });
      }

      console.log(`📊 Environment status: ${envStatus.environment.fullyConfigured ? 'CONFIGURED' : 'DEGRADED'}`);
      
    } catch (error: any) {
      result.errors.push(`Environment validation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Register all services
   */
  private async registerServices(result: WorkerBootstrapResult): Promise<void> {
    try {
      console.log('📝 Registering services...');
      ServiceRegistry.registerServices();
      console.log('✅ Service registration completed');
    } catch (error: any) {
      result.errors.push(`Service registration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Preload critical services
   */
  private async preloadCriticalServices(result: WorkerBootstrapResult): Promise<void> {
    try {
      console.log('🔧 Preloading critical services...');
      await serviceContainer.preloadCriticalServices(CRITICAL_SERVICES);
      console.log('✅ Critical services preloaded');
    } catch (error: any) {
      result.errors.push(`Critical service preloading failed: ${error.message}`);
      
      // Try to identify which services failed
      for (const serviceToken of CRITICAL_SERVICES) {
        try {
          await serviceContainer.resolve(serviceToken);
          result.readyServices.push(serviceToken);
        } catch (serviceError: any) {
          result.failedServices.push(serviceToken);
          result.errors.push(`${serviceToken}: ${serviceError.message}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Validate service readiness
   */
  private async validateServiceReadiness(result: WorkerBootstrapResult): Promise<void> {
    try {
      console.log('🔍 Validating service readiness...');
      
      const readinessResult = await serviceContainer.validateServiceReadiness(CRITICAL_SERVICES);
      
      Object.entries(readinessResult.services).forEach(([serviceToken, status]) => {
        if (status.available && status.healthy) {
          result.readyServices.push(serviceToken);
        } else {
          result.failedServices.push(serviceToken);
          const reason = status.error || `available=${status.available}, healthy=${status.healthy}`;
          result.errors.push(`${serviceToken}: ${reason}`);
        }
      });

      if (!readinessResult.ready) {
        throw new Error(`Service readiness validation failed: ${result.failedServices.length} services not ready`);
      }

      console.log('✅ Service readiness validation passed');
      
    } catch (error: any) {
      result.errors.push(`Service readiness validation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Perform final validation
   */
  private performFinalValidation(result: WorkerBootstrapResult): void {
    // Check if we have minimum required services
    const requiredServices = [SERVICE_TOKENS.DATABASE, SERVICE_TOKENS.JOB];
    const missingRequired = requiredServices.filter(service => !result.readyServices.includes(service));

    if (missingRequired.length > 0) {
      result.errors.push(`Missing required services: ${missingRequired.join(', ')}`);
      result.success = false;
      return;
    }

    // Check if we have any critical errors
    if (result.errors.length > 0) {
      result.success = false;
      return;
    }

    // Success if we have required services and no critical errors
    result.success = true;
  }

  /**
   * Get detailed service debug information
   */
  getServiceDebugInfo(): Record<string, any> {
    const debugInfo: Record<string, any> = {};

    for (const serviceToken of CRITICAL_SERVICES) {
      debugInfo[serviceToken] = serviceContainer.getServiceDebugInfo(serviceToken);
    }

    return debugInfo;
  }

  /**
   * Reset bootstrap state (for testing)
   */
  reset(): void {
    this.bootstrapped = false;
  }
}

// Export singleton instance
export const workerBootstrap = WorkerBootstrap.getInstance();
export default workerBootstrap;