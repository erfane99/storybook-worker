/*
  # OpenAI Retry Metrics Tracking System

  ## Overview
  Comprehensive tracking system for OpenAI API retry attempts, error patterns, and performance metrics.
  This enables intelligent retry optimization and operational monitoring.

  ## New Tables

  ### `openai_retry_metrics`
  Stores individual retry attempt records for analysis and optimization.

  **Columns:**
  - `id` (uuid, primary key): Unique identifier for each retry record
  - `operation_name` (text): Name of the OpenAI operation (e.g., 'generateTextCompletion', 'generateCartoonImage')
  - `error_type` (text): Type of error encountered (e.g., 'AIRateLimitError', 'AITimeoutError')
  - `error_message` (text): Human-readable error message
  - `http_status` (integer, nullable): HTTP status code if available
  - `attempt_number` (integer): Which retry attempt (1-5)
  - `max_attempts` (integer): Maximum attempts configured for this operation
  - `delay_ms` (integer): Delay in milliseconds before this retry
  - `duration_ms` (integer): How long this attempt took
  - `success` (boolean): Whether this attempt succeeded
  - `total_retry_duration_ms` (integer): Cumulative retry time across all attempts
  - `circuit_breaker_state` (text): State of circuit breaker ('closed', 'open', 'half-open')
  - `retry_strategy` (text): Strategy used (e.g., 'exponential_backoff_with_jitter')
  - `endpoint` (text): OpenAI API endpoint called
  - `created_at` (timestamptz): When this retry attempt occurred

  ### `openai_retry_analytics`
  Aggregated analytics for monitoring and optimization.

  **Columns:**
  - `id` (uuid, primary key): Unique identifier
  - `operation_name` (text): Operation being analyzed
  - `error_type` (text): Type of error
  - `time_window_start` (timestamptz): Start of aggregation window
  - `time_window_end` (timestamptz): End of aggregation window
  - `total_attempts` (integer): Total retry attempts in window
  - `successful_retries` (integer): How many retries eventually succeeded
  - `failed_retries` (integer): How many exhausted all attempts
  - `average_delay_ms` (integer): Average delay between retries
  - `average_duration_ms` (integer): Average operation duration
  - `max_duration_ms` (integer): Longest operation duration
  - `success_rate_percentage` (numeric): Percentage of successful retries
  - `most_common_http_status` (integer, nullable): Most frequent HTTP error
  - `created_at` (timestamptz): When this analytics record was created
  - `updated_at` (timestamptz): Last update timestamp

  ## Security
  - RLS enabled on all tables
  - Service role access for background job processing
  - Authenticated users can read their own metrics (future: add user_id column)

  ## Indexes
  - Performance indexes on frequently queried columns
  - Composite indexes for common query patterns
  - Time-based indexes for analytics queries

  ## Notes
  - Metrics are batched: inserted every 5 minutes OR every 100 operations
  - Old metrics (>90 days) should be archived/deleted periodically
  - Analytics aggregation runs daily via background job
*/

-- =====================================================
-- TABLE: openai_retry_metrics
-- =====================================================

CREATE TABLE IF NOT EXISTS openai_retry_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_name text NOT NULL,
  error_type text NOT NULL,
  error_message text,
  http_status integer,
  attempt_number integer NOT NULL CHECK (attempt_number >= 1),
  max_attempts integer NOT NULL CHECK (max_attempts >= 1),
  delay_ms integer NOT NULL CHECK (delay_ms >= 0),
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  success boolean NOT NULL DEFAULT false,
  total_retry_duration_ms integer NOT NULL CHECK (total_retry_duration_ms >= 0),
  circuit_breaker_state text NOT NULL DEFAULT 'closed' CHECK (circuit_breaker_state IN ('closed', 'open', 'half-open')),
  retry_strategy text NOT NULL DEFAULT 'exponential_backoff_with_jitter',
  endpoint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_retry_metrics_operation_name ON openai_retry_metrics(operation_name);
CREATE INDEX IF NOT EXISTS idx_retry_metrics_error_type ON openai_retry_metrics(error_type);
CREATE INDEX IF NOT EXISTS idx_retry_metrics_created_at ON openai_retry_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retry_metrics_success ON openai_retry_metrics(success);
CREATE INDEX IF NOT EXISTS idx_retry_metrics_composite ON openai_retry_metrics(operation_name, error_type, created_at DESC);

