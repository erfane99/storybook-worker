// Subscription Configuration Service - Production Implementation
// Environment-based configuration management with validation and hot-reloading

import { EnhancedBaseService } from '../base/enhanced-base-service.js';
import { 
  IServiceHealth,
  IServiceMetrics,
  IServiceLifecycle,
  ServiceConfig,
  RetryConfig
} from '../interfaces/service-contracts.js';
import { 
  Result,
  ConfigurationError,
  EnvironmentVariableError,
  ErrorFactory
} from '../errors/index.js';

// ===== CONFIGURATION INTERFACES =====

export interface SubscriptionTierConfig {
  free: number;
  basic: number;
  premium: number;
  pro: number;
  admin: number;
}

export interface SubscriptionConfigOptions {
  enableHotReload: boolean;
  validationStrict: boolean;
  reloadInterval: number;
  logConfigChanges: boolean;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  correctedValues: Partial<SubscriptionTierConfig>;
}

// ===== SUBSCRIPTION CONFIG SERVICE =====

export class SubscriptionConfigService extends EnhancedBaseService implements IServiceHealth, IServiceMetrics, IServiceLifecycle {
  private currentConfig: SubscriptionTierConfig;
  private defaultConfig: SubscriptionTierConfig;
  private options: SubscriptionConfigOptions;
  private configWatchers: Array<(config: SubscriptionTierConfig) => void> = [];
  private reloadInterval?: NodeJS.Timeout;
  private lastConfigHash: string = '';

  constructor(options: Partial<SubscriptionConfigOptions> = {}) {
    const config: ServiceConfig = {
      name: 'SubscriptionConfigService',
      timeout: 10000,
      retryAttempts: 2,
      retryDelay: 1000,
      circuitBreakerThreshold: 3,
    };
    
    super(config);

    // Default subscription limits based on pricing structure
    this.defaultConfig = {
      free: 1,      // 1 storybook limit
      basic: 3,     // 3 storybooks per month ($10/month)
      premium: 10,  // Legacy tier - same as pro
      pro: 10,      // 10 storybooks per month ($18/month)
      admin: -1,    // Unlimited for internal use
    };

    this.options = {
      enableHotReload: true,
      validationStrict: false,
      reloadInterval: 30000, // 30 seconds
      logConfigChanges: true,
      ...options,
    };

    // Load initial configuration
    this.currentConfig = this.loadConfigurationFromEnvironment();
    this.lastConfigHash = this.generateConfigHash(this.currentConfig);
  }

  getName(): string {
    return 'SubscriptionConfigService';
  }

  // ===== LIFECYCLE IMPLEMENTATION =====

  protected async initializeService(): Promise<void> {
    try {
      // Validate initial configuration
      const validation = this.validateConfiguration(this.currentConfig);
      
      if (!validation.valid) {
        if (this.options.validationStrict) {
          throw new ConfigurationError(
            `Invalid subscription configuration: ${validation.errors.join(', ')}`,
            { service: this.getName(), operation: 'initialize' }
          );
        } else {
          this.log('warn', 'Configuration validation warnings:', validation.warnings);
          
          // Apply corrections if available
          if (Object.keys(validation.correctedValues).length > 0) {
            this.currentConfig = { ...this.currentConfig, ...validation.correctedValues };
            this.log('info', 'Applied configuration corrections:', validation.correctedValues);
          }
        }
      }

      // Start hot-reload monitoring if enabled
      if (this.options.enableHotReload) {
        this.startConfigurationMonitoring();
      }

      this.logCurrentConfiguration();
      this.log('info', 'Subscription configuration service initialized successfully');
    } catch (error) {
      this.log('error', 'Failed to initialize subscription configuration service', error);
      throw error;
    }
  }

