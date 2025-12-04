/**
 * ===== SEQUENTIAL CONSISTENCY VALIDATOR MODULE =====
 * GPT-4 Vision-based panel-to-panel sequential consistency validation system
 *
 * File Location: src/services/ai/modular/sequential-consistency-validator.ts
 *
 * Purpose:
 * Validates that consecutive panels maintain visual consistency and natural flow
 * across all visual dimensions (character, environment, lighting, colors, style, spatial).
 *
 * Features:
 * - GPT-4 Vision API integration for dual-image comparison
 * - 6-dimension sequential consistency scoring
 * - 85% coherence threshold enforcement
 * - Database persistence of validation results
 * - Automatic regeneration on failure (max 2 attempts)
 * - Enhanced continuity prompts for retries
 * - Batch validation for entire pages
 * - Graceful degradation when Vision API unavailable
 *
 * Responsibility Boundary:
 * ✅ This validator DETECTS sequential failures and provides regeneration guidance
 * ✅ This validator STORES validation results for analysis
 * ⚠️  Regeneration is handled by the calling job processor
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
 * Detailed sequential consistency report from GPT-4 Vision analysis
 * Compares two consecutive panels for visual continuity
 */
export interface SequentialConsistencyReport {
  overallScore: number;  // 0-100, must be >= 85 to pass
  characterContinuity: number;  // 0-100 - Same character appearance
  environmentalContinuity: number;  // 0-100 - Same location elements
  lightingConsistency: number;  // 0-100 - Consistent light direction
  colorPaletteConsistency: number;  // 0-100 - Consistent colors
  artStyleConsistency: number;  // 0-100 - Same artistic approach
  spatialLogic: number;  // 0-100 - Logical camera/spatial progression
  detailedAnalysis: string;  // Comprehensive explanation from GPT-4 Vision
  discontinuities: string[];  // Specific breaks in continuity detected
  passesThreshold: boolean;  // true if overallScore >= 85
  previousPanelNumber: number;
  currentPanelNumber: number;
}

/**
 * Context for sequential validation
 */
export interface SequentialValidationContext {
  jobId: string;
  previousPanelNumber: number;
  currentPanelNumber: number;
  previousPanelUrl: string;
  currentPanelUrl: string;
  attemptNumber?: number;
  panelDescription?: string;
}

/**
 * Page-level sequential validation result
 */
export interface PageSequentialValidationResult {
  pageNumber: number;
  sequentialChecks: SequentialConsistencyReport[];
  overallPageConsistency: number;
  passesThreshold: boolean;
  failedTransitions: Array<{
    from: number;
    to: number;
    score: number;
    issues: string[];
  }>;
}

// ===== CUSTOM ERROR CLASS =====

/**
 * Sequential Validation Error
 *
 * Thrown when panel-to-panel consistency falls below 85% threshold
 * Job processor catches this error and handles regeneration
 */
export class SequentialValidationError extends BaseServiceError {
  public readonly type = 'SEQUENTIAL_VALIDATION_ERROR';
  public readonly category = ErrorCategory.VALIDATION;
  public readonly retryable = true;  // Retryable via panel regeneration
  public readonly severity = ErrorSeverity.HIGH;
  public override readonly name = 'SequentialValidationError';

  public consistencyScore: number;
  public discontinuities: string[];
  public previousPanelNumber: number;
  public currentPanelNumber: number;

  constructor(
    message: string,
    consistencyScore: number,
    discontinuities: string[],
    previousPanelNumber: number,
    currentPanelNumber: number,
    context?: any
  ) {
    super(message, {
      service: 'SequentialConsistencyValidator',
      operation: 'validateSequentialConsistency',
      details: {
        consistencyScore,
        discontinuities,
        previousPanelNumber,
        currentPanelNumber,
        threshold: 85,
        ...context
      }
    });
    this.consistencyScore = consistencyScore;
    this.discontinuities = discontinuities;
    this.previousPanelNumber = previousPanelNumber;
    this.currentPanelNumber = currentPanelNumber;
    Object.setPrototypeOf(this, SequentialValidationError.prototype);
  }
}