-- Enable RLS
ALTER TABLE openai_retry_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything (for background jobs)
CREATE POLICY "Service role full access to retry metrics"
  ON openai_retry_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can read all metrics (for analytics dashboard)
CREATE POLICY "Authenticated users can read retry metrics"
  ON openai_retry_metrics
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- TABLE: openai_retry_analytics
-- =====================================================

CREATE TABLE IF NOT EXISTS openai_retry_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_name text NOT NULL,
  error_type text NOT NULL,
  time_window_start timestamptz NOT NULL,
  time_window_end timestamptz NOT NULL,
  total_attempts integer NOT NULL DEFAULT 0 CHECK (total_attempts >= 0),
  successful_retries integer NOT NULL DEFAULT 0 CHECK (successful_retries >= 0),
  failed_retries integer NOT NULL DEFAULT 0 CHECK (failed_retries >= 0),
  average_delay_ms integer NOT NULL DEFAULT 0 CHECK (average_delay_ms >= 0),
  average_duration_ms integer NOT NULL DEFAULT 0 CHECK (average_duration_ms >= 0),
  max_duration_ms integer NOT NULL DEFAULT 0 CHECK (max_duration_ms >= 0),
  success_rate_percentage numeric(5,2) NOT NULL DEFAULT 0.00 CHECK (success_rate_percentage >= 0 AND success_rate_percentage <= 100),
  most_common_http_status integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_retry_analytics_operation_error ON openai_retry_analytics(operation_name, error_type);
CREATE INDEX IF NOT EXISTS idx_retry_analytics_time_window ON openai_retry_analytics(time_window_start, time_window_end);
CREATE INDEX IF NOT EXISTS idx_retry_analytics_success_rate ON openai_retry_analytics(success_rate_percentage);

-- Enable RLS
ALTER TABLE openai_retry_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Service role full access
CREATE POLICY "Service role full access to retry analytics"
  ON openai_retry_analytics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can read analytics
CREATE POLICY "Authenticated users can read retry analytics"
  ON openai_retry_analytics
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- HELPER FUNCTION: Aggregate retry metrics
-- =====================================================

CREATE OR REPLACE FUNCTION aggregate_retry_metrics(
  p_start_time timestamptz,
  p_end_time timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert aggregated analytics for each operation + error type combination
  INSERT INTO openai_retry_analytics (
    operation_name,
    error_type,
    time_window_start,
    time_window_end,
    total_attempts,
    successful_retries,
    failed_retries,
    average_delay_ms,
    average_duration_ms,
    max_duration_ms,
    success_rate_percentage,
    most_common_http_status
  )
  SELECT
    operation_name,
    error_type,
    p_start_time,
    p_end_time,
    COUNT(*) as total_attempts,
    COUNT(*) FILTER (WHERE success = true) as successful_retries,
    COUNT(*) FILTER (WHERE success = false) as failed_retries,
    AVG(delay_ms)::integer as average_delay_ms,
    AVG(duration_ms)::integer as average_duration_ms,
    MAX(duration_ms) as max_duration_ms,
    CASE
      WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE success = true)::numeric / COUNT(*)::numeric * 100)
      ELSE 0
    END as success_rate_percentage,
    MODE() WITHIN GROUP (ORDER BY http_status) as most_common_http_status
  FROM openai_retry_metrics
  WHERE created_at >= p_start_time AND created_at < p_end_time
  GROUP BY operation_name, error_type
  ON CONFLICT DO NOTHING;
END;
$$;

-- =====================================================
-- HELPER FUNCTION: Cleanup old metrics
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_retry_metrics(
  p_retention_days integer DEFAULT 90
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  -- Delete metrics older than retention period
  DELETE FROM openai_retry_metrics
  WHERE created_at < now() - (p_retention_days || ' days')::interval;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Also cleanup old analytics
  DELETE FROM openai_retry_analytics
  WHERE time_window_end < now() - (p_retention_days || ' days')::interval;

  RETURN v_deleted_count;
END;
$$;
