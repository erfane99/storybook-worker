/**
 * ===== GEMINI INTEGRATION MODULE =====
 * Enterprise-grade Google Gemini 3 Pro Image API wrapper
 * Replaces OpenAI for 95% character consistency through image-based generation
 * 
 * File Location: src/services/ai/modular/gemini-integration.ts
 * 
 * KEY FEATURES:
 * - Image-to-image generation (vs OpenAI text-only)
 * - Multimodal understanding (sees actual images)
 * - Advanced thinking mode for better quality
 * - Up to 4K resolution support
 * - Full error handling and retry logic
 * - Circuit breaker protection
 * - Comprehensive logging
 */

// ===== IMPORTS =====
import {
  AIAuthenticationError,
  AIRateLimitError,
  AIContentPolicyError,
  AITimeoutError,
  AIServiceUnavailableError,
  AIValidationError,
  AINetworkError,
  BaseServiceError,
  ErrorHandlingSystem,
  ErrorContext
} from './error-handling-system.js';

import {
  AI_SERVICE_ENTERPRISE_CONSTANTS,
  ERROR_HANDLING_CONSTANTS
} from './constants-and-types.js';

// ===== TYPE DEFINITIONS =====

interface GeminiGenerationConfig {
  image_size?: '1K' | '2K' | '4K';
  thinking_mode?: boolean;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_output_tokens?: number;
}

interface GeminiImagePart {
  inline_data: {
    mime_type: string;
    data: string;  // base64
  };
}

interface GeminiTextPart {
  text: string;
}

interface GeminiContent {
  parts: (GeminiTextPart | GeminiImagePart)[];
}

interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: GeminiGenerationConfig;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inline_data?: {
          mime_type?: string;
          data?: string;
          url?: string;
        };
      }>;
    };
    finishReason?: string;
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
  threshold: number;
  timeout: number;
  successCount: number;
  totalRequests: number;
  errorRate: number;
}

interface RateLimitState {
  count: number;
  resetTime: number;
  windowMs: number;
  maxRequests: number;
}

interface CharacterAnalysis {
  description: string;
  facialFeatures: any;
  bodyType: any;
  clothing: any;
  distinctiveFeatures: string[];
  colorPalette: any;
  skinTone: string;
  hairDetails: any;
  expressionBaseline: string;
}

interface PanelOptions {
  artStyle: string;
  resolution?: '1K' | '2K' | '4K';
  thinkingMode?: boolean;
  cameraAngle?: string;
  lighting?: string;
  panelType?: string;
  backgroundComplexity?: string;
  temperature?: number;
}

// ===== GEMINI INTEGRATION CLASS =====

export class GeminiIntegration {
  private apiKey: string;
  private errorHandler: ErrorHandlingSystem;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  private defaultModel = 'gemini-3-pro-image-preview';
  
  // Circuit breaker states
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  
  // Rate limiting
  private rateLimitStates: Map<string, RateLimitState> = new Map();
  
  // Metrics
  private operationMetrics: Map<string, any> = new Map();
  
  // Maximum total retry duration
  private readonly MAX_TOTAL_RETRY_DURATION_MS = 180000; // 3 minutes
  
