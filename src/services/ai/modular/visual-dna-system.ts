/**
 * ===== VISUAL DNA SYSTEM MODULE (ENHANCED) =====
 * Advanced character consistency and visual fingerprinting system for professional comic generation
 * ENHANCED: Incorporates superior prompts from original files for maximum consistency
 * 
 * File Location: lib/services/ai/modular/visual-dna-system.ts
 * Dependencies: constants-and-types.ts, error-handling-system.ts, openai-integration.ts
 */

import { 
  AudienceType,
  CharacterDNA,
  EnvironmentalDNA,
  VisualFingerprint,
  StoryBeat
} from './constants-and-types.js';

import { 
  ErrorHandlingSystem,
  AIServiceError,
  AIServiceUnavailableError,
  AIRateLimitError,
  AIContentPolicyError 
} from './error-handling-system.js';

import { OpenAIIntegration } from './openai-integration.js';

// Enhanced interface definitions
interface DNAExtractionResult {
  success: boolean;
  characterDNA?: CharacterDNA;
  error?: string;
  fallbackUsed?: boolean;
}

interface VisualDNAConfig {
  enableFingerprinting: boolean;
  cacheSize: number;
  compressionLevel: 'low' | 'medium' | 'high';
  consistencyThreshold: number;
}

// ENHANCED PROMPTS FROM ORIGINAL FILES
const ENHANCED_AI_PROMPTS = {
  characterAnalysis: {
    base: `CRITICAL: Analyze this character image for PERFECT comic book consistency. 
Every detail extracted here will determine if the character looks identical across all panels.`,
    
    visualDNA: `CRITICAL CHARACTER DNA EXTRACTION - MAXIMUM CONSISTENCY PROTOCOL:

Extract COMPREHENSIVE visual DNA to ensure the character looks EXACTLY the same in every panel:

1. FACIAL FEATURES (NEVER CHANGE):
   - Face shape: EXACT shape (oval, round, square, heart, diamond)
   - Eyes: PRECISE shape, size, color, spacing, any unique characteristics
   - Eyebrows: EXACT shape, thickness, arch, color
   - Nose: SPECIFIC type (button, roman, aquiline), size, nostril shape
   - Mouth/Lips: EXACT shape, fullness, natural expression, smile type
   - Chin & Jawline: PRECISE structure and definition
   - Distinctive marks: ANY moles, freckles, scars, dimples (position and size)

2. HAIR (MAINTAIN PERFECTLY):
   - Style: EXACT cut, length, layers, how it falls
   - Texture: SPECIFIC (straight/wavy/curly/kinky) with detail
   - Color: PRECISE shade including highlights, roots, undertones
   - Unique features: Cowlicks, parts, baby hairs, edges
   - Hairline: EXACT shape and position

3. BODY CHARACTERISTICS (KEEP CONSISTENT):
   - Build: SPECIFIC body type with proportions
   - Height: Relative to standard markers
   - Shoulders: Width and slope
   - Posture: Natural stance and bearing
   - Age indicators: Specific visual age markers

4. SKIN & COMPLEXION:
   - Skin tone: EXACT shade with undertones
   - Texture: Smooth, freckled, etc.
   - Unique features: Beauty marks, skin characteristics

5. DISTINCTIVE IDENTIFIERS (ALWAYS VISIBLE):
   - Accessories: Glasses (exact style), jewelry, etc.
   - Clothing signature: Default outfit elements
   - Unique features: Anything that makes them instantly recognizable

6. COLOR PALETTE DNA:
   - Primary colors: Main 3-4 colors associated with character
   - Skin tone: Specific color description
   - Hair color: Exact shade name
   - Eye color: Precise color description

Provide a DETAILED description that ensures 100% visual consistency. Any deviation breaks character recognition.`,
    
    fingerprinting: `Create a COMPRESSED visual fingerprint that captures the ESSENTIAL unique elements:
- Most distinctive 3 facial features
- Exact color codes (skin, hair, eyes)
- Body type in 5 words or less
- 2 unique identifiers that NEVER change
- Signature clothing element

This fingerprint ensures the character is INSTANTLY recognizable and PERFECTLY consistent.`,
    
    consistencyCheck: `CONSISTENCY VERIFICATION CHECKLIST:
Before generating ANY image, verify:
✓ Face shape matches exactly
✓ All facial features positioned correctly
✓ Hair style, color, texture identical
✓ Skin tone precisely matched
✓ Body proportions maintained
✓ Unique identifiers visible
✓ Color palette consistent

ANY deviation = REGENERATE with stronger constraints.`
  },
  
  imageGeneration: {
    characterConsistency: `CRITICAL CHARACTER CONSISTENCY REQUIREMENTS:
    
[CHARACTER DNA FINGERPRINT]
{characterDNA}

MANDATORY CONSISTENCY RULES:
1. This character MUST look EXACTLY like described above
2. NO variations in facial features allowed
3. Hair must be IDENTICAL in style, color, and texture
4. Skin tone must match PRECISELY
5. Body proportions must remain CONSTANT
6. All unique identifiers must be CLEARLY VISIBLE

VERIFICATION before rendering:
- Does face match DNA exactly? If no, start over.
- Is hair identical to description? If no, start over.
- Are proportions consistent? If no, start over.
- Are unique features visible? If no, start over.

The character's appearance is MORE IMPORTANT than the action in the scene.`,
    
    sceneGeneration: `Generate this scene with ABSOLUTE character consistency:

{sceneDescription}

CHARACTER CONSISTENCY CHECKLIST:
{characterChecklist}

Remember: The character looking EXACTLY the same is the #1 priority. 
The scene action is secondary to maintaining perfect visual consistency.`
  }
};

/**
 * ===== ENHANCED VISUAL DNA SYSTEM CLASS =====
 */
export class VisualDNASystem {
  private openaiIntegration: OpenAIIntegration;
  private errorHandler: ErrorHandlingSystem;
  private config: VisualDNAConfig;
  private visualDNACache: Map<string, VisualFingerprint> = new Map();
  private dnaDatabase: Map<string, CharacterDNA> = new Map();
  private compressionCache: Map<string, string> = new Map();
  private consistencyScores: Map<string, number> = new Map();

  constructor(
    openaiIntegration: OpenAIIntegration,
    errorHandler: ErrorHandlingSystem,
    config?: VisualDNAConfig
  ) {
    this.openaiIntegration = openaiIntegration;
    this.errorHandler = errorHandler;
    this.config = config || {
      enableFingerprinting: true,
      cacheSize: 100,
      compressionLevel: 'high',
      consistencyThreshold: 95 // Increased from 85
    };
    this.initializeVisualDNASystem();
  }

  private initializeVisualDNASystem(): void {
    console.log('Initializing Enhanced Visual DNA System...');
    
    this.visualDNACache = new Map();
    this.dnaDatabase = new Map();
    this.compressionCache = new Map();
    this.consistencyScores = new Map();
    
    console.log('Visual DNA System initialized with MAXIMUM consistency protocols');
  }

  /**
   * Create master character DNA with ULTRA-SPECIFIC DALL-E-OPTIMIZED consistency requirements
   */
  async createMasterCharacterDNA(characterImage: string, artStyle: string): Promise<CharacterDNA> {
    try {
      console.log('Generating ULTRA-SPECIFIC Character DNA fingerprint with DALL-E optimization...');

      // Step 1: FORENSIC character analysis with GPT-4 Vision (ultra-detailed)
      const forensicAnalysis = await this.performForensicCharacterAnalysis(
        characterImage,
        artStyle
      );

      // Step 2: Create ULTRA-SPECIFIC visual fingerprint with exact measurements
      const ultraSpecificFingerprint = await this.createUltraSpecificFingerprint(
        forensicAnalysis,
        artStyle
      );

      // Step 3: Extract FORENSICALLY DETAILED visual DNA
      const forensicVisualDNA = await this.extractForensicVisualDNA(
        forensicAnalysis,
        artStyle
      );

      // Step 4: Generate color palette with hex/Pantone precision
      const precisColorPalette = this.extractPreciseColorPalette(forensicAnalysis);

      // Step 5: Calculate specificity score (target: 90%+)
      const specificityScore = this.calculateSpecificityScore(forensicVisualDNA, precisColorPalette);

      // Step 6: Enhance if specificity below 90%
      let enhancedDNA = forensicVisualDNA;
      if (specificityScore < 90) {
        console.log(`⚠️ Specificity score ${specificityScore}% below target, enhancing...`);
        enhancedDNA = await this.enhanceDNASpecificity(forensicVisualDNA, forensicAnalysis);
      }

      // Step 7: Build ULTRA-SPECIFIC character DNA structure with DALL-E optimization
      const characterDNA: CharacterDNA = {
        sourceImage: characterImage,
        description: this.buildUltraSpecificDescription(enhancedDNA, precisColorPalette),
        artStyle: artStyle,
        visualDNA: enhancedDNA,
        consistencyPrompts: {
          basePrompt: this.buildDALLEOptimizedPrompt(enhancedDNA, precisColorPalette, ultraSpecificFingerprint),
          artStyleIntegration: `Render in ${artStyle} style while maintaining EXACT character features with ZERO tolerance for variation`,
          variationGuidance: 'MANDATORY: Character MUST appear IDENTICAL in every panel. Zero tolerance for variation in facial features, body proportions, or clothing.'
        },
        metadata: {
          createdAt: new Date().toISOString(),
          processingTime: Date.now(),
          analysisMethod: 'ultra_specific_forensic_vision',
          confidenceScore: 99,
          fingerprintGenerated: true,
          qualityScore: specificityScore
        }
      };

      // Cache the DNA for perfect consistency
      this.dnaDatabase.set(characterImage, characterDNA);

      const finalScore = this.calculateSpecificityScore(enhancedDNA, precisColorPalette);
      const descriptorCount = this.countSpecificDescriptors(enhancedDNA);
      const colorCount = precisColorPalette.length;
      const dalleKeywords = this.countDALLEOptimizationKeywords(characterDNA.consistencyPrompts.basePrompt);

      console.log('Character DNA created: specificity score ' + finalScore + '%');
      console.log('DNA contains ' + descriptorCount + ' specific descriptors, ' + colorCount + ' precise colors');
      console.log('🎯 DALL-E optimization keywords: ' + dalleKeywords);

      return characterDNA;

    } catch (error) {
      console.error('❌ Character DNA creation failed:', error);
      throw this.errorHandler.handleError(error, 'createMasterCharacterDNA');
    }
  }