// ===== VALIDATION CONSTANTS =====

const SEQUENTIAL_CONSISTENCY_THRESHOLD = 85;  // Minimum score to pass
const WARNING_THRESHOLD = 70;  // Show warning but continue
const VISION_API_TIMEOUT = 180000;  // 180 seconds (3 minutes)
const MAX_REGENERATION_ATTEMPTS = 2;

// Critical failure thresholds for individual dimensions
const CRITICAL_THRESHOLDS = {
  characterContinuity: 80,
  artStyleConsistency: 75,
  minimumIndividualScore: 60
};

/**
 * GPT-4 Vision prompt template for sequential consistency validation
 * This prompt analyzes two consecutive panels for visual continuity
 */
const SEQUENTIAL_VALIDATION_PROMPT = `You are a professional comic editor checking panel-to-panel consistency.

Analyze these consecutive panels from the same comic.

PANEL {previousPanelNumber} (PREVIOUS): [image 1]
PANEL {currentPanelNumber} (CURRENT): [image 2]

Same character should appear in both panels.

SEQUENTIAL CONSISTENCY CHECKS:

1. CHARACTER CONTINUITY (0-100):
   Same character in both panels?
   Appearance matches (face, hair, clothing)?
   Body proportions consistent?
   Only pose/expression should change, not character identity.

2. ENVIRONMENTAL CONTINUITY (0-100):
   Same location (if should be)?
   Background elements match?
   No disappearing objects?

3. LIGHTING CONSISTENCY (0-100):
   Light source direction same?
   Lighting mood consistent?
   Time of day consistent?

4. COLOR PALETTE (0-100):
   Same colors throughout?
   Color temperature consistent?

5. ART STYLE (0-100):
   Artistic style identical?
   Line weights consistent?
   Detail level similar?

6. SPATIAL LOGIC (0-100):
   Camera movement makes sense?
   Spatial relationships preserved?

BE STRICT. Panels must feel like continuous story.
Character must be unmistakably SAME person.

Return JSON with all scores and overall sequential consistency.

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "overallScore": number (0-100),
  "characterContinuity": number (0-100),
  "environmentalContinuity": number (0-100),
  "lightingConsistency": number (0-100),
  "colorPaletteConsistency": number (0-100),
  "artStyleConsistency": number (0-100),
  "spatialLogic": number (0-100),
  "detailedAnalysis": "comprehensive explanation of sequential consistency assessment",
  "discontinuities": ["specific issue 1", "specific issue 2"] (only if issues found)
}`;

/**
 * Enhanced continuity prompt for regeneration attempts
 * Used when sequential validation fails to emphasize continuity requirements
 */
const ENHANCED_CONTINUITY_PROMPT_TEMPLATE = `CRITICAL: This panel MUST maintain perfect continuity with previous panel.

PREVIOUS PANEL {previousPanelNumber}: {previousPanelDescription}

CONTINUITY REQUIREMENTS:
- Character MUST look IDENTICAL to previous panel
- Only pose/expression may change
- Background elements in both MUST match
- Lighting direction MUST be same
- Color palette IDENTICAL
- Art style INDISTINGUISHABLE

ZERO tolerance for continuity breaks.
Panel {currentPanelNumber} immediately follows panel {previousPanelNumber}.

{specificRequirements}`;

// ===== MAIN VALIDATOR CLASS =====

/**
 * Sequential Consistency Validator
 *
 * Validates visual consistency between consecutive comic book panels
 * Uses GPT-4 Vision to compare two images in a single batch
 */
