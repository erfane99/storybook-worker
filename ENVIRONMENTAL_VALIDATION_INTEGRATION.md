# Environmental Validation Integration Guide

## Overview
This guide shows how to integrate the Environmental Consistency Validator into the job processor for page-by-page validation with automatic regeneration.

## Current Status
✅ Database migration created: `20251115132121_environmental_validation_results.sql`
✅ Validator class created: `src/services/ai/modular/environmental-consistency-validator.ts`
✅ Interfaces exported: `EnvironmentalConsistencyReport` added to `service-contracts.ts`
✅ Database methods added: `storeEnvironmentalValidation()` in DatabaseService
⏳ Job processor integration: **NEEDS MANUAL INTEGRATION**

## Integration Location

**File:** `src/lib/background-jobs/job-processor.ts`
**Method:** `processStorybookJobWithServices()`
**Phase:** After PHASE 6 (panel generation), before PHASE 7 (save)

Currently at line ~890-910, the code processes pages and immediately moves to saving.
We need to add environmental validation between processing and saving.

## Required Imports

Add these imports at the top of `job-processor.ts`:

```typescript
// Add to existing imports section
import {
  EnvironmentalConsistencyValidator,
  EnvironmentalValidationError
} from '../../services/ai/modular/environmental-consistency-validator.js';

import { OpenAIIntegration } from '../../services/ai/modular/openai-integration.js';
import { ErrorHandlingSystem } from '../../services/ai/modular/error-handling-system.js';
```

## Integration Code

### Step 1: Initialize Validator (in constructor or at method start)

```typescript
// Add near the start of processStorybookJobWithServices(), after getting services
const openaiIntegration = new OpenAIIntegration(
  process.env.OPENAI_API_KEY || '',
  new ErrorHandlingSystem('JobProcessor')
);

const environmentalValidator = new EnvironmentalConsistencyValidator(
  openaiIntegration,
  databaseService
);
```

### Step 2: Add Page Validation Loop (after line ~890, before saving)

