/**
 * ===== NARRATIVE INTELLIGENCE MODULE =====
 * Advanced story analysis and narrative intelligence system for professional comic creation
 * FIXED: Combines best features from both original files with corrected imports
 * 
 * File Location: lib/services/ai/modular/narrative-intelligence.ts
 * Dependencies: constants-and-types.ts, error-handling-system.ts, openai-integration.ts
 * 
 * Features:
 * - Advanced story archetype detection with confidence scoring (FROM CURRENTAISERV.TXT)
 * - Professional system prompt building with emotional progression (FROM AISERVNOW.TXT)
 * - Comprehensive thematic analysis and character growth identification (FROM BOTH FILES)
 * - Intelligent emergency story analysis for robust operation (FROM CURRENTAISERV.TXT)
 * - JSON schema compliance and structured output (FROM AISERVNOW.TXT)
 * - Universal appeal calculation and audience alignment (FROM EXISTING)
 */

import { 
  AudienceType,
  StoryArchetype,
  NarrativeIntelligence,
  STORYTELLING_ARCHETYPES,
  PROFESSIONAL_AUDIENCE_CONFIG,
  AI_PROMPTS
} from './constants-and-types';

import { 
  ErrorHandlingSystem,
  AIServiceError,
  AIRateLimitError,
  AIContentPolicyError 
} from './error-handling-system';

import { OpenAIIntegration } from './openai-integration';

// ===== MISSING INTERFACE DEFINITIONS - FIXED =====

export interface ThematicAnalysis {
  primaryThemes: string[];
  secondaryThemes: string[];
  universalAppeal: number;
  audienceAlignment: number;
  emotionalResonance: number;
}

export interface ArchetypeDetectionResult {
  primaryArchetype: StoryArchetype;
  confidence: number;
  alternativeArchetypes: string[];
  reasoningFactors: string[];
}

export interface StoryAnalysisContext {
  totalPanels: number;
  pagesPerStory: number;
  panelsPerPage: number;
  complexity: string;
  narrativeDepth: string;
  speechBubbleRatio: number;
}

export interface EmotionalProgression {
  startEmotion: string;
  midEmotion: string;
  endEmotion: string;
  emotionalArc: string[];
}

export interface CharacterGrowthPattern {
  initialState: string;
  growthChallenges: string[];
  finalState: string;
  growthArc: string[];
}

/**
 * ===== NARRATIVE INTELLIGENCE ENGINE CLASS =====
 * Professional story analysis with archetype detection and thematic intelligence
 */
export class NarrativeIntelligenceEngine {
  private openaiIntegration: OpenAIIntegration;
  private errorHandler: ErrorHandlingSystem;

  constructor(
    openaiIntegration: OpenAIIntegration,
    errorHandler: ErrorHandlingSystem
  ) {
    this.openaiIntegration = openaiIntegration;
    this.errorHandler = errorHandler;
  }

  // ===== MAIN NARRATIVE INTELLIGENCE CREATION (FROM BOTH FILES) =====

