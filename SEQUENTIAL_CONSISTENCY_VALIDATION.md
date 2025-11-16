# Sequential Consistency Validator

## Overview

The Sequential Consistency Validator ensures that consecutive comic book panels maintain visual consistency and natural flow across all visual dimensions. This validator uses GPT-4 Vision to compare two consecutive panels and score their continuity across 6 key dimensions.

## Location

```
src/services/ai/modular/sequential-consistency-validator.ts
```

## Features

- **6-Dimension Sequential Analysis**: Character, environment, lighting, color palette, art style, and spatial logic
- **GPT-4 Vision Integration**: Dual-image comparison in a single API call
- **Threshold Enforcement**: 85% pass threshold, 70-84% warning range, <70% failure
- **Critical Failure Detection**: Automatic detection of severe discontinuities
- **Database Persistence**: All validation results stored with full scoring breakdown
- **Batch Validation**: Validate entire pages with multiple panel transitions
- **Enhanced Prompting**: Automatic regeneration guidance with specific continuity requirements
- **Graceful Degradation**: Non-blocking when Vision API unavailable

## Validation Dimensions

### 1. Character Continuity (0-100)
- Same character appearance between panels
- Consistent facial features, hair, clothing
- Body proportions match
- Only pose/expression should change

### 2. Environmental Continuity (0-100)
- Same location if applicable
- Background elements consistent
- No disappearing objects
- Architectural consistency

### 3. Lighting Consistency (0-100)
- Light source direction unchanged
- Lighting mood maintained
- Time of day consistent
- Shadow direction preserved

### 4. Color Palette Consistency (0-100)
- Same colors used throughout
- Color temperature consistent
- No jarring color shifts

### 5. Art Style Consistency (0-100)
- Artistic style identical
- Line weights consistent
- Detail level similar
- Rendering approach unchanged

### 6. Spatial Logic (0-100)
- Camera movement makes sense
- Spatial relationships preserved
- Natural panel-to-panel flow

## Scoring Thresholds

- **85-100%**: PASS - Perfect or excellent sequential consistency
- **70-84%**: WARNING - Noticeable but acceptable inconsistencies (logged but continues)
- **0-69%**: FAIL - Significant discontinuities (triggers regeneration)

### Critical Failure Conditions (Immediate Fail)

- Character continuity < 80%
- Art style consistency < 75%
- Any individual dimension < 60%

## Usage

### Basic Sequential Validation

```typescript
import { SequentialConsistencyValidator } from './sequential-consistency-validator';
import { OpenAIIntegration } from './openai-integration';

const validator = new SequentialConsistencyValidator(
  openaiIntegration,
  databaseService,
  errorHandler,
  logger
);

// Validate two consecutive panels
const context = {
  jobId: 'job-123',
  previousPanelNumber: 1,
  currentPanelNumber: 2,
  previousPanelUrl: 'https://storage.example.com/panel-1.png',
  currentPanelUrl: 'https://storage.example.com/panel-2.png'
};

try {
  const report = await validator.validateSequentialConsistency(context);

  if (report.passesThreshold) {
    console.log(`✅ Sequential consistency: ${report.overallScore}%`);
  } else {
    console.log(`❌ Failed: ${report.discontinuities.join(', ')}`);
  }
} catch (error) {
  if (error instanceof SequentialValidationError) {
    // Handle regeneration
    console.log('Regenerating panel with enhanced continuity prompt...');
  }
}
```

### Page-Level Batch Validation

```typescript
// Validate all transitions on a 4-panel page
const pageResult = await validator.validatePageSequentialConsistency(
  'job-123',
  1, // page number
  [
    'https://storage.example.com/panel-1.png',
    'https://storage.example.com/panel-2.png',
    'https://storage.example.com/panel-3.png',
    'https://storage.example.com/panel-4.png'
  ]
);

console.log(`Page consistency: ${pageResult.overallPageConsistency}%`);
console.log(`Failed transitions: ${pageResult.failedTransitions.length}`);

// Check each sequential transition
pageResult.sequentialChecks.forEach(check => {
  console.log(`Panel ${check.previousPanelNumber}→${check.currentPanelNumber}: ${check.overallScore}%`);
});
```

