// Enhanced Subscription Service - Production Implementation
// Updated to use SubscriptionConfigService for environment-based configuration

import { ErrorAwareBaseService, ErrorAwareServiceConfig } from '../base/error-aware-base-service.js';
import { 
  ISubscriptionService,
  IServiceHealth,
  IServiceMetrics,
  IServiceLifecycle,
  ServiceConfig,
  RetryConfig,
  UserTier,
  SubscriptionLimits,
  LimitCheckResult,
  UserSubscriptionData
} from '../interfaces/service-contracts.js';
import { 
  Result,
  AsyncResult,
  DatabaseConnectionError,
  DatabaseQueryError,
  JobValidationError,
  ConfigurationError,
  ErrorFactory,
  ErrorCategory
} from '../errors/index.js';
import { enhancedServiceContainer } from '../container/enhanced-service-container.js';
import { SERVICE_TOKENS, IDatabaseService } from '../interfaces/service-contracts.js';
import { SubscriptionConfigService } from '../config/subscription-config.js';

// ===== SUBSCRIPTION SERVICE CONFIG =====

export interface SubscriptionServiceConfig extends ErrorAwareServiceConfig {
  cacheTimeout: number;
  usageCountTimeout: number;
  enableConfigHotReload: boolean;
}

// ===== SUBSCRIPTION SERVICE IMPLEMENTATION =====

export class SubscriptionService extends ErrorAwareBaseService implements ISubscriptionService {
  private configService: SubscriptionConfigService;
  private userCache: Map<string, { data: UserSubscriptionData; timestamp: number }> = new Map();
  private configUnsubscribe?: () => void;
  private readonly defaultRetryConfig: RetryConfig = {
    attempts: 3,
    delay: 1000,
    backoffMultiplier: 2,
    maxDelay: 10000,
  };

  constructor(config?: Partial<SubscriptionServiceConfig>) {
    const defaultConfig: SubscriptionServiceConfig = {
      name: 'SubscriptionService',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      circuitBreakerThreshold: 5,
      cacheTimeout: 300000, // 5 minutes
      usageCountTimeout: 60000, // 1 minute for usage counts
      enableConfigHotReload: true,
      errorHandling: {
        enableRetry: true,
        maxRetries: 3,
        enableCircuitBreaker: true,
        enableCorrelation: true,
        enableMetrics: true,
        retryableCategories: [
          ErrorCategory.NETWORK,
          ErrorCategory.TIMEOUT,
          ErrorCategory.EXTERNAL_SERVICE
        ]
      }
    };
    
    const finalConfig = { ...defaultConfig, ...config };
    super(finalConfig);
    
    // Initialize configuration service
    this.configService = new SubscriptionConfigService({
      enableHotReload: finalConfig.enableConfigHotReload,
      validationStrict: false, // Allow graceful degradation
      reloadInterval: 30000, // 30 seconds
      logConfigChanges: true,
    });
  }

  getName(): string {
    return 'SubscriptionService';
  }

  // ===== LIFECYCLE IMPLEMENTATION =====