  /**
   * Create comprehensive narrative intelligence for story analysis
   * Combines best features from both original files
   * FIXED: All TypeScript errors resolved
   */
  async createNarrativeIntelligence(
    story: string, 
    audience: AudienceType, 
    context?: StoryAnalysisContext
  ): Promise<NarrativeIntelligence> {
    try {
      console.log('🧠 Creating narrative intelligence...');

      // Step 1: Detect story archetype with confidence scoring (FROM CURRENTAISERV.TXT)
      const archetypeResult = await this.detectStoryArchetypeWithConfidence(story, audience);
      
      // Step 2: Perform comprehensive thematic analysis (FROM BOTH FILES)
      const thematicAnalysis = await this.analyzeThematicDepth(story, audience);
      
      // Step 3: Determine pacing strategy and character growth (FROM AISERVNOW.TXT)
      const pacingStrategy = this.determinePacingStrategy(story, audience);
      const characterGrowth = await this.identifyCharacterGrowthOpportunities(story);
      
      // Step 4: Create emotional progression arc (FROM BOTH FILES)
const archetypeData = STORYTELLING_ARCHETYPES[archetypeResult.primaryArchetype as keyof typeof STORYTELLING_ARCHETYPES];
      const emotionalArc = this.enhanceEmotionalArc([...archetypeData.emotionalArc], thematicAnalysis);

      const narrativeIntel: NarrativeIntelligence = {
        storyArchetype: archetypeResult.primaryArchetype,
        emotionalArc,
        thematicElements: thematicAnalysis.primaryThemes,
        pacingStrategy: pacingStrategy as 'slow_build' | 'action_packed' | 'emotional_depth' | 'mystery_reveal',
        characterGrowth,
        conflictProgression: [...archetypeData.structure], // Convert readonly to mutable
        confidence: archetypeResult.confidence,
        alternativeArchetypes: archetypeResult.alternativeArchetypes,
        audienceAlignment: thematicAnalysis.audienceAlignment,
        universalAppeal: thematicAnalysis.universalAppeal,
        reasoningFactors: archetypeResult.reasoningFactors
      };

      console.log(`✅ Narrative intelligence created: ${archetypeResult.primaryArchetype} (${archetypeResult.confidence}% confidence)`);
      
      return narrativeIntel;

    } catch (error) {
      console.error('❌ Narrative intelligence creation failed:', error);
      // Use intelligent emergency analysis (FROM CURRENTAISERV.TXT)
      return this.createEmergencyNarrativeIntelligence(story, audience);
    }
  }

  // ===== STORY ARCHETYPE DETECTION (FROM CURRENTAISERV.TXT) =====

  /**
   * Detect story archetype with advanced pattern matching and confidence scoring
   * FIXED: All TypeScript errors resolved
   */
  async detectStoryArchetypeWithConfidence(
    story: string, 
    audience: AudienceType
  ): Promise<ArchetypeDetectionResult> {
    try {
      // Primary detection using AI analysis
      const aiArchetype = await this.detectStoryArchetypeWithAI(story, audience);
      
      // Secondary detection using pattern matching
      const patternArchetype = this.detectStoryArchetypeFromPatterns(story);
      
      // Calculate confidence and determine primary archetype
      const confidence = aiArchetype === patternArchetype ? 95 : 75;
      const primaryArchetype = confidence > 80 ? aiArchetype : patternArchetype;
      
      // Generate alternative archetypes
      const alternatives = this.generateAlternativeArchetypes(story, primaryArchetype);

      return {
        primaryArchetype: primaryArchetype as StoryArchetype,
        confidence,
        alternativeArchetypes: alternatives,
        reasoningFactors: this.generateReasoningFactors(story, primaryArchetype)
      };

    } catch (error) {
      console.warn('AI archetype detection failed, using pattern matching');
      const fallbackArchetype = this.detectStoryArchetypeFromPatterns(story);
      
      return {
        primaryArchetype: fallbackArchetype as StoryArchetype,
        confidence: 60,
        alternativeArchetypes: ['discovery', 'hero_journey'],
        reasoningFactors: ['pattern_matching_only']
      };
    }
  }

  /**
   * AI-powered archetype detection with professional prompting
   * FIXED: All TypeScript errors resolved
   */
  private async detectStoryArchetypeWithAI(story: string, audience: AudienceType): Promise<string> {
    const prompt = `${AI_PROMPTS.archetypeDetection.base}

STORY TO ANALYZE:
"${story.substring(0, 1500)}"

AUDIENCE: ${audience.toUpperCase()}

${AI_PROMPTS.archetypeDetection[audience as keyof typeof AI_PROMPTS.archetypeDetection]}

Return ONLY the archetype name: hero_journey, discovery, transformation, redemption, mystery, or adventure`;

    const response = await this.openaiIntegration.generateTextCompletion(
      prompt,
      {
        temperature: 0.3,
        maxTokens: 50,
        model: 'gpt-4o'
      }
    );

    const archetype = response.trim().toLowerCase().replace(/[^a-z_]/g, '');
    
    // Validate archetype exists in our system
    if (STORYTELLING_ARCHETYPES[archetype as keyof typeof STORYTELLING_ARCHETYPES]) {
      return archetype;
    }
    
    // Default based on audience
    return audience === 'children' ? 'discovery' : 'hero_journey';
  }

