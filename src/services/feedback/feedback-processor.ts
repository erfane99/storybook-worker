/**
 * Feedback Processor Service
 * Analyzes user feedback using AI and extracts actionable improvements
 */

import { DatabaseService } from '../database/database-service.js';

// Issue categories that map to prompt improvements
const ISSUE_CATEGORIES = {
  // Story issues
  more_dialogue: { category: 'story', promptKey: 'dialogue_generation', weight: 1.5 },
  better_pacing: { category: 'story', promptKey: 'story_pacing', weight: 1.2 },
  unclear_story: { category: 'story', promptKey: 'story_clarity', weight: 1.3 },
  ending_rushed: { category: 'story', promptKey: 'story_resolution', weight: 1.1 },
  more_emotion: { category: 'story', promptKey: 'emotional_depth', weight: 1.2 },
  
  // Image issues
  character_inconsistent: { category: 'image', promptKey: 'character_consistency', weight: 2.0 },
  poses_similar: { category: 'image', promptKey: 'pose_diversity', weight: 1.5 },
  backgrounds_repetitive: { category: 'image', promptKey: 'environment_variety', weight: 1.3 },
  camera_angles_same: { category: 'image', promptKey: 'camera_variation', weight: 1.4 },
  art_quality: { category: 'image', promptKey: 'image_quality', weight: 1.2 },
} as const;

type IssueKey = keyof typeof ISSUE_CATEGORIES;

interface ExtractedIssue {
  key: string;
  category: 'story' | 'image';
  promptKey: string;
  weight: number;
  source: 'checkbox' | 'ai_extracted';
  confidence: number;
}

interface ExtractedSuggestion {
  area: 'story' | 'image' | 'general';
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
}

interface FeedbackAnalysisResult {
  feedbackId: string;
  issues: ExtractedIssue[];
  suggestions: ExtractedSuggestion[];
  overallSentiment: 'positive' | 'neutral' | 'negative';
  processingNotes: string;
}

export class FeedbackProcessor {
    private databaseService: DatabaseService;
    private claudeApiKey: string;
  
    constructor(databaseService: DatabaseService) {
      this.databaseService = databaseService;
    this.claudeApiKey = process.env.ANTHROPIC_API_KEY || '';
  }

  /**
   * Process a single feedback item
   */
  async processFeedback(feedbackId: string): Promise<FeedbackAnalysisResult | null> {
    try {
      console.log(`🔍 Processing feedback: ${feedbackId}`);

      // Fetch feedback from database
      const feedback = await this.getFeedbackById(feedbackId);
      if (!feedback) {
        console.error(`❌ Feedback not found: ${feedbackId}`);
        return null;
      }

      // Extract issues from checkboxes (high confidence)
      const checkboxIssues = this.extractCheckboxIssues(feedback.quick_issues || []);

      // Extract issues from free text using AI (medium confidence)
      const textIssues = await this.analyzeTextFeedback(
        feedback.story_feedback,
        feedback.image_feedback
      );

      // Combine and deduplicate issues
      const allIssues = this.combineIssues(checkboxIssues, textIssues);

      // Extract actionable suggestions
      const suggestions = await this.extractSuggestions(
        feedback.story_feedback,
        feedback.image_feedback
      );

      // Determine overall sentiment
      const sentiment = this.analyzeSentiment(feedback);

      // Save extracted data back to database
      await this.saveProcessedFeedback(feedbackId, allIssues, suggestions);

      console.log(`✅ Processed feedback ${feedbackId}: ${allIssues.length} issues, ${suggestions.length} suggestions`);

      return {
        feedbackId,
        issues: allIssues,
        suggestions,
        overallSentiment: sentiment,
        processingNotes: `Processed ${checkboxIssues.length} checkbox issues and ${textIssues.length} AI-extracted issues`
      };

    } catch (error: any) {
      console.error(`❌ Failed to process feedback ${feedbackId}:`, error.message);
      return null;
    }
  }

