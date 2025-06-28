// Service contracts implementing Interface Segregation Principle
// CONSOLIDATED: Single source of truth for all service interfaces
// Combines enhanced functionality with standard interfaces

// ===== IMPORT AND RE-EXPORT JOB TYPES =====
import type { JobData, JobType, JobStatus, JobMetrics } from '../../lib/types.js';

// Re-export job types so other modules can import them from here
export type { JobData, JobType, JobStatus, JobMetrics };

// ===== HEALTH MONITORING INTERFACES =====

export interface IServiceHealth {
  /**
   * Check if service is healthy (computed property, not internal state)
   */
  isHealthy(): boolean;
  
  /**
   * Get health status with meaningful indicators
   */
  getHealthStatus(): ServiceHealthStatus;
}

export interface ServiceHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  lastCheck: string;
  availability: number; // 0-100 percentage
  responseTime?: number; // milliseconds
}

// ===== METRICS INTERFACES =====

export interface IServiceMetrics {
  /**
   * Get performance metrics (computed, not raw internal state)
   */
  getMetrics(): ServiceMetrics;
  
  /**
   * Reset metrics counters
   */
  resetMetrics(): void;
}

export interface ServiceMetrics {
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageResponseTime: number;
  uptime: number;
  lastActivity: string;
}

// ===== LIFECYCLE MANAGEMENT INTERFACES =====

export interface IServiceLifecycle {
  /**
   * Initialize the service
   */
  initialize(): Promise<void>;
  
  /**
   * Gracefully shutdown the service
   */
  dispose(): Promise<void>;
  
  /**
   * Get initialization status
   */
  isInitialized(): boolean;
}

// ===== BUSINESS OPERATION INTERFACES =====

export interface IDatabaseOperations {
  // Job Management
  getPendingJobs(filter?: JobFilter, limit?: number): Promise<JobData[]>;
  getJobStatus(jobId: string): Promise<JobData | null>;
  updateJobProgress(jobId: string, progress: number, currentStep?: string): Promise<boolean>;
  markJobCompleted(jobId: string, resultData: any): Promise<boolean>;
  markJobFailed(jobId: string, errorMessage: string, shouldRetry?: boolean): Promise<boolean>;
  
  // Storybook Management
  saveStorybookEntry(data: StorybookEntryData): Promise<StorybookEntry>;
  getStorybookEntry(id: string): Promise<StorybookEntry | null>;
  
  // Transaction Support
  executeTransaction<T>(operations: DatabaseOperation<T>[]): Promise<T[]>;
}

export interface IAIOperations {
  // Text Generation
  generateStory(prompt: string, options?: StoryGenerationOptions): Promise<string>;
  generateScenes(systemPrompt: string, userPrompt: string): Promise<SceneGenerationResult>;
  
  // Image Generation
  generateCartoonImage(prompt: string): Promise<string>;
  
  // Vision Analysis
  describeCharacter(imageUrl: string, prompt: string): Promise<string>;
  
  // Chat Completion
  createChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult>;
}

export interface IStorageOperations {
  // Image Management
  uploadImage(imageData: Buffer | string, options?: UploadOptions): Promise<UploadResult>;
  deleteImage(publicId: string): Promise<boolean>;
  generateUrl(publicId: string, transformations?: any): string;
  
  // Cleanup Operations
  cleanupFailedUploads(publicIds: string[]): Promise<void>;
}

export interface IJobOperations {
  // Job Lifecycle
  getPendingJobs(filter?: JobFilter, limit?: number): Promise<JobData[]>;
  getJobStatus(jobId: string): Promise<JobData | null>;
  updateJobProgress(jobId: string, progress: number, currentStep?: string): Promise<boolean>;
  markJobCompleted(jobId: string, resultData: any): Promise<boolean>;
  markJobFailed(jobId: string, errorMessage: string, shouldRetry?: boolean): Promise<boolean>;
  cancelJob(jobId: string, reason?: string): Promise<boolean>;
  
  // Metrics and Monitoring
  getJobMetrics(jobType?: JobType): Promise<JobMetrics>;
}

export interface IAuthOperations {
  // Authentication
  validateToken(token: string): Promise<TokenValidationResult>;
  getUserContext(token: string): Promise<UserContext | null>;
  
  // Authorization
  checkPermission(userContext: UserContext, permission: string): Promise<boolean>;
  
  // Service Authentication
  validateServiceRole(key: string): Promise<boolean>;
  getServiceContext(): UserContext;
}

// ===== SUBSCRIPTION OPERATIONS INTERFACE =====

export interface ISubscriptionOperations {
  // Core Subscription Limit Checking
  checkUserLimits(userId: string, limitType?: string): Promise<LimitCheckResult>;
  getUserSubscriptionData(userId: string, limitType: string): Promise<UserSubscriptionData>;
  
  // Cache Management
  refreshUserCache(userId: string): Promise<boolean>;
  clearCache(): void;
  getCacheStats(): {
    totalEntries: number;
    oldestEntry: string | null;
    newestEntry: string | null;
  };
  
  // Configuration Management
  getSubscriptionLimits(): SubscriptionLimits;
  updateSubscriptionLimits(newLimits: Partial<SubscriptionLimits>): void;
}

