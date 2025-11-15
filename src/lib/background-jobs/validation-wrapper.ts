/**
 * ===== VALIDATION WRAPPER MODULE =====
 * Wraps comic panel and page generation with character and environmental validation
 *
 * Responsibilities:
 * - Panel-level character consistency validation with regeneration
 * - Page-level environmental consistency validation with full page regeneration
 * - Progress updates during validation and regeneration phases
 * - Comprehensive metrics tracking
 * - Fail-fast error handling with clear messages
 */

import { serviceContainer } from '../../services/container/service-container.js';
import {
  SERVICE_TOKENS,
  IDatabaseService,
  IAIService,
  IJobService,
} from '../../services/interfaces/service-contracts.js';

import type {
  VisualConsistencyValidator,
  ConsistencyScore,
  ValidationError,
} from '../../services/ai/modular/visual-consistency-validator.js';

import type {
  EnvironmentalConsistencyValidator,
  EnvironmentalConsistencyReport,
  EnvironmentalValidationError,
  EnvironmentalDNA,
} from '../../services/ai/modular/environmental-consistency-validator.js';

import type { CharacterDNA } from '../../services/interfaces/service-contracts.js';

// ===== INTERFACES =====

export interface PanelGenerationContext {
  jobId: string;
  panelNumber: number;
  pageNumber: number;
  sceneDescription: string;
  characterDNA?: CharacterDNA;
  environmentalDNA?: any;
  previousPanelUrl?: string;
  imageGenerationOptions: any;
}

export interface PageGenerationContext {
  jobId: string;
  pageNumber: number;
  panels: PanelGenerationContext[];
  environmentalDNA: any;
}

export interface ValidationMetrics {
  totalPanels: number;
  panelsRegenerated: number;
  characterValidationAttempts: number;
  environmentalValidationAttempts: number;
  characterValidationScores: number[];
  environmentalValidationScores: number[];
  validationPassRate: number;
}

// ===== CONSTANTS =====

const MAX_PANEL_ATTEMPTS = 3;
const MAX_PAGE_ATTEMPTS = 2;

// ===== MAIN VALIDATION WRAPPER CLASS =====

export class ValidationWrapper {
  private characterValidator?: VisualConsistencyValidator;
  private environmentalValidator?: EnvironmentalConsistencyValidator;
  private databaseService?: IDatabaseService;
  private aiService?: IAIService;
  private jobService?: IJobService;

  private metrics: ValidationMetrics = {
    totalPanels: 0,
    panelsRegenerated: 0,
    characterValidationAttempts: 0,
    environmentalValidationAttempts: 0,
    characterValidationScores: [],
    environmentalValidationScores: [],
    validationPassRate: 0,
  };

  constructor() {
    // Validators will be injected lazily
  }

  /**
   * Initialize validators and services
   */
  async initialize(): Promise<void> {
    this.characterValidator = await serviceContainer.resolve<VisualConsistencyValidator>(
      SERVICE_TOKENS.VISUAL_CONSISTENCY_VALIDATOR
    );
    this.environmentalValidator = await serviceContainer.resolve<EnvironmentalConsistencyValidator>(
      SERVICE_TOKENS.ENVIRONMENTAL_CONSISTENCY_VALIDATOR
    );
    this.databaseService = await serviceContainer.resolve<IDatabaseService>(
      SERVICE_TOKENS.DATABASE
    );
    this.aiService = await serviceContainer.resolve<IAIService>(SERVICE_TOKENS.AI);
    this.jobService = await serviceContainer.resolve<IJobService>(SERVICE_TOKENS.JOB);

    console.log('✅ Validation wrapper initialized with character and environmental validators');
  }