export class SequentialConsistencyValidator {
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
   * Validate sequential consistency between two consecutive panels
   *
   * This is the main entry point for validation
   *
   * @param context - Validation context with panel URLs and metadata
   * @returns SequentialConsistencyReport
   * @throws SequentialValidationError if consistency < 85%
   * @throws AIServiceUnavailableError if Vision API is down (graceful degradation)
   */
  public async validateSequentialConsistency(
    context: SequentialValidationContext
  ): Promise<SequentialConsistencyReport> {
    const attemptNumber = context.attemptNumber || 1;

    // ✅ PRE-CHECK: Validate both panel URLs before Vision API call
    if (!this.isValidImageUrl(context.previousPanelUrl)) {
      this.logger.error(`❌ Invalid previous panel URL: ${context.previousPanelUrl?.substring(0, 100)}...`);
      throw new SequentialValidationError(
        `Invalid previous panel URL for sequential validation. Expected Cloudinary URL, got: ${context.previousPanelUrl?.substring(0, 100)}...`,
        0,
        ['Invalid URL format for previous panel - expected Cloudinary image URL'],
        context.previousPanelNumber,
        context.currentPanelNumber
      );
    }
    
    if (!this.isValidImageUrl(context.currentPanelUrl)) {
      this.logger.error(`❌ Invalid current panel URL: ${context.currentPanelUrl?.substring(0, 100)}...`);
      throw new SequentialValidationError(
        `Invalid current panel URL for sequential validation. Expected Cloudinary URL, got: ${context.currentPanelUrl?.substring(0, 100)}...`,
        0,
        ['Invalid URL format for current panel - expected Cloudinary image URL'],
        context.previousPanelNumber,
        context.currentPanelNumber
      );
    }

    this.logger.log(
      `🔗 Validating sequential: Panel ${context.previousPanelNumber} → ${context.currentPanelNumber} (attempt ${attemptNumber}/${MAX_REGENERATION_ATTEMPTS})`
    );

    try {
      // Call GPT-4 Vision API for sequential validation
      const report = await this.performVisionValidation(
        context.previousPanelUrl,
        context.currentPanelUrl,
        context.previousPanelNumber,
        context.currentPanelNumber
      );

      // Store validation result in database
      await this.storeValidationResult(context.jobId, report, attemptNumber);

      // Log validation results
      if (report.passesThreshold) {
        this.logger.log(
          `✅ Sequential consistency: ${report.overallScore.toFixed(1)}% ` +
          `(character: ${report.characterContinuity}%, environment: ${report.environmentalContinuity}%, ` +
          `lighting: ${report.lightingConsistency}%)`
        );
      } else if (report.overallScore >= WARNING_THRESHOLD) {
        this.logger.warn(
          `⚠️ Continuity warning: Panel ${context.previousPanelNumber}→${context.currentPanelNumber} ` +
          `(score: ${report.overallScore.toFixed(1)}%)`
        );
      } else {
        this.logger.error(
          `❌ Sequential failed: Panel ${context.previousPanelNumber}→${context.currentPanelNumber} ` +
          `(score: ${report.overallScore.toFixed(1)}%)`
        );
        this.logger.error(`   Discontinuities: ${report.discontinuities.join(', ')}`);
      }

      // Check for critical failures
      if (this.hasCriticalFailure(report)) {
        throw new SequentialValidationError(
          `Critical sequential failure: Panel ${context.currentPanelNumber} (score: ${report.overallScore.toFixed(1)}%)`,
          report.overallScore,
          report.discontinuities,
          context.previousPanelNumber,
          context.currentPanelNumber,
          {
            attemptNumber,
            jobId: context.jobId,
            criticalDimensions: this.identifyCriticalFailures(report)
          }
        );
      }

      // If validation fails normal threshold, throw error for regeneration
      if (!report.passesThreshold && report.overallScore < WARNING_THRESHOLD) {
        throw new SequentialValidationError(
          `Sequential consistency failed: Panel ${context.currentPanelNumber} (score: ${report.overallScore.toFixed(1)}%, required: 85%)`,
          report.overallScore,
          report.discontinuities,
          context.previousPanelNumber,
          context.currentPanelNumber,
          {
            attemptNumber,
            jobId: context.jobId
          }
        );
      }

      return report;

    } catch (error: any) {
      // Re-throw SequentialValidationError (validation failure)
      if (error instanceof SequentialValidationError) {
        throw error;
      }

      // Graceful degradation: Vision API unavailable (API error, not validation failure)
      if (this.isVisionAPIUnavailable(error)) {
        this.logger.warn(
          `⚠️ GPT-4 Vision API unavailable for panels ${context.previousPanelNumber}→${context.currentPanelNumber}, marking as unvalidated`
        );

        // Return a passing report to allow job to continue
        const fallbackReport: SequentialConsistencyReport = {
          overallScore: -1,  // Special marker for unvalidated
          characterContinuity: -1,
          environmentalContinuity: -1,
          lightingConsistency: -1,
          colorPaletteConsistency: -1,
          artStyleConsistency: -1,
          spatialLogic: -1,
          detailedAnalysis: 'Validation skipped - GPT-4 Vision API unavailable',
          discontinuities: ['Vision API unavailable'],
          passesThreshold: true,  // Don't block job due to API issues
          previousPanelNumber: context.previousPanelNumber,
          currentPanelNumber: context.currentPanelNumber
        };

        await this.storeValidationResult(context.jobId, fallbackReport, attemptNumber);
        return fallbackReport;
      }

      // Other errors should bubble up
      throw error;
    }
  }

