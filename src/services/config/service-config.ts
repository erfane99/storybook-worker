// Centralized configuration system for all services
import { environmentManager } from '../../lib/config/environment.js';

export interface ServiceTimeouts {
  database: number;
  openai: number;
  imageGeneration: number;
  storyGeneration: number;
  sceneGeneration: number;
  cartoonize: number;
  storage: number;
  auth: number;
}

export interface ServiceRetryConfig {
  attempts: number;
  delay: number;
  backoffMultiplier: number;
  maxDelay: number;
}

export interface ServiceLimits {
  maxConcurrentJobs: number;
  maxFileSize: number;
  rateLimitRpm: number;
  circuitBreakerThreshold: number;
}

export interface ServiceConfiguration {
  timeouts: ServiceTimeouts;
  retries: Record<string, ServiceRetryConfig>;
  limits: ServiceLimits;
  features: {
    caching: boolean;
    metrics: boolean;
    circuitBreaker: boolean;
    rateLimiting: boolean;
  };
}

export class ServiceConfigManager {
  private config: ServiceConfiguration;

  constructor() {
    this.config = this.loadConfiguration();
  }

  private loadConfiguration(): ServiceConfiguration {
    const isDevelopment = environmentManager.getConfig().isDevelopment;
    
    return {
      timeouts: {
        database: Number(process.env.DATABASE_TIMEOUT) || 30000,
        openai: Number(process.env.OPENAI_TIMEOUT) || 120000,
        imageGeneration: Number(process.env.IMAGE_GENERATION_TIMEOUT) || 180000,
        storyGeneration: Number(process.env.STORY_GENERATION_TIMEOUT) || 90000,
        sceneGeneration: Number(process.env.SCENE_GENERATION_TIMEOUT) || 120000,
        cartoonize: Number(process.env.CARTOONIZE_TIMEOUT) || 150000,
        storage: Number(process.env.STORAGE_TIMEOUT) || 60000,
        auth: Number(process.env.AUTH_TIMEOUT) || 10000,
      },
      retries: {
        database: {
          attempts: Number(process.env.DATABASE_RETRY_ATTEMPTS) || 3,
          delay: Number(process.env.DATABASE_RETRY_DELAY) || 1000,
          backoffMultiplier: 2,
          maxDelay: 10000,
        },
        openai: {
          attempts: Number(process.env.OPENAI_RETRY_ATTEMPTS) || 3,
          delay: Number(process.env.OPENAI_RETRY_DELAY) || 2000,
          backoffMultiplier: 2,
          maxDelay: 30000,
        },
        storage: {
          attempts: Number(process.env.STORAGE_RETRY_ATTEMPTS) || 3,
          delay: Number(process.env.STORAGE_RETRY_DELAY) || 2000,
          backoffMultiplier: 2,
          maxDelay: 20000,
        },
      },
      limits: {
        maxConcurrentJobs: Number(process.env.MAX_CONCURRENT_JOBS) || 5,
        maxFileSize: Number(process.env.MAX_FILE_SIZE) || (10 * 1024 * 1024), // 10MB
        rateLimitRpm: Number(process.env.RATE_LIMIT_RPM) || 60,
        circuitBreakerThreshold: Number(process.env.CIRCUIT_BREAKER_THRESHOLD) || 5,
      },
      features: {
        caching: process.env.ENABLE_CACHING !== 'false',
        metrics: process.env.ENABLE_METRICS !== 'false',
        circuitBreaker: process.env.ENABLE_CIRCUIT_BREAKER !== 'false',
        rateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
      },
    };
  }

  getName(): string {
    return 'ServiceConfigManager';
  }

  isHealthy(): boolean {
    return true;
  }

  getConfiguration(): ServiceConfiguration {
    return this.config;
  }

  getServiceTimeout(serviceName: keyof ServiceTimeouts): number {
    return this.config.timeouts[serviceName];
  }

  getServiceRetryConfig(serviceName: string): ServiceRetryConfig {
    return this.config.retries[serviceName] || this.config.retries.database;
  }

  getServiceLimits(): ServiceLimits {
    return this.config.limits;
  }

  isFeatureEnabled(feature: keyof ServiceConfiguration['features']): boolean {
    return this.config.features[feature];
  }

  // ===== STANDARD CONFIGURATION METHODS =====

  /**
   * Get current environment (development, staging, production)
   */
  getEnvironment(): string {
    return process.env.NODE_ENV || 'development';
  }

  /**
   * Get configured log level
   */
  getLogLevel(): string {
    return process.env.LOG_LEVEL || 'info';
  }

  /**
   * Check if running in development mode
   */
  isDevelopmentMode(): boolean {
    return this.getEnvironment() === 'development';
  }

  /**
   * Check if running in production mode
   */
  isProductionMode(): boolean {
    return this.getEnvironment() === 'production';
  }

  /**
   * Get application version
   */
  getApplicationVersion(): string {
    return process.env.APP_VERSION || '1.0.0';
  }

  // ===== VALIDATION AND LOGGING =====

  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate timeouts
    Object.entries(this.config.timeouts).forEach(([service, timeout]) => {
      if (timeout <= 0) {
        errors.push(`Invalid timeout for ${service}: ${timeout}`);
      }
    });

    // Validate retry configurations
    Object.entries(this.config.retries).forEach(([service, retryConfig]) => {
      if (retryConfig.attempts <= 0) {
        errors.push(`Invalid retry attempts for ${service}: ${retryConfig.attempts}`);
      }
      if (retryConfig.delay <= 0) {
        errors.push(`Invalid retry delay for ${service}: ${retryConfig.delay}`);
      }
    });

    // Validate limits
    if (this.config.limits.maxConcurrentJobs <= 0) {
      errors.push(`Invalid max concurrent jobs: ${this.config.limits.maxConcurrentJobs}`);
    }

    // Validate environment
    const validEnvironments = ['development', 'staging', 'production'];
    if (!validEnvironments.includes(this.getEnvironment())) {
      errors.push(`Invalid environment: ${this.getEnvironment()}`);
    }

    // Validate log level
    const validLogLevels = ['error', 'warn', 'info', 'debug'];
    if (!validLogLevels.includes(this.getLogLevel())) {
      errors.push(`Invalid log level: ${this.getLogLevel()}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  logConfiguration(): void {
    console.log('\n🔧 Service Configuration:');
    console.log('📊 Environment:', this.getEnvironment());
    console.log('📝 Log Level:', this.getLogLevel());
    console.log('🏷️ Version:', this.getApplicationVersion());
    console.log('📊 Timeouts:', this.config.timeouts);
    console.log('🔄 Retry Configs:', this.config.retries);
    console.log('📏 Limits:', this.config.limits);
    console.log('🎛️ Features:', this.config.features);

    const validation = this.validateConfiguration();
    if (!validation.valid) {
      console.warn('⚠️ Configuration validation errors:');
      validation.errors.forEach(error => console.warn(`   - ${error}`));
    } else {
      console.log('✅ Configuration validation passed');
    }
  }

  // ===== CONFIGURATION SUMMARY =====

  getConfigurationSummary() {
    return {
      environment: this.getEnvironment(),
      logLevel: this.getLogLevel(),
      version: this.getApplicationVersion(),
      isDevelopment: this.isDevelopmentMode(),
      isProduction: this.isProductionMode(),
      serviceCount: Object.keys(this.config.timeouts).length,
      featuresEnabled: Object.values(this.config.features).filter(Boolean).length,
      validation: this.validateConfiguration(),
    };
  }
}

// Export singleton instance
export const serviceConfig = new ServiceConfigManager();
export default serviceConfig;