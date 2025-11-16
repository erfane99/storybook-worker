# Sequential Consistency Validator - Integration Example

## Quick Start Integration

This document shows how to integrate the Sequential Consistency Validator into your comic generation workflow.

## Step 1: Import the Validator

```typescript
import {
  SequentialConsistencyValidator,
  SequentialValidationError,
  SequentialConsistencyReport,
  SequentialValidationContext,
  PageSequentialValidationResult
} from './services/ai/modular/sequential-consistency-validator';
```

## Step 2: Initialize the Validator

```typescript
// In your service initialization
import { OpenAIIntegration } from './services/ai/modular/openai-integration';
import { DatabaseService } from './services/database/database-service';

class ComicGenerationService {
  private sequentialValidator: SequentialConsistencyValidator;

  constructor(
    private openaiIntegration: OpenAIIntegration,
    private databaseService: DatabaseService,
    private errorHandler: any,
    private logger: any
  ) {
    // Initialize sequential validator
    this.sequentialValidator = new SequentialConsistencyValidator(
      this.openaiIntegration,
      this.databaseService,
      this.errorHandler,
      this.logger
    );
  }
}
```

## Step 3: Integrate into Panel Generation Loop

```typescript
async generateComicPage(
  jobId: string,
  pageNumber: number,
  storyBeats: StoryBeat[],
  characterDNA: CharacterDNA,
  environmentalDNA: EnvironmentalDNA
): Promise<ComicPanel[]> {
  const panels: ComicPanel[] = [];
  let previousPanelUrl: string | null = null;

  for (let i = 0; i < storyBeats.length; i++) {
    const panelNumber = i + 1;
    const beat = storyBeats[i];

    // Generate the panel
    let panel = await this.generatePanel(
      beat,
      characterDNA,
      environmentalDNA,
      panelNumber
    );

    // Step 1: Individual character validation
    await this.validateIndividualPanel(panel, characterDNA, jobId, panelNumber);

    // Step 2: Sequential validation (if not first panel)
    if (previousPanelUrl) {
      panel = await this.validateAndFixSequential(
        jobId,
        panelNumber - 1,
        panelNumber,
        previousPanelUrl,
        panel,
        beat,
        characterDNA,
        environmentalDNA
      );
    }

    panels.push(panel);
    previousPanelUrl = panel.imageUrl;
  }

  return panels;
}
```

## Step 4: Sequential Validation with Regeneration

```typescript
async validateAndFixSequential(
  jobId: string,
  previousPanelNumber: number,
  currentPanelNumber: number,
  previousPanelUrl: string,
  currentPanel: ComicPanel,
  beat: StoryBeat,
  characterDNA: CharacterDNA,
  environmentalDNA: EnvironmentalDNA
): Promise<ComicPanel> {
  const maxAttempts = 2;
  let panel = currentPanel;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const context: SequentialValidationContext = {
      jobId,
      previousPanelNumber,
      currentPanelNumber,
      previousPanelUrl,
      currentPanelUrl: panel.imageUrl,
      attemptNumber: attempt,
      panelDescription: beat.description
    };

    try {
      // Validate sequential consistency
      const report = await this.sequentialValidator.validateSequentialConsistency(context);

      // Success - return validated panel
      if (report.passesThreshold) {
        this.logger.log(
          `✅ Panel ${currentPanelNumber} sequential validation passed (${report.overallScore}%)`
        );
        return panel;
      }

      // Warning range (70-84%) - continue with warning
      if (report.overallScore >= 70) {
        this.logger.warn(
          `⚠️ Panel ${currentPanelNumber} has minor sequential issues but continuing (${report.overallScore}%)`
        );
        return panel;
      }

      // Should not reach here as validation throws on failure
      throw new Error('Unexpected validation state');

    } catch (error) {
      if (error instanceof SequentialValidationError) {
        // Last attempt - accept with warning
        if (attempt === maxAttempts) {
          this.logger.error(
            `❌ Panel ${currentPanelNumber} failed sequential validation after ${maxAttempts} attempts. ` +
            `Accepting with warning (score: ${error.consistencyScore}%)`
          );
          return panel;
        }

        // Retry with enhanced continuity prompt
        this.logger.warn(
          `🔄 Panel ${currentPanelNumber} sequential validation failed (attempt ${attempt}/${maxAttempts}). ` +
          `Regenerating with enhanced continuity prompt...`
        );

        const enhancedPrompt = this.sequentialValidator.buildEnhancedContinuityPrompt(
          beat.description,
          previousPanelNumber,
          currentPanelNumber,
          error.discontinuities
        );

        // Regenerate panel with enhanced prompt
        panel = await this.regeneratePanelWithEnhancedPrompt(
          beat,
          characterDNA,
          environmentalDNA,
          currentPanelNumber,
          enhancedPrompt
        );

        // Continue loop to validate regenerated panel
        continue;
      }

      // Other errors bubble up
      throw error;
    }
  }

  // Should not reach here
  return panel;
}
```

