/*
  # Create Learning System Tables

  1. New Tables
    - `success_patterns` - Store successful prompt patterns and contexts
    - `pattern_effectiveness` - Track pattern performance over time
    - `prompt_evolution_log` - Log prompt improvements and changes
  
  2. Security
    - Enable RLS on all learning tables
    - Add policies for system access and user analytics
    
  3. Performance
    - Add indexes for pattern matching and retrieval
    - Optimize for similarity searches and trend analysis
*/

-- Create success_patterns table
CREATE TABLE IF NOT EXISTS success_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type text NOT NULL CHECK (pattern_type IN ('prompt_template', 'environmental_context', 'character_strategy', 'dialogue_pattern')),
  context_signature text NOT NULL, -- Hash of context for matching
  success_criteria jsonb NOT NULL DEFAULT '{}',
  pattern_data jsonb NOT NULL DEFAULT '{}',
  usage_context jsonb NOT NULL DEFAULT '{}',
  quality_scores jsonb NOT NULL DEFAULT '{}',
  user_ratings jsonb NOT NULL DEFAULT '{}',
  effectiveness_score decimal(5,2) CHECK (effectiveness_score >= 0 AND effectiveness_score <= 100),
  usage_count integer DEFAULT 1,
  success_rate decimal(5,2) DEFAULT 100.0,
  audience_type text CHECK (audience_type IN ('children', 'young_adults', 'adults')),
  story_genre text,
  art_style text,
  environmental_setting text,
  character_type text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now()
);

-- Create pattern_effectiveness table
CREATE TABLE IF NOT EXISTS pattern_effectiveness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id uuid NOT NULL REFERENCES success_patterns(id) ON DELETE CASCADE,
  comic_id uuid NOT NULL REFERENCES storybook_entries(id) ON DELETE CASCADE,
  application_context jsonb NOT NULL DEFAULT '{}',
  quality_improvement jsonb NOT NULL DEFAULT '{}',
  before_scores jsonb NOT NULL DEFAULT '{}',
  after_scores jsonb NOT NULL DEFAULT '{}',
  user_satisfaction_impact decimal(3,2),
  technical_quality_impact decimal(5,2),
  effectiveness_rating decimal(5,2) CHECK (effectiveness_rating >= 0 AND effectiveness_rating <= 100),
  adaptation_notes text,
  created_at timestamptz DEFAULT now()
);

-- Create prompt_evolution_log table
CREATE TABLE IF NOT EXISTS prompt_evolution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evolution_type text NOT NULL CHECK (evolution_type IN ('pattern_integration', 'template_enhancement', 'context_adaptation', 'quality_optimization')),
  original_prompt text NOT NULL,
  evolved_prompt text NOT NULL,
  improvement_rationale text NOT NULL,
  patterns_applied jsonb NOT NULL DEFAULT '[]',
  context_match jsonb NOT NULL DEFAULT '{}',
  expected_improvements jsonb NOT NULL DEFAULT '{}',
  actual_results jsonb DEFAULT '{}',
  success_validation boolean DEFAULT null,
  comic_id uuid REFERENCES storybook_entries(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  validated_at timestamptz DEFAULT null
);

-- Enable Row Level Security
ALTER TABLE success_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_effectiveness ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_evolution_log ENABLE ROW LEVEL SECURITY;

-- Policies for success_patterns
CREATE POLICY "System can manage success patterns"
  ON success_patterns
  FOR ALL
  TO authenticated
  USING (true); -- Allow system to manage patterns

CREATE POLICY "Users can read success patterns for analytics"
  ON success_patterns
  FOR SELECT
  TO authenticated
  USING (true); -- Allow reading patterns for analytics

-- Policies for pattern_effectiveness
CREATE POLICY "System can manage pattern effectiveness"
  ON pattern_effectiveness
  FOR ALL
  TO authenticated
  USING (true); -- Allow system to track effectiveness

CREATE POLICY "Users can read pattern effectiveness"
  ON pattern_effectiveness
  FOR SELECT
  TO authenticated
  USING (true); -- Allow reading effectiveness data

-- Policies for prompt_evolution_log
CREATE POLICY "System can manage prompt evolution log"
  ON prompt_evolution_log
  FOR ALL
  TO authenticated
  USING (true); -- Allow system to log evolution

