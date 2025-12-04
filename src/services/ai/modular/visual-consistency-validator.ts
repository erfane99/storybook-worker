/**
 * ===== VISUAL CONSISTENCY VALIDATOR MODULE =====
 * GPT-4 Vision-based character consistency validation system
 *
 * File Location: src/services/ai/modular/visual-consistency-validator.ts
 *
 * Features:
 * - GPT-4 Vision API integration for visual analysis
 * - Character DNA consistency validation
 * - Panel-to-panel sequential consistency checking
 * - Detailed scoring across 6 consistency dimensions
 * - Database persistence of validation results
 * - Graceful degradation when Vision API unavailable
 * - Intelligent retry with enhanced prompts
 */

import {
  AIServiceUnavailableError,
  AIRateLimitError,
  AITimeoutError,
  BaseServiceError
} from './error-handling-system.js';

import { ErrorCategory, ErrorSeverity } from '../../errors/index.js';

import { OpenAIIntegration } from './openai-integration.js';

// ===== INTERFACES =====

export interface CharacterDNA {
  sourceImage: string;
  cartoonImage?: string;
  description: string;
  artStyle: string;
  visualDNA: {
    facialFeatures: string[];
    bodyType: string;
    clothing: string;
    distinctiveFeatures: string[];
    colorPalette: string[];
    expressionBaseline: string;
  };
  visualFingerprint?: {
    face: string;
    body: string;
    clothing: string;
    signature: string;
    colorDNA: string;
    artStyleSignature: string;
  };
  consistencyPrompts?: {
    basePrompt: string;
    artStyleIntegration: string;
    variationGuidance: string;
  };
  consistencyChecklist?: string[];
}

export interface ConsistencyScore {
  overallScore: number;
  facialConsistency: number;
  bodyProportionConsistency: number;
  clothingConsistency: number;
  colorPaletteConsistency: number;
  artStyleConsistency: number;
  detailedAnalysis: string;
  failureReasons: string[];
  passesThreshold: boolean;
}

export interface ValidationContext {
  jobId: string;
  panelNumber: number;
  attemptNumber: number;
  generatedImageUrl: string;
  characterDNA: CharacterDNA;
  previousPanelUrl?: string;
}

export interface ValidationResult extends ConsistencyScore {
  validationTimestamp: string;
  attemptNumber: number;
  panelNumber: number;
}

/**
 * Custom error for validation failures that should trigger regeneration
 */
export class ValidationError extends BaseServiceError {
  public readonly type = 'VALIDATION_ERROR';
  public readonly category = ErrorCategory.VALIDATION;
  public readonly retryable = true;
  public readonly severity = ErrorSeverity.HIGH;
  public override readonly name = 'ValidationError';

  public consistencyScore: ConsistencyScore;