  /**
   * Process all pending feedback
   */
  async processAllPendingFeedback(): Promise<{
    processed: number;
    failed: number;
    results: FeedbackAnalysisResult[];
  }> {
    try {
      const pendingFeedback = await this.getPendingFeedback();
      
      if (pendingFeedback.length === 0) {
        console.log('📭 No pending feedback to process');
        return { processed: 0, failed: 0, results: [] };
      }

      console.log(`📬 Processing ${pendingFeedback.length} pending feedback items`);

      const results: FeedbackAnalysisResult[] = [];
      let processed = 0;
      let failed = 0;

      for (const feedback of pendingFeedback) {
        const result = await this.processFeedback(feedback.id);
        if (result) {
          results.push(result);
          processed++;
        } else {
          failed++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`✅ Feedback processing complete: ${processed} processed, ${failed} failed`);

      return { processed, failed, results };

    } catch (error: any) {
      console.error('❌ Batch feedback processing failed:', error.message);
      return { processed: 0, failed: 0, results: [] };
    }
  }

  /**
   * Extract issues from checkbox selections
   */
  private extractCheckboxIssues(quickIssues: string[]): ExtractedIssue[] {
    return quickIssues
      .filter((issue): issue is IssueKey => issue in ISSUE_CATEGORIES)
      .map(issue => ({
        key: issue,
        category: ISSUE_CATEGORIES[issue].category,
        promptKey: ISSUE_CATEGORIES[issue].promptKey,
        weight: ISSUE_CATEGORIES[issue].weight,
        source: 'checkbox' as const,
        confidence: 1.0 // Checkboxes have 100% confidence
      }));
  }

  /**
   * Analyze free text feedback using Claude AI
   */
  private async analyzeTextFeedback(
    storyFeedback: string | null,
    imageFeedback: string | null
  ): Promise<ExtractedIssue[]> {
    // Skip if no text feedback
    if (!storyFeedback && !imageFeedback) {
      return [];
    }

    try {
      const prompt = `Analyze this user feedback about a comic book/storybook and extract specific issues.

STORY FEEDBACK: "${storyFeedback || 'None provided'}"
IMAGE FEEDBACK: "${imageFeedback || 'None provided'}"

Identify which of these specific issues are mentioned or implied:
- more_dialogue: User wants more speech bubbles or character dialogue
- better_pacing: Story feels too fast or slow
- unclear_story: Story is confusing or hard to follow
- ending_rushed: Ending feels incomplete or rushed
- more_emotion: Story lacks emotional depth
- character_inconsistent: Character looks different between panels
- poses_similar: Character poses are repetitive
- backgrounds_repetitive: Backgrounds/environments look the same
- camera_angles_same: Camera angles don't vary enough
- art_quality: Image quality is poor

Return ONLY a JSON array of issue keys that apply, with confidence scores (0.5-1.0):
[{"key": "issue_key", "confidence": 0.8}]

If no issues are clearly mentioned, return empty array: []`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      if (!response.ok) {
        console.warn('⚠️ Claude API call failed, skipping text analysis');
        return [];
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || '[]';
      
      // Parse JSON response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const extracted = JSON.parse(jsonMatch[0]) as Array<{ key: string; confidence: number }>;

      return extracted
        .filter(item => item.key in ISSUE_CATEGORIES)
        .map(item => {
          const issueKey = item.key as IssueKey;
          return {
            key: issueKey,
            category: ISSUE_CATEGORIES[issueKey].category,
            promptKey: ISSUE_CATEGORIES[issueKey].promptKey,
            weight: ISSUE_CATEGORIES[issueKey].weight,
            source: 'ai_extracted' as const,
            confidence: item.confidence
          };
        });

    } catch (error: any) {
      console.warn('⚠️ Text analysis failed:', error.message);
      return [];
    }
  }

  /**
   * Extract actionable suggestions from text
   */
  private async extractSuggestions(
    storyFeedback: string | null,
    imageFeedback: string | null
  ): Promise<ExtractedSuggestion[]> {
    if (!storyFeedback && !imageFeedback) {
      return [];
    }

    try {
      const prompt = `Extract actionable improvement suggestions from this feedback:

STORY FEEDBACK: "${storyFeedback || 'None'}"
IMAGE FEEDBACK: "${imageFeedback || 'None'}"

Return JSON array of suggestions:
[{
  "area": "story" | "image" | "general",
  "suggestion": "specific actionable improvement",
  "priority": "high" | "medium" | "low",
  "actionable": true | false
}]

Only include clear, actionable suggestions. Return [] if none found.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      if (!response.ok) return [];

      const data = await response.json();
      const content = data.content?.[0]?.text || '[]';
      
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      return JSON.parse(jsonMatch[0]) as ExtractedSuggestion[];

    } catch (error: any) {
      console.warn('⚠️ Suggestion extraction failed:', error.message);
      return [];
    }
  }

  /**
   * Combine checkbox and AI-extracted issues, removing duplicates
   */
  private combineIssues(
    checkboxIssues: ExtractedIssue[],
    textIssues: ExtractedIssue[]
  ): ExtractedIssue[] {
    const issueMap = new Map<string, ExtractedIssue>();

    // Add checkbox issues first (higher priority)
    for (const issue of checkboxIssues) {
      issueMap.set(issue.key, issue);
    }

    // Add AI-extracted issues if not already present
    for (const issue of textIssues) {
      if (!issueMap.has(issue.key)) {
        issueMap.set(issue.key, issue);
      }
    }

    return Array.from(issueMap.values());
  }

  /**
   * Analyze overall sentiment
   */
  private analyzeSentiment(feedback: any): 'positive' | 'neutral' | 'negative' {
    const text = `${feedback.story_feedback || ''} ${feedback.image_feedback || ''}`.toLowerCase();
    const issueCount = (feedback.quick_issues || []).length;

    const positiveWords = ['love', 'great', 'amazing', 'wonderful', 'perfect', 'excellent', 'beautiful'];
    const negativeWords = ['hate', 'terrible', 'awful', 'horrible', 'worst', 'bad', 'poor', 'ugly'];

    const positiveCount = positiveWords.filter(w => text.includes(w)).length;
    const negativeCount = negativeWords.filter(w => text.includes(w)).length;

    if (positiveCount > negativeCount && issueCount < 3) return 'positive';
    if (negativeCount > positiveCount || issueCount >= 4) return 'negative';
    return 'neutral';
  }

  /**
   * Database operations using Supabase client
   */
  private async getFeedbackById(feedbackId: string): Promise<any | null> {
    try {
      const supabase = this.databaseService.getClient();
      if (!supabase) return null;

      const { data, error } = await supabase
        .from('user_actionable_feedback')
        .select('*')
        .eq('id', feedbackId)
        .single();

      if (error) return null;
      return data;
    } catch (error) {
      console.warn('Failed to get feedback:', error);
      return null;
    }
  }

  private async getPendingFeedback(): Promise<any[]> {
    try {
      const supabase = this.databaseService.getClient();
      if (!supabase) return [];

      const { data, error } = await supabase
        .from('user_actionable_feedback')
        .select('*')
        .eq('processed', false)
        .limit(20);

      if (error) return [];
      return data || [];
    } catch (error) {
      console.warn('Failed to get pending feedback:', error);
      return [];
    }
  }

  private async saveProcessedFeedback(
    feedbackId: string,
    issues: ExtractedIssue[],
    suggestions: ExtractedSuggestion[]
  ): Promise<boolean> {
    try {
      const supabase = this.databaseService.getClient();
      if (!supabase) return false;

      const { error } = await supabase
        .from('user_actionable_feedback')
        .update({
          extracted_issues: issues,
          extracted_suggestions: suggestions,
          processed: true,
          processed_at: new Date().toISOString()
        })
        .eq('id', feedbackId);

      return !error;
    } catch (error) {
      console.warn('Failed to save processed feedback:', error);
      return false;
    }
  }
}