  /**
   * Pattern-based archetype detection for fallback and validation
   * FIXED: All TypeScript errors resolved
   */
  private detectStoryArchetypeFromPatterns(story: string): string {
    const storyLower = story.toLowerCase();
    const patterns = {
      hero_journey: ['journey', 'adventure', 'quest', 'hero', 'save', 'rescue', 'challenge', 'overcome'],
      discovery: ['discover', 'find', 'explore', 'learn', 'wonder', 'mystery', 'secret', 'hidden'],
      transformation: ['change', 'become', 'transform', 'grow', 'realize', 'understand', 'evolve'],
      redemption: ['forgive', 'sorry', 'mistake', 'redemption', 'second chance', 'make amends'],
      mystery: ['mystery', 'solve', 'clue', 'investigate', 'detective', 'puzzle', 'unknown'],
      adventure: ['adventure', 'exciting', 'dangerous', 'explore', 'travel', 'journey']
    };

    const scores: Record<string, number> = {};
    
    // Calculate pattern matching scores
    for (const [archetype, keywords] of Object.entries(patterns)) {
      scores[archetype] = keywords.reduce((score, keyword) => {
        const occurrences = (storyLower.match(new RegExp(keyword, 'g')) || []).length;
        return score + occurrences;
      }, 0);
    }

    // Return archetype with highest score
    const topArchetype = Object.keys(scores).reduce((a, b) => 
      scores[a] > scores[b] ? a : b
    );

    return scores[topArchetype] > 0 ? topArchetype : 'discovery';
  }

  // ===== THEMATIC ANALYSIS (FROM BOTH FILES) =====

  /**
   * Perform comprehensive thematic analysis with depth scoring
   * FIXED: All TypeScript errors resolved
   */
  async analyzeThematicDepth(story: string, audience: AudienceType): Promise<ThematicAnalysis> {
    try {
      const aiThemes = await this.extractThematicElementsWithAI(story);
      const patternThemes = this.extractThemesFromPatterns(story);
      
      // Combine and deduplicate themes
      const allThemes = [...new Set([...aiThemes, ...patternThemes])];
      
      return {
        primaryThemes: allThemes.slice(0, 3),
        secondaryThemes: allThemes.slice(3, 6),
        universalAppeal: this.calculateUniversalAppeal(allThemes),
        audienceAlignment: this.calculateAudienceAlignment(allThemes, audience),
        emotionalResonance: this.identifyEmotionalResonance(allThemes)
      };

    } catch (error) {
      console.warn('AI thematic analysis failed, using pattern extraction');
      const fallbackThemes = this.extractThemesFromPatterns(story);
      
      return {
        primaryThemes: fallbackThemes.slice(0, 3),
        secondaryThemes: fallbackThemes.slice(3),
        universalAppeal: 75,
        audienceAlignment: 80,
        emotionalResonance: fallbackThemes.includes('friendship') ? 90 : 70
      };
    }
  }

  /**
   * AI-powered thematic element extraction
   * FIXED: All TypeScript errors resolved
   */
  private async extractThematicElementsWithAI(story: string): Promise<string[]> {
    const prompt = `${AI_PROMPTS.thematicAnalysis.base}

STORY TO ANALYZE:
"${story.substring(0, 1200)}"

${AI_PROMPTS.thematicAnalysis.instructions}

Return themes as a comma-separated list (max 6 themes).`;

    const response = await this.openaiIntegration.generateTextCompletion(
      prompt,
      {
        temperature: 0.4,
        maxTokens: 100,
        model: 'gpt-4o'
      }
    );

    return response
      .split(',')
      .map(theme => theme.trim().toLowerCase().replace(/[^a-z_\s]/g, ''))
      .filter(theme => theme.length > 2)
      .slice(0, 6);
  }