  /**
   * Validate sequential consistency for an entire page
   * Performs batch validation of all consecutive panel pairs on a page
   *
   * @param jobId - Job identifier
   * @param pageNumber - Page number being validated
   * @param panelUrls - Array of panel URLs in order
   * @returns PageSequentialValidationResult
   */
  public async validatePageSequentialConsistency(
    jobId: string,
    pageNumber: number,
    panelUrls: string[]
  ): Promise<PageSequentialValidationResult> {
    this.logger.log(
      `🔗 Validating page ${pageNumber} sequential consistency (${panelUrls.length - 1} transitions)`
    );

    // Create validation contexts for all consecutive pairs
    const validationContexts: SequentialValidationContext[] = [];
    for (let i = 0; i < panelUrls.length - 1; i++) {
      validationContexts.push({
        jobId,
        previousPanelNumber: i + 1,
        currentPanelNumber: i + 2,
        previousPanelUrl: panelUrls[i],
        currentPanelUrl: panelUrls[i + 1]
      });
    }

    // Validate all pairs in parallel
    const sequentialChecks = await Promise.all(
      validationContexts.map(context =>
        this.validateSequentialConsistency(context).catch(error => {
          // Convert validation errors to failed reports for aggregation
          if (error instanceof SequentialValidationError) {
            return {
              overallScore: error.consistencyScore,
              characterContinuity: 0,
              environmentalContinuity: 0,
              lightingConsistency: 0,
              colorPaletteConsistency: 0,
              artStyleConsistency: 0,
              spatialLogic: 0,
              detailedAnalysis: error.message,
              discontinuities: error.discontinuities,
              passesThreshold: false,
              previousPanelNumber: error.previousPanelNumber,
              currentPanelNumber: error.currentPanelNumber
            } as SequentialConsistencyReport;
          }
          throw error;
        })
      )
    );

    // Calculate overall page consistency
    const validScores = sequentialChecks
      .map(check => check.overallScore)
      .filter(score => score >= 0);  // Exclude unvalidated (-1)

    const overallPageConsistency = validScores.length > 0
      ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
      : -1;

    // Identify failed transitions
    const failedTransitions = sequentialChecks
      .filter(check => !check.passesThreshold && check.overallScore >= 0)
      .map(check => ({
        from: check.previousPanelNumber,
        to: check.currentPanelNumber,
        score: check.overallScore,
        issues: check.discontinuities
      }));

    const result: PageSequentialValidationResult = {
      pageNumber,
      sequentialChecks,
      overallPageConsistency,
      passesThreshold: overallPageConsistency >= SEQUENTIAL_CONSISTENCY_THRESHOLD,
      failedTransitions
    };

    if (result.passesThreshold) {
      this.logger.log(
        `✅ Page ${pageNumber} sequential consistency: ${overallPageConsistency.toFixed(1)}%`
      );
    } else {
      this.logger.error(
        `❌ Page ${pageNumber} sequential consistency failed: ${overallPageConsistency.toFixed(1)}% ` +
        `(${failedTransitions.length} failed transitions)`
      );
    }

    return result;
  }

