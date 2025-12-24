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
  // NEW: Track pose category to prevent repetitive poses in adjacent panels
  pose?: string;  // 'standing' | 'sitting' | 'walking' | 'running' | 'crouching' | 'lying' | 'jumping' | 'reaching' | 'climbing' | 'bending' | 'other'
}

export interface PanelOptions {
  artStyle: string;
  cameraAngle?: string;
  lighting?: string;
  panelType?: string;
  backgroundComplexity?: string;
  temperature?: number;
  // NEW: Panel border style for visual storytelling (McCloud/Eisner principle)
  borderStyle?: 'clean' | 'jagged' | 'wavy' | 'broken' | 'soft' | 'none';
  environmentalContext?: {
    characterDNA?: any;
    environmentalDNA?: any;
    panelNumber?: number;
    totalPanels?: number;
  };
  // NEW: Narrative position for visual contrast (Fix 5)
  narrativePosition?: 'OPENING' | 'SETUP' | 'RISING_ACTION' | 'CLIMAX' | 'RESOLUTION';
  emotionalWeight?: number;  // 1-10 scale for visual intensity
  // NEW: McCloud panel transition type for reading flow
  transitionType?: 'action_to_action' | 'subject_to_subject' | 'scene_to_scene' | 'moment_to_moment' | 'aspect_to_aspect';
  previousPanelContext?: PreviousPanelContext;
  feedbackImageEnhancement?: string;
  // NEW: Multi-character support
  mainCharacterName?: string;         // Name of the main character
  secondaryCharacters?: {             // Secondary characters in this panel
    name: string;
    age: string;
    gender: string;
    relationship?: string;
    hairColor?: string;
    eyeColor?: string;
    action?: string;
    position?: string;
    referenceImageUrl?: string;       // NEW: Cartoon reference image URL for consistency
  }[];
  // NEW: Map of character name -> reference image URL for all characters in scene
  characterReferenceImages?: Record<string, string>;
  // NEW: Speech bubble support - Gemini renders bubbles directly in image
  dialogue?: string;                  // Dialogue text to render in speech bubble
  hasSpeechBubble?: boolean;          // Whether to render speech bubble
  speechBubbleStyle?: 'speech' | 'thought' | 'shout' | 'whisper';
  speakerPosition?: 'left' | 'center' | 'right';
  bubblePosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center';
  // NEW: Silent panel support - pure visual storytelling with no text
  isSilent?: boolean;                 // If true, panel has NO text at all
  silentReason?: 'emotional_reaction' | 'contemplation' | 'visual_impact' | 'breathing_room' | 'revelation_aftermath';
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
   * Generate cartoon reference image for secondary character from TEXT description
   * NEW: Used to create consistent reference images for secondary characters who don't have photos
   * 
   * @param characterDescription - Text description of the character
   * @param artStyle - Must match main character's art style for consistency
   * @param audience - Target audience for age-appropriate rendering
   * @returns Cloudinary URL of generated cartoon reference image
   */
  public async generateSecondaryCharacterCartoon(
    characterDescription: {
      name: string;
      age: string;
      gender: string;
      relationship?: string;
      hairColor?: string;
      eyeColor?: string;
      distinctiveFeatures?: string[];
      clothing?: string;
    },
    artStyle: string,
    audience: string
  ): Promise<string> {
    this.logger.log('👤 Generating secondary character cartoon reference...', { 
      name: characterDescription.name,
      age: characterDescription.age,
      gender: characterDescription.gender,
      artStyle,
      audience
    });
    
    try {
      // Build comprehensive character description prompt
      const ageDescriptions: Record<string, string> = {
        'toddler': 'toddler (1-3 years old, very small, chubby cheeks, about 1/3 height of adult)',
        'child': 'child (4-10 years old, small stature, about half height of adult)',
        'teen': 'teenager (11-17 years old, growing, youthful, slightly shorter than adult)',
        'young-adult': 'young adult (18-25 years old, full adult height)',
        'adult': 'adult (26-55 years old, full adult height)',
        'senior': 'senior (55+ years old, may have gray hair, wrinkles, possibly slightly stooped)'
      };
      
      const ageDesc = ageDescriptions[characterDescription.age] || characterDescription.age;
      
      const characterPrompt = `Create a CHARACTER REFERENCE IMAGE for use in comic book panels.

CHARACTER SPECIFICATIONS:
- Name: ${characterDescription.name}
- Age: ${ageDesc}
- Gender: ${characterDescription.gender}
${characterDescription.hairColor ? `- Hair: ${characterDescription.hairColor}` : ''}
${characterDescription.eyeColor ? `- Eyes: ${characterDescription.eyeColor}` : ''}
${characterDescription.relationship ? `- Role: ${characterDescription.relationship}` : ''}
${characterDescription.distinctiveFeatures?.length ? `- Distinctive Features: ${characterDescription.distinctiveFeatures.join(', ')}` : ''}
${characterDescription.clothing ? `- Clothing: ${characterDescription.clothing}` : `- Clothing: Age-appropriate ${audience === 'children' ? 'bright, cheerful' : 'casual'} outfit`}

ART STYLE: ${artStyle}
This character will appear alongside the main character in multiple comic panels.

CRITICAL REQUIREMENTS:
1. Create a SINGLE, clear character portrait/reference
2. Front-facing pose showing full face clearly
3. Simple, non-distracting background (solid color or gradient)
4. Match the ${artStyle} art style EXACTLY
5. ${audience === 'children' ? 'Child-friendly, warm, and approachable appearance' : 'Age-appropriate appearance'}
6. Clear, distinct features that will be RECOGNIZABLE across panels
7. Professional comic book quality rendering

OUTPUT: Single character reference image, centered composition, suitable for use as visual reference in subsequent comic panels.

DO NOT include:
- Multiple poses or variations
- Reference sheets or model sheets
- Text, labels, or annotations
- Multiple characters
- Complex backgrounds`;

      // Call Gemini to generate the character reference image
      const response = await this.generateWithRetry<GeminiResponse>({
        contents: [{
          parts: [{ text: characterPrompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          max_output_tokens: 2000,
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: '1:1',                   // Square aspect ratio for character references
            imageSize: '1K'                       // 1K is sufficient for reference images
          }
        }
      }, 'generateSecondaryCharacterCartoon');
      
      // Extract generated image URL (uploads to Cloudinary)
      const imageUrl = await this.extractImageUrlFromResponse(response);
      
      this.logger.log('✅ Secondary character cartoon generated successfully', { 
        name: characterDescription.name,
        imageUrl: imageUrl.substring(0, 60) + '...'
      });
      
      return imageUrl;
      
    } catch (error) {
      this.logger.error('❌ Secondary character cartoon generation failed:', error);
      throw this.handleGeminiError(error, 'generateSecondaryCharacterCartoon');
    }
  }

  /**
   * Generate a professional book cover for a storybook
   * Creates cover art with title treatment, main character in iconic pose, and genre-appropriate visuals
   * 
   * @param options - Cover generation options
   * @returns Cloudinary URL of generated cover image
   */
  public async generateBookCover(options: {
    title: string;
    characterDNA?: any;
    cartoonImageUrl?: string;
    genre?: string;
    audience: string;
    artStyle: string;
    thematicElements?: string[];
  }): Promise<string> {
    const { title, characterDNA, cartoonImageUrl, genre, audience, artStyle, thematicElements } = options;
    
    this.logger.log('📕 Generating book cover...', {
      title,
      genre,
      audience,
      artStyle,
      hasCharacterDNA: !!characterDNA,
      hasCartoonImage: !!cartoonImageUrl
    });

    try {
      // Build title treatment style based on art style
      const titleTreatments: Record<string, string> = {
        'storybook': 'whimsical, hand-drawn lettering with subtle sparkles or swirls, warm and inviting fonts like a fairy tale book',
        'comic-book': 'bold, dynamic 3D block letters with dramatic shadows and comic book pop style, action-packed feel',
        'anime': 'dynamic Japanese-inspired typography with speed lines and energy effects, vibrant and eye-catching',
        'semi-realistic': 'elegant serif typography with subtle embossing effect, sophisticated and refined',
        'cartoon': 'fun, bouncy bubble letters with playful colors and cartoon-style outlines',
        'flat-illustration': 'clean, modern sans-serif typography with geometric shapes and minimalist design'
      };

      // Build genre-appropriate visual cues
      const genreVisuals: Record<string, string> = {
        'adventure': 'action poses, exploration elements, treasure maps, distant mountains, compass symbols',
        'fantasy': 'magical sparkles, mystical creatures, castles, enchanted forests, floating orbs of light',
        'mystery': 'dramatic shadows, magnifying glass, mysterious fog, detective elements, clues',
        'comedy': 'exaggerated expressions, bright colors, funny situations, playful chaos',
        'friendship': 'warm group scenes, linked hands, heart motifs, sunrise/sunset backgrounds',
        'courage': 'heroic poses, triumphant lighting, overcoming obstacles, brave stance',
        'nature': 'lush landscapes, animals, trees, flowers, natural elements, earth tones',
        'creativity': 'art supplies, colorful splashes, imagination bubbles, creative tools',
        'sports': 'dynamic action, sports equipment, stadium lights, victory poses',
        'siblings': 'two characters together, playful interactions, family bonding moments',
        'bedtime': 'starry night sky, moon, cozy scenes, soft lighting, dreamy atmosphere',
        'history': 'historical elements, period costumes, maps, old books, monuments'
      };

      // Build audience-specific styling
      const audienceStyles: Record<string, string> = {
        'children': 'bright, cheerful colors, rounded shapes, large friendly eyes, safe and warm atmosphere, playful composition',
        'young adults': 'dynamic composition, emotional depth, relatable characters, contemporary feel, subtle complexity',
        'adults': 'sophisticated composition, nuanced emotions, artistic lighting, mature themes, cinematic quality'
      };

      const titleStyle = titleTreatments[artStyle] || titleTreatments['storybook'];
      const genreVisual = genre ? (genreVisuals[genre] || 'engaging scene with main character') : 'engaging scene with main character';
      const audienceStyle = audienceStyles[audience] || audienceStyles['children'];

      // Build the cover generation prompt
      const coverPrompt = `Create a PROFESSIONAL BOOK COVER for a storybook titled "${title}".

COVER REQUIREMENTS:
1. TITLE TREATMENT: "${title}" - ${titleStyle}
   - Title should be prominently displayed, readable, and integrated into the design
   - Position the title at the TOP or CENTER-TOP of the cover

2. MAIN CHARACTER:
   - Feature the main character in an ICONIC, HEROIC POSE that captures their personality
   - Character should be the focal point, taking up 40-60% of the cover
   - Show the character in a dynamic, engaging stance (not static or boring)
${characterDNA?.description ? `   - Character description: ${characterDNA.description}` : ''}

3. GENRE VISUALS: ${genreVisual}
   - Incorporate visual elements that hint at the story's genre and themes
${thematicElements?.length ? `   - Thematic elements: ${thematicElements.join(', ')}` : ''}

4. ART STYLE: ${artStyle}
   - Match the interior art style for consistency
   - Professional book cover quality with polished finish

5. AUDIENCE STYLING: ${audienceStyle}

6. COMPOSITION:
   - Standard book cover aspect ratio (portrait orientation, approximately 3:4)
   - Leave subtle space at bottom for "A StoryCanvas Creation" attribution
   - Background should complement but not overwhelm the character
   - Create depth with foreground and background elements

7. QUALITY:
   - High resolution, professional quality
   - Rich colors and sharp details
   - Appealing to the target audience
   - Ready for print or digital display

OUTPUT: A single, complete book cover image with title integrated into the design.

DO NOT include:
- Multiple versions or variations
- Reference sheets or layout guides
- Text other than the title
- Busy or cluttered compositions that distract from the main character`;

      // Build request parts
      const parts: (GeminiTextPart | GeminiImagePart)[] = [{ text: coverPrompt }];

      // If we have a cartoon image reference, include it for character consistency
      if (cartoonImageUrl) {
        this.logger.log('📷 Including character reference for cover generation...');
        const base64Cartoon = await this.fetchImageAsBase64(cartoonImageUrl, true);
        parts.push({
          inline_data: {
            mime_type: 'image/jpeg',
            data: base64Cartoon
          }
        });
      }

      // Call Gemini to generate the cover
      const response = await this.generateWithRetry<GeminiResponse>({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.8, // Slightly higher for creative cover design
          max_output_tokens: 2000,
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: '3:4', // Standard book cover aspect ratio
            imageSize: '2K'    // Higher quality for cover
          }
        }
      }, 'generateBookCover');

      // Extract generated image URL (uploads to Cloudinary)
      const coverUrl = await this.extractImageUrlFromResponse(response);

      this.logger.log('✅ Book cover generated successfully', {
        title,
        coverUrl: coverUrl.substring(0, 60) + '...'
      });

      return coverUrl;

    } catch (error) {
      this.logger.error('❌ Book cover generation failed:', error);
      throw this.handleGeminiError(error, 'generateBookCover');
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
      
      // Add cartoon character reference image (PRIMARY reference - IMAGE 1)
      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: base64Cartoon
        }
      });
      
      // NEW: Add secondary character reference images (IMAGE 2, 3, 4, etc.)
      // This enables 88%+ consistency for ALL characters, not just the main character
      const secondaryCharactersWithImages = options.secondaryCharacters?.filter(char => char.referenceImageUrl) || [];
      if (secondaryCharactersWithImages.length > 0 || (options.characterReferenceImages && Object.keys(options.characterReferenceImages).length > 0)) {
        const charRefImages = options.characterReferenceImages || {};
        
        // Add reference images for each secondary character that has one
        let imageIndex = 2; // Start from IMAGE 2 (IMAGE 1 is main character)
        
        for (const char of secondaryCharactersWithImages) {
          if (char.referenceImageUrl) {
            this.logger.log(`📷 Adding reference image for ${char.name} (IMAGE ${imageIndex})...`);
            const base64SecondaryChar = await this.fetchImageAsBase64(char.referenceImageUrl, true);
            parts.push({
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64SecondaryChar
              }
            });
            imageIndex++;
          }
        }
        
        // Also check characterReferenceImages map for any additional references
        for (const [charName, refUrl] of Object.entries(charRefImages)) {
          // Skip if already added via secondaryCharacters array
          if (!secondaryCharactersWithImages.find(c => c.name === charName) && refUrl) {
            this.logger.log(`📷 Adding reference image for ${charName} from map (IMAGE ${imageIndex})...`);
            const base64Ref = await this.fetchImageAsBase64(refUrl, true);
            parts.push({
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Ref
              }
            });
            imageIndex++;
          }
        }
        
        this.logger.log(`✅ Added ${imageIndex - 2} secondary character reference images for consistency`);
      }
      
      // SEQUENTIAL CONTEXT: If previous panel exists, add it as reference image
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

    // ===== MULTI-CHARACTER SUPPORT FOR REGENERATION =====
    // Include secondary characters if present in this scene
    const mainCharName = options.mainCharacterName || 'the main character';
    const hasSecondaryCharacters = options.secondaryCharacters && options.secondaryCharacters.length > 0;
    
    if (hasSecondaryCharacters) {
      prompt += `

👥 SECONDARY CHARACTERS IN SCENE (render consistently but NOT from reference image):`;
      options.secondaryCharacters!.forEach((char, index) => {
        prompt += `
- ${char.name}: ${char.age || 'child'} ${char.gender || 'child'}${char.hairColor ? `, ${char.hairColor} hair` : ''}${char.eyeColor ? `, ${char.eyeColor} eyes` : ''}
  Relationship: ${char.relationship || 'companion'} of ${mainCharName}
  ${char.action ? `Action: ${char.action}` : ''}${char.position ? `, Position: ${char.position}` : ''}
  MUST BE: Visually distinct from ${mainCharName}, age-appropriate size, consistent appearance`;
      });
    }

    // Add McCloud transition guidance for panel-to-panel flow
    if (options.transitionType) {
      const transitionGuidance: Record<string, string> = {
        'action_to_action': `CONTINUITY RULES (MANDATORY):
- Character position MUST flow from previous panel (if left side, stay left or move naturally right)
- Motion trajectory continues - no teleporting or position jumps
- Same clothing, same lighting, same background elements visible
- Show the NEXT moment, not a random new pose
- If previous panel showed arm raised, this panel shows arm mid-swing or completing motion`,
        'subject_to_subject': `FOCUS SHIFT RULES (MANDATORY):
- SAME SCENE, different subject - background elements MUST match previous panel
- If previous panel showed a room, this panel shows same room from different angle
- Maintain consistent lighting direction and color temperature
- New subject should have been visible or implied in previous panel
- Spatial relationship to previous subject must be logical`,
        'scene_to_scene': `NEW SCENE RULES (MANDATORY):
- ESTABLISH new location clearly with wider framing
- This is a time/space jump - make the new location immediately recognizable
- Include establishing environmental details (architecture, nature, lighting)
- Character should be shown entering or present in new space
- Clear visual break from previous scene (different color palette, lighting mood)`,
        'moment_to_moment': `MICRO-CHANGE RULES (MANDATORY):
- SAME FRAMING as previous panel (camera position nearly identical)
- Only change: subtle expression shift OR tiny movement
- Background EXACTLY the same (copy-level consistency)
- Used for: blink, slight smile, tear forming, realization dawning
- Time elapsed: less than 1 second`,
        'aspect_to_aspect': `FROZEN TIME RULES (MANDATORY):
- NO TIME PASSES between this panel and previous
- Same instant, different viewpoint (like multiple cameras capturing one moment)
- If previous panel showed character's face, this might show their hands or the environment
- Lighting IDENTICAL (same moment = same light)
- Used for: building tension, showing scope of moment, environmental mood`
      };
      prompt += `
PANEL TRANSITION (McCLOUD): ${options.transitionType}
${transitionGuidance[options.transitionType] || ''}
`;
    }

    // Add panel border style guidance (Eisner visual storytelling)
    if (options.borderStyle) {
      const borderGuidance: Record<string, string> = {
        'clean': 'BORDER: Clean, straight edges. Professional, controlled moment.',
        'jagged': 'BORDER: Jagged, sharp edges suggesting chaos, action, or danger. Energy bursting from frame.',
        'wavy': 'BORDER: Wavy, fluid edges for dreams, memories, or underwater scenes. Ethereal quality.',
        'broken': 'BORDER: Broken/shattered edges for impact moments, breaking barriers, or emotional breakthroughs.',
        'soft': 'BORDER: Soft, faded edges for flashbacks, gentle moments, or fading consciousness.',
        'none': 'BORDER: Borderless panel - image bleeds to edge for immersive, expansive moments.'
      };
      prompt += `
${borderGuidance[options.borderStyle] || ''}
`;
    }

    prompt += `

    ${options.artStyle.toUpperCase()} QUALITY STANDARDS:
    - Professional comic book illustration
    - Clean, expressive line work
    - Vibrant, publication-ready colors
    - Visual consistency with established character design
    - Engaging composition that advances the narrative
    - Clear foreground/midground/background separation
    - Strong focal point with supporting visual hierarchy`;

    if (hasSecondaryCharacters) {
      prompt += `
- Secondary characters must be CONSISTENT with descriptions above
- Show age-appropriate size differences between characters
- Each secondary character must have DISTINCT appearance from main character`;
    }

    prompt += `

MANDATORY: Address ALL issues listed in CRITICAL FIXES REQUIRED section above.

READING FLOW (Professional Comics Standard):
- Character's gaze/action should guide eye toward next panel's entry point
- If character faces LEFT, they're looking toward PAST (previous panel)
- If character faces RIGHT, they're looking toward FUTURE (next panel)
- Action lines and motion should flow left-to-right (Western reading direction)
- Key focal point should be in right third of panel to lead eye forward

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
   * ENHANCED: Multi-character support with secondary character descriptions
   */
  private buildPanelGenerationPrompt(
    sceneDescription: string,
    emotion: string,
    options: PanelOptions
  ): string {
    const hasPreviousPanel = !!options.previousPanelContext;
    const hasEnvDNA = !!options.environmentalContext?.environmentalDNA;
    const hasSecondaryCharacters = options.secondaryCharacters && options.secondaryCharacters.length > 0;
    
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
    
    // Main character name
    const mainCharName = options.mainCharacterName || 'the main character';
    
    // NARRATION-FIRST: Extract mandatory physical actions from scene description
    const physicalActions = this.extractMandatoryPhysicalActions(sceneDescription);

    // Build compressed prompt - essential info only
    let prompt = `${options.artStyle} comic panel. CHARACTER 1 (${mainCharName}): Match IMAGE 1 exactly.${hasPreviousPanel ? ' CONTINUITY: Follow from IMAGE 2 but CHANGE composition.' : ''}

