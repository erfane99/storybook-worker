/*
  # Quality Measurement System Database Schema

  1. New Tables
    - `comic_quality_metrics`
      - `id` (uuid, primary key)
      - `comic_id` (uuid, references storybook_entries)
      - `automated_scores` (jsonb, automated quality analysis)
      - `generation_metrics` (jsonb, performance metrics)
      - `created_at` (timestamp)
    
    - `user_ratings`
      - `id` (uuid, primary key)
      - `comic_id` (uuid, references storybook_entries)
      - `user_id` (uuid, references auth.users)
      - `ratings` (jsonb, 5-category rating system)
      - `average_rating` (decimal, calculated average)
      - `comment` (text, optional feedback)
      - `rating_date` (timestamp)
      - `time_spent_reading` (integer, seconds)
      - `would_recommend` (boolean)
    
    - `quality_trends`
      - `id` (uuid, primary key)
      - `timeframe` (text, e.g., 'daily', 'weekly', 'monthly')
      - `period_start` (timestamp)
      - `period_end` (timestamp)
      - `average_scores` (jsonb, aggregated quality scores)
      - `total_comics_analyzed` (integer)
      - `quality_distribution` (jsonb, grade distribution)
      - `improvement_rate` (decimal)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to read/write their own data
    - Add policies for quality analysis access

  3. Indexes
    - Add indexes for efficient quality queries
    - Add composite indexes for trend analysis
*/

-- Create comic_quality_metrics table
CREATE TABLE IF NOT EXISTS comic_quality_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comic_id uuid NOT NULL REFERENCES storybook_entries(id) ON DELETE CASCADE,
  automated_scores jsonb NOT NULL DEFAULT '{}',
  generation_metrics jsonb NOT NULL DEFAULT '{}',
  quality_grade text CHECK (quality_grade IN ('A', 'B', 'C', 'D', 'F')),
  overall_technical_quality decimal(5,2) CHECK (overall_technical_quality >= 0 AND overall_technical_quality <= 100),
  character_consistency_score decimal(5,2) CHECK (character_consistency_score >= 0 AND character_consistency_score <= 100),
  environmental_coherence_score decimal(5,2) CHECK (environmental_coherence_score >= 0 AND environmental_coherence_score <= 100),
  narrative_flow_score decimal(5,2) CHECK (narrative_flow_score >= 0 AND narrative_flow_score <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_ratings table
CREATE TABLE IF NOT EXISTS user_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comic_id uuid NOT NULL REFERENCES storybook_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ratings jsonb NOT NULL DEFAULT '{}',
  character_consistency_rating integer CHECK (character_consistency_rating >= 1 AND character_consistency_rating <= 5),
  story_flow_narrative_rating integer CHECK (story_flow_narrative_rating >= 1 AND story_flow_narrative_rating <= 5),
  art_quality_visual_appeal_rating integer CHECK (art_quality_visual_appeal_rating >= 1 AND art_quality_visual_appeal_rating <= 5),
  scene_background_consistency_rating integer CHECK (scene_background_consistency_rating >= 1 AND scene_background_consistency_rating <= 5),
  overall_comic_experience_rating integer CHECK (overall_comic_experience_rating >= 1 AND overall_comic_experience_rating <= 5),
  average_rating decimal(3,2) CHECK (average_rating >= 1.0 AND average_rating <= 5.0),
  comment text,
  rating_date timestamptz DEFAULT now(),
  time_spent_reading integer DEFAULT 0, -- seconds
  would_recommend boolean DEFAULT null,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(comic_id, user_id) -- One rating per user per comic
);