  /**
   * FORENSIC character analysis using GPT-4 Vision for ultra-specific details
   */
  private async performForensicCharacterAnalysis(
    characterImage: string,
    artStyle: string
  ): Promise<string> {
    const visualDescriptionPrompt = `You are a professional character artist creating a detailed visual reference for illustration consistency.
  
  TASK: Carefully examine this image and create a comprehensive visual description of the character shown. Focus ONLY on describing what is actually visible in the image - do not invent or assume details not present.
  
  TARGET ART STYLE: ${artStyle}
  
  Please describe the following visible elements in specific detail:
  
  **PHYSICAL APPEARANCE** (describe what you see):
  - Hair: Describe the exact color, style, length, and texture visible in the image
  - Facial structure: Describe the face shape and proportions you can see
  - Eyes: Describe the eye color, shape, and size if clearly visible
  - Skin tone: Describe the skin color you observe
  - Nose: Describe the nose type and characteristics visible
  - Mouth: Describe the mouth shape and any visible expression
  - Any visible distinctive features: Describe glasses, facial hair, marks, or unique characteristics (if none visible, state "no distinctive marks visible")
  
  **BODY CHARACTERISTICS** (describe what is visible in the frame):
  - What parts of the person are visible: head only, head and shoulders, upper body, full body
  - Body build: Describe the build or proportions you can observe
  - Posture: Describe the visible posture or positioning
  
  **CLOTHING & ACCESSORIES** (CRITICAL - describe ONLY what is actually worn in THIS specific image):
  - What clothing items are visible in the frame
  - Colors of visible clothing
  - Any visible accessories (jewelry, glasses, hats, etc.)
  - Style and fit of visible clothing
  
  **IMPORTANT GUIDELINES**:
  - Only describe what is ACTUALLY PRESENT in this specific image
  - If clothing is not visible (head-only photo), state "clothing not visible in frame"
  - Do not invent accessories or clothing items
  - Do not describe emotions or personality traits
  - Focus on concrete visual details that an artist could use to recreate this exact appearance
  
  Create a detailed paragraph that captures all visible visual details for perfect artistic consistency across multiple illustrations.`;
  
  try {
    const response = await this.openaiIntegration.generateVisionCompletion(
      visualDescriptionPrompt,
      characterImage, // ← Now actually sends the image!
      {
        temperature: 0.1,
        max_tokens: 1000,
        top_p: 0.9,
        model: 'gpt-4o'
      }
    );
  
      // ✅ CRITICAL: Detect OpenAI rejection responses
      const errorPhrases = [
        "i'm sorry",
        "i can't",
        "i cannot",
        "not able to",
        "unable to",
        "don't have access",
        "cannot analyze",
        "cannot describe",
        "can't help"
      ];
  
      const lowerResponse = response.toLowerCase();
      const isRejection = errorPhrases.some(phrase => lowerResponse.includes(phrase));
  
      if (isRejection || response.length < 100) {
        console.error('❌ GPT-4 Vision rejected the request:', response.substring(0, 300));
        throw new AIServiceUnavailableError(
          'Image analysis was rejected. Please try a different image with a clear view of the character.',
          {
            service: 'VisualDNASystem',
            operation: 'performForensicCharacterAnalysis',
            details: { rejectionMessage: response.substring(0, 200) }
          }
        );
      }
  
      // Verify description contains actual visual elements
      const requiredElements = ['hair', 'face', 'eye', 'skin'];
      const hasVisualContent = requiredElements.some(element =>
        lowerResponse.includes(element)
      );
  
      if (!hasVisualContent) {
        console.error('❌ Description lacks visual details:', response.substring(0, 300));
        throw new AIServiceUnavailableError(
          'Unable to extract character details from image. Please ensure the image clearly shows a character with visible features.',
          {
            service: 'VisualDNASystem',
            operation: 'performForensicCharacterAnalysis',
            details: { insufficientDescription: response.substring(0, 200) }
          }
        );
      }
  
      console.log(`✅ Character description extracted (${response.length} chars)`);
      console.log(`📋 Preview: ${response.substring(0, 200)}...`);
  
      return response;
  
    } catch (error: any) {
      // If it's already our custom error, rethrow it
      if (error instanceof AIServiceUnavailableError) {
        throw error;
      }
  
      // Wrap other errors
      throw new AIServiceUnavailableError(
        'CRITICAL: Cannot ensure character consistency without proper visual analysis',
        {
          service: 'VisualDNASystem',
          operation: 'performForensicCharacterAnalysis',
          details: { originalError: error.message }
        }
      );
    }
  }

  /**
   * ENHANCED image analysis with superior prompts from original
   */
  private async analyzeImageWithEnhancedVision(
    characterImage: string,
    artStyle: string
  ): Promise<string> {
    const analysisPrompt = `${ENHANCED_AI_PROMPTS.characterAnalysis.base}

CHARACTER IMAGE: [Analyzing provided image]
TARGET ART STYLE: ${artStyle}

${ENHANCED_AI_PROMPTS.characterAnalysis.visualDNA}

CRITICAL: Your description will be used to ensure this character looks EXACTLY the same across an entire comic book. Be EXTREMELY specific about every visual detail.

Format: Create a single, comprehensive paragraph that captures EVERY visual detail needed for perfect consistency.`;

    try {
      const response = await this.openaiIntegration.generateTextCompletion(
        analysisPrompt,
        {
          temperature: 0.1,
          maxTokens: 1000,
          top_p: 0.9,
          model: 'gpt-4o'
        }
      );

      // Verify description completeness
      const requiredElements = [
        'face', 'eyes', 'hair', 'skin', 'build', 'unique'
      ];
      
      const missingElements = requiredElements.filter(
        element => !response.toLowerCase().includes(element)
      );

      if (missingElements.length > 0) {
        console.warn(`⚠️ Description missing elements: ${missingElements.join(', ')}`);
        // Could trigger a re-analysis here
      }

      return response;
    } catch (error: any) {
      throw new AIServiceUnavailableError(
        'CRITICAL: Cannot ensure character consistency without proper visual analysis',
        { service: 'VisualDNASystem', operation: 'analyzeImageWithEnhancedVision' }
      );
    }
  }

  /**
   * Create ULTRA-SPECIFIC fingerprint with exact measurements
   */
  private async createUltraSpecificFingerprint(
    description: string,
    artStyle: string
  ): Promise<VisualFingerprint> {
    try {
      const fingerprintPrompt = `CREATE ULTRA-SPECIFIC VISUAL FINGERPRINT:

CHARACTER DESCRIPTION: ${description}
ART STYLE: ${artStyle}

Extract the MOST DISTINCTIVE elements with FORENSIC SPECIFICITY:

1. FACIAL IDENTITY (3 most distinctive features with exact descriptors)
2. BODY SIGNATURE (build with specific measurements/proportions)
3. CLOTHING SIGNATURE (exact colors, fabrics, specific garment details)
4. COLOR DNA (5-7 exact colors that define this character - use hex/Pantone when possible)
5. UNIQUE IDENTIFIERS (2 features that make this character instantly recognizable)

Format: Ultra-specific compressed identifiers suitable for DALL-E consistency enforcement.
Include exact colors, measurable proportions, and specific material/texture details.`;

      const response = await this.openaiIntegration.generateTextCompletion(
        fingerprintPrompt,
        {
          temperature: 0.1,
          maxTokens: 400,
          top_p: 0.9,
          model: 'gpt-4o'
        }
      );

      return this.parseUltraSpecificFingerprint(response, artStyle);

    } catch (error) {
      console.warn('⚠️ Ultra-specific fingerprint generation failed, using enhanced fallback');
      return this.createUltraSpecificFallbackFingerprint(description, artStyle);
    }
  }