  /**
   * Generate and validate a single panel with automatic regeneration on failure
   */
  async generateAndValidatePanel(
    context: PanelGenerationContext
  ): Promise<{ imageUrl: string; validationScore: number }> {
    this.metrics.totalPanels++;
    let bestScore = 0;
    let bestImageUrl = '';

    for (let attempt = 1; attempt <= MAX_PANEL_ATTEMPTS; attempt++) {
      this.metrics.characterValidationAttempts++;

      // Update progress
      if (attempt === 1) {
        await this.jobService!.updateJobProgress(
          context.jobId,
          0,
          `Generating panel ${context.panelNumber}...`
        );
      } else {
        await this.jobService!.updateJobProgress(
          context.jobId,
          0,
          `Quality check failed - regenerating panel ${context.panelNumber} with enhanced prompts (attempt ${attempt}/${MAX_PANEL_ATTEMPTS})`
        );
      }

      // Generate panel image
      const imageUrl = await this.generatePanelImage(context, attempt);

      // Update progress
      await this.jobService!.updateJobProgress(
        context.jobId,
        0,
        `Validating panel ${context.panelNumber} quality (attempt ${attempt}/${MAX_PANEL_ATTEMPTS})...`
      );

      // Validate character consistency
      if (!context.characterDNA || !this.characterValidator) {
        // No validation needed
        return { imageUrl, validationScore: -1 };
      }

      try {
        const validationScore = await this.characterValidator.validateCharacterConsistency(
          imageUrl,
          context.characterDNA,
          {
            jobId: context.jobId,
            panelNumber: context.panelNumber,
            attemptNumber: attempt,
            previousPanelUrl: context.previousPanelUrl,
          }
        );

        // Store validation result
        if (this.databaseService) {
          await this.databaseService.savePanelValidationResult({
            jobId: context.jobId,
            panelNumber: context.panelNumber,
            overallScore: validationScore.overallScore,
            facialConsistency: validationScore.facialConsistency,
            bodyProportionConsistency: validationScore.bodyProportionConsistency,
            clothingConsistency: validationScore.clothingConsistency,
            colorPaletteConsistency: validationScore.colorPaletteConsistency,
            artStyleConsistency: validationScore.artStyleConsistency,
            detailedAnalysis: validationScore.detailedAnalysis,
            failureReasons: validationScore.failureReasons,
            passesThreshold: validationScore.passesThreshold,
            attemptNumber: attempt,
          });
        }

        // Track best score
        if (validationScore.overallScore > bestScore) {
          bestScore = validationScore.overallScore;
          bestImageUrl = imageUrl;
        }

        // Check if validation passed
        if (validationScore.passesThreshold || validationScore.overallScore === -1) {
          // Success!
          this.metrics.characterValidationScores.push(validationScore.overallScore);

          await this.jobService!.updateJobProgress(
            context.jobId,
            0,
            `✅ Panel ${context.panelNumber} quality verified (score: ${validationScore.overallScore}%)`
          );

          if (attempt > 1) {
            this.metrics.panelsRegenerated++;
          }

          return { imageUrl, validationScore: validationScore.overallScore };
        }

        // Validation failed - prepare for retry
        console.error(
          `❌ Panel ${context.panelNumber} failed validation (attempt ${attempt}/${MAX_PANEL_ATTEMPTS}): score=${validationScore.overallScore}%, reasons=${validationScore.failureReasons.join(', ')}`
        );

        // If this is the last attempt, throw error
        if (attempt === MAX_PANEL_ATTEMPTS) {
          throw new Error(
            `Panel ${context.panelNumber} failed character consistency validation after ${MAX_PANEL_ATTEMPTS} attempts. Quality score: ${bestScore}%. Required: 90%. Failure reasons: ${validationScore.failureReasons.join(', ')}. Cannot proceed with substandard quality.`
          );
        }

        // Enhance prompt for next attempt
        if (this.characterValidator) {
          context.imageGenerationOptions.enhancedPrompt =
            this.characterValidator.buildEnhancedPrompt(
              context.imageGenerationOptions.prompt,
              attempt + 1,
              validationScore.failureReasons
            );
        }
      } catch (error: any) {
        // Check if this is a validation error vs API error
        if (error.message?.includes('Vision API') || error.message?.includes('validation')) {
          console.warn(`⚠️ Vision API unavailable for panel ${context.panelNumber}, continuing without validation`);
          return { imageUrl, validationScore: -1 };
        }

        // Re-throw other errors
        throw error;
      }
    }

    // Should never reach here
    throw new Error(
      `Panel ${context.panelNumber} failed after ${MAX_PANEL_ATTEMPTS} attempts`
    );
  }