-- Create quality_trends table
CREATE TABLE IF NOT EXISTS quality_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeframe text NOT NULL CHECK (timeframe IN ('daily', 'weekly', 'monthly', 'quarterly')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  average_scores jsonb NOT NULL DEFAULT '{}',
  technical_score_avg decimal(5,2) CHECK (technical_score_avg >= 0 AND technical_score_avg <= 100),
  user_satisfaction_avg decimal(3,2) CHECK (user_satisfaction_avg >= 1.0 AND user_satisfaction_avg <= 5.0),
  combined_quality_score decimal(5,2) CHECK (combined_quality_score >= 0 AND combined_quality_score <= 100),
  total_comics_analyzed integer DEFAULT 0,
  quality_distribution jsonb NOT NULL DEFAULT '{}',
  improvement_rate decimal(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(timeframe, period_start, period_end)
);

-- Enable Row Level Security
ALTER TABLE comic_quality_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_trends ENABLE ROW LEVEL SECURITY;

-- Policies for comic_quality_metrics
CREATE POLICY "Users can read quality metrics for their comics"
  ON comic_quality_metrics
  FOR SELECT
  TO authenticated
  USING (
    comic_id IN (
      SELECT id FROM storybook_entries 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert quality metrics"
  ON comic_quality_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Allow system to insert quality metrics

CREATE POLICY "Users can update quality metrics for their comics"
  ON comic_quality_metrics
  FOR UPDATE
  TO authenticated
  USING (
    comic_id IN (
      SELECT id FROM storybook_entries 
      WHERE user_id = auth.uid()
    )
  );

-- Policies for user_ratings
CREATE POLICY "Users can read all ratings"
  ON user_ratings
  FOR SELECT
  TO authenticated
  USING (true); -- Allow reading all ratings for analytics

CREATE POLICY "Users can insert their own ratings"
  ON user_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own ratings"
  ON user_ratings
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own ratings"
  ON user_ratings
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Policies for quality_trends
CREATE POLICY "Users can read quality trends"
  ON quality_trends
  FOR SELECT
  TO authenticated
  USING (true); -- Allow reading trends for analytics

CREATE POLICY "System can manage quality trends"
  ON quality_trends
  FOR ALL
  TO authenticated
  USING (true); -- Allow system to manage trends

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_comic_quality_metrics_comic_id ON comic_quality_metrics(comic_id);
CREATE INDEX IF NOT EXISTS idx_comic_quality_metrics_quality_grade ON comic_quality_metrics(quality_grade);
CREATE INDEX IF NOT EXISTS idx_comic_quality_metrics_created_at ON comic_quality_metrics(created_at);

CREATE INDEX IF NOT EXISTS idx_user_ratings_comic_id ON user_ratings(comic_id);
CREATE INDEX IF NOT EXISTS idx_user_ratings_user_id ON user_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ratings_average_rating ON user_ratings(average_rating);
CREATE INDEX IF NOT EXISTS idx_user_ratings_rating_date ON user_ratings(rating_date);

CREATE INDEX IF NOT EXISTS idx_quality_trends_timeframe ON quality_trends(timeframe);
CREATE INDEX IF NOT EXISTS idx_quality_trends_period ON quality_trends(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_quality_trends_technical_score ON quality_trends(technical_score_avg);

-- Create composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_comic_quality_composite ON comic_quality_metrics(quality_grade, overall_technical_quality, created_at);
CREATE INDEX IF NOT EXISTS idx_user_ratings_composite ON user_ratings(comic_id, average_rating, rating_date);

-- Create function to automatically calculate average rating
CREATE OR REPLACE FUNCTION calculate_average_rating()
RETURNS TRIGGER AS $$
BEGIN
  NEW.average_rating := (
    COALESCE(NEW.character_consistency_rating, 0) +
    COALESCE(NEW.story_flow_narrative_rating, 0) +
    COALESCE(NEW.art_quality_visual_appeal_rating, 0) +
    COALESCE(NEW.scene_background_consistency_rating, 0) +
    COALESCE(NEW.overall_comic_experience_rating, 0)
  ) / 5.0;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate average rating
DROP TRIGGER IF EXISTS trigger_calculate_average_rating ON user_ratings;
CREATE TRIGGER trigger_calculate_average_rating
  BEFORE INSERT OR UPDATE ON user_ratings
  FOR EACH ROW
  EXECUTE FUNCTION calculate_average_rating();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS trigger_update_comic_quality_metrics_updated_at ON comic_quality_metrics;
CREATE TRIGGER trigger_update_comic_quality_metrics_updated_at
  BEFORE UPDATE ON comic_quality_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_quality_trends_updated_at ON quality_trends;
CREATE TRIGGER trigger_update_quality_trends_updated_at
  BEFORE UPDATE ON quality_trends
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();