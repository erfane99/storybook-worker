// Enhanced Storage Service - Production Implementation
import { EnhancedBaseService } from '../base/enhanced-base-service.js';
import { 
  IStorageService,
  ServiceConfig,
  RetryConfig,
  UploadOptions,
  UploadResult
} from '../interfaces/service-contracts.js';
import { 
  Result,
  StorageUploadError,
  StorageQuotaExceededError,
  StorageFileNotFoundError,
  StorageConfigurationError,
  ErrorFactory
} from '../errors/index.js';
import { v2 as cloudinary } from 'cloudinary';

export interface StorageConfig extends ServiceConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  uploadTimeout: number;
  maxFileSize: number;
}

export class StorageService extends EnhancedBaseService implements IStorageService {
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

  getName(): string {
    return 'StorageService';
  }

  // ===== LIFECYCLE IMPLEMENTATION =====

  protected async initializeService(): Promise<void> {
    // Check for Cloudinary environment variables
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME || null;
    this.apiKey = process.env.CLOUDINARY_API_KEY || null;
    this.apiSecret = process.env.CLOUDINARY_API_SECRET || null;

    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new Error('Cloudinary not configured - storage service will be unavailable');
    }

    // Configure Cloudinary
    cloudinary.config({
      cloud_name: this.cloudName,
      api_key: this.apiKey,
      api_secret: this.apiSecret,
    });
  }

  protected async disposeService(): Promise<void> {
    // No cleanup needed for Cloudinary
  }

  protected async checkServiceHealth(): Promise<boolean> {
    return this.cloudName !== null && this.apiKey !== null && this.apiSecret !== null;
  }

  // ===== STORAGE OPERATIONS IMPLEMENTATION =====

  async uploadImage(
    imageData: Buffer | string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new Error('Storage service not available - Cloudinary not configured');
    }

    return this.withRetry(
      async () => {
        this.log('info', 'Uploading image to Cloudinary');

        const uploadOptions: any = {
          resource_type: 'image',
          folder: options.folder || 'storybook/worker-uploads',
          quality: 'auto:good',
          format: 'jpg',
        };

        if (options.tags && Array.isArray(options.tags)) {
          uploadOptions.tags = options.tags;
        }

        let uploadResult: any;

        if (Buffer.isBuffer(imageData)) {
          // Upload from Buffer
          uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              uploadOptions,
              (error: any, result: any) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            uploadStream.end(imageData);
          });
        } else if (typeof imageData === 'string') {
          // Upload from URL
          uploadResult = await cloudinary.uploader.upload(imageData, uploadOptions);
        } else {
          throw new Error('Invalid imageData: must be Buffer or URL string');
        }

        if (!uploadResult || !uploadResult.secure_url) {
          throw new Error('Cloudinary upload failed - no URL returned');
        }

        const result: UploadResult = {
          url: uploadResult.url,
          secureUrl: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          format: uploadResult.format || 'jpg',
          width: uploadResult.width || 0,
          height: uploadResult.height || 0,
          bytes: uploadResult.bytes || 0,
        };

        this.log('info', `Successfully uploaded to Cloudinary: ${result.publicId}`);
        return result;
      },
      this.uploadRetryConfig,
      'uploadImage'
    );
  }

  generateUrl(publicId: string, transformations: any = {}): string {
    if (!this.cloudName) {
      throw new Error('Storage service not available - Cloudinary not configured');
    }

    // Mock implementation - replace with actual Cloudinary URL generation
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${publicId}`;
  }

  async deleteImage(publicId: string): Promise<boolean> {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new Error('Storage service not available - Cloudinary not configured');
    }

    return this.withRetry(
      async () => {
        this.log('info', `Deleting image: ${publicId}`);
        
        const result = await cloudinary.uploader.destroy(publicId);
        
        if (result.result === 'ok' || result.result === 'not found') {
          this.log('info', `Successfully deleted: ${publicId}`);
          return true;
        }
        
        throw new Error(`Failed to delete image: ${result.result}`);
      },
      this.uploadRetryConfig,
      'deleteImage'
    );
  }

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
}