### Enhanced Continuity Prompting

```typescript
// Build enhanced prompt for regeneration
const enhancedPrompt = validator.buildEnhancedContinuityPrompt(
  'A young hero standing in a forest clearing, wearing blue cape',
  1, // previous panel number
  2, // current panel number
  ['Character appearance inconsistent', 'Lighting direction changed']
);

// Use enhanced prompt for regeneration
// (This would be integrated into your panel generation flow)
```

## Integration with Comic Generation

### Integration Point

The validator should be called after individual panel validation, during the panel generation loop:

```typescript
// In comic-generation-engine.ts
async generatePanelsForPage(pageBeats, characterDNA, environmentalDNA, config, artStyle, pageNumber, totalPanels) {
  const panels = [];

  for (let i = 0; i < pageBeats.length; i++) {
    const panel = await this.generatePanel(pageBeats[i], characterDNA, environmentalDNA);

    // Individual validation
    await this.visualConsistencyValidator.validateCharacterConsistency(panel.imageUrl, characterDNA, context);

    // Sequential validation (if not first panel)
    if (i > 0 && panels[i - 1]) {
      const sequentialContext = {
        jobId: context.jobId,
        previousPanelNumber: i,
        currentPanelNumber: i + 1,
        previousPanelUrl: panels[i - 1].imageUrl,
        currentPanelUrl: panel.imageUrl
      };

      try {
        await this.sequentialValidator.validateSequentialConsistency(sequentialContext);
      } catch (error) {
        if (error instanceof SequentialValidationError) {
          // Regenerate panel with enhanced continuity prompt
          const enhancedPrompt = this.sequentialValidator.buildEnhancedContinuityPrompt(
            panels[i - 1].description,
            i,
            i + 1,
            error.discontinuities
          );

          // Retry generation with enhanced prompt
          panel = await this.regeneratePanelWithContinuity(pageBeats[i], characterDNA, environmentalDNA, enhancedPrompt);
        }
      }
    }

    panels.push(panel);
  }

  return panels;
}
```

## Database Schema

The validator stores results in the `panel_validation_results` table with these sequential-specific fields:

```sql
CREATE TABLE panel_validation_results (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL,
  panel_number integer NOT NULL,
  previous_panel_number integer,  -- NEW: Reference to previous panel

  -- Sequential scores
  sequential_consistency_score integer,  -- NEW: Overall sequential score
  character_continuity_score integer,    -- NEW: Character continuity
  environmental_continuity_score integer, -- NEW: Environmental continuity
  lighting_consistency_score integer,     -- NEW: Lighting consistency
  spatial_logic_score integer,            -- NEW: Spatial logic score
  discontinuities_found jsonb,            -- NEW: Array of discontinuities

  -- Standard fields
  overall_score integer,
  detailed_analysis text,
  passes_threshold boolean,
  attempt_number integer,
  validation_timestamp timestamptz,
  created_at timestamptz
);
```

### Indexes

- `idx_panel_validation_sequential_lookup` - Fast lookups by job and panel numbers
- `idx_panel_validation_sequential_score` - Performance queries on scores
- `idx_panel_validation_sequential_failures` - Quick access to failed validations

## Error Handling

### SequentialValidationError

Thrown when sequential consistency falls below threshold:

```typescript
export class SequentialValidationError extends BaseServiceError {
  public consistencyScore: number;
  public discontinuities: string[];
  public previousPanelNumber: number;
  public currentPanelNumber: number;
}
```

### Graceful Degradation

When Vision API is unavailable, the validator returns a passing report with -1 scores to allow the job to continue:

