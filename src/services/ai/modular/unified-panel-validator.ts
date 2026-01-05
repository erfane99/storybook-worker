/**
 * ===== UNIFIED PANEL VALIDATOR MODULE =====
 * P2 Cost Optimization: Consolidates 3 separate Vision API validators into 1 unified batch call
 *
 * File Location: src/services/ai/modular/unified-panel-validator.ts
 *
 * This module replaces:
 * - visual-consistency-validator.ts (Character consistency per panel)
 * - environmental-consistency-validator.ts (Environment consistency per page)
 * - sequential-consistency-validator.ts (Panel-to-panel consistency)
 *
 * Benefits:
 * - Reduces 15-20 Vision API calls per 12-panel comic to 3-4 calls (one per page)
 * - ~70% reduction in Vision API costs for validation
 * - Same quality thresholds and criteria maintained
 * - Single unified report with all dimension scores
 *
 * Features:
 * - Single GPT-4 Vision call validates ALL dimensions at once
 * - 70% threshold logic preserved from individual validators
 * - Database persistence compatible with existing tables
 * - Graceful degradation when Vision API unavailable
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

/**
 * Unified validation report combining all three validation dimensions
 */
export interface UnifiedValidationReport {
  // Character consistency (from visual-consistency-validator)
  characterConsistency: {
    overallScore: number;
    facialConsistency: number;
    bodyProportionConsistency: number;
    clothingConsistency: number;
    colorPaletteConsistency: number;
    artStyleConsistency: number;
  };
  // Environmental consistency (from environmental-consistency-validator)
  environmentalConsistency: {
    overallCoherence: number;
    locationConsistency: number;
    lightingConsistency: number;
    colorPaletteConsistency: number;
    architecturalStyleConsistency: number;
    atmosphericConsistency: number;
  };
  // Sequential consistency (per panel pair)
  sequentialConsistency: {
    averageScore: number;
    panelPairScores: Array<{
      panels: [number, number];
      score: number;
      characterContinuity: number;
      environmentalContinuity: number;
    }>;
  };
  // Combined results
  passesAllThresholds: boolean;
  failureReasons: string[];
  detailedAnalysis: string;
  validationTimestamp: string;
  panelCount: number;
  pageNumber: number;
}

/**
 * Character DNA specification for validation
 */
export interface CharacterDNASpec {
  sourceImage?: string;
  cartoonImage?: string;
  description: string;
  artStyle: string;
  visualFingerprint?: {
    face: string;
    body: string;
    clothing: string;
    signature: string;
    colorDNA: string;
    artStyleSignature: string;
  };
}

/**
 * Environmental DNA specification for validation
 */
export interface EnvironmentalDNASpec {
  primaryLocation: {
    name: string;
    type: 'indoor' | 'outdoor' | 'mixed';
    keyFeatures: string[];
  };
  lightingContext: {
    timeOfDay: string;
    lightingMood: string;
    weatherCondition: string;
  };
  visualContinuity: {
    backgroundElements: string[];
    colorConsistency: {
      dominantColors: string[];
      accentColors: string[];
    };
  };
}

/**
 * Context for unified validation
 */
export interface UnifiedValidationContext {
  jobId: string;
  pageNumber: number;
  panelImageUrls: string[];
  characterReferenceImage?: string;
  characterDNA?: CharacterDNASpec;
  environmentalDNA?: EnvironmentalDNASpec;
}

// ===== CUSTOM ERROR CLASS =====

export class UnifiedValidationError extends BaseServiceError {
  public readonly type = 'UNIFIED_VALIDATION_ERROR';
  public readonly category = ErrorCategory.VALIDATION;
  public readonly retryable = true;
  public readonly severity = ErrorSeverity.HIGH;
  public override readonly name = 'UnifiedValidationError';

  public validationReport: UnifiedValidationReport;
  public pageNumber: number;