// ===== CONFIGURATION INTERFACES =====

export interface IServiceConfiguration {
  /**
   * Get service configuration (read-only)
   */
  getConfiguration(): ServiceConfig;
  
  /**
   * Get timeout for specific operation
   */
  getTimeout(operation: string): number;
  
  /**
   * Get retry configuration for operation
   */
  getRetryConfig(operation: string): RetryConfig;
  
  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature: string): boolean;
}

// ===== COMPOSITE SERVICE INTERFACES =====

export interface IDatabaseService extends 
  IDatabaseOperations, 
  IServiceHealth, 
  IServiceMetrics, 
  IServiceLifecycle {
  getName(): string;
}

export interface IAIService extends 
  IAIOperations, 
  IServiceHealth, 
  IServiceMetrics, 
  IServiceLifecycle {
  getName(): string;
}

export interface IStorageService extends 
  IStorageOperations, 
  IServiceHealth, 
  IServiceMetrics, 
  IServiceLifecycle {
  getName(): string;
}

export interface IJobService extends 
  IJobOperations, 
  IServiceHealth, 
  IServiceMetrics, 
  IServiceLifecycle {
  getName(): string;
}

export interface IAuthService extends 
  IAuthOperations, 
  IServiceHealth, 
  IServiceMetrics, 
  IServiceLifecycle {
  getName(): string;
}

export interface ISubscriptionService extends 
  ISubscriptionOperations, 
  IServiceHealth, 
  IServiceMetrics, 
  IServiceLifecycle {
  getName(): string;
}

export interface IConfigService extends 
  IServiceConfiguration, 
  IServiceHealth, 
  IServiceLifecycle {
  getName(): string;
}

// ===== CONTAINER INTERFACES =====

export interface IServiceContainer {
  // Service Registration
  register<T>(token: string, factory: ServiceFactory<T>, options?: ServiceOptions): void;
  
  // Service Resolution
  resolve<T>(token: string): Promise<T>;
  resolveSync<T>(token: string): T | null;
  
  // Container Management
  isRegistered(token: string): boolean;
  dispose(): Promise<void>;
  
  // Health Aggregation (computed, not exposing internal state)
  getHealth(): Promise<ContainerHealthReport>;
}

export interface ContainerHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, ServiceHealthStatus>;
  timestamp: string;
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

// ===== SUPPORTING TYPES =====

export interface ServiceFactory<T> {
  (container: IServiceContainer): T | Promise<T>;
}

export interface ServiceOptions {
  singleton?: boolean;
  lazy?: boolean;
  dependencies?: string[];
  healthCheck?: boolean;
}

export interface JobFilter {
  user_id?: string;
  type?: JobType;
  status?: JobStatus;
  limit?: number;
  offset?: number;
}

export interface StorybookEntryData {
  title: string;
  story: string;
  pages: any[];
  user_id?: string;
  audience: string;
  character_description: string;
  has_errors: boolean;
}

export interface StorybookEntry {
  id: string;
  title: string;
  story: string;
  pages: any[];
  user_id?: string;
  audience: string;
  character_description: string;
  has_errors: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabaseOperation<T> {
  (client: any): Promise<T>;
}

export interface StoryGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface SceneGenerationResult {
  pages: any[];
  metadata?: any;
}

export interface ChatCompletionOptions {
  model: string;
  messages: any[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: string };
}

export interface ChatCompletionResult {
  choices: any[];
  usage?: any;
  model: string;
}

export interface UploadOptions {
  folder?: string;
  publicId?: string;
  transformation?: any;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
}

export interface UploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

export interface TokenValidationResult {
  valid: boolean;
  user?: UserContext;
  error?: string;
}

export interface UserContext {
  id: string;
  email?: string;
  role: 'user' | 'admin' | 'service';
  permissions: string[];
}

// ===== SUBSCRIPTION TYPES =====

export type UserTier = 'free' | 'basic' | 'premium' | 'pro' | 'admin';

export interface SubscriptionLimits {
  free: number;
  basic: number;
  premium: number;
  pro: number;
  admin: number;
}

export interface UserSubscriptionData {
  userId: string;
  userType: UserTier;
  currentUsage: number;
  tierLimit: number;
  canCreate: boolean;
  upgradeMessage?: string;
  resetDate?: string;
}

export interface LimitCheckResult {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  userType: string;
  upgradeMessage?: string;
  resetDate?: string;
}

export interface ServiceConfig {
  name: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  circuitBreakerThreshold: number;
}

export interface RetryConfig {
  attempts: number;
  delay: number;
  backoffMultiplier: number;
  maxDelay: number;
}

// Service Token Constants
export const SERVICE_TOKENS = {
  DATABASE: 'IDatabaseService',
  AI: 'IAIService',
  STORAGE: 'IStorageService',
  JOB: 'IJobService',
  AUTH: 'IAuthService',
  SUBSCRIPTION: 'ISubscriptionService',
  CONFIG: 'IConfigService',
} as const;

export type ServiceToken = typeof SERVICE_TOKENS[keyof typeof SERVICE_TOKENS];