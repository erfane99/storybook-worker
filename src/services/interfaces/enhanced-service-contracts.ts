// Enhanced service contracts with comprehensive error handling integration
// Extends existing Interface Segregation Principle with Result pattern support

import { 
  IServiceHealth, 
  IServiceMetrics, 
  IServiceLifecycle,
  ServiceHealthStatus,
  ServiceMetrics,
  JobFilter,
  StorybookEntryData,
  StorybookEntry,
  DatabaseOperation,
  JobData,
  JobType
} from './service-contracts.js';
import { Result } from '../errors/result-pattern.js';
import { 
  BaseServiceError, 
  DatabaseConnectionError,
  DatabaseQueryError,
  AIServiceUnavailableError,
  AIRateLimitError,
  StorageUploadError,
  JobValidationError,
  AuthenticationError
} from '../errors/error-types.js';

// ===== ENHANCED HEALTH INTERFACE =====

export interface IEnhancedServiceHealth extends IServiceHealth {
  /**
   * Get health status as Result (never fails)
   */
  getHealthStatusSafe(): Result<ServiceHealthStatus, never>;
  
  /**
   * Perform deep health check with error details
   */
  performHealthCheck(): Promise<Result<ServiceHealthStatus, BaseServiceError>>;
}

// ===== ENHANCED METRICS INTERFACE =====

export interface IEnhancedServiceMetrics extends IServiceMetrics {
  /**
   * Get metrics as Result (never fails)
   */
  getMetricsSafe(): Result<ServiceMetrics, never>;
  
  /**
   * Get error statistics
   */
  getErrorMetrics(): Result<{
    totalErrors: number;
    errorsByType: Record<string, number>;
    lastError?: string;
    errorRate: number;
  }, never>;
}

// ===== ENHANCED DATABASE OPERATIONS =====

export interface IEnhancedDatabaseOperations {
  // Job Management with Result pattern
  getPendingJobs(filter?: JobFilter, limit?: number): Promise<Result<JobData[], DatabaseConnectionError | DatabaseQueryError>>;
  getJobStatus(jobId: string): Promise<Result<JobData | null, DatabaseConnectionError | DatabaseQueryError>>;
  updateJobProgress(jobId: string, progress: number, currentStep?: string): Promise<Result<boolean, DatabaseConnectionError | DatabaseQueryError>>;
  markJobCompleted(jobId: string, resultData: any): Promise<Result<boolean, DatabaseConnectionError | DatabaseQueryError>>;
  markJobFailed(jobId: string, errorMessage: string, shouldRetry?: boolean): Promise<Result<boolean, DatabaseConnectionError | DatabaseQueryError>>;
  
  // Storybook Management with Result pattern
  saveStorybookEntry(data: StorybookEntryData): Promise<Result<StorybookEntry, DatabaseConnectionError | DatabaseQueryError>>;
  getStorybookEntry(id: string): Promise<Result<StorybookEntry | null, DatabaseConnectionError | DatabaseQueryError>>;
  
  // Transaction Support with Result pattern
  executeTransaction<T>(operations: DatabaseOperation<T>[]): Promise<Result<T[], DatabaseConnectionError | DatabaseQueryError>>;
}

// ===== ENHANCED AI OPERATIONS =====

export interface IEnhancedAIOperations {
  // Text Generation with Result pattern
  generateStory(prompt: string, options?: any): Promise<Result<string, AIServiceUnavailableError | AIRateLimitError>>;
  generateScenes(systemPrompt: string, userPrompt: string): Promise<Result<any, AIServiceUnavailableError | AIRateLimitError>>;
  
  // Image Generation with Result pattern
  generateCartoonImage(prompt: string): Promise<Result<string, AIServiceUnavailableError | AIRateLimitError>>;
  
  // Vision Analysis with Result pattern
  describeCharacter(imageUrl: string, prompt: string): Promise<Result<string, AIServiceUnavailableError | AIRateLimitError>>;
  
  // Chat Completion with Result pattern
  createChatCompletion(options: any): Promise<Result<any, AIServiceUnavailableError | AIRateLimitError>>;
}