  /**
   * Pattern-based theme extraction for fallback and validation
   * FIXED: All TypeScript errors resolved
   */
  private extractThemesFromPatterns(story: string): string[] {
    const storyLower = story.toLowerCase();
    const themePatterns = {
      friendship: ['friend', 'together', 'help each other', 'support', 'companion'],
      courage: ['brave', 'courage', 'fearless', 'bold', 'daring'],
      kindness: ['kind', 'caring', 'gentle', 'compassionate', 'helpful'],
      growth: ['learn', 'grow', 'develop', 'improve', 'progress'],
      adventure: ['adventure', 'explore', 'journey', 'discover', 'exciting'],
      family: ['family', 'parent', 'sibling', 'home', 'love'],
      perseverance: ['persist', 'never give up', 'keep trying', 'determination'],
      wonder: ['amazing', 'magical', 'wonderful', 'incredible', 'marvelous']
    };

    const detectedThemes: string[] = [];
    
    for (const [theme, patterns] of Object.entries(themePatterns)) {
      const hasTheme = patterns.some(pattern => storyLower.includes(pattern));
      if (hasTheme) {
        detectedThemes.push(theme);
      }
    }

    // Ensure we have at least some themes
    if (detectedThemes.length === 0) {
      detectedThemes.push('adventure', 'growth', 'friendship');
    }

    return detectedThemes;
  }

  // ===== SYSTEM PROMPT BUILDING (FROM AISERVNOW.TXT) =====

  /**
   * Build advanced system prompt with narrative intelligence
   * FIXED: All TypeScript errors resolved
   */
  buildAdvancedSystemPrompt(
    audience: AudienceType,
    context: StoryAnalysisContext,
    narrativeIntel: NarrativeIntelligence,
    previousFailures: string[] = [],
    attemptNumber: number = 0
  ): string {
    let basePrompt = `You are an award-winning comic book writer following industry-standard narrative structure from Stan Lee, Alan Moore, and Grant Morrison, enhanced with modern narrative intelligence.

🎭 NARRATIVE INTELLIGENCE SYSTEM ACTIVATED:
Story Archetype: ${narrativeIntel.storyArchetype.toUpperCase()}
Emotional Progression: ${narrativeIntel.emotionalArc.join(' → ')}
Thematic Elements: ${narrativeIntel.thematicElements.join(', ')}
Pacing Strategy: ${narrativeIntel.pacingStrategy}
Character Growth Arc: ${narrativeIntel.characterGrowth.join(', ')}

PROFESSIONAL STORY ANALYSIS MISSION:
Analyze this story using proven comic book creation methodology where story beats drive visual choices.

AUDIENCE: ${audience.toUpperCase()}
TARGET: ${context.totalPanels} total panels across ${context.pagesPerStory} pages (${context.panelsPerPage} panels per page)
COMPLEXITY: ${context.complexity}
NARRATIVE DEPTH: ${context.narrativeDepth}

STORY BEAT ANALYSIS WITH NARRATIVE INTELLIGENCE:
1. Break story into ${context.totalPanels} distinct narrative beats following ${narrativeIntel.storyArchetype} structure
2. Each beat serves specific story function aligned with archetype progression
3. Map character's emotional journey through ${narrativeIntel.emotionalArc.join(' → ')}
4. Identify visual storytelling moments that advance narrative and character growth
5. Ensure each panel has clear purpose in ${narrativeIntel.storyArchetype} progression
6. Integrate thematic elements: ${narrativeIntel.thematicElements.join(', ')}

✅ ENHANCED DIALOGUE ANALYSIS WITH SPEECH INTELLIGENCE:
7. Extract existing dialogue from story text using quotation marks and speech patterns
8. Identify emotional moments that would benefit from character speech
9. Assign dialogue to approximately ${Math.floor((context.speechBubbleRatio || 0.4) * 100)}% of panels strategically
10. Generate contextual dialogue for key emotional beats without existing speech
11. Ensure dialogue enhances story progression and character development
12. Apply speech bubble psychology based on emotional states

COMIC BOOK PROFESSIONAL STANDARDS:
- Every panel advances the ${narrativeIntel.storyArchetype} narrative
- Character actions serve archetype progression
- Visual flow guides reader through emotional arc
- Emotional beats create character growth arc
- Panel purposes build toward archetype resolution
- Speech bubbles enhance emotional connection and story clarity`;

    // Add failure recovery instructions if needed (FROM CURRENTAISERV.TXT)
    if (previousFailures.length > 0) {
      basePrompt += `\n\n🚨 CRITICAL: Previous attempts failed due to: ${previousFailures.join(', ')}. 
Ensure strict JSON format compliance and complete all required fields.`;
    }

    return basePrompt;
  }

