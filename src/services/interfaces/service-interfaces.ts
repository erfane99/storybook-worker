// Service interfaces that define contracts without exposing implementation details
export interface IBaseService {
  initialize(): Promise<void>;
  isHealthy(): boolean;
  getStatus(): any;
  getName(): string;
}

export interface IServiceContainer {
  register<T>(token: string, factory: ServiceFactory<T>, options?: ServiceOptions): void;
  resolve<T>(token: string): Promise<T>;
  resolveSync<T>(token: string): T | null;
  isRegistered(token: string): boolean;
  getHealth(): Promise<ServiceHealthReport>;
  dispose(): Promise<void>;
}

export interface ServiceFactory<T> {
  (container: IServiceContainer): T | Promise<T>;
}

export interface ServiceOptions {
  singleton?: boolean;
  lazy?: boolean;
  dependencies?: string[];
  healthCheck?: boolean;
}

export interface ServiceHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, ServiceHealthStatus>;
  timestamp: string;
}

export interface ServiceHealthStatus {
  status: 'healthy' | 'unhealthy' | 'not_initialized';
  message?: string;
  lastCheck: string;
  dependencies?: string[];
}

// Database Service Interface
export interface IDatabaseService extends IBaseService {
  getPendingJobs(filter?: any, limit?: number): Promise<any[]>;
  getJobStatus(jobId: string): Promise<any | null>;
  updateJobProgress(jobId: string, progress: number, currentStep?: string): Promise<boolean>;
  markJobCompleted(jobId: string, resultData: any): Promise<boolean>;
  markJobFailed(jobId: string, errorMessage: string, shouldRetry?: boolean): Promise<boolean>;
  saveStorybookEntry(data: any): Promise<any>;
  executeTransaction<T>(operations: any[], options?: any): Promise<T[]>;
}

// AI Service Interface
export interface IAIService extends IBaseService {
  createChatCompletion(options: any): Promise<any>;
  generateImage(options: any): Promise<any>;
  analyzeImage(options: any): Promise<any>;
  generateStory(prompt: string, options?: any): Promise<string>;
  generateScenes(systemPrompt: string, userPrompt: string): Promise<any>;
  describeCharacter(imageUrl: string, prompt: string): Promise<string>;
  generateCartoonImage(prompt: string): Promise<string>;
}

// Storage Service Interface
export interface IStorageService extends IBaseService {
  uploadImage(imageData: Buffer | string, options?: any): Promise<any>;
  generateUrl(publicId: string, transformations?: any): string;
  deleteImage(publicId: string): Promise<boolean>;
  cleanupFailedUploads(publicIds: string[]): Promise<void>;
}

// Job Service Interface
export interface IJobService extends IBaseService {
  getPendingJobs(filter?: any, limit?: number): Promise<any[]>;
  getJobStatus(jobId: string): Promise<any | null>;
  updateJobProgress(jobId: string, progress: number, currentStep?: string): Promise<boolean>;
  markJobCompleted(jobId: string, resultData: any): Promise<boolean>;
  markJobFailed(jobId: string, errorMessage: string, shouldRetry?: boolean): Promise<boolean>;
  cancelJob(jobId: string, reason?: string): Promise<boolean>;
  getJobMetrics(jobType?: any): Promise<any>;
  getProcessingStats(): any;
}

// Auth Service Interface
export interface IAuthService extends IBaseService {
  validateToken(token: string): Promise<any>;
  checkPermission(userContext: any, permission: string): Promise<boolean>;
  getUserContext(token: string): Promise<any | null>;
  validateServiceRole(key: string): Promise<boolean>;
  getServiceContext(): any;
}

// Configuration Service Interface
export interface IConfigService extends IBaseService {
  getConfiguration(): any;
  getServiceTimeout(serviceName: string): number;
  getServiceRetryConfig(serviceName: string): any;
  getServiceLimits(): any;
  isFeatureEnabled(feature: string): boolean;
  validateConfiguration(): { valid: boolean; errors: string[] };
}

// Service Token Constants
export const SERVICE_TOKENS = {
  DATABASE: 'IDatabaseService',
  AI: 'IAIService',
  STORAGE: 'IStorageService',
  JOB: 'IJobService',
  AUTH: 'IAuthService',
  CONFIG: 'IConfigService',
} as const;

export type ServiceToken = typeof SERVICE_TOKENS[keyof typeof SERVICE_TOKENS];