  constructor(message: string, report: UnifiedValidationReport, pageNumber: number, context?: any) {
    super(message, {
      service: 'UnifiedPanelValidator',
      operation: 'validatePage',
      details: {
        pageNumber,
        characterScore: report.characterConsistency.overallScore,
        environmentalScore: report.environmentalConsistency.overallCoherence,
        sequentialScore: report.sequentialConsistency.averageScore,
        failureReasons: report.failureReasons,
        ...context
      }
    });
    this.validationReport = report;
    this.pageNumber = pageNumber;
    Object.setPrototypeOf(this, UnifiedValidationError.prototype);
  }
}

// ===== VALIDATION CONSTANTS =====

const VALIDATION_THRESHOLD = 70; // Same threshold as individual validators
const VISION_API_TIMEOUT = 180000; // 180 seconds

/**
 * Unified validation prompt that checks ALL dimensions in a single Vision API call
 */
const UNIFIED_VALIDATION_PROMPT = `You are a professional comic book quality control expert. Analyze ALL provided panel images from page {pageNumber} in a SINGLE comprehensive evaluation.

{characterReference}

ENVIRONMENTAL DNA:
- Location: {locationName} ({locationType})
- Key Features: {keyFeatures}
- Time of Day: {timeOfDay}
- Lighting Mood: {lightingMood}
- Weather: {weatherCondition}
- Dominant Colors: {dominantColors}
- Background Elements: {backgroundElements}

TASK: Perform THREE types of validation in ONE analysis:

═══ 1. CHARACTER CONSISTENCY (per panel) ═══
For each panel, verify the character matches the reference:
- Facial features match exactly?
- Body proportions consistent?
- Clothing identical?
- Color palette correct?
- Art style consistent?

═══ 2. ENVIRONMENTAL CONSISTENCY (across page) ═══
Verify all panels exist in the same visual world:
- Location recognizable as {locationName}?
- Lighting direction/mood consistent?
- Color palette matches environmental DNA?
- Architectural elements consistent?
- Atmospheric conditions match?

═══ 3. SEQUENTIAL CONSISTENCY (panel-to-panel) ═══
For each consecutive panel pair, verify visual continuity:
- Character appears identical between panels?
- Environment elements carry over correctly?
- Only pose/expression should change, not identity

SCORING (0-100):
- 90-100: Publication-ready quality
- 70-89: Acceptable quality (PASSES)
- 50-69: Noticeable issues, may need improvement
- Below 50: Significant problems, regeneration required

THRESHOLD: Score >= 70 to pass

Return ONLY valid JSON (no markdown, no code blocks):
{
  "characterConsistency": {
    "overallScore": number,
    "facialConsistency": number,
    "bodyProportionConsistency": number,
    "clothingConsistency": number,
    "colorPaletteConsistency": number,
    "artStyleConsistency": number
  },
  "environmentalConsistency": {
    "overallCoherence": number,
    "locationConsistency": number,
    "lightingConsistency": number,
    "colorPaletteConsistency": number,
    "architecturalStyleConsistency": number,
    "atmosphericConsistency": number
  },
  "sequentialConsistency": {
    "averageScore": number,
    "panelPairScores": [
      {"panels": [1, 2], "score": number, "characterContinuity": number, "environmentalContinuity": number},
      {"panels": [2, 3], "score": number, "characterContinuity": number, "environmentalContinuity": number}
    ]
  },
  "detailedAnalysis": "comprehensive analysis of all dimensions",
  "failureReasons": ["reason1", "reason2"]
}`;

// ===== MAIN VALIDATOR CLASS =====

export class UnifiedPanelValidator {
  private openaiIntegration: OpenAIIntegration;
  private databaseService: any;
  private logger: any;

  constructor(
    openaiIntegration: OpenAIIntegration,
    databaseService: any,
    logger?: any
  ) {
    this.openaiIntegration = openaiIntegration;
    this.databaseService = databaseService;
    this.logger = logger || console;
  }

