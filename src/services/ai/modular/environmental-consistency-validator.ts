/**
 * ===== ENVIRONMENTAL CONSISTENCY VALIDATOR MODULE =====
 * GPT-4 Vision-based environmental consistency validation system
 *
 * File Location: src/services/ai/modular/environmental-consistency-validator.ts
 *
 * Purpose:
 * Validates that all panels on a comic page exist in the same visual world
 * with consistent environmental elements (location, lighting, color palette, architecture).
 *
 * Features:
 * - GPT-4 Vision API integration for multi-image analysis
 * - Page-by-page batch validation (2-4 panels per page)
 * - Environmental DNA consistency checking
 * - 85% coherence threshold enforcement
 * - Database persistence of validation results
 * - Clear separation: DETECTION ONLY (no regeneration)
 *
 * Responsibility Boundary:
 * ✅ This validator DETECTS failures and throws EnvironmentalValidationError
 * ❌ This validator does NOT regenerate panels
 * ⚠️  Job processor catches errors and handles regeneration
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
 * Detailed environmental consistency report from GPT-4 Vision analysis
 */
export interface EnvironmentalConsistencyReport {
  overallCoherence: number;  // 0-100, must be >= 85 to pass
  panelScores: Array<{
    panelNumber: number;
    locationConsistency: number;  // 0-100
    lightingConsistency: number;  // 0-100
    colorPaletteConsistency: number;  // 0-100
    architecturalStyleConsistency: number;  // 0-100
    atmosphericConsistency: number;  // 0-100
    issues: string[];  // Specific problems detected in this panel
  }>;
  crossPanelConsistency: number;  // How well panels match each other (0-100)
  detailedAnalysis: string;  // Comprehensive explanation from GPT-4 Vision
  passesThreshold: boolean;  // true if overallCoherence >= 85
  failureReasons: string[];  // Specific issues if validation failed
}

/**
 * Environmental DNA specification for world consistency
 * (Imported from main codebase - should match EnvironmentalDNA interface)
 */
export interface EnvironmentalDNA {
  primaryLocation: {
    name: string;
    type: 'indoor' | 'outdoor' | 'mixed';
    description: string;
    keyFeatures: string[];
    colorPalette?: string[];
    architecturalStyle?: string;
  };
  lightingContext: {
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    weatherCondition: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'pleasant';
    lightingMood: string;
    shadowDirection?: string;
  };
  visualContinuity: {
    backgroundElements: string[];
    recurringObjects?: string[];
    colorConsistency: {
      dominantColors: string[];
      accentColors: string[];
    };
  };
  metadata?: {
    createdAt: string;
    processingTime: number;
    audience: string;
    consistencyTarget: string;
  };
}

// ===== CUSTOM ERROR CLASS =====

/**
 * Environmental Validation Error
 *
 * Thrown when environmental coherence falls below 85% threshold
 * Job processor catches this error and handles regeneration
 */
export class EnvironmentalValidationError extends BaseServiceError {
  public readonly type = 'ENVIRONMENTAL_VALIDATION_ERROR';
  public readonly category = ErrorCategory.VALIDATION;
  public readonly retryable = true;  // Retryable via page regeneration
  public readonly severity = ErrorSeverity.HIGH;
  public override readonly name = 'EnvironmentalValidationError';

  public coherenceScore: number;
  public failureReasons: string[];
  public pageNumber: number;

  constructor(
    message: string,
    coherenceScore: number,
    failureReasons: string[],
    pageNumber: number,
    context?: any
  ) {
    super(message, {
      service: 'EnvironmentalConsistencyValidator',
      operation: 'validateEnvironmentalConsistency',
      details: {
        coherenceScore,
        failureReasons,
        pageNumber,
        threshold: 85,
        ...context
      }
    });
    this.coherenceScore = coherenceScore;
    this.failureReasons = failureReasons;
    this.pageNumber = pageNumber;
    Object.setPrototypeOf(this, EnvironmentalValidationError.prototype);
  }
}

// ===== VALIDATION CONSTANTS =====

const ENVIRONMENTAL_COHERENCE_THRESHOLD = 85;  // Minimum score to pass
const VISION_API_TIMEOUT = 180000;  // 180 seconds (3 minutes)

/**
 * GPT-4 Vision prompt template for environmental consistency validation
 * This prompt analyzes multiple panels simultaneously for world consistency
 */
