/**
 * Feedback Pattern Aggregator
 * Analyzes processed feedback to identify common issues and generate prompt adjustments
 */

import { DatabaseService } from '../database/database-service.js';

// Maps extracted issues to specific prompt adjustments
const ISSUE_TO_PROMPT_ADJUSTMENT: Record<string, PromptAdjustment> = {
  // Story issues
  more_dialogue: {
    area: 'story_analysis',
    adjustment: 'DIALOGUE EMPHASIS: Generate speech bubbles for 50-60% of panels. Add natural character dialogue even when not in source story.',
    weight: 1.5
  },
  better_pacing: {
    area: 'story_analysis',
    adjustment: 'PACING CONTROL: Ensure smooth emotional transitions. No abrupt jumps between story beats.',
    weight: 1.2
  },
  unclear_story: {
    area: 'story_analysis',
    adjustment: 'CLARITY FOCUS: Each panel must have ONE clear action. Narration must directly describe what is shown.',
    weight: 1.4
  },
  ending_rushed: {
    area: 'story_analysis',
    adjustment: 'RESOLUTION DEPTH: Dedicate final 2-3 panels to satisfying conclusion. Show emotional payoff.',
    weight: 1.1
  },
  more_emotion: {
    area: 'story_analysis',
    adjustment: 'EMOTIONAL DEPTH: Exaggerate character expressions. Show internal feelings through body language and environment.',
    weight: 1.3
  },
  
  // Image issues
  character_inconsistent: {
    area: 'image_generation',
    adjustment: 'CHARACTER LOCK: Match reference image EXACTLY. Zero deviation in face, hair, clothing, proportions.',
    weight: 2.0
  },
  poses_similar: {
    area: 'image_generation',
    adjustment: 'POSE DIVERSITY MANDATORY: Each panel must have DIFFERENT pose. Vary: standing/sitting/walking/reaching/looking directions.',
    weight: 1.6
  },
  backgrounds_repetitive: {
    area: 'image_generation',
    adjustment: 'ENVIRONMENT VARIETY: Change camera position each panel. Show different areas of same location. Add unique background details.',
    weight: 1.4
  },
  camera_angles_same: {
    area: 'image_generation',
    adjustment: 'CAMERA VARIATION REQUIRED: Cycle through: close-up, medium, wide, over-shoulder, low-angle, high-angle. Never repeat same angle consecutively.',
    weight: 1.5
  },
  art_quality: {
    area: 'image_generation',
    adjustment: 'QUALITY BOOST: Publication-ready professional art. Clean lines, vibrant colors, high detail, proper lighting.',
    weight: 1.3
  }
};

interface PromptAdjustment {
  area: 'story_analysis' | 'image_generation' | 'narration';
  adjustment: string;
  weight: number;
}

interface AggregatedFeedbackPatterns {
  storyAdjustments: string[];
  imageAdjustments: string[];
  narrationAdjustments: string[];
  issueFrequency: Record<string, number>;
  totalFeedbackCount: number;
  appliedAt: string;
}

export class FeedbackPatternAggregator {
  private databaseService: DatabaseService;
  private cachedPatterns: AggregatedFeedbackPatterns | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

  constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService;
  }

  /**
   * Get aggregated feedback patterns for prompt adjustment
   * Caches results to avoid repeated database queries
   */
  async getAggregatedPatterns(): Promise<AggregatedFeedbackPatterns> {
    // Return cached if valid
    if (this.cachedPatterns && Date.now() < this.cacheExpiry) {
      console.log('📊 Using cached feedback patterns');
      return this.cachedPatterns;
    }

    console.log('📊 Aggregating feedback patterns from database...');

    try {
      const supabase = this.databaseService.getClient();
      if (!supabase) {
        return this.getEmptyPatterns();
      }

      // Get all processed feedback from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: feedbackData, error } = await supabase
        .from('user_actionable_feedback')
        .select('quick_issues, extracted_issues')
        .eq('processed', true)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (error || !feedbackData) {
        console.warn('⚠️ Failed to fetch feedback patterns:', error?.message);
        return this.getEmptyPatterns();
      }

      // Count issue frequency
      const issueFrequency: Record<string, number> = {};

      for (const feedback of feedbackData) {
        // Count quick issues (checkboxes)
        const quickIssues = feedback.quick_issues || [];
        for (const issue of quickIssues) {
          issueFrequency[issue] = (issueFrequency[issue] || 0) + 1;
        }

        // Count extracted issues (AI-analyzed)
        const extractedIssues = feedback.extracted_issues || [];
        for (const extracted of extractedIssues) {
          const key = typeof extracted === 'string' ? extracted : extracted.key;
          if (key) {
            // AI-extracted issues count as 0.7 (lower confidence than checkboxes)
            issueFrequency[key] = (issueFrequency[key] || 0) + 0.7;
          }
        }
      }

      // Generate adjustments based on frequency
      const storyAdjustments: string[] = [];
      const imageAdjustments: string[] = [];
      const narrationAdjustments: string[] = [];

      // Sort by frequency and apply top issues
      const sortedIssues = Object.entries(issueFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10 issues

      for (const [issueKey, frequency] of sortedIssues) {
        const adjustment = ISSUE_TO_PROMPT_ADJUSTMENT[issueKey];
        if (!adjustment) continue;

        // Only apply if issue appears in at least 2 feedbacks (or equivalent weight)
        if (frequency < 2) continue;

        const weightedAdjustment = `[PRIORITY ${Math.min(frequency, 5).toFixed(1)}] ${adjustment.adjustment}`;

        switch (adjustment.area) {
          case 'story_analysis':
            storyAdjustments.push(weightedAdjustment);
            break;
          case 'image_generation':
            imageAdjustments.push(weightedAdjustment);
            break;
          case 'narration':
            narrationAdjustments.push(weightedAdjustment);
            break;
        }
      }

      const patterns: AggregatedFeedbackPatterns = {
        storyAdjustments,
        imageAdjustments,
        narrationAdjustments,
        issueFrequency,
        totalFeedbackCount: feedbackData.length,
        appliedAt: new Date().toISOString()
      };

      // Cache the results
      this.cachedPatterns = patterns;
      this.cacheExpiry = Date.now() + this.CACHE_DURATION_MS;

      console.log(`✅ Aggregated ${feedbackData.length} feedbacks: ${storyAdjustments.length} story, ${imageAdjustments.length} image adjustments`);

      return patterns;

    } catch (error: any) {
      console.warn('⚠️ Feedback pattern aggregation failed:', error.message);
      return this.getEmptyPatterns();
    }
  }

  /**
   * Get prompt enhancement string for story analysis
   */
  async getStoryAnalysisEnhancement(): Promise<string> {
    const patterns = await this.getAggregatedPatterns();
    
    if (patterns.storyAdjustments.length === 0) {
      return '';
    }

    return `
FEEDBACK-DRIVEN IMPROVEMENTS (based on ${patterns.totalFeedbackCount} user feedbacks):
${patterns.storyAdjustments.join('\n')}`;
  }

  /**
   * Get prompt enhancement string for image generation
   */
  async getImageGenerationEnhancement(): Promise<string> {
    const patterns = await this.getAggregatedPatterns();
    
    if (patterns.imageAdjustments.length === 0) {
      return '';
    }

    return `
USER FEEDBACK REQUIREMENTS:
${patterns.imageAdjustments.join('\n')}`;
  }

  /**
   * Clear the cache (useful after new feedback is processed)
   */
  clearCache(): void {
    this.cachedPatterns = null;
    this.cacheExpiry = 0;
    console.log('🗑️ Feedback pattern cache cleared');
  }

  private getEmptyPatterns(): AggregatedFeedbackPatterns {
    return {
      storyAdjustments: [],
      imageAdjustments: [],
      narrationAdjustments: [],
      issueFrequency: {},
      totalFeedbackCount: 0,
      appliedAt: new Date().toISOString()
    };
  }
}