  /**
   * Validate an entire page with a SINGLE Vision API call
   * Replaces 3 separate validator calls with 1 unified call
   *
   * @param context - Unified validation context with all panel URLs and DNA specs
   * @returns UnifiedValidationReport with scores for all dimensions
   * @throws UnifiedValidationError if any dimension fails threshold
   */
  public async validatePage(context: UnifiedValidationContext): Promise<UnifiedValidationReport> {
    this.logger.log(`🔍 Unified validation: Page ${context.pageNumber} (${context.panelImageUrls.length} panels) - SINGLE API CALL`);

    // Validate URLs before API call
    const invalidUrls = context.panelImageUrls.filter(url => !this.isValidImageUrl(url));
    if (invalidUrls.length > 0) {
      throw new Error(`Invalid image URLs provided: ${invalidUrls[0]?.substring(0, 100)}`);
    }

    try {
      // Build unified prompt
      const prompt = this.buildUnifiedPrompt(context);

      // Collect all images for the API call
      const allImages: string[] = [];
      
      // Add character reference if available
      if (context.characterReferenceImage) {
        allImages.push(context.characterReferenceImage);
      }
      
      // Add all panel images
      allImages.push(...context.panelImageUrls);

      // Make SINGLE Vision API call
      const response = await this.callGPT4Vision(prompt, allImages);

      // Parse unified response
      const report = this.parseUnifiedResponse(response, context);

      // Check if all thresholds pass
      report.passesAllThresholds = this.checkAllThresholds(report);

      // Store results in database (compatible with existing tables)
      await this.storeValidationResults(context, report);

      // Log results
      this.logValidationResults(context, report);

      // Throw error if validation failed
      if (!report.passesAllThresholds) {
        throw new UnifiedValidationError(
          `Page ${context.pageNumber} failed unified validation`,
          report,
          context.pageNumber,
          { jobId: context.jobId }
        );
      }

      return report;

    } catch (error: any) {
      // Re-throw validation errors
      if (error instanceof UnifiedValidationError) {
        throw error;
      }

      // Handle Vision API unavailability
      if (this.isVisionAPIUnavailable(error)) {
        this.logger.warn(`⚠️ Vision API unavailable for page ${context.pageNumber}, returning fallback`);
        return this.createFallbackReport(context);
      }

      throw error;
    }
  }

  /**
   * Build unified validation prompt from context
   */
  private buildUnifiedPrompt(context: UnifiedValidationContext): string {
    let prompt = UNIFIED_VALIDATION_PROMPT;

    // Page number
    prompt = prompt.replace('{pageNumber}', context.pageNumber.toString());

    // Character reference
    const charRef = context.characterReferenceImage
      ? `CHARACTER REFERENCE: The FIRST image is the character reference. All subsequent images are comic panels.
Compare each panel against this reference for character consistency.`
      : context.characterDNA?.description || 'No character reference provided';
    prompt = prompt.replace('{characterReference}', charRef);

    // Environmental DNA
    const envDNA = context.environmentalDNA;
    prompt = prompt.replace('{locationName}', envDNA?.primaryLocation?.name || 'story setting');
    prompt = prompt.replace('{locationType}', envDNA?.primaryLocation?.type || 'mixed');
    prompt = prompt.replace('{keyFeatures}', envDNA?.primaryLocation?.keyFeatures?.join(', ') || 'standard setting');
    prompt = prompt.replace('{timeOfDay}', envDNA?.lightingContext?.timeOfDay || 'daytime');
    prompt = prompt.replace('{lightingMood}', envDNA?.lightingContext?.lightingMood || 'natural');
    prompt = prompt.replace('{weatherCondition}', envDNA?.lightingContext?.weatherCondition || 'clear');
    prompt = prompt.replace('{dominantColors}', envDNA?.visualContinuity?.colorConsistency?.dominantColors?.join(', ') || 'natural colors');
    prompt = prompt.replace('{backgroundElements}', envDNA?.visualContinuity?.backgroundElements?.join(', ') || 'standard background');

    return prompt;
  }