SCENE: ${sceneDescription}

VISUAL HIERARCHY (Professional Comics Standard):
- FOREGROUND (closest): Main action/character - sharp focus, highest detail
- MIDGROUND (middle): Supporting elements - clear but less detailed
- BACKGROUND (furthest): Environment context - softer, atmospheric
- FOCAL POINT: Place primary action at rule-of-thirds intersection
- DEPTH: Use size difference, overlap, and atmospheric perspective to create 3D space

EMOTION: ${emotion} - CHARACTER'S FACE MUST SHOW THIS EMOTION:
- happy/excited = big smile, raised cheeks, bright eyes
- sad = downturned mouth, droopy eyes, slumped posture
- angry/determined = furrowed brows, tight jaw, intense eyes
- scared = wide eyes, open mouth, raised eyebrows
- surprised = wide eyes, raised eyebrows, open mouth
- curious = tilted head, raised eyebrow, slight smile
THE FACIAL EXPRESSION IS CRITICAL - MUST MATCH "${emotion}" EXACTLY.
CAMERA: ${cameraAngle} shot, ${panelType} panel`;

    // === SILENT PANEL ENHANCEMENT (Fix 6 - Enhanced Composition) ===
    // When panel is marked silent, apply professional comic composition techniques
    if (options.isSilent) {
      const silentReason = options.silentReason || 'emotional_reaction';
      
      // Reason-specific visual guidance (what to show)
      const silentEmphasis: Record<string, string> = {
        emotional_reaction: 'Character processing shock/joy/grief. Focus on eyes, face, and body language.',
        contemplation: 'Moment of deep thought before a decision. Introspective, atmospheric.',
        visual_impact: 'Pure visual moment. Let the composition tell the story.',
        breathing_room: 'Quiet pause after intensity. Peaceful, reflective.',
        revelation_aftermath: 'Character absorbing a major revelation. Wide eyes, frozen posture.'
      };
      
      // Reason-specific camera recommendations (how to frame it)
      const silentCameraGuidance: Record<string, string> = {
        emotional_reaction: 'CLOSE-UP on face (70% of frame). Eyes are the window to the soul.',
        contemplation: 'MEDIUM shot with negative space. Character small against environment = weight of decision.',
        visual_impact: 'WIDE or DRAMATIC angle. Let environment/action dominate. Character as part of larger moment.',
        breathing_room: 'MEDIUM-WIDE with soft focus. Peaceful composition. Character at rest.',
        revelation_aftermath: 'EXTREME CLOSE-UP on eyes OR pull back to show isolation. Stillness is key.'
      };
      
      // Reason-specific composition techniques
      const silentComposition: Record<string, string> = {
        emotional_reaction: 'Rule of thirds - place eyes at upper intersection. Shallow depth of field.',
        contemplation: 'Off-center framing. Character looking into negative space (future/decision).',
        visual_impact: 'Dynamic diagonal lines. High contrast. Bold shapes.',
        breathing_room: 'Centered, symmetrical. Soft edges. Muted colors.',
        revelation_aftermath: 'Isolated subject. Dark vignette or spotlight effect. Frozen moment.'
      };
      
      prompt += `