```typescript
// ===== INSERT AFTER PHASE 6, BEFORE PHASE 7 =====

// PHASE 6.5: ENVIRONMENTAL CONSISTENCY VALIDATION
console.log('🌍 PHASE 6.5: Environmental Consistency Validation...');
await jobService.updateJobProgress(job.id, 91, 'Validating environmental consistency across pages...');

const MAX_PAGE_REGENERATION_ATTEMPTS = 2;

// Validate each page
for (let pageIndex = 0; pageIndex < updatedPages.length; pageIndex++) {
  const page = updatedPages[pageIndex];
  const pageNumber = pageIndex + 1;
  const panelsOnPage = page.scenes || [];

  console.log(`📄 Validating page ${pageNumber} (${panelsOnPage.length} panels)...`);

  let pageAttempt = 0;
  let pageValidated = false;
  let lastValidationError: EnvironmentalValidationError | null = null;

  while (!pageValidated && pageAttempt < MAX_PAGE_REGENERATION_ATTEMPTS) {
    pageAttempt++;

    try {
      // Collect panel image URLs for this page
      const panelImageUrls = panelsOnPage
        .map((scene: any) => scene.generatedImage)
        .filter((url: string) => url && url.length > 0);

      if (panelImageUrls.length === 0) {
        console.warn(`⚠️ Page ${pageNumber} has no generated images, skipping validation`);
        pageValidated = true; // Skip validation if no images
        break;
      }

      // Validate environmental consistency
      const validationReport = await environmentalValidator.validateEnvironmentalConsistency(
        panelImageUrls,
        environmentalDNA,
        pageNumber,
        pageAttempt
      );

      // Store validation results in database
      try {
        await databaseService.storeEnvironmentalValidation({
          job_id: job.id,
          page_number: pageNumber,
          overall_coherence: validationReport.overallCoherence,
          location_consistency: validationReport.panelScores[0]?.locationConsistency || 0,
          lighting_consistency: validationReport.panelScores[0]?.lightingConsistency || 0,
          color_palette_consistency: validationReport.panelScores[0]?.colorPaletteConsistency || 0,
          architectural_consistency: validationReport.panelScores[0]?.architecturalStyleConsistency || 0,
          cross_panel_consistency: validationReport.crossPanelConsistency,
          panel_scores: validationReport.panelScores,
          detailed_analysis: validationReport.detailedAnalysis,
          passes_threshold: validationReport.passesThreshold,
          failure_reasons: validationReport.failureReasons,
          attempt_number: pageAttempt,
          regeneration_triggered: false
        });
      } catch (dbError) {
        console.warn(`⚠️ Failed to store validation results for page ${pageNumber}:`, dbError);
        // Continue - database storage failure shouldn't block validation
      }

      // Validation passed
      console.log(`✅ Page ${pageNumber} passed environmental validation (coherence: ${validationReport.overallCoherence.toFixed(1)}%)`);
      pageValidated = true;

    } catch (error: any) {
      if (error instanceof EnvironmentalValidationError) {
        lastValidationError = error;

        console.error(`❌ Page ${pageNumber} failed environmental validation (attempt ${pageAttempt}/${MAX_PAGE_REGENERATION_ATTEMPTS})`);
        console.error(`   Coherence: ${error.coherenceScore.toFixed(1)}% (required: 85%)`);
        console.error(`   Failure reasons: ${error.failureReasons.join(', ')}`);

        // Store failed validation with regeneration_triggered flag
        try {
          await databaseService.storeEnvironmentalValidation({
            job_id: job.id,
            page_number: pageNumber,
            overall_coherence: error.coherenceScore,
            location_consistency: 0, // Not available in error
            lighting_consistency: 0,
            color_palette_consistency: 0,
            architectural_consistency: 0,
            cross_panel_consistency: 0,
            panel_scores: [],
            detailed_analysis: error.message,
            passes_threshold: false,
            failure_reasons: error.failureReasons,
            attempt_number: pageAttempt,
            regeneration_triggered: pageAttempt < MAX_PAGE_REGENERATION_ATTEMPTS
          });
        } catch (dbError) {
          console.warn(`⚠️ Failed to store failed validation for page ${pageNumber}:`, dbError);
        }

        // If not last attempt, regenerate the entire page
        if (pageAttempt < MAX_PAGE_REGENERATION_ATTEMPTS) {
          console.log(`🔄 Regenerating entire page ${pageNumber} with enhanced environmental prompts (attempt ${pageAttempt + 1}/${MAX_PAGE_REGENERATION_ATTEMPTS})...`);

          await jobService.updateJobProgress(
            job.id,
            91,
            `Regenerating page ${pageNumber} to improve environmental consistency (attempt ${pageAttempt + 1})...`
          );

          // Build enhanced prompts based on failure reasons
          const enhancedPromptAdditions = this.buildEnhancedEnvironmentalPrompts(
            error.failureReasons,
            environmentalDNA
          );

          // Regenerate ALL panels on this page
          const regeneratedScenes = [];
          for (let sceneIndex = 0; sceneIndex < panelsOnPage.length; sceneIndex++) {
            const originalScene = panelsOnPage[sceneIndex];

            try {
              this.trackServiceUsage(job.id, 'ai');

              // Build enhanced image prompt
              const enhancedImagePrompt = `${originalScene.imagePrompt}\n\n${enhancedPromptAdditions}`;

              // Regenerate this panel
              const imageResult = await aiService.generateSceneImage({
                image_prompt: enhancedImagePrompt,
                character_description: characterDescriptionToUse,
                emotion: originalScene.emotion || 'neutral',
                audience: audience as any,
                isReusedImage: is_reused_image,
                cartoon_image: character_image,
                user_id: job.user_id,
                style: character_art_style,
                characterArtStyle: character_art_style,
                layoutType: layout_type,
                panelType: originalScene.panelType,
                environmentalContext: {
                  characterDNA: characterDNA,
                  environmentalDNA: environmentalDNA,
                  panelNumber: sceneIndex + 1,
                  totalPanels: panelsOnPage.length,
                  enforceConsistency: true
                }
              });

              const unwrappedImageResult = await imageResult.unwrap();

              const regeneratedScene = {
                ...originalScene,
                generatedImage: unwrappedImageResult.url,
                imageGenerated: true,
                imagePrompt: enhancedImagePrompt,
                environmentalDNAUsed: true,
                regenerationAttempt: pageAttempt
              };

              regeneratedScenes.push(regeneratedScene);

              console.log(`   ✓ Regenerated panel ${sceneIndex + 1}/${panelsOnPage.length} on page ${pageNumber}`);

            } catch (regenerationError) {
              console.error(`   ✗ Failed to regenerate panel ${sceneIndex + 1} on page ${pageNumber}:`, regenerationError);
              // Use original scene as fallback
              regeneratedScenes.push(originalScene);
            }
          }

          // Update the page with regenerated scenes
          updatedPages[pageIndex] = {
            ...page,
            scenes: regeneratedScenes
          };

          console.log(`🔄 Page ${pageNumber} regenerated, will revalidate...`);

          // Loop continues to revalidate regenerated page

        } else {
          // Max attempts reached - fail the job
          console.error(`💥 Page ${pageNumber} failed environmental validation after ${MAX_PAGE_REGENERATION_ATTEMPTS} attempts`);
          console.error(`   Best coherence achieved: ${error.coherenceScore.toFixed(1)}%`);
          console.error(`   Final failure reasons: ${error.failureReasons.join(', ')}`);

          // Fail the entire job
          throw new Error(
            `Environmental validation failed for page ${pageNumber} after ${MAX_PAGE_REGENERATION_ATTEMPTS} regeneration attempts. ` +
            `Best coherence: ${error.coherenceScore.toFixed(1)}% (required: 85%). ` +
            `Reasons: ${error.failureReasons.join(', ')}`
          );
        }

      } else {
        // API error (not validation failure) - graceful degradation
        console.warn(`⚠️ Environmental validation API error for page ${pageNumber}:`, error);
        console.warn(`   Continuing without environmental validation for this page`);
        pageValidated = true; // Skip validation for this page, don't fail job
      }
    }
  }

  // Update progress after each page validation
  const validationProgress = 91 + Math.round((pageIndex + 1) / updatedPages.length * 4); // 91-95%
  await jobService.updateJobProgress(
    job.id,
    validationProgress,
    `Environmental validation: ${pageIndex + 1}/${updatedPages.length} pages verified`
  );
}

console.log(`✅ Environmental consistency validation complete for ${updatedPages.length} pages`);

// Continue with PHASE 7 (saving)...
```

