// Environment Service - Enterprise Dependency Injection Implementation
// Wraps environment manager for proper service container integration

import { EnhancedBaseService } from '../base/enhanced-base-service.js';
import { 
  IEnvironmentService,
  ServiceConfig as ServiceConfigInterface,
  EnvironmentConfig
} from '../interfaces/service-contracts.js';
import { environmentManager } from '../../lib/config/environment.js';

export interface EnvironmentServiceConfig extends ServiceConfigInterface {
  enableHotReload: boolean;
  configValidation: boolean;
}

export class EnvironmentService extends EnhancedBaseService implements IEnvironmentService {
  private environmentManager: typeof environmentManager;

  constructor() {
    const config: EnvironmentServiceConfig = {
      name: 'EnvironmentService',
      timeout: 5000,
      retryAttempts: 1,
      retryDelay: 1000,
      circuitBreakerThreshold: 3,
      enableHotReload: false,
      configValidation: true,
    };
    
    super(config);
    this.environmentManager = environmentManager;
  }

  getName(): string {
    return 'EnvironmentService';
  }

  // ===== LIFECYCLE IMPLEMENTATION =====

  protected async initializeService(): Promise<void> {
    try {
      // Validate environment configuration
      const healthStatus = this.environmentManager.getHealthStatus();
      
      if (healthStatus.overall !== 'healthy') {
        this.log('warn', 'Environment service initialized with degraded configuration');
      } else {
        this.log('info', 'Environment service initialized with full configuration');
      }
      
      // Log configuration status
      this.environmentManager.logConfigurationStatus();
      
    } catch (error) {
      this.log('error', 'Failed to initialize environment service', error);
      throw error;
    }
  }

  protected async disposeService(): Promise<void> {
    // No cleanup needed for environment service
    this.log('info', 'Environment service disposed');
  }

  protected async checkServiceHealth(): Promise<boolean> {
    try {
      const healthStatus = this.environmentManager.getHealthStatus();
      return healthStatus.overall === 'healthy';
    } catch (error) {
      this.log('error', 'Environment service health check failed', error);
      return false;
    }
  }

  // ===== ENVIRONMENT SERVICE INTERFACE IMPLEMENTATION =====

  getConfig(): EnvironmentConfig {
    return this.environmentManager.getConfig();
  }

  isServiceAvailable(serviceName: 'openai' | 'supabase'): boolean {
    return this.environmentManager.isServiceAvailable(serviceName);
  }

  getServiceStatus(serviceName: 'openai' | 'supabase'): ServiceConfigInterface {
    return this.environmentManager.getServiceStatus(serviceName);
  }

  logConfigurationStatus(): void {
    this.environmentManager.logConfigurationStatus();
  }

  getHealthStatus(): {
    overall: string;
    services: Record<string, any>;
    configuration: {
      mode: string;
      servicesAvailable: string;
      fullyConfigured: boolean;
      degradedMode: boolean;
    };
  } {
    return this.environmentManager.getHealthStatus();
  }

  // ===== ENHANCED METHODS FOR SERVICE CONTAINER =====

  /**
   * Get environment configuration with validation
   */
  getValidatedConfig(): EnvironmentConfig {
    const config = this.getConfig();
    const healthStatus = this.getHealthStatus();
    
    if (!healthStatus.configuration.fullyConfigured) {
      this.log('warn', 'Environment configuration is not fully configured', {
        mode: healthStatus.configuration.mode,
        servicesAvailable: healthStatus.configuration.servicesAvailable,
        degradedMode: healthStatus.configuration.degradedMode
      });
    }
    
    return config;
  }

  /**
   * Check if environment is ready for production
   */
  isProductionReady(): boolean {
    const config = this.getConfig();
    const healthStatus = this.getHealthStatus();
    
    return config.isProduction && 
           healthStatus.configuration.fullyConfigured && 
           !healthStatus.configuration.degradedMode;
  }

  /**
   * Get service availability summary
   */
  getServiceAvailabilitySummary(): {
    openai: { available: boolean; status: string; message: string };
    supabase: { available: boolean; status: string; message: string };
    overall: { fullyConfigured: boolean; degradedMode: boolean };
  } {
    const openaiStatus = this.getServiceStatus('openai');
    const supabaseStatus = this.getServiceStatus('supabase');
    const healthStatus = this.getHealthStatus();
    
    return {
      openai: {
        available: openaiStatus.isAvailable,
        status: openaiStatus.status,
        message: openaiStatus.message
      },
      supabase: {
        available: supabaseStatus.isAvailable,
        status: supabaseStatus.status,
        message: supabaseStatus.message
      },
      overall: {
        fullyConfigured: healthStatus.configuration.fullyConfigured,
        degradedMode: healthStatus.configuration.degradedMode
      }
    };
  }

  /**
   * Validate specific service configuration
   */
  validateServiceConfiguration(serviceName: 'openai' | 'supabase'): {
    valid: boolean;
    available: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const serviceStatus = this.getServiceStatus(serviceName);
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    if (!serviceStatus.isConfigured) {
      issues.push(`${serviceName} service is not configured`);
      recommendations.push(`Configure ${serviceName} environment variables`);
    }
    
    if (!serviceStatus.isAvailable) {
      issues.push(`${serviceName} service is not available`);
      if (serviceStatus.status === 'placeholder') {
        recommendations.push(`Replace placeholder values with real ${serviceName} credentials`);
      }
    }
    
    if (serviceStatus.missingVars.length > 0) {
      issues.push(`Missing environment variables: ${serviceStatus.missingVars.join(', ')}`);
      recommendations.push(`Set the following environment variables: ${serviceStatus.missingVars.join(', ')}`);
    }
    
    return {
      valid: serviceStatus.isConfigured && serviceStatus.isAvailable,
      available: serviceStatus.isAvailable,
      issues,
      recommendations
    };
  }
}