  /**
   * Generate panel image using AI service
   */
  private async generatePanelImage(
    context: PanelGenerationContext,
    attemptNumber: number
  ): Promise<string> {
    if (!this.aiService) {
      throw new Error('AI service not initialized');
    }

    // Use enhanced prompt if available (from failed validation)
    const prompt =
      context.imageGenerationOptions.enhancedPrompt ||
      context.imageGenerationOptions.prompt;

    const result = await this.aiService.generateSceneImage({
      ...context.imageGenerationOptions,
      prompt,
    });

    const unwrapped = await result.unwrap();
    if (!unwrapped || !unwrapped.url) {
      throw new Error('Failed to generate panel image');
    }

    return unwrapped.url;
  }

  /**
   * Validate all panels on a page for environmental consistency
   * Regenerates entire page if validation fails
   */
  async validateAndRegeneratePageIfNeeded(
    context: PageGenerationContext,
    generatedPanels: Array<{ imageUrl: string; validationScore: number }>
  ): Promise<Array<{ imageUrl: string; validationScore: number }>> {
    if (!context.environmentalDNA || !this.environmentalValidator) {
      // No environmental validation needed
      return generatedPanels;
    }

    for (let attempt = 1; attempt <= MAX_PAGE_ATTEMPTS; attempt++) {
      this.metrics.environmentalValidationAttempts++;

      // Update progress
      await this.jobService!.updateJobProgress(
        context.jobId,
        0,
        `Validating page ${context.pageNumber} environmental consistency (${generatedPanels.length} panels, attempt ${attempt}/${MAX_PAGE_ATTEMPTS})`
      );

      try {
        // Collect panel URLs
        const panelUrls = generatedPanels.map((p) => p.imageUrl);

        // Validate environmental consistency
        const report = await this.environmentalValidator.validateEnvironmentalConsistency(
          panelUrls,
          context.environmentalDNA,
          context.pageNumber,
          attempt
        );

        // Store validation result
        if (this.databaseService) {
          await this.databaseService.saveEnvironmentalValidationResult({
            jobId: context.jobId,
            pageNumber: context.pageNumber,
            overallCoherence: report.overallCoherence,
            locationConsistency:
              report.panelScores[0]?.locationConsistency || 0,
            lightingConsistency:
              report.panelScores[0]?.lightingConsistency || 0,
            colorPaletteConsistency:
              report.panelScores[0]?.colorPaletteConsistency || 0,
            architecturalConsistency:
              report.panelScores[0]?.architecturalStyleConsistency || 0,
            crossPanelConsistency: report.crossPanelConsistency,
            panelScores: report.panelScores,
            detailedAnalysis: report.detailedAnalysis,
            failureReasons: report.failureReasons,
            passesThreshold: report.passesThreshold,
            attemptNumber: attempt,
            regenerationTriggered: !report.passesThreshold && attempt < MAX_PAGE_ATTEMPTS,
          });
        }

        // Check if validation passed
        if (report.passesThreshold || report.overallCoherence === -1) {
          // Success!
          this.metrics.environmentalValidationScores.push(report.overallCoherence);

          await this.jobService!.updateJobProgress(
            context.jobId,
            0,
            `✅ Page ${context.pageNumber} validated (coherence: ${report.overallCoherence.toFixed(1)}%)`
          );

          return generatedPanels;
        }

        // Validation failed
        console.error(
          `❌ Page ${context.pageNumber} failed environmental validation (attempt ${attempt}/${MAX_PAGE_ATTEMPTS}): coherence=${report.overallCoherence.toFixed(1)}%`
        );

        // If this is the last attempt, throw error
        if (attempt === MAX_PAGE_ATTEMPTS) {
          throw new Error(
            `Page ${context.pageNumber} failed environmental consistency validation after ${MAX_PAGE_ATTEMPTS} attempts. Coherence score: ${report.overallCoherence.toFixed(1)}%. Required: 85%. Failure reasons: ${report.failureReasons.join(', ')}. Cannot maintain world consistency.`
          );
        }

        // Regenerate entire page with enhanced environmental prompts
        await this.jobService!.updateJobProgress(
          context.jobId,
          0,
          `Environmental consistency below threshold (${report.overallCoherence.toFixed(1)}%) - regenerating entire page ${context.pageNumber} with enhanced world consistency (attempt ${attempt + 1}/${MAX_PAGE_ATTEMPTS})`
        );

        generatedPanels = await this.regenerateEntirePage(context, report);
      } catch (error: any) {
        // Check if this is a validation error vs API error
        if (error.message?.includes('Vision API') || error.message?.includes('environmental')) {
          console.warn(`⚠️ Vision API unavailable for page ${context.pageNumber}, continuing without environmental validation`);
          return generatedPanels;
        }

        // Re-throw other errors
        throw error;
      }
    }

    return generatedPanels;
  }