### Step 3: Add Helper Method for Enhanced Prompts

Add this method to the `ProductionJobProcessor` class:

```typescript
/**
 * Build enhanced environmental prompts based on validation failure reasons
 * These prompts emphasize the specific environmental aspects that failed
 */
private buildEnhancedEnvironmentalPrompts(
  failureReasons: string[],
  environmentalDNA: any
): string {
  const enhancements: string[] = [
    `\n🌍 CRITICAL ENVIRONMENTAL CONSISTENCY REQUIREMENTS:`
  ];

  // Analyze failure reasons and add specific enhancements
  for (const reason of failureReasons) {
    const lowerReason = reason.toLowerCase();

    if (lowerReason.includes('location') || lowerReason.includes('setting')) {
      enhancements.push(
        `LOCATION CRITICAL: This panel MUST clearly show "${environmentalDNA.primaryLocation?.name || 'the setting'}" ` +
        `with these key features visible: ${environmentalDNA.primaryLocation?.keyFeatures?.join(', ') || 'consistent features'}`
      );
    }

    if (lowerReason.includes('lighting')) {
      enhancements.push(
        `LIGHTING CRITICAL: Maintain ${environmentalDNA.lightingContext?.timeOfDay || 'consistent'} lighting ` +
        `with ${environmentalDNA.lightingContext?.lightingMood || 'consistent'} mood throughout. ` +
        `Weather: ${environmentalDNA.lightingContext?.weatherCondition || 'consistent'}`
      );
    }

    if (lowerReason.includes('color') || lowerReason.includes('palette')) {
      const dominantColors = environmentalDNA.visualContinuity?.colorConsistency?.dominantColors?.join(', ') || 'specified colors';
      const accentColors = environmentalDNA.visualContinuity?.colorConsistency?.accentColors?.join(', ') || 'accent colors';
      enhancements.push(
        `COLOR PALETTE CRITICAL: Use ONLY these colors - Dominant: ${dominantColors}. Accents: ${accentColors}`
      );
    }

    if (lowerReason.includes('architectural') || lowerReason.includes('building')) {
      enhancements.push(
        `ARCHITECTURAL CRITICAL: All structures must match ${environmentalDNA.primaryLocation?.architecturalStyle || 'consistent'} style exactly`
      );
    }

    if (lowerReason.includes('atmospheric') || lowerReason.includes('atmosphere')) {
      enhancements.push(
        `ATMOSPHERE CRITICAL: Maintain ${environmentalDNA.lightingContext?.weatherCondition || 'consistent weather'} ` +
        `atmospheric conditions throughout`
      );
    }

    if (lowerReason.includes('cross-panel') || lowerReason.includes('world')) {
      enhancements.push(
        `WORLD CONSISTENCY CRITICAL: This panel must feel like it exists in the EXACT SAME WORLD as other panels. ` +
        `Same location, same time of day, same weather, same visual style.`
      );
    }
  }

  // Add recurring elements reminder
  if (environmentalDNA.visualContinuity?.recurringObjects?.length > 0) {
    enhancements.push(
      `RECURRING ELEMENTS: Include these objects when appropriate: ${environmentalDNA.visualContinuity.recurringObjects.join(', ')}`
    );
  }

  // Add general consistency reminder
  enhancements.push(
    `ZERO tolerance for environmental inconsistency. All panels on this page must exist in the SAME visual world.`
  );

  return enhancements.join('\n');
}
```