CREATE POLICY "Users can read prompt evolution log"
  ON prompt_evolution_log
  FOR SELECT
  TO authenticated
  USING (true); -- Allow reading evolution history

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_success_patterns_type ON success_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_success_patterns_context_signature ON success_patterns(context_signature);
CREATE INDEX IF NOT EXISTS idx_success_patterns_effectiveness ON success_patterns(effectiveness_score DESC);
CREATE INDEX IF NOT EXISTS idx_success_patterns_audience ON success_patterns(audience_type);
CREATE INDEX IF NOT EXISTS idx_success_patterns_genre ON success_patterns(story_genre);
CREATE INDEX IF NOT EXISTS idx_success_patterns_art_style ON success_patterns(art_style);
CREATE INDEX IF NOT EXISTS idx_success_patterns_usage_count ON success_patterns(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_success_patterns_last_used ON success_patterns(last_used_at DESC);

CREATE INDEX IF NOT EXISTS idx_pattern_effectiveness_pattern_id ON pattern_effectiveness(pattern_id);
CREATE INDEX IF NOT EXISTS idx_pattern_effectiveness_comic_id ON pattern_effectiveness(comic_id);
CREATE INDEX IF NOT EXISTS idx_pattern_effectiveness_rating ON pattern_effectiveness(effectiveness_rating DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_effectiveness_created_at ON pattern_effectiveness(created_at);

CREATE INDEX IF NOT EXISTS idx_prompt_evolution_type ON prompt_evolution_log(evolution_type);
CREATE INDEX IF NOT EXISTS idx_prompt_evolution_comic_id ON prompt_evolution_log(comic_id);
CREATE INDEX IF NOT EXISTS idx_prompt_evolution_success ON prompt_evolution_log(success_validation);
CREATE INDEX IF NOT EXISTS idx_prompt_evolution_created_at ON prompt_evolution_log(created_at);

-- Create composite indexes for complex pattern matching
CREATE INDEX IF NOT EXISTS idx_success_patterns_matching ON success_patterns(audience_type, story_genre, art_style, effectiveness_score DESC);
CREATE INDEX IF NOT EXISTS idx_success_patterns_context_lookup ON success_patterns(pattern_type, context_signature, effectiveness_score DESC);

-- Create function to generate context signature
CREATE OR REPLACE FUNCTION generate_context_signature(
  audience_type text,
  story_genre text,
  art_style text,
  environmental_setting text,
  character_type text
)
RETURNS text AS $$
BEGIN
  RETURN md5(
    COALESCE(audience_type, '') || '|' ||
    COALESCE(story_genre, '') || '|' ||
    COALESCE(art_style, '') || '|' ||
    COALESCE(environmental_setting, '') || '|' ||
    COALESCE(character_type, '')
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to update pattern usage statistics
CREATE OR REPLACE FUNCTION update_pattern_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE success_patterns 
  SET 
    usage_count = usage_count + 1,
    last_used_at = now(),
    updated_at = now()
  WHERE id = NEW.pattern_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update pattern usage
DROP TRIGGER IF EXISTS trigger_update_pattern_usage ON pattern_effectiveness;
CREATE TRIGGER trigger_update_pattern_usage
  AFTER INSERT ON pattern_effectiveness
  FOR EACH ROW
  EXECUTE FUNCTION update_pattern_usage();

-- Create function to calculate pattern success rate
CREATE OR REPLACE FUNCTION calculate_pattern_success_rate()
RETURNS TRIGGER AS $$
DECLARE
  total_applications integer;
  successful_applications integer;
  new_success_rate decimal(5,2);
BEGIN
  -- Count total applications
  SELECT COUNT(*) INTO total_applications
  FROM pattern_effectiveness
  WHERE pattern_id = NEW.pattern_id;
  
  -- Count successful applications (effectiveness_rating >= 75)
  SELECT COUNT(*) INTO successful_applications
  FROM pattern_effectiveness
  WHERE pattern_id = NEW.pattern_id
    AND effectiveness_rating >= 75;
  
  -- Calculate success rate
  IF total_applications > 0 THEN
    new_success_rate := (successful_applications::decimal / total_applications::decimal) * 100;
    
    -- Update pattern success rate
    UPDATE success_patterns
    SET 
      success_rate = new_success_rate,
      updated_at = now()
    WHERE id = NEW.pattern_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to calculate success rate
DROP TRIGGER IF EXISTS trigger_calculate_pattern_success_rate ON pattern_effectiveness;
CREATE TRIGGER trigger_calculate_pattern_success_rate
  AFTER INSERT OR UPDATE ON pattern_effectiveness
  FOR EACH ROW
  EXECUTE FUNCTION calculate_pattern_success_rate();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS trigger_update_success_patterns_updated_at ON success_patterns;
CREATE TRIGGER trigger_update_success_patterns_updated_at
  BEFORE UPDATE ON success_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();