// Enhanced Subscription Service - Production Implementation
// CONSOLIDATED: Updated to use consolidated service container and interfaces

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
import { serviceContainer } from '../container/service-container.js';
import { SERVICE_TOKENS, IDatabaseService } from '../interfaces/service-contracts.js';
import { createClient } from '@supabase/supabase-js';

// ===== PRODUCTION CONFIGURATION =====

interface SubscriptionLimitsConfig {
  free: number;
  basic: number;
  premium: number;
  admin: number;
}

const DEFAULT_LIMITS: SubscriptionLimitsConfig = {
  free: 1,
  basic: 3,
  premium: 10,
  admin: -1, // unlimited
};

// Get limits from environment with fallbacks
function getSubscriptionLimitsFromEnv(): SubscriptionLimitsConfig {
  return {
    free: parseInt(process.env.SUBSCRIPTION_LIMIT_FREE || '1') || DEFAULT_LIMITS.free,
    basic: parseInt(process.env.SUBSCRIPTION_LIMIT_BASIC || '3') || DEFAULT_LIMITS.basic,
    premium: parseInt(process.env.SUBSCRIPTION_LIMIT_PREMIUM || '10') || DEFAULT_LIMITS.premium,
    admin: parseInt(process.env.SUBSCRIPTION_LIMIT_ADMIN || '-1') || DEFAULT_LIMITS.admin,
  };
}

export interface SubscriptionServiceConfig extends ErrorAwareServiceConfig {
  cacheTimeout: number;
  usageCountTimeout: number;
  enableConfigHotReload: boolean;
}

// ===== SUBSCRIPTION SERVICE IMPLEMENTATION =====

export class SubscriptionService extends ErrorAwareBaseService implements ISubscriptionService {
  private userCache: Map<string, { data: UserSubscriptionData; timestamp: number }> = new Map();
  private subscriptionLimits: SubscriptionLimitsConfig;
  private supabaseClient: any;
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
    
