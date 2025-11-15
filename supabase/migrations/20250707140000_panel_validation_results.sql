/*
  # Panel Validation Results Table

  1. New Tables
    - `panel_validation_results`
      - `id` (uuid, primary key) - Unique identifier for validation result
      - `job_id` (uuid, foreign key) - Reference to jobs table
      - `panel_number` (integer) - Which panel this validation is for
      - `overall_score` (integer) - Overall consistency score 0-100
      - `facial_consistency` (integer) - Facial features consistency score 0-100
      - `body_proportion_consistency` (integer) - Body proportions consistency score 0-100
      - `clothing_consistency` (integer) - Clothing consistency score 0-100
      - `color_palette_consistency` (integer) - Color palette consistency score 0-100
      - `art_style_consistency` (integer) - Art style consistency score 0-100
      - `detailed_analysis` (text) - Detailed analysis from GPT-4 Vision
      - `failure_reasons` (jsonb) - Array of failure reasons if validation failed
      - `passes_threshold` (boolean) - Whether validation passed 90+ threshold
      - `attempt_number` (integer) - Which attempt number this is (1-3)
      - `validation_timestamp` (timestamptz) - When validation was performed
      - `created_at` (timestamptz) - Record creation timestamp

  2. Security
    - Enable RLS on `panel_validation_results` table
    - Add policies for authenticated users to read their own validation results
    - Add policy for service role to insert validation results

  3. Indexes
    - Index on job_id for fast lookup by job
    - Index on validation_timestamp for time-based queries
    - Composite index on job_id and panel_number for panel-specific lookups
*/

-- Create panel_validation_results table
CREATE TABLE IF NOT EXISTS panel_validation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  panel_number integer NOT NULL,
  overall_score integer NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  facial_consistency integer NOT NULL CHECK (facial_consistency >= 0 AND facial_consistency <= 100),
  body_proportion_consistency integer NOT NULL CHECK (body_proportion_consistency >= 0 AND body_proportion_consistency <= 100),
  clothing_consistency integer NOT NULL CHECK (clothing_consistency >= 0 AND clothing_consistency <= 100),
  color_palette_consistency integer NOT NULL CHECK (color_palette_consistency >= 0 AND color_palette_consistency <= 100),
  art_style_consistency integer NOT NULL CHECK (art_style_consistency >= 0 AND art_style_consistency <= 100),
  detailed_analysis text NOT NULL,
  failure_reasons jsonb DEFAULT '[]'::jsonb,
  passes_threshold boolean NOT NULL DEFAULT false,
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number >= 1 AND attempt_number <= 3),
  validation_timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE panel_validation_results ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read their own validation results
CREATE POLICY "Users can read own validation results"
  ON panel_validation_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = panel_validation_results.job_id
      AND jobs.user_id = auth.uid()
    )
  );

-- Policy: Service role can insert validation results
CREATE POLICY "Service role can insert validation results"
  ON panel_validation_results
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Service role can read all validation results
CREATE POLICY "Service role can read all validation results"
  ON panel_validation_results
  FOR SELECT
  TO service_role
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_panel_validation_job_id
  ON panel_validation_results(job_id);

CREATE INDEX IF NOT EXISTS idx_panel_validation_timestamp
  ON panel_validation_results(validation_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_panel_validation_job_panel
  ON panel_validation_results(job_id, panel_number);

-- Create index for finding failed validations
CREATE INDEX IF NOT EXISTS idx_panel_validation_failures
  ON panel_validation_results(job_id, passes_threshold)
  WHERE passes_threshold = false;
