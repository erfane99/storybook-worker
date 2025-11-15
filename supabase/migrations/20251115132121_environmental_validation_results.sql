/*
  # Environmental Validation Results Table

  1. Overview
    This migration creates a table to store environmental consistency validation results
    for comic book page generation. Environmental consistency ensures all panels on a page
    exist in the same visual world with consistent location, lighting, color palette, and
    architectural style.

  2. New Tables
    - `environmental_validation_results`
      - `id` (uuid, primary key) - Unique identifier for validation result
      - `job_id` (uuid, foreign key) - Reference to storybook_jobs table
      - `page_number` (integer) - Which page this validation is for
      - `overall_coherence` (numeric 0-100) - Overall environmental coherence score
      - `location_consistency` (numeric 0-100) - Location recognition score
      - `lighting_consistency` (numeric 0-100) - Lighting consistency score
      - `color_palette_consistency` (numeric 0-100) - Color palette consistency score
      - `architectural_consistency` (numeric 0-100) - Architectural style consistency score
      - `cross_panel_consistency` (numeric 0-100) - Cross-panel consistency score
      - `panel_scores` (jsonb) - Array of per-panel detailed scores
      - `detailed_analysis` (text) - Comprehensive analysis from GPT-4 Vision
      - `failure_reasons` (jsonb) - Array of specific failure reasons if validation failed
      - `passes_threshold` (boolean) - Whether validation passed 85% coherence threshold
      - `validation_timestamp` (timestamptz) - When validation was performed
      - `attempt_number` (integer) - Which regeneration attempt (1-2)
      - `regeneration_triggered` (boolean) - Whether page regeneration was triggered
      - `created_at` (timestamptz) - Record creation timestamp

  3. Security
    - Enable RLS on `environmental_validation_results` table
    - Add policy for service role to insert validation results
    - Add policy for service role to read all validation results

  4. Indexes
    - Index on job_id for fast lookup by job
    - Composite index on job_id and page_number for page-specific lookups
    - Index on validation_timestamp for time-based queries
    - Index on failures for finding validation issues

  5. Important Notes
    - overall_coherence >= 85 means PASS ✅
    - overall_coherence < 85 means FAIL ❌ (triggers page regeneration)
    - Maximum 2 regeneration attempts per page
    - Scores use numeric(5,2) to allow decimal precision (e.g., 87.50)
*/

-- Create environmental_validation_results table
CREATE TABLE IF NOT EXISTS environmental_validation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES storybook_jobs(id) ON DELETE CASCADE,
  page_number integer NOT NULL CHECK (page_number >= 1),
  overall_coherence numeric(5,2) NOT NULL CHECK (overall_coherence >= 0 AND overall_coherence <= 100),
  location_consistency numeric(5,2) NOT NULL CHECK (location_consistency >= 0 AND location_consistency <= 100),
  lighting_consistency numeric(5,2) NOT NULL CHECK (lighting_consistency >= 0 AND lighting_consistency <= 100),
  color_palette_consistency numeric(5,2) NOT NULL CHECK (color_palette_consistency >= 0 AND color_palette_consistency <= 100),
  architectural_consistency numeric(5,2) NOT NULL CHECK (architectural_consistency >= 0 AND architectural_consistency <= 100),
  cross_panel_consistency numeric(5,2) NOT NULL CHECK (cross_panel_consistency >= 0 AND cross_panel_consistency <= 100),
  panel_scores jsonb NOT NULL DEFAULT '[]'::jsonb,
  detailed_analysis text NOT NULL,
  failure_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  passes_threshold boolean NOT NULL,
  validation_timestamp timestamptz NOT NULL DEFAULT now(),
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number >= 1 AND attempt_number <= 2),
  regeneration_triggered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE environmental_validation_results ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can insert environmental validation results
CREATE POLICY "Service role can insert environmental validation"
  ON environmental_validation_results
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Service role can read all environmental validation results
CREATE POLICY "Service role can read environmental validation"
  ON environmental_validation_results
  FOR SELECT
  TO service_role
  USING (true);

-- Create indexes for performance

-- Index for looking up all validation results for a specific job
CREATE INDEX IF NOT EXISTS idx_env_validation_job_id
  ON environmental_validation_results(job_id);

-- Composite index for page-specific queries (most common use case)
CREATE INDEX IF NOT EXISTS idx_env_validation_job_page
  ON environmental_validation_results(job_id, page_number);

-- Index for time-based queries and monitoring
CREATE INDEX IF NOT EXISTS idx_env_validation_timestamp
  ON environmental_validation_results(validation_timestamp DESC);

-- Partial index for finding validation failures (for analysis and debugging)
CREATE INDEX IF NOT EXISTS idx_env_validation_failures
  ON environmental_validation_results(job_id, passes_threshold)
  WHERE passes_threshold = false;

-- Composite index for tracking regeneration attempts
CREATE INDEX IF NOT EXISTS idx_env_validation_attempts
  ON environmental_validation_results(job_id, page_number, attempt_number);
