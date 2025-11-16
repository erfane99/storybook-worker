/*
  # Add Quality Score to Cartoonize Jobs

  1. Changes
    - Add `quality_score` column to `cartoonize_jobs` table (0-100 decimal range)
    - This stores the final quality score from validation
    - Defaults to NULL (unvalidated cartoons)
  
  2. Notes
    - Quality score of 85+ indicates passing validation
    - NULL indicates either no validation or validation was unavailable
    - This allows tracking quality metrics for all cartoonize operations
*/

-- Add quality_score column to cartoonize_jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cartoonize_jobs' AND column_name = 'quality_score'
  ) THEN
    ALTER TABLE cartoonize_jobs 
    ADD COLUMN quality_score decimal(5,2) CHECK (quality_score >= 0 AND quality_score <= 100);
  END IF;
END $$;

-- Create index for quality analytics
CREATE INDEX IF NOT EXISTS idx_cartoonize_jobs_quality_score
  ON cartoonize_jobs(quality_score) WHERE quality_score IS NOT NULL;
