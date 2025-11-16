/*
  # Add Sequential Validation Fields to Panel Validation Results

  1. Schema Changes
    - Add `previous_panel_number` (integer) - Reference to previous panel for sequential checks
    - Add `sequential_consistency_score` (integer) - Overall sequential score 0-100
    - Add `character_continuity_score` (integer) - Character continuity between panels
    - Add `environmental_continuity_score` (integer) - Environmental continuity score
    - Add `lighting_consistency_score` (integer) - Lighting consistency score
    - Add `spatial_logic_score` (integer) - Spatial/camera logic score
    - Add `discontinuities_found` (jsonb) - Array of specific discontinuities detected

  2. Indexes
    - Composite index on previous_panel_number and panel_number for sequential lookups
    - Index on sequential_consistency_score for performance queries

  3. Notes
    - All new fields are nullable to maintain backward compatibility
    - Sequential validation fields only populated when validating panel-to-panel consistency
    - Individual panel validation continues to use existing fields
*/

-- Add sequential validation fields
DO $$
BEGIN
  -- Add previous_panel_number if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'panel_validation_results' AND column_name = 'previous_panel_number'
  ) THEN
    ALTER TABLE panel_validation_results
      ADD COLUMN previous_panel_number integer;
  END IF;

  -- Add sequential_consistency_score if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'panel_validation_results' AND column_name = 'sequential_consistency_score'
  ) THEN
    ALTER TABLE panel_validation_results
      ADD COLUMN sequential_consistency_score integer CHECK (sequential_consistency_score IS NULL OR (sequential_consistency_score >= -1 AND sequential_consistency_score <= 100));
  END IF;

  -- Add character_continuity_score if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'panel_validation_results' AND column_name = 'character_continuity_score'
  ) THEN
    ALTER TABLE panel_validation_results
      ADD COLUMN character_continuity_score integer CHECK (character_continuity_score IS NULL OR (character_continuity_score >= -1 AND character_continuity_score <= 100));
  END IF;

  -- Add environmental_continuity_score if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'panel_validation_results' AND column_name = 'environmental_continuity_score'
  ) THEN
    ALTER TABLE panel_validation_results
      ADD COLUMN environmental_continuity_score integer CHECK (environmental_continuity_score IS NULL OR (environmental_continuity_score >= -1 AND environmental_continuity_score <= 100));
  END IF;

  -- Add lighting_consistency_score if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'panel_validation_results' AND column_name = 'lighting_consistency_score'
  ) THEN
    ALTER TABLE panel_validation_results
      ADD COLUMN lighting_consistency_score integer CHECK (lighting_consistency_score IS NULL OR (lighting_consistency_score >= -1 AND lighting_consistency_score <= 100));
  END IF;

  -- Add spatial_logic_score if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'panel_validation_results' AND column_name = 'spatial_logic_score'
  ) THEN
    ALTER TABLE panel_validation_results
      ADD COLUMN spatial_logic_score integer CHECK (spatial_logic_score IS NULL OR (spatial_logic_score >= -1 AND spatial_logic_score <= 100));
  END IF;

  -- Add discontinuities_found if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'panel_validation_results' AND column_name = 'discontinuities_found'
  ) THEN
    ALTER TABLE panel_validation_results
      ADD COLUMN discontinuities_found jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Create composite index for sequential lookups
CREATE INDEX IF NOT EXISTS idx_panel_validation_sequential_lookup
  ON panel_validation_results(job_id, previous_panel_number, panel_number)
  WHERE previous_panel_number IS NOT NULL;

-- Create index on sequential consistency score
CREATE INDEX IF NOT EXISTS idx_panel_validation_sequential_score
  ON panel_validation_results(sequential_consistency_score)
  WHERE sequential_consistency_score IS NOT NULL;

-- Create index for finding sequential validation failures
CREATE INDEX IF NOT EXISTS idx_panel_validation_sequential_failures
  ON panel_validation_results(job_id, previous_panel_number, passes_threshold)
  WHERE previous_panel_number IS NOT NULL AND passes_threshold = false;

-- Add helpful comment
COMMENT ON COLUMN panel_validation_results.previous_panel_number IS 'Reference to previous panel number for sequential validation';
COMMENT ON COLUMN panel_validation_results.sequential_consistency_score IS 'Overall sequential consistency score between consecutive panels (0-100, -1 for unvalidated)';
COMMENT ON COLUMN panel_validation_results.character_continuity_score IS 'Character appearance continuity between panels (0-100, -1 for unvalidated)';
COMMENT ON COLUMN panel_validation_results.environmental_continuity_score IS 'Environmental consistency between panels (0-100, -1 for unvalidated)';
COMMENT ON COLUMN panel_validation_results.lighting_consistency_score IS 'Lighting consistency between panels (0-100, -1 for unvalidated)';
COMMENT ON COLUMN panel_validation_results.spatial_logic_score IS 'Spatial/camera logic score between panels (0-100, -1 for unvalidated)';
COMMENT ON COLUMN panel_validation_results.discontinuities_found IS 'Array of specific discontinuities detected in sequential validation';