  protected async initializeService(): Promise<void> {
    try {
      // Initialize configuration service first
      await this.configService.initialize();

      // Set up configuration change monitoring
      if ((this.config as SubscriptionServiceConfig).enableConfigHotReload) {
        this.configUnsubscribe = this.configService.onConfigurationChange((newConfig) => {
          this.handleConfigurationChange(newConfig);
        });
      }

      // Validate that we can access the database service
      const databaseService = await enhancedServiceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);
      if (!databaseService) {
        throw new Error('DatabaseService not available for subscription checks');
      }

      // Log current configuration
      const currentLimits = this.configService.getSubscriptionLimits();
      this.log('info', 'Subscription limits loaded from configuration:', currentLimits);
      
      this.log('info', 'Subscription service initialized successfully');
    } catch (error) {
      this.log('error', 'Failed to initialize subscription service', error);
      throw error;
    }
  }

  protected async disposeService(): Promise<void> {
    try {
      // Unsubscribe from configuration changes
      if (this.configUnsubscribe) {
        this.configUnsubscribe();
        this.configUnsubscribe = undefined;
      }

      // Dispose configuration service
      await this.configService.dispose();

      // Clear cache
      this.userCache.clear();
      
      this.log('info', 'Subscription service disposed successfully');
    } catch (error) {
      this.log('error', 'Error during subscription service disposal', error);
      throw error;
    }
  }

  protected async checkServiceHealth(): Promise<boolean> {
    try {
      // Check if we can resolve database service
      const databaseService = enhancedServiceContainer.resolveSync<IDatabaseService>(SERVICE_TOKENS.DATABASE);
      if (!databaseService) {
        return false;
      }

      // Check configuration service health
      const configHealthy = this.configService.isHealthy();
      if (!configHealthy) {
        return false;
      }

      // Check if limits are properly configured
      const limits = this.configService.getSubscriptionLimits();
      const hasValidLimits = Object.values(limits).every(limit => 
        typeof limit === 'number' && (limit > 0 || limit === -1)
      );

      return hasValidLimits;
    } catch (error) {
      this.log('error', 'Subscription service health check failed', error);
      return false;
    }
  }

  // ===== CORE SUBSCRIPTION OPERATIONS =====

  /**
   * Check if user can create content based on their subscription tier
   */
  async checkUserLimits(userId: string, limitType: string = 'storybook'): Promise<LimitCheckResult> {
    const result = await this.withErrorHandling(
      async () => {
        // Validate input
        if (!userId || typeof userId !== 'string') {
          throw new JobValidationError('Invalid user ID provided', {
            service: this.getName(),
            operation: 'checkUserLimits'
          });
        }

        if (!limitType || typeof limitType !== 'string') {
          throw new JobValidationError('Invalid limit type provided', {
            service: this.getName(),
            operation: 'checkUserLimits'
          });
        }

        this.log('info', `Checking ${limitType} limits for user: ${userId}`);

        // Check cache first
        const cached = this.getCachedUserData(userId);
        if (cached) {
          this.log('info', `Using cached subscription data for user: ${userId}`);
          return this.formatLimitCheckResult(cached, limitType);
        }

        // Get user subscription data
        const subscriptionData = await this.getUserSubscriptionData(userId, limitType);
        
        // Cache the result
        this.cacheUserData(userId, subscriptionData);

        return this.formatLimitCheckResult(subscriptionData, limitType);
      },
      'checkUserLimits'
    );
    
    if (result.success) {
      this.log('info', `Limit check completed for user ${userId}: ${result.data.allowed ? 'ALLOWED' : 'BLOCKED'}`);
      return result.data;
    } else {
      this.log('error', `Limit check failed for user ${userId}:`, result.error);
      
      // Return safe default on error (block creation)
      return {
        allowed: false,
        currentUsage: 0,
        limit: 0,
        userType: 'free',
        upgradeMessage: 'Unable to verify subscription status. Please try again.',
      };
    }
  }

  /**
   * Get user subscription data with usage counts
   */
  async getUserSubscriptionData(userId: string, limitType: string): Promise<UserSubscriptionData> {
    const result = await this.withErrorHandling(
      async () => {
        const databaseService = await enhancedServiceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);
        
        if (!databaseService) {
          throw new DatabaseConnectionError('DatabaseService not available for subscription check', {
            service: this.getName(),
            operation: 'getUserSubscriptionData'
          });
        }

        // Get user profile to determine tier
        const userType = await this.getUserType(userId, databaseService);
        
        // Get current usage count
        const currentUsage = await this.getCurrentUsage(userId, limitType, databaseService);
        
        // Get tier limit from configuration service
        const tierLimit = this.getTierLimit(userType as UserTier, limitType);
        
        // Determine if user can create more content
        const canCreate = tierLimit === -1 || currentUsage < tierLimit;
        
        // Generate upgrade message if needed
        const upgradeMessage = canCreate ? undefined : this.getUpgradeMessage(userType, tierLimit);
        
        return {
          userId,
          userType: userType as UserTier,
          currentUsage,
          tierLimit,
          canCreate,
          upgradeMessage,
          resetDate: this.getResetDate(userType),
        };
      },
      'getUserSubscriptionData'
    );
    
    if (result.success) {
      return result.data;
    } else {
      this.log('error', 'Failed to get user subscription data:', result.error);
      
      // Return safe default (free tier, no creation allowed)
      const freeTierLimit = this.configService.getTierLimit('free');
      return {
        userId,
        userType: 'free',
        currentUsage: 999, // High number to block creation
        tierLimit: freeTierLimit,
        canCreate: false,
        upgradeMessage: 'Unable to verify subscription. Please try again.',
      };
    }
  }

  /**
   * Refresh user cache (useful after subscription changes)
   */
  async refreshUserCache(userId: string): Promise<boolean> {
    const result = await this.withErrorHandling(
      async () => {
        this.userCache.delete(userId);
        this.log('info', `Refreshed cache for user: ${userId}`);
        return true;
      },
      'refreshUserCache'
    );
    
    return result.success ? result.data : false;
  }

  /**
   * Get subscription limits for all tiers (from configuration service)
   */
  getSubscriptionLimits(): SubscriptionLimits {
    return this.configService.getSubscriptionLimits();
  }

  /**
   * Update subscription limits (delegates to configuration service)
   */
  updateSubscriptionLimits(newLimits: Partial<SubscriptionLimits>): void {
    const updateResult = this.configService.updateConfiguration(newLimits);
    
    if (updateResult.success) {
      // Clear cache when limits change
      this.userCache.clear();
      this.log('info', 'Updated subscription limits via configuration service');
    } else {
      this.log('error', 'Failed to update subscription limits:', updateResult.error);
      throw new Error(`Failed to update subscription limits: ${updateResult.error.message}`);
    }
  }

  // ===== CACHE MANAGEMENT =====

  /**
   * Clear all cached subscription data
   */
  clearCache(): void {
    this.userCache.clear();
    this.log('info', 'Cleared all subscription cache');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    oldestEntry: string | null;
    newestEntry: string | null;
  } {
    const entries = Array.from(this.userCache.values());
    
    if (entries.length === 0) {
      return {
        totalEntries: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }

    const timestamps = entries.map(entry => entry.timestamp);
    const oldest = Math.min(...timestamps);
    const newest = Math.max(...timestamps);

    return {
      totalEntries: entries.length,
      oldestEntry: new Date(oldest).toISOString(),
      newestEntry: new Date(newest).toISOString(),
    };
  }

  // ===== PRIVATE HELPER METHODS =====

  private async getUserType(userId: string, databaseService: IDatabaseService): Promise<string> {
    try {
      // Query user profile from database
      // Note: This would need to be implemented in DatabaseService
      // For now, we'll use a mock implementation
      
      this.log('info', `Querying user type for user: ${userId}`);
      
      // Mock implementation - in real system, this would query the profiles table
      // const profile = await databaseService.getUserProfile(userId);
      // return profile?.user_type || 'free';
      
      // For now, default to free tier
      return 'free';
      
    } catch (error) {
      this.log('warn', `Failed to get user type for ${userId}, defaulting to free:`, error);
      return 'free';
    }
  }

  private async getCurrentUsage(userId: string, limitType: string, databaseService: IDatabaseService): Promise<number> {
    try {
      this.log('info', `Counting current ${limitType} usage for user: ${userId}`);
      
      // Mock implementation - in real system, this would count from storybook_entries table
      // const count = await databaseService.countUserContent(userId, limitType);
      // return count;
      
      // For now, return 0 usage
      return 0;
      
    } catch (error) {
      this.log('warn', `Failed to get usage count for ${userId}, defaulting to 0:`, error);
      return 0;
    }
  }

  private getTierLimit(userType: UserTier, limitType: string): number {
    // For now, only handle storybook limits
    if (limitType !== 'storybook') {
      this.log('warn', `Unknown limit type: ${limitType}, defaulting to storybook limits`);
    }

    // Get limit from configuration service
    const limit = this.configService.getTierLimit(userType);
    
    this.log('info', `Tier limit for ${userType}: ${limit === -1 ? 'unlimited' : limit}`);
    return limit;
  }

  private getUpgradeMessage(userType: string, limit: number): string {
    switch (userType) {
      case 'free':
        return "You've already created your free storybook. Upgrade to unlock more.";
      case 'basic':
        return "You've reached your monthly limit of 3 storybooks. Upgrade to Pro for more.";
      case 'premium':
      case 'pro':
        return "You've reached your monthly limit of 10 storybooks.";
      default:
        return `You've reached your limit of ${limit} storybooks.`;
    }
  }

  private getResetDate(userType: string): string | undefined {
    if (userType === 'free' || userType === 'admin') {
      return undefined; // Free tier doesn't reset, admin is unlimited
    }

    // Calculate next month's first day
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toISOString();
  }

  private getCachedUserData(userId: string): UserSubscriptionData | null {
    const cached = this.userCache.get(userId);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    const cacheAge = now - cached.timestamp;
    
    if (cacheAge > (this.config as SubscriptionServiceConfig).cacheTimeout) {
      this.userCache.delete(userId);
      return null;
    }

    return cached.data;
  }

  private cacheUserData(userId: string, data: UserSubscriptionData): void {
    this.userCache.set(userId, {
      data,
      timestamp: Date.now(),
    });
  }

  private formatLimitCheckResult(subscriptionData: UserSubscriptionData, limitType: string): LimitCheckResult {
    return {
      allowed: subscriptionData.canCreate,
      currentUsage: subscriptionData.currentUsage,
      limit: subscriptionData.tierLimit,
      userType: subscriptionData.userType,
      upgradeMessage: subscriptionData.upgradeMessage,
      resetDate: subscriptionData.resetDate,
    };
  }

  private handleConfigurationChange(newConfig: SubscriptionLimits): void {
    this.log('info', 'Subscription configuration changed, clearing cache:', newConfig);
    
    // Clear cache when configuration changes
    this.userCache.clear();
    
    // Log the changes
    const differences = this.configService.getConfigurationDifferences();
    if (Object.keys(differences).length > 0) {
      this.log('info', 'Configuration differences detected:', differences);
    }
  }

  // ===== ENHANCED RESULT PATTERN METHODS =====

  /**
   * Check user limits with Result pattern for better error handling
   */
  async checkUserLimitsResult(userId: string, limitType: string = 'storybook'): Promise<Result<LimitCheckResult, DatabaseConnectionError | JobValidationError>> {
    return this.withErrorHandling(
      async () => {
        return this.checkUserLimits(userId, limitType);
      },
      'checkUserLimitsResult'
    );
  }

  /**
   * Get user subscription data with Result pattern
   */
  async getUserSubscriptionDataResult(userId: string, limitType: string): Promise<Result<UserSubscriptionData, DatabaseConnectionError | JobValidationError>> {
    return this.withErrorHandling(
      async () => {
        return this.getUserSubscriptionData(userId, limitType);
      },
      'getUserSubscriptionDataResult'
    );
  }

  /**
   * Get subscription limits with Result pattern
   */
  getSubscriptionLimitsResult(): Result<SubscriptionLimits, ConfigurationError> {
    try {
      const limits = this.getSubscriptionLimits();
      return Result.success(limits);
    } catch (error: any) {
      const configError = new ConfigurationError(
        `Failed to get subscription limits: ${error.message}`,
        { service: this.getName(), operation: 'getSubscriptionLimitsResult' }
      );
      return Result.failure(configError);
    }
  }

  /**
   * Get configuration summary for monitoring
   */
  getConfigurationSummary(): Result<{
    current: SubscriptionLimits;
    validation: any;
    cacheStats: any;
    configService: any;
  }, never> {
    const summary = {
      current: this.getSubscriptionLimits(),
      validation: this.configService.getValidationStatus().unwrap(),
      cacheStats: this.getCacheStats(),
      configService: this.configService.getConfigurationSummary(),
    };
    
    return Result.success(summary);
  }
}

// ===== EXPORT SINGLETON INSTANCE =====

export const subscriptionService = new SubscriptionService();
export default subscriptionService;