  protected async disposeService(): Promise<void> {
    try {
      if (this.reloadInterval) {
        clearInterval(this.reloadInterval);
        this.reloadInterval = undefined;
      }
      
      this.configWatchers.length = 0;
      this.log('info', 'Subscription configuration service disposed successfully');
    } catch (error) {
      this.log('error', 'Error during subscription configuration service disposal', error);
      throw error;
    }
  }

  protected async checkServiceHealth(): Promise<boolean> {
    try {
      // Validate current configuration
      const validation = this.validateConfiguration(this.currentConfig);
      
      // Check if all tier limits are valid
      const hasValidLimits = Object.values(this.currentConfig).every(limit => 
        typeof limit === 'number' && (limit > 0 || limit === -1)
      );

      // Service is healthy if configuration is valid or warnings only
      return validation.valid || (validation.errors.length === 0 && hasValidLimits);
    } catch (error) {
      this.log('error', 'Configuration service health check failed', error);
      return false;
    }
  }

  // ===== CONFIGURATION ACCESS METHODS =====

  /**
   * Get current subscription tier configuration
   */
  getSubscriptionLimits(): SubscriptionTierConfig {
    return { ...this.currentConfig };
  }

  /**
   * Get limit for specific tier
   */
  getTierLimit(tier: keyof SubscriptionTierConfig): number {
    const limit = this.currentConfig[tier];
    if (limit === undefined) {
      this.log('warn', `Unknown tier: ${tier}, returning free tier limit`);
      return this.currentConfig.free;
    }
    return limit;
  }

  /**
   * Get configuration with Result pattern
   */
  getSubscriptionLimitsResult(): Result<SubscriptionTierConfig, never> {
    return Result.success(this.getSubscriptionLimits());
  }

  /**
   * Update configuration programmatically
   */
  updateConfiguration(newConfig: Partial<SubscriptionTierConfig>): Result<SubscriptionTierConfig, ConfigurationError> {
    try {
      const updatedConfig = { ...this.currentConfig, ...newConfig };
      
      // Validate new configuration
      const validation = this.validateConfiguration(updatedConfig);
      
      if (!validation.valid && this.options.validationStrict) {
        const error = new ConfigurationError(
          `Invalid configuration update: ${validation.errors.join(', ')}`,
          { service: this.getName(), operation: 'updateConfiguration' }
        );
        return Result.failure(error);
      }

      // Apply corrections if needed
      const finalConfig = validation.correctedValues 
        ? { ...updatedConfig, ...validation.correctedValues }
        : updatedConfig;

      const oldConfig = { ...this.currentConfig };
      this.currentConfig = finalConfig;

      // Notify watchers
      this.notifyConfigurationChange(oldConfig, finalConfig);

      if (this.options.logConfigChanges) {
        this.log('info', 'Configuration updated programmatically:', {
          old: oldConfig,
          new: finalConfig,
          changes: newConfig,
        });
      }

      return Result.success(finalConfig);
    } catch (error: any) {
      const configError = new ConfigurationError(
        `Failed to update configuration: ${error.message}`,
        { service: this.getName(), operation: 'updateConfiguration' }
      );
      return Result.failure(configError);
    }
  }

  /**
   * Reload configuration from environment
   */
  async reloadConfiguration(): Promise<Result<SubscriptionTierConfig, ConfigurationError>> {
    try {
      const newConfig = this.loadConfigurationFromEnvironment();
      const newHash = this.generateConfigHash(newConfig);

      // Check if configuration actually changed
      if (newHash === this.lastConfigHash) {
        return Result.success(this.currentConfig);
      }

      const oldConfig = { ...this.currentConfig };
      this.currentConfig = newConfig;
      this.lastConfigHash = newHash;

      // Validate new configuration
      const validation = this.validateConfiguration(newConfig);
      if (!validation.valid) {
        this.log('warn', 'Reloaded configuration has validation issues:', validation.warnings);
      }

      // Notify watchers
      this.notifyConfigurationChange(oldConfig, newConfig);

      if (this.options.logConfigChanges) {
        this.log('info', 'Configuration reloaded from environment:', {
          old: oldConfig,
          new: newConfig,
        });
      }

      return Result.success(newConfig);
    } catch (error: any) {
      const configError = new ConfigurationError(
        `Failed to reload configuration: ${error.message}`,
        { service: this.getName(), operation: 'reloadConfiguration' }
      );
      return Result.failure(configError);
    }
  }