  // ===== UTILITY METHODS =====
  // FIXED: All TypeScript errors resolved

  /**
   * Determine pacing strategy based on story content and audience
   */
  private determinePacingStrategy(story: string, audience: AudienceType): string {
    const storyLower = story.toLowerCase();
    
    if (audience === 'children') {
      return storyLower.includes('adventure') || storyLower.includes('exciting') ? 'action_packed' : 'slow_build';
    } else if (audience === 'young adults') {
      return storyLower.includes('emotion') || storyLower.includes('feel') ? 'emotional_depth' : 'action_packed';
    } else {
      return storyLower.includes('mystery') || storyLower.includes('discover') ? 'mystery_reveal' : 'emotional_depth';
    }
  }

  /**
   * Identify character growth opportunities in the story
   * FIXED: All TypeScript errors resolved
   */
  private async identifyCharacterGrowthOpportunities(story: string): Promise<string[]> {
    const storyLower = story.toLowerCase();
    const growthPatterns = [];

    // Pattern-based growth identification
    if (storyLower.includes('learn')) growthPatterns.push('gains_knowledge');
    if (storyLower.includes('brave') || storyLower.includes('courage')) growthPatterns.push('develops_courage');
    if (storyLower.includes('friend') || storyLower.includes('help')) growthPatterns.push('builds_relationships');
    if (storyLower.includes('change') || storyLower.includes('become')) growthPatterns.push('personal_transformation');
    if (storyLower.includes('overcome') || storyLower.includes('challenge')) growthPatterns.push('builds_resilience');

    // Ensure we have at least some growth patterns
    if (growthPatterns.length === 0) {
      growthPatterns.push('gains_confidence', 'develops_empathy', 'learns_responsibility');
    }

    return growthPatterns.slice(0, 4); // Limit to 4 growth patterns
  }

  /**
   * Enhanced emotional arc with thematic integration
   * FIXED: All TypeScript errors resolved
   */
  private enhanceEmotionalArc(baseArc: string[], thematicAnalysis: ThematicAnalysis): string[] {
    const enhancedArc = [...baseArc];
    
    // Add theme-specific emotional beats
    if (thematicAnalysis.primaryThemes.includes('friendship')) {
      enhancedArc.push('connection', 'loyalty');
    }
    if (thematicAnalysis.primaryThemes.includes('courage')) {
      enhancedArc.push('determination', 'bravery');
    }
    if (thematicAnalysis.primaryThemes.includes('wonder')) {
      enhancedArc.push('amazement', 'curiosity');
    }

    return [...new Set(enhancedArc)]; // Remove duplicates
  }