    // Initialize subscription limits from environment
    this.subscriptionLimits = getSubscriptionLimitsFromEnv();
    
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseUrl && supabaseServiceKey) {
      this.supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    } else {
      console.error('❌ Missing Supabase environment variables for SubscriptionService');
    }
  }

  getName(): string {
    return 'SubscriptionService';
  }

  // ===== LIFECYCLE IMPLEMENTATION =====

  protected async initializeService(): Promise<void> {
    try {
      // Validate Supabase connection
      if (!this.supabaseClient) {
        throw new Error('Supabase client not initialized - missing environment variables');
      }

      // Validate that we can access the database service
      const databaseService = await serviceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);
      if (!databaseService) {
        throw new Error('DatabaseService not available for subscription checks');
      }

      // Log current configuration
      this.log('info', 'Subscription limits loaded from environment:', this.subscriptionLimits);
      
      this.log('info', 'Subscription service initialized successfully');
    } catch (error) {
      this.log('error', 'Failed to initialize subscription service', error);
      throw error;
    }
  }

  protected async disposeService(): Promise<void> {
    try {
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
      const databaseService = serviceContainer.resolveSync<IDatabaseService>(SERVICE_TOKENS.DATABASE);
      if (!databaseService) {
        return false;
      }

      // Check Supabase connection
      if (!this.supabaseClient) {
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
        const databaseService = await serviceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);
        
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
      const freeTierLimit = this.subscriptionLimits.free;
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
   * Get subscription limits for all tiers (from environment configuration)
   */
  getSubscriptionLimits(): SubscriptionLimits {
    return { ...this.subscriptionLimits };
  }

  /**
   * Update subscription limits (updates in-memory config)
   */
  updateSubscriptionLimits(newLimits: Partial<SubscriptionLimits>): void {
    this.subscriptionLimits = { ...this.subscriptionLimits, ...newLimits };
    
    // Clear cache when limits change
    this.userCache.clear();
    this.log('info', 'Updated subscription limits:', this.subscriptionLimits);
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

  // ===== PRODUCTION DATABASE QUERIES =====

  private async getUserType(userId: string, databaseService: IDatabaseService): Promise<string> {
    try {
      this.log('info', `Querying user type for user: ${userId}`);
      
      // Direct Supabase query to profiles table
      const { data: profile, error } = await this.supabaseClient
        .from('profiles')
        .select('user_type')
        .eq('user_id', userId)
        .single();

      if (error) {
        this.log('warn', `Database error getting user type for ${userId}:`, error);
        return 'free'; // Safe default
      }

      const userType = profile?.user_type || 'free';
      this.log('info', `User ${userId} has type: ${userType}`);
      return userType;
      
    } catch (error) {
      this.log('warn', `Failed to get user type for ${userId}, defaulting to free:`, error);
      return 'free';
    }
  }

  private async getCurrentUsage(userId: string, limitType: string, databaseService: IDatabaseService): Promise<number> {
    try {
      this.log('info', `Counting current ${limitType} usage for user: ${userId}`);
      
      // Direct Supabase query to count storybooks
      const { count, error } = await this.supabaseClient
        .from('storybook_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) {
        this.log('warn', `Database error counting usage for ${userId}:`, error);
        return 0; // Safe default
      }

      const currentUsage = count || 0;
      this.log('info', `User ${userId} has ${currentUsage} ${limitType}s`);
      return currentUsage;
      
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

    // Get limit from environment configuration
    const limit = this.subscriptionLimits[userType] || this.subscriptionLimits.free;
    
    this.log('info', `Tier limit for ${userType}: ${limit === -1 ? 'unlimited' : limit}`);
    return limit;
  }

  private getUpgradeMessage(userType: string, limit: number): string {
    switch (userType) {
      case 'free':
        return "You've already created your free storybook. Upgrade to unlock more.";
      case 'basic':
        return "You've reached your monthly limit of 3 storybooks. Upgrade to Premium for more.";
      case 'premium':
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

  private handleConfigurationChange(newConfig: SubscriptionLimitsConfig): void {
    this.log('info', 'Subscription configuration changed, clearing cache:', newConfig);
    
    // Clear cache when configuration changes
    this.userCache.clear();
    
    // Update internal limits
    this.subscriptionLimits = { ...newConfig };
  }

  // ===== FIXED: PROPER ERROR MAPPING IN RESULT PATTERN METHODS =====

  /**
   * Check user limits with Result pattern for better error handling
   * ✅ FIXED: Proper error mapping from service errors to expected interface errors
   */
  async checkUserLimitsResult(userId: string, limitType: string = 'storybook'): Promise<Result<LimitCheckResult, DatabaseConnectionError | JobValidationError>> {
    try {
      const result = await this.checkUserLimits(userId, limitType);
      return Result.success(result);
    } catch (error: any) {
      // ✅ PROPER ERROR MAPPING: Convert service errors to expected interface types
      if (error instanceof DatabaseConnectionError) {
        return Result.failure(error);
      } else if (error instanceof DatabaseQueryError) {
        // Map database query errors to job validation errors (business logic boundary)
        const mappedError = new JobValidationError(
          `User subscription validation failed: ${error.message}`,
          {
            service: this.getName(),
            operation: 'checkUserLimitsResult',
            details: { originalError: error.message }
          }
        );
        return Result.failure(mappedError);
      } else if (error instanceof JobValidationError) {
        return Result.failure(error);
      } else {
        // Map unknown errors to connection errors (safest fallback)
        const mappedError = new DatabaseConnectionError(
          `Subscription service unavailable: ${error.message}`,
          {
            service: this.getName(),
            operation: 'checkUserLimitsResult',
            details: { originalError: error.message }
          }
        );
        return Result.failure(mappedError);
      }
    }
  }

  /**
   * Get user subscription data with Result pattern
   * ✅ FIXED: Proper error mapping from service errors to expected interface errors
   */
  async getUserSubscriptionDataResult(userId: string, limitType: string): Promise<Result<UserSubscriptionData, DatabaseConnectionError | JobValidationError>> {
    try {
      const result = await this.getUserSubscriptionData(userId, limitType);
      return Result.success(result);
    } catch (error: any) {
      // ✅ PROPER ERROR MAPPING: Convert service errors to expected interface types
      if (error instanceof DatabaseConnectionError) {
        return Result.failure(error);
      } else if (error instanceof DatabaseQueryError) {
        // Map database query errors to job validation errors (business logic boundary)
        const mappedError = new JobValidationError(
          `User subscription data validation failed: ${error.message}`,
          {
            service: this.getName(),
            operation: 'getUserSubscriptionDataResult',
            details: { originalError: error.message }
          }
        );
        return Result.failure(mappedError);
      } else if (error instanceof JobValidationError) {
        return Result.failure(error);
      } else {
        // Map unknown errors to connection errors (safest fallback)
        const mappedError = new DatabaseConnectionError(
          `Subscription service unavailable: ${error.message}`,
          {
            service: this.getName(),
            operation: 'getUserSubscriptionDataResult',
            details: { originalError: error.message }
          }
        );
        return Result.failure(mappedError);
      }
    }
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
    cacheStats: any;
    supabaseConnected: boolean;
  }, never> {
    const summary = {
      current: this.getSubscriptionLimits(),
      cacheStats: this.getCacheStats(),
      supabaseConnected: !!this.supabaseClient,
    };
    
    return Result.success(summary);
  }
}