  /**
   * Register configuration change watcher
   */
  onConfigurationChange(callback: (config: SubscriptionTierConfig) => void): () => void {
    this.configWatchers.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.configWatchers.indexOf(callback);
      if (index > -1) {
        this.configWatchers.splice(index, 1);
      }
    };
  }

  // ===== VALIDATION METHODS =====

  /**
   * Validate subscription configuration
   */
  validateConfiguration(config: SubscriptionTierConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const correctedValues: Partial<SubscriptionTierConfig> = {};

    // Validate each tier limit
    Object.entries(config).forEach(([tier, limit]) => {
      if (typeof limit !== 'number') {
        errors.push(`${tier} limit must be a number, got ${typeof limit}`);
        correctedValues[tier as keyof SubscriptionTierConfig] = this.defaultConfig[tier as keyof SubscriptionTierConfig];
      } else if (limit < -1) {
        errors.push(`${tier} limit cannot be less than -1 (unlimited), got ${limit}`);
        correctedValues[tier as keyof SubscriptionTierConfig] = this.defaultConfig[tier as keyof SubscriptionTierConfig];
      } else if (limit === 0) {
        warnings.push(`${tier} limit is 0, which blocks all content creation`);
      } else if (limit > 1000 && limit !== -1) {
        warnings.push(`${tier} limit is very high (${limit}), consider if this is intentional`);
      }
    });

    // Validate tier progression (basic should be >= free, pro should be >= basic, etc.)
    if (config.basic < config.free && config.basic !== -1) {
      warnings.push(`Basic tier limit (${config.basic}) is less than free tier (${config.free})`);
    }

    if (config.pro < config.basic && config.pro !== -1 && config.basic !== -1) {
      warnings.push(`Pro tier limit (${config.pro}) is less than basic tier (${config.basic})`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      correctedValues,
    };
  }

  /**
   * Get configuration validation status
   */
  getValidationStatus(): Result<ConfigValidationResult, never> {
    const validation = this.validateConfiguration(this.currentConfig);
    return Result.success(validation);
  }

  // ===== PRIVATE HELPER METHODS =====

  private loadConfigurationFromEnvironment(): SubscriptionTierConfig {
    const config: SubscriptionTierConfig = {
      free: this.parseEnvNumber('SUBSCRIPTION_LIMIT_FREE', this.defaultConfig.free),
      basic: this.parseEnvNumber('SUBSCRIPTION_LIMIT_BASIC', this.defaultConfig.basic),
      premium: this.parseEnvNumber('SUBSCRIPTION_LIMIT_PREMIUM', this.defaultConfig.premium),
      pro: this.parseEnvNumber('SUBSCRIPTION_LIMIT_PRO', this.defaultConfig.pro),
      admin: this.parseEnvNumber('SUBSCRIPTION_LIMIT_ADMIN', this.defaultConfig.admin),
    };

    return config;
  }

  private parseEnvNumber(envVar: string, defaultValue: number): number {
    const value = process.env[envVar];
    
    if (!value) {
      return defaultValue;
    }

    const parsed = Number(value);
    
    if (isNaN(parsed)) {
      this.log('warn', `Invalid number in ${envVar}: "${value}", using default: ${defaultValue}`);
      return defaultValue;
    }

    return parsed;
  }

  private generateConfigHash(config: SubscriptionTierConfig): string {
    return JSON.stringify(config);
  }

  private startConfigurationMonitoring(): void {
    this.reloadInterval = setInterval(async () => {
      try {
        await this.reloadConfiguration();
      } catch (error) {
        this.log('error', 'Error during configuration reload:', error);
      }
    }, this.options.reloadInterval);

    this.log('info', `Configuration hot-reload enabled (interval: ${this.options.reloadInterval}ms)`);
  }

  private notifyConfigurationChange(oldConfig: SubscriptionTierConfig, newConfig: SubscriptionTierConfig): void {
    this.configWatchers.forEach(callback => {
      try {
        callback(newConfig);
      } catch (error) {
        this.log('error', 'Error in configuration change callback:', error);
      }
    });
  }

  private logCurrentConfiguration(): void {
    this.log('info', 'Current subscription configuration:', {
      limits: this.currentConfig,
      source: 'environment_variables',
      hotReload: this.options.enableHotReload,
      validation: this.options.validationStrict ? 'strict' : 'lenient',
    });

    // Log which values are using defaults
    const usingDefaults: string[] = [];
    Object.entries(this.currentConfig).forEach(([tier, limit]) => {
      if (limit === this.defaultConfig[tier as keyof SubscriptionTierConfig]) {
        const envVar = `SUBSCRIPTION_LIMIT_${tier.toUpperCase()}`;
        if (!process.env[envVar]) {
          usingDefaults.push(`${tier} (${envVar})`);
        }
      }
    });

    if (usingDefaults.length > 0) {
      this.log('info', `Using default values for: ${usingDefaults.join(', ')}`);
    }
  }

  // ===== CONFIGURATION UTILITIES =====

  /**
   * Get configuration summary for monitoring
   */
  getConfigurationSummary(): {
    current: SubscriptionTierConfig;
    defaults: SubscriptionTierConfig;
    validation: ConfigValidationResult;
    options: SubscriptionConfigOptions;
    environmentVariables: Record<string, string | undefined>;
  } {
    return {
      current: this.getSubscriptionLimits(),
      defaults: { ...this.defaultConfig },
      validation: this.validateConfiguration(this.currentConfig),
      options: { ...this.options },
      environmentVariables: {
        SUBSCRIPTION_LIMIT_FREE: process.env.SUBSCRIPTION_LIMIT_FREE,
        SUBSCRIPTION_LIMIT_BASIC: process.env.SUBSCRIPTION_LIMIT_BASIC,
        SUBSCRIPTION_LIMIT_PREMIUM: process.env.SUBSCRIPTION_LIMIT_PREMIUM,
        SUBSCRIPTION_LIMIT_PRO: process.env.SUBSCRIPTION_LIMIT_PRO,
        SUBSCRIPTION_LIMIT_ADMIN: process.env.SUBSCRIPTION_LIMIT_ADMIN,
      },
    };
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults(): Result<SubscriptionTierConfig, never> {
    const oldConfig = { ...this.currentConfig };
    this.currentConfig = { ...this.defaultConfig };

    this.notifyConfigurationChange(oldConfig, this.currentConfig);

    if (this.options.logConfigChanges) {
      this.log('info', 'Configuration reset to defaults:', {
        old: oldConfig,
        new: this.currentConfig,
      });
    }

    return Result.success(this.currentConfig);
  }

  /**
   * Check if configuration has been modified from defaults
   */
  isUsingDefaults(): boolean {
    return JSON.stringify(this.currentConfig) === JSON.stringify(this.defaultConfig);
  }

  /**
   * Get configuration differences from defaults
   */
  getConfigurationDifferences(): Record<string, { current: number; default: number }> {
    const differences: Record<string, { current: number; default: number }> = {};

    Object.entries(this.currentConfig).forEach(([tier, currentValue]) => {
      const defaultValue = this.defaultConfig[tier as keyof SubscriptionTierConfig];
      if (currentValue !== defaultValue) {
        differences[tier] = {
          current: currentValue,
          default: defaultValue,
        };
      }
    });

    return differences;
  }
}

// ===== EXPORT SINGLETON INSTANCE =====

export const subscriptionConfigService = new SubscriptionConfigService();
export default subscriptionConfigService;