  constructor(message: string, score: ConsistencyScore, context?: any) {
    super(message, {
      service: 'VisualConsistencyValidator',
      operation: 'validateConsistency',
      details: {
        overallScore: score.overallScore,
        failureReasons: score.failureReasons,
        ...context
      }
    });
    this.consistencyScore = score;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

// ===== VALIDATION CONSTANTS =====

const VALIDATION_THRESHOLD = 90; // Minimum score to pass validation
const MAX_RETRY_ATTEMPTS = 3;
const VISION_API_TIMEOUT = 180000; // 180 seconds

const VALIDATION_PROMPT_TEMPLATE = `You are a professional comic book quality control expert. Analyze this generated comic panel image and compare it against the character DNA specification.

CHARACTER DNA SPECIFICATION:
{characterDescription}

VISUAL FINGERPRINT REQUIREMENTS:
- Face: {visualFingerprint.face}
- Body: {visualFingerprint.body}
- Clothing: {visualFingerprint.clothing}
- Signature Features: {visualFingerprint.signature}
- Color DNA: {visualFingerprint.colorDNA}

CRITICAL ANALYSIS REQUIRED:
1. Does the face match the DNA exactly? (Check face shape, eyes, hair, skin tone)
2. Are body proportions consistent with DNA? (Check build, height, proportions)
3. Is clothing identical to DNA? (Check every garment detail)
4. Are all signature features visible? (Check unique identifiers)
5. Does color palette match DNA? (Check all colors used)
6. Does art style match DNA? (Check rendering style, line weight, shading)

{panelToPanelInstructions}

Rate each aspect 0-100 and provide overall consistency score.
BE STRICT: Even minor deviations should reduce score significantly.
FAIL if overall score < 90.

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "overallScore": number,
  "facialConsistency": number,
  "bodyProportionConsistency": number,
  "clothingConsistency": number,
  "colorPaletteConsistency": number,
  "artStyleConsistency": number,
  "detailedAnalysis": "detailed text analysis",
  "failureReasons": ["reason1", "reason2"]
}`;

const PANEL_TO_PANEL_INSTRUCTIONS = `
ADDITIONAL: Compare with previous panel for panel-to-panel consistency.
The character must look IDENTICAL between panels.
Check for:
- Same facial features and expression style
- Same body proportions and build
- Same clothing and accessories
- Same color palette
- Same art style and rendering quality

Any inconsistencies between panels should significantly reduce the score.`;

// ===== MAIN VALIDATOR CLASS =====

export class VisualConsistencyValidator {
  private openaiIntegration: OpenAIIntegration;
  private databaseService: any; // Will be injected
  private logger: any;
  private errorHandler: any;
  private validationHistory: Map<string, ConsistencyScore[]> = new Map();
  private smartValidationEnabled = true;

  constructor(
    openaiIntegration: OpenAIIntegration,
    databaseService: any,
    errorHandler?: any,
    logger?: any
  ) {
    this.openaiIntegration = openaiIntegration;
    this.databaseService = databaseService;
    this.errorHandler = errorHandler;
    this.logger = logger || console;
  }

  /**
   * Validate that a URL is a valid Cloudinary image URL
   * Prevents "Failed to download image" errors from invalid URLs
   */
  private isValidImageUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    // Must be from Cloudinary and be an actual image file
    const validPatterns = [
      /^https:\/\/res\.cloudinary\.com\/.+\.(jpg|jpeg|png|webp)/i,
      /^https:\/\/res\.cloudinary\.com\/.+\/image\/upload\//i
    ];
    
    return validPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Validate character consistency for a single panel
   * This is the main entry point for validation
   */
  public async validateCharacterConsistency(
    generatedImageUrl: string,
    characterDNA: CharacterDNA,
    context: {
      jobId: string;
      panelNumber: number;
      attemptNumber?: number;
      previousPanelUrl?: string;
    }
  ): Promise<ConsistencyScore> {
    const attemptNumber = context.attemptNumber || 1;

    // ✅ PRE-CHECK: Validate URL before Vision API call
    if (!this.isValidImageUrl(generatedImageUrl)) {
      this.logger.error(`❌ Invalid image URL for panel ${context.panelNumber}: ${generatedImageUrl?.substring(0, 100)}...`);
      throw new ValidationError(
        `Invalid image URL provided to validator. Expected Cloudinary URL, got: ${generatedImageUrl?.substring(0, 100)}...`,
        {
          overallScore: 0,
          facialConsistency: 0,
          bodyProportionConsistency: 0,
          clothingConsistency: 0,
          colorPaletteConsistency: 0,
          artStyleConsistency: 0,
          detailedAnalysis: 'URL validation failed - not a valid Cloudinary image URL',
          failureReasons: ['Invalid URL format - expected Cloudinary image URL'],
          passesThreshold: false
        }
      );
    }

    // ✅ FIX #13: Smart validation - skip if quality pattern established
    if (this.shouldSkipValidation(context.jobId, context.panelNumber)) {
      this.logger.log(`⚡ Smart validation: Skipping panel ${context.panelNumber} (consistent quality pattern established)`);
      
      const skipScore: ConsistencyScore = {
        overallScore: 95, // Assume high quality based on pattern
        facialConsistency: 95,
        bodyProportionConsistency: 95,
        clothingConsistency: 95,
        colorPaletteConsistency: 95,
        artStyleConsistency: 95,
        detailedAnalysis: 'Validation skipped - consistent quality pattern established',
        failureReasons: [],
        passesThreshold: true
      };
      
      return skipScore;
    }

    this.logger.log(`🔍 Validating panel ${context.panelNumber} (attempt ${attemptNumber}/3)...`);

    try {
      // Call GPT-4 Vision API for validation
      const score = await this.performVisionValidation(
        generatedImageUrl,
        characterDNA,
        context.previousPanelUrl
      );

      // Store validation result in database
      await this.storeValidationResult(context.jobId, context.panelNumber, attemptNumber, score);

      // Check if validation passes threshold
      if (score.passesThreshold) {
        this.logger.log(`✅ Panel ${context.panelNumber} passed validation (score: ${score.overallScore}/100)`);
      } else {
        this.logger.error(`❌ Panel ${context.panelNumber} failed validation (score: ${score.overallScore}/100)`);
        this.logger.error(`   Failure reasons: ${score.failureReasons.join(', ')}`);
      }

      // ✅ FIX #13: Track validation result for smart validation
      this.trackValidationResult(context.jobId, score);

      return score;

    } catch (error: any) {
      // Graceful degradation: if Vision API unavailable, continue without validation
      if (this.isVisionAPIUnavailable(error)) {
        this.logger.warn(`⚠️ GPT-4 Vision API unavailable, marking panel as unvalidated`);

        const fallbackScore: ConsistencyScore = {
          overallScore: -1, // Special marker for unvalidated
          facialConsistency: -1,
          bodyProportionConsistency: -1,
          clothingConsistency: -1,
          colorPaletteConsistency: -1,
          artStyleConsistency: -1,
          detailedAnalysis: 'Validation skipped - GPT-4 Vision API unavailable',
          failureReasons: ['Vision API unavailable'],
          passesThreshold: true // Don't block generation
        };

        await this.storeValidationResult(context.jobId, context.panelNumber, attemptNumber, fallbackScore);
        return fallbackScore;
      }

      // Other errors should bubble up
      throw error;
    }
  }

  /**
   * Perform validation using GPT-4 Vision API
   */
  private async performVisionValidation(
    generatedImageUrl: string,
    characterDNA: CharacterDNA,
    previousPanelUrl?: string
  ): Promise<ConsistencyScore> {
    // ✅ PRIORITY 2 FIX: Use cartoon image as visual reference instead of text description
    const characterReferenceImage = characterDNA.cartoonImage || characterDNA.sourceImage;
    
    // Validate that we have a valid reference image URL
    if (!characterReferenceImage || !characterReferenceImage.startsWith('http')) {
      console.warn('⚠️ No valid character reference image available, using text-only validation');
      // Fallback to text-based validation
      const prompt = this.buildValidationPrompt(characterDNA, !!previousPanelUrl);
      const response = await this.callGPT4Vision(
        prompt,
        [generatedImageUrl, previousPanelUrl].filter(Boolean) as string[]
      );
      return this.parseValidationResponse(response);
    }
    
    // Build validation prompt (simplified since we have image reference)
    const prompt = `You are a professional comic book quality control expert. 

TASK: Compare the generated panel image against the character reference image to verify consistency.

IMAGE 1: Character Reference (the cartoon character that should appear in all panels)
IMAGE 2: Generated Panel (the panel being validated)
${previousPanelUrl ? 'IMAGE 3: Previous Panel (for sequential consistency check)' : ''}

CRITICAL ANALYSIS:
1. Does the character in IMAGE 2 match IMAGE 1 exactly?
   - Face: Same facial features, eyes, hair, skin tone?
   - Body: Same proportions and build?
   - Clothing: Identical clothing and accessories?
   - Colors: Same color palette?
   - Art Style: Same rendering style?

${previousPanelUrl ? `2. Does IMAGE 2 maintain consistency with IMAGE 3?
   - Character looks identical between panels?
   - Only pose/expression should change?` : ''}

Rate each aspect 0-100. BE STRICT: Even minor deviations should reduce score significantly.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "overallScore": number,
  "facialConsistency": number,
  "bodyProportionConsistency": number,
  "clothingConsistency": number,
  "colorPaletteConsistency": number,
  "artStyleConsistency": number,
  "detailedAnalysis": "detailed analysis",
  "failureReasons": ["reason1", "reason2"]
}`;

    // ✅ Send CHARACTER REFERENCE IMAGE + GENERATED PANEL(S) to Vision API
    const imageUrls = [
      characterReferenceImage,  // FIRST: Character reference
      generatedImageUrl,        // SECOND: Generated panel
      previousPanelUrl          // THIRD (optional): Previous panel
    ].filter(Boolean) as string[];

    const response = await this.callGPT4Vision(prompt, imageUrls);

    // Parse response
    const score = this.parseValidationResponse(response);

    // Determine if passes threshold
    score.passesThreshold = this.determineIfPassesThreshold(score);

    return score;
  }

  /**
   * Call GPT-4 Vision API with proper message format
   */
  private async callGPT4Vision(
    prompt: string,
    imageUrls: string[]
  ): Promise<string> {
    try {
      // Build messages array with text and image content
      const content: any[] = [
        { type: 'text', text: prompt }
      ];

      // Add image URLs
      for (const imageUrl of imageUrls) {
        content.push({
          type: 'image_url',
          image_url: { url: imageUrl }
        });
      }

      const messages = [{
        role: 'user',
        content: content
      }];

      // Make API call using OpenAI Integration
      const response = await this.makeVisionAPICall(messages);

      return response;

    } catch (error: any) {
      this.logger.error('GPT-4 Vision API call failed:', error);
      throw error;
    }
  }

  /**
   * Make Vision API call with retry logic
   */
  private async makeVisionAPICall(messages: any[]): Promise<string> {
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Use OpenAI Integration's internal fetch method
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), VISION_API_TIMEOUT);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: messages,
            max_tokens: 1500,
            temperature: 0.3
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          if (response.status === 429) {
            throw new AIRateLimitError('GPT-4 Vision rate limit exceeded', {
              service: 'VisualConsistencyValidator',
              operation: 'callGPT4Vision',
              details: { httpStatus: response.status }
            });
          }

          throw new AIServiceUnavailableError(
            `Vision API error: ${errorData.error?.message || response.statusText}`,
            {
              service: 'VisualConsistencyValidator',
              operation: 'callGPT4Vision',
              details: { httpStatus: response.status }
            }
          );
        }