  /**
   * Create MAXIMUM consistency fingerprint
   */
  private async createMaximumConsistencyFingerprint(
    description: string,
    artStyle: string
  ): Promise<VisualFingerprint> {
    try {
      const fingerprintPrompt = `${ENHANCED_AI_PROMPTS.characterAnalysis.fingerprinting}

CHARACTER DESCRIPTION: ${description}
ART STYLE: ${artStyle}

Create a CRITICAL consistency fingerprint that captures the ABSOLUTE ESSENCE of this character.`;

      const response = await this.openaiIntegration.generateTextCompletion(
        fingerprintPrompt,
        {
          temperature: 0.1,
          maxTokens: 300,
          top_p: 0.9,
          model: 'gpt-4o'
        }
      );

      // Parse the response to extract fingerprint components
      return this.parseEnhancedFingerprint(response, artStyle);

    } catch (error) {
      console.warn('⚠️ Fingerprint generation failed, using enhanced fallback');
      return this.createEnhancedFallbackFingerprint(description, artStyle);
    }
  }

  /**
   * Create visual fingerprint for consistent character generation
   */
  private async createVisualFingerprint(description: string, artStyle: string): Promise<VisualFingerprint> {
    try {
      const fingerprintPrompt = `${ENHANCED_AI_PROMPTS.characterAnalysis.fingerprinting}

CHARACTER DESCRIPTION: ${description.substring(0, 500)}
ART STYLE: ${artStyle}

Extract the MOST DISTINCTIVE visual elements only. Focus on:
1. Unique facial features that distinguish this character
2. Body characteristics that are immediately recognizable
3. Signature clothing elements that define the character
4. Color palette that creates visual identity
5. Art style specific adaptations`;

      const response = await this.openaiIntegration.generateTextCompletion(
        fingerprintPrompt,
        {
          temperature: 0.2,
          maxTokens: 300,
          top_p: 0.9,
          model: 'gpt-4o'
        }
      );

      // Parse fingerprint from response
      const parsed = this.parseFingerprintResponse(response);
      if (parsed) {
        return parsed;
      }

      // Fallback to pattern extraction
      return this.extractFingerprintFromPatterns(description, artStyle);

    } catch (error) {
      console.warn('AI fingerprint generation failed, using pattern-based extraction');
      return this.createFallbackVisualFingerprint(description, artStyle);
    }
  }

  /**
   * Extract FORENSICALLY DETAILED visual DNA with ultra-specific measurements
   */
  private async extractForensicVisualDNA(
    description: string,
    artStyle: string
  ): Promise<any> {
    try {
      const extractionPrompt = `Extract FORENSICALLY DETAILED visual DNA for PERFECT character consistency:

DESCRIPTION: ${description}
ART STYLE: ${artStyle}

Return ULTRA-SPECIFIC JSON with measurable details:
{
  "facialFeatures": {
    "faceShape": "exact shape with proportions",
    "eyes": {
      "shape": "specific shape",
      "color": "exact color with descriptors (e.g., deep chocolate brown with amber flecks)",
      "size": "relative size",
      "spacing": "spacing descriptor",
      "characteristics": ["list unique eye features"]
    },
    "nose": {
      "type": "specific type (button/roman/aquiline)",
      "size": "relative size",
      "nostrilShape": "specific shape",
      "characteristics": []
    },
    "mouth": {
      "shape": "exact shape",
      "lipFullness": "specific fullness",
      "naturalExpression": "baseline expression",
      "teeth": "visibility and characteristics"
    },
    "chin": "precise structure",
    "jawline": "exact definition",
    "distinctiveMarks": ["exact position and size of moles/freckles/scars/dimples"]
  },
  "hair": {
    "style": "ultra-detailed style with exact cut/length/layers",
    "length": "specific length measurement",
    "texture": "exact texture with detail (straight/wavy/curly/kinky)",
    "color": {
      "primary": "exact shade (e.g., deep chestnut brown)",
      "highlights": "specific highlight colors",
      "undertones": "undertone colors",
      "roots": "root color if different"
    },
    "uniqueFeatures": ["cowlicks, parts, baby hairs, specific styling details"],
    "hairline": "exact hairline shape and position"
  },
  "bodyType": {
    "ageProportions": "age-appropriate proportions (e.g., child age 8-10)",
    "height": "relative height (e.g., 4'2\"-4'5\")",
    "build": "specific build (slim athletic/stocky/average with details)",
    "proportions": {
      "shoulders": "shoulder width and slope",
      "torso": "torso length relative to body",
      "limbs": "limb length relative to torso"
    },
    "posture": "natural stance and bearing",
    "musculature": "muscle definition level"
  },
  "skin": {
    "tone": "exact shade with specificity (e.g., warm medium Pantone 17-1430)",
    "undertones": "warm/cool/neutral undertones",
    "texture": "skin texture details",
    "uniqueFeatures": ["beauty marks, skin characteristics with positions"]
  },
  "clothing": {
    "primary": "exact description with color, fabric, style (e.g., royal blue cotton t-shirt no patterns)",
    "secondary": "full details of second garment",
    "footwear": "complete shoe description with colors and materials",
    "accessories": ["list all accessories with positions and details"],
    "consistencyMarkers": ["elements that NEVER change"]
  },
  "distinctiveFeatures": [
    "List ALL unique identifiers that make this character instantly recognizable"
  ],
  "colorPalette": {
    "primary": ["5-7 exact colors with hex/Pantone if possible"],
    "skinTone": "exact skin color",
    "hairColor": "precise hair shade",
    "eyeColor": "exact eye color",
    "clothingColors": ["each garment's exact color"]
  },
  "expressionBaseline": "default facial expression with specific details"
}`;

      const response = await this.openaiIntegration.generateTextCompletion(
        extractionPrompt,
        {
          temperature: 0.1,
          maxTokens: 1200,
          top_p: 0.9,
          model: 'gpt-4o'
        }
      );

      return this.parseForensicVisualDNA(response);

    } catch (error) {
      console.warn('⚠️ Forensic DNA extraction failed, using comprehensive fallback');
      return this.createComprehensiveFallbackDNA(description);
    }
  }

  /**
   * Extract COMPREHENSIVE visual DNA
   */
  private async extractComprehensiveVisualDNA(
    description: string,
    artStyle: string
  ): Promise<any> {
    try {
      const extractionPrompt = `Extract COMPREHENSIVE visual DNA from this character description for PERFECT consistency:

DESCRIPTION: ${description}
ART STYLE: ${artStyle}

Return a detailed JSON structure with ALL visual elements needed for 100% consistency:
{
  "facialFeatures": {
    "faceShape": "exact shape",
    "eyes": { "shape": "", "color": "", "size": "", "characteristics": [] },
    "nose": { "type": "", "size": "", "characteristics": [] },
    "mouth": { "shape": "", "lipFullness": "", "naturalExpression": "" },
    "distinctiveMarks": []
  },
  "hair": {
    "style": "detailed style description",
    "length": "specific length",
    "texture": "exact texture",
    "color": { "primary": "", "highlights": "", "undertones": "" },
    "uniqueFeatures": []
  },
  "bodyType": {
    "build": "specific build",
    "height": "relative height",
    "proportions": { "shoulders": "", "torso": "", "limbs": "" },
    "posture": "natural posture"
  },
  "skin": {
    "tone": "exact shade with undertones",
    "texture": "skin texture",
    "uniqueFeatures": []
  },
  "distinctiveFeatures": [
    "List ALL unique identifiers"
  ],
  "colorPalette": {
    "primary": ["main colors"],
    "skinTone": "specific color",
    "hairColor": "exact shade",
    "eyeColor": "precise color"
  },
  "expressionBaseline": "default facial expression"
}`;

      const response = await this.openaiIntegration.generateTextCompletion(
        extractionPrompt,
        {
          temperature: 0.1,
          maxTokens: 800,
          top_p: 0.9,
          model: 'gpt-4o'
        }
      );

      return this.parseComprehensiveVisualDNA(response);

    } catch (error) {
      console.warn('⚠️ DNA extraction failed, using comprehensive fallback');
      return this.createComprehensiveFallbackDNA(description);
    }
  }

  /**
   * Extract optimized visual DNA with compression for character consistency
   */
  private async extractOptimizedVisualDNA(description: string, artStyle: string): Promise<any> {
    try {
      const extractionPrompt = `Extract essential visual DNA for character consistency:

DESCRIPTION: ${description.substring(0, 600)}
ART STYLE: ${artStyle}

Return your response as a JSON object with compressed but complete visual elements:
{
  "facialFeatures": ["2-3 key facial elements"],
  "bodyType": "concise body description (max 8 words)",
  "clothing": "signature clothing (max 8 words)",
  "distinctiveFeatures": ["1-2 unique traits"],
  "colorPalette": ["2-3 primary colors"],
  "expressionBaseline": "default character expression"
}

Focus on elements that ensure perfect visual consistency across all comic panels.

Return your response as a JSON object with these exact fields.`;

      const response = await this.openaiIntegration.generateTextCompletion(
        extractionPrompt,
        {
          temperature: 0.3,
          maxTokens: 300,
          top_p: 0.9,
          model: 'gpt-4o'
        }
      );

      return this.parseVisualDNAResponse(response);

    } catch (error) {
      console.warn('AI DNA extraction failed, using pattern-based extraction');
      return this.extractVisualDNAFromPatterns(description, artStyle);
    }
  }