🤫 SILENT PANEL - PURE VISUAL STORYTELLING (${silentReason.toUpperCase()})
This is a WORDLESS panel. NO speech bubbles. NO text of any kind.
The image alone must convey: ${emotion}

PURPOSE: ${silentEmphasis[silentReason]}

📷 CAMERA GUIDANCE:
${silentCameraGuidance[silentReason]}

🎨 COMPOSITION TECHNIQUE:
${silentComposition[silentReason]}

SILENT PANEL PRINCIPLES (Eisner/McCloud):
- Silence = emphasis. This moment MATTERS.
- Every visual element must support the emotion
- Lighting tells the emotional story (${emotion} mood)
- Body language speaks louder than words
- Leave breathing room - don't overcrowd the frame
- The reader should FEEL what the character feels`;
    }

    // Add mandatory physical action requirements if detected
    if (physicalActions.length > 0) {
      prompt += `

⚠️ MANDATORY BODY POSITION (CRITICAL - DO NOT IGNORE):
${physicalActions.map(action => `• ${action}`).join('\n')}
THE CHARACTER'S BODY MUST SHOW THESE EXACT POSITIONS.`;
    }

    // Add secondary characters section with MANDATORY RENDERING + consistency enforcement
    // NEW: Now references character images (IMAGE 2, 3, 4, etc.) for maximum consistency
    if (hasSecondaryCharacters) {
      // Calculate image indices for secondary characters with reference images
      let imageIndex = hasPreviousPanel ? 3 : 2; // IMAGE 1 = main char, IMAGE 2 = prev panel (if exists)
      
      prompt += `

===== MANDATORY: RENDER ALL SECONDARY CHARACTERS =====
⚠️ CRITICAL REQUIREMENT: You MUST include ALL ${options.secondaryCharacters!.length} secondary character(s) listed below in this panel.
DO NOT generate the image without rendering EVERY secondary character.
DO NOT make any character optional or skip any character.

Each secondary character below MUST appear in the final image AND look IDENTICAL in EVERY panel they appear in:`;
      options.secondaryCharacters!.forEach((char, index) => {
        const ageHeight = {
          'toddler': 'very small, about 1/3 height of adult',
          'child': 'small, about half height of adult',
          'teen': 'medium height, slightly shorter than adult',
          'young-adult': 'full adult height',
          'adult': 'full adult height',
          'senior': 'full adult height, possibly slightly stooped'
        };
        
        // Check if this character has a reference image
        const hasRefImage = !!char.referenceImageUrl;
        const charImageRef = hasRefImage ? `IMAGE ${imageIndex}` : 'description below';
        if (hasRefImage) imageIndex++;
        
        prompt += `

${char.name.toUpperCase()} (MUST BE CONSISTENT${hasRefImage ? ` - Match ${charImageRef} EXACTLY` : ''}):
${hasRefImage ? `- REFERENCE: Match ${charImageRef} exactly for face, body, clothing, and proportions` : ''}
- Age: ${char.age || 'child'} (${ageHeight[char.age as keyof typeof ageHeight] || 'proportional to main character'})
- Gender: ${char.gender || 'child'}
- Hair: ${char.hairColor || 'brown'} hair - SAME COLOR IN EVERY PANEL
- Eyes: ${char.eyeColor || 'brown'} eyes - SAME COLOR IN EVERY PANEL
- Clothing: Keep IDENTICAL outfit throughout entire story
- Relationship: ${char.relationship || 'companion'} of ${mainCharName}
- Size relative to ${mainCharName}: ${char.age === 'toddler' ? 'MUCH smaller' : char.age === 'child' ? 'smaller' : 'similar size'}
${char.action ? `- Current Action: ${char.action}` : ''}
CRITICAL: ${char.name} must be INSTANTLY RECOGNIZABLE as the same person in every panel.`;
      });
      
      // Build checklist with image references where applicable
      const charsWithImages = options.secondaryCharacters!.filter(c => c.referenceImageUrl);
      const charsWithoutImages = options.secondaryCharacters!.filter(c => !c.referenceImageUrl);
      
      prompt += `

MANDATORY RENDERING CHECKLIST (verify BEFORE generating image):
✓ ${mainCharName} is in the image? (from reference IMAGE 1)
${charsWithImages.map((char, i) => `✓ ${char.name} is in the image? (match IMAGE ${hasPreviousPanel ? i + 3 : i + 2} EXACTLY)`).join('\n')}
${charsWithoutImages.map(char => `✓ ${char.name} is in the image? (matching description above)`).join('\n')}
✓ All ${options.secondaryCharacters!.length + 1} characters visible in the composition?

If ANY character is missing from your composition, START OVER and include them.

SECONDARY CHARACTER CONSISTENCY RULES:
1. SAME face shape, features, hair style in EVERY panel${charsWithImages.length > 0 ? ' (match reference images exactly)' : ''}
2. SAME clothing - do NOT change outfits between panels
3. SAME height relative to ${mainCharName}
4. If ${mainCharName} is a toddler and secondary is also toddler, they should be similar size`;
    }

    // Add previous panel context with POSE DIVERSITY enforcement
    if (hasPreviousPanel && options.previousPanelContext) {
      const previousPose = options.previousPanelContext.pose || 'standing';
      
      // Map poses to forbidden poses (what NOT to repeat)
      const forbiddenPoses: Record<string, string[]> = {
        'standing': ['standing still', 'upright static pose', 'feet planted'],
        'sitting': ['seated', 'sitting down', 'on chair/ground'],
        'walking': ['walking', 'stepping', 'strolling'],
        'running': ['running', 'sprinting', 'dashing'],
        'crouching': ['crouching', 'kneeling', 'ducking', 'squatting'],
        'lying': ['lying down', 'prone', 'horizontal'],
        'jumping': ['jumping', 'leaping', 'airborne'],
        'reaching': ['reaching', 'stretching arms', 'grabbing'],
        'climbing': ['climbing', 'scaling', 'ascending'],
        'bending': ['bending', 'leaning', 'stooping']
      };
      
      const avoidPoses = forbiddenPoses[previousPose] || [];
      
      prompt += `

PREVIOUS PANEL: ${options.previousPanelContext.action}
PREVIOUS POSE: ${previousPose}

⚠️ POSE DIVERSITY RULE (CRITICAL):
- DO NOT repeat "${previousPose}" pose from previous panel
- Character must be in a DIFFERENT body position
${avoidPoses.length > 0 ? `- AVOID: ${avoidPoses.join(', ')}` : ''}
- Show PROGRESSION of movement between panels
- Each panel should feel like a new moment in time`;
    }

    // Add environmental DNA (compressed) with PERSISTENT OBJECT ENFORCEMENT
    if (hasEnvDNA) {
      // Extract persistent objects that MUST appear in every panel at this location
      const persistentObjects = envDNA?.visualContinuity?.persistentObjects || [];
      const recurringObjects = envDNA?.visualContinuity?.recurringObjects || [];
      
      prompt += `

ENV: ${timeOfDay} lighting, ${locationName}
COLORS: ${dominantColors.join(', ') || 'natural palette'}
FEATURES: ${keyFeatures.join(', ') || 'consistent background'}`;

      // CRITICAL: Enforce persistent objects (story-significant items)
      if (persistentObjects.length > 0) {
        prompt += `

⚠️ MANDATORY OBJECTS - MUST APPEAR IN THIS PANEL:
${persistentObjects.map((obj: string) => `• ${obj} (REQUIRED - same appearance as previous panels)`).join('\n')}
These objects are STORY-SIGNIFICANT and must be visible in EVERY panel at this location.
Do NOT omit these objects. Do NOT change their appearance.`;
      } else if (recurringObjects.length > 0) {
        // Fallback to recurring objects if no persistent objects defined
        prompt += `

RECURRING ELEMENTS (maintain consistency):
${recurringObjects.slice(0, 3).map((obj: string) => `• ${obj}`).join('\n')}`;
      }
    }

    // === NARRATIVE POSITION VISUAL CONTRAST (Fix 5) ===
    // Apply dramatic visual differences based on story position
    const narrativePosition = options.narrativePosition || 'RISING_ACTION';
    const emotionalWeight = options.emotionalWeight || 5;
    
    const visualContrast: Record<string, string> = {
      'OPENING': 'Soft, inviting lighting. Warm color temperature. Establish mood gently.',
      'SETUP': 'Clear, balanced lighting. Neutral tones. Focus on clarity.',
      'RISING_ACTION': 'Building tension through lighting. Slight shadows. Dynamic energy.',
      'CLIMAX': '🔥 DRAMATIC CONTRAST: High-impact lighting, strong shadows, vivid colors, maximum visual intensity. This is the story\'s peak moment.',
      'RESOLUTION': '✨ WARM RESOLUTION: Golden hour lighting, soft glows, peaceful atmosphere. Sense of closure and satisfaction.'
    };
    
    // Add style requirements with DIVERSITY enforcement + VISUAL CONTRAST
    prompt += `

REQUIREMENTS:
- Match ${mainCharName} from reference image exactly
- ${timeOfDay} lighting throughout
- ${cameraAngle} camera angle (MUST follow this angle)
- Character pose must be DIFFERENT from previous panel
- Dynamic composition, not static
- ${options.artStyle} style, publication quality

🎬 NARRATIVE MOMENT: ${narrativePosition} (weight: ${emotionalWeight}/10)
${visualContrast[narrativePosition] || visualContrast['RISING_ACTION']}`;

    // Add secondary character MANDATORY RENDERING rules if present
    if (hasSecondaryCharacters) {
      prompt += `
- MANDATORY: All ${options.secondaryCharacters!.length} secondary character(s) MUST be visible in the image (${options.secondaryCharacters!.map(c => c.name).join(', ')})
- Secondary characters must be CONSISTENT with descriptions above
- Show age-appropriate size differences between characters
- Each secondary character must have DISTINCT appearance from main character`;
    }

    // Add feedback-driven image enhancements if available
    if (options.feedbackImageEnhancement) {
      prompt += `

${options.feedbackImageEnhancement}`;
    }

    // Add speech bubble instructions if dialogue is present
    if (options.hasSpeechBubble && options.dialogue) {
      const bubbleStyle = options.speechBubbleStyle || 'speech';
      const bubblePos = options.bubblePosition || 'top-center';
      const speakerPos = options.speakerPosition || 'center';
      
      const bubbleStyleInstructions: Record<string, string> = {
        'speech': 'classic white speech bubble with black outline and triangular tail',
        'thought': 'cloud-shaped thought bubble with small floating circles leading to speaker',
        'shout': 'jagged/spiky speech bubble indicating loud/emphatic speech',
        'whisper': 'dotted-outline bubble or smaller, lighter bubble indicating quiet speech'
      };

      prompt += `

===== SPEECH BUBBLE (RENDER IN IMAGE) =====
CRITICAL: Render a professional comic book speech bubble containing dialogue.

DIALOGUE TEXT: "${options.dialogue}"
BUBBLE STYLE: ${bubbleStyleInstructions[bubbleStyle] || bubbleStyleInstructions['speech']}
BUBBLE POSITION: ${bubblePos} of the panel
SPEAKER POSITION: Speaker is on the ${speakerPos} of the panel
TAIL DIRECTION: Bubble tail MUST point toward the ${speakerPos} where the speaker is located

REQUIREMENTS:
- Text MUST be clearly LEGIBLE (appropriate font size for panel)
- Use clean, comic-book style lettering
- Bubble should not obscure the character's face
- Tail should clearly indicate which character is speaking
- Professional quality matching published comic standards`;
    }

    // ⚠️ CRITICAL: NO UNAUTHORIZED TEXT RULE - Must be at END of prompt for maximum weight
    prompt += `

⛔ TEXT RULES:
- DO NOT add narration boxes, caption boxes, or title cards
- DO NOT add sound effects text (POW, BOOM, etc.)
- DO NOT add labels, signs, or written words
${options.hasSpeechBubble && options.dialogue ? '- EXCEPTION: The speech bubble with dialogue above IS required' : '- DO NOT add speech bubbles or dialogue text'}
- Narration/captions will be added separately by the application`;

    return prompt;
  }

  /**
   * ===== EXTRACT MANDATORY PHYSICAL ACTIONS =====
   * NARRATION-FIRST: Scans scene description for action keywords and returns explicit visual requirements
   * This ensures Gemini renders the correct body positions described in the narration
   * 
   * @param sceneDescription - The scene description (now derived from narration)
   * @returns Array of mandatory physical action requirements
   */
  private extractMandatoryPhysicalActions(sceneDescription: string): string[] {
    const physicalActions: string[] = [];
    const textLower = sceneDescription.toLowerCase();
    
    // MANDATORY PHYSICAL ACTION MAPPINGS
    // Maps common action words to explicit visual requirements that Gemini MUST follow
    const actionMappings: [RegExp, string][] = [
      // Movement/Position
      [/\bcrawl(s|ed|ing)?\b/, 'Character MUST be on hands and knees, body low to ground, NOT standing or walking'],
      [/\brun(s|ning)?\b|\bran\b/, 'Character MUST have legs in motion, body leaning forward, feet not both flat on ground'],
      [/\bwalk(s|ed|ing)?\b/, 'Character MUST be upright, one foot forward, natural walking stride'],
      [/\bjump(s|ed|ing)?\b/, 'Both feet MUST be off ground, body elevated in air'],
      [/\bsit(s|ting)?\b|\bsat\b/, 'Character MUST be seated, weight on bottom, legs folded or extended'],
      [/\bstand(s|ing)?\b|\bstood\b/, 'Character MUST be upright on feet, vertical body position'],
      [/\bkneel(s|ing)?\b|\bknelt\b/, 'Character MUST be on one or both knees, upper body upright'],
      [/\bly(ing)?\b|\blay\b|\blaid\b/, 'Character MUST be horizontal, lying down on surface'],
      [/\bclimb(s|ed|ing)?\b/, 'Hands and feet MUST grip surface, body at angle against vertical surface'],
      [/\bfall(s|ing)?\b|\bfell\b/, 'Body in mid-air or on ground, posture showing gravity effect'],
      [/\btiptoe(s|d|ing)?\b/, 'Standing on toes ONLY, feet raised, careful balance'],
      [/\bcrouch(es|ed|ing)?\b/, 'Body low, knees bent deeply, compact posture'],
      [/\bsquat(s|ted|ting)?\b/, 'Knees bent, body low, weight on feet'],
      
      // Arm/Hand positions
      [/\breach(es|ed|ing)?\b/, 'Arm MUST be extended toward target, fingers stretched out'],
      [/\bpoint(s|ed|ing)?\b/, 'Arm extended, index finger directed at target'],
      [/\bwave(s|d|ing)?\b/, 'Hand raised, palm open, arm in greeting gesture'],
      [/\bhug(s|ged|ging)?\b/, 'Arms MUST wrap around other character or object, bodies close'],
      [/\bhold(s|ing)?\b|\bheld\b/, 'Hands gripping or cradling object, secure grip visible'],
      [/\bpush(es|ed|ing)?\b/, 'Arms extended forward, hands pressing against object'],
      [/\bpull(s|ed|ing)?\b/, 'Arms bent, hands gripping, body leaning back'],
      [/\bclap(s|ped|ping)?\b/, 'Both hands together in front of body'],
      
      // Facial/Head positions
      [/\btongue\s+out\b|\bsticks?\s+out\s+tongue\b|\blick(s|ed|ing)?\b/, 'Tongue MUST be visible outside mouth'],
      [/\bwatch(es|ed|ing)?\b|\blook(s|ed|ing)?\b/, 'Eyes and head directed toward subject of interest'],
      [/\bstar(es|ed|ing)?\b/, 'Eyes wide and fixed on subject, intense unwavering focus'],
      [/\bsmile(s|d)?\b|\bsmiling\b|\bgrin(s|ned|ning)?\b/, 'Mouth curved upward, teeth may show, cheeks raised'],
      [/\bcry(ing)?\b|\bcried\b|\btears?\b/, 'Visible tears on cheeks, downturned mouth, sad expression'],
      [/\blaugh(s|ed|ing)?\b/, 'Mouth open wide, eyes crinkled, joyful expression'],
      [/\bfrown(s|ed|ing)?\b/, 'Eyebrows down, mouth turned down, displeased expression'],
      [/\bwhisper(s|ed|ing)?\b/, 'Leaning close, hand near mouth, secretive pose'],
      [/\bshout(s|ed|ing)?\b|\byell(s|ed|ing)?\b/, 'Mouth WIDE open, body tense, expressing loudly'],
      
      // Full body actions
      [/\bdanc(e|es|ed|ing)\b/, 'Body in expressive motion, arms and legs in movement'],
      [/\bhid(e|es|ing)?\b|\bhid\b/, 'Body partially or fully concealed behind object'],
      [/\bsleep(s|ing)?\b|\bslept\b/, 'Eyes MUST be closed, body relaxed, horizontal position'],
      [/\bswim(s|ming)?\b|\bswam\b/, 'Body horizontal in water, arms and legs in swimming motion']
    ];
    
    // Scan for each action pattern
    for (const [pattern, requirement] of actionMappings) {
      if (pattern.test(textLower)) {
        physicalActions.push(requirement);
      }
    }
    
    // Check for specific body part mentions
    if (textLower.includes('hands and knees')) {
      physicalActions.push('Body position: MUST be on hands and knees (all fours)');
    }
    if (textLower.includes('arms raised') || textLower.includes('arms up') || textLower.includes('hands up')) {
      physicalActions.push('Arms raised above head or shoulders');
    }
    if (textLower.includes('chubby fingers') || textLower.includes('little hands') || textLower.includes('tiny hands')) {
      physicalActions.push('Show small, chubby toddler/child hands');
    }
    if (textLower.includes('on tummy') || textLower.includes('on belly')) {
      physicalActions.push('Lying face-down on stomach/tummy');
    }
    if (textLower.includes('on back')) {
      physicalActions.push('Lying face-up on back');
    }
    
    // Remove duplicates and return
    return [...new Set(physicalActions)];
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
    
    // ✅ DIAGNOSTIC: Log full response structure to identify why text is missing
    const candidate = response.candidates?.[0];
    this.logger.log('🔍 DIAGNOSTIC - Gemini response structure:', {
      hasCandidates: !!response.candidates,
      candidatesLength: response.candidates?.length || 0,
      finishReason: candidate?.finishReason,
      hasContent: !!candidate?.content,
      partsLength: candidate?.content?.parts?.length || 0,
      firstPartKeys: candidate?.content?.parts?.[0] ? Object.keys(candidate.content.parts[0]) : [],
      firstPartTextLength: candidate?.content?.parts?.[0]?.text?.length || 0,
      // Log first 200 chars of text if exists
      textPreview: candidate?.content?.parts?.[0]?.text?.substring(0, 200) || 'NO TEXT FOUND'
    });
    
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      // ✅ DIAGNOSTIC: Log what we actually received when text is missing
      this.logger.error('❌ DIAGNOSTIC - No text found. Full candidate:', JSON.stringify(candidate, null, 2));
      
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
   * Determine maximum retry attempts based on error type (Design by Contract)
   * 
   * Error-specific retry strategy:
   * - 503 Service Unavailable: 3 total attempts (2 retries) - transient API overload
   * - Network errors: 2 total attempts (1 retry) - transient connection issues
   * - All other errors: 1 attempt (0 retries) - fail fast for permanent errors
   */
  private getMaxRetriesForError(error: any): number {
    // 503 Service Unavailable - Gemini API temporarily overloaded
    // Most common transient error, worth retrying aggressively
    if (error instanceof AIServiceUnavailableError && error.details?.httpStatus === 503) {
      return 3; // Total 3 attempts for 503 errors
    }
    
    // Network errors - connection issues, DNS failures, etc.
    // Usually transient, worth one retry
    if (error instanceof AINetworkError) {
      return 2; // Total 2 attempts for network errors
    }
    
    // Rate limit errors - need to wait, but worth retrying
    if (error instanceof AIRateLimitError) {
      return 2; // Total 2 attempts for rate limits
    }
    
    // All other errors (auth, content policy, validation, timeout, 400/401/403)
    // These are permanent errors - fail immediately
    return 1; // No retries for permanent errors
  }

  /**
   * Calculate retry delay with error-specific exponential backoff and jitter
   * 
   * Strategy:
   * - 503 errors: Aggressive backoff (2s, 4s, 8s) - API needs recovery time
   * - Network errors: Quick retry (2-3s) - transient blips resolve fast
   * - Rate limits: Longer backoff (3s, 6s) - respect API quotas
   * - Default: Standard exponential (2s base, max 30s)
   * 
   * All delays include 30% random jitter to prevent thundering herd
   */
  private calculateRetryDelay(error: any, attempt: number): number {
    let baseDelay: number;
    let multiplier: number;
    let maxDelay: number;
    
    // 503 Service Unavailable - aggressive backoff, API is overloaded
    if (error instanceof AIServiceUnavailableError && error.details?.httpStatus === 503) {
      baseDelay = 2000;  // Start at 2 seconds
      multiplier = 2;     // Double each attempt: 2s, 4s, 8s
      maxDelay = 15000;   // Cap at 15 seconds
    }
    // Network errors - quick retry, usually resolves fast
    else if (error instanceof AINetworkError) {
      baseDelay = 2000;   // 2 seconds base
      multiplier = 1.5;   // Slower growth: 2s, 3s
      maxDelay = 5000;    // Cap at 5 seconds
    }
    // Rate limit errors - respect API quotas with longer waits
    else if (error instanceof AIRateLimitError) {
      baseDelay = 3000;   // 3 seconds base
      multiplier = 2;     // Double: 3s, 6s
      maxDelay = 60000;   // Cap at 60 seconds (rate limits can be long)
    }
    // Default exponential backoff
    else {
      baseDelay = 2000;
      multiplier = 2;
      maxDelay = 30000;
    }
    
    // Calculate delay with exponential growth
    // attempt is 1-indexed, so attempt-1 gives us 0, 1, 2... for powers
    const exponentialDelay = baseDelay * Math.pow(multiplier, attempt - 1);
    let delay = Math.min(exponentialDelay, maxDelay);
    
    // Add 30% random jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;
    delay = Math.round(delay + jitter);
    
    return delay;
  }

  /**
   * Generate with retry logic and circuit breaker
   * 
   * Uses error-specific retry strategy:
   * - 503 errors: Up to 3 attempts with aggressive backoff
   * - Network errors: Up to 2 attempts with quick retry
   * - Other errors: Fail immediately (no retries)
   */
  private async generateWithRetry<T>(
    request: GeminiRequest,
    operationName: string,
    maxRetries: number = 1
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: any;
    const breaker = this.circuitBreakers.get('generateContent');
    
    // Start with initial maxRetries, will be dynamically adjusted based on error type
    let currentMaxRetries = maxRetries;
    let attempt = 1;
    
    while (attempt <= currentMaxRetries) {
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
        
        // Apply retry delay (only after first attempt)
        if (attempt > 1 && lastError) {
          const delay = this.calculateRetryDelay(lastError, attempt);
          this.logger.warn(`⏳ Retry attempt ${attempt}/${currentMaxRetries} after ${delay}ms delay (error type: ${lastError.constructor.name})`);
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
        
        // Determine if error is retryable and get max retries for this error type
        const errorMaxRetries = this.getMaxRetriesForError(error);
        
        // Update currentMaxRetries to be the maximum of what we have and what this error allows
        // This allows dynamic retry expansion for transient errors like 503
        if (errorMaxRetries > currentMaxRetries) {
          this.logger.log(`🔄 Expanding retry limit from ${currentMaxRetries} to ${errorMaxRetries} for ${error.constructor.name}`);
          currentMaxRetries = errorMaxRetries;
        }
        
        const isRetryable = errorMaxRetries > 1;
        const hasMoreAttempts = attempt < currentMaxRetries;
        
        this.logger.error(`❌ Attempt ${attempt}/${currentMaxRetries} failed:`, {
          error: error.message,
          errorType: error.constructor.name,
          httpStatus: error.details?.httpStatus,
          isRetryable,
          hasMoreAttempts
        });
        
        // Content policy errors should never be retried
        if (error instanceof AIContentPolicyError) {
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
        
        // If not retryable or out of attempts, fail permanently
        if (!isRetryable || !hasMoreAttempts) {
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
        
        // Will retry - increment attempt counter
        attempt++;
      }
    }
    
    throw lastError || new AIServiceUnavailableError(
      'Failed after all retry attempts',
      {
        service: 'GeminiIntegration',
        operation: operationName,
        details: { attempts: currentMaxRetries }
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