```typescript
{
  overallScore: -1,  // Special marker for unvalidated
  characterContinuity: -1,
  // ... all dimensions -1
  passesThreshold: true,  // Don't block job due to API issues
  discontinuities: ['Vision API unavailable']
}
```

## Logging

The validator uses structured logging with emoji prefixes:

- `🔗` - Starting sequential validation
- `✅` - Validation passed
- `⚠️` - Warning (score 70-84%)
- `❌` - Validation failed
- `💾` - Database storage

Example logs:

```
🔗 Validating sequential: Panel 1 → 2 (attempt 1/2)
✅ Sequential consistency: 92.3% (character: 95%, environment: 90%, lighting: 93%)

🔗 Validating sequential: Panel 2 → 3 (attempt 1/2)
❌ Sequential failed: Panel 2→3 (score: 68.5%)
   Discontinuities: Character clothing changed, Lighting direction inconsistent
```

## Performance

- **API Calls**: 1 Vision API call per panel pair
- **Timeout**: 180 seconds (3 minutes)
- **Retry Logic**: 3 attempts with exponential backoff
- **Parallel Processing**: Page-level validation runs transitions in parallel
- **Database**: Non-blocking storage (failures don't stop validation)

## Validation Report Structure

```typescript
interface SequentialConsistencyReport {
  overallScore: number;              // 0-100 average of all dimensions
  characterContinuity: number;       // Character appearance consistency
  environmentalContinuity: number;   // Location/background consistency
  lightingConsistency: number;       // Lighting/shadows consistency
  colorPaletteConsistency: number;   // Color scheme consistency
  artStyleConsistency: number;       // Artistic style consistency
  spatialLogic: number;              // Camera/spatial flow logic
  detailedAnalysis: string;          // GPT-4 Vision's detailed explanation
  discontinuities: string[];         // Specific issues found
  passesThreshold: boolean;          // true if >= 85%
  previousPanelNumber: number;       // Reference panel
  currentPanelNumber: number;        // Validated panel
}
```

## Best Practices

1. **Always validate sequential after individual validation**: Ensure each panel is individually valid before checking sequential consistency

2. **Use enhanced prompts on retry**: The `buildEnhancedContinuityPrompt` method creates targeted guidance based on specific failures

3. **Limit regeneration attempts**: Maximum 2 regeneration attempts per specification (attempt 1 + 2 retries)

4. **Accept with warning after max attempts**: If still failing after max attempts, log warning and continue to avoid infinite loops

5. **Batch validate pages**: Use `validatePageSequentialConsistency` for efficiency when validating entire pages

6. **Monitor discontinuities**: Track common discontinuity patterns to improve base prompts

7. **Handle API unavailability**: Always check for graceful degradation (-1 scores) in your workflow

## Testing

See `src/validation/test-scenarios.ts` for test scenarios including:

- Perfect sequential consistency (95%+ scores)
- Marginal consistency (85-90% scores)
- Sequential failures (character changes, lighting shifts)
- Critical failures (severe discontinuities)
- Vision API unavailability

## Troubleshooting

### High Failure Rate

- Review base prompts for character/environmental DNA specificity
- Check if Vision API responses are being parsed correctly
- Verify image URLs are accessible and valid
- Ensure previous panel descriptions are accurate

### Parse Errors

- Vision API may return non-JSON responses under heavy load
- Check raw response logging for debugging
- Fallback parser returns 0 scores (pessimistic but safe)

### Performance Issues

- Validate pages in parallel when possible
- Consider caching previous panel metadata
- Monitor Vision API timeout settings
- Use batch validation for entire pages

## Future Enhancements

- Machine learning pattern detection for common discontinuities
- Automatic prompt adaptation based on failure patterns
- Progressive validation (skip if high confidence)
- Visual diff highlighting specific discontinuity regions
- Integration with pattern learning engine for continuous improvement