  // Logger
  private logger = {
    log: (message: string, ...args: any[]) => console.log(`[Gemini] ${message}`, ...args),
    error: (message: string, ...args: any[]) => console.error(`[Gemini-ERROR] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => console.warn(`[Gemini-WARN] ${message}`, ...args)
  };

  constructor(apiKey: string, errorHandler: ErrorHandlingSystem) {
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }
    this.apiKey = apiKey;
    this.errorHandler = errorHandler;
    this.initializeCircuitBreakers();
    this.initializeRateLimiting();
    this.logger.log('✅ Gemini Integration initialized successfully');
  }

  // ===== INITIALIZATION =====

  private initializeCircuitBreakers(): void {
    const endpoints = ['generateContent', 'streamGenerateContent'];
    endpoints.forEach(endpoint => {
      this.circuitBreakers.set(endpoint, {
        failures: 0,
        lastFailure: 0,
        state: 'closed',
        threshold: 5,
        timeout: 60000, // 1 minute
        successCount: 0,
        totalRequests: 0,
        errorRate: 0
      });
    });
  }

  private initializeRateLimiting(): void {
    this.rateLimitStates.set('global', {
      count: 0,
      resetTime: Date.now() + 60000,
      windowMs: 60000,
      maxRequests: 50
    });
  }

  // ===== CORE PUBLIC METHODS =====

  /**
   * Analyze character image to extract visual DNA
   * Uses Gemini's vision capabilities for forensic character analysis
   */
  public async analyzeCharacterImage(
    imageUrl: string,
    artStyle: string
  ): Promise<CharacterAnalysis> {
    this.logger.log('🔍 Analyzing character image with Gemini Vision...', { imageUrl, artStyle });
    
    try {
      // Fetch image as base64
      const base64Image = await this.fetchImageAsBase64(imageUrl);
      
      // Build analysis prompt
      const analysisPrompt = this.buildCharacterAnalysisPrompt(artStyle);
      
      // Call Gemini with image + prompt
      const response = await this.generateWithRetry<GeminiResponse>({
        contents: [{
          parts: [
            { text: analysisPrompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.3,
          thinking_mode: true,
          max_output_tokens: 2000
        }
      }, 'analyzeCharacterImage');
      
      // Parse response
      const analysisText = this.extractTextFromResponse(response);
      const analysis = this.parseCharacterAnalysis(analysisText);
      
      this.logger.log('✅ Character analysis complete', { 
        descriptionLength: analysis.description.length,
        distinctiveFeatures: analysis.distinctiveFeatures.length
      });
      
      return analysis;
      
    } catch (error) {
      this.logger.error('❌ Character image analysis failed:', error);
      throw this.handleGeminiError(error, 'analyzeCharacterImage');
    }
  }

  /**
   * Generate cartoon from photo using image-to-image transformation
   * CRITICAL: This uses the actual photo as input, not text description
   */
  public async generateCartoonFromPhoto(
    photoUrl: string,
    artStyle: string,
    analysis: CharacterAnalysis
  ): Promise<string> {
    this.logger.log('🎨 Generating cartoon from photo with Gemini...', { photoUrl, artStyle });
    
    try {
      // Fetch photo as base64
      const base64Photo = await this.fetchImageAsBase64(photoUrl);
      
      // Build cartoonization prompt
      const cartoonPrompt = this.buildCartoonizationPrompt(artStyle, analysis);
      
      // Call Gemini with photo + prompt
      const response = await this.generateWithRetry<GeminiResponse>({
        contents: [{
          parts: [
            { text: cartoonPrompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Photo
              }
            }
          ]
        }],
        generationConfig: {
          image_size: '1K',
          thinking_mode: true,
          temperature: 0.7
        }
      }, 'generateCartoonFromPhoto');
      
      // Extract generated image URL (now uploads to Cloudinary)
      const imageUrl = await this.extractImageUrlFromResponse(response);
      
      this.logger.log('✅ Cartoon generated successfully', { imageUrl });
      
      return imageUrl;
      
    } catch (error) {
      this.logger.error('❌ Cartoon generation failed:', error);
      throw this.handleGeminiError(error, 'generateCartoonFromPhoto');
    }
  }

  /**
   * Generate panel with character using image-based reference
   * CRITICAL: Gemini SEES the actual cartoon image for perfect consistency
   */
  public async generatePanelWithCharacter(
    cartoonImageUrl: string,
    sceneDescription: string,
    emotion: string,
    options: PanelOptions
  ): Promise<string> {
    this.logger.log('🎬 Generating panel with character reference...', { 
      cartoonImageUrl, 
      emotion, 
      artStyle: options.artStyle 
    });
    
    try {
      // Fetch cartoon image as base64
      const base64Cartoon = await this.fetchImageAsBase64(cartoonImageUrl);
      
      // Build panel generation prompt
      const panelPrompt = this.buildPanelGenerationPrompt(
        sceneDescription,
        emotion,
        options
      );
      
      // Call Gemini with cartoon image + scene description
      const response = await this.generateWithRetry<GeminiResponse>({
        contents: [{
          parts: [
            { text: panelPrompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Cartoon
              }
            }
          ]
        }],
        generationConfig: {
          image_size: options.resolution || '2K',
          thinking_mode: options.thinkingMode !== false,
          temperature: options.temperature || 0.7
        }
      }, 'generatePanelWithCharacter');
      
      // Extract generated panel URL (now uploads to Cloudinary)
      const panelUrl = await this.extractImageUrlFromResponse(response);
      
      this.logger.log('✅ Panel generated successfully', { panelUrl });
      
      return panelUrl;
      
    } catch (error) {
      this.logger.error('❌ Panel generation failed:', error);
      throw this.handleGeminiError(error, 'generatePanelWithCharacter');
    }
  }

  /**
   * Generate text completion (for story analysis, no images)
   */
  public async generateTextCompletion(
    prompt: string,
    options: Partial<GeminiGenerationConfig> = {}
  ): Promise<string> {
    this.logger.log('📝 Generating text completion...');
    
    try {
      const response = await this.generateWithRetry<GeminiResponse>({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: options.temperature || 0.7,
          max_output_tokens: options.max_output_tokens || 2000,
          top_p: options.top_p,
          top_k: options.top_k
        }
      }, 'generateTextCompletion');
      
      const text = this.extractTextFromResponse(response);
      
      this.logger.log('✅ Text completion generated', { length: text.length });
      
      return text;
      
    } catch (error) {
      this.logger.error('❌ Text completion failed:', error);
      throw this.handleGeminiError(error, 'generateTextCompletion');
    }
  }

  /**
   * Generate vision completion (text + images)
   */
  public async generateVisionCompletion(
    prompt: string,
    imageUrls: string | string[],
    options: Partial<GeminiGenerationConfig> = {}
  ): Promise<string> {
    this.logger.log('👁️ Generating vision completion...', { 
      imageCount: Array.isArray(imageUrls) ? imageUrls.length : 1 
    });
    
    try {
      const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
      
      // Fetch all images as base64
      const imageParts: GeminiImagePart[] = await Promise.all(
        urls.map(async (url) => ({
          inline_data: {
            mime_type: 'image/jpeg',
            data: await this.fetchImageAsBase64(url)
          }
        }))
      );
      
      // Build request with text and images
      const response = await this.generateWithRetry<GeminiResponse>({
        contents: [{
          parts: [
            { text: prompt },
            ...imageParts
          ]
        }],
        generationConfig: {
          temperature: options.temperature || 0.7,
          max_output_tokens: options.max_output_tokens || 2000,
          thinking_mode: true
        }
      }, 'generateVisionCompletion');
      
      const text = this.extractTextFromResponse(response);
      
      this.logger.log('✅ Vision completion generated', { length: text.length });
      
      return text;
      
    } catch (error) {
      this.logger.error('❌ Vision completion failed:', error);
      throw this.handleGeminiError(error, 'generateVisionCompletion');
    }
  }

  // ===== PROMPT BUILDERS =====

  private buildCharacterAnalysisPrompt(artStyle: string): string {
    return `CRITICAL CHARACTER DNA EXTRACTION - FORENSIC ANALYSIS FOR ${artStyle.toUpperCase()} COMIC GENERATION

You are analyzing this character photo to create a COMPREHENSIVE visual blueprint for a professional comic book.
This analysis will be the SINGLE SOURCE OF TRUTH for maintaining 100% character consistency across 24 panels.

Extract EVERY visual detail with EXTREME precision:

1. FACIAL ARCHITECTURE (NEVER changes):
   - Face shape: EXACT geometric description (oval/round/square/heart/diamond)
   - Eyes: Precise shape, size, color with hex/name, spacing between eyes, distinctive features
   - Eyebrows: Exact thickness, arch shape, color, natural position
   - Nose: Specific type (button/roman/aquiline/straight), bridge width, nostril shape
   - Mouth/Lips: Exact size, fullness, natural resting expression, teeth visibility
   - Ears: Size, shape, angle, any distinctive features
   - Chin/Jawline: Precise structure, definition level
   - Distinctive marks: ANY moles, freckles, scars, dimples with EXACT placement

2. HAIR SPECIFICATIONS (Maintain PERFECTLY):
   - Style: Exact cut name, length measurements, layering, how it falls
   - Texture: Specific type (straight/wavy/curly/kinky) with curl pattern if applicable
   - Color: PRECISE shade with highlights, undertones, roots if visible
   - Unique features: Cowlicks, parts (side/center/none), baby hairs, hairline shape
   - Volume and density

3. BODY CHARACTERISTICS (Keep CONSISTENT):
   - Build: Specific body type (ectomorph/mesomorph/endomorph) with proportions
   - Height indicators: Relative to standard reference points
   - Shoulder width and slope
   - Posture: Natural stance, spine curve, head carriage
   - Visible age indicators

4. SKIN & COMPLEXION:
   - Skin tone: EXACT shade description with undertones (warm/cool/neutral)
   - Texture: Smooth/freckled/textured
   - Unique features: Beauty marks, skin characteristics, tone variations

5. DISTINCTIVE IDENTIFIERS (ALWAYS include):
   - Accessories: Glasses (exact style and color), jewelry (describe each piece)
   - Signature clothing elements
   - Unique features that make them instantly recognizable

6. COLOR PALETTE DNA:
   - Primary colors: Main 3-4 colors that define this character
   - Skin tone: Specific color with undertones
   - Hair color: Exact shade name
   - Eye color: Precise color description
   - Clothing colors: Dominant palette

7. EXPRESSION BASELINE:
   - Natural resting expression
   - Typical emotional register
   - Smile characteristics

Return a DETAILED, STRUCTURED analysis. Every detail matters for visual consistency.`;
  }

  private buildCartoonizationPrompt(artStyle: string, analysis: CharacterAnalysis): string {
    return `Create a professional ${artStyle} cartoon character from this photo for a comic book series.

CRITICAL REQUIREMENTS:
- Maintain EXACT facial features, proportions, and distinctive characteristics from the photo
- Transform into ${artStyle} art style while preserving identity
- Keep all unique identifiers (facial features, hair, expression)
- Suitable for professional comic book publication
- Clear, bold features perfect for panel-to-panel consistency
- Professional quality, publication-ready artwork

CHARACTER SPECIFICATIONS TO PRESERVE:
${analysis.description}

DISTINCTIVE FEATURES (MUST maintain):
${analysis.distinctiveFeatures.join(', ')}

ART STYLE REQUIREMENTS:
- Style: ${artStyle}
- Quality: Professional comic book grade
- Line work: Clean, bold, consistent
- Colors: Vibrant, publication-ready
- Expression: ${analysis.expressionBaseline}

OUTPUT REQUIREMENTS:
- High resolution for printing
- Neutral background (white or simple)
- Character centered, full visibility
- Perfect for reference in subsequent panels

Create the cartoon that will serve as the MASTER REFERENCE for all 24 comic panels.`;
  }

  private buildPanelGenerationPrompt(
    sceneDescription: string,
    emotion: string,
    options: PanelOptions
  ): string {
    return `Create a ${options.artStyle} comic book panel with EXACT character consistency.

CRITICAL: The character in the reference image MUST look IDENTICAL in this panel.
Do NOT change facial features, hair, body type, or distinctive characteristics.

SCENE DESCRIPTION:
${sceneDescription}

CHARACTER REQUIREMENTS:
- Use the EXACT character appearance from the reference image
- Maintain ALL distinctive features perfectly
- Emotion: ${emotion}
- Expression should show ${emotion} while keeping facial structure identical

COMPOSITION REQUIREMENTS:
- Panel Type: ${options.panelType || 'medium shot'}
- Camera Angle: ${options.cameraAngle || 'eye level'}
- Lighting: ${options.lighting || 'natural'}
- Background: ${options.backgroundComplexity || 'moderate detail'}

ART STYLE REQUIREMENTS:
- Style: ${options.artStyle}
- Professional comic book quality
- Clean line work
- Consistent with master character design
- Publication-ready artwork

CRITICAL CONSISTENCY RULES:
1. Character MUST look exactly like reference image
2. Facial features MUST be identical
3. Hair style and color MUST match exactly
4. Body proportions MUST be consistent
5. Clothing should match unless scene specifies otherwise
6. Art style MUST be consistent with reference

Focus on maintaining PERFECT character consistency while creating an engaging panel.`;
  }

  // ===== HELPER METHODS =====

  /**
   * Fetch image from URL and convert to base64
   */
  private async fetchImageAsBase64(imageUrl: string): Promise<string> {
    try {
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      
      this.logger.log('✅ Image fetched and converted to base64', { 
        url: imageUrl.substring(0, 50) + '...',
        sizeKB: Math.round(base64.length / 1024)
      });
      
      return base64;
      
    } catch (error) {
      this.logger.error('❌ Failed to fetch image:', error);
      throw new AINetworkError('Failed to fetch image for Gemini', {
        service: 'GeminiIntegration',
        operation: 'fetchImageAsBase64',
        details: { imageUrl, error: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  /**
   * Upload base64 image data to Cloudinary
   * Converts Gemini's base64 responses to permanent Cloudinary URLs
   * 
   * @param base64Data - Base64 encoded image data (without data URL prefix)
   * @param folder - Cloudinary folder path
   * @returns Permanent Cloudinary URL
   */
  private async uploadToCloudinary(
    base64Data: string, 
    folder: string = 'storybook-panels'
  ): Promise<string> {
    try {
      this.logger.log('☁️ Uploading image to Cloudinary...');
      
      // Import cloudinary (should already be available in worker)
      const cloudinary = require('cloudinary').v2;
      
      // Cloudinary is already configured via environment variables in the worker
      // No need to call cloudinary.config() here - it's done at startup
      
      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Upload to Cloudinary using upload_stream
      const uploadResult = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { 
            resource_type: 'image',
            folder: folder,
            quality: 'auto:good',
            format: 'jpg',
            transformation: [
              { quality: 'auto:good' }
            ]
          },
          (error: any, result: any) => {
            if (error) {
              this.logger.error('❌ Cloudinary upload error:', error);
              reject(error);
            } else {
              resolve(result);
            }
          }
        ).end(buffer);
      });
      
      if (!uploadResult || !uploadResult.secure_url) {
        throw new Error('Cloudinary upload failed - no URL returned');
      }
      
      this.logger.log('✅ Image uploaded to Cloudinary', { 
        url: uploadResult.secure_url.substring(0, 60) + '...',
        publicId: uploadResult.public_id
      });
      
      return uploadResult.secure_url;
      
    } catch (error) {
      this.logger.error('❌ Cloudinary upload failed:', error);
      throw new AIServiceUnavailableError(
        `Failed to upload image to Cloudinary: ${error instanceof Error ? error.message : String(error)}`,
        {
          service: 'GeminiIntegration',
          operation: 'uploadToCloudinary',
          details: { error }
        }
      );
    }
  }

  /**
   * Extract text from Gemini response
   */
  private extractTextFromResponse(response: GeminiResponse): string {
    if (response.error) {
      throw new Error(`Gemini API error: ${response.error.message}`);
    }
    
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new AIValidationError('No text in Gemini response', {
        service: 'GeminiIntegration',
        operation: 'extractTextFromResponse',
        details: { response }
      });
    }
    
    return text;
  }

  /**
   * Extract image URL from Gemini response
   */
  private async extractImageUrlFromResponse(response: GeminiResponse): Promise<string> {
    if (response.error) {
      throw new Error(`Gemini API error: ${response.error.message}`);
    }
    
    // Gemini returns generated images as base64 in inline_data
    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      part => part.inline_data
    );
    
    if (!imagePart?.inline_data?.data) {
      throw new AIValidationError('No image in Gemini response', {
        service: 'GeminiIntegration',
        operation: 'extractImageUrlFromResponse',
        details: { response }
      });
    }
    
    const base64Data = imagePart.inline_data.data;
    
    // Upload to Cloudinary and return permanent URL
    this.logger.log('📤 Converting Gemini base64 to Cloudinary URL...');
    const cloudinaryUrl = await this.uploadToCloudinary(base64Data, 'storybook-panels');
    
    return cloudinaryUrl;  // Now returns permanent Cloudinary URL
  }

  /**
   * Parse character analysis from Gemini text response
   */
  private parseCharacterAnalysis(analysisText: string): CharacterAnalysis {
    // Extract structured data from the analysis text
    // This is a simplified parser - in production you might use more sophisticated parsing
    
    return {
      description: analysisText,
      facialFeatures: this.extractSection(analysisText, 'FACIAL ARCHITECTURE'),
      bodyType: this.extractSection(analysisText, 'BODY CHARACTERISTICS'),
      clothing: this.extractSection(analysisText, 'DISTINCTIVE IDENTIFIERS'),
      distinctiveFeatures: this.extractList(analysisText, 'Distinctive marks'),
      colorPalette: this.extractSection(analysisText, 'COLOR PALETTE DNA'),
      skinTone: this.extractValue(analysisText, 'Skin tone'),
      hairDetails: this.extractSection(analysisText, 'HAIR SPECIFICATIONS'),
      expressionBaseline: this.extractValue(analysisText, 'EXPRESSION BASELINE') || 'neutral'
    };
  }

  private extractSection(text: string, sectionName: string): any {
    const lines = text.split('\n');
    const sectionStart = lines.findIndex(line => line.includes(sectionName));
    
    if (sectionStart === -1) return {};
    
    const sectionLines: string[] = [];
    for (let i = sectionStart + 1; i < lines.length; i++) {
      if (lines[i].match(/^\d+\./)) break; // Next numbered section
      sectionLines.push(lines[i]);
    }
    
    return sectionLines.join('\n').trim();
  }

  private extractValue(text: string, key: string): string {
    const match = text.match(new RegExp(`${key}:?\\s*(.+?)(?:\\n|$)`, 'i'));
    return match ? match[1].trim() : '';
  }

  private extractList(text: string, key: string): string[] {
    const value = this.extractValue(text, key);
    return value ? value.split(',').map(item => item.trim()) : [];
  }

  /**
   * Generate with retry logic and circuit breaker
   */
  private async generateWithRetry<T>(
    request: GeminiRequest,
    operationName: string,
    maxRetries: number = 3
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: any;
    const breaker = this.circuitBreakers.get('generateContent');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check circuit breaker
        if (breaker && breaker.state === 'open') {
          const timeSinceLastFailure = Date.now() - breaker.lastFailure;
          if (timeSinceLastFailure < breaker.timeout) {
            throw new AIServiceUnavailableError(
              'Circuit breaker is open for Gemini API',
              {
                service: 'GeminiIntegration',
                operation: operationName,
                details: { breaker }
              }
            );
          } else {
            breaker.state = 'half-open';
            this.logger.log('🔄 Circuit breaker half-open, attempting request');
          }
        }
        
        // Check if we've exceeded max total retry duration
        if (attempt > 1 && Date.now() - startTime > this.MAX_TOTAL_RETRY_DURATION_MS) {
          throw new AITimeoutError(
            `Operation ${operationName} exceeded maximum retry duration`,
            {
              service: 'GeminiIntegration',
              operation: operationName,
              details: { totalDuration: Date.now() - startTime }
            }
          );
        }
        
        // Apply retry delay
        if (attempt > 1) {
          const baseDelay = 1000;
          const maxDelay = 30000;
          let delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
          const jitter = Math.random() * 0.3 * delay;
          delay = Math.round(delay + jitter);
          
          if (lastError instanceof AIRateLimitError) {
            delay = Math.min(delay * 2, 60000);
          }
          
          this.logger.warn(`⏳ Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Execute API call
        const result = await this.executeGeminiCall<T>(request, operationName);
        
        // Update circuit breaker on success
        if (breaker) {
          if (breaker.state === 'half-open') {
            breaker.successCount++;
            if (breaker.successCount >= 3) {
              breaker.state = 'closed';
              breaker.failures = 0;
              breaker.successCount = 0;
              this.logger.log('✅ Circuit breaker closed');
            }
          } else if (breaker.state === 'closed') {
            breaker.failures = 0;
          }
        }
        
        // Record metrics
        this.recordOperationMetrics(operationName, Date.now() - startTime, true);
        
        if (attempt > 1) {
          this.logger.log(`✅ Retry successful on attempt ${attempt}`);
        }
        
        return result;
        
      } catch (error: any) {
        lastError = error;
        
        const isRetryable = 
          error instanceof AIRateLimitError ||
          error instanceof AITimeoutError ||
          (error instanceof AIServiceUnavailableError && error.details?.httpStatus !== 400);
        
        this.logger.error(`❌ Attempt ${attempt}/${maxRetries} failed:`, {
          error: error.message,
          errorType: error.constructor.name,
          isRetryable
        });
        
        if (!isRetryable || attempt === maxRetries) {
          if (breaker) {
            breaker.failures++;
            breaker.lastFailure = Date.now();
            if (breaker.failures >= breaker.threshold) {
              breaker.state = 'open';
              this.logger.error(`🚫 Circuit breaker opened after ${breaker.failures} failures`);
            }
          }
          
          this.recordOperationMetrics(operationName, Date.now() - startTime, false);
          throw error;
        }
        
        if (error instanceof AIContentPolicyError) {
          throw error;
        }
      }
    }
    