  /**
   * Make Vision API call with all images
   */
  private async callGPT4Vision(prompt: string, imageUrls: string[]): Promise<string> {
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Build content array
        const content: any[] = [
          { type: 'text', text: prompt }
        ];

        // Add images with optimization
        this.logger.log(`🔍 Unified validation with ${imageUrls.length} images (optimized 512×512)`);
        for (const imageUrl of imageUrls) {
          const optimizedUrl = this.optimizeImageForValidation(imageUrl);
          content.push({
            type: 'image_url',
            image_url: { url: optimizedUrl }
          });
        }

        const messages = [{
          role: 'user',
          content: content
        }];

        // Make API call
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
            max_tokens: 1500, // Unified response needs slightly more tokens
            temperature: 0.3
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          if (response.status === 429) {
            throw new AIRateLimitError('GPT-4 Vision rate limit exceeded', {
              service: 'UnifiedPanelValidator',
              operation: 'callGPT4Vision',
              details: { httpStatus: response.status }
            });
          }

          throw new AIServiceUnavailableError(
            `Vision API error: ${errorData.error?.message || response.statusText}`,
            {
              service: 'UnifiedPanelValidator',
              operation: 'callGPT4Vision',
              details: { httpStatus: response.status }
            }
          );
        }

        const data = await response.json();

        if (!data.choices?.[0]?.message?.content) {
          throw new AIServiceUnavailableError('Invalid response from Vision API', {
            service: 'UnifiedPanelValidator',
            operation: 'callGPT4Vision'
          });
        }

