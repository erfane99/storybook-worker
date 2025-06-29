// Environment Service - Enterprise Dependency Injection Implementation
// ✅ REFACTORED: Focused only on environment variables, removed service health coupling

import { EnhancedBaseService } from '../base/enhanced-base-service.js';
import { 
  IEnvironmentService,
  ServiceConfig as ServiceConfigInterface,
  EnvironmentConfig,
  EnvironmentServiceInfo
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
      // ✅ ENTERPRISE HEALTH: Only validate environment configuration
      const environmentStatus = this.environmentManager.getEnvironmentStatus();
      
      if (!environmentStatus.environment.fullyConfigured) {
        this.log('warn', 'Environment service initialized with incomplete configuration');
      } else {
        this.log('info', 'Environment service initialized with complete configuration');
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

  // ✅ ENTERPRISE HEALTH: Independent environment service health checking
  protected async checkServiceHealth(): Promise<boolean> {
    try {
      // Check 1: Environment configuration completeness
      const environmentStatus = this.environmentManager.getEnvironmentStatus();
      
      // Check 2: Required environment variables presence
      const openaiInfo = this.environmentManager.getEnvironmentServiceInfo('openai');
      const supabaseInfo = this.environmentManager.getEnvironmentServiceInfo('supabase');
      
      // Environment service is healthy if at least one service is configured
      // (allows for graceful degradation)
      const hasMinimalConfig = openaiInfo.isConfigured || supabaseInfo.isConfigured;
      
      // Check 3: No critical environment issues
      const noCriticalIssues = environmentStatus.environment.mode !== 'unknown';
      
      return hasMinimalConfig && noCriticalIssues;
    } catch (error) {
      this.log('error', 'Environment service health check failed', error);
      return false;
    }
  }

  // ===== ENVIRONMENT SERVICE INTERFACE IMPLEMENTATION =====
  // ✅ REFACTORED: Only environment configuration methods, no service health

  getConfig(): EnvironmentConfig {
    return this.environmentManager.getConfig();
  }

  getEnvironmentServiceInfo(serviceName: 'openai' | 'supabase'): EnvironmentServiceInfo {
    return this.environmentManager.getEnvironmentServiceInfo(serviceName);
  }

  logConfigurationStatus(): void {
    this.environmentManager.logConfigurationStatus();
  }

  getEnvironmentStatus(): {
    environment: {
      mode: string;
      variablesConfigured: string;
      fullyConfigured: boolean;
      degradedMode: boolean;
    };
    services: Record<string, any>;
  } {
    return this.environmentManager.getEnvironmentStatus();
  }

  // ===== ENHANCED METHODS FOR SERVICE CONTAINER =====

  /**
   * Get environment configuration with validation
   */
  getValidatedConfig(): EnvironmentConfig {
    const config = this.getConfig();
    const environmentStatus = this.getEnvironmentStatus();
    
    if (!environmentStatus.environment.fullyConfigured) {
      this.log('warn', 'Environment configuration is not fully configured', {
        mode: environmentStatus.environment.mode,
        variablesConfigured: environmentStatus.environment.variablesConfigured,
        degradedMode: environmentStatus.environment.degradedMode
      });
    }
    
    return config;
  }

  /**
   * Check if environment is ready for production
   */
  isProductionReady(): boolean {
    const config = this.getConfig();
    const environmentStatus = this.getEnvironmentStatus();
    
    return config.isProduction && 
           environmentStatus.environment.fullyConfigured && 
           !environmentStatus.environment.degradedMode;
  }

  /**
   * Get environment variable availability summary
   */
  getEnvironmentVariablesSummary(): {
    openai: { configured: boolean; status: string; message: string };
    supabase: { configured: boolean; status: string; message: string };
    overall: { fullyConfigured: boolean; degradedMode: boolean };
  } {
    const openaiInfo = this.getEnvironmentServiceInfo('openai');
    const supabaseInfo = this.getEnvironmentServiceInfo('supabase');
    const environmentStatus = this.getEnvironmentStatus();
    
    return {
      openai: {
        configured: openaiInfo.isConfigured,
        status: openaiInfo.status,
        message: openaiInfo.message
      },
      supabase: {
        configured: supabaseInfo.isConfigured,
        status: supabaseInfo.status,
        message: supabaseInfo.message
      },
      overall: {
        fullyConfigured: environmentStatus.environment.fullyConfigured,
        degradedMode: environmentStatus.environment.degradedMode
      }
    };
  }

  /**
   * Validate specific service environment configuration
   */
  validateServiceEnvironmentConfiguration(serviceName: 'openai' | 'supabase'): {
    valid: boolean;
    configured: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const serviceInfo = this.getEnvironmentServiceInfo(serviceName);
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    if (!serviceInfo.isConfigured) {
      issues.push(`${serviceName} environment variables are not configured`);
      recommendations.push(`Configure ${serviceName} environment variables`);
    }
    
    if (!serviceInfo.isAvailable) {
      issues.push(`${serviceName} environment variables are not available`);
      if (serviceInfo.status === 'placeholder') {
        recommendations.push(`Replace placeholder values with real ${serviceName} credentials`);
      }
    }
    
    if (serviceInfo.missingVars.length > 0) {
      issues.push(`Missing environment variables: ${serviceInfo.missingVars.join(', ')}`);
      recommendations.push(`Set the following environment variables: ${serviceInfo.missingVars.join(', ')}`);
    }
    
    return {
      valid: serviceInfo.isConfigured && serviceInfo.isAvailable,
      configured: serviceInfo.isConfigured,
      issues,
      recommendations
    };
  }
}