## Step 5: Panel Regeneration with Enhanced Prompt

```typescript
async regeneratePanelWithEnhancedPrompt(
  beat: StoryBeat,
  characterDNA: CharacterDNA,
  environmentalDNA: EnvironmentalDNA,
  panelNumber: number,
  enhancedContinuityPrompt: string
): Promise<ComicPanel> {
  this.logger.log(`🎨 Regenerating panel ${panelNumber} with enhanced continuity requirements`);

  // Build prompt with enhanced continuity requirements
  const prompt = this.buildPanelPrompt(beat, characterDNA, environmentalDNA);
  const finalPrompt = `${enhancedContinuityPrompt}\n\n${prompt}`;

  // Generate image with enhanced prompt
  const imageUrl = await this.openaiIntegration.generateImage({
    prompt: finalPrompt,
    size: '1024x1024',
    quality: 'standard',
    style: 'vivid'
  });

  return {
    panelNumber,
    imageUrl,
    description: beat.description,
    dialogue: beat.dialogue,
    emotion: beat.emotion,
    environment: beat.environment
  };
}
```

## Step 6: Page-Level Validation (Optional)

```typescript
async validateEntirePage(
  jobId: string,
  pageNumber: number,
  panels: ComicPanel[]
): Promise<void> {
  this.logger.log(`🔗 Validating sequential consistency for entire page ${pageNumber}`);

  const panelUrls = panels.map(p => p.imageUrl);

  const pageResult = await this.sequentialValidator.validatePageSequentialConsistency(
    jobId,
    pageNumber,
    panelUrls
  );

  if (pageResult.passesThreshold) {
    this.logger.log(
      `✅ Page ${pageNumber} overall sequential consistency: ${pageResult.overallPageConsistency.toFixed(1)}%`
    );
  } else {
    this.logger.error(
      `❌ Page ${pageNumber} has sequential issues: ${pageResult.overallPageConsistency.toFixed(1)}%`
    );
    this.logger.error(`   Failed transitions: ${pageResult.failedTransitions.length}`);

    // Log each failed transition
    pageResult.failedTransitions.forEach(failure => {
      this.logger.error(
        `   Panel ${failure.from}→${failure.to}: ${failure.score}% - ${failure.issues.join(', ')}`
      );
    });
  }
}
```

## Complete Example: Comic Page Generation with Sequential Validation

```typescript
async generateValidatedComicPage(
  jobId: string,
  pageNumber: number,
  storyBeats: StoryBeat[],
  characterDNA: CharacterDNA,
  environmentalDNA: EnvironmentalDNA
): Promise<ComicPanel[]> {
  this.logger.log(`📖 Generating page ${pageNumber} with sequential validation...`);

  const panels: ComicPanel[] = [];
  let previousPanelUrl: string | null = null;

  for (let i = 0; i < storyBeats.length; i++) {
    const panelNumber = i + 1;
    const beat = storyBeats[i];

    this.logger.log(`🎨 Generating panel ${panelNumber}/${storyBeats.length}...`);

    // Generate panel
    let panel = await this.generatePanel(
      beat,
      characterDNA,
      environmentalDNA,
      panelNumber
    );

    // Individual validation
    this.logger.log(`🔍 Validating panel ${panelNumber} character consistency...`);
    await this.validateIndividualPanel(panel, characterDNA, jobId, panelNumber);

    // Sequential validation (if not first panel)
    if (previousPanelUrl) {
      this.logger.log(`🔗 Validating panel ${panelNumber - 1}→${panelNumber} sequential consistency...`);
      panel = await this.validateAndFixSequential(
        jobId,
        panelNumber - 1,
        panelNumber,
        previousPanelUrl,
        panel,
        beat,
        characterDNA,
        environmentalDNA
      );
    }

    panels.push(panel);
    previousPanelUrl = panel.imageUrl;

    this.logger.log(`✅ Panel ${panelNumber} complete`);
  }

  // Optional: Validate entire page
  await this.validateEntirePage(jobId, pageNumber, panels);

  this.logger.log(`✅ Page ${pageNumber} complete with ${panels.length} panels`);

  return panels;
}
```

## Error Handling Best Practices