## Testing the Integration

### Manual Testing Steps

1. **Apply Database Migration:**
   ```bash
   # Run migration through Supabase CLI or dashboard
   # File: supabase/migrations/20251115132121_environmental_validation_results.sql
   ```

2. **Add Imports to job-processor.ts** (as shown above)

3. **Add Validator Initialization** (as shown above)

4. **Insert Validation Loop** (as shown in Step 2)

5. **Add Helper Method** (as shown in Step 3)

6. **Test with a Job:**
   - Create a test storybook job
   - Monitor console logs for environmental validation messages
   - Check database for validation results:
     ```sql
     SELECT * FROM environmental_validation_results ORDER BY created_at DESC LIMIT 10;
     ```

### Expected Console Output

```
🌍 PHASE 6.5: Environmental Consistency Validation...
📄 Validating page 1 (4 panels)...
🌍 Validating environmental consistency: Page 1 (4 panels, attempt 1/2)
✅ Environmental coherence: 87.5% - PASSED (location: 85%, lighting: 90%, palette: 88%)
✅ Page 1 passed environmental validation (coherence: 87.5%)
📄 Validating page 2 (4 panels)...
🌍 Validating environmental consistency: Page 2 (4 panels, attempt 1/2)
❌ Environmental coherence: 82.3% - FAILED (threshold: 85%)
  Failure reasons: Lighting inconsistent: afternoon lighting with bright mood not maintained (score: 82.0%)
❌ Page 2 failed environmental validation (attempt 1/2)
   Coherence: 82.3% (required: 85%)
   Failure reasons: Lighting inconsistent: afternoon lighting with bright mood not maintained (score: 82.0%)
🔄 Regenerating entire page 2 with enhanced environmental prompts (attempt 2/2)...
   ✓ Regenerated panel 1/4 on page 2
   ✓ Regenerated panel 2/4 on page 2
   ✓ Regenerated panel 3/4 on page 2
   ✓ Regenerated panel 4/4 on page 2
🔄 Page 2 regenerated, will revalidate...
🌍 Validating environmental consistency: Page 2 (4 panels, attempt 2/2)
✅ Environmental coherence: 88.2% - PASSED (location: 87%, lighting: 89%, palette: 89%)
✅ Page 2 passed environmental validation (coherence: 88.2%)
✅ Environmental consistency validation complete for 2 pages
```

