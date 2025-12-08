/**
 * ===== CLOUDINARY CLEANUP SERVICE =====
 * Handles cleanup of Cloudinary images when storybooks are deleted
 * 
 * File Location: src/services/storage/cloudinary-cleanup-service.ts
 * 
 * Purpose:
 * - Extract Cloudinary public IDs from storybook pages JSONB
 * - Batch delete images from Cloudinary
 * - Graceful error handling (don't block deletion if cleanup fails)
 * 
 * Note: Does NOT delete cartoon_images (they're reusable across storybooks)
 */

import { v2 as cloudinary } from 'cloudinary';

// ===== INTERFACES =====

interface CleanupResult {
  success: number;
  failed: number;
  skipped: number;
  errors: string[];
}

interface StorybookPage {
  scenes?: Array<{
    generatedImage?: string;
    imageUrl?: string;
    image_url?: string;
  }>;
}

// ===== CLOUDINARY CLEANUP SERVICE =====

export class CloudinaryCleanupService {
  private isConfigured: boolean = false;
  private logger: typeof console;

  constructor(logger?: typeof console) {
    this.logger = logger || console;
    this.initializeCloudinary();
  }

  /**
   * Initialize Cloudinary configuration
   */
  private initializeCloudinary(): void {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      this.logger.warn('⚠️ Cloudinary not configured - cleanup service will be unavailable');
      this.isConfigured = false;
      return;
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    this.isConfigured = true;
    this.logger.log('✅ CloudinaryCleanupService initialized');
  }