    throw lastError || new AIServiceUnavailableError(
      'Failed after all retry attempts',
      {
        service: 'GeminiIntegration',
        operation: operationName,
        details: { attempts: maxRetries }
      }
    );
  }

  /**
   * Execute Gemini API call
   */
  private async executeGeminiCall<T>(
    request: GeminiRequest,
    operationName: string
  ): Promise<T> {
    const endpoint = `${this.baseUrl}/${this.defaultModel}:generateContent`;
    
    try {
      this.logger.log('🔄 Calling Gemini API...', { operation: operationName });
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-goog-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw this.createErrorFromResponse(response.status, data);
      }
      
      return data as T;
      
    } catch (error) {
      if (error instanceof BaseServiceError) {
        throw error;
      }
      
      this.logger.error('❌ Gemini API call failed:', error);
      throw new AINetworkError('Gemini API request failed', {
        service: 'GeminiIntegration',
        operation: operationName,
        details: { error: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  /**
   * Create appropriate error from Gemini API response
   */
  private createErrorFromResponse(status: number, data: any): BaseServiceError {
    const message = data.error?.message || 'Gemini API error';
    const context = {
      service: 'GeminiIntegration',
      operation: 'geminiAPICall',
      details: { httpStatus: status, data }
    };
    
    if (status === 401 || status === 403) {
      return new AIAuthenticationError(`Gemini authentication failed: ${message}`, context);
    }
    
    if (status === 429) {
      return new AIRateLimitError(`Gemini rate limit exceeded: ${message}`, context);
    }
    
    if (status === 400 && message.toLowerCase().includes('safety')) {
      return new AIContentPolicyError(`Gemini content policy violation: ${message}`, context);
    }
    
    if (status >= 500) {
      return new AIServiceUnavailableError(`Gemini service error: ${message}`, context);
    }
    
    return new AIServiceUnavailableError(`Gemini API error: ${message}`, context);
  }

  /**
   * Handle and transform Gemini errors
   */
  private handleGeminiError(error: any, operation: string): BaseServiceError {
    if (error instanceof BaseServiceError) {
      return error;
    }
    
    return new AIServiceUnavailableError(
      `Gemini ${operation} failed: ${error.message || String(error)}`,
      {
        service: 'GeminiIntegration',
        operation,
        details: { originalError: error }
      }
    );
  }

  /**
   * Record operation metrics
   */
  private recordOperationMetrics(
    operation: string,
    duration: number,
    success: boolean
  ): void {
    const existing = this.operationMetrics.get(operation) || {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalDuration: 0,
      avgDuration: 0
    };
    
    existing.totalCalls++;
    if (success) {
      existing.successfulCalls++;
    } else {
      existing.failedCalls++;
    }
    existing.totalDuration += duration;
    existing.avgDuration = existing.totalDuration / existing.totalCalls;
    
    this.operationMetrics.set(operation, existing);
  }

  /**
   * Get operation metrics
   */
  public getMetrics(): Map<string, any> {
    return new Map(this.operationMetrics);
  }

  /**
   * Get health status
   */
  public getHealthStatus(): any {
    return {
      circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([name, state]) => ({
        name,
        ...state
      })),
      rateLimits: Array.from(this.rateLimitStates.entries()).map(([name, state]) => ({
        name,
        ...state
      })),
      metrics: Object.fromEntries(this.operationMetrics)
    };
  }
}