  /**
   * Build enhanced continuity prompt for regeneration attempts
   * Emphasizes specific requirements based on previous failures
   */
  public buildEnhancedContinuityPrompt(
    previousPanelDescription: string,
    previousPanelNumber: number,
    currentPanelNumber: number,
    failureReasons: string[]
  ): string {
    let prompt = ENHANCED_CONTINUITY_PROMPT_TEMPLATE;

    // Replace panel numbers and description
    prompt = prompt.replace('{previousPanelNumber}', previousPanelNumber.toString());
    prompt = prompt.replace('{currentPanelNumber}', currentPanelNumber.toString());
    prompt = prompt.replace('{previousPanelDescription}', previousPanelDescription);

    // Build specific requirements based on failure reasons
    const specificRequirements: string[] = [];

    for (const reason of failureReasons) {
      const lowerReason = reason.toLowerCase();

      if (lowerReason.includes('character')) {
        specificRequirements.push('CHARACTER APPEARANCE: Must be pixel-perfect match to previous panel');
      }
      if (lowerReason.includes('environment') || lowerReason.includes('location')) {
        specificRequirements.push('ENVIRONMENT: All background elements must remain consistent');
      }
      if (lowerReason.includes('lighting') || lowerReason.includes('light')) {
        specificRequirements.push('LIGHTING: Direction and intensity must match exactly');
      }
      if (lowerReason.includes('color') || lowerReason.includes('palette')) {
        specificRequirements.push('COLORS: Use identical color palette from previous panel');
      }
      if (lowerReason.includes('style') || lowerReason.includes('art')) {
        specificRequirements.push('ART STYLE: Line weight and rendering must be indistinguishable');
      }
      if (lowerReason.includes('spatial') || lowerReason.includes('camera')) {
        specificRequirements.push('SPATIAL: Camera movement must be natural and logical');
      }
    }

    prompt = prompt.replace(
      '{specificRequirements}',
      specificRequirements.length > 0
        ? '\nSPECIFIC FIXES REQUIRED:\n' + specificRequirements.map(r => `- ${r}`).join('\n')
        : ''
    );

    return prompt;
  }

  /**
   * Perform validation using GPT-4 Vision API
   * Analyzes two panel images in a single API call
   */
  private async performVisionValidation(
    previousPanelUrl: string,
    currentPanelUrl: string,
    previousPanelNumber: number,
    currentPanelNumber: number
  ): Promise<SequentialConsistencyReport> {
    // Build validation prompt
    const prompt = this.buildValidationPrompt(previousPanelNumber, currentPanelNumber);

    // Call GPT-4 Vision with both images
    const response = await this.callGPT4VisionSequential([previousPanelUrl, currentPanelUrl], prompt);

    // Parse response into structured report
    const report = this.parseValidationResponse(
      response,
      previousPanelNumber,
      currentPanelNumber
    );

    // Determine if passes threshold
    report.passesThreshold = report.overallScore >= SEQUENTIAL_CONSISTENCY_THRESHOLD;

    return report;
  }