const ENVIRONMENTAL_VALIDATION_PROMPT = `You are a professional comic book art director ensuring visual world consistency.

Analyze these {panelCount} comic panels from page {pageNumber} and verify they all exist in the SAME visual world.

ENVIRONMENTAL DNA SPECIFICATION:
Primary Location: {locationName}
Location Type: {locationType}
Key Features: {keyFeatures}
Lighting: {timeOfDay} - {lightingMood}
Weather: {weatherCondition}
Color Palette: {colorPalette}
Architectural Style: {architecturalStyle}
Background Elements: {backgroundElements}
Recurring Objects: {recurringObjects}

CRITICAL CONSISTENCY CHECKS:
1. Location Recognition (0-100): Does each panel clearly show {locationName}?
   - Are key features visible and consistent?
   - Does the space feel like the same location?

2. Lighting Consistency (0-100): Same direction and mood across all panels?
   - Is it consistently {timeOfDay}?
   - Is lighting mood {lightingMood} throughout?
   - Are shadows consistent?

3. Color Palette (0-100): Same environmental colors throughout?
   - Dominant colors: {dominantColors}
   - Accent colors: {accentColors}
   - Are colors consistent across panels?

4. Architectural Style (0-100): All structures match specified style?
   - Is {architecturalStyle} style maintained?
   - Are building/structure details consistent?

5. Atmospheric Consistency (0-100): Environmental mood consistent?
   - Weather condition: {weatherCondition}
   - Atmospheric effects consistent?

6. Cross-Panel Consistency (0-100): How well do panels match EACH OTHER?
   - Do panels feel like they're from the same world?
   - Are transitions believable?

SCORING GUIDELINES:
- 95-100: Perfect consistency, publication-ready
- 85-94: Good consistency, minor variations acceptable
- 70-84: Noticeable inconsistencies, regeneration recommended
- Below 70: Significant inconsistencies, regeneration required

BE STRICT: Panels must feel like they exist in the same visual world.
FAIL if overall coherence < 85.

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "overallCoherence": number (0-100),
  "panelScores": [
    {
      "panelNumber": number,
      "locationConsistency": number (0-100),
      "lightingConsistency": number (0-100),
      "colorPaletteConsistency": number (0-100),
      "architecturalStyleConsistency": number (0-100),
      "atmosphericConsistency": number (0-100),
      "issues": ["specific issue 1", "specific issue 2"]
    }
  ],
  "crossPanelConsistency": number (0-100),
  "detailedAnalysis": "comprehensive explanation of consistency assessment",
  "passesThreshold": boolean,
  "failureReasons": ["reason 1", "reason 2"] (only if failed)
}`;

// ===== MAIN VALIDATOR CLASS =====

/**
 * Environmental Consistency Validator
 *
 * Validates environmental consistency across comic book page panels
 * Uses GPT-4 Vision to analyze multiple images in a single batch
 */