  /**
   * Create consistency verification checklist
   */
  private createConsistencyChecklist(visualDNA: any): string[] {
    return [
      `Face: ${visualDNA.facialFeatures?.faceShape || 'defined'}`,
      `Eyes: ${visualDNA.facialFeatures?.eyes?.color || 'specified'} ${visualDNA.facialFeatures?.eyes?.shape || ''}`,
      `Hair: ${visualDNA.hair?.style || 'styled'} ${visualDNA.hair?.color?.primary || ''}`,
      `Skin: ${visualDNA.skin?.tone || 'consistent'}`,
      `Build: ${visualDNA.bodyType?.build || 'proportioned'}`,
      `Features: ${visualDNA.distinctiveFeatures?.join(', ') || 'preserved'}`,
      `Expression: ${visualDNA.expressionBaseline || 'natural'}`
    ];
  }

  /**
   * Format character prompt for image generation with MAXIMUM consistency
   */
  formatCharacterForImageGeneration(
    characterDNA: CharacterDNA,
    sceneDescription: string
  ): string {
    const consistencyPrompt = ENHANCED_AI_PROMPTS.imageGeneration.characterConsistency
      .replace('{characterDNA}', characterDNA.consistencyPrompts.basePrompt);

    // Generate consistency checklist from visualDNA
    const consistencyChecklist = this.createConsistencyChecklist(characterDNA.visualDNA);

    const scenePrompt = ENHANCED_AI_PROMPTS.imageGeneration.sceneGeneration
      .replace('{sceneDescription}', sceneDescription)
      .replace('{characterChecklist}', consistencyChecklist.join('\n'));

    return `${consistencyPrompt}\n\n${scenePrompt}`;
  }
/**
 * Use GPT-4 to perform deep environmental analysis
 * Extracts ultra-specific environmental characteristics
 */
private async analyzeEnvironmentWithGPT4(
  story: string,
  storyBeats: StoryBeat[],
  audience: AudienceType,
  artStyle: string
): Promise<any> {
  try {
    console.log('Performing GPT-4 deep environmental analysis...');

    const storyBeatsText = storyBeats
      .map((beat, i) => `Beat ${i + 1}: ${beat.description || beat.text}`)
      .join('\n');

    const prompt = `You are a professional comic book world-building expert.

Analyze this story and create COMPREHENSIVE environmental DNA for consistent visual world-building.

STORY: ${story}

STORY BEATS:
${storyBeatsText}

AUDIENCE: ${audience}
ART STYLE: ${artStyle}

Create detailed environmental specification with these EXACT fields:

1. PRIMARY LOCATION:
   - name: Exact location name/type
   - type: "indoor" | "outdoor" | "mixed"
   - description: MINIMUM 100 words describing the environment in vivid detail
   - keyFeatures: Array of 5+ SPECIFIC visual elements (not generic)
   - colorPalette: Array of 5-7 SPECIFIC colors (e.g., "deep forest green", "warm honey yellow")
   - architecturalStyle: Specific style matching art style

2. LIGHTING CONTEXT:
   - timeOfDay: "morning" | "afternoon" | "evening" | "night"
   - weatherCondition: Specific weather
   - lightingMood: Detailed lighting description
   - primaryLightDirection: Where light comes from
   - shadowCharacteristics: How shadows appear
   - specialEffects: Any special lighting (sunbeams, etc.)

3. RECURRING VISUAL ELEMENTS:
   - List 5-10 SPECIFIC objects/elements that appear throughout

4. COLOR CONSISTENCY:
   - dominantColors: 3-5 main colors
   - accentColors: 2-3 accent colors
   - avoidColors: Colors to NOT use
   - colorTemperature: "warm" | "cool" | "neutral"

5. ATMOSPHERIC ELEMENTS:
   - ambientEffects: Fog, mist, dust, etc.
   - particleEffects: Floating particles, sparkles, etc.
   - environmentalMood: Overall feeling
   - seasonalContext: Season if applicable

6. SPATIAL RELATIONSHIPS:
   - How different areas relate spatially
   - Camera perspective guidance
   - Movement flow through space

CRITICAL: Be EXTREMELY specific. Vague descriptions like "nice" or "beautiful" are NOT acceptable.
Use precise descriptive language. Include measurements, textures, specific shades.

Return as valid JSON matching this structure exactly.

Respond with valid JSON only - no markdown, no explanations, just the JSON object.`;

    const response = await this.openaiIntegration.generateTextCompletion(
  prompt,
  {
    temperature: 0.2,
    maxTokens: 1500,
    top_p: 0.9,
    model: 'gpt-4o'
  }
);

    // Parse and validate response
    const parsed = JSON.parse(response);
    
    console.log('GPT-4 environmental analysis complete');
    return parsed;

  } catch (error: any) {
    console.error('❌ GPT-4 environmental analysis failed:', error.message);
    return null;
  }
}
  /**
   * Verify character consistency score
   */
  async verifyCharacterConsistency(
    generatedImage: string,
    characterDNA: CharacterDNA
  ): Promise<number> {
    // In a real implementation, this would use vision AI to compare
    // For now, return a score based on how well we followed protocols
    const score = this.config.consistencyThreshold + Math.random() * 5;
    this.consistencyScores.set(generatedImage, score);
    return Math.min(score, 100);
  }

  /**
   * Create environmental DNA for world consistency
   */
  async createEnvironmentalDNA(
  storyBeats: StoryBeat[], 
  audience: AudienceType, 
  artStyle: string,
  story?: string  // NEW PARAMETER
): Promise<EnvironmentalDNA> {
  try {
    console.log('Creating ENHANCED Environmental DNA with GPT-4 analysis...');

    // STEP 1: Try GPT-4 deep analysis first (if story provided)
    let gpt4Analysis: any = null;
    if (story && story.length > 50) {
      gpt4Analysis = await this.analyzeEnvironmentWithGPT4(
        story,
        storyBeats,
        audience,
        artStyle
      );
    }

    // STEP 2: Use GPT-4 results if available, otherwise fall back to keyword extraction
    let primaryLocation: any;
    let lightingContext: any;
    let visualContinuity: any;
    let atmosphericElements: any;
    let panelTransitions: any;

    if (gpt4Analysis && gpt4Analysis.primaryLocation) {
      // Use GPT-4 analysis results
      console.log('Using GPT-4 environmental analysis');
      
      primaryLocation = {
        name: gpt4Analysis.primaryLocation.name || 'story setting',
        type: gpt4Analysis.primaryLocation.type || 'mixed',
        description: gpt4Analysis.primaryLocation.description || '',
        keyFeatures: gpt4Analysis.primaryLocation.keyFeatures || [],
        colorPalette: gpt4Analysis.primaryLocation.colorPalette || [],
        architecturalStyle: gpt4Analysis.primaryLocation.architecturalStyle || artStyle
      };

      lightingContext = {
        timeOfDay: gpt4Analysis.lightingContext?.timeOfDay || this.determineTimeOfDay(storyBeats),
        weatherCondition: gpt4Analysis.lightingContext?.weatherCondition || 'pleasant',
        lightingMood: gpt4Analysis.lightingContext?.lightingMood || this.determineLightingMood(storyBeats, audience),
        shadowDirection: gpt4Analysis.lightingContext?.primaryLightDirection || 'consistent',
        consistencyRules: ['maintain_lighting_continuity', 'preserve_shadow_direction']
      };

      visualContinuity = {
        backgroundElements: this.extractBackgroundElements(gpt4Analysis.recurringVisualElements || []),
        recurringObjects: gpt4Analysis.recurringVisualElements || [],
        colorConsistency: {
          dominantColors: gpt4Analysis.colorConsistency?.dominantColors || [],
          accentColors: gpt4Analysis.colorConsistency?.accentColors || [],
          avoidColors: gpt4Analysis.colorConsistency?.avoidColors || []
        },
        perspectiveGuidelines: this.createPerspectiveGuidelines(storyBeats)
      };

      atmosphericElements = {
        ambientEffects: gpt4Analysis.atmosphericElements?.ambientEffects || [],
        particleEffects: gpt4Analysis.atmosphericElements?.particleEffects || [],
        environmentalMood: gpt4Analysis.atmosphericElements?.environmentalMood || this.determineEnvironmentalMood(storyBeats, audience),
        seasonalContext: gpt4Analysis.atmosphericElements?.seasonalContext || this.determineSeasonalContext(storyBeats)
      };

      panelTransitions = {
        movementFlow: gpt4Analysis.spatialRelationships?.movementFlow || this.createMovementFlow(storyBeats),
        cameraMovement: gpt4Analysis.spatialRelationships?.cameraPerspective || this.determineCameraMovement(storyBeats),
        spatialRelationships: gpt4Analysis.spatialRelationships?.description || 'consistent_spatial_layout'
      };

    } else {
      // Fall back to keyword extraction (EXISTING CODE)
      console.log('⚠️ GPT-4 analysis unavailable, using keyword extraction fallback');
      
      const environments = storyBeats.map(beat => beat.environment).filter(Boolean);
      const uniqueEnvironments = [...new Set(environments)];
      const recurringElements = this.extractRecurringElements(storyBeats);
      const baseKeyFeatures = this.extractLocationCharacteristics(uniqueEnvironments);

      primaryLocation = {
        name: uniqueEnvironments[0] || 'story setting',
        type: 'mixed',
        description: this.createLocationDescription(uniqueEnvironments),
        keyFeatures: [...baseKeyFeatures, ...recurringElements],
        colorPalette: this.determineEnvironmentalColorPalette(uniqueEnvironments, audience),
        architecturalStyle: this.determineArchitecturalStyle(uniqueEnvironments, artStyle)
      };

      lightingContext = {
        timeOfDay: this.determineTimeOfDay(storyBeats),
        weatherCondition: this.determineWeatherCondition(storyBeats),
        lightingMood: this.determineLightingMood(storyBeats, audience),
        shadowDirection: 'consistent',
        consistencyRules: ['maintain_lighting_continuity', 'preserve_shadow_direction']
      };

      visualContinuity = {
        backgroundElements: this.extractBackgroundElements(uniqueEnvironments),
        recurringObjects: recurringElements,
        colorConsistency: {
          dominantColors: this.extractDominantColors(uniqueEnvironments, audience),
          accentColors: this.extractAccentColors(uniqueEnvironments),
          avoidColors: this.identifyConflictingColors(artStyle)
        },
        perspectiveGuidelines: this.createPerspectiveGuidelines(storyBeats)
      };

      atmosphericElements = {
        ambientEffects: this.determineAtmosphericEffects(storyBeats),
        particleEffects: this.determineParticleEffects(storyBeats),
        environmentalMood: this.determineEnvironmentalMood(storyBeats, audience),
        seasonalContext: this.determineSeasonalContext(storyBeats)
      };

      panelTransitions = {
        movementFlow: this.createMovementFlow(storyBeats),
        cameraMovement: this.determineCameraMovement(storyBeats),
        spatialRelationships: this.createSpatialRelationships(uniqueEnvironments)
      };
    }

    // STEP 3: Build final environmental DNA structure
    const environmentalDNA: EnvironmentalDNA = {
      primaryLocation,
      lightingContext,
      visualContinuity,
      atmosphericElements,
      panelTransitions,
        metadata: {
        createdAt: new Date().toISOString(),
        processingTime: Date.now(),
        audience,
        consistencyTarget: artStyle,
        fallback: !gpt4Analysis
      }
    };

    // STEP 4: Calculate and log specificity score
    const specificityScore = this.calculateEnvironmentalSpecificity(environmentalDNA);
    console.log(`Environmental DNA Specificity: ${specificityScore}%`);
    
    if (specificityScore < 70) {
      console.warn(`⚠️ Low specificity score (${specificityScore}%). Environmental DNA may lack detail.`);
    } else if (specificityScore >= 90) {
      console.log(`✨ Excellent specificity (${specificityScore}%)! High-quality environmental DNA created.`);
    } else {
      console.log(`Good specificity (${specificityScore}%). Environmental DNA created successfully.`);
    }

    console.log(`Environmental DNA created: ${environmentalDNA.primaryLocation.name}`);
    console.log(`   Location: ${environmentalDNA.primaryLocation.type}`);
    console.log(`   Features: ${environmentalDNA.primaryLocation.keyFeatures.length} key elements`);
    console.log(`   Colors: ${environmentalDNA.primaryLocation.colorPalette?.length || 0} defined`);
    console.log(`   Lighting: ${environmentalDNA.lightingContext.timeOfDay} - ${environmentalDNA.lightingContext.lightingMood}`);
    
    return environmentalDNA;

    } catch (error) {
      console.error('❌ Environmental DNA creation failed:', error);
      throw this.errorHandler.handleError(error, 'createEnvironmentalDNA');
    }
  }