        return data.choices[0].message.content;

      } catch (error: any) {
        lastError = error;

        if (error.name === 'AbortError') {
          throw new AITimeoutError(`Vision API request timed out`, {
            service: 'UnifiedPanelValidator',
            operation: 'callGPT4Vision'
          });
        }

        if (error instanceof AIRateLimitError || error instanceof AITimeoutError) {
          throw error;
        }

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
   * Parse unified response from GPT-4 Vision
   */
  private parseUnifiedResponse(
    response: string,
    context: UnifiedValidationContext
  ): UnifiedValidationReport {
    try {
      // Clean response
      let jsonStr = response.trim();
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Build report with defaults for missing fields
      return {
        characterConsistency: {
          overallScore: parsed.characterConsistency?.overallScore || 0,
          facialConsistency: parsed.characterConsistency?.facialConsistency || 0,
          bodyProportionConsistency: parsed.characterConsistency?.bodyProportionConsistency || 0,
          clothingConsistency: parsed.characterConsistency?.clothingConsistency || 0,
          colorPaletteConsistency: parsed.characterConsistency?.colorPaletteConsistency || 0,
          artStyleConsistency: parsed.characterConsistency?.artStyleConsistency || 0
        },
        environmentalConsistency: {
          overallCoherence: parsed.environmentalConsistency?.overallCoherence || 0,
          locationConsistency: parsed.environmentalConsistency?.locationConsistency || 0,
          lightingConsistency: parsed.environmentalConsistency?.lightingConsistency || 0,
          colorPaletteConsistency: parsed.environmentalConsistency?.colorPaletteConsistency || 0,
          architecturalStyleConsistency: parsed.environmentalConsistency?.architecturalStyleConsistency || 0,
          atmosphericConsistency: parsed.environmentalConsistency?.atmosphericConsistency || 0
        },
        sequentialConsistency: {
          averageScore: parsed.sequentialConsistency?.averageScore || 0,
          panelPairScores: parsed.sequentialConsistency?.panelPairScores || []
        },
        passesAllThresholds: false, // Will be set by checkAllThresholds
        failureReasons: Array.isArray(parsed.failureReasons) ? parsed.failureReasons : [],
        detailedAnalysis: parsed.detailedAnalysis || 'No analysis provided',
        validationTimestamp: new Date().toISOString(),
        panelCount: context.panelImageUrls.length,
        pageNumber: context.pageNumber
      };

    } catch (error: any) {
      this.logger.error('Failed to parse unified validation response:', error);
      
      // Return pessimistic fallback
      return {
        characterConsistency: {
          overallScore: 0, facialConsistency: 0, bodyProportionConsistency: 0,
          clothingConsistency: 0, colorPaletteConsistency: 0, artStyleConsistency: 0
        },
        environmentalConsistency: {
          overallCoherence: 0, locationConsistency: 0, lightingConsistency: 0,
          colorPaletteConsistency: 0, architecturalStyleConsistency: 0, atmosphericConsistency: 0
        },
        sequentialConsistency: { averageScore: 0, panelPairScores: [] },
        passesAllThresholds: false,
        failureReasons: ['Parse error: ' + error.message],
        detailedAnalysis: 'Failed to parse validation response',
        validationTimestamp: new Date().toISOString(),
        panelCount: context.panelImageUrls.length,
        pageNumber: context.pageNumber
      };
    }
  }

  /**
   * Check if all validation thresholds pass
   */
  private checkAllThresholds(report: UnifiedValidationReport): boolean {
    const characterPasses = report.characterConsistency.overallScore >= VALIDATION_THRESHOLD;
    const environmentalPasses = report.environmentalConsistency.overallCoherence >= VALIDATION_THRESHOLD;
    const sequentialPasses = report.sequentialConsistency.averageScore >= VALIDATION_THRESHOLD ||
      report.sequentialConsistency.panelPairScores.length === 0; // Single panel pages pass

    // Add failure reasons
    if (!characterPasses) {
      report.failureReasons.push(
        `Character consistency (${report.characterConsistency.overallScore}%) below threshold (${VALIDATION_THRESHOLD}%)`
      );
    }
    if (!environmentalPasses) {
      report.failureReasons.push(
        `Environmental coherence (${report.environmentalConsistency.overallCoherence}%) below threshold (${VALIDATION_THRESHOLD}%)`
      );
    }
    if (!sequentialPasses) {
      report.failureReasons.push(
        `Sequential consistency (${report.sequentialConsistency.averageScore}%) below threshold (${VALIDATION_THRESHOLD}%)`
      );
    }

    return characterPasses && environmentalPasses && sequentialPasses;
  }

  /**
   * Store validation results in database (compatible with existing tables)
   */
  private async storeValidationResults(
    context: UnifiedValidationContext,
    report: UnifiedValidationReport
  ): Promise<void> {
    try {
      if (!this.databaseService) {
        return;
      }

      // Store character validation results (for each panel)
      for (let i = 0; i < context.panelImageUrls.length; i++) {
        await this.databaseService.savePanelValidationResult({
          jobId: context.jobId,
          panelNumber: (context.pageNumber - 1) * context.panelImageUrls.length + i + 1,
          overallScore: report.characterConsistency.overallScore,
          facialConsistency: report.characterConsistency.facialConsistency,
          bodyProportionConsistency: report.characterConsistency.bodyProportionConsistency,
          clothingConsistency: report.characterConsistency.clothingConsistency,
          colorPaletteConsistency: report.characterConsistency.colorPaletteConsistency,
          artStyleConsistency: report.characterConsistency.artStyleConsistency,
          detailedAnalysis: report.detailedAnalysis,
          failureReasons: report.failureReasons,
          passesThreshold: report.passesAllThresholds,
          attemptNumber: 1,
          unifiedValidation: true
        });
      }

      // Store environmental validation results
      await this.databaseService.saveEnvironmentalValidationResult({
        jobId: context.jobId,
        pageNumber: context.pageNumber,
        overallCoherence: report.environmentalConsistency.overallCoherence,
        locationConsistency: report.environmentalConsistency.locationConsistency,
        lightingConsistency: report.environmentalConsistency.lightingConsistency,
        colorPaletteConsistency: report.environmentalConsistency.colorPaletteConsistency,
        architecturalConsistency: report.environmentalConsistency.architecturalStyleConsistency,
        crossPanelConsistency: report.sequentialConsistency.averageScore,
        panelScores: [],
        detailedAnalysis: report.detailedAnalysis,
        failureReasons: report.failureReasons,
        passesThreshold: report.passesAllThresholds,
        attemptNumber: 1,
        regenerationTriggered: !report.passesAllThresholds,
        unifiedValidation: true
      });

      this.logger.log(`💾 Stored unified validation results for page ${context.pageNumber}`);

    } catch (error: any) {
      this.logger.error('Failed to store validation results:', error);
      // Don't throw - storage failure shouldn't block validation
    }
  }

  /**
   * Create fallback report when Vision API is unavailable
   */
  private createFallbackReport(context: UnifiedValidationContext): UnifiedValidationReport {
    return {
      characterConsistency: {
        overallScore: -1, facialConsistency: -1, bodyProportionConsistency: -1,
        clothingConsistency: -1, colorPaletteConsistency: -1, artStyleConsistency: -1
      },
      environmentalConsistency: {
        overallCoherence: -1, locationConsistency: -1, lightingConsistency: -1,
        colorPaletteConsistency: -1, architecturalStyleConsistency: -1, atmosphericConsistency: -1
      },
      sequentialConsistency: { averageScore: -1, panelPairScores: [] },
      passesAllThresholds: true, // Don't block on API unavailability
      failureReasons: ['Vision API unavailable'],
      detailedAnalysis: 'Validation skipped - Vision API unavailable',
      validationTimestamp: new Date().toISOString(),
      panelCount: context.panelImageUrls.length,
      pageNumber: context.pageNumber
    };
  }

  /**
   * Log validation results
   */
  private logValidationResults(context: UnifiedValidationContext, report: UnifiedValidationReport): void {
    if (report.passesAllThresholds) {
      this.logger.log(
        `✅ Page ${context.pageNumber} PASSED unified validation:\n` +
        `   Character: ${report.characterConsistency.overallScore}%\n` +
        `   Environmental: ${report.environmentalConsistency.overallCoherence}%\n` +
        `   Sequential: ${report.sequentialConsistency.averageScore}%`
      );
    } else {
      this.logger.error(
        `❌ Page ${context.pageNumber} FAILED unified validation:\n` +
        `   Character: ${report.characterConsistency.overallScore}%\n` +
        `   Environmental: ${report.environmentalConsistency.overallCoherence}%\n` +
        `   Sequential: ${report.sequentialConsistency.averageScore}%\n` +
        `   Reasons: ${report.failureReasons.join('; ')}`
      );
    }
  }

  /**
   * Optimize image URL for validation (reduces API costs)
   */
  private optimizeImageForValidation(imageUrl: string): string {
    if (!imageUrl || !imageUrl.includes('cloudinary.com/')) {
      return imageUrl;
    }
    
    if (imageUrl.includes('w_512') || imageUrl.includes('q_auto:low')) {
      return imageUrl;
    }
    
    const hasExistingTransforms = /\/upload\/[a-z_]+/.test(imageUrl);
    
    if (hasExistingTransforms) {
      return imageUrl.replace(
        /\/upload\/[^\/]+\//,
        '/upload/w_512,h_512,c_fill,q_auto:low/'
      );
    } else {
      return imageUrl.replace('/upload/', '/upload/w_512,h_512,c_fill,q_auto:low/');
    }
  }

  /**
   * Validate URL is a valid Cloudinary image
   */
  private isValidImageUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    const validPatterns = [
      /^https:\/\/res\.cloudinary\.com\/.+\.(jpg|jpeg|png|webp)/i,
      /^https:\/\/res\.cloudinary\.com\/.+\/image\/upload\//i
    ];
    
    return validPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Check if error indicates Vision API unavailability
   */
  private isVisionAPIUnavailable(error: any): boolean {
    if (error instanceof AIServiceUnavailableError || error instanceof AITimeoutError) {
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
}