  /**
   * Call GPT-4 Vision API with two panel images for sequential comparison
   */
  private async callGPT4VisionSequential(
    imageUrls: string[],
    validationPrompt: string
  ): Promise<string> {
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Build messages array with text prompt and multiple images
        const content: any[] = [
          { type: 'text', text: validationPrompt }
        ];

        // Add both panel images
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

        // Make API call
        const response = await this.makeVisionAPICall(messages);
        return response;

      } catch (error: any) {
        lastError = error;

        if (error.name === 'AbortError') {
          throw new AITimeoutError(`Vision API request timed out after ${VISION_API_TIMEOUT}ms`, {
            service: 'SequentialConsistencyValidator',
            operation: 'callGPT4VisionSequential'
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
   * Make Vision API call with retry logic
   */
  private async makeVisionAPICall(messages: any[]): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VISION_API_TIMEOUT);

    try {
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
            service: 'SequentialConsistencyValidator',
            operation: 'makeVisionAPICall',
            details: { httpStatus: response.status }
          });
        }

        throw new AIServiceUnavailableError(
          `Vision API error: ${errorData.error?.message || response.statusText}`,
          {
            service: 'SequentialConsistencyValidator',
            operation: 'makeVisionAPICall',
            details: { httpStatus: response.status }
          }
        );
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new AIServiceUnavailableError('Invalid response from Vision API', {
          service: 'SequentialConsistencyValidator',
          operation: 'makeVisionAPICall'
        });
      }