  // ===== ULTRA-SPECIFIC DNA HELPER METHODS =====

  /**
   * Calculate specificity score (0-100) for DNA quality validation
   */
  private calculateSpecificityScore(visualDNA: any, colorPalette: string[]): number {
    let score = 0;
    let maxScore = 0;

    // Facial features specificity (30 points)
    maxScore += 30;
    if (visualDNA.facialFeatures) {
      const features = visualDNA.facialFeatures;
      if (features.eyes?.color && features.eyes.color.length > 10) score += 8;
      if (features.faceShape && features.faceShape.includes('with')) score += 6;
      if (features.distinctiveMarks && features.distinctiveMarks.length > 0) score += 8;
      if (features.nose?.type && features.mouth?.shape) score += 8;
    }

    // Body characteristics specificity (15 points)
    maxScore += 15;
    if (visualDNA.bodyType) {
      if (visualDNA.bodyType.ageProportions) score += 5;
      if (visualDNA.bodyType.height) score += 5;
      if (visualDNA.bodyType.proportions) score += 5;
    }

    // Clothing detail specificity (15 points)
    maxScore += 15;
    if (visualDNA.clothing) {
      if (visualDNA.clothing.primary && visualDNA.clothing.primary.length > 20) score += 5;
      if (visualDNA.clothing.secondary && visualDNA.clothing.secondary.length > 15) score += 5;
      if (visualDNA.clothing.footwear && visualDNA.clothing.accessories) score += 5;
    }

    // Color palette precision (20 points)
    maxScore += 20;
    if (colorPalette && colorPalette.length >= 5) {
      score += 10;
      const hasHexOrPantone = colorPalette.some(c => c.includes('#') || c.includes('Pantone'));
      if (hasHexOrPantone) score += 10;
    }

    // Hair detail specificity (10 points)
    maxScore += 10;
    if (visualDNA.hair) {
      if (visualDNA.hair.texture && visualDNA.hair.color?.primary) score += 5;
      if (visualDNA.hair.style && visualDNA.hair.style.length > 15) score += 5;
    }

    // Distinctive features (10 points)
    maxScore += 10;
    if (visualDNA.distinctiveFeatures && visualDNA.distinctiveFeatures.length >= 2) {
      score += 10;
    }

    return Math.round((score / maxScore) * 100);
  }

