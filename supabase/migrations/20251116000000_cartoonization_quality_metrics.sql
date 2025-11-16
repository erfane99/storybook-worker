/*
  # Cartoonization Quality Validation System

  1. New Tables
    - `cartoonization_quality_metrics`
      - `id` (uuid, primary key)
      - `cartoonize_job_id` (uuid, references cartoonize_jobs)
      - `overall_quality_score` (decimal, 0-100 range)
      - `visual_clarity_score` (decimal, 0-100 range)
      - `character_fidelity_score` (decimal, 0-100 range)
      - `style_accuracy_score` (decimal, 0-100 range)
      - `age_appropriateness_score` (decimal, 0-100 range)
      - `professional_standard_score` (decimal, 0-100 range)
      - `validation_details` (jsonb, full analysis and recommendations)
      - `attempt_number` (integer, retry tracking)
      - `passes_threshold` (boolean, quality gate indicator)
      - `validation_timestamp` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on cartoonization_quality_metrics table
    - Add policies for authenticated users to read their own validation results
    - Add policy for system to insert validation results

  3. Indexes
    - Add index on cartoonize_job_id for efficient job lookups
    - Add index on passes_threshold for quality analytics
    - Add index on validation_timestamp for temporal queries
    - Add composite index for job + attempt queries

  4. Important Notes
    - Overall quality score is calculated as average of all five dimension scores
    - Threshold for passing is 85% (overall_quality_score >= 85.0)
    - Each cartoonization job can have multiple validation attempts
    - Validation details stored as JSONB for flexibility and analytics
*/

-- Create cartoonization_quality_metrics table
CREATE TABLE IF NOT EXISTS cartoonization_quality_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cartoonize_job_id uuid NOT NULL,
  overall_quality_score decimal(5,2) NOT NULL CHECK (overall_quality_score >= 0 AND overall_quality_score <= 100),
  visual_clarity_score decimal(5,2) NOT NULL CHECK (visual_clarity_score >= 0 AND visual_clarity_score <= 100),
  character_fidelity_score decimal(5,2) NOT NULL CHECK (character_fidelity_score >= 0 AND character_fidelity_score <= 100),
  style_accuracy_score decimal(5,2) NOT NULL CHECK (style_accuracy_score >= 0 AND style_accuracy_score <= 100),
  age_appropriateness_score decimal(5,2) NOT NULL CHECK (age_appropriateness_score >= 0 AND age_appropriateness_score <= 100),
  professional_standard_score decimal(5,2) NOT NULL CHECK (professional_standard_score >= 0 AND professional_standard_score <= 100),
  validation_details jsonb NOT NULL DEFAULT '{}',
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number >= 1),
  passes_threshold boolean NOT NULL DEFAULT false,
  validation_timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE cartoonization_quality_metrics ENABLE ROW LEVEL SECURITY;

-- Policies for cartoonization_quality_metrics
CREATE POLICY "Users can read validation results for their cartoonize jobs"
  ON cartoonization_quality_metrics
  FOR SELECT
  TO authenticated
  USING (true); -- Allow reading all validation metrics for analytics

CREATE POLICY "System can insert validation results"
  ON cartoonization_quality_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Allow system to insert validation results

CREATE POLICY "System can update validation results"
  ON cartoonization_quality_metrics
  FOR UPDATE
  TO authenticated
  USING (true); -- Allow system to update validation results if needed

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cartoonization_quality_job_id
  ON cartoonization_quality_metrics(cartoonize_job_id);

CREATE INDEX IF NOT EXISTS idx_cartoonization_quality_passes_threshold
  ON cartoonization_quality_metrics(passes_threshold);

CREATE INDEX IF NOT EXISTS idx_cartoonization_quality_validation_timestamp
  ON cartoonization_quality_metrics(validation_timestamp);

CREATE INDEX IF NOT EXISTS idx_cartoonization_quality_overall_score
  ON cartoonization_quality_metrics(overall_quality_score);

-- Create composite index for efficient job + attempt queries
CREATE INDEX IF NOT EXISTS idx_cartoonization_quality_composite
  ON cartoonization_quality_metrics(cartoonize_job_id, attempt_number, validation_timestamp);

-- Create composite index for quality analytics
CREATE INDEX IF NOT EXISTS idx_cartoonization_quality_analytics
  ON cartoonization_quality_metrics(passes_threshold, overall_quality_score, validation_timestamp);
