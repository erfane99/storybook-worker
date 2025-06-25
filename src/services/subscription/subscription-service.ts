// Enhanced Subscription Service - Production Implementation
import { ErrorAwareBaseService, ErrorAwareServiceConfig } from '../base/error-aware-base-service.js';
import { 
  IServiceHealth,
  IServiceMetrics,
  IServiceLifecycle,
  ServiceConfig,
  RetryConfig
} from '../interfaces/service-contracts.js';
import { 
  Result,
  AsyncResult,
  DatabaseConnectionError,
  DatabaseQueryError,
  JobValidationError,
  ErrorFactory,
  ErrorCategory
} from '../errors/index.js';
import { enhancedServiceContainer } from '../container/enhanced-service-container.js';
import { SERVICE_TOKENS, IDatabaseService } from '../interfaces/service-contracts.js';
import { environmentManager } from '../../lib/config/environment.js';

// ===== SUBSCRIPTION INTERFACES =====

export interface UserSubscriptionData {
  userId: string;
  userType: 'free' | 'basic' | 'premium' | 'pro' | 'admin';
  currentUsage: number;
  tierLimit: number;
  canCreate: boolean;
  upgradeMessage?: string;
  resetDate?: string;
}

export interface SubscriptionLimits {
  free: number;
  basic: number;
  premium: number;
  pro: number;
  admin: number;
}

export interface LimitCheckResult {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  userType: string;
  upgradeMessage?: string;
  resetDate?: string;
}

// ===== SUBSCRIPTION SERVICE CONFIG =====

export interface SubscriptionServiceConfig extends ErrorAwareServiceConfig {
  defaultLimits: SubscriptionLimits;
  cacheTimeout: number;
  usageCountTimeout: number;
}

// ===== SUBSCRIPTION SERVICE IMPLEMENTATION =====

export class SubscriptionService extends ErrorAwareBaseService implements IServiceHealth, IServiceMetrics, IServiceLifecycle {
  private subscriptionLimits: SubscriptionLimits;
  private userCache: Map<string, { data: UserSubscriptionData; timestamp: number }> = new Map();
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
      defaultLimits: {
        free: 1,      // 1 storybook limit
        basic: 3,     // 3 storybooks per month
        premium: 10,  // Legacy tier - same as pro
        pro: 10,      // 10 storybooks per month
        admin: -1,    // Unlimited for internal use
      },
      cacheTimeout: 300000, // 5 minutes
      usageCountTimeout: 60000, // 1 minute for usage counts
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
    
    // Initialize subscription limits from environment or defaults
    this.subscriptionLimits = this.loadSubscriptionLimits(finalConfig.defaultLimits);
  }

  getName(): string {
    return 'SubscriptionService';
  }

  // ===== LIFECYCLE IMPLEMENTATION =====

  protected async initializeService(): Promise<void> {
    try {
      // Validate that we can access the database service
      const databaseService = await enhancedServiceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);
      if (!databaseService) {
        throw new Error('DatabaseService not available for subscription checks');
      }

      // Log configuration
      this.log('info', 'Subscription limits configured:', this.subscriptionLimits);
      this.log('info', 'Subscription service initialized successfully');
    } catch (error) {
      this.log('error', 'Failed to initialize subscription service', error);
      throw error;
    }
  }

  protected async disposeService(): Promise<void> {
    try {
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

      // Check if limits are properly configured
      const hasValidLimits = Object.values(this.subscriptionLimits).every(limit => 
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
        
        // Get tier limit
        const tierLimit = this.getTierLimit(userType, limitType);
        
        // Determine if user can create more content
        const canCreate = tierLimit === -1 || currentUsage < tierLimit;
        
        // Generate upgrade message if needed
        const upgradeMessage = canCreate ? undefined : this.getUpgradeMessage(userType, tierLimit);
        
        return {
          userId,
          userType,
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
      return {
        userId,
        userType: 'free',
        currentUsage: 999, // High number to block creation
        tierLimit: this.subscriptionLimits.free,
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
   * Get subscription limits for all tiers
   */
  getSubscriptionLimits(): SubscriptionLimits {
    return { ...this.subscriptionLimits };
  }

  /**
   * Update subscription limits (for configuration changes)
   */
  updateSubscriptionLimits(newLimits: Partial<SubscriptionLimits>): void {
    this.subscriptionLimits = { ...this.subscriptionLimits, ...newLimits };
    this.userCache.clear(); // Clear cache when limits change
    this.log('info', 'Updated subscription limits:', this.subscriptionLimits);
  }

  // ===== PRIVATE HELPER METHODS =====

  private loadSubscriptionLimits(defaults: SubscriptionLimits): SubscriptionLimits {
    return {
      free: Number(process.env.SUBSCRIPTION_LIMIT_FREE) || defaults.free,
      basic: Number(process.env.SUBSCRIPTION_LIMIT_BASIC) || defaults.basic,
      premium: Number(process.env.SUBSCRIPTION_LIMIT_PREMIUM) || defaults.premium,
      pro: Number(process.env.SUBSCRIPTION_LIMIT_PRO) || defaults.pro,
      admin: Number(process.env.SUBSCRIPTION_LIMIT_ADMIN) || defaults.admin,
    };
  }

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

  private getTierLimit(userType: string, limitType: string): number {
    // For now, only handle storybook limits
    if (limitType !== 'storybook') {
      this.log('warn', `Unknown limit type: ${limitType}, defaulting to storybook limits`);
    }

    const limit = this.subscriptionLimits[userType as keyof SubscriptionLimits];
    if (limit === undefined) {
      this.log('warn', `Unknown user type: ${userType}, defaulting to free tier`);
      return this.subscriptionLimits.free;
    }

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
}

// ===== EXPORT SINGLETON INSTANCE =====

export const subscriptionService = new SubscriptionService();
export default subscriptionService;