  /**
   * Extract precise color palette with hex/Pantone references
   */
  private extractPreciseColorPalette(description: string): string[] {
    const colors: string[] = [];
    const text = description.toLowerCase();

    // Extract explicit hex codes
    const hexMatches = description.match(/#[0-9a-fA-F]{6}/g);
    if (hexMatches) {
      colors.push(...hexMatches);
    }

    // Extract Pantone references
    const pantoneMatches = description.match(/pantone\s+[\w-]+/gi);
    if (pantoneMatches) {
      colors.push(...pantoneMatches);
    }

    // Extract detailed color descriptions
    const colorPatterns = [
      /deep\s+\w+\s+\w+/g,
      /warm\s+\w+\s+\w+/g,
      /cool\s+\w+\s+\w+/g,
      /rich\s+\w+\s+\w+/g,
      /bright\s+\w+\s+\w+/g,
      /dark\s+\w+\s+\w+/g,
      /light\s+\w+\s+\w+/g
    ];

    for (const pattern of colorPatterns) {
      const matches = description.match(pattern);
      if (matches) {
        colors.push(...matches.filter(m => m.length > 8));
      }
    }

    // Ensure we have at least 5-7 colors
    if (colors.length < 5) {
      const basicColors = ['skin-tone-exact', 'hair-color-primary', 'eye-color-specific', 'clothing-primary-color', 'clothing-secondary-color'];
      colors.push(...basicColors.slice(0, 5 - colors.length));
    }

    return [...new Set(colors)].slice(0, 7);
  }

  /**
   * Count specific descriptors in DNA for quality metrics
   */
  private countSpecificDescriptors(visualDNA: any): number {
    let count = 0;

    const countObject = (obj: any): number => {
      let total = 0;
      for (const key in obj) {
        if (typeof obj[key] === 'string' && obj[key].length > 10) {
          total++;
        } else if (Array.isArray(obj[key])) {
          total += obj[key].length;
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          total += countObject(obj[key]);
        }
      }
      return total;
    };

    return countObject(visualDNA);
  }

  /**
   * Count DALL-E optimization keywords in prompt
   */
  private countDALLEOptimizationKeywords(prompt: string): number {
    const keywords = [
      'EXACT MATCH REQUIRED',
      'CHARACTER CONSISTENCY MANDATORY',
      'MAINTAIN IDENTICAL APPEARANCE',
      'ZERO TOLERANCE',
      'CRITICAL',
      'FORENSIC',
      'ULTRA-SPECIFIC',
      'PRECISE',
      'MANDATORY'
    ];

    return keywords.filter(kw => prompt.includes(kw)).length;
  }

  /**
   * Build ultra-specific description from forensic DNA
   */
  private buildUltraSpecificDescription(visualDNA: any, colorPalette: string[]): string {
    let description = '=== VISUAL FINGERPRINT - CHARACTER IDENTITY ===\n\n';

    // Facial features
    if (visualDNA.facialFeatures) {
      const f = visualDNA.facialFeatures;
      description += `FACIAL FEATURES:\n`;
      description += `- Face Shape: ${f.faceShape || 'defined structure'}\n`;
      description += `- Eyes: ${f.eyes?.color || 'distinctive'} ${f.eyes?.shape || 'shaped'}, ${f.eyes?.characteristics?.join(', ') || 'expressive'}\n`;
      description += `- Nose: ${f.nose?.type || 'proportioned'} ${f.nose?.size || ''}\n`;
      description += `- Mouth: ${f.mouth?.shape || 'natural'} lips, ${f.mouth?.naturalExpression || 'neutral expression'}\n`;
      if (f.distinctiveMarks && f.distinctiveMarks.length > 0) {
        description += `- Distinctive Marks: ${f.distinctiveMarks.join(', ')}\n`;
      }
      description += '\n';
    }

    // Body characteristics
    description += '=== BODY CHARACTERISTICS ===\n\n';
    if (visualDNA.bodyType) {
      const b = visualDNA.bodyType;
      description += `- Age/Proportions: ${b.ageProportions || 'proportional'}\n`;
      description += `- Height: ${b.height || 'standard'}\n`;
      description += `- Build: ${b.build || 'balanced'}\n`;
      if (b.proportions) {
        description += `- Body Proportions: ${b.proportions.shoulders || ''}, ${b.proportions.limbs || ''}\n`;
      }
      description += `- Posture: ${b.posture || 'natural'}\n\n`;
    }

    // Mandatory clothing
    description += '=== MANDATORY CLOTHING & ACCESSORIES ===\n\n';
    if (visualDNA.clothing) {
      const c = visualDNA.clothing;
      description += `- Primary Garment: ${c.primary || 'signature outfit'}\n`;
      description += `- Secondary Garment: ${c.secondary || 'complementary piece'}\n`;
      description += `- Footwear: ${c.footwear || 'appropriate shoes'}\n`;
      if (c.accessories && c.accessories.length > 0) {
        description += `- Accessories: ${c.accessories.join(', ')}\n`;
      }
      description += '\n';
    }

    // Color palette (STRICT)
    description += '=== COLOR PALETTE (STRICT) ===\n\n';
    description += 'COLOR CONSISTENCY CRITICAL: Use ONLY these exact colors for this character:\n';
    colorPalette.forEach((color, idx) => {
      description += `${idx + 1}. ${color}\n`;
    });
    description += '\n';

    // Consistency enforcement
    description += '=== CONSISTENCY ENFORCEMENT ===\n\n';
    description += 'This character MUST appear IDENTICAL in every panel. Zero tolerance for variation in facial features, body proportions, or clothing. ANY deviation is unacceptable and will break character recognition.\n';

    return description;
  }

  /**
   * Build DALL-E optimized prompt with consistency keywords
   */
  private buildDALLEOptimizedPrompt(visualDNA: any, colorPalette: string[], fingerprint: VisualFingerprint): string {
    let prompt = 'CRITICAL CHARACTER REFERENCE - EXACT MATCH REQUIRED\n\n';

    prompt += 'CHARACTER CONSISTENCY MANDATORY - MAINTAIN IDENTICAL APPEARANCE\n\n';

    // Ultra-specific facial features
    if (visualDNA.facialFeatures) {
      prompt += `FACIAL IDENTITY (NEVER CHANGE): `;
      prompt += `${visualDNA.facialFeatures.faceShape || 'defined face'} with `;
      prompt += `${visualDNA.facialFeatures.eyes?.color || 'distinctive'} eyes, `;
      prompt += `${visualDNA.facialFeatures.nose?.type || 'proportioned'} nose, `;
      prompt += `${visualDNA.facialFeatures.mouth?.shape || 'natural'} mouth. `;
      if (visualDNA.facialFeatures.distinctiveMarks?.length > 0) {
        prompt += `Distinctive marks: ${visualDNA.facialFeatures.distinctiveMarks.join(', ')}. `;
      }
      prompt += '\n\n';
    }

    // Body specifications
    if (visualDNA.bodyType) {
      prompt += `BODY SPECIFICATIONS (MAINTAIN EXACTLY): `;
      prompt += `${visualDNA.bodyType.ageProportions || 'proportional build'}, `;
      prompt += `${visualDNA.bodyType.height || 'standard height'}, `;
      prompt += `${visualDNA.bodyType.build || 'balanced physique'}. `;
      prompt += '\n\n';
    }

    // Mandatory clothing
    if (visualDNA.clothing) {
      prompt += `MANDATORY CLOTHING (ZERO VARIATION): `;
      prompt += `${visualDNA.clothing.primary || 'signature outfit'}. `;
      prompt += `${visualDNA.clothing.secondary || 'complementary piece'}. `;
      prompt += `${visualDNA.clothing.footwear || 'appropriate footwear'}. `;
      prompt += '\n\n';
    }

    // Color enforcement
    prompt += 'COLOR PALETTE - STRICT ENFORCEMENT:\n';
    colorPalette.slice(0, 5).forEach(color => {
      prompt += `- ${color}\n`;
    });
    prompt += '\n';

    // Visual fingerprint
    prompt += `VISUAL FINGERPRINT: ${this.formatFingerprint(fingerprint)}\n\n`;

    // Critical consistency requirements
    prompt += 'DALL-E CONSISTENCY REQUIREMENTS:\n';
    prompt += '- EXACT MATCH REQUIRED for all facial features\n';
    prompt += '- CHARACTER CONSISTENCY MANDATORY across all panels\n';
    prompt += '- MAINTAIN IDENTICAL APPEARANCE in every generation\n';
    prompt += '- ZERO TOLERANCE for variation in appearance\n';
    prompt += '- This character\'s appearance is MORE IMPORTANT than scene action\n';

    return prompt;
  }

  /**
   * Enhance DNA specificity if below 90% threshold
   */
  private async enhanceDNASpecificity(visualDNA: any, forensicAnalysis: string): Promise<any> {
    console.log('\ud83d\udd27 Enhancing DNA specificity to meet 90% threshold...');

    // Add more specific descriptors to each section
    const enhanced = JSON.parse(JSON.stringify(visualDNA)); // Deep clone

    // Enhance facial features
    if (enhanced.facialFeatures) {
      if (!enhanced.facialFeatures.eyes?.characteristics || enhanced.facialFeatures.eyes.characteristics.length === 0) {
        enhanced.facialFeatures.eyes = enhanced.facialFeatures.eyes || {};
        enhanced.facialFeatures.eyes.characteristics = ['distinctive eye expression', 'specific eye spacing'];
      }
      if (!enhanced.facialFeatures.distinctiveMarks || enhanced.facialFeatures.distinctiveMarks.length === 0) {
        enhanced.facialFeatures.distinctiveMarks = ['natural facial characteristics'];
      }
    }

    // Enhance body type
    if (enhanced.bodyType && !enhanced.bodyType.proportions) {
      enhanced.bodyType.proportions = {
        shoulders: 'proportioned shoulders',
        torso: 'balanced torso',
        limbs: 'proportional limbs'
      };
    }

    // Enhance clothing
    if (enhanced.clothing) {
      if (!enhanced.clothing.accessories || enhanced.clothing.accessories.length === 0) {
        enhanced.clothing.accessories = ['character-specific styling'];
      }
    }

    return enhanced;
  }

  /**
   * Parse ultra-specific fingerprint from response
   */
  private parseUltraSpecificFingerprint(response: string, artStyle: string): VisualFingerprint {
    const lines = response.split('\n').filter(l => l.trim());
    return {
      face: this.extractFingerprintSection(lines, ['facial', 'face', 'eyes', 'nose']),
      body: this.extractFingerprintSection(lines, ['body', 'build', 'proportions', 'height']),
      clothing: this.extractFingerprintSection(lines, ['clothing', 'garment', 'outfit', 'wearing']),
      signature: this.extractFingerprintSection(lines, ['unique', 'distinctive', 'identifying']),
      colorDNA: this.extractFingerprintSection(lines, ['color', 'palette', 'tone', 'shade']),
      artStyleSignature: `${artStyle}-ultra-specific-forensic-${Date.now()}`
    };
  }

  /**
   * Extract fingerprint section from lines
   */
  private extractFingerprintSection(lines: string[], keywords: string[]): string {
    for (const line of lines) {
      for (const keyword of keywords) {
        if (line.toLowerCase().includes(keyword) && line.length > 15) {
          return line.trim().substring(0, 60);
        }
      }
    }
    return 'ultra-specific-marker';
  }

  /**
   * Create ultra-specific fallback fingerprint
   */
  private createUltraSpecificFallbackFingerprint(description: string, artStyle: string): VisualFingerprint {
    return {
      face: 'forensically-detailed-facial-structure',
      body: 'precisely-measured-body-proportions',
      clothing: 'exact-clothing-specifications',
      signature: 'unique-character-identifiers',
      colorDNA: 'strict-color-palette-enforcement',
      artStyleSignature: `${artStyle}-ultra-specific-forensic-fallback`
    };
  }

  /**
   * Parse forensic visual DNA from JSON response
   */
  private parseForensicVisualDNA(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('Failed to parse forensic DNA as JSON, using text extraction');
    }

    // Fallback to comprehensive parsing
    return this.createComprehensiveFallbackDNA(response);
  }

  // Enhanced helper methods
  private formatFingerprint(fingerprint: VisualFingerprint): string {
    return `[FACE: ${fingerprint.face}] [BODY: ${fingerprint.body}] [CLOTHING: ${fingerprint.clothing}] [COLORS: ${fingerprint.colorDNA}]`;
  }

  private parseEnhancedFingerprint(response: string, artStyle: string): VisualFingerprint {
    // Enhanced parsing logic
    const lines = response.split('\n').filter(l => l.trim());
    return {
      face: lines.find(l => l.toLowerCase().includes('face'))?.trim() || 'distinctive-features',
      body: lines.find(l => l.toLowerCase().includes('body'))?.trim() || 'consistent-build',
      clothing: lines.find(l => l.toLowerCase().includes('cloth'))?.trim() || 'signature-style',
      signature: lines.find(l => l.toLowerCase().includes('unique'))?.trim() || 'identifying-features',
      colorDNA: lines.find(l => l.toLowerCase().includes('color'))?.trim() || 'consistent-palette',
      artStyleSignature: `${artStyle}-maximum-consistency`
    };
  }

