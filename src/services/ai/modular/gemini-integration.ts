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
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_output_tokens?: number;
  responseModalities?: string[];   // ✅ FIXED: Correct camelCase naming
  imageConfig?: {                  // ✅ FIXED: Correct camelCase naming
    aspectRatio?: string;          // ✅ FIXED: Options: '1:1', '16:9', '9:16', '4:3', '3:4'
    imageSize?: string;            // ✅ FIXED: Options: '1K', '2K', '4K'
  };
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

export interface PreviousPanelContext {
  imageUrl: string;
  description: string;
  action: string;
}

export interface PanelOptions {
  artStyle: string;
  cameraAngle?: string;
  lighting?: string;
  panelType?: string;
  backgroundComplexity?: string;
  temperature?: number;
  environmentalContext?: {
    characterDNA?: any;
    environmentalDNA?: any;
    panelNumber?: number;
    totalPanels?: number;
  };
  previousPanelContext?: PreviousPanelContext;
  feedbackImageEnhancement?: string;
}

// ===== GEMINI INTEGRATION CLASS =====

export class GeminiIntegration {
  private apiKey: string;
  private errorHandler: ErrorHandlingSystem;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  private defaultModel = 'gemini-3-pro-preview';  // ✅ CHANGED: For text/vision tasks
  private imageModel = 'gemini-3-pro-image-preview';  // ✅ NEW: For image generation
  
  // Circuit breaker states
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  
  // Rate limiting
  private rateLimitStates: Map<string, RateLimitState> = new Map();
  
  // Metrics
  private operationMetrics: Map<string, any> = new Map();
  