## Database Queries for Monitoring

### Check Recent Validations
```sql
SELECT
  job_id,
  page_number,
  overall_coherence,
  passes_threshold,
  attempt_number,
  regeneration_triggered,
  validation_timestamp
FROM environmental_validation_results
ORDER BY validation_timestamp DESC
LIMIT 20;
```

### Check Failed Validations
```sql
SELECT
  job_id,
  page_number,
  overall_coherence,
  failure_reasons,
  attempt_number
FROM environmental_validation_results
WHERE passes_threshold = false
ORDER BY validation_timestamp DESC;
```

### Check Validation Statistics
```sql
SELECT
  COUNT(*) as total_validations,
  COUNT(*) FILTER (WHERE passes_threshold = true) as passed,
  COUNT(*) FILTER (WHERE passes_threshold = false) as failed,
  AVG(overall_coherence) as avg_coherence,
  AVG(attempt_number) as avg_attempts
FROM environmental_validation_results;
```

## Error Scenarios

### Scenario 1: Validation Passes Immediately
- Page validated on first attempt
- Single database record with `attempt_number = 1`, `passes_threshold = true`
- No regeneration triggered

### Scenario 2: Validation Fails, Then Passes After Regeneration
- First validation fails (coherence < 85%)
- Database record: `attempt_number = 1`, `passes_threshold = false`, `regeneration_triggered = true`
- Entire page regenerated with enhanced prompts
- Second validation passes
- Database record: `attempt_number = 2`, `passes_threshold = true`, `regeneration_triggered = false`

### Scenario 3: Validation Fails After Max Attempts
- First validation fails
- Database record: `attempt_number = 1`, `regeneration_triggered = true`
- Page regenerated
- Second validation fails
- Database record: `attempt_number = 2`, `regeneration_triggered = false`
- **Job fails completely** with detailed error message
- User sees error in job status

### Scenario 4: Vision API Unavailable
- Vision API returns 500/503 or times out
- Validator detects API unavailability
- Returns fallback report with `overallCoherence = -1`, `passesThreshold = true`
- **Job continues** without failing
- Warning logged: "GPT-4 Vision API unavailable, marking as unvalidated"

## Cost Estimation

### API Costs
- GPT-4o Vision API: ~$0.02-0.04 per page (4 images analyzed together)
- Typical 4-page comic = ~$0.08-0.16 per storybook (first validation)
- With regeneration: +$0.02-0.04 per regenerated page
- Worst case (all pages regenerated twice): ~$0.24-0.48 per storybook

### Database Storage
- ~500 bytes per validation record
- 1000 validations = ~0.5 MB
- Negligible storage cost

## Monitoring and Alerts

### Recommended Metrics to Track
1. **Validation pass rate:** Percentage of pages passing on first attempt
2. **Average coherence score:** Across all validations
3. **Regeneration rate:** Percentage of pages requiring regeneration
4. **API failure rate:** How often Vision API is unavailable
5. **Cost per job:** Total validation API cost

### Alert Thresholds
- ⚠️ Warning: Pass rate < 80%
- 🚨 Critical: Pass rate < 60%
- ⚠️ Warning: API failure rate > 5%
- 🚨 Critical: API failure rate > 20%

## Summary

This integration adds robust environmental consistency validation with:
- ✅ Page-by-page batch validation (2-4 panels at once)
- ✅ Automatic page regeneration on failure (max 2 attempts)
- ✅ Enhanced prompts emphasizing failed aspects
- ✅ Database persistence of all validation results
- ✅ Graceful degradation on API failures
- ✅ Fail-fast behavior after max attempts
- ✅ Clear logging and progress updates
- ✅ Comprehensive error handling

The validator **detects and reports** failures.
The job processor **catches and handles** failures through regeneration.