```typescript
try {
  const report = await this.sequentialValidator.validateSequentialConsistency(context);

  // Handle success
  if (report.passesThreshold) {
    this.logger.log(`✅ Sequential validation passed: ${report.overallScore}%`);
  }

} catch (error) {
  if (error instanceof SequentialValidationError) {
    // Validation failed - handle regeneration
    this.logger.warn(`Regenerating due to sequential failure: ${error.message}`);
    this.logger.warn(`Discontinuities: ${error.discontinuities.join(', ')}`);

    // Build enhanced prompt
    const enhancedPrompt = this.sequentialValidator.buildEnhancedContinuityPrompt(
      previousPanelDescription,
      error.previousPanelNumber,
      error.currentPanelNumber,
      error.discontinuities
    );

    // Regenerate with enhanced prompt
    // ... your regeneration logic

  } else if (error instanceof AIServiceUnavailableError) {
    // Vision API unavailable - continue without blocking
    this.logger.warn('Vision API unavailable, continuing without sequential validation');

  } else {
    // Unexpected error - propagate
    throw error;
  }
}
```

## Database Queries for Analysis

```typescript
// Get all sequential validation results for a job
async getSequentialValidationResults(jobId: string): Promise<any[]> {
  const result = await this.databaseService.executeSQL(
    `SELECT
      panel_number,
      previous_panel_number,
      sequential_consistency_score,
      character_continuity_score,
      environmental_continuity_score,
      lighting_consistency_score,
      spatial_logic_score,
      discontinuities_found,
      passes_threshold,
      attempt_number
    FROM panel_validation_results
    WHERE job_id = $1
      AND previous_panel_number IS NOT NULL
    ORDER BY panel_number ASC`,
    [jobId]
  );

  return result.rows;
}

// Get failed sequential validations for analysis
async getFailedSequentialValidations(limit: number = 100): Promise<any[]> {
  const result = await this.databaseService.executeSQL(
    `SELECT
      job_id,
      panel_number,
      previous_panel_number,
      sequential_consistency_score,
      discontinuities_found,
      validation_timestamp
    FROM panel_validation_results
    WHERE previous_panel_number IS NOT NULL
      AND passes_threshold = false
    ORDER BY validation_timestamp DESC
    LIMIT $1`,
    [limit]
  );

  return result.rows;
}
```

## Configuration Options

```typescript
// Adjust thresholds if needed
const CUSTOM_THRESHOLDS = {
  pass: 85,          // Minimum to pass
  warning: 70,       // Show warning but continue
  critical: {
    character: 80,   // Character continuity critical threshold
    artStyle: 75,    // Art style critical threshold
    individual: 60   // Any dimension minimum
  }
};

// These are configured in the validator constants
// Modify sequential-consistency-validator.ts if adjustments needed
```

## Testing Your Integration

```typescript
// Test with mock data
async testSequentialValidation() {
  const mockContext: SequentialValidationContext = {
    jobId: 'test-job-123',
    previousPanelNumber: 1,
    currentPanelNumber: 2,
    previousPanelUrl: 'https://example.com/test-panel-1.png',
    currentPanelUrl: 'https://example.com/test-panel-2.png',
    attemptNumber: 1
  };

  try {
    const report = await this.sequentialValidator.validateSequentialConsistency(mockContext);
    console.log('Test passed:', report);
  } catch (error) {
    console.error('Test failed:', error);
  }
}
```

## Monitoring and Metrics

```typescript
// Track sequential validation metrics
class SequentialValidationMetrics {
  private totalValidations = 0;
  private passedValidations = 0;
  private failedValidations = 0;
  private warningValidations = 0;
  private averageScore = 0;

  recordValidation(report: SequentialConsistencyReport) {
    this.totalValidations++;

    if (report.passesThreshold) {
      this.passedValidations++;
    } else if (report.overallScore >= 70) {
      this.warningValidations++;
    } else {
      this.failedValidations++;
    }

    // Update rolling average
    this.averageScore = (
      (this.averageScore * (this.totalValidations - 1)) + report.overallScore
    ) / this.totalValidations;
  }

  getMetrics() {
    return {
      total: this.totalValidations,
      passed: this.passedValidations,
      warnings: this.warningValidations,
      failed: this.failedValidations,
      passRate: (this.passedValidations / this.totalValidations) * 100,
      averageScore: this.averageScore
    };
  }
}
```

## Next Steps

1. **Initialize the validator** in your service constructor
2. **Add sequential validation** after individual panel validation
3. **Implement regeneration logic** for failed validations
4. **Monitor validation results** in database for continuous improvement
5. **Adjust prompts** based on common discontinuity patterns

For detailed API documentation, see `SEQUENTIAL_CONSISTENCY_VALIDATION.md`.