export class EnvironmentalConsistencyValidator {
  private openaiIntegration: OpenAIIntegration;
  private databaseService: any;  // Will be injected
  private errorHandler: any;
  private logger: any;

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
   * Validate environmental consistency for a page
   *
   * This is the main entry point for validation
   *
   * @param panelImageUrls - Array of panel URLs from one page (2-4 panels typically)
   * @param environmentalDNA - Environmental DNA specification
   * @param pageNumber - Page number being validated
   * @param attemptNumber - Regeneration attempt number (1 or 2)
   * @returns EnvironmentalConsistencyReport
   * @throws EnvironmentalValidationError if coherence < 85%
   * @throws AIServiceUnavailableError if Vision API is down (graceful degradation)
   */
  public async validateEnvironmentalConsistency(
    panelImageUrls: string[],
    environmentalDNA: EnvironmentalDNA,
    pageNumber: number,
    attemptNumber: number = 1
  ): Promise<EnvironmentalConsistencyReport> {
    this.logger.log(`🌍 Validating environmental consistency: Page ${pageNumber} (${panelImageUrls.length} panels, attempt ${attemptNumber}/2)`);

    try {
      // Call GPT-4 Vision API for batch validation
      const report = await this.performVisionValidation(
        panelImageUrls,
        environmentalDNA,
        pageNumber
      );

      // Log validation results
      if (report.passesThreshold) {
        this.logger.log(
          `✅ Environmental coherence: ${report.overallCoherence.toFixed(1)}% - PASSED ` +
          `(location: ${report.panelScores[0]?.locationConsistency || 0}%, ` +
          `lighting: ${report.panelScores[0]?.lightingConsistency || 0}%, ` +
          `palette: ${report.panelScores[0]?.colorPaletteConsistency || 0}%)`
        );
      } else {
        this.logger.error(
          `❌ Environmental coherence: ${report.overallCoherence.toFixed(1)}% - FAILED (threshold: 85%)`
        );
        this.logger.error(`  Failure reasons: ${report.failureReasons.join(', ')}`);
      }

      // If validation fails, throw error for job processor to catch
      if (!report.passesThreshold) {
        throw new EnvironmentalValidationError(
          `Page ${pageNumber} failed environmental consistency validation (coherence: ${report.overallCoherence.toFixed(1)}%, required: 85%)`,
          report.overallCoherence,
          report.failureReasons,
          pageNumber,
          {
            attemptNumber,
            panelCount: panelImageUrls.length,
            locationName: environmentalDNA.primaryLocation.name
          }
        );
      }

      return report;

    } catch (error: any) {
      // Re-throw EnvironmentalValidationError (validation failure)
      if (error instanceof EnvironmentalValidationError) {
        throw error;
      }

      // Graceful degradation: Vision API unavailable (API error, not validation failure)
      if (this.isVisionAPIUnavailable(error)) {
        this.logger.warn(`⚠️ GPT-4 Vision API unavailable for page ${pageNumber}, marking as unvalidated`);

        // Return a passing report to allow job to continue
        const fallbackReport: EnvironmentalConsistencyReport = {
          overallCoherence: -1,  // Special marker for unvalidated
          panelScores: panelImageUrls.map((_, index) => ({
            panelNumber: index + 1,
            locationConsistency: -1,
            lightingConsistency: -1,
            colorPaletteConsistency: -1,
            architecturalStyleConsistency: -1,
            atmosphericConsistency: -1,
            issues: ['Validation skipped - Vision API unavailable']
          })),
          crossPanelConsistency: -1,
          detailedAnalysis: 'Validation skipped - GPT-4 Vision API unavailable',
          passesThreshold: true,  // Don't block job due to API issues
          failureReasons: ['Vision API unavailable']
        };

        return fallbackReport;
      }

      // Other errors should bubble up
      throw error;
    }
  }

  /**
   * Perform validation using GPT-4 Vision API
   * Analyzes multiple panel images in a single API call
   */
  private async performVisionValidation(
    panelImageUrls: string[],
    environmentalDNA: EnvironmentalDNA,
    pageNumber: number
  ): Promise<EnvironmentalConsistencyReport> {
    // Build validation prompt with environmental DNA
    const prompt = this.buildValidationPrompt(environmentalDNA, pageNumber, panelImageUrls.length);

    // Call GPT-4 Vision with multiple images
    const response = await this.callGPT4VisionBatch(panelImageUrls, prompt);

    // Parse response into structured report
    const report = this.parseValidationResponse(response, panelImageUrls.length);

    // Determine if passes threshold
    report.passesThreshold = report.overallCoherence >= ENVIRONMENTAL_COHERENCE_THRESHOLD;

    // Generate failure reasons if validation failed
    if (!report.passesThreshold) {
      report.failureReasons = this.generateFailureReasons(report, environmentalDNA);
    }

    return report;
  }

  /**
   * Call GPT-4 Vision API with multiple panel images
   * Uses same format as character validator for consistency
   */
  private async callGPT4VisionBatch(
    imageUrls: string[],
    validationPrompt: string
  ): Promise<string> {
    try {
      // Build messages array with text prompt and multiple images
      const content: any[] = [
        { type: 'text', text: validationPrompt }
      ];

      // Add all panel images
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
            max_tokens: 1800,
            temperature: 0.3
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          if (response.status === 429) {
            throw new AIRateLimitError('GPT-4 Vision rate limit exceeded', {
              service: 'EnvironmentalConsistencyValidator',
              operation: 'callGPT4VisionBatch',
              details: { httpStatus: response.status, attempt }
            });
          }

          throw new AIServiceUnavailableError(
            `Vision API error: ${errorData.error?.message || response.statusText}`,
            {
              service: 'EnvironmentalConsistencyValidator',
              operation: 'callGPT4VisionBatch',
              details: { httpStatus: response.status, attempt }
            }
          );
        }

        const data = await response.json();

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          throw new AIServiceUnavailableError('Invalid response from Vision API', {
            service: 'EnvironmentalConsistencyValidator',
            operation: 'callGPT4VisionBatch'
          });
        }