        const data = await response.json();

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          throw new AIServiceUnavailableError('Invalid response from Vision API', {
            service: 'VisualConsistencyValidator',
            operation: 'callGPT4Vision'
          });
        }

        return data.choices[0].message.content;

      } catch (error: any) {
        lastError = error;

        if (error.name === 'AbortError') {
          throw new AITimeoutError(`Vision API request timed out after ${VISION_API_TIMEOUT}ms`, {
            service: 'VisualConsistencyValidator',
            operation: 'callGPT4Vision'
          });
        }

        // Don't retry on rate limits or timeouts
        if (error instanceof AIRateLimitError || error instanceof AITimeoutError) {
          throw error;
        }

        // Retry on other errors
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          this.logger.warn(`Vision API attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    throw lastError;
  }

  /**
   * Build validation prompt from character DNA
   */
  private buildValidationPrompt(characterDNA: CharacterDNA, includePanelToPanel: boolean): string {
    let prompt = VALIDATION_PROMPT_TEMPLATE;

    // Replace character description
    prompt = prompt.replace('{characterDescription}', characterDNA.description);

    // Replace visual fingerprint components
    if (characterDNA.visualFingerprint) {
      prompt = prompt.replace('{visualFingerprint.face}', characterDNA.visualFingerprint.face);
      prompt = prompt.replace('{visualFingerprint.body}', characterDNA.visualFingerprint.body);
      prompt = prompt.replace('{visualFingerprint.clothing}', characterDNA.visualFingerprint.clothing);
      prompt = prompt.replace('{visualFingerprint.signature}', characterDNA.visualFingerprint.signature);
      prompt = prompt.replace('{visualFingerprint.colorDNA}', characterDNA.visualFingerprint.colorDNA);
    } else {
      // Fallback to visual DNA
      prompt = prompt.replace('{visualFingerprint.face}', characterDNA.visualDNA.facialFeatures.join(', '));
      prompt = prompt.replace('{visualFingerprint.body}', characterDNA.visualDNA.bodyType);
      prompt = prompt.replace('{visualFingerprint.clothing}', characterDNA.visualDNA.clothing);
      prompt = prompt.replace('{visualFingerprint.signature}', characterDNA.visualDNA.distinctiveFeatures.join(', '));
      prompt = prompt.replace('{visualFingerprint.colorDNA}', characterDNA.visualDNA.colorPalette.join(', '));
    }

    // Add panel-to-panel instructions if needed
    if (includePanelToPanel) {
      prompt = prompt.replace('{panelToPanelInstructions}', PANEL_TO_PANEL_INSTRUCTIONS);
    } else {
      prompt = prompt.replace('{panelToPanelInstructions}', '');
    }

    return prompt;
  }

  /**
   * Parse validation response from GPT-4 Vision
   */
  private parseValidationResponse(response: string): ConsistencyScore {
    try {
      // Remove markdown code blocks if present
      let jsonStr = response.trim();
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      // Try to extract JSON from response
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Vision API response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      const required = [
        'overallScore',
        'facialConsistency',
        'bodyProportionConsistency',
        'clothingConsistency',
        'colorPaletteConsistency',
        'artStyleConsistency',
        'detailedAnalysis'
      ];

      for (const field of required) {
        if (!(field in parsed)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Ensure failureReasons is an array
      if (!Array.isArray(parsed.failureReasons)) {
        parsed.failureReasons = [];
      }

      // Calculate overall score if not present or invalid
      if (typeof parsed.overallScore !== 'number' || parsed.overallScore < 0 || parsed.overallScore > 100) {
        parsed.overallScore = Math.round(
          (parsed.facialConsistency +
           parsed.bodyProportionConsistency +
           parsed.clothingConsistency +
           parsed.colorPaletteConsistency +
           parsed.artStyleConsistency) / 5
        );
      }

      return {
        overallScore: parsed.overallScore,
        facialConsistency: parsed.facialConsistency,
        bodyProportionConsistency: parsed.bodyProportionConsistency,
        clothingConsistency: parsed.clothingConsistency,
        colorPaletteConsistency: parsed.colorPaletteConsistency,
        artStyleConsistency: parsed.artStyleConsistency,
        detailedAnalysis: parsed.detailedAnalysis,
        failureReasons: parsed.failureReasons,
        passesThreshold: false // Will be set by determineIfPassesThreshold
      };

    } catch (error: any) {
      this.logger.error('Failed to parse validation response:', error);
      this.logger.error('Raw response:', response);

      // Return pessimistic fallback score
      return {
        overallScore: 0,
        facialConsistency: 0,
        bodyProportionConsistency: 0,
        clothingConsistency: 0,
        colorPaletteConsistency: 0,
        artStyleConsistency: 0,
        detailedAnalysis: `Failed to parse validation response: ${error.message}`,
        failureReasons: ['Parse error', error.message],
        passesThreshold: false
      };
    }
  }

  /**
   * Determine if score passes threshold
   */
  private determineIfPassesThreshold(score: ConsistencyScore): boolean {
    return score.overallScore >= VALIDATION_THRESHOLD;
  }

  /**
   * Store validation result in database
   */
  private async storeValidationResult(
    jobId: string,
    panelNumber: number,
    attemptNumber: number,
    score: ConsistencyScore
  ): Promise<void> {
    try {
      if (!this.databaseService) {
        this.logger.warn('DatabaseService not available, skipping validation result storage');
        return;
      }

      await this.databaseService.executeSQL(
        `INSERT INTO panel_validation_results (
          job_id,
          panel_number,
          overall_score,
          facial_consistency,
          body_proportion_consistency,
          clothing_consistency,
          color_palette_consistency,
          art_style_consistency,
          detailed_analysis,
          failure_reasons,
          passes_threshold,
          attempt_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          jobId,
          panelNumber,
          score.overallScore,
          score.facialConsistency,
          score.bodyProportionConsistency,
          score.clothingConsistency,
          score.colorPaletteConsistency,
          score.artStyleConsistency,
          score.detailedAnalysis,
          JSON.stringify(score.failureReasons),
          score.passesThreshold,
          attemptNumber
        ]
      );

      this.logger.log(`💾 Stored validation result for job ${jobId}, panel ${panelNumber}, attempt ${attemptNumber}`);

    } catch (error: any) {
      this.logger.error('Failed to store validation result:', error);
      // Don't throw - storage failure shouldn't block validation
    }
  }

  /**
   * Check if error indicates Vision API unavailability
   */
  private isVisionAPIUnavailable(error: any): boolean {
    if (error instanceof AIServiceUnavailableError) {
      return true;
    }

    if (error.message?.includes('Vision') || error.message?.includes('vision')) {
      return true;
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return true;
    }

    return false;
  }

  /**
   * FIX #13: Check if validation should be skipped based on quality pattern
   * Skip panels 10+ if first 9 panels all passed with 90+ scores
   */
  private shouldSkipValidation(jobId: string, panelNumber: number): boolean {
    if (!this.smartValidationEnabled || panelNumber < 10) {
      return false; // Always validate first 9 panels
    }
    
    const history = this.validationHistory.get(jobId);
    if (!history || history.length < 9) {
      return false; // Not enough history
    }
    
    // Check if first 9 panels all passed with 90+ scores
    const first9Panels = history.slice(0, 9);
    const allHighQuality = first9Panels.every(score => 
      score.passesThreshold && score.overallScore >= 90
    );
    
    if (allHighQuality) {
      const avgScore = first9Panels.reduce((sum, s) => sum + s.overallScore, 0) / 9;
      this.logger.log(`🎯 Quality pattern detected: First 9 panels averaged ${avgScore.toFixed(1)}/100, skipping validation for panel ${panelNumber}`);
      return true;
    }
    
    return false;
  }

  /**
   * FIX #13: Track validation result for smart validation learning
   */
  private trackValidationResult(jobId: string, score: ConsistencyScore): void {
    if (!this.validationHistory.has(jobId)) {
      this.validationHistory.set(jobId, []);
    }
    
    const history = this.validationHistory.get(jobId)!;
    history.push(score);
    
    // Log stats every 5 panels
    if (history.length % 5 === 0) {
      const avgScore = history.reduce((sum, s) => sum + s.overallScore, 0) / history.length;
      const passRate = (history.filter(s => s.passesThreshold).length / history.length) * 100;
      this.logger.log(`📊 Validation stats for job ${jobId}: ${history.length} panels, avg score ${avgScore.toFixed(1)}/100, pass rate ${passRate.toFixed(0)}%`);
    }
  }

  /**
   * FIX #13: Clear validation history for a job (call when job completes)
   */
  public clearValidationHistory(jobId: string): void {
    const history = this.validationHistory.get(jobId);
    if (history) {
      this.logger.log(`🗑️ Clearing validation history for job ${jobId} (${history.length} panels tracked)`);
      this.validationHistory.delete(jobId);
    }
  }

  /**
   * Build enhanced prompt for retry attempts
   */
  public buildEnhancedPrompt(
    originalPrompt: string,
    attemptNumber: number,
    failureReasons: string[]
  ): string {
    if (attemptNumber === 1) {
      return originalPrompt; // First attempt uses original prompt
    }

    const retryHeader = `RETRY ATTEMPT ${attemptNumber}/3 - Previous validation failed: ${failureReasons.join(', ')}

CRITICAL: `;

    // Build emphasis based on failure reasons
    const emphases: string[] = [];

    for (const reason of failureReasons) {
      const lowerReason = reason.toLowerCase();

      if (lowerReason.includes('face') || lowerReason.includes('facial')) {
        emphases.push('FACIAL FEATURES MUST MATCH EXACTLY - eyes, nose, mouth, face shape, hair');
      }
      if (lowerReason.includes('body') || lowerReason.includes('proportion')) {
        emphases.push('BODY PROPORTIONS MUST BE IDENTICAL - height, build, posture');
      }
      if (lowerReason.includes('clothing') || lowerReason.includes('outfit')) {
        emphases.push('CLOTHING MUST BE EXACTLY AS SPECIFIED - every garment detail matters');
      }
      if (lowerReason.includes('color') || lowerReason.includes('palette')) {
        emphases.push('COLOR PALETTE MUST MATCH PRECISELY - all colors exactly as specified');
      }
      if (lowerReason.includes('style') || lowerReason.includes('art')) {
        emphases.push('ART STYLE MUST BE CONSISTENT - line weight, shading, rendering');
      }
    }

    // Ultra-strict mode for final attempt
    if (attemptNumber === 3) {
      return `${retryHeader}FINAL ATTEMPT - MAXIMUM CONSISTENCY ENFORCEMENT
${emphases.join('\n')}

Character DNA enforcement: ABSOLUTE MAXIMUM
Zero tolerance for any deviations.

${originalPrompt}`;
    }

    // Standard retry with specific emphases
    return `${retryHeader}${emphases.join('\n')}

Character DNA enforcement: MAXIMUM

${originalPrompt}`;
  }

  /**
   * Validate with retry logic (called from image generation)
   */
  public async validateWithRetry(
    context: ValidationContext
  ): Promise<ConsistencyScore> {
    const maxAttempts = MAX_RETRY_ATTEMPTS;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const score = await this.validateCharacterConsistency(
        context.generatedImageUrl,
        context.characterDNA,
        {
          jobId: context.jobId,
          panelNumber: context.panelNumber,
          attemptNumber: attempt,
          previousPanelUrl: context.previousPanelUrl
        }
      );

      // If validation passes or Vision API unavailable, return success
      if (score.passesThreshold || score.overallScore === -1) {
        return score;
      }

      // If this is the last attempt, throw validation error
      if (attempt === maxAttempts) {
        throw new ValidationError(
          `Panel ${context.panelNumber} failed validation after ${maxAttempts} attempts (final score: ${score.overallScore}/100)`,
          score,
          {
            jobId: context.jobId,
            panelNumber: context.panelNumber,
            totalAttempts: maxAttempts
          }
        );
      }

      // Log retry
      this.logger.warn(`🔄 Panel ${context.panelNumber} validation failed (attempt ${attempt}/${maxAttempts}), will retry with enhanced prompt`);
    }

    // Should never reach here, but TypeScript needs this
    throw new Error('Unexpected validation flow');
  }
}