// ===== ENHANCED STORAGE OPERATIONS =====

export interface IEnhancedStorageOperations {
  // Image Management with Result pattern
  uploadImage(imageData: Buffer | string, options?: any): Promise<Result<any, StorageUploadError>>;
  deleteImage(publicId: string): Promise<Result<boolean, StorageUploadError>>;
  generateUrl(publicId: string, transformations?: any): Result<string, never>;
  
  // Cleanup Operations with Result pattern
  cleanupFailedUploads(publicIds: string[]): Promise<Result<void, StorageUploadError>>;
}

// ===== ENHANCED JOB OPERATIONS =====

export interface IEnhancedJobOperations {
  // Job Lifecycle with Result pattern
  getPendingJobs(filter?: JobFilter, limit?: number): Promise<Result<JobData[], JobValidationError>>;
  getJobStatus(jobId: string): Promise<Result<JobData | null, JobValidationError>>;
  updateJobProgress(jobId: string, progress: number, currentStep?: string): Promise<Result<boolean, JobValidationError>>;
  markJobCompleted(jobId: string, resultData: any): Promise<Result<boolean, JobValidationError>>;
  markJobFailed(jobId: string, errorMessage: string, shouldRetry?: boolean): Promise<Result<boolean, JobValidationError>>;
  cancelJob(jobId: string, reason?: string): Promise<Result<boolean, JobValidationError>>;
  
  // Metrics and Monitoring with Result pattern
  getJobMetrics(jobType?: JobType): Promise<Result<any, never>>;
}

// ===== ENHANCED AUTH OPERATIONS =====

export interface IEnhancedAuthOperations {
  // Authentication with Result pattern
  validateToken(token: string): Promise<Result<any, AuthenticationError>>;
  getUserContext(token: string): Promise<Result<any | null, AuthenticationError>>;
  
  // Authorization with Result pattern
  checkPermission(userContext: any, permission: string): Promise<Result<boolean, AuthenticationError>>;
  
  // Service Authentication with Result pattern
  validateServiceRole(key: string): Promise<Result<boolean, AuthenticationError>>;
  getServiceContext(): Result<any, never>;
}

// ===== ENHANCED COMPOSITE SERVICE INTERFACES =====

export interface IEnhancedDatabaseService extends 
  IEnhancedDatabaseOperations, 
  IEnhancedServiceHealth, 
  IEnhancedServiceMetrics, 
  IServiceLifecycle {
  getName(): string;
  
  /**
   * Test database connection
   */
  testConnection(): Promise<Result<boolean, DatabaseConnectionError>>;
  
  /**
   * Get connection pool statistics
   */
  getConnectionStats(): Result<{
    activeConnections: number;
    idleConnections: number;
    totalConnections: number;
  }, never>;
}

export interface IEnhancedAIService extends 
  IEnhancedAIOperations, 
  IEnhancedServiceHealth, 
  IEnhancedServiceMetrics, 
  IServiceLifecycle {
  getName(): string;
  
  /**
   * Check API quota and limits
   */
  checkQuota(): Promise<Result<{
    remaining: number;
    resetTime: string;
    limit: number;
  }, AIServiceUnavailableError>>;
  
  /**
   * Get model availability
   */
  getModelStatus(): Promise<Result<{
    gpt4Available: boolean;
    dalleAvailable: boolean;
    visionAvailable: boolean;
  }, AIServiceUnavailableError>>;
}

export interface IEnhancedStorageService extends 
  IEnhancedStorageOperations, 
  IEnhancedServiceHealth, 
  IEnhancedServiceMetrics, 
  IServiceLifecycle {
  getName(): string;
  
  /**
   * Get storage quota information
   */
  getQuotaInfo(): Promise<Result<{
    used: number;
    total: number;
    remaining: number;
  }, StorageUploadError>>;
  
  /**
   * Validate storage configuration
   */
  validateConfiguration(): Result<boolean, StorageUploadError>;
}