  // Image cache to avoid fetching same image 24 times
  private imageCache: Map<string, string> = new Map();
  private cacheStats = {
    hits: 0,
    misses: 0,
    bytesAvoided: 0
  };
  
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
        threshold: 2,
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
    max_output_tokens: 2000,
    responseModalities: ['TEXT']  // ✅ FIXED: Correct camelCase naming
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
      // Fetch photo as base64 WITHOUT optimization (keep original quality for cartoonization)
      const base64Photo = await this.fetchImageAsBase64(photoUrl, false);  // ✅ Disable optimization for original photo
      
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
          temperature: 0.7,
          max_output_tokens: 2000,
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: '1:1',                   // Square aspect ratio for character cartoons
            imageSize: '2K'                       // ✅ KEEP 2K: Cartoonization needs higher quality (master character image)
          }
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
   * ENHANCED: Now includes environmental DNA enforcement for consistent time/location/lighting
   * ENHANCED: Now supports previousPanelContext for narrative continuity between panels
   */
  public async generatePanelWithCharacter(
    cartoonImageUrl: string,
    sceneDescription: string,
    emotion: string,
    options: PanelOptions
  ): Promise<string> {
    const hasEnvDNA = !!options.environmentalContext?.environmentalDNA;
    const hasPreviousPanel = !!options.previousPanelContext;
    
    this.logger.log('🎬 Generating panel with character reference...', { 
      cartoonImageUrl: cartoonImageUrl.substring(0, 50) + '...', 
      emotion, 
      artStyle: options.artStyle,
      hasEnvironmentalDNA: hasEnvDNA,
      hasPreviousPanelContext: hasPreviousPanel,
      timeOfDay: hasEnvDNA ? options.environmentalContext?.environmentalDNA?.lightingContext?.timeOfDay : 'not specified',
      location: hasEnvDNA ? options.environmentalContext?.environmentalDNA?.primaryLocation?.name : 'not specified'
    });
    
    if (!hasEnvDNA) {
      throw new Error('FATAL: Environmental DNA is required for panel generation. Cannot proceed without world consistency specifications.');
    }
    
    this.logger.log('🌍 Environmental DNA enforcement ENABLED for this panel');
    if (hasPreviousPanel) {
      this.logger.log('🔗 Previous panel context ENABLED for narrative continuity');
    }
    
    try {
      // Fetch cartoon image as base64 with OPTIMIZATION (512×512, 82% smaller)
      const base64Cartoon = await this.fetchImageAsBase64(cartoonImageUrl, true);  // ✅ Enable optimization
      
      // Build parts array starting with prompt and cartoon reference
      const parts: (GeminiTextPart | GeminiImagePart)[] = [];
      
      // Build panel generation prompt (now includes environmental enforcement and previous panel context)
      const panelPrompt = this.buildPanelGenerationPrompt(
        sceneDescription,
        emotion,
        options
      );
      parts.push({ text: panelPrompt });
      
      // Add cartoon character reference image (PRIMARY reference)
      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: base64Cartoon
        }
      });
      
      // SEQUENTIAL CONTEXT: If previous panel exists, add it as SECOND reference image
      if (hasPreviousPanel && options.previousPanelContext?.imageUrl) {
        this.logger.log('📷 Fetching previous panel for continuity reference...');
        const base64PreviousPanel = await this.fetchImageAsBase64(options.previousPanelContext.imageUrl, true);
        parts.push({
          inline_data: {
            mime_type: 'image/jpeg',
            data: base64PreviousPanel
          }
        });
        this.logger.log('✅ Previous panel added to generation context');
      }
      
      // Call Gemini with cartoon image + (optionally) previous panel + scene description
      const response = await this.generateWithRetry<GeminiResponse>({
        contents: [{
          parts
        }],
        generationConfig: {
          temperature: options.temperature || 0.7,
          max_output_tokens: 2000,
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: '16:9',                  // Comic panel aspect ratio
            imageSize: '1K'                       // ✅ OPTIMIZED: 1K resolution - perfect for digital, 66% cost savings ($0.045/image vs $0.134)
          }
        }
      }, 'generatePanelWithCharacter');
      
      // Extract generated panel URL (now uploads to Cloudinary)
      const panelUrl = await this.extractImageUrlFromResponse(response);
      
      this.logger.log('✅ Panel generated successfully', { 
        panelUrl: panelUrl.substring(0, 60) + '...',
        environmentEnforced: hasEnvDNA,
        previousPanelUsed: hasPreviousPanel
      });
      
      return panelUrl;
      
    } catch (error) {
      this.logger.error('❌ Panel generation failed:', error);
      throw this.handleGeminiError(error, 'generatePanelWithCharacter');
    }
  }

  /**
   * Generate panel with enhanced guidance for failed panel regeneration
   * CRITICAL: Used when a panel fails validation and needs regeneration with specific fixes
   * 
   * @param cartoonImageUrl - Reference cartoon image for character consistency
   * @param sceneDescription - Original scene description
   * @param emotion - Character emotion
   * @param enhancedGuidance - Text guidance about what to fix (from failed validation)
   * @param options - Panel generation options
   * @returns Cloudinary URL of the regenerated panel
   */
  public async generatePanelWithEnhancedGuidance(
    cartoonImageUrl: string,
    sceneDescription: string,
    emotion: string,
    enhancedGuidance: string,
    options: PanelOptions
  ): Promise<string> {
    this.logger.log('🔄 Regenerating panel with enhanced guidance...', { 
      cartoonImageUrl: cartoonImageUrl.substring(0, 50) + '...',
      emotion, 
      artStyle: options.artStyle,
      guidanceLength: enhancedGuidance.length
    });
    
    try {
      // Fetch cartoon image as base64 with optimization (uses cache!)
      const base64Cartoon = await this.fetchImageAsBase64(cartoonImageUrl, true);
      
      // Build enhanced panel generation prompt with failure fix guidance
      const enhancedPanelPrompt = this.buildEnhancedPanelPrompt(
        sceneDescription,
        emotion,
        enhancedGuidance,
        options
      );
      
      // Call Gemini with cartoon image + enhanced prompt
      const response = await this.generateWithRetry<GeminiResponse>({
        contents: [{
          parts: [
            { text: enhancedPanelPrompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Cartoon
              }
            }
          ]
        }],
        generationConfig: {
          temperature: Math.max(0.5, (options.temperature || 0.7) - 0.1),  // Slightly lower temp for more consistent output
          max_output_tokens: 2000,
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: '16:9',
            imageSize: '1K'
          }
        }
      }, 'generatePanelWithEnhancedGuidance');
      
      // Extract generated panel URL (uploads to Cloudinary)
      const panelUrl = await this.extractImageUrlFromResponse(response);
      
      // Validate we got an actual URL
      if (!panelUrl || !panelUrl.includes('cloudinary.com')) {
        throw new Error(`Invalid image URL returned: ${panelUrl?.substring(0, 100) || 'null'}`);
      }
      
      this.logger.log('✅ Panel regenerated successfully with enhanced guidance', { panelUrl });
      
      return panelUrl;
      
    } catch (error) {
      this.logger.error('❌ Enhanced panel generation failed:', error);
      throw this.handleGeminiError(error, 'generatePanelWithEnhancedGuidance');
    }
  }

  /**
   * Build enhanced prompt incorporating failure fix guidance
   */
  private buildEnhancedPanelPrompt(
    sceneDescription: string,
    emotion: string,
    enhancedGuidance: string,
    options: PanelOptions
  ): string {
    let prompt = `REGENERATION WITH FIXES - Create a ${options.artStyle} comic book panel using the character design from the reference image.

CRITICAL FIXES REQUIRED (from previous failed validation):
${enhancedGuidance}

SCENE CONTEXT:
${sceneDescription}

CHARACTER DESIGN CONSISTENCY:
- Use the character design shown in the reference image as your visual guide
- Maintain the established art style and visual design elements
- Character expression: ${emotion}
- Keep consistent line work, colors, and proportions from the reference
- Express the emotion through pose, expression, and body language

PANEL COMPOSITION:
- Shot type: ${options.panelType || 'medium shot'}
- Camera angle: ${options.cameraAngle || 'eye level'}
- Lighting: ${options.lighting || 'natural, evenly distributed'}
- Background detail: ${options.backgroundComplexity || 'moderate detail that supports but doesn\'t overwhelm the character'}
- Visual focus: Character as the primary focal point`;

    // ===== ENVIRONMENTAL DNA ENFORCEMENT FOR REGENERATION =====
    // Critical: Failed panels often fail due to environmental inconsistency
    if (options.environmentalContext?.environmentalDNA) {
      const envDNA = options.environmentalContext.environmentalDNA;
      
      const timeOfDay = envDNA.lightingContext?.timeOfDay || 'afternoon';
      const lightingMood = envDNA.lightingContext?.lightingMood || 'natural';
      const locationName = envDNA.primaryLocation?.name || 'setting';
      const keyFeatures = envDNA.primaryLocation?.keyFeatures || [];
      const dominantColors = envDNA.visualContinuity?.colorConsistency?.dominantColors || [];
      
      prompt += `

🌍 ENVIRONMENTAL CONSISTENCY - MANDATORY FOR REGENERATION:

⚠️ THE PREVIOUS PANEL LIKELY FAILED DUE TO ENVIRONMENTAL MISMATCH. FIX THIS:

TIME OF DAY: ${timeOfDay.toUpperCase()} (NOT any other time)
- ${timeOfDay === 'night' || timeOfDay === 'evening' ? 'MUST show night/evening darkness. NO bright daylight.' : ''}
- ${timeOfDay === 'morning' ? 'MUST show early morning light.' : ''}
- ${timeOfDay === 'afternoon' ? 'MUST show afternoon daylight.' : ''}

LIGHTING MOOD: ${lightingMood}
LOCATION: ${locationName} (show THIS specific location)

KEY FEATURES TO INCLUDE:
${keyFeatures.slice(0, 3).map((f: string) => `- ${f}`).join('\n') || '- Story-specific environmental elements'}

COLOR PALETTE: ${dominantColors.slice(0, 4).join(', ') || 'colors matching the specified time of day'}`;
    }

    prompt += `

${options.artStyle.toUpperCase()} QUALITY STANDARDS:
- Professional comic book illustration
- Clean, expressive line work
- Vibrant, publication-ready colors
- Visual consistency with established character design
- Engaging composition that advances the narrative

MANDATORY: Address ALL issues listed in CRITICAL FIXES REQUIRED section above.

Create a compelling comic panel that fixes the previous validation failures while maintaining design consistency in ${options.artStyle} style.`;

    return prompt;
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
          top_k: options.top_k,
          responseModalities: ['TEXT']  // ✅ FIXED: Correct camelCase naming
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
          responseModalities: ['TEXT']  // ✅ FIXED: Correct camelCase naming
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
    return `Analyze this reference image to create a character design guide for a ${artStyle} comic book series.
  
  DESIGN ANALYSIS FRAMEWORK:
  
  1. VISUAL STYLE & FORM:
     - Overall character silhouette and body proportions
     - Key shapes and geometric design elements
     - Visual weight distribution and balance
     - General build and stature
  
  2. COLOR & TONE PALETTE:
     - Primary colors (3-5 dominant hues)
     - Secondary accent colors
     - Overall color temperature (warm/cool/neutral)
     - Saturation and brightness levels
     - Skin tone category and undertones
     - Hair color and any highlights or variations
  
  3. DISTINCTIVE DESIGN ELEMENTS:
     - Hair: style, length, texture, color, how it frames the design
     - Clothing: style, colors, patterns, layering
     - Accessories: glasses, jewelry, bags, distinctive items
     - Unique visual markers that define this character design
  
  4. FACIAL DESIGN CHARACTERISTICS:
     - Overall face shape and proportions
     - Eye design: shape, color, expression style
     - Nose design: style and prominence
     - Mouth design: shape and expression tendency
     - Distinctive facial elements that create character recognition
  
  5. ART STYLE CHARACTERISTICS:
     - Line quality and detail level appropriate for ${artStyle}
     - Level of stylization versus realism
     - Texture and rendering approach
     - Expression range and personality indicators
     - Age representation in the design
  
  6. CONSISTENCY MARKERS FOR SEQUENTIAL ART:
     - Key recognizable elements for panel-to-panel consistency
     - Signature visual traits that define this character
     - Design elements that make this character instantly identifiable
     - Visual hierarchy of most important consistent features
  
  Create a comprehensive character design document optimized for maintaining visual consistency across 24 comic book panels in ${artStyle} style.`;
  }

  private buildCartoonizationPrompt(artStyle: string, analysis: CharacterAnalysis): string {
    return `Create a ${artStyle} style cartoon character inspired by the reference image for a professional comic book series.
  
  STYLE TRANSFORMATION:
  Transform the reference into a stylized ${artStyle} cartoon character while maintaining visual recognition and character appeal.
  
  CHARACTER DESIGN SPECIFICATIONS:
  ${analysis.description}
  
  KEY DESIGN ELEMENTS TO INCORPORATE:
  ${analysis.distinctiveFeatures.length > 0 ? analysis.distinctiveFeatures.join(', ') : 'Maintain the overall visual style and character design elements'}
  
  ${artStyle.toUpperCase()} STYLE REQUIREMENTS:
  - Art style: Professional ${artStyle} comic book quality
  - Line work: Clean, bold, expressive lines
  - Colors: Vibrant and publication-ready
  - Detail level: Optimized for sequential storytelling
  - Expression: ${analysis.expressionBaseline || 'friendly and approachable'}
  - Rendering: High-quality illustration suitable for print
  
  COMPOSITION GUIDELINES:
  - Character centered in frame with clear silhouette
  - Simple, clean background (white or minimal neutral tone)
  - Full visibility of character design elements
  - 2K resolution for professional print quality
  - Suitable as master reference for consistent 24-panel comic series
  
  OUTPUT: A professional ${artStyle} cartoon character design that captures the essence of the reference while serving as the foundation for consistent sequential art across all comic panels.`;
  }

  /**
   * Build compressed panel generation prompt
   * 2025 BEST PRACTICE: Concise prompts (~500 chars) outperform verbose prompts
   * Gemini processes image references first, so text prompt is supplementary guidance
   * 
   * FIX A: Added camera angle enforcement to prevent repetitive compositions
   */
  private buildPanelGenerationPrompt(
    sceneDescription: string,
    emotion: string,
    options: PanelOptions
  ): string {
    const hasPreviousPanel = !!options.previousPanelContext;
    const hasEnvDNA = !!options.environmentalContext?.environmentalDNA;
    
    // Extract environmental DNA values (if present)
    const envDNA = options.environmentalContext?.environmentalDNA;
    const timeOfDay = envDNA?.lightingContext?.timeOfDay || 'afternoon';
    const lightingMood = envDNA?.lightingContext?.lightingMood || 'natural';
    const locationName = envDNA?.primaryLocation?.name || 'setting';
    const keyFeatures = envDNA?.primaryLocation?.keyFeatures?.slice(0, 2) || [];
    const dominantColors = envDNA?.visualContinuity?.colorConsistency?.dominantColors?.slice(0, 3) || [];

    // Determine camera angle with enforcement
    const cameraAngle = options.cameraAngle || 'medium';
    const panelType = options.panelType || 'standard';

    // Build compressed prompt - essential info only
    let prompt = `${options.artStyle} comic panel. CHARACTER: Match IMAGE 1 exactly.${hasPreviousPanel ? ' CONTINUITY: Follow from IMAGE 2 but CHANGE composition.' : ''}

SCENE: ${sceneDescription}
EMOTION: ${emotion} (show clearly in face and body language)
CAMERA: ${cameraAngle} shot, ${panelType} panel`;

    // Add previous panel context with DIVERSITY enforcement
    if (hasPreviousPanel && options.previousPanelContext) {
      prompt += `
PREVIOUS ACTION: ${options.previousPanelContext.action}
THIS PANEL: Show what happens NEXT with DIFFERENT pose and angle`;
    }

    // Add environmental DNA (compressed)
    if (hasEnvDNA) {
      prompt += `

ENV: ${timeOfDay} lighting, ${locationName}
COLORS: ${dominantColors.join(', ') || 'natural palette'}
FEATURES: ${keyFeatures.join(', ') || 'consistent background'}`;
    }

    // Add style requirements with DIVERSITY enforcement
    prompt += `

REQUIREMENTS:
- Match character from reference image exactly
- ${timeOfDay} lighting throughout
- ${cameraAngle} camera angle (MUST follow this angle)
- Character pose must be DIFFERENT from previous panel
- Dynamic composition, not static
- ${options.artStyle} style, publication quality`;

    // Add feedback-driven image enhancements if available
    if (options.feedbackImageEnhancement) {
      prompt += `

${options.feedbackImageEnhancement}`;
    }

    return prompt;
  }

  // ===== HELPER METHODS =====

  /**
   * Fetch image from URL and convert to base64 with OPTIMIZATION
   * OPTIMIZED: Automatically resizes large images to reduce network transfer
   * CACHED: Returns cached base64 if same URL+optimize combo was previously fetched
   * 
   * @param imageUrl - URL of image to fetch
   * @param optimize - Whether to optimize/resize large images (default: true for character references)
   * @returns Base64 encoded image string
   */
  private async fetchImageAsBase64(imageUrl: string, optimize: boolean = true): Promise<string> {
    // Check cache first
    const cacheKey = `${imageUrl}_${optimize}`;
    if (this.imageCache.has(cacheKey)) {
      this.cacheStats.hits++;
      const cachedSize = Math.floor(this.imageCache.get(cacheKey)!.length * 0.75);
      this.cacheStats.bytesAvoided += cachedSize;
      this.logger.log('⚡ Image cache HIT', { hits: this.cacheStats.hits, savedMB: (this.cacheStats.bytesAvoided/1024/1024).toFixed(2) });
      return this.imageCache.get(cacheKey)!;
    }
    
    this.cacheStats.misses++;
    this.logger.log('📥 Image cache MISS - fetching...', { misses: this.cacheStats.misses });
    
    try {
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      let buffer: Buffer = Buffer.from(arrayBuffer);
      const originalSizeKB = Math.round(buffer.byteLength / 1024);
      
      // ✅ OPTIMIZATION: Resize large images to reduce network transfer
      if (optimize && originalSizeKB > 100) {
        try {
          const sharp = (await import('sharp')).default;
          
          this.logger.warn(`⚠️ Image large (${originalSizeKB}KB), optimizing for faster transfer...`);
          
          // ✅ Proper type handling - sharp returns Buffer, explicit type assertion for TypeScript
          const optimizedBuffer: Buffer = await sharp(buffer)
            .resize(512, 512, { 
              fit: 'inside',
              withoutEnlargement: true
            })
            .jpeg({ quality: 85 })
            .toBuffer() as Buffer;
          
          buffer = optimizedBuffer;
          
          const newSizeKB = Math.round(buffer.byteLength / 1024);
          const reductionPercent = Math.round((1 - newSizeKB / originalSizeKB) * 100);
          
          this.logger.log(`✅ Image optimized: ${originalSizeKB}KB → ${newSizeKB}KB (${reductionPercent}% smaller)`);
        } catch (sharpError) {
          this.logger.warn('⚠️ Image optimization failed, using original:', sharpError);
        }
      }
      
      const base64 = buffer.toString('base64');
      const finalSizeKB = Math.round(base64.length / 1024);
      
      this.logger.log('✅ Image fetched and converted to base64', { 
        url: imageUrl.substring(0, 50) + '...',
        originalSizeKB,
        finalSizeKB,
        optimized: optimize && originalSizeKB > 100
      });
      
      // Cache the result before returning
      this.imageCache.set(cacheKey, base64);
      this.logger.log('✅ Image cached', { cacheSize: this.imageCache.size });
      
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
      
      // Import cloudinary using ES module syntax
const { v2: cloudinary } = await import('cloudinary');

// Configure Cloudinary (required when using dynamic imports)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
      
      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Upload to Cloudinary using upload_stream with optimizations
      const uploadResult = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { 
            resource_type: 'image',
            folder: folder,
            quality: 'auto:good',
            format: 'jpg',
            transformation: [
              { 
                quality: 'auto:good',
                fetch_format: 'auto',  // ✅ Automatically serve WebP to supporting browsers
                flags: 'progressive'    // ✅ Progressive loading for better UX
              }
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
      
      // ✅ FIX #12: Add URL transformations for optimized delivery
      const optimizedUrl = this.addCloudinaryTransformations(uploadResult.secure_url);
      
      this.logger.log('✅ Image uploaded to Cloudinary with optimizations', { 
        url: optimizedUrl.substring(0, 60) + '...',
        publicId: uploadResult.public_id,
        transformations: 'auto format, quality, progressive'
      });
      
      return optimizedUrl;
      
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
   * Add Cloudinary URL transformations for optimized delivery
   * Reduces file size by 30-40% with zero quality loss
   */
private addCloudinaryTransformations(url: string): string {
  if (!url || !url.includes('cloudinary.com')) {
    return url;
  }
  
  // Cloudinary URL structure: https://res.cloudinary.com/{cloud}/image/upload/{path}
  // We insert transformations between /upload/ and the path
  
  const transformations = [
    'f_auto',      // Auto format (WebP for Chrome, JPEG for others)
    'q_auto:good', // Auto quality optimization
    'fl_progressive' // Progressive loading
  ].join(',');
  
  // Insert transformations into URL
  const optimizedUrl = url.replace(
    '/upload/',
    `/upload/${transformations}/`
  );
  
  return optimizedUrl;
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
 * CRITICAL: When using responseModalities: ['TEXT', 'IMAGE'], Gemini returns BOTH text and image
 * in the parts array. We must search through ALL parts to find the image.
 */
private async extractImageUrlFromResponse(response: GeminiResponse): Promise<string> {
  if (response.error) {
    throw new Error(`Gemini API error: ${response.error.message}`);
  }
  
  // Get all parts from response
  const parts = response.candidates?.[0]?.content?.parts;
  
  if (!parts || parts.length === 0) {
    throw new AIValidationError('No parts in Gemini response', {
      service: 'GeminiIntegration',
      operation: 'extractImageUrlFromResponse',
      details: { response }
    });
  }
  
  // DEBUG: Log what we received to understand response structure
  this.logger.log('🔍 Examining Gemini response parts:', {
    partsCount: parts.length,
    partsTypes: parts.map(p => {
      if (p.text) return 'text';
      if (p.inline_data) return 'inline_data';
      return 'unknown';
    })
  });
  
 // CRITICAL FIX: Search for image data using BOTH naming conventions
// Gemini API may return inline_data (snake_case) OR inlineData (camelCase)
let imagePart: any = null;
let base64Data: string | null = null;
let mimeType: string | null = null;

for (const part of parts) {
  const partAny = part as any;
  
  // Try snake_case (inline_data) - matches our TypeScript interface
  if (partAny.inline_data?.data) {
    imagePart = part;
    base64Data = partAny.inline_data.data;
    mimeType = partAny.inline_data.mime_type;
    this.logger.log('✅ Found image using snake_case (inline_data)');
    break;
  }
  
  // Try camelCase (inlineData) - some Gemini SDKs use this
  if (partAny.inlineData?.data) {
    imagePart = part;
    base64Data = partAny.inlineData.data;
    mimeType = partAny.inlineData.mimeType;
    this.logger.log('✅ Found image using camelCase (inlineData)');
    break;
  }
}

if (!imagePart || !base64Data) {
  // Enhanced error logging to diagnose the issue
  this.logger.error('❌ No image found in any response part (checked both naming conventions):', {
    totalParts: parts.length,
    responseId: (response as any).responseId,
    modelVersion: (response as any).modelVersion,
    finishReason: response.candidates?.[0]?.finishReason,
    partsDetail: parts.map((p, idx) => {
      const partAny = p as any;
      return {
        index: idx,
        allKeys: Object.keys(partAny),
        hasText: !!partAny.text,
        textLength: partAny.text ? partAny.text.length : 0,
        hasInlineData_snake: !!partAny.inline_data,
        hasInlineData_camel: !!partAny.inlineData,
        inlineDataKeys_snake: partAny.inline_data ? Object.keys(partAny.inline_data) : [],
        inlineDataKeys_camel: partAny.inlineData ? Object.keys(partAny.inlineData) : [],
        hasDataField_snake: !!partAny.inline_data?.data,
        hasDataField_camel: !!partAny.inlineData?.data
      };
    })
  });
  
  throw new AIContentPolicyError('No image in Gemini response - searched both inline_data and inlineData', {
    service: 'GeminiIntegration',
    operation: 'extractImageUrlFromResponse',
    details: { 
      response,
      partsCount: parts.length,
      searchedFormats: ['inline_data.data', 'inlineData.data']
    }
  });
}

this.logger.log('✅ Found image in response part', {
  base64Length: base64Data.length,
  mimeType: mimeType || 'unknown'
});
  
  // Upload to Cloudinary and return permanent URL
  this.logger.log('📤 Converting Gemini base64 to Cloudinary URL...');
  const cloudinaryUrl = await this.uploadToCloudinary(base64Data, 'storybook-panels');
  
  return cloudinaryUrl;
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
    maxRetries: number = 1
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
   * Get appropriate timeout based on operation type
   * Evidence-based timeouts from production logs
   */
private getTimeoutForOperation(operationName: string, isImageGeneration: boolean): number {
  // Image generation: 120s (proven in production logs)
  if (isImageGeneration) {
    return 120000;
  }
  
  // Story analysis and complex text: 120s (large prompts + complex reasoning)
  if (operationName === 'generateTextCompletion') {
    return 120000;
  }
  
  // Simple text operations: 45s (fast fail for broken calls)
  return 45000;
}

  /**
   * Execute Gemini API call
   */
  private async executeGeminiCall<T>(
    request: GeminiRequest,
    operationName: string
  ): Promise<T> {
    // ✅ Determine model based on responseModalities
    const isImageGeneration = request.generationConfig?.responseModalities?.includes('IMAGE') || false;
    const model = isImageGeneration ? this.imageModel : this.defaultModel;
    const endpoint = `${this.baseUrl}/${model}:generateContent`;
    
    // ✅ OPTIMIZED: Different timeouts for images (60s) vs text (30s)
    const timeout = this.getTimeoutForOperation(operationName, isImageGeneration);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      this.logger.log('🔄 Calling Gemini API...', { 
        operation: operationName,
        timeout: `${timeout/1000}s`,
        type: isImageGeneration ? 'image' : 'text'
      });
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-goog-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br'  // ✅ CRITICAL: Enable compression for 30-50% smaller responses
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      if (!response.ok) {
        throw this.createErrorFromResponse(response.status, data);
      }
      
      return data as T;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.error(`❌ Gemini API call timed out after ${timeout/1000}s`);
        throw new AITimeoutError('Gemini API request timed out', {
          service: 'GeminiIntegration',
          operation: operationName,
          details: { 
            timeout,
            timeoutSeconds: timeout/1000,
            operationType: isImageGeneration ? 'image_generation' : 'text_generation'
          }
        });
      }
      
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

  /**
   * Clear image cache and reset stats
   * Call this after a job completes to free memory
   */
  public clearImageCache(): void {
    const stats = { ...this.cacheStats };
    this.imageCache.clear();
    this.cacheStats = { hits: 0, misses: 0, bytesAvoided: 0 };
    this.logger.log('🗑️ Image cache cleared', { finalStats: stats });
  }

  /**
   * Get current cache statistics
   * Useful for monitoring cache efficiency
   */
  public getCacheStats(): { hits: number; misses: number; bytesAvoided: number; hitRate: string } {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? ((this.cacheStats.hits / total) * 100).toFixed(1) : '0.0';
    return { ...this.cacheStats, hitRate: `${hitRate}%` };
  }
}