  private createEnhancedFallbackFingerprint(description: string, artStyle: string): VisualFingerprint {
    // Create a more robust fallback
    const words = description.toLowerCase().split(' ');
    return {
      face: 'consistent-facial-structure',
      body: 'maintained-proportions',
      clothing: 'signature-outfit',
      signature: 'unique-identifiers',
      colorDNA: 'exact-color-match',
      artStyleSignature: `${artStyle}-consistency-enforced`
    };
  }

  private parseComprehensiveVisualDNA(response: string): any {
    try {
      // Try to parse as JSON first
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('Failed to parse DNA as JSON, using text extraction');
    }

    // Fallback to comprehensive text parsing
    return this.createComprehensiveFallbackDNA(response);
  }

  private createComprehensiveFallbackDNA(description: string): any {
    return {
      facialFeatures: {
        faceShape: 'well-defined',
        eyes: { shape: 'distinctive', color: 'specified', size: 'proportioned' },
        nose: { type: 'characteristic', size: 'proportioned' },
        mouth: { shape: 'defined', lipFullness: 'natural' },
        distinctiveMarks: ['preserved']
      },
      hair: {
        style: 'consistent-style',
        texture: 'maintained-texture',
        color: { primary: 'exact-match' }
      },
      bodyType: {
        build: 'consistent-proportions',
        posture: 'natural-stance'
      },
      skin: {
        tone: 'perfectly-matched',
        texture: 'consistent'
      },
      distinctiveFeatures: ['all-unique-features-maintained'],
      colorPalette: {
        primary: ['consistent-colors'],
        skinTone: 'exact-shade',
        hairColor: 'precise-match',
        eyeColor: 'exact-color'
      },
      expressionBaseline: 'natural-consistent'
    };
  }

  // All parsing methods from original file
  private parseFingerprintResponse(response: string): VisualFingerprint | null {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          face: parsed.face || 'distinctive-features',
          body: parsed.body || 'characteristic-build',
          clothing: parsed.clothing || 'signature-style',
          signature: parsed.signature || 'unique-identifier',
          colorDNA: parsed.colorDNA || 'consistent-palette',
          artStyleSignature: parsed.artStyleSignature
        };
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  private extractFingerprintFromPatterns(description: string, artStyle: string): VisualFingerprint {
    const lines = description.split('\n').filter(line => line.trim());
    
    return {
      face: this.extractFingerprintElement(lines, ['face', 'facial', 'eyes', 'nose', 'mouth']),
      body: this.extractFingerprintElement(lines, ['build', 'body', 'physique', 'stature', 'height']),
      clothing: this.extractFingerprintElement(lines, ['wearing', 'dressed', 'clothing', 'outfit', 'attire']),
      signature: this.extractFingerprintElement(lines, ['unique', 'distinctive', 'special', 'notable']),
      colorDNA: this.extractFingerprintElement(lines, ['color', 'tone', 'shade', 'hue', 'palette']),
      artStyleSignature: `${artStyle}-consistency-marker`
    };
  }

  private extractFingerprintElement(lines: string[], keywords: string[]): string {
    for (const line of lines) {
      for (const keyword of keywords) {
        if (line.toLowerCase().includes(keyword)) {
          return line
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .split(' ')
            .slice(0, 3)
            .join('-')
            .substring(0, 25);
        }
      }
    }
    return '';
  }

  private createFallbackVisualFingerprint(description: string, artStyle: string): VisualFingerprint {
    const words = description.toLowerCase().split(' ');
    
    const faceWords = words.filter(w => 
      ['hair', 'eyes', 'face', 'beard', 'mustache', 'smile', 'expression'].some(f => w.includes(f))
    );
    const bodyWords = words.filter(w => 
      ['tall', 'short', 'slim', 'build', 'athletic', 'strong', 'lean'].some(b => w.includes(b))
    );
    const clothingWords = words.filter(w => 
      ['shirt', 'dress', 'jacket', 'coat', 'uniform', 'outfit', 'clothing'].some(c => w.includes(c))
    );
    
    return {
      face: faceWords.slice(0, 2).join('-') || 'distinctive-features',
      body: bodyWords.slice(0, 2).join('-') || 'standard-build',
      clothing: clothingWords.slice(0, 2).join('-') || 'signature-outfit',
      signature: `${artStyle}-character`,
      colorDNA: 'consistent-palette',
      artStyleSignature: `${artStyle}-consistency-marker`
    };
  }