export interface IEnhancedJobService extends 
  IEnhancedJobOperations, 
  IEnhancedServiceHealth, 
  IEnhancedServiceMetrics, 
  IServiceLifecycle {
  getName(): string;
  
  /**
   * Get job queue statistics
   */
  getQueueStats(): Result<{
    pendingJobs: number;
    processingJobs: number;
    completedJobs: number;
    failedJobs: number;
  }, never>;
  
  /**
   * Validate job data
   */
  validateJobData(jobData: any): Result<boolean, JobValidationError>;
}

export interface IEnhancedAuthService extends 
  IEnhancedAuthOperations, 
  IEnhancedServiceHealth, 
  IEnhancedServiceMetrics, 
  IServiceLifecycle {
  getName(): string;
  
  /**
   * Get authentication statistics
   */
  getAuthStats(): Result<{
    activeTokens: number;
    expiredTokens: number;
    invalidTokens: number;
  }, never>;
  
  /**
   * Validate authentication configuration
   */
  validateAuthConfig(): Result<boolean, AuthenticationError>;
}

// ===== ENHANCED CONTAINER INTERFACE =====

export interface IEnhancedServiceContainer {
  // Service Registration with Result pattern
  register<T>(token: string, factory: any, options?: any): Result<void, BaseServiceError>;
  
  // Service Resolution with Result pattern
  resolve<T>(token: string): Promise<Result<T, BaseServiceError>>;
  resolveSync<T>(token: string): Result<T | null, BaseServiceError>;
  
  // Container Management with Result pattern
  isRegistered(token: string): boolean;
  dispose(): Promise<Result<void, BaseServiceError>>;
  
  // Health Aggregation with Result pattern
  getHealth(): Promise<Result<any, never>>;
  
  // Enhanced container operations
  validateDependencies(token: string): Result<boolean, BaseServiceError>;
  getDependencyGraph(): Result<Record<string, string[]>, never>;
  getServiceInstances(): Result<string[], never>;
}

// ===== ERROR-AWARE SERVICE FACTORY =====

export interface ErrorAwareServiceFactory<T> {
  (container: IEnhancedServiceContainer): Promise<Result<T, BaseServiceError>>;
}

// ===== ENHANCED SERVICE OPTIONS =====

export interface EnhancedServiceOptions {
  singleton?: boolean;
  lazy?: boolean;
  dependencies?: string[];
  healthCheck?: boolean;
  errorHandling?: {
    enableRetry?: boolean;
    maxRetries?: number;
    enableCircuitBreaker?: boolean;
    enableCorrelation?: boolean;
  };
}

// ===== SERVICE HEALTH AGGREGATOR =====

export interface IServiceHealthAggregator {
  /**
   * Get overall system health
   */
  getSystemHealth(): Promise<Result<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, ServiceHealthStatus>;
    summary: {
      total: number;
      healthy: number;
      degraded: number;
      unhealthy: number;
    };
  }, never>>;
  
  /**
   * Get service dependency health
   */
  getDependencyHealth(serviceName: string): Promise<Result<{
    service: ServiceHealthStatus;
    dependencies: Record<string, ServiceHealthStatus>;
  }, BaseServiceError>>;
  
  /**
   * Perform health check on all services
   */
  performSystemHealthCheck(): Promise<Result<void, BaseServiceError>>;
}

// ===== ENHANCED SERVICE TOKENS =====

export const ENHANCED_SERVICE_TOKENS = {
  ENHANCED_DATABASE: 'IEnhancedDatabaseService',
  ENHANCED_AI: 'IEnhancedAIService',
  ENHANCED_STORAGE: 'IEnhancedStorageService',
  ENHANCED_JOB: 'IEnhancedJobService',
  ENHANCED_AUTH: 'IEnhancedAuthService',
  ENHANCED_CONTAINER: 'IEnhancedServiceContainer',
  HEALTH_AGGREGATOR: 'IServiceHealthAggregator',
} as const;

export type EnhancedServiceToken = typeof ENHANCED_SERVICE_TOKENS[keyof typeof ENHANCED_SERVICE_TOKENS];