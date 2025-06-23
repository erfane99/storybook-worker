// Storage service for Cloudinary operations
import { BaseService, ServiceConfig, RetryConfig } from '../base/base-service.js';

export interface StorageConfig extends ServiceConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  uploadTimeout: number;
  maxFileSize: number;
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

export class StorageService extends BaseService {
  private cloudName: string | null = null;
  private apiKey: string | null = null;
  private apiSecret: string | null = null;
  private readonly uploadRetryConfig: RetryConfig = {
    attempts: 3,
    delay: 2000,
    backoffMultiplier: 2,
    maxDelay: 20000,
  };

  constructor() {
    const config: StorageConfig = {
      name: 'StorageService',
      timeout: 60000,
      retryAttempts: 3,
      retryDelay: 2000,
      circuitBreakerThreshold: 5,
      cloudName: '',
      apiKey: '',
      apiSecret: '',
      uploadTimeout: 60000,
      maxFileSize: 10 * 1024 * 1024, // 10MB
    };
    
    super(config);
  }

  protected async initialize(): Promise<void> {
    // Check for Cloudinary environment variables
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME || null;
    this.apiKey = process.env.CLOUDINARY_API_KEY || null;
    this.apiSecret = process.env.CLOUDINARY_API_SECRET || null;

    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      this.log('warn', 'Cloudinary not configured - storage service will be unavailable');
      return;
    }

    this.log('info', 'Storage service initialized successfully');
  }

  /**
   * Upload image to Cloudinary
   */
  async uploadImage(
    imageData: Buffer | string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    await this.ensureInitialized();
    
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new Error('Storage service not available - Cloudinary not configured');
    }

    if (this.isCircuitBreakerOpen()) {
      throw new Error('Storage service circuit breaker is open');
    }

    return this.withRetry(
      async () => {
        // Implementation would use Cloudinary SDK or direct API calls
        // For now, return a mock result
        this.log('info', 'Uploading image to Cloudinary');
        
        // Mock implementation - replace with actual Cloudinary upload
        const mockResult: UploadResult = {
          url: 'https://res.cloudinary.com/mock/image/upload/v1/mock.jpg',
          secureUrl: 'https://res.cloudinary.com/mock/image/upload/v1/mock.jpg',
          publicId: 'mock',
          format: 'jpg',
          width: 1024,
          height: 1024,
          bytes: 102400,
        };

        this.resetCircuitBreaker();
        return mockResult;
      },
      this.uploadRetryConfig,
      'uploadImage'
    );
  }

  /**
   * Generate transformation URL
   */
  generateUrl(publicId: string, transformations: any = {}): string {
    if (!this.cloudName) {
      throw new Error('Storage service not available - Cloudinary not configured');
    }

    // Mock implementation - replace with actual Cloudinary URL generation
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${publicId}`;
  }

  /**
   * Delete image from Cloudinary
   */
  async deleteImage(publicId: string): Promise<boolean> {
    await this.ensureInitialized();
    
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new Error('Storage service not available - Cloudinary not configured');
    }

    return this.withRetry(
      async () => {
        this.log('info', `Deleting image: ${publicId}`);
        
        // Mock implementation - replace with actual Cloudinary delete
        this.resetCircuitBreaker();
        return true;
      },
      this.uploadRetryConfig,
      'deleteImage'
    );
  }

  /**
   * Cleanup failed uploads
   */
  async cleanupFailedUploads(publicIds: string[]): Promise<void> {
    if (publicIds.length === 0) return;

    this.log('info', `Cleaning up ${publicIds.length} failed uploads`);
    
    const cleanupPromises = publicIds.map(async (publicId) => {
      try {
        await this.deleteImage(publicId);
      } catch (error) {
        this.log('warn', `Failed to cleanup upload: ${publicId}`, error);
      }
    });

    await Promise.allSettled(cleanupPromises);
  }

  isHealthy(): boolean {
    return this.isInitialized && 
           this.cloudName !== null && 
           this.apiKey !== null && 
           this.apiSecret !== null && 
           !this.isCircuitBreakerOpen();
  }

  getStatus() {
    return {
      name: this.config.name,
      initialized: this.isInitialized,
      available: this.isHealthy(),
      circuitBreakerOpen: this.isCircuitBreakerOpen(),
      circuitBreakerFailures: this.circuitBreakerFailures,
      configured: this.cloudName !== null && this.apiKey !== null && this.apiSecret !== null,
    };
  }
}

// Export singleton instance
export const storageService = new StorageService();
export default storageService;