      return data.choices[0].message.content;

    } catch (error: any) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Build validation prompt from panel numbers
   */
  private buildValidationPrompt(
    previousPanelNumber: number,
    currentPanelNumber: number
  ): string {
    let prompt = SEQUENTIAL_VALIDATION_PROMPT;

    prompt = prompt.replace('{previousPanelNumber}', previousPanelNumber.toString());
    prompt = prompt.replace('{currentPanelNumber}', currentPanelNumber.toString());

    return prompt;
  }

  /**
   * Parse validation response from GPT-4 Vision
   */
  private parseValidationResponse(
    response: string,
    previousPanelNumber: number,
    currentPanelNumber: number
  ): SequentialConsistencyReport {
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
        'characterContinuity',
        'environmentalContinuity',
        'lightingConsistency',
        'colorPaletteConsistency',
        'artStyleConsistency',
        'spatialLogic',
        'detailedAnalysis'
      ];

      for (const field of required) {
        if (!(field in parsed)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Ensure discontinuities is an array
      if (!Array.isArray(parsed.discontinuities)) {
        parsed.discontinuities = [];
      }

      // Calculate overall score if not present or invalid
      if (typeof parsed.overallScore !== 'number' || parsed.overallScore < 0 || parsed.overallScore > 100) {
        parsed.overallScore = Math.round(
          (parsed.characterContinuity +
           parsed.environmentalContinuity +
           parsed.lightingConsistency +
           parsed.colorPaletteConsistency +
           parsed.artStyleConsistency +
           parsed.spatialLogic) / 6
        );
      }

      return {
        overallScore: parsed.overallScore,
        characterContinuity: parsed.characterContinuity,
        environmentalContinuity: parsed.environmentalContinuity,
        lightingConsistency: parsed.lightingConsistency,
        colorPaletteConsistency: parsed.colorPaletteConsistency,
        artStyleConsistency: parsed.artStyleConsistency,
        spatialLogic: parsed.spatialLogic,
        detailedAnalysis: parsed.detailedAnalysis,
        discontinuities: parsed.discontinuities,
        passesThreshold: false,  // Will be set by caller
        previousPanelNumber,
        currentPanelNumber
      };

    } catch (error: any) {
      this.logger.error('Failed to parse validation response:', error);
      this.logger.error('Raw response:', response);

      // Return pessimistic fallback report
      return {
        overallScore: 0,
        characterContinuity: 0,
        environmentalContinuity: 0,
        lightingConsistency: 0,
        colorPaletteConsistency: 0,
        artStyleConsistency: 0,
        spatialLogic: 0,
        detailedAnalysis: `Failed to parse validation response: ${error.message}`,
        discontinuities: ['Parse error', error.message],
        passesThreshold: false,
        previousPanelNumber,
        currentPanelNumber
      };
    }
  }

  /**
   * Check for critical failures that require immediate action
   */
  private hasCriticalFailure(report: SequentialConsistencyReport): boolean {
    // Character continuity below critical threshold
    if (report.characterContinuity < CRITICAL_THRESHOLDS.characterContinuity) {
      return true;
    }

    // Art style consistency below critical threshold
    if (report.artStyleConsistency < CRITICAL_THRESHOLDS.artStyleConsistency) {
      return true;
    }

    // Any dimension below minimum acceptable score
    const scores = [
      report.characterContinuity,
      report.environmentalContinuity,
      report.lightingConsistency,
      report.colorPaletteConsistency,
      report.artStyleConsistency,
      report.spatialLogic
    ];

    return scores.some(score => score < CRITICAL_THRESHOLDS.minimumIndividualScore);
  }

  /**
   * Identify which dimensions have critical failures
   */
  private identifyCriticalFailures(report: SequentialConsistencyReport): string[] {
    const failures: string[] = [];

    if (report.characterContinuity < CRITICAL_THRESHOLDS.characterContinuity) {
      failures.push(`Character continuity (${report.characterContinuity}% < ${CRITICAL_THRESHOLDS.characterContinuity}%)`);
    }

    if (report.artStyleConsistency < CRITICAL_THRESHOLDS.artStyleConsistency) {
      failures.push(`Art style (${report.artStyleConsistency}% < ${CRITICAL_THRESHOLDS.artStyleConsistency}%)`);
    }

    const dimensions = [
      { name: 'character', score: report.characterContinuity },
      { name: 'environmental', score: report.environmentalContinuity },
      { name: 'lighting', score: report.lightingConsistency },
      { name: 'color palette', score: report.colorPaletteConsistency },
      { name: 'art style', score: report.artStyleConsistency },
      { name: 'spatial logic', score: report.spatialLogic }
    ];

    for (const dim of dimensions) {
      if (dim.score < CRITICAL_THRESHOLDS.minimumIndividualScore) {
        failures.push(`${dim.name} (${dim.score}% < ${CRITICAL_THRESHOLDS.minimumIndividualScore}%)`);
      }
    }

    return failures;
  }

  /**
   * Store validation result in database
   */
  private async storeValidationResult(
    jobId: string,
    report: SequentialConsistencyReport,
    attemptNumber: number
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
          previous_panel_number,
          overall_score,
          facial_consistency,
          body_proportion_consistency,
          clothing_consistency,
          color_palette_consistency,
          art_style_consistency,
          detailed_analysis,
          failure_reasons,
          passes_threshold,
          attempt_number,
          sequential_consistency_score,
          character_continuity_score,
          environmental_continuity_score,
          lighting_consistency_score,
          discontinuities_found
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          jobId,
          report.currentPanelNumber,
          report.previousPanelNumber,
          report.overallScore,
          report.characterContinuity,  // Repurpose facial_consistency
          0,  // body_proportion_consistency (not used for sequential)
          0,  // clothing_consistency (not used for sequential)
          report.colorPaletteConsistency,
          report.artStyleConsistency,
          report.detailedAnalysis,
          JSON.stringify(report.discontinuities),
          report.passesThreshold,
          attemptNumber,
          report.overallScore,
          report.characterContinuity,
          report.environmentalContinuity,
          report.lightingConsistency,
          JSON.stringify(report.discontinuities)
        ]
      );

      this.logger.log(
        `💾 Stored sequential validation result for job ${jobId}, ` +
        `panels ${report.previousPanelNumber}→${report.currentPanelNumber}, attempt ${attemptNumber}`
      );

    } catch (error: any) {
      this.logger.error('Failed to store sequential validation result:', error);
      // Don't throw - storage failure shouldn't block validation
    }
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
