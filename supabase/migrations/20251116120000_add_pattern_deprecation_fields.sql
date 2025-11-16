/*
  # Add Pattern Deprecation Fields

  1. Changes
    - Add `is_deprecated` boolean field to success_patterns table
    - Add `deprecation_reason` text field to store deprecation rationale
    - Add `deprecation_date` timestamp field to track when deprecated
    - Add index on is_deprecated for efficient filtering

  2. Purpose
    - Enable soft deletion of low-performing patterns
    - Track pattern lifecycle and quality degradation
    - Support automatic pattern cleanup and maintenance
    - Preserve historical pattern data for analysis

  3. Notes
    - Default is_deprecated to false for all existing patterns
    - Deprecation is reversible by setting flag back to false
    - Queries should filter WHERE is_deprecated = false for active patterns
*/

-- Add deprecation fields to success_patterns table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'success_patterns' AND column_name = 'is_deprecated'
  ) THEN
    ALTER TABLE success_patterns ADD COLUMN is_deprecated boolean DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'success_patterns' AND column_name = 'deprecation_reason'
  ) THEN
    ALTER TABLE success_patterns ADD COLUMN deprecation_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'success_patterns' AND column_name = 'deprecation_date'
  ) THEN
    ALTER TABLE success_patterns ADD COLUMN deprecation_date timestamptz;
  END IF;
END $$;

-- Create index for efficient filtering of active patterns
CREATE INDEX IF NOT EXISTS idx_success_patterns_is_deprecated
  ON success_patterns(is_deprecated)
  WHERE is_deprecated = false;

-- Create composite index for active pattern queries
CREATE INDEX IF NOT EXISTS idx_success_patterns_active_effectiveness
  ON success_patterns(is_deprecated, effectiveness_score DESC)
  WHERE is_deprecated = false;

-- Add comment to document deprecation workflow
COMMENT ON COLUMN success_patterns.is_deprecated IS 'Soft delete flag for low-performing patterns. Active patterns have is_deprecated = false.';
COMMENT ON COLUMN success_patterns.deprecation_reason IS 'Explanation for why pattern was deprecated (e.g., "Low effectiveness", "Poor success rate", "Unused")';
COMMENT ON COLUMN success_patterns.deprecation_date IS 'Timestamp when pattern was deprecated for tracking and analysis';