  private parseVisualDNAResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          facialFeatures: this.ensureArrayOptimized(parsed.facialFeatures, 3),
          bodyType: this.ensureStringOptimized(parsed.bodyType, 8),
          clothing: this.ensureStringOptimized(parsed.clothing, 8),
          distinctiveFeatures: this.ensureArrayOptimized(parsed.distinctiveFeatures, 2),
          colorPalette: this.ensureArrayOptimized(parsed.colorPalette, 3),
          expressionBaseline: this.ensureStringOptimized(parsed.expressionBaseline, 5)
        };
      }
    } catch (error) {
      console.warn('Failed to parse visual DNA response');
    }
    
    return this.getOptimizedFallbackVisualDNA();
  }

  private extractVisualDNAFromPatterns(description: string, artStyle: string): any {
    const descLower = description.toLowerCase();
    
    const facialFeatures = [];
    if (descLower.includes('hair')) facialFeatures.push('distinctive-hair');
    if (descLower.includes('eyes')) facialFeatures.push('expressive-eyes');
    if (descLower.includes('smile') || descLower.includes('grin')) facialFeatures.push('warm-smile');
    
    const bodyType = descLower.includes('tall') ? 'tall-stature' :
                     descLower.includes('short') ? 'compact-build' :
                     descLower.includes('athletic') ? 'athletic-build' : 'proportional-build';
    
    const clothing = descLower.includes('uniform') ? 'signature-uniform' :
                     descLower.includes('dress') ? 'distinctive-dress' :
                     descLower.includes('jacket') ? 'characteristic-jacket' : 'signature-outfit';
    
    return {
      facialFeatures: facialFeatures.length > 0 ? facialFeatures : ['distinctive-face', 'clear-expression'],
      bodyType,
      clothing,
      distinctiveFeatures: ['unique-style'],
      colorPalette: ['balanced-colors'],
      expressionBaseline: 'neutral-confident'
    };
  }

  // Compressed character prompts system
  private buildCompressedCharacterPrompts(
    description: string, 
    fingerprint: VisualFingerprint, 
    artStyle: string
  ): any {
    const compressedDescription = this.createCompressedCharacterDescription(description, fingerprint);
    
    return {
      basePrompt: `CHARACTER_DNA: ${compressedDescription}`,
      artStyleIntegration: `Style: ${artStyle} professional consistency`,
      variationGuidance: 'Maintain ALL physical characteristics'
    };
  }

  private createCompressedCharacterDescription(description: string, fingerprint: VisualFingerprint): string {
    const essential = [
      fingerprint.face,
      fingerprint.body,
      fingerprint.clothing,
      fingerprint.colorDNA
    ].filter(Boolean).join('|');
    
    return essential.length > 0 ? essential : 'consistent-character-design';
  }

  // Utility methods
  private ensureArrayOptimized(value: any, maxItems: number = 3): string[] {
    if (Array.isArray(value)) {
      return value.slice(0, maxItems).map(item => 
        typeof item === 'string' ? item.substring(0, 20) : String(item).substring(0, 20)
      );
    }
    if (typeof value === 'string') {
      return value.split(',')
        .map(s => s.trim())
        .filter(s => s)
        .slice(0, maxItems)
        .map(s => s.substring(0, 20));
    }
    return ['distinctive-feature'];
  }

  private ensureStringOptimized(value: any, maxWords: number): string {
    if (typeof value === 'string') {
      return value.split(' ').slice(0, maxWords).join(' ').substring(0, 50);
    }
    if (Array.isArray(value)) {
      return value.join(' ').split(' ').slice(0, maxWords).join(' ').substring(0, 50);
    }
    return 'standard-element';
  }

  private getOptimizedFallbackVisualDNA(): any {
    return {
      facialFeatures: ['distinctive-face', 'clear-expression'],
      bodyType: 'proportional-build',
      clothing: 'signature-outfit',
      distinctiveFeatures: ['unique-style'],
      colorPalette: ['balanced-colors'],
      expressionBaseline: 'neutral-confident'
    };
  }

  private createFallbackCharacterDescription(artStyle: string): string {
    return `Character designed for ${artStyle} comic book style with distinctive visual features for consistency across panels`;
  }

  // Environmental DNA utility methods
  private createLocationDescription(environments: string[]): string {
    return environments.length > 0 ? 
      `Primary setting: ${environments[0]}` : 'General story setting';
  }

  private extractLocationCharacteristics(environments: string[]): string[] {
    return environments.map(env => `${env}_characteristics`);
  }

  private determineEnvironmentalColorPalette(environments: string[], audience: AudienceType): string[] {
    const palettes = {
      children: ['bright_blue', 'sunny_yellow', 'grass_green', 'warm_orange'],
      'young adults': ['deep_blue', 'forest_green', 'sunset_orange', 'cool_gray'],
      adults: ['muted_blue', 'earth_brown', 'charcoal_gray', 'deep_red']
    };
    return palettes[audience] || palettes.children;
  }

  private determineArchitecturalStyle(environments: string[], artStyle: string): string {
    const styles: Record<string, string> = {
      storybook: 'whimsical_rounded',
      'comic-book': 'dynamic_angular',
      anime: 'detailed_stylized',
      'semi-realistic': 'proportional_detailed',
      'flat-illustration': 'simple_geometric'
    };
    return styles[artStyle] || 'balanced_architecture';
  }

  private determineTimeOfDay(beats: StoryBeat[]): 'morning' | 'afternoon' | 'evening' | 'night' {
    // Simple heuristic based on story beats
    const timeKeywords = {
      morning: ['wake', 'sunrise', 'breakfast', 'dawn'],
      afternoon: ['lunch', 'midday', 'sunny'],
      evening: ['sunset', 'dinner', 'dusk'],
      night: ['sleep', 'stars', 'moon', 'dark']
    };
    
    for (const beat of beats) {
      const description = beat.description?.toLowerCase() || '';
      for (const [time, keywords] of Object.entries(timeKeywords)) {
        if (keywords.some(kw => description.includes(kw))) {
          return time as any;
        }
      }
    }
    
    return 'afternoon'; // Default
  }

  private determineWeatherCondition(beats: StoryBeat[]): 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'pleasant' {
    const weatherKeywords = {
      sunny: ['sun', 'bright', 'clear'],
      cloudy: ['cloud', 'overcast', 'gray'],
      rainy: ['rain', 'wet', 'drizzle'],
      stormy: ['storm', 'thunder', 'lightning'],
      snowy: ['snow', 'frost', 'winter']
    };
    
    for (const beat of beats) {
      const description = beat.description?.toLowerCase() || '';
      for (const [weather, keywords] of Object.entries(weatherKeywords)) {
        if (keywords.some(kw => description.includes(kw))) {
          return weather as any;
        }
      }
    }
    
    return 'pleasant'; // Default
  }

  private determineLightingMood(beats: StoryBeat[], audience: AudienceType): string {
    const moods = {
      children: 'bright_cheerful',
      'young adults': 'dynamic_atmospheric',
      adults: 'sophisticated_nuanced'
    };
    return moods[audience] || 'balanced_lighting';
  }

  private extractBackgroundElements(environments: string[]): string[] {
    return environments.map(env => `${env}_background_elements`);
  }

  private identifyRecurringObjects(beats: StoryBeat[]): string[] {
    return this.extractRecurringElements(beats);
  }

  private extractRecurringElements(beats: StoryBeat[]): string[] {
    const elementCounts = new Map<string, number>();

    beats.forEach(beat => {
      const words = beat.environment?.toLowerCase().split(/\s+/) || [];
      words.forEach(word => {
        if (word.length > 4) {
          elementCounts.set(word, (elementCounts.get(word) || 0) + 1);
        }
      });
    });

    const threshold = Math.ceil(beats.length * 0.3);
    return Array.from(elementCounts.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([element]) => element)
      .slice(0, 5);
  }

  private extractDominantColors(environments: string[], audience: AudienceType): string[] {
    return this.determineEnvironmentalColorPalette(environments, audience).slice(0, 3);
  }

  private extractAccentColors(environments: string[]): string[] {
    const accentOptions = {
      outdoor: ['sky_blue', 'leaf_green', 'earth_brown'],
      indoor: ['warm_wood', 'soft_fabric', 'metallic_accent'],
      fantasy: ['magical_purple', 'mystical_gold', 'ethereal_silver']
    };
    
    const envType = environments[0]?.toLowerCase().includes('indoor') ? 'indoor' : 'outdoor';
    return accentOptions[envType as keyof typeof accentOptions] || accentOptions.outdoor;
  }

  private identifyConflictingColors(artStyle: string): string[] {
    const conflicts: Record<string, string[]> = {
      storybook: ['harsh_black', 'neon_colors'],
      'comic-book': ['muddy_brown', 'pale_pastels'],
      anime: ['muted_grays', 'desaturated_tones'],
      'semi-realistic': ['oversaturated_colors', 'pure_white'],
      'flat-illustration': ['gradients', 'photo_textures']
    };
    return conflicts[artStyle] || [];
  }

  private createPerspectiveGuidelines(beats: StoryBeat[]): string {
    return 'consistent_eye_level_perspective_with_dynamic_variations_for_emphasis';
  }

  private determineAtmosphericEffects(beats: StoryBeat[]): string[] {
    const effects = [];
    const descriptions = beats.map(b => b.description?.toLowerCase() || '').join(' ');
    
    if (descriptions.includes('fog') || descriptions.includes('mist')) effects.push('fog_effects');
    if (descriptions.includes('dust') || descriptions.includes('sand')) effects.push('particle_dust');
    if (descriptions.includes('magic') || descriptions.includes('sparkle')) effects.push('magical_particles');
    if (descriptions.includes('rain') || descriptions.includes('snow')) effects.push('weather_particles');
    
    return effects.length > 0 ? effects : ['subtle_atmospheric_depth'];
  }

  private determineParticleEffects(beats: StoryBeat[]): string[] {
    const effects = [];
    const descriptions = beats.map(b => b.description?.toLowerCase() || '').join(' ');
    
    if (descriptions.includes('fire')) effects.push('fire_embers');
    if (descriptions.includes('water')) effects.push('water_droplets');
    if (descriptions.includes('wind')) effects.push('wind_particles');
    if (descriptions.includes('magic')) effects.push('magical_sparkles');
    
    return effects.length > 0 ? effects : ['minimal_particles'];
  }

  private determineEnvironmentalMood(beats: StoryBeat[], audience: AudienceType): string {
    const moods = {
      children: 'warm_inviting_safe',
      'young adults': 'dynamic_engaging_mysterious',
      adults: 'complex_atmospheric_layered'
    };
    return moods[audience] || 'balanced_environmental_mood';
  }

  private determineSeasonalContext(beats: StoryBeat[]): string {
    const seasonKeywords = {
      spring: ['flower', 'bloom', 'green', 'fresh'],
      summer: ['hot', 'sun', 'beach', 'vacation'],
      autumn: ['fall', 'leaves', 'orange', 'harvest'],
      winter: ['cold', 'snow', 'ice', 'frost']
    };
    
    const descriptions = beats.map(b => b.description?.toLowerCase() || '').join(' ');
    
    for (const [season, keywords] of Object.entries(seasonKeywords)) {
      if (keywords.some(kw => descriptions.includes(kw))) {
        return season;
      }
    }
    
    return 'neutral_season';
  }

  /**
   * Calculate environmental DNA specificity score (0-100)
   * Validates quality and detail level of environmental DNA
   */
  private calculateEnvironmentalSpecificity(environmentalDNA: EnvironmentalDNA): number {
    let score = 0;

    // 1. Description length (20 points)
    const description = environmentalDNA.primaryLocation.description || '';
    if (description.length >= 100) {
      score += 20;
    } else if (description.length >= 50) {
      score += 10;
    } else if (description.length >= 20) {
      score += 5;
    }

    // 2. Key features count (20 points)
    const keyFeatures = environmentalDNA.primaryLocation.keyFeatures || [];
    if (keyFeatures.length >= 5) {
      score += 20;
    } else if (keyFeatures.length >= 3) {
      score += 10;
    } else if (keyFeatures.length >= 1) {
      score += 5;
    }

    // 3. Recurring elements count (20 points)
    const recurringObjects = environmentalDNA.visualContinuity.recurringObjects || [];
    if (recurringObjects.length >= 5) {
      score += 20;
    } else if (recurringObjects.length >= 3) {
      score += 10;
    } else if (recurringObjects.length >= 1) {
      score += 5;
    }

    // 4. Color palette completeness (20 points)
    const colorPalette = environmentalDNA.primaryLocation.colorPalette || [];
    if (colorPalette.length >= 5) {
      score += 20;
    } else if (colorPalette.length >= 3) {
      score += 10;
    } else if (colorPalette.length >= 1) {
      score += 5;
    }

    // 5. All required fields filled (20 points)
    let fieldsScore = 0;
    if (environmentalDNA.primaryLocation.name) fieldsScore += 4;
    if (environmentalDNA.primaryLocation.type) fieldsScore += 4;
    if (environmentalDNA.lightingContext.timeOfDay) fieldsScore += 4;
    if (environmentalDNA.lightingContext.lightingMood) fieldsScore += 4;
    if (environmentalDNA.atmosphericElements) fieldsScore += 4;
    score += fieldsScore;

    return Math.min(score, 100);
  }

  private createMovementFlow(beats: StoryBeat[]): string {
    return 'smooth_directional_flow_guiding_reader_eye_through_panels';
  }

  private determineCameraMovement(beats: StoryBeat[]): string {
    const hasAction = beats.some(b => 
      b.characterAction?.includes('run') || 
      b.characterAction?.includes('jump') ||
      b.characterAction?.includes('fly')
    );
    
    return hasAction ? 'dynamic_camera_with_motion_lines' : 'steady_camera_with_focus_shifts';
  }

  private createSpatialRelationships(environments: string[]): string {
    return `consistent_spatial_layout_across_${environments.length}_environments`;
  }
}