  /**
   * Regenerate entire page with enhanced environmental consistency prompts
   */
  private async regenerateEntirePage(
    context: PageGenerationContext,
    failedValidation: EnvironmentalConsistencyReport
  ): Promise<Array<{ imageUrl: string; validationScore: number }>> {
    const regeneratedPanels: Array<{ imageUrl: string; validationScore: number }> = [];

    // Build environmental enhancement text from failure reasons
    const envEnhancement = `ENVIRONMENTAL CONSISTENCY REQUIRED: ${failedValidation.failureReasons.join('; ')}. MANDATORY: exact same location (${context.environmentalDNA.primaryLocation?.name}), lighting (${context.environmentalDNA.lightingContext?.timeOfDay} - ${context.environmentalDNA.lightingContext?.lightingMood}), color palette, architectural style.`;

    for (const panelContext of context.panels) {
      // Add environmental enhancement to prompt
      panelContext.imageGenerationOptions.prompt += ` ${envEnhancement}`;

      // Regenerate panel with environmental enhancement
      // This will also go through character validation again
      const result = await this.generateAndValidatePanel(panelContext);
      regeneratedPanels.push(result);
    }

    return regeneratedPanels;
  }

  /**
   * Get validation metrics
   */
  getMetrics(): ValidationMetrics {
    // Calculate validation pass rate
    const totalValidations =
      this.metrics.characterValidationAttempts + this.metrics.environmentalValidationAttempts;
    const successfulValidations =
      this.metrics.characterValidationScores.length +
      this.metrics.environmentalValidationScores.length;
    this.metrics.validationPassRate =
      totalValidations > 0 ? (successfulValidations / totalValidations) * 100 : 0;

    return this.metrics;
  }

  /**
   * Calculate average character validation score
   */
  getAverageCharacterValidationScore(): number {
    if (this.metrics.characterValidationScores.length === 0) return 0;
    const sum = this.metrics.characterValidationScores.reduce((a, b) => a + b, 0);
    return sum / this.metrics.characterValidationScores.length;
  }

  /**
   * Calculate average environmental validation score
   */
  getAverageEnvironmentalValidationScore(): number {
    if (this.metrics.environmentalValidationScores.length === 0) return 0;
    const sum = this.metrics.environmentalValidationScores.reduce((a, b) => a + b, 0);
    return sum / this.metrics.environmentalValidationScores.length;
  }

  /**
   * Reset metrics for new job
   */
  resetMetrics(): void {
    this.metrics = {
      totalPanels: 0,
      panelsRegenerated: 0,
      characterValidationAttempts: 0,
      environmentalValidationAttempts: 0,
      characterValidationScores: [],
      environmentalValidationScores: [],
      validationPassRate: 0,
    };
  }
}