  /**
   * Extract Cloudinary public ID from a URL
   * 
   * URL format: https://res.cloudinary.com/{cloud}/image/upload/{transformations}/v{version}/{public_id}.{format}
   * 
   * @param url - Cloudinary image URL
   * @returns Public ID or null if not a valid Cloudinary URL
   */
  public extractPublicIdFromUrl(url: string): string | null {
    if (!url || !url.includes('cloudinary.com')) {
      return null;
    }

    try {
      // Match pattern: /upload/{optional_transformations}/v{version}/{public_id}.{format}
      // Or: /upload/{optional_transformations}/{public_id}.{format}
      
      // Remove query parameters
      const cleanUrl = url.split('?')[0];
      
      // Find the upload segment
      const uploadIndex = cleanUrl.indexOf('/upload/');
      if (uploadIndex === -1) {
        return null;
      }

      // Get everything after /upload/
      let pathAfterUpload = cleanUrl.substring(uploadIndex + 8);

      // Remove leading transformations if present (they contain commas or start with common transform prefixes)
      // Transformations look like: w_512,h_512,c_fill,q_auto:low/
      const transformationPatterns = [
        /^[a-z]_[^/]+\//,  // e.g., w_512/ or q_auto:low/
        /^v\d+\//,         // version: v123456789/
      ];

      // Keep removing transformation segments until we get to the public_id
      let previousPath = '';
      while (pathAfterUpload !== previousPath) {
        previousPath = pathAfterUpload;
        
        // Check for comma-separated transformations (e.g., w_512,h_512,c_fill/)
        const commaTransformMatch = pathAfterUpload.match(/^[^/]*,[^/]*\//);
        if (commaTransformMatch) {
          pathAfterUpload = pathAfterUpload.substring(commaTransformMatch[0].length);
          continue;
        }

        // Check for version segment (v followed by numbers)
        const versionMatch = pathAfterUpload.match(/^v\d+\//);
        if (versionMatch) {
          pathAfterUpload = pathAfterUpload.substring(versionMatch[0].length);
          continue;
        }

        // Check for single transformation prefix (e.g., f_auto/)
        const singleTransformMatch = pathAfterUpload.match(/^[a-z]_[^/]+\//);
        if (singleTransformMatch) {
          pathAfterUpload = pathAfterUpload.substring(singleTransformMatch[0].length);
          continue;
        }
      }

      // What remains should be: folder/subfolder/filename.ext
      // Remove the file extension
      const lastDotIndex = pathAfterUpload.lastIndexOf('.');
      if (lastDotIndex > 0) {
        pathAfterUpload = pathAfterUpload.substring(0, lastDotIndex);
      }

      // The public ID is the remaining path
      return pathAfterUpload || null;

    } catch (error) {
      this.logger.warn(`Failed to extract public ID from URL: ${url}`, error);
      return null;
    }
  }

  /**
   * Extract all Cloudinary public IDs from storybook pages
   * 
   * @param pages - Array of page objects from storybook_entries.pages JSONB
   * @returns Array of public IDs
   */
  public extractPublicIdsFromPages(pages: StorybookPage[]): string[] {
    const publicIds: string[] = [];

    if (!pages || !Array.isArray(pages)) {
      return publicIds;
    }

    for (const page of pages) {
      if (!page.scenes || !Array.isArray(page.scenes)) {
        continue;
      }

      for (const scene of page.scenes) {
        // Try different possible image URL field names
        const imageUrl = scene.generatedImage || scene.imageUrl || scene.image_url;
        
        if (imageUrl) {
          const publicId = this.extractPublicIdFromUrl(imageUrl);
          if (publicId) {
            publicIds.push(publicId);
          }
        }
      }
    }

    // Remove duplicates
    return [...new Set(publicIds)];
  }

  /**
   * Delete images from Cloudinary in batches
   * 
   * @param publicIds - Array of Cloudinary public IDs to delete
   * @param batchSize - Number of images to delete per batch (default: 10)
   * @returns Cleanup result with success/failure counts
   */
  public async deleteImagesFromCloudinary(
    publicIds: string[],
    batchSize: number = 10
  ): Promise<CleanupResult> {
    const result: CleanupResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    if (!this.isConfigured) {
      this.logger.warn('⚠️ Cloudinary not configured, skipping cleanup');
      result.skipped = publicIds.length;
      result.errors.push('Cloudinary not configured');
      return result;
    }

    if (publicIds.length === 0) {
      this.logger.log('📭 No images to delete');
      return result;
    }

    this.logger.log(`🗑️ Deleting ${publicIds.length} images from Cloudinary (batch size: ${batchSize})`);

    // Process in batches
    for (let i = 0; i < publicIds.length; i += batchSize) {
      const batch = publicIds.slice(i, i + batchSize);
      
      try {
        // Use delete_resources for batch deletion
        const deleteResult = await cloudinary.api.delete_resources(batch, {
          type: 'upload',
          resource_type: 'image',
        });

        // Count successes and failures
        for (const publicId of batch) {
          if (deleteResult.deleted[publicId] === 'deleted' || 
              deleteResult.deleted[publicId] === 'not_found') {
            result.success++;
          } else {
            result.failed++;
            result.errors.push(`Failed to delete: ${publicId}`);
          }
        }

        this.logger.log(`✅ Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} images processed`);

        // Small delay between batches to avoid rate limits
        if (i + batchSize < publicIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error: any) {
        this.logger.error(`❌ Batch deletion failed:`, error.message || error);
        result.failed += batch.length;
        result.errors.push(`Batch error: ${error.message || 'Unknown error'}`);
      }
    }

    this.logger.log(`🗑️ Cleanup complete: ${result.success} deleted, ${result.failed} failed, ${result.skipped} skipped`);
    return result;
  }

  /**
   * Main method: Clean up all images associated with a storybook
   * 
   * @param pages - Pages JSONB from storybook_entries
   * @param characterImage - Optional character image URL (from storybook_jobs)
   * @returns Cleanup result
   */
  public async cleanupStorybookImages(
    pages: StorybookPage[],
    characterImage?: string
  ): Promise<CleanupResult> {
    this.logger.log('🧹 Starting storybook image cleanup...');

    // Extract all public IDs from pages
    const publicIds = this.extractPublicIdsFromPages(pages);

    // Add character image if provided (NOT cartoon image - that's reusable)
    // Note: We only delete the original uploaded character image, not the cartoonized version
    if (characterImage) {
      const characterPublicId = this.extractPublicIdFromUrl(characterImage);
      if (characterPublicId) {
        publicIds.push(characterPublicId);
      }
    }

    if (publicIds.length === 0) {
      this.logger.log('📭 No Cloudinary images found in storybook');
      return {
        success: 0,
        failed: 0,
        skipped: 0,
        errors: [],
      };
    }

    this.logger.log(`🔍 Found ${publicIds.length} Cloudinary images to delete`);

    // Delete all images
    return this.deleteImagesFromCloudinary(publicIds);
  }

  /**
   * Check if the service is properly configured
   */
  public isServiceConfigured(): boolean {
    return this.isConfigured;
  }
}

// Export singleton instance
export const cloudinaryCleanupService = new CloudinaryCleanupService();
export default cloudinaryCleanupService;