        return data.choices[0].message.content;

      } catch (error: any) {
        lastError = error;

        if (error.name === 'AbortError') {
          throw new AITimeoutError(`Vision API request timed out after ${VISION_API_TIMEOUT}ms`, {
            service: 'EnvironmentalConsistencyValidator',
            operation: 'callGPT4VisionBatch'
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
   * Build validation prompt from environmental DNA
   */
  private buildValidationPrompt(
    environmentalDNA: EnvironmentalDNA,
    pageNumber: number,
    panelCount: number
  ): string {
    let prompt = ENVIRONMENTAL_VALIDATION_PROMPT;

    // Replace panel count and page number
    prompt = prompt.replace('{panelCount}', panelCount.toString());
    prompt = prompt.replace('{pageNumber}', pageNumber.toString());

    // Replace location information
    prompt = prompt.replace(/\{locationName\}/g, environmentalDNA.primaryLocation.name);
    prompt = prompt.replace('{locationType}', environmentalDNA.primaryLocation.type);
    prompt = prompt.replace('{keyFeatures}', environmentalDNA.primaryLocation.keyFeatures.join(', '));

    // Replace lighting information
    prompt = prompt.replace(/\{timeOfDay\}/g, environmentalDNA.lightingContext.timeOfDay);
    prompt = prompt.replace(/\{lightingMood\}/g, environmentalDNA.lightingContext.lightingMood);
    prompt = prompt.replace(/\{weatherCondition\}/g, environmentalDNA.lightingContext.weatherCondition);

    // Replace color palette information
    const colorPalette = environmentalDNA.primaryLocation.colorPalette?.join(', ') || 'not specified';
    prompt = prompt.replace('{colorPalette}', colorPalette);

    const dominantColors = environmentalDNA.visualContinuity.colorConsistency.dominantColors.join(', ');
    const accentColors = environmentalDNA.visualContinuity.colorConsistency.accentColors.join(', ');
    prompt = prompt.replace('{dominantColors}', dominantColors);
    prompt = prompt.replace('{accentColors}', accentColors);

    // Replace architectural style
    const architecturalStyle = environmentalDNA.primaryLocation.architecturalStyle || 'standard';
    prompt = prompt.replace(/\{architecturalStyle\}/g, architecturalStyle);

    // Replace background elements
    const backgroundElements = environmentalDNA.visualContinuity.backgroundElements.join(', ');
    prompt = prompt.replace('{backgroundElements}', backgroundElements);

    // Replace recurring objects
    const recurringObjects = environmentalDNA.visualContinuity.recurringObjects?.join(', ') || 'none specified';
    prompt = prompt.replace('{recurringObjects}', recurringObjects);

    return prompt;
  }

  /**
   * Parse validation response from GPT-4 Vision
   */
  private parseValidationResponse(
    response: string,
    expectedPanelCount: number
  ): EnvironmentalConsistencyReport {
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
        'overallCoherence',
        'panelScores',
        'crossPanelConsistency',
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

      // Validate panelScores is an array
      if (!Array.isArray(parsed.panelScores)) {
        throw new Error('panelScores must be an array');
      }

      // Calculate overall coherence if not present or invalid
      if (typeof parsed.overallCoherence !== 'number' || parsed.overallCoherence < 0 || parsed.overallCoherence > 100) {
        // Average all component scores
        let totalScore = 0;
        let scoreCount = 0;

        for (const panelScore of parsed.panelScores) {
          totalScore += panelScore.locationConsistency || 0;
          totalScore += panelScore.lightingConsistency || 0;
          totalScore += panelScore.colorPaletteConsistency || 0;
          totalScore += panelScore.architecturalStyleConsistency || 0;
          totalScore += panelScore.atmosphericConsistency || 0;
          scoreCount += 5;
        }

        if (scoreCount > 0) {
          parsed.overallCoherence = Math.round(totalScore / scoreCount);
        } else {
          parsed.overallCoherence = 0;
        }
      }

      return {
        overallCoherence: parsed.overallCoherence,
        panelScores: parsed.panelScores,
        crossPanelConsistency: parsed.crossPanelConsistency,
        detailedAnalysis: parsed.detailedAnalysis,
        passesThreshold: false,  // Will be set by caller
        failureReasons: parsed.failureReasons || []
      };

    } catch (error: any) {
      this.logger.error('Failed to parse validation response:', error);
      this.logger.error('Raw response:', response);

      // Return pessimistic fallback report
      const fallbackPanelScores = Array.from({ length: expectedPanelCount }, (_, i) => ({
        panelNumber: i + 1,
        locationConsistency: 0,
        lightingConsistency: 0,
        colorPaletteConsistency: 0,
        architecturalStyleConsistency: 0,
        atmosphericConsistency: 0,
        issues: ['Failed to parse validation response']
      }));

      return {
        overallCoherence: 0,
        panelScores: fallbackPanelScores,
        crossPanelConsistency: 0,
        detailedAnalysis: `Failed to parse validation response: ${error.message}`,
        passesThreshold: false,
        failureReasons: ['Parse error', error.message]
      };
    }
  }

  /**
   * Generate specific failure reasons from validation report
   * These reasons help job processor enhance prompts during regeneration
   */
  private generateFailureReasons(
    report: EnvironmentalConsistencyReport,
    environmentalDNA: EnvironmentalDNA
  ): string[] {
    const reasons: string[] = [];

    // Analyze panel scores to identify weakest areas
    const avgScores = {
      location: 0,
      lighting: 0,
      colorPalette: 0,
      architectural: 0,
      atmospheric: 0
    };

    for (const panel of report.panelScores) {
      avgScores.location += panel.locationConsistency;
      avgScores.lighting += panel.lightingConsistency;
      avgScores.colorPalette += panel.colorPaletteConsistency;
      avgScores.architectural += panel.architecturalStyleConsistency;
      avgScores.atmospheric += panel.atmosphericConsistency;
    }

    const panelCount = report.panelScores.length;
    for (const key in avgScores) {
      avgScores[key as keyof typeof avgScores] /= panelCount;
    }

    // Generate specific failure reasons based on scores
    if (avgScores.location < 85) {
      reasons.push(
        `Location inconsistent: Panels don't clearly show "${environmentalDNA.primaryLocation.name}" (score: ${avgScores.location.toFixed(1)}%)`
      );
    }

    if (avgScores.lighting < 85) {
      reasons.push(
        `Lighting inconsistent: ${environmentalDNA.lightingContext.timeOfDay} lighting with ${environmentalDNA.lightingContext.lightingMood} mood not maintained (score: ${avgScores.lighting.toFixed(1)}%)`
      );
    }

    if (avgScores.colorPalette < 85) {
      reasons.push(
        `Color palette inconsistent: Colors don't match environmental palette (score: ${avgScores.colorPalette.toFixed(1)}%)`
      );
    }

    if (avgScores.architectural < 85) {
      const style = environmentalDNA.primaryLocation.architecturalStyle || 'specified';
      reasons.push(
        `Architectural style inconsistent: ${style} style not maintained (score: ${avgScores.architectural.toFixed(1)}%)`
      );
    }

    if (avgScores.atmospheric < 85) {
      reasons.push(
        `Atmospheric inconsistent: ${environmentalDNA.lightingContext.weatherCondition} atmosphere not consistent (score: ${avgScores.atmospheric.toFixed(1)}%)`
      );
    }

    if (report.crossPanelConsistency < 85) {
      reasons.push(
        `Cross-panel inconsistency: Panels don't feel like they're from the same world (score: ${report.crossPanelConsistency.toFixed(1)}%)`
      );
    }

    // Add panel-specific issues
    for (const panel of report.panelScores) {
      if (panel.issues && panel.issues.length > 0) {
        for (const issue of panel.issues) {
          if (issue && issue.trim().length > 0) {
            reasons.push(`Panel ${panel.panelNumber}: ${issue}`);
          }
        }
      }
    }

    return reasons.length > 0 ? reasons : ['Overall coherence below 85% threshold'];
  }

  /**
   * Check if error indicates Vision API unavailability (not validation failure)
   */
  private isVisionAPIUnavailable(error: any): boolean {
    if (error instanceof AIServiceUnavailableError) {
      return true;
    }

    if (error instanceof AITimeoutError) {
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