  /**
   * Calculate universal appeal score for themes
   * FIXED: All TypeScript errors resolved
   */
  private calculateUniversalAppeal(themes: string[]): number {
    const universalThemes = ['friendship', 'courage', 'kindness', 'growth', 'family', 'perseverance'];
    const universalCount = themes.filter(theme => universalThemes.includes(theme)).length;
    return Math.min(100, (universalCount / themes.length) * 100 + 20);
  }

  /**
   * Calculate audience alignment score
   * FIXED: All TypeScript errors resolved
   */
  private calculateAudienceAlignment(themes: string[], audience: AudienceType): number {
    const audienceThemes: Record<string, string[]> = {
      children: ['friendship', 'kindness', 'wonder', 'adventure', 'family'],
      'young adults': ['growth', 'courage', 'perseverance', 'friendship', 'identity'],
      adults: ['growth', 'perseverance', 'family', 'wisdom', 'responsibility']
    };

    const relevantThemes = audienceThemes[audience] || audienceThemes.children;
    const alignedCount = themes.filter(theme => relevantThemes.includes(theme)).length;
    return Math.min(100, (alignedCount / themes.length) * 100 + 30);
  }

  /**
   * Identify emotional resonance score
   * FIXED: All TypeScript errors resolved
   */
  private identifyEmotionalResonance(themes: string[]): number {
    const emotionalThemes = ['friendship', 'love', 'courage', 'kindness', 'perseverance', 'wonder'];
    const emotionalCount = themes.filter(theme => emotionalThemes.includes(theme)).length;
    return Math.min(100, (emotionalCount / themes.length) * 100 + 25);
  }

  /**
   * Generate alternative archetypes for validation
   * FIXED: All TypeScript errors resolved
   */
  private generateAlternativeArchetypes(story: string, primaryArchetype: string): string[] {
    const alternatives = Object.keys(STORYTELLING_ARCHETYPES).filter(
      archetype => archetype !== primaryArchetype
    );
    return alternatives.slice(0, 2);
  }

  /**
   * Generate reasoning factors for archetype selection
   * FIXED: All TypeScript errors resolved
   */
  private generateReasoningFactors(story: string, archetype: string): string[] {
    const factors = ['story_structure_analysis', 'character_journey_pattern'];
    
    if (story.toLowerCase().includes('journey')) factors.push('explicit_journey_references');
    if (story.toLowerCase().includes('discover')) factors.push('discovery_pattern_detected');
    if (story.toLowerCase().includes('change')) factors.push('transformation_indicators');
    
    return factors;
  }

  /**
   * Emergency narrative intelligence creation for robust operation
   * FIXED: All TypeScript errors resolved
   */
  private createEmergencyNarrativeIntelligence(story: string, audience: AudienceType): NarrativeIntelligence {
    console.log('⚠️ Using emergency narrative intelligence...');
    
    const archetype = this.detectStoryArchetypeFromPatterns(story);
    const archetypeData = STORYTELLING_ARCHETYPES[archetype as keyof typeof STORYTELLING_ARCHETYPES] || STORYTELLING_ARCHETYPES.discovery;
    const themes = this.extractThemesFromPatterns(story);

    return {
      storyArchetype: archetype as StoryArchetype,
      emotionalArc: [...archetypeData.emotionalArc], // Convert readonly to mutable
      thematicElements: themes.slice(0, 3),
      pacingStrategy: this.determinePacingStrategy(story, audience) as 'slow_build' | 'action_packed' | 'emotional_depth' | 'mystery_reveal',
      characterGrowth: ['gains_confidence', 'develops_empathy', 'learns_responsibility'],
      conflictProgression: [...archetypeData.structure], // Convert readonly to mutable
      confidence: 60,
      alternativeArchetypes: ['discovery', 'hero_journey'],
      audienceAlignment: 75,
      universalAppeal: 70,
      reasoningFactors: ['emergency_analysis', 'pattern_matching_only']
    };
  }
}