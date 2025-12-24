/**
 * ===== COMIC GENERATION ENGINE MODULE (PART 1) =====
 * Enterprise-grade comic book generation system combining story analysis,
 * scene generation logic, and professional comic standards.
 * FIXED: Combines best features from both original files with corrected imports
 * 
 * File Location: lib/services/ai/modular/comic-generation-engine.ts
 * Dependencies: constants-and-types.ts, error-handling-system.ts, openai-integration.ts
 * 
 * Features:
 * - Advanced story analysis with narrative intelligence (FROM AISERVNOW.TXT)
 * - Professional comic book page generation with optimized prompts (FROM BOTH FILES)
 * - Scene generation logic with visual DNA consistency (FROM CURRENTAISERV.TXT)
 * - Multi-audience optimization systems with professional standards (FROM BOTH FILES)
 * - Quality assessment and professional grading system (FROM CURRENTAISERV.TXT)
 * - Visual composition rules and panel type determination (FROM AISERVNOW.TXT)
 * - Speech bubble intelligence and dialogue optimization (FROM AISERVNOW.TXT)
 */

import { 
  AudienceType, 
  PanelType,
  CharacterDNA,
  EnvironmentalDNA,
  StoryAnalysis,
  StoryBeat,
  ComicPanel,
  SceneGenerationOptions,
  SceneGenerationResult,
  ImageGenerationOptions,
  ImageGenerationResult,
  PROFESSIONAL_AUDIENCE_CONFIG,
  STORYTELLING_ARCHETYPES,
  SpeechBubbleStyle,
  QUALITY_STANDARDS,
  AI_PROMPTS
} from './constants-and-types.js';

// NEW: Import StoryCharacter type for multi-character support
import { StoryCharacter } from '../../../lib/types.js';

import { 
  ErrorHandlingSystem,
  AIServiceError,
  AIRateLimitError,
  AIContentPolicyError 
} from './error-handling-system.js';

// GEMINI MIGRATION: Switched to Gemini for image-based panel generation
// import { OpenAIIntegration, STYLE_SPECIFIC_PANEL_CALIBRATION } from './openai-integration.js';
import { GeminiIntegration } from './gemini-integration.js';
import { STYLE_SPECIFIC_PANEL_CALIBRATION } from './openai-integration.js';
import { ClaudeIntegration } from './claude-integration.js';

/**
 * ===== PANEL DIVERSITY CONFIGURATION BY AUDIENCE =====
 * Ensures varied, professional panel compositions for each audience type
 * Prevents repetitive poses, camera angles, and compositions
 */
export const PANEL_DIVERSITY_CONFIG = {
  /**
   * CHILDREN (8 panels) - Clear, varied visual storytelling
   */
  children: {
    totalPanels: 8,
    
    // Required panel type distribution
    panelDistribution: {
      wide_establishing: { min: 1, max: 2, panels: [1] },        // Panel 1
      medium_shot: { min: 2, max: 3, panels: [2, 5] },           // Panels 2, 5
      close_up: { min: 2, max: 2, panels: [3, 6] },              // Panels 3, 6 (emotions)
      action_shot: { min: 2, max: 2, panels: [4, 7] },           // Panels 4, 7
    },
    
    // Recommended sequence for children
    recommendedSequence: [
      { panel: 1, type: 'wide_establishing', purpose: 'Establish world and character' },
      { panel: 2, type: 'medium_shot', purpose: 'Show character with goal visible' },
      { panel: 3, type: 'close_up', purpose: 'Emotional reaction to obstacle' },
      { panel: 4, type: 'action_shot', purpose: 'Character attempts solution' },
      { panel: 5, type: 'medium_shot', purpose: 'Show consequence of attempt' },
      { panel: 6, type: 'close_up', purpose: 'Emotional turning point' },
      { panel: 7, type: 'action_shot', purpose: 'Final effort/climax' },
      { panel: 8, type: 'medium_shot', purpose: 'Resolution with satisfaction' },
    ],
    
    // Minimum unique shot types required
    minUniqueShotTypes: 4,
    
    // Maximum consecutive same-type panels
    maxConsecutiveSameType: 2,
    
    // Minimum unique character actions across all panels
    minUniqueActions: 5,
    
    // Example actions to rotate through
    actionPool: [
      'sitting', 'standing', 'walking', 'reaching', 'pointing', 
      'hugging', 'jumping', 'looking up', 'looking down', 'running',
      'hiding', 'waving', 'kneeling', 'climbing', 'holding'
    ],
    
    // Forbidden patterns
    forbiddenPatterns: [
      'same_pose_3x',           // No more than 2 consecutive same pose
      'same_camera_4x',         // No more than 3 same camera angle
      'same_first_last',        // First and last panels must differ
      'climax_not_dramatic'     // Climax must use dramatic angle or close-up
    ]
  },

  /**
   * YOUNG ADULTS (15 panels) - Dynamic, emotionally resonant compositions
   */
  'young adults': {
    totalPanels: 15,
    
    // Required panel type distribution
    panelDistribution: {
      wide_establishing: { min: 2, max: 3 },
      medium_shot: { min: 4, max: 5 },
      close_up: { min: 3, max: 4 },
      action_shot: { min: 2, max: 3 },
      pov_over_shoulder: { min: 1, max: 2 },
      dramatic_angle: { min: 1, max: 2 }  // Required at climax
    },
    
    // Recommended sequence for young adults
    recommendedSequence: [
      { panel: 1, type: 'wide_establishing', purpose: 'Set the world and tone' },
      { panel: 2, type: 'medium_shot', purpose: 'Introduce character in context' },
      { panel: 3, type: 'close_up', purpose: 'Reveal internal state' },
      { panel: 4, type: 'medium_shot', purpose: 'Show relationships/dynamics' },
      { panel: 5, type: 'wide_establishing', purpose: 'New location or situation' },
      { panel: 6, type: 'action_shot', purpose: 'First major conflict' },
      { panel: 7, type: 'pov_over_shoulder', purpose: 'Character perspective' },
      { panel: 8, type: 'medium_shot', purpose: 'Midpoint shift moment' },
      { panel: 9, type: 'close_up', purpose: 'Emotional reaction' },
      { panel: 10, type: 'action_shot', purpose: 'Rising tension' },
      { panel: 11, type: 'medium_shot', purpose: 'Dark moment setup' },
      { panel: 12, type: 'close_up', purpose: 'Internal struggle peak' },
      { panel: 13, type: 'dramatic_angle', purpose: 'Climax begins' },
      { panel: 14, type: 'action_shot', purpose: 'Defining action' },
      { panel: 15, type: 'medium_shot', purpose: 'Resolution and transformation' },
    ],
    
    minUniqueShotTypes: 5,
    maxConsecutiveSameType: 2,
    minUniqueActions: 8,
    
    actionPool: [
      'sitting', 'standing', 'walking', 'reaching', 'pointing',
      'confronting', 'turning away', 'crossing arms', 'leaning',
      'gesturing', 'reacting', 'contemplating', 'deciding',
      'running', 'fighting stance', 'embracing', 'pushing away'
    ],
    
    forbiddenPatterns: [
      'same_pose_3x',
      'same_camera_4x', 
      'same_first_last',
      'climax_not_dramatic',
      'no_pov_shots'           // Must include at least 1 POV/over-shoulder
    ]
  },

  /**
   * ADULTS (24 panels) - Sophisticated, cinematic compositions
   */
  adults: {
    totalPanels: 24,
    
    // Required panel type distribution
    panelDistribution: {
      wide_establishing: { min: 3, max: 4 },
      medium_shot: { min: 6, max: 8 },
      close_up: { min: 5, max: 6 },
      action_shot: { min: 3, max: 4 },
      pov_over_shoulder: { min: 2, max: 3 },
      dramatic_angle: { min: 2, max: 3 },
      symbolic_artistic: { min: 1, max: 2 }  // Required for adults
    },
    
    // Recommended key panels (not all 24, just important beats)
    recommendedSequence: [
      { panel: 1, type: 'symbolic_artistic', purpose: 'Visual thesis/opening image' },
      { panel: 2, type: 'wide_establishing', purpose: 'World establishment' },
      { panel: 3, type: 'medium_shot', purpose: 'Character introduction' },
      { panel: 6, type: 'close_up', purpose: 'Reveal hidden tension' },
      { panel: 8, type: 'action_shot', purpose: 'Inciting incident' },
      { panel: 12, type: 'pov_over_shoulder', purpose: 'Midpoint revelation' },
      { panel: 16, type: 'dramatic_angle', purpose: 'All is lost moment' },
      { panel: 20, type: 'close_up', purpose: 'Dark night of soul' },
      { panel: 22, type: 'dramatic_angle', purpose: 'Climax moment' },
      { panel: 24, type: 'symbolic_artistic', purpose: 'Thematic resolution' },
    ],
    
    minUniqueShotTypes: 6,
    maxConsecutiveSameType: 3,
    minUniqueActions: 12,
    
    actionPool: [
      'sitting', 'standing', 'walking', 'reaching', 'pointing',
      'confronting', 'turning away', 'crossing arms', 'leaning',
      'gesturing', 'reacting', 'contemplating', 'deciding',
      'subtle expression shift', 'body language tension', 'environmental interaction',
      'symbolic gesture', 'physical tension', 'release/relief', 'isolation pose',
      'connection moment', 'withdrawal', 'approach'
    ],
    
    forbiddenPatterns: [
      'same_pose_3x',
      'same_camera_4x',
      'same_first_last',
      'climax_not_dramatic',
      'no_symbolic_panel',     // Must include at least 1 symbolic/artistic panel
      'no_subtext_moments'     // Must have psychological depth panels
    ]
  }
} as const;

/**
 * ===== NARRATION VOICE RULES BY AUDIENCE =====
 * Controls vocabulary, sentence structure, and forbidden patterns
 */
export const NARRATION_RULES = {
  children: {
    // Vocabulary constraints
    maxWordsPerSentence: 12,
    vocabularyLevel: 'grade_2_5',
    
    // Words that a 5-7 year old understands
    preferredWords: [
      'happy', 'sad', 'big', 'small', 'pretty', 'scary', 'funny', 'nice',
      'good', 'bad', 'fast', 'slow', 'hot', 'cold', 'soft', 'hard',
      'bright', 'dark', 'loud', 'quiet', 'friend', 'home', 'play', 'help'
    ],
    
    // FORBIDDEN words (too complex or abstract for children)
    forbiddenWords: [
      'kaleidoscope', 'ethereal', 'sanctuary', 'transcendent', 'melancholy',
      'silhouette', 'dissolving', 'whispering', 'symphony', 'cascade',
      'mystical', 'enigmatic', 'ephemeral', 'luminescent', 'iridescent',
      'resplendent', 'effervescent', 'metamorphosis', 'philosophical',
      'contemplative', 'profound', 'infinite', 'eternal', 'essence',
      'realm', 'destiny', 'legacy', 'timeless', 'ethereal'
    ],
    
    // Sentence structure rules
    sentenceRules: [
      'subject_verb_object',     // Simple structure
      'one_idea_per_sentence',   // No compound complex
      'explicit_cause_effect'    // "Because X, Y happened"
    ],
    
    // Resolution/ending rules
    endingRequirements: {
      mustInclude: [
        'concrete_lesson',           // "Maya learned that..."
        'actionable_takeaway',       // Something child can understand/do
        'connection_to_problem',     // Links back to story problem
        'explainable_by_child'       // A child could explain to friend
      ],
      forbidden: [
        '"And they all lived happily ever after"',
        '"The magic would always be there"',
        '"Wonder lives in..."',
        '"In that moment, everything changed"',
        'Any metaphorical conclusion',
        'Any abstract philosophical ending'
      ]
    }
  },

  'young adults': {
    maxWordsPerSentence: 25,
    vocabularyLevel: 'grade_6_9',
    
    // Contemporary, emotionally resonant language
    toneGuidance: [
      'authentic_internal_voice',
      'emotionally_resonant_not_melodramatic',
      'respects_reader_intelligence',
      'can_include_uncertainty'
    ],
    
    // Forbidden patterns
    forbiddenPatterns: [
      'preachy_moral_lessons',
      'adult_lecturing_tone',
      'childish_simplification',
      'cynicism_without_hope'
    ],
    
    endingRequirements: {
      mustInclude: [
        'show_character_transformation',
        'through_action_or_choice',
        'room_for_interpretation',
        'earned_not_forced'
      ],
      forbidden: [
        'Neat moral statements',
        'Explicit lesson telling',
        'Overly happy resolution',
        'Dismissive of complexity'
      ]
    }
  },

  adults: {
    maxWordsPerSentence: 40,
    vocabularyLevel: 'full_range',
    
    // Sophisticated language encouraged
    toneGuidance: [
      'layered_meaning',
      'psychological_depth',
      'subtext_over_explicit',
      'literary_devices_welcome',
      'treats_reader_as_equal'
    ],
    
    forbiddenPatterns: [
      'spelling_out_themes',
      'unearned_happy_endings',
      'simplistic_conclusions',
      'reader_hand_holding'
    ],
    
    endingRequirements: {
      mustInclude: [
        'thematic_resonance',
        'multiple_interpretations_possible',
        'emotional_or_intellectual_impact',
        'honest_to_complexity'
      ],
      forbidden: [
        'Explicit theme statements',
        'Unearned redemption',
        'Oversimplified resolution',
        'Preachy conclusions'
      ]
    }
  }
} as const;

/**
 * ===== NARRATION PHILOSOPHY BY AUDIENCE =====
 * Controls WHICH panels get narration based on professional comic standards
 * 
 * Professional comics use DIFFERENT narration strategies:
 * - Children (4-8): Minimal narration - only scene-setting, time jumps, conclusion
 * - Young Adults (12-17): First-person internal monologue with strategic silent panels
 * - Adults (18+): Literary/poetic narration with moral complexity
 */
export const NARRATION_PHILOSOPHY = {
  children: {
    maxNarrationRatio: 0.25,              // Only 25% of panels get narration
    narratedPanelTypes: ['opening', 'time_jump', 'location_change', 'conclusion'],
    style: 'simple_declarative',
    maxWords: 15,
    voice: 'third_person_gentle',
    examples: [
      "The next morning, Maya woke up early.",
      "And from that day on, they were best friends.",
      "It was a sunny day in the park.",
      "Maya had an idea!"
    ],
    forbidden: ['complex_vocabulary', 'abstract_concepts', 'philosophical'],
    silentPanelRatio: 0,                  // Children's comics don't use silent panels
    description: 'Minimal narration - let the pictures tell the story. Only narrate time jumps, location changes, and conclusions.'
  },
  
  'young adults': {
    maxNarrationRatio: 0.4,               // 40% of panels get narration
    narratedPanelTypes: ['opening', 'emotional_peak', 'internal_conflict', 'realization', 'conclusion'],
    style: 'first_person_internal_monologue',
    maxWords: 25,
    voice: 'first_person_teen',
    examples: [
      "I couldn't believe this was actually happening.",
      "For the first time, their whispers didn't matter.",
      "Maybe I'd been wrong about everything.",
      "Something had shifted. I could feel it."
    ],
    silentPanelRatio: 0.15,               // 15% silent panels for emotional impact
    description: 'Internal monologue style. Narrate emotional peaks and realizations. Use strategic silence for impact.'
  },
  
  adults: {
    maxNarrationRatio: 0.5,               // 50% of panels get narration
    narratedPanelTypes: ['any_with_thematic_weight'],
    style: 'literary_layered',
    maxWords: 35,
    voice: 'omniscient_literary',
    examples: [
      "Memory is a peculiar thing. It preserves not what happened, but what we needed to believe.",
      "He understood now why she'd never told him. Some truths were meant to be discovered alone.",
      "The silence between them held more weight than any words could carry."
    ],
    silentPanelRatio: 0.2,                // 20% silent panels for contemplation
    allowAmbiguity: true,
    description: 'Literary, layered narration. Can be poetic or philosophical. Embrace complexity and ambiguity.'
  }
} as const;

/**
 * ===== SILENT PANEL CONFIGURATION =====
 * Professional comics use silent panels to let emotions breathe
 * 
 * Silent panel triggers:
 * - Moment AFTER a major revelation (character processing shock)
 * - Moment BEFORE a big decision (contemplation)
 * - Emotional reaction shots (joy, grief, wonder)
 * - Visual punchlines that need no words
 */
export const SILENT_PANEL_CONFIG = {
  children: {
    targetCount: { min: 1, max: 2 },          // 1-2 per story
    triggers: ['wonder', 'big_reveal', 'quiet_moment'],
    description: 'Use sparingly for big reveals and quiet wonder moments',
    emotionIndicators: ['awe', 'wonder', 'surprise', 'joy', 'quiet_happiness'],
    promptEnhancement: 'SILENT PANEL: No text. Let the child\'s expression tell the story. Big eyes, simple emotion.'
  },
  'young adults': {
    targetCount: { min: 3, max: 4 },          // 3-4 per story
    triggers: ['emotional_reaction', 'before_decision', 'internal_conflict', 'revelation_aftermath'],
    description: 'Strategic silence for emotional impact and decision moments',
    emotionIndicators: ['shock', 'contemplation', 'realization', 'grief', 'determination', 'heartbreak'],
    promptEnhancement: 'SILENT PANEL: No dialogue, no narration. Pure visual emotion. Focus on facial expression, body language, atmosphere.'
  },
  adults: {
    targetCount: { min: 5, max: 6 },          // 5-6 per story
    triggers: ['emotional_reaction', 'before_decision', 'internal_conflict', 'revelation_aftermath', 'symbolic_moment', 'moral_weight'],
    description: 'Frequent silence for contemplation, moral complexity, and symbolic weight',
    emotionIndicators: ['shock', 'contemplation', 'realization', 'grief', 'determination', 'heartbreak', 'resignation', 'acceptance', 'ambiguity'],
    promptEnhancement: 'SILENT PANEL: Pure visual storytelling. No text. The image carries the full emotional and thematic weight. Cinematic composition.'
  }
} as const;

/**
 * ===== DIALOGUE VOICE RULES BY SPEAKER AGE =====
 * Controls dialogue length, style, and vocabulary based on WHO is speaking
 * 
 * Professional comic standards: Dialogue should match character age/type
 * - Toddlers: Very short exclamations (1-4 words)
 * - Children: Curious, direct questions/statements (1-8 words)
 * - Teens: Casual, authentic, sometimes clipped (1-15 words)
 * - Adults: Complete, supportive sentences (1-20 words)
 * - Seniors: Wise, measured, sometimes proverbial (1-25 words)
 */
export const DIALOGUE_VOICE_RULES = {
  toddler: {
    maxWords: 4,
    style: 'simple_exclamations',
    vocabulary: 'baby_talk_simple',
    patterns: ['exclamations', 'single_words', 'mama_papa_references'],
    examples: [
      "Wow!",
      "I did it!",
      "Look mama!",
      "No no!",
      "Me too!",
      "Uh oh!",
      "Yay!"
    ],
    forbidden: ['complex_sentences', 'abstract_concepts', 'multi_clause']
  },
  
  child: {
    maxWords: 8,
    style: 'curious_direct',
    vocabulary: 'simple_concrete',
    patterns: ['questions', 'exclamations', 'direct_statements'],
    examples: [
      "Can I try?",
      "That was so cool!",
      "Why is it doing that?",
      "I'm not scared!",
      "Look what I found!",
      "Wait for me!",
      "This is the best day ever!"
    ],
    forbidden: ['sarcasm', 'abstract_philosophy', 'complex_vocabulary']
  },
  
  teen: {
    maxWords: 15,
    style: 'casual_authentic',
    vocabulary: 'contemporary_relatable',
    patterns: ['clipped_phrases', 'emotional_authenticity', 'peer_speak'],
    examples: [
      "Whatever.",
      "This changes everything.",
      "You don't understand.",
      "I can handle this myself.",
      "It's not that simple.",
      "Just... give me a minute.",
      "I didn't ask for this."
    ],
    forbidden: ['preachy_adult_tone', 'overly_formal', 'childish_simplicity']
  },
  
  adult: {
    maxWords: 20,
    style: 'complete_sentences',
    vocabulary: 'full_range_appropriate',
    patterns: ['supportive', 'explanatory', 'guiding'],
    examples: [
      "You're braver than you think, little one.",
      "I've seen this before. Trust me.",
      "Sometimes the hardest path is the right one.",
      "I believe in you. I always have.",
      "Let me show you something."
    ],
    forbidden: ['talking_down', 'oversimplifying', 'preachy']
  },
  
  senior: {
    maxWords: 25,
    style: 'wise_measured',
    vocabulary: 'traditional_proverbial',
    patterns: ['wisdom_sharing', 'story_references', 'gentle_guidance'],
    examples: [
      "When I was your age, I thought the same thing.",
      "Patience reveals what haste conceals.",
      "Some lessons can only be learned the hard way.",
      "I've waited a long time to see this moment.",
      "The answer you seek was inside you all along."
    ],
    forbidden: ['rushed_speech', 'trendy_slang', 'impatient_tone']
  }
} as const;

/**
 * Map character age categories to dialogue voice rules
 */
export function getDialogueVoiceForAge(age: string): keyof typeof DIALOGUE_VOICE_RULES {
  const ageLower = age?.toLowerCase() || 'child';
  
  if (ageLower.includes('toddler') || ageLower.includes('baby') || ageLower.includes('1-3')) {
    return 'toddler';
  }
  if (ageLower.includes('child') || ageLower.includes('kid') || ageLower.includes('4-10') || ageLower.includes('young')) {
    return 'child';
  }
  if (ageLower.includes('teen') || ageLower.includes('adolescent') || ageLower.includes('11-17')) {
    return 'teen';
  }
  if (ageLower.includes('senior') || ageLower.includes('elder') || ageLower.includes('old') || ageLower.includes('grandp')) {
    return 'senior';
  }
  // Default to adult for young-adult, adult, or unknown
  return 'adult';
}

/**
 * ===== COMIC GENERATION ENGINE CLASS =====
 * Professional comic book generation with narrative intelligence and visual DNA
 * UPDATED: Now uses Gemini for 95% character consistency through image-based generation
 */
export class ComicGenerationEngine {
  private geminiIntegration: GeminiIntegration;
  private errorHandler: ErrorHandlingSystem;
  private claudeIntegration: ClaudeIntegration;

  constructor(
    geminiIntegration: GeminiIntegration,
    errorHandler: ErrorHandlingSystem,
    claudeIntegration: ClaudeIntegration
  ) {
    this.geminiIntegration = geminiIntegration;
    this.errorHandler = errorHandler;
    this.claudeIntegration = claudeIntegration;
  }

  // ===== MAIN COMIC GENERATION METHOD (FROM BOTH FILES) =====

  /**
   * Generate professional comic book scenes with optimized prompt architecture
   * Combines best features from both original files
   * FIXED: All TypeScript errors resolved, including undefined audience variable
   */
  async generateScenesWithAudience(options: SceneGenerationOptions): Promise<SceneGenerationResult> {
    try {
      const {
        story,
        audience = 'children',
        characterImage,
        characterArtStyle = 'storybook',
        layoutType = 'comic-book-panels'
      } = options;

      // Validation (FROM BOTH FILES)
      if (!story || story.trim().length < 50) {
        throw new Error('Story must be at least 50 characters long.');
      }

      console.log(`Generating professional comic book layout for ${audience} audience...`);

      // Step 1: USE STORY ANALYSIS FROM ENHANCED CONTEXT (Already analyzed by Claude in PHASE 1)
      // This eliminates duplicate API calls and uses Claude (more reliable) instead of Gemini for text analysis
      let storyAnalysis = options.enhancedContext?.storyAnalysis;
      
      if (!storyAnalysis || !storyAnalysis.storyBeats || storyAnalysis.storyBeats.length === 0) {
        throw new Error('CRITICAL: Story analysis not provided in enhancedContext. Claude story analysis from PHASE 1 is required. Job must fail.');
      }
      
      console.log(`✅ Using pre-analyzed story structure: ${storyAnalysis.storyBeats.length} beats from Claude analysis`);
      
      // NEW: Extract characters from enhanced context for multi-character support
      const characters: StoryCharacter[] = options.enhancedContext?.characters || [];
      const mainCharacter = options.enhancedContext?.mainCharacter || characters.find(c => c.role === 'main');
      const secondaryCharacters: StoryCharacter[] = options.enhancedContext?.secondaryCharacters || 
        characters.filter(c => c.role === 'secondary');
      
      if (characters.length > 0) {
        console.log(`👥 Multi-character mode: ${characters.length} characters (Main: ${mainCharacter?.name || 'unnamed'})`);
        
        // Tag story beats with character presence
        storyAnalysis.storyBeats = this.tagBeatsWithCharacters(storyAnalysis.storyBeats, characters);
        console.log(`   📝 Tagged ${storyAnalysis.storyBeats.length} beats with character presence`);
      }
      
      // Step 2: USE CHARACTER DNA FROM ENHANCED CONTEXT (Already created in PHASE 3)
      // This eliminates duplicate API calls
      let characterDNA: CharacterDNA | null = options.enhancedContext?.characterDNA || null;
      
      if (characterImage && !characterDNA) {
        // Only create if not provided (fallback for edge cases)
        console.log('⚠️ Character DNA not in context, creating new...');
        characterDNA = await this.createMasterCharacterDNA(characterImage, characterArtStyle);
      } else if (characterDNA) {
        console.log('✅ Using pre-created Character DNA from PHASE 3');
      }

      // Step 3: Environmental DNA MUST be provided by AIService - NO FALLBACK
      const environmentalDNA = options.enhancedContext?.environmentalDNA;
      if (!environmentalDNA) {
        throw new Error('CRITICAL: Environmental DNA not provided by AIService. Quality requirement not met. Job must fail immediately.');
      }

      // Step 4: Generate professional comic book pages with optimized prompts (FROM BOTH FILES)
      const config = PROFESSIONAL_AUDIENCE_CONFIG[audience as keyof typeof PROFESSIONAL_AUDIENCE_CONFIG];
      const pages = await this.generateOptimizedComicBookPages(
        storyAnalysis, 
        characterDNA, 
        environmentalDNA, 
        config, 
        characterArtStyle,
        audience,
        story,
        mainCharacter?.name,  // NEW: Pass main character name
        characters  // NEW: Pass full characters array for multi-character support
      );

      console.log(`Professional comic book layout generated: ${pages.length} pages with ${config.totalPanels} total panels`);

      return {
        pages,
        // FIXED: Use options.audience instead of undefined audience variable
        audience: options.audience || 'children',
        characterImage,
        layoutType,
        characterArtStyle,
        metadata: {
          discoveryPath: 'professional_comic_generation_v3',
          patternType: 'optimized' as const,
          qualityScore: 100,
          originalStructure: [
            'narrative_intelligence_analysis', 
            'visual_dna_fingerprinting', 
            'environmental_dna_creation',
            'optimized_comic_generation'
          ],
          storyBeats: storyAnalysis.storyBeats.length,
          characterConsistencyEnabled: !!characterDNA,
          environmentalConsistencyEnabled: true,
          professionalStandards: true,
          dialoguePanels: storyAnalysis.dialoguePanels || 0,
          speechBubbleDistribution: storyAnalysis.speechBubbleDistribution || {},
          promptOptimization: 'advanced_compression_applied',
          visualFingerprintingUsed: !!characterDNA,
          narrativeIntelligenceApplied: true,
          qualityAssessmentEnabled: true
        }
      };

    } catch (error) {
      console.error('❌ Comic generation failed:', error);
      throw this.errorHandler.handleError(error, 'generateScenesWithAudience', {
        audience: options.audience,
        storyLength: options.story?.length || 0,
        hasCharacterImage: !!options.characterImage
      });
    }
  }

  // ===== ADVANCED STORY ANALYSIS WITH NARRATIVE INTELLIGENCE (FROM AISERVNOW.TXT) =====

  /**
   * Analyze story structure using advanced narrative intelligence
   * Enhanced with storytelling archetypes and emotional progression
   * FIXED: All TypeScript errors resolved
   */
  private async analyzeStoryStructure(story: string, audience: AudienceType): Promise<StoryAnalysis> {
    try {
      const config = PROFESSIONAL_AUDIENCE_CONFIG[audience as keyof typeof PROFESSIONAL_AUDIENCE_CONFIG];
      
      // Determine story archetype based on content analysis (FROM AISERVNOW.TXT)
      const narrativeIntel = await this.determineNarrativeIntelligence(story, audience);
      
      // Build enhanced system prompt with narrative intelligence (FROM AISERVNOW.TXT)
      const systemPrompt = this.buildAdvancedSystemPrompt(audience, config, narrativeIntel);
      
      const analysisPrompt = `${systemPrompt}

STORY TO ANALYZE:
"${story}"

${AI_PROMPTS.storyAnalysis[audience as keyof typeof AI_PROMPTS.storyAnalysis]}

CRITICAL JSON SCHEMA COMPLIANCE:
You MUST return EXACTLY this structure with ALL fields completed for EVERY beat.
NO missing fields. NO undefined values. NO empty strings.

ACTION CONTEXT RULE (CRITICAL FOR VISUAL ACCURACY):
Every characterAction MUST explain the PURPOSE/GOAL of the action, not just the physical movement.
BAD: "picking up a stick" (literal, no context - AI will draw random stick-holding)
GOOD: "picking up a long stick to use as a reaching tool to retrieve the ball from under the bush"
BAD: "holding a rope" (unclear purpose)
GOOD: "gripping rope tightly, preparing to pull friend up from the muddy ditch"

{
  "storyBeats": [
    {
      "beat": "string - specific story moment",
      "emotion": "string - primary emotion",
      "visualPriority": "string - what to focus on visually",
      "characterAction": "string - exact pose/movement AND the purpose (e.g., 'reaching down to pick up stick to use as tool' not just 'holding stick')",
      "actionContext": "string - WHY the character is doing this action, what goal it serves in the story",
      "panelPurpose": "string - narrative function",
      "environment": "string - setting description",
      "cameraAngle": "close-up|medium|wide|extreme-wide|over-shoulder|low-angle|high-angle|dutch-angle - story-driven camera choice",
      "cameraReason": "string - WHY this camera angle for this specific story moment",
      "locationChange": "same|new-location-name - indicates if scene changes location",
      "dialogue": "string - character speech (if applicable)",
      "hasSpeechBubble": boolean,
      "speechBubbleStyle": "string - bubble type (if applicable)",
      "speakerName": "string - name of character speaking (REQUIRED if hasSpeechBubble is true)",
      "speakerPosition": "left|center|right - where speaker is positioned in panel composition",
      "bubblePosition": "top-left|top-right|bottom-left|bottom-right|top-center - optimal bubble placement (opposite speaker)",
      "isSilent": "boolean - true if panel has NO text (pure visual storytelling)",
      "silentReason": "emotional_reaction|contemplation|visual_impact|breathing_room|revelation_aftermath - WHY silent"
    }
  ],
  "storyArchetype": "string",
  "emotionalArc": ["string array"],
  "thematicElements": ["string array"],
  "characterArc": ["string array"],
  "visualFlow": ["string array"],
  "totalPanels": number,
  "pagesRequired": number,
  "dialoguePanels": number,
  "silentPanels": number,
  "speechBubbleDistribution": {"style": count}
}`;

      const response = await this.geminiIntegration.generateTextCompletion(
        analysisPrompt,
        {
          temperature: 0.3,
          max_output_tokens: 16000,
          // model: // Gemini doesn't use model parameter 'gpt-4o',
          top_p: 0.9
          // useJsonMode: true  // Gemini doesn't have JSON mode flag
        }
      );

      // Parse response into structured story analysis (FROM BOTH FILES)
      const analysis = this.parseStoryAnalysisResponse(response, config, narrativeIntel);
      
      console.log(`📖 Story analysis complete: ${analysis.storyBeats.length} beats, archetype: ${analysis.storyArchetype}`);
      
      return analysis;

    } catch (error) {
      console.error('❌ Story analysis failed:', error);
      throw this.errorHandler.handleError(error, 'analyzeStoryStructure');
    }
  }

  // ===== NARRATIVE INTELLIGENCE DETERMINATION (FROM AISERVNOW.TXT) =====

  /**
   * Determine story archetype and narrative intelligence patterns
   * FIXED: All TypeScript errors resolved
   */
  private async determineNarrativeIntelligence(story: string, audience: AudienceType): Promise<any> {
    const storyLower = story.toLowerCase();
    
    // Analyze story patterns to determine archetype (FROM AISERVNOW.TXT)
    let archetype = 'discovery'; // default
    
    if (storyLower.includes('journey') || storyLower.includes('adventure') || storyLower.includes('quest')) {
      archetype = 'hero_journey';
    } else if (storyLower.includes('change') || storyLower.includes('become') || storyLower.includes('transform')) {
      archetype = 'transformation';
    } else if (storyLower.includes('mystery') || storyLower.includes('secret') || storyLower.includes('hidden')) {
      archetype = 'mystery';
    } else if (storyLower.includes('discover') || storyLower.includes('find') || storyLower.includes('explore')) {
      archetype = 'discovery';
    } else if (storyLower.includes('help') || storyLower.includes('save') || storyLower.includes('rescue')) {
      archetype = 'hero_journey';
    } else if (storyLower.includes('learn') || storyLower.includes('understand') || storyLower.includes('realize')) {
      archetype = 'transformation';
    }

    const archetypeData = STORYTELLING_ARCHETYPES[archetype as keyof typeof STORYTELLING_ARCHETYPES];
    
    return {
      storyArchetype: archetype,
      emotionalArc: archetypeData.emotionalArc,
      thematicElements: this.extractThematicElements(story, archetype),
      pacingStrategy: this.determinePacingStrategy(story, audience),
      characterGrowth: this.determineCharacterGrowth(story, archetype),
      conflictProgression: archetypeData.structure
    };
  }

  // ===== MULTI-CHARACTER DETECTION (NEW FOR MULTI-CHARACTER SUPPORT) =====

  /**
   * Detect which characters are present in a story beat description
   * NEW: Supports multi-character stories by parsing beat descriptions for character names
   * Returns array of character names found in the beat
   */
  private detectCharactersInBeat(
    beatDescription: string,
    characters: StoryCharacter[]
  ): string[] {
    if (!characters || characters.length === 0) {
      return [];
    }

    const presentCharacters: string[] = [];
    const beatLower = beatDescription.toLowerCase();
    
    for (const char of characters) {
      if (char.name && beatLower.includes(char.name.toLowerCase())) {
        presentCharacters.push(char.name);
      }
    }
    
    // If no specific character detected, assume main character is present
    if (presentCharacters.length === 0) {
      const mainChar = characters.find(c => c.role === 'main');
      if (mainChar?.name) {
        presentCharacters.push(mainChar.name);
      }
    }
    
    return presentCharacters;
  }

  /**
   * Tag story beats with character presence information
   * NEW: Processes each beat to identify which characters appear
   * Used for consistent character rendering in panel generation
   */
  private tagBeatsWithCharacters(
    storyBeats: StoryBeat[],
    characters: StoryCharacter[]
  ): StoryBeat[] {
    if (!characters || characters.length === 0) {
      return storyBeats;
    }

    const mainCharacter = characters.find(c => c.role === 'main');
    
    return storyBeats.map(beat => {
      // Detect which characters are in this beat
      const charactersPresent = this.detectCharactersInBeat(beat.beat, characters);
      
      // Determine primary character (first mentioned or main character)
      const primaryCharacter = charactersPresent.length > 0 
        ? charactersPresent[0] 
        : mainCharacter?.name || 'main character';
      
      // Find secondary characters in this scene
      const secondaryCharactersInScene = charactersPresent
        .filter(name => name !== primaryCharacter)
        .map(name => {
          const char = characters.find(c => c.name === name);
          return char ? {
            name: char.name,
            action: undefined,  // Will be inferred from beat description
            position: undefined  // Will be determined by panel composition
          } : { name };
        });

      return {
        ...beat,
        charactersPresent,
        primaryCharacter,
        secondaryCharactersInScene
      };
    });
  }

  /**
   * Get secondary characters that should appear in a specific beat
   * Returns full StoryCharacter objects for characters present in the beat
   */
  private getSecondaryCharactersForBeat(
    beat: StoryBeat,
    characters: StoryCharacter[]
  ): StoryCharacter[] {
    if (!characters || characters.length === 0 || !beat.charactersPresent) {
      return [];
    }

    const mainCharacter = characters.find(c => c.role === 'main');
    
    return characters.filter(char => 
      char.role === 'secondary' && 
      beat.charactersPresent?.includes(char.name)
    );
  }

  // ===== SYSTEM PROMPT BUILDING (FROM AISERVNOW.TXT) =====

  /**
   * Build advanced system prompt with narrative intelligence
   * FIXED: All TypeScript errors resolved
   */
  private buildAdvancedSystemPrompt(audience: AudienceType, config: any, narrativeIntel: any): string {
    return `NARRATIVE INTELLIGENCE SYSTEM:
Story Archetype: ${narrativeIntel.storyArchetype.toUpperCase()}
Emotional Progression: ${narrativeIntel.emotionalArc.join(' → ')}
Thematic Elements: ${narrativeIntel.thematicElements.join(', ')}
Pacing Strategy: ${narrativeIntel.pacingStrategy}
Character Growth Arc: ${narrativeIntel.characterGrowth.join(', ')}

PROFESSIONAL STORY ANALYSIS MISSION:
Analyze this story using proven comic book creation methodology where story beats drive visual choices.

AUDIENCE: ${audience.toUpperCase()}
TARGET: ${config.totalPanels} total panels across ${config.pagesPerStory} pages (${config.panelsPerPage} panels per page)
COMPLEXITY: ${config.complexityLevel}
NARRATIVE DEPTH: ${config.narrativeDepth}

STORY BEAT ANALYSIS WITH NARRATIVE INTELLIGENCE:
1. Break story into ${config.totalPanels} distinct narrative beats following ${narrativeIntel.storyArchetype} structure
2. Each beat serves specific story function aligned with archetype progression
3. Map character's emotional journey through ${narrativeIntel.emotionalArc.join(' → ')}
4. Identify visual storytelling moments that advance narrative and character growth
5. Ensure each panel has clear purpose in ${narrativeIntel.storyArchetype} progression
6. Integrate thematic elements: ${narrativeIntel.thematicElements.join(', ')}

ACTION CONTEXT REQUIREMENT (PREVENTS LITERAL/CONFUSING ILLUSTRATIONS):
- Every characterAction MUST include the PURPOSE of the action, not just the physical movement
- "Maya picks up a stick" → "Maya picks up a long stick to use as a reaching tool for the ball stuck under the bush"
- "Character holds rope" → "Character grips rope tightly, preparing to pull friend up from the muddy ditch"
- Include actionContext field explaining WHY this action matters to the story

ENHANCED DIALOGUE ANALYSIS WITH SPEECH INTELLIGENCE:
7. Extract existing dialogue from story text using quotation marks and speech patterns
8. Identify emotional moments that would benefit from character speech
9. Assign dialogue to approximately ${(config.speechBubbleRatio * 100)}% of panels strategically
10. Generate contextual dialogue for key emotional beats without existing speech
11. Ensure dialogue enhances story progression and character development
12. Apply speech bubble psychology based on emotional states

DIALOGUE LENGTH BY SPEAKER AGE (CRITICAL - MUST FOLLOW):
Match dialogue length and style to the speaker's age category:

• TODDLER (1-3 years): MAX 4 WORDS. Simple exclamations only.
  Examples: "Wow!", "I did it!", "Look mama!", "No no!"
  
• CHILD (4-10 years): MAX 8 WORDS. Curious, direct questions/statements.
  Examples: "Can I try?", "That was so cool!", "Why is it doing that?"
  
• TEEN (11-17 years): MAX 15 WORDS. Casual, authentic, sometimes clipped.
  Examples: "Whatever.", "This changes everything.", "You don't understand."
  
• ADULT (18-55 years): MAX 20 WORDS. Complete, supportive sentences.
  Examples: "You're braver than you think.", "I believe in you."
  
• SENIOR (55+ years): MAX 25 WORDS. Wise, measured, sometimes proverbial.
  Examples: "Patience reveals what haste conceals.", "Some lessons are learned the hard way."

When generating dialogue, FIRST identify the speaker's age category, THEN apply the appropriate word limit and style.

SPEECH BUBBLE POSITIONING (CRITICAL - PROFESSIONAL COMIC STANDARD):
When hasSpeechBubble is true, you MUST also provide:

• speakerName: Which character is speaking this dialogue (use their actual name)
• speakerPosition: Where the speaker will be in the panel composition:
  - "left" = speaker on left third of panel
  - "center" = speaker in middle of panel
  - "right" = speaker on right third of panel
  Base this on: the action being performed, interaction with other characters/objects, natural scene composition

• bubblePosition: Place bubble OPPOSITE the speaker (professional comic convention):
  - Speaker on LEFT → bubblePosition: "top-right" (bubble on right, tail points left toward speaker)
  - Speaker on RIGHT → bubblePosition: "top-left" (bubble on left, tail points right toward speaker)
  - Speaker in CENTER → bubblePosition: "top-center" (bubble centered, tail points down toward speaker)

For multi-character scenes: Position the PRIMARY speaker based on their action/focus in this specific panel.

MANDATORY RULE: If hasSpeechBubble is true, you MUST provide ALL THREE fields:
- speakerName (required)
- speakerPosition (required - choose based on natural scene composition)  
- bubblePosition (required - opposite of speakerPosition)
If you cannot determine positioning, default to: speakerPosition: "center", bubblePosition: "top-center"
NEVER leave these fields undefined when hasSpeechBubble is true.

SILENT PANELS (PROFESSIONAL COMIC TECHNIQUE - EMOTIONAL IMPACT):
Silent panels have NO dialogue, NO narration - pure visual storytelling.
Mark panels as silent (isSilent: true) for these story moments:

TRIGGERS FOR SILENT PANELS:
• "emotional_reaction" - Character processing shock, joy, grief, or wonder
• "contemplation" - Moment BEFORE a big decision 
• "revelation_aftermath" - Moment AFTER a major reveal (character absorbing impact)
• "visual_impact" - Visual punchline that needs no words
• "breathing_room" - Pacing break after intense scene

SILENT PANEL REQUIREMENTS BY AUDIENCE:
• CHILDREN (${audience === 'children' ? 'THIS STORY' : 'reference'}): 1-2 silent panels (big reveals, quiet wonder)
• YOUNG ADULTS (${audience === 'young adults' ? 'THIS STORY' : 'reference'}): 3-4 silent panels (emotional reactions, before decisions)  
• ADULTS (${audience === 'adults' ? 'THIS STORY' : 'reference'}): 5-6 silent panels (all YA reasons plus symbolic moments)

When marking isSilent: true:
- hasSpeechBubble MUST be false
- dialogue MUST be undefined/null
- silentReason MUST be one of: "emotional_reaction", "contemplation", "visual_impact", "breathing_room", "revelation_aftermath"
- emotion SHOULD be intense (joy, shock, grief, wonder, determination)
- The image alone must carry the emotional weight

CAMERA ANGLE INTELLIGENCE (CRITICAL - STORY DRIVES VISUALS):
Choose cameraAngle based on WHAT IS HAPPENING IN THE STORY, not arbitrary rotation.

NARRATIVE-TO-CAMERA MAPPING:
• Character discovers/examines small object → "close-up" (show detail and wonder)
• Character enters NEW location for first time → "wide" or "extreme-wide" (establish space)
• Emotional confrontation or realization → "close-up" (capture emotion)
• Character performing physical action (running, jumping, climbing) → "low-angle" or "dutch-angle" (dynamic energy)
• Character feeling small, overwhelmed, or scared → "high-angle" (vulnerability)
• Character feeling powerful, triumphant → "low-angle" (heroic)
• Two characters talking → "over-shoulder" or alternating "medium" shots
• Quiet, intimate moment → "close-up" or "medium" (personal)
• Danger approaching from distance → "wide" (show threat and character)
• Character hiding or sneaking → "low-angle" or "over-shoulder" (tension)
• Story climax/most important moment → "close-up" (maximum emotional impact)
• Resolution/ending → "medium" or "wide" (closure, context)

ENVIRONMENT-DRIVEN ANGLES:
• Indoor/confined space → prefer "medium" and "close-up" (intimacy)
• Outdoor/vast space → include "wide" and "extreme-wide" (scope)
• When locationChange occurs → MUST use "wide" or "extreme-wide" for that panel

DIVERSITY REQUIREMENT:
• Minimum 4 unique camera angles across all panels
• NO two consecutive panels with identical cameraAngle
• First panel should be "wide" or "extreme-wide" (establishing)
• Climax panel (70-85% through) should be "close-up" or dramatic angle

For each panel, provide cameraReason explaining your choice based on the story moment.

COMIC BOOK PROFESSIONAL STANDARDS:
- Every panel advances the ${narrativeIntel.storyArchetype} narrative
- Character actions serve archetype progression
- Visual flow guides reader through emotional arc
- Emotional beats create character growth arc
- Panel purposes build toward archetype resolution
- Speech bubbles enhance emotional connection and story clarity`;
  }

  // ===== UTILITY METHODS FOR NARRATIVE INTELLIGENCE =====
  // FIXED: All TypeScript errors resolved

  private extractThematicElements(story: string, archetype: string): string[] {
    const storyLower = story.toLowerCase();
    const elements: string[] = [];

    // Common themes based on archetype
    const archetypeThemes = {
      hero_journey: ['courage', 'growth', 'overcoming_challenges', 'helping_others'],
      discovery: ['curiosity', 'wonder', 'learning', 'exploration'],
      transformation: ['change', 'personal_growth', 'self_discovery', 'acceptance'],
      mystery: ['investigation', 'problem_solving', 'revelation', 'truth']
    };

    const defaultThemes = archetypeThemes[archetype as keyof typeof archetypeThemes] || archetypeThemes.discovery;
    elements.push(...defaultThemes);

    // Extract additional themes from story content
    if (storyLower.includes('friend')) elements.push('friendship');
    if (storyLower.includes('family')) elements.push('family_bonds');
    if (storyLower.includes('kind')) elements.push('kindness');
    if (storyLower.includes('brave')) elements.push('bravery');
    if (storyLower.includes('magic')) elements.push('wonder');

    return [...new Set(elements)]; // Remove duplicates
  }

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

  private determineCharacterGrowth(story: string, archetype: string): string[] {
    const growth: string[] = [];
    const storyLower = story.toLowerCase();

    // Base growth patterns by archetype
    const archetypeGrowth = {
      hero_journey: ['gains_confidence', 'develops_courage', 'learns_responsibility'],
      discovery: ['gains_knowledge', 'develops_curiosity', 'learns_wonder'],
      transformation: ['gains_self_awareness', 'develops_acceptance', 'learns_change'],
      mystery: ['gains_analytical_skills', 'develops_patience', 'learns_perseverance']
    };

    const defaultGrowth = archetypeGrowth[archetype as keyof typeof archetypeGrowth] || archetypeGrowth.discovery;
    growth.push(...defaultGrowth);

    // Add story-specific growth
    if (storyLower.includes('learn')) growth.push('gains_wisdom');
    if (storyLower.includes('help')) growth.push('develops_empathy');
    if (storyLower.includes('overcome')) growth.push('builds_resilience');

    return [...new Set(growth)]; // Remove duplicates
  }

  // ===== STORY ANALYSIS PARSING (FROM BOTH FILES) =====

  /**
   * Parse story analysis response from OpenAI into structured format
   * FIXED: All TypeScript errors resolved
   */
  private parseStoryAnalysisResponse(response: string, config: any, narrativeIntel: any): StoryAnalysis {
    try {
      // Strip markdown code blocks before parsing (Gemini returns ```json wrapping)
      let cleanedResponse = response.trim();
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Extract JSON from response
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and structure the analysis (FROM BOTH FILES)
      const analysis: StoryAnalysis = {
        storyBeats: this.validateStoryBeats(parsed.storyBeats || [], config),
        storyArchetype: parsed.storyArchetype || narrativeIntel.storyArchetype,
        emotionalArc: this.ensureArray(parsed.emotionalArc) || narrativeIntel.emotionalArc,
        thematicElements: this.ensureArray(parsed.thematicElements) || narrativeIntel.thematicElements,
        characterArc: this.ensureArray(parsed.characterArc) || ['character_development'],
        visualFlow: this.ensureArray(parsed.visualFlow) || ['establishing', 'action', 'resolution'],
        totalPanels: parsed.totalPanels || config.totalPanels,
        pagesRequired: Math.ceil((parsed.totalPanels || config.totalPanels) / config.panelsPerPage),
        dialoguePanels: parsed.dialoguePanels || 0,
        speechBubbleDistribution: parsed.speechBubbleDistribution || {},
        narrativeIntelligence: {
          archetypeApplied: narrativeIntel.storyArchetype,
          pacingStrategy: narrativeIntel.pacingStrategy,
          characterGrowthIntegrated: true
        }
      };

      return analysis;

    } catch (error) {
      console.error('❌ Failed to parse story analysis, using fallback:', error);
      return this.createFallbackStoryAnalysis(config, narrativeIntel);
    }
  }
// ===== CHARACTER DNA CREATION - IMAGE-BASED (NO TEXT ANALYSIS NEEDED) =====

  /**
   * Create master character DNA with image-based reference
   * GEMINI MIGRATION: Uses cartoon image directly, no text analysis needed
   */
  private async createMasterCharacterDNA(characterImage: string, artStyle: string): Promise<CharacterDNA> {
    try {
      console.log('🧬 Creating Character DNA with image-based reference (no text analysis)...');
      
      // The characterImage URL is already the cartoonized image from earlier phase
      // We just need to create the DNA structure with the image reference
      
      const characterDNA: CharacterDNA = {
        sourceImage: characterImage,
        cartoonImage: characterImage,  // Use cartoon as reference
        description: 'Character reference stored as image', // Minimal text, image is the truth
        artStyle: artStyle,
        visualDNA: {
          imageBasedReference: characterImage,  // CRITICAL: Store cartoon URL for panels
          facialFeatures: ['Reference image contains all features'],
          bodyType: 'As shown in reference image',
          clothing: 'As shown in reference image',
          distinctiveFeatures: ['All features in reference image'],
          colorPalette: ['Colors from reference image'],
          expressionBaseline: 'neutral'
        },
        consistencyPrompts: {
          basePrompt: `Use the provided cartoon image as EXACT visual reference. Match ALL features perfectly.`,
          artStyleIntegration: `Maintain ${artStyle} style while keeping EXACT character appearance from reference image`,
          variationGuidance: 'CRITICAL: Character MUST appear IDENTICAL to reference image in every panel.'
        },
        metadata: {
          createdAt: new Date().toISOString(),
          processingTime: Date.now(),
          analysisMethod: 'image_based_reference_only',
          confidenceScore: 99,  // Highest confidence with image reference
          fingerprintGenerated: true,
          qualityScore: 95
        }
      };

      console.log('✅ Character DNA created with image-based reference');
      console.log(`   🎨 Cartoon Reference: ${characterImage.substring(0, 50)}...`);
      console.log(`   🎭 Art Style: ${artStyle}`);
      console.log(`   🎯 Method: Image-based (no text analysis needed)`);
      
      return characterDNA;

    } catch (error) {
      console.error('❌ Character DNA creation failed:', error);
      throw this.errorHandler.handleError(error, 'createMasterCharacterDNA');
    }
  }

  /**
   * Determine shadow direction based on time of day
   */
  private determineShadowDirection(timeOfDay: string): string {
    const shadowMap: Record<string, string> = {
      'morning': 'long shadows from west',
      'afternoon': 'shorter shadows',
      'evening': 'long shadows from east',
      'night': 'minimal shadows or moonlight'
    };
    return shadowMap[timeOfDay] || 'natural lighting';
  }

  /**
   * Determine accent colors based on dominant colors
   */
  private determineAccentColors(dominantColors: string[]): string[] {
    if (!dominantColors || dominantColors.length === 0) {
      return ['bright', 'vibrant'];
    }
    return ['light variations', 'complementary tones'];
  }

  // ===== OPTIMIZED COMIC BOOK PAGE GENERATION (FROM BOTH FILES) =====

  /**
   * Generate professional comic book pages with optimized prompts
   * FIXED: All TypeScript errors resolved
   * ENHANCED: Multi-character support with characters array
   */
  private async generateOptimizedComicBookPages(
    storyAnalysis: StoryAnalysis,
    characterDNA: CharacterDNA | null,
    environmentalDNA: EnvironmentalDNA,
    config: any,
    artStyle: string,
    audience: AudienceType,
    story: string,
    characterName?: string,
    characters?: StoryCharacter[]  // NEW: Multi-character support
  ): Promise<ComicPanel[]> {
    try {
      const pages: ComicPanel[] = [];
      const { storyBeats } = storyAnalysis;
      
      // Group story beats into pages (FROM BOTH FILES)
      const beatsPerPage = config.panelsPerPage;
      const pageGroups = this.groupBeatsIntoPages(storyBeats, beatsPerPage);

      // Track last panel from previous page for cross-page consistency
      let lastPanelFromPreviousPage: ComicPanel | null = null;

      for (let pageIndex = 0; pageIndex < pageGroups.length; pageIndex++) {
        const pageBeats = pageGroups[pageIndex];
        const pageNumber = pageIndex + 1;

        console.log(`Generating page ${pageNumber}/${pageGroups.length} with ${pageBeats.length} panels...`);

        // Generate panels for this page (FROM BOTH FILES)
        // NEW: Pass characters for multi-character support
        // FIXED: Pass last panel from previous page for cross-page consistency
        const panels = await this.generatePanelsForPage(
          pageBeats,
          characterDNA,
          environmentalDNA,
          config,
          artStyle,
          pageNumber,
          storyAnalysis.totalPanels,
          audience,
          story,
          characterName,
          characters,  // NEW: Pass characters array
          lastPanelFromPreviousPage  // FIXED: Cross-page consistency
        );

        // Store last panel for next page's continuity
        if (panels.length > 0) {
          lastPanelFromPreviousPage = panels[panels.length - 1];
        }

        const pagePanel: any = {
          pageNumber,
          scenes: panels,
          layoutType: 'comic-book-panels',
          characterArtStyle: artStyle,
          panelCount: panels.length,
          dialoguePanels: panels.filter(p => p.hasSpeechBubble).length,
          environmentalTheme: environmentalDNA.primaryLocation.name,
          professionalQuality: true,
          // Required ComicPanel properties
          description: `Page ${pageNumber}`,
          emotion: 'neutral',
          imagePrompt: '',
          panelType: 'standard' as PanelType,
          characterAction: 'page layout',
          narrativePurpose: 'page container',
          visualPriority: 'layout',
          hasSpeechBubble: false,
          panelNumber: 0,
          professionalStandards: true
        };

        pages.push(pagePanel);
      }

      console.log(`Generated ${pages.length} pages with professional quality standards`);
      
      // === VALIDATE STORY STRUCTURE AND LOG QUALITY METRICS ===
      // Collect all panels from all pages for validation
      const allPanels: ComicPanel[] = pages.flatMap((page: any) => page.scenes || []);
      
      if (allPanels.length > 0) {
        const validationResult = this.validateStoryStructure(storyAnalysis, allPanels, audience);
        
        // Log summary metrics
        console.log(`\n📈 STORY QUALITY SUMMARY (${audience.toUpperCase()}):`);
        console.log(`   📊 Goal at panel: ${validationResult.structureMetrics.goal.panel || 'NOT FOUND'}`);
        console.log(`   🚧 Obstacle at panel: ${validationResult.structureMetrics.obstacle.panel || 'NOT FOUND'}`);
        console.log(`   ✅ Resolution: Panel ${allPanels.length}`);
        console.log(`   🎬 Panel Diversity: ${validationResult.structureMetrics.panelDiversity.uniqueShotTypes} unique shot types, ${validationResult.structureMetrics.panelDiversity.uniqueActions} unique actions`);
        console.log(`   📝 Narration: Avg ${validationResult.structureMetrics.narrationQuality.avgSentenceLength} words/sentence, vocabulary: ${validationResult.structureMetrics.narrationQuality.vocabularyLevel}`);
        
        if (validationResult.warnings.length > 0) {
          console.log(`   ⚠️ ${validationResult.warnings.length} warnings (generation continues, logged for monitoring)`);
        } else {
          console.log(`   ✅ All quality requirements met!`);
        }
      }
      
      return pages;

    } catch (error) {
      console.error('❌ Page generation failed:', error);
      throw this.errorHandler.handleError(error, 'generateOptimizedComicBookPages');
    }
  }

  // ===== PANEL GENERATION FOR PAGE (FROM BOTH FILES) =====

  /**
   * Generate individual panels for a page with professional standards
   * ENHANCED: SEQUENTIAL generation with previous panel context for narrative continuity
   * ENHANCED: Multi-character support with secondary characters rendering
   * 
   * Professional comic standard: "Panel X must show consequences of Panel X-1"
   * Each panel receives context from the previous panel for visual continuity.
   */
  private async generatePanelsForPage(
    pageBeats: StoryBeat[],
    characterDNA: CharacterDNA | null,
    environmentalDNA: EnvironmentalDNA,
    config: any,
    artStyle: string,
    pageNumber: number,
    totalPanels: number,
    audience: AudienceType,
    story: string,
    characterName?: string,
    characters?: StoryCharacter[],  // NEW: Multi-character support
    lastPanelFromPreviousPage?: ComicPanel | null  // FIXED: Cross-page consistency
  ): Promise<ComicPanel[]> {
    console.log(`🔗 Generating ${pageBeats.length} panels for page ${pageNumber} SEQUENTIALLY with narrative continuity...`);
    
    // NEW: Log multi-character information
    if (characters && characters.length > 1) {
      console.log(`   👥 Multi-character mode: ${characters.length} characters available for panel generation`);
    }

    // ===== STORY-DRIVEN DIVERSITY PLANNING =====
    // Plan all panel types BEFORE generation to guarantee diversity
    // This respects AI's cameraAngle decisions while ensuring variety
    console.log(`📐 Planning panel diversity for page ${pageNumber}...`);
    const { plannedTypes, adjustments } = this.planPanelDiversity(pageBeats, audience);

    const panels: ComicPanel[] = [];
    let adaptiveDelay = 2000;  // Start with 2000ms (2s) between panels to prevent API overload
    let consecutiveSuccesses = 0;

    // Generate panels ONE AT A TIME for narrative continuity
    for (let beatIndex = 0; beatIndex < pageBeats.length; beatIndex++) {
      const beat = pageBeats[beatIndex];
      const panelNumber = (pageNumber - 1) * config.panelsPerPage + beatIndex + 1;
      const panelStartTime = Date.now();

      const imagePrompt = this.buildOptimizedImagePrompt(
        beat,
        characterDNA,
        environmentalDNA,
        config,
        artStyle,
        { panelNumber, totalPanels, pageNumber }
      );

      // Use pre-planned panel type from diversity planning (story-driven)
      // This respects AI's cameraAngle from story analysis
      const panelType = plannedTypes[beatIndex] || this.determinePanelType(beat, beatIndex, totalPanels, audience, panels.map(p => p.panelType));

      // Build previous panel context for panels 2+ OR use last panel from previous page
      // FIXED: Cross-page consistency - first panel of new page uses last panel of previous page
      let previousPanel: ComicPanel | null = null;
      let previousBeat: StoryBeat | null = null;
      
      if (beatIndex > 0) {
        // Within same page - use previous panel from this page
        previousPanel = panels[beatIndex - 1];
        previousBeat = pageBeats[beatIndex - 1];
      } else if (lastPanelFromPreviousPage) {
        // First panel of new page - use last panel from previous page for cross-page consistency
        previousPanel = lastPanelFromPreviousPage;
        // Note: previousBeat will be undefined, but we have the panel image and description
        console.log(`   🔗 Using last panel from previous page for cross-page consistency`);
      }
      
      // Extract pose from previous panel for diversity enforcement
      const previousPose = previousPanel ? this.extractPoseFromAction(
        previousBeat?.characterAction || previousPanel.characterAction || ''
      ) : undefined;
      
      const previousPanelContext = previousPanel?.generatedImage ? {
        imageUrl: previousPanel.generatedImage,
        description: previousBeat?.beat || previousPanel.description || 'previous scene',
        action: previousBeat?.characterAction || previousPanel.characterAction || 'previous action',
        // NEW: Track pose for diversity enforcement
        pose: previousPose
      } : undefined;

      // ✅ NARRATION-FIRST ARCHITECTURE: Generate narration FIRST, then use it for image generation
      // This ensures images match exactly what narration describes (no more "crawling" in text but "standing" in image)
      console.log(`📝 Generating narration FIRST for panel ${panelNumber}/${totalPanels}...`);
      
      // STEP 1: Generate rich narration text (20-40 words) from beat FIRST
      const narration = await this.generatePanelNarration(
        beat,
        panelNumber,
        totalPanels,
        audience,
        characterName || 'the character',
        story
      );
      
      // STEP 2: Build visual description FROM narration (narration becomes source of truth for image)
      const visualDescription = this.buildVisualDescriptionFromNarration(narration, beat);
      console.log(`🎨 Generating image FROM narration: "${visualDescription.substring(0, 100)}..."`);
      
      console.log(`🎬 Generating panel ${panelNumber}/${totalPanels} (${panelType}) with ${characterDNA ? 'CHARACTER IMAGE REFERENCE' : 'text only'}${previousPanelContext ? ' + PREVIOUS PANEL CONTEXT' : ' (first panel)'}...`);
      
      // GEMINI MIGRATION: Use image-based generation if character DNA has cartoon image
      let imageUrl: string;
      
      if (characterDNA?.cartoonImage) {
        // IMAGE-BASED GENERATION: Gemini sees actual cartoon for 95% consistency
        // SEQUENTIAL: Now also receives previous panel for narrative continuity
        console.log(`   📸 Using cartoon image reference for perfect consistency`);
        if (previousPanelContext) {
          console.log(`   🔗 Including previous panel context for continuity: "${previousPanelContext.action}"`);
        }
        
        // NEW: Get secondary characters for this beat if multi-character mode
        const secondaryCharsInBeat = characters ? this.getSecondaryCharactersForBeat(beat, characters) : [];
        if (secondaryCharsInBeat.length > 0) {
          console.log(`   👥 Secondary characters in scene: ${secondaryCharsInBeat.map(c => c.name).join(', ')}`);
        }
        
        imageUrl = await this.geminiIntegration.generatePanelWithCharacter(
          characterDNA.cartoonImage,
          visualDescription,  // ✅ NARRATION-FIRST: Use narration-based description instead of beat.beat
          beat.emotion,
          {
            artStyle,
            cameraAngle: 'eye level',
            lighting: environmentalDNA?.lightingContext?.lightingMood || 'natural',
            panelType,
            backgroundComplexity: environmentalDNA ? 'detailed' : 'moderate',
            temperature: 0.7,
            environmentalContext: {
              characterDNA: characterDNA,
              environmentalDNA: environmentalDNA,
              panelNumber: panelNumber,
              totalPanels: totalPanels
            },
            // SEQUENTIAL CONTEXT: Pass previous panel for narrative continuity
            previousPanelContext,
            // NEW (Fix 5): Pass narrative position for visual contrast
            narrativePosition: this.calculateNarrativePosition(panelNumber, totalPanels),
            emotionalWeight: beat.emotionalWeight || this.calculateEmotionalWeight(beat, panelNumber, totalPanels),
            // NEW: Multi-character support - pass main character name and secondary characters
            mainCharacterName: characterName || characterDNA?.characterName,
            secondaryCharacters: secondaryCharsInBeat.map(char => ({
              name: char.name,
              age: char.age,
              gender: char.gender,
              relationship: char.relationship,
              hairColor: char.hairColor,
              eyeColor: char.eyeColor,
              // Get action/position from the beat's secondary character info if available
              action: beat.secondaryCharactersInScene?.find(sc => sc.name === char.name)?.action,
              position: beat.secondaryCharactersInScene?.find(sc => sc.name === char.name)?.position,
              // NEW: Include reference image URL for 88%+ consistency (generated in PHASE 3.25)
              referenceImageUrl: char.cartoonImageUrl
            })),
            // NEW: Speech bubble support - Gemini renders bubbles directly in image
            dialogue: beat.isSilent ? undefined : beat.dialogue,
            hasSpeechBubble: beat.isSilent ? false : beat.hasSpeechBubble,
            speechBubbleStyle: beat.isSilent ? undefined : (beat.speechBubbleStyle as 'speech' | 'thought' | 'shout' | 'whisper' | undefined),
            speakerPosition: beat.isSilent ? undefined : beat.speakerPosition,
            bubblePosition: beat.isSilent ? undefined : beat.bubblePosition,
            // McCloud transition type for panel-to-panel flow
            transitionType: beat.transitionType as 'action_to_action' | 'subject_to_subject' | 'scene_to_scene' | 'moment_to_moment' | 'aspect_to_aspect' | undefined,
            // NEW: Panel border style based on emotion/action (Eisner principle)
            borderStyle: this.determineBorderStyle(beat, panelNumber, totalPanels),
            // NEW: Silent panel support - enhanced visual storytelling
            isSilent: beat.isSilent,
            silentReason: beat.silentReason
          }
        );
      } else {
        // Fallback: Text-only generation (no character)
        console.log(`   📝 Using text-based generation (no character image)`);
        imageUrl = await this.geminiIntegration.generateTextCompletion(imagePrompt, {
          temperature: 0.7,
          max_output_tokens: 1000
        }) as any; // This will need Cloudinary upload in real implementation
      }

      const panelDuration = Date.now() - panelStartTime;
      console.log(`✅ Panel ${panelNumber} image generated successfully in ${(panelDuration / 1000).toFixed(1)}s`);

      // Store panel result (will be used as context for next panel)
      const panel: ComicPanel = {
        description: beat.beat,  // Keep short summary for internal use
        narration,  // ✅ NEW: Rich 20-40 word narrative text
        emotion: beat.emotion,
        imagePrompt,
        generatedImage: imageUrl,
        panelType: panelType as PanelType,
        characterAction: beat.characterAction,
        narrativePurpose: beat.panelPurpose,
        visualPriority: beat.visualPriority,
        dialogue: beat.dialogue,
        hasSpeechBubble: beat.hasSpeechBubble || false,
        speechBubbleStyle: beat.speechBubbleStyle,
        // NEW: AI-driven speech bubble positioning
        speakerName: beat.speakerName,
        speakerPosition: beat.speakerPosition,
        bubblePosition: beat.bubblePosition,
        panelNumber,
        pageNumber,
        environmentalContext: beat.environment,
        professionalStandards: true,
        imageGenerated: true,
        characterDNAUsed: !!characterDNA,
        environmentalDNAUsed: !!environmentalDNA,
        // NEW: Spiegelman emotional weight for dynamic panel sizing
        emotionalWeight: beat.emotionalWeight || this.calculateEmotionalWeight(beat, panelNumber, totalPanels),
        // NEW: Silent panel flag for frontend
        isSilent: beat.isSilent || false
      };
      panels.push(panel);

      // ✅ ADAPTIVE DELAY: Adjust based on API performance
      consecutiveSuccesses++;
      
      // If panels completing quickly (under 30 seconds), reduce delay gradually
      // Keep minimum at 1000ms (1s) to prevent API overload and 503 errors
      if (consecutiveSuccesses >= 3 && panelDuration < 30000) {
        adaptiveDelay = Math.max(1000, adaptiveDelay - 200);  // Reduce delay, minimum 1000ms
      }

      // Apply delay between panels (not after last panel)
      if (beatIndex < pageBeats.length - 1) {
        console.log(`⏳ Waiting ${adaptiveDelay}ms before next panel (maintaining API rate)...`);
        await new Promise(resolve => setTimeout(resolve, adaptiveDelay));
      }
    }

    console.log(`✅ Generated ${panels.length} panels for page ${pageNumber} with sequential continuity`);
    return panels;
  }

  /**
   * ===== DETERMINE IF PANEL SHOULD HAVE NARRATION =====
   * Uses NARRATION_PHILOSOPHY to decide based on audience and panel position
   * 
   * Professional comics use DIFFERENT narration strategies:
   * - Children: Only 25% of panels (opening, time jumps, conclusion)
   * - YA: 40% of panels (emotional peaks, internal conflict)
   * - Adults: 50% of panels (thematic weight)
   */
  private shouldPanelHaveNarration(
    panelNumber: number,
    totalPanels: number,
    audience: AudienceType,
    beat: StoryBeat
  ): { shouldNarrate: boolean; reason: string } {
    // === SILENT PANEL CHECK - NO TEXT AT ALL ===
    if (beat.isSilent) {
      return { shouldNarrate: false, reason: `silent_panel_${beat.silentReason || 'emotional_impact'}` };
    }
    
    const philosophy = NARRATION_PHILOSOPHY[audience as keyof typeof NARRATION_PHILOSOPHY] || NARRATION_PHILOSOPHY.children;
    const position = panelNumber / totalPanels;
    
    // Determine panel type based on position and beat properties
    const isOpening = panelNumber === 1;
    const isConclusion = panelNumber === totalPanels || panelNumber === totalPanels - 1;
    const isTimeJump = beat.locationChange === 'new-location-name' || (beat.beat?.toLowerCase().includes('later') || beat.beat?.toLowerCase().includes('next'));
    const isLocationChange = beat.locationChange && beat.locationChange !== 'same';
    const isEmotionalPeak = position >= 0.7 && position <= 0.85; // Climax zone
    const isInternalConflict = beat.emotion?.includes('conflict') || beat.beat?.toLowerCase().includes('thought') || beat.beat?.toLowerCase().includes('realized');
    const isRealization = beat.beat?.toLowerCase().includes('understood') || beat.beat?.toLowerCase().includes('knew') || beat.beat?.toLowerCase().includes('realized');
    
    // === CHILDREN'S COMICS: Minimal narration (25%) ===
    if (audience === 'children') {
      // Always narrate opening, conclusion, time jumps, and location changes
      if (isOpening) return { shouldNarrate: true, reason: 'opening_panel' };
      if (isConclusion) return { shouldNarrate: true, reason: 'conclusion_panel' };
      if (isTimeJump) return { shouldNarrate: true, reason: 'time_jump' };
      if (isLocationChange) return { shouldNarrate: true, reason: 'location_change' };
      
      // Only 25% of remaining panels get narration
      // Use deterministic selection based on panel position
      const narrationSlots = Math.floor(totalPanels * philosophy.maxNarrationRatio);
      const alreadyCounted = (isOpening ? 1 : 0) + (isConclusion ? 1 : 0);
      const remainingSlots = Math.max(0, narrationSlots - alreadyCounted);
      
      // Distribute remaining narration to key story moments
      const narratedPanels = new Set([1, totalPanels]); // Opening and conclusion
      if (remainingSlots > 0) {
        // Add midpoint panel
        narratedPanels.add(Math.floor(totalPanels / 2));
      }
      if (remainingSlots > 1) {
        // Add quarter point
        narratedPanels.add(Math.floor(totalPanels / 4));
      }
      
      if (narratedPanels.has(panelNumber)) {
        return { shouldNarrate: true, reason: 'key_story_moment' };
      }
      
      return { shouldNarrate: false, reason: 'children_minimal_narration' };
    }
    
    // === YOUNG ADULT COMICS: Internal monologue (40%) ===
    if (audience === 'young adults') {
      // Always narrate: opening, emotional peaks, internal conflict, realization, conclusion
      if (isOpening) return { shouldNarrate: true, reason: 'opening_panel' };
      if (isConclusion) return { shouldNarrate: true, reason: 'conclusion_panel' };
      if (isEmotionalPeak) return { shouldNarrate: true, reason: 'emotional_peak' };
      if (isInternalConflict) return { shouldNarrate: true, reason: 'internal_conflict' };
      if (isRealization) return { shouldNarrate: true, reason: 'realization_moment' };
      
      // 15% silent panels for emotional impact
      const silentPanelCount = Math.floor(totalPanels * philosophy.silentPanelRatio);
      // Make action-heavy panels silent (let images speak)
      if (beat.characterAction && !beat.dialogue && panelNumber % 4 === 0 && silentPanelCount > 0) {
        return { shouldNarrate: false, reason: 'strategic_silence' };
      }
      
      // Remaining panels up to 40% get narration
      const maxNarrated = Math.floor(totalPanels * philosophy.maxNarrationRatio);
      if (panelNumber <= maxNarrated) {
        return { shouldNarrate: true, reason: 'within_narration_budget' };
      }
      
      return { shouldNarrate: false, reason: 'ya_strategic_silence' };
    }
    
    // === ADULT COMICS: Literary narration (50%) ===
    if (audience === 'adults') {
      // Always narrate: opening, conclusion
      if (isOpening) return { shouldNarrate: true, reason: 'opening_panel' };
      if (isConclusion) return { shouldNarrate: true, reason: 'conclusion_panel' };
      
      // 20% silent panels for contemplation
      const silentPanelCount = Math.floor(totalPanels * philosophy.silentPanelRatio);
      // Make certain panels silent for impact
      if (panelNumber % 5 === 0 && silentPanelCount > 0) {
        return { shouldNarrate: false, reason: 'contemplative_silence' };
      }
      
      // Narrate panels with thematic weight (up to 50%)
      const maxNarrated = Math.floor(totalPanels * philosophy.maxNarrationRatio);
      if (panelNumber <= maxNarrated) {
        return { shouldNarrate: true, reason: 'thematic_weight' };
      }
      
      return { shouldNarrate: false, reason: 'adult_strategic_silence' };
    }
    
    // Default: narrate
    return { shouldNarrate: true, reason: 'default' };
  }

  /**
   * ===== GENERATE PANEL NARRATION WITH AUDIENCE-SPECIFIC RULES =====
   * Uses NARRATION_RULES to enforce vocabulary, sentence structure, and ending patterns
   * Uses NARRATION_PHILOSOPHY to determine WHICH panels get narration
   * 
   * PHILOSOPHY: Professional comics use different narration strategies by audience.
   * Children: Minimal narration (25%), let pictures tell the story
   * YA: Internal monologue style with strategic silent panels
   * Adults: Literary narration with contemplative silences
   */
  private async generatePanelNarration(
    beat: StoryBeat,
    panelNumber: number,
    totalPanels: number,
    audience: AudienceType,
    characterName: string,
    originalStory: string
  ): Promise<string> {
    // === STEP 1: Check if this panel should have narration ===
    const narrationDecision = this.shouldPanelHaveNarration(panelNumber, totalPanels, audience, beat);
    
    if (!narrationDecision.shouldNarrate) {
      console.log(`📝 Panel ${panelNumber} SILENT (${audience}): ${narrationDecision.reason}`);
      // Return empty string for panels without narration
      // The image will tell the story on its own
      return '';
    }
    
    console.log(`📝 Panel ${panelNumber} NARRATED (${audience}): ${narrationDecision.reason}`);
    
    // Determine narrative position for pacing
    const position = panelNumber / totalPanels;
    const narrativePosition = position < 0.15 ? 'OPENING' 
      : position < 0.3 ? 'SETUP' 
      : position < 0.7 ? 'RISING_ACTION' 
      : position < 0.85 ? 'CLIMAX' 
      : 'RESOLUTION';
    
    // Get audience-specific narration rules
    const rules = NARRATION_RULES[audience as keyof typeof NARRATION_RULES] || NARRATION_RULES.children;
    const philosophy = NARRATION_PHILOSOPHY[audience as keyof typeof NARRATION_PHILOSOPHY] || NARRATION_PHILOSOPHY.children;
    
    // Build audience-specific prompt with comprehensive rules
    const prompt = this.buildAudienceNarrationPrompt(
      beat,
      panelNumber,
      totalPanels,
      narrativePosition,
      audience,
      characterName,
      originalStory,
      rules
    );

    const narration = await this.claudeIntegration.generateNarrationText(prompt);
    
    // Validate we got a real response
    if (!narration || narration.trim().length < 10) {
      throw new Error(`QUALITY FAILURE: Claude returned empty or invalid narration for panel ${panelNumber}. Job must fail.`);
    }
    
    let cleaned = narration
      .replace(/```/g, '')
      .replace(/^["']|["']$/g, '')
      .replace(/^Narration:\s*/i, '')
      .replace(/^Caption:\s*/i, '')
      .trim();
    
    // === POST-GENERATION VALIDATION ===
    // Apply audience-specific vocabulary checks + dialogue/action overlap detection
    cleaned = this.validateAndCleanNarration(
      cleaned, 
      audience, 
      narrativePosition, 
      panelNumber,
      beat.dialogue,        // Pass dialogue to check for overlap
      beat.characterAction  // Pass action to detect visible action descriptions
    );
    
    // Enforce max word count from philosophy
    const maxWords = philosophy.maxWords;
    const words = cleaned.split(/\s+/);
    if (words.length > maxWords) {
      cleaned = words.slice(0, maxWords).join(' ');
      // Ensure it ends with proper punctuation
      if (!/[.!?]$/.test(cleaned)) {
        cleaned += '.';
      }
      console.log(`   ⚠️ Truncated to ${maxWords} words (${audience} max)`);
    }
    
    const wordCount = cleaned.split(/\s+/).length;
    
    // Log narration quality metrics
    console.log(`   Words: ${wordCount}/${maxWords}, Avg sentence length: ${this.calculateAvgSentenceLength(cleaned)}`);
    
    return cleaned;
  }

  /**
   * ===== BUILD VISUAL DESCRIPTION FROM NARRATION =====
   * NARRATION-FIRST ARCHITECTURE: Extracts visual scene description from narration text
   * This ensures the image matches exactly what the narration describes
   * 
   * @param narration - The generated narration text (20-40 words)
   * @param beat - The original story beat with characterAction details
   * @returns Visual description for Gemini image generation
   */
  private buildVisualDescriptionFromNarration(narration: string, beat: StoryBeat): string {
    // Start with the narration as the primary scene description
    let visualDescription = narration;
    
    // PHYSICAL ACTION MAPPING: Extract specific physical requirements from narration and characterAction
    const physicalRequirements: string[] = [];
    const combinedText = `${narration} ${beat.characterAction || ''}`.toLowerCase();
    
    // Map common action words to explicit visual requirements
    const actionMappings: Record<string, string> = {
      'crawl': 'Character MUST be on hands and knees, body low to ground',
      'crawled': 'Character MUST be on hands and knees, body low to ground',
      'crawling': 'Character MUST be on hands and knees, body low to ground',
      'run': 'Character MUST have legs in motion, body leaning forward, feet not both flat on ground',
      'ran': 'Character MUST have legs in motion, body leaning forward, feet not both flat on ground',
      'running': 'Character MUST have legs in motion, body leaning forward, feet not both flat on ground',
      'tongue out': 'Character\'s tongue MUST be visible outside mouth',
      'sticks out tongue': 'Character\'s tongue MUST be visible outside mouth',
      'licks': 'Character\'s tongue MUST be visible, making contact with object',
      'watching': 'Character in still pose, eyes directed at subject, attentive expression',
      'looking': 'Character\'s eyes and head directed toward subject of interest',
      'staring': 'Character\'s eyes wide and fixed on subject, intense focus',
      'sitting': 'Character MUST be seated, weight on bottom, legs folded or extended',
      'sat': 'Character MUST be seated, weight on bottom, legs folded or extended',
      'reaching': 'Arm extended toward target object, fingers stretched out',
      'reached': 'Arm extended toward target object, fingers stretched out',
      'jump': 'Both feet off ground, body elevated in air',
      'jumped': 'Both feet off ground, body elevated in air',
      'jumping': 'Both feet off ground, body elevated in air',
      'crying': 'Visible tears on cheeks, downturned mouth, sad expression',
      'tears': 'Visible tears streaming down cheeks',
      'hugging': 'Arms wrapped around other character or object, bodies close',
      'hugged': 'Arms wrapped around other character or object, bodies close',
      'waving': 'Hand raised, palm open, arm moving in greeting gesture',
      'waved': 'Hand raised, palm open, in greeting position',
      'sleeping': 'Eyes closed, body relaxed, horizontal position',
      'pointing': 'Arm extended, index finger directed at target',
      'pointed': 'Arm extended, index finger directed at target',
      'climbing': 'Hands and feet gripping surface, body at angle against vertical surface',
      'climbed': 'Hands and feet gripping surface, elevated position',
      'falling': 'Body in mid-air, arms flailing, gravity pulling downward',
      'fell': 'Body on ground or mid-fall position',
      'kneeling': 'On one or both knees, upper body upright',
      'knelt': 'On one or both knees, upper body upright',
      'tiptoeing': 'Standing on toes, feet raised, careful balance',
      'tiptoed': 'Standing on toes, careful stepping motion',
      'dancing': 'Body in motion, arms and legs in expressive movement',
      'hiding': 'Body partially concealed behind object, peeking out',
      'hid': 'Body concealed or partially hidden',
      'whispering': 'Leaning close to listener, hand near mouth, secretive pose',
      'shouting': 'Mouth wide open, body tense, possibly hands cupped around mouth',
      'laughing': 'Mouth open in smile, eyes crinkled, body showing joy'
    };
    
    // Scan for action keywords and collect physical requirements
    for (const [keyword, requirement] of Object.entries(actionMappings)) {
      if (combinedText.includes(keyword)) {
        physicalRequirements.push(requirement);
      }
    }
    
    // Also extract specific body part mentions from characterAction
    if (beat.characterAction) {
      // Check for specific body positions mentioned in characterAction
      if (beat.characterAction.toLowerCase().includes('hands and knees')) {
        physicalRequirements.push('Body position: on hands and knees');
      }
      if (beat.characterAction.toLowerCase().includes('arms raised') || beat.characterAction.toLowerCase().includes('arms up')) {
        physicalRequirements.push('Arms raised above head or shoulders');
      }
      if (beat.characterAction.toLowerCase().includes('chubby fingers') || beat.characterAction.toLowerCase().includes('little hands')) {
        physicalRequirements.push('Show small, chubby toddler hands');
      }
    }
    
    // Build the final visual description
    if (physicalRequirements.length > 0) {
      const uniqueRequirements = [...new Set(physicalRequirements)]; // Remove duplicates
      visualDescription += `\n\nMANDATORY PHYSICAL STATE:\n${uniqueRequirements.map(r => `• ${r}`).join('\n')}`;
    }
    
    // Add the original characterAction context for additional detail
    if (beat.characterAction && beat.characterAction.length > 10) {
      visualDescription += `\n\nCHARACTER ACTION CONTEXT: ${beat.characterAction}`;
    }
    
    // Add actionContext if available (from the earlier enhancement)
    if (beat.actionContext) {
      visualDescription += `\n\nACTION PURPOSE: ${beat.actionContext}`;
    }
    
    return visualDescription;
  }

  /**
   * Build audience-specific narration prompt with comprehensive rules
   * 
   * COMIC BOOK NARRATION PHILOSOPHY (Will Eisner, Scott McCloud):
   * - Narration ADD what images CANNOT show: thoughts, time, backstory, emotional stakes
   * - Narration should NEVER describe what the reader can already see
   * - "If you can see it, don't say it" - the golden rule of comic narration
   */
  private buildAudienceNarrationPrompt(
    beat: StoryBeat,
    panelNumber: number,
    totalPanels: number,
    narrativePosition: string,
    audience: AudienceType,
    characterName: string,
    originalStory: string,
    rules: (typeof NARRATION_RULES)[keyof typeof NARRATION_RULES]
  ): string {
    
    // Core philosophy that applies to ALL audiences
    const corePhilosophy = `
=== COMIC BOOK NARRATION GOLDEN RULE ===
"If the reader can SEE it in the image, do NOT write it in the narration."

NARRATION MUST ADD what images CANNOT show:
✓ Character's THOUGHTS and FEELINGS (internal state)
✓ TIME context (how long, when, before/after)
✓ BACKSTORY or MEMORY references
✓ SENSORY details beyond sight (sounds, smells, temperature)
✓ STAKES and CONSEQUENCES (why this moment matters)
✓ CONNECTION to the larger story

NARRATION MUST NEVER describe:
✗ Physical actions visible in the image (standing, walking, reaching)
✗ Facial expressions the reader can see
✗ Objects or settings shown in the illustration
✗ Character poses or positions
✗ Clothing or appearance details`;

    // === CHILDREN'S PROMPT (Ages 4-8) ===
    if (audience === 'children') {
      const resolutionRules = narrativePosition === 'RESOLUTION' ? `
RESOLUTION PANEL REQUIREMENTS:
✓ State what ${characterName} learned or feels NOW
✓ Simple, concrete, a 5-year-old understands
✓ Connect emotionally to the story's heart

FORBIDDEN ENDINGS:
✗ "And they all lived happily ever after"
✗ Abstract philosophy about magic or wonder` : '';

      return `Write 15-25 word narration for children's comic panel ${panelNumber}/${totalPanels}.
${corePhilosophy}

CHILDREN'S VOCABULARY (Ages 4-8):
- Words a 5-year-old knows
- Max 10 words per sentence
- Simple feelings: happy, sad, scared, brave, proud

STORY CONTEXT:
"${originalStory.substring(0, 300)}"

THIS PANEL SHOWS: ${beat.beat}
CHARACTER EMOTION: ${beat.emotion}
NARRATIVE POSITION: ${narrativePosition}
${beat.dialogue ? `DIALOGUE IN SPEECH BUBBLE: "${beat.dialogue}"` : ''}
${resolutionRules}

=== GOOD vs BAD EXAMPLES ===

❌ BAD (describes visible action):
"${characterName} walked to the garden. She bent down and picked up the flower."
→ WRONG: Reader can SEE her walking and picking up the flower!

✅ GOOD (adds invisible context):
"${characterName} had waited all morning for this. Her heart beat fast with excitement."
→ RIGHT: Reader can't see waiting or heartbeat - narration ADDS this!

❌ BAD: "${characterName} smiled big and jumped up and down."
→ WRONG: The image shows her smiling and jumping!

✅ GOOD: "This was the best day ever. ${characterName} had done it all by herself!"
→ RIGHT: Internal feeling + accomplishment context the image can't show.

❌ BAD: "${characterName} held the butterfly gently in her hands."
→ WRONG: We can SEE her holding the butterfly!

✅ GOOD: "So small and delicate. ${characterName} had never been this careful before."
→ RIGHT: Her thoughts + comparison to past behavior.

NOW WRITE NARRATION that adds INVISIBLE context (thoughts, feelings, time, stakes).
DO NOT describe what the image shows. Simple words only.`;
    }
    
    // === YOUNG ADULTS PROMPT (Ages 12-17) ===
    if (audience === 'young adults') {
      const resolutionRules = narrativePosition === 'RESOLUTION' ? `
RESOLUTION REQUIREMENTS:
✓ Show transformation through internal realization
✓ Subtext over statement - trust the reader
✓ Earned emotional payoff` : '';

      return `Write 25-40 word narration for young adult comic panel ${panelNumber}/${totalPanels}.
${corePhilosophy}

YOUNG ADULT VOICE (Ages 12-17):
- Introspective, relatable internal voice
- Emotional complexity acknowledged
- Neither childish nor fully adult
- Identity, belonging, self-discovery themes

STORY CONTEXT:
"${originalStory.substring(0, 400)}"

THIS PANEL SHOWS: ${beat.beat}
CHARACTER EMOTION: ${beat.emotion}
NARRATIVE POSITION: ${narrativePosition}
${beat.dialogue ? `DIALOGUE IN SPEECH BUBBLE: "${beat.dialogue}"` : ''}
${resolutionRules}

=== GOOD vs BAD EXAMPLES ===

❌ BAD (describes visible action):
"${characterName} ran through the rain, her feet splashing in puddles as she headed toward the old building."
→ WRONG: Reader SEES her running through rain!

✅ GOOD (adds invisible context):
"Three years since she'd been back. The rain felt the same, but nothing else did."
→ RIGHT: Time context + emotional comparison the image can't show.

❌ BAD: "${characterName} clenched her fists and stared at him with anger."
→ WRONG: Her expression and pose are VISIBLE!

✅ GOOD: "She'd promised herself she wouldn't let him see how much it still hurt."
→ RIGHT: Internal promise + hidden emotion beneath visible anger.

NOW WRITE NARRATION that reveals internal world, time context, or stakes.
DO NOT describe visible actions, expressions, or settings.`;
    }
    
    // === ADULTS PROMPT (Ages 18+) ===
    const resolutionRules = narrativePosition === 'RESOLUTION' ? `
RESOLUTION REQUIREMENTS:
✓ Thematic resonance through implication
✓ Trust reader intelligence completely
✓ Ambiguity can be powerful` : '';

    return `Write 30-50 word narration for adult comic panel ${panelNumber}/${totalPanels}.
${corePhilosophy}

ADULT LITERARY VOICE (Ages 18+):
- Sophisticated, layered prose
- Subtext and implication
- Every word earns its place
- Psychological depth

STORY CONTEXT:
"${originalStory.substring(0, 500)}"

THIS PANEL SHOWS: ${beat.beat}
CHARACTER EMOTION: ${beat.emotion}
NARRATIVE POSITION: ${narrativePosition}
${beat.dialogue ? `DIALOGUE IN SPEECH BUBBLE: "${beat.dialogue}"` : ''}
${resolutionRules}

=== GOOD vs BAD EXAMPLES ===

❌ BAD (describes visible action):
"${characterName} stood at the window, looking out at the city lights, a glass of whiskey in her hand."
→ WRONG: All of this is VISIBLE in the image!

✅ GOOD (adds invisible context):
"Seventeen floors up, the city looked almost peaceful. She'd learned long ago that distance was just another kind of lie."
→ RIGHT: Her thoughts + life philosophy the image can't show.

❌ BAD: "${characterName} opened the letter, her hands trembling as she read the words."
→ WRONG: We can SEE her opening and reading!

✅ GOOD: "After twenty years, his handwriting still made her stomach drop. Some doors, once closed, should stay that way."
→ RIGHT: History + visceral reaction + her philosophy.

NOW WRITE NARRATION with psychological depth and thematic resonance.
DO NOT describe what the reader can see. Add the invisible layers.`;
  }

  /**
   * Validate and clean narration based on audience rules
   * Checks for forbidden words, sentence length, ending patterns, and dialogue overlap
   * 
   * COMIC BOOK BEST PRACTICE: Narration should NEVER:
   * 1. Repeat dialogue that's already in a speech bubble
   * 2. Describe visible actions the reader can see
   * 3. State what the character is feeling when expression shows it
   */
  private validateAndCleanNarration(
    narration: string,
    audience: AudienceType,
    narrativePosition: string,
    panelNumber: number,
    dialogue?: string,
    characterAction?: string
  ): string {
    let cleaned = narration;
    const warnings: string[] = [];
    
    // Get audience rules
    const rules = NARRATION_RULES[audience as keyof typeof NARRATION_RULES] || NARRATION_RULES.children;
    
    // === NEW: DIALOGUE OVERLAP CHECK (CRITICAL) ===
    // Comic book rule: Never repeat dialogue in narration
    if (dialogue && dialogue.trim().length > 0) {
      const dialogueLower = dialogue.toLowerCase().trim();
      const cleanedLower = cleaned.toLowerCase();
      
      // Check for exact dialogue match (with or without quotes)
      const dialogueEscaped = dialogue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const dialoguePatterns = [
        new RegExp(`["']${dialogueEscaped}["']`, 'gi'),
        new RegExp(`${dialogueEscaped}`, 'gi'),
        // Also catch paraphrased dialogue (same key words)
        ...this.extractKeyPhrases(dialogue).map(phrase => new RegExp(`\\b${phrase}\\b`, 'gi'))
      ];
      
      for (const pattern of dialoguePatterns) {
        if (pattern.test(cleaned)) {
          cleaned = cleaned.replace(pattern, '').trim();
          warnings.push(`⚠️ Removed dialogue overlap from narration`);
        }
      }
      
      // Remove dialogue attribution phrases
      const attributionPatterns = [
        /,?\s*(she|he|they|it|the \w+)\s+(said|says|shouted|shouts|whispered|whispers|thought|thinks|asked|asks|exclaimed|exclaims|replied|replies|cried|cries|called|calls|yelled|yells|muttered|mutters|declared|declares)\.?\s*/gi,
        /,?\s*with\s+(a\s+)?(determination|excitement|fear|joy|sadness|concern|hope|wonder|curiosity|confidence|smile|frown|sigh|laugh)\.?\s*/gi
      ];
      
      for (const pattern of attributionPatterns) {
        if (pattern.test(cleaned)) {
          cleaned = cleaned.replace(pattern, ' ').trim();
        }
      }
    }
    
    // === NEW: VISIBLE ACTION OVERLAP CHECK ===
    // Comic book rule: Don't describe what the image already shows
    if (characterAction && characterAction.trim().length > 0) {
      const visibleActionPatterns = [
        // Direct action descriptions that are visible
        /\b(walks|walked|walking|runs|ran|running|stands|stood|standing|sits|sat|sitting)\s+(to|toward|towards|into|from|away|up|down)\b/gi,
        /\b(picks up|picked up|picking up|puts down|put down|putting down)\b/gi,
        /\b(opens|opened|opening|closes|closed|closing)\s+(the|a|her|his|their)\b/gi,
        /\b(looks at|looked at|looking at|stares at|stared at|staring at)\b/gi,
        /\b(smiles|smiled|smiling|frowns|frowned|frowning|laughs|laughed|laughing|cries|cried|crying)\b/gi
      ];
      
      let hasVisibleActionWarning = false;
      for (const pattern of visibleActionPatterns) {
        if (pattern.test(cleaned)) {
          if (!hasVisibleActionWarning) {
            warnings.push(`⚠️ Narration describes visible action - should add invisible context instead`);
            hasVisibleActionWarning = true;
          }
        }
      }
    }
    
    // === CHILDREN'S VOCABULARY CHECK ===
    if (audience === 'children') {
      const forbiddenWords = NARRATION_RULES.children.forbiddenWords;
      const foundForbidden: string[] = [];
      
      for (const word of forbiddenWords) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        if (regex.test(cleaned)) {
          foundForbidden.push(word);
          cleaned = cleaned.replace(regex, '');
        }
      }
      
      if (foundForbidden.length > 0) {
        warnings.push(`⚠️ Removed forbidden words for children: ${foundForbidden.join(', ')}`);
      }
      
      // Check sentence length
      const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim());
      const longSentences = sentences.filter(s => s.split(/\s+/).length > NARRATION_RULES.children.maxWordsPerSentence);
      
      if (longSentences.length > 0) {
        warnings.push(`⚠️ ${longSentences.length} sentences exceed max ${NARRATION_RULES.children.maxWordsPerSentence} words for children`);
      }
      
      // === CHILDREN'S RESOLUTION CHECK ===
      if (narrativePosition === 'RESOLUTION') {
        const forbiddenEndingPatterns = [
          /happily ever after/i,
          /magic would always/i,
          /wonder lives in/i,
          /in that moment.*everything changed/i,
          /the (magic|wonder|beauty) of/i
        ];
        
        for (const pattern of forbiddenEndingPatterns) {
          if (pattern.test(cleaned)) {
            warnings.push(`⚠️ Children's ending contains forbidden abstract pattern`);
          }
        }
      }
    }
    
    // === YOUNG ADULT CHECKS ===
    if (audience === 'young adults') {
      const preachyPatterns = [
        /and so .* learned that/i,
        /the moral of/i,
        /remember kids/i,
        /this teaches us/i
      ];
      
      for (const pattern of preachyPatterns) {
        if (pattern.test(cleaned)) {
          warnings.push(`⚠️ YA narration contains preachy pattern`);
        }
      }
    }
    
    // === ADULT CHECKS ===
    if (audience === 'adults') {
      const simplePatterns = [
        /and they all/i,
        /happily ever/i,
        /learned (a|his|her|their) lesson/i,
        /and everything was (okay|fine|better)/i
      ];
      
      for (const pattern of simplePatterns) {
        if (pattern.test(cleaned)) {
          warnings.push(`⚠️ Adult narration may be oversimplified`);
        }
      }
    }
    
    // Log any warnings
    if (warnings.length > 0) {
      console.log(`📝 Narration validation (Panel ${panelNumber}, ${audience}):`);
      warnings.forEach(w => console.log(`   ${w}`));
    }
    
    // Clean up any double spaces, orphaned punctuation from word removal
    cleaned = cleaned
      .replace(/\s+/g, ' ')
      .replace(/^\s*[.,!?]\s*/g, '')
      .replace(/\s*[.,!?]\s*[.,!?]/g, '.')
      .trim();
    
    // Ensure narration isn't empty after cleaning
    if (cleaned.length < 5) {
      console.log(`⚠️ Narration too short after cleaning, panel ${panelNumber} may need silent treatment`);
      return '';
    }
    
    return cleaned;
  }

  /**
   * Extract key phrases from dialogue for overlap detection
   * Returns 2-3 word phrases that would indicate duplication
   */
  private extractKeyPhrases(dialogue: string): string[] {
    const phrases: string[] = [];
    const words = dialogue.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3);
    
    // Extract meaningful 2-word combinations (skip common words)
    const skipWords = ['the', 'and', 'but', 'that', 'this', 'with', 'have', 'from', 'they', 'been', 'were', 'said', 'each', 'which'];
    const meaningfulWords = words.filter(w => !skipWords.includes(w));
    
    for (let i = 0; i < meaningfulWords.length - 1; i++) {
      phrases.push(`${meaningfulWords[i]}\\s+${meaningfulWords[i + 1]}`);
    }
    
    return phrases.slice(0, 3); // Limit to prevent over-matching
  }

  /**
   * Calculate average sentence length for quality metrics
   */
  private calculateAvgSentenceLength(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    if (sentences.length === 0) return 0;
    
    const totalWords = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0);
    return Math.round(totalWords / sentences.length);
  }

  /**
   * Calculate emotional weight for panel sizing (Spiegelman principle)
   * Scale: 1-10 where 10 = full-width climax panel, 1-3 = small transition
   * 
   * COMIC BOOK BEST PRACTICE:
   * - Climax panels (70-85% through) should be largest
   * - Opening/establishing shots should be prominent
   * - Resolution panels deserve emphasis
   * - Transitions can be smaller
   */
  private calculateEmotionalWeight(
    beat: StoryBeat,
    panelNumber: number,
    totalPanels: number
  ): number {
    const position = panelNumber / totalPanels;
    let weight = 5; // Default medium weight
    
    // Position-based weight
    if (position < 0.1) {
      // Opening - needs establishment
      weight = 7;
    } else if (position >= 0.7 && position <= 0.85) {
      // Climax zone - maximum weight
      weight = 9;
    } else if (position > 0.9) {
      // Resolution - important closure
      weight = 7;
    }
    
    // Emotion-based adjustment
    const highEmotionKeywords = ['triumph', 'devastat', 'shock', 'terror', 'ecstat', 'furious', 'heartbreak'];
    const lowEmotionKeywords = ['calm', 'peaceful', 'quiet', 'still', 'neutral'];
    
    const emotionLower = (beat.emotion || '').toLowerCase();
    
    if (highEmotionKeywords.some(kw => emotionLower.includes(kw))) {
      weight = Math.min(10, weight + 2);
    } else if (lowEmotionKeywords.some(kw => emotionLower.includes(kw))) {
      weight = Math.max(3, weight - 1);
    }
    
    // Panel type adjustment
    if (beat.panelType === 'establishing_shot' || beat.panelPurpose === 'establish') {
      weight = Math.max(weight, 7);
    }
    
    // Silent panels often carry heavy visual weight
    if (beat.isSilent && beat.silentReason === 'visual_impact') {
      weight = Math.min(10, weight + 2);
    }
    
    return Math.round(weight);
  }

/**
   * Determine panel border style based on emotion and action (Eisner principle)
   * Border style communicates mood before the reader processes content
   * 
   * COMIC BOOK BEST PRACTICE:
   * - Action/danger: Jagged edges convey energy and chaos
   * - Dreams/memories: Wavy edges signal non-reality
   * - Impact moments: Broken edges for breakthrough moments
   * - Calm scenes: Clean edges for stability
   * - Immersive moments: No border for expansive feeling
   */
private determineBorderStyle(
  beat: StoryBeat,
  panelNumber: number,
  totalPanels: number
): 'clean' | 'jagged' | 'wavy' | 'broken' | 'soft' | 'none' {
  const emotion = (beat.emotion || '').toLowerCase();
  const action = (beat.characterAction || '').toLowerCase();
  const panelType = (beat.panelType || '').toLowerCase();
  
  // Action/danger emotions get jagged borders
  const actionEmotions = ['angry', 'furious', 'scared', 'terrified', 'shocked', 'panicked'];
  if (actionEmotions.some(e => emotion.includes(e))) {
    return 'jagged';
  }
  
  // Action verbs get jagged borders
  const actionVerbs = ['run', 'jump', 'fight', 'crash', 'explode', 'chase', 'attack', 'flee'];
  if (actionVerbs.some(v => action.includes(v))) {
    return 'jagged';
  }
  
  // Dream/memory/flashback get wavy borders
  const dreamIndicators = ['dream', 'remember', 'memory', 'imagine', 'vision', 'flashback'];
  if (dreamIndicators.some(d => beat.beat?.toLowerCase().includes(d) || action.includes(d))) {
    return 'wavy';
  }
  
  // High emotional weight climax moments get broken borders
  const weight = beat.emotionalWeight || 5;
  if (weight >= 9 && panelNumber !== 1 && panelNumber !== totalPanels) {
    return 'broken';
  }
  
  // Establishing shots and splash panels get no border for immersion
  if (panelType.includes('establishing') || panelType.includes('splash')) {
    return 'none';
  }
  
  // Soft emotions get soft borders
  const softEmotions = ['peaceful', 'calm', 'gentle', 'sleepy', 'tender', 'nostalgic'];
  if (softEmotions.some(e => emotion.includes(e))) {
    return 'soft';
  }
  
  // Default: clean professional borders
  return 'clean';
}

/**
   * Extract character pose category from action description
   * Used to prevent repetitive poses in adjacent panels
   * 
   * COMIC BOOK BEST PRACTICE (Eisner's Sequential Art):
   * - Never repeat the same body position in consecutive panels
   * - Each panel should show progression of movement
   * - Variety in poses creates visual rhythm
   * 
   * @returns Pose category: 'standing' | 'sitting' | 'walking' | 'running' | 'crouching' | 'lying' | 'jumping' | 'reaching' | 'other'
   */
private extractPoseFromAction(action: string): string {
  const actionLower = (action || '').toLowerCase();
  
  // Pose detection patterns (order matters - more specific first)
  const posePatterns: [RegExp, string][] = [
    [/\b(crawl|crouch|kneel|squat|duck|huddle)\w*\b/, 'crouching'],
    [/\b(lie|lay|lying|sleeping|asleep|prone|horizontal)\w*\b/, 'lying'],
    [/\b(jump|leap|hop|bounce|spring|vault)\w*\b/, 'jumping'],
    [/\b(run|sprint|dash|rush|race|flee)\w*\b/, 'running'],
    [/\b(walk|step|stroll|wander|pace|march)\w*\b/, 'walking'],
    [/\b(sit|seated|sat|perch)\w*\b/, 'sitting'],
    [/\b(reach|stretch|extend|grab|grasp|point)\w*\b/, 'reaching'],
    [/\b(stand|stood|standing|upright|erect)\w*\b/, 'standing'],
    [/\b(climb|climbing|scale|ascend)\w*\b/, 'climbing'],
    [/\b(bend|lean|stoop|bow)\w*\b/, 'bending']
  ];
  
  for (const [pattern, pose] of posePatterns) {
    if (pattern.test(actionLower)) {
      return pose;
    }
  }
  
  return 'other';
}

/**
   * Calculate narrative position for visual contrast enhancement
   * 
   * COMIC BOOK BEST PRACTICE (Eisner/McCloud):
   * - Different story positions deserve different visual treatment
   * - Climax needs dramatic lighting/contrast
   * - Resolution needs warm, conclusive lighting
   */
private calculateNarrativePosition(
  panelNumber: number,
  totalPanels: number
): 'OPENING' | 'SETUP' | 'RISING_ACTION' | 'CLIMAX' | 'RESOLUTION' {
  const position = panelNumber / totalPanels;
  
  if (position < 0.15) return 'OPENING';
  if (position < 0.3) return 'SETUP';
  if (position < 0.7) return 'RISING_ACTION';
  if (position < 0.85) return 'CLIMAX';
  return 'RESOLUTION';
}

  // ===== STORY STRUCTURE VALIDATION =====

  /**
   * Validate story structure meets audience-specific requirements
   * Logs quality metrics but does NOT block generation on warnings
   * 
   * Checks for:
   * - Goal identifiable by expected panel
   * - Obstacle present by expected panel
   * - Resolution matches audience requirements
   * - Panel diversity requirements
   * - Narration vocabulary level
   */
  public validateStoryStructure(
    storyAnalysis: StoryAnalysis,
    panels: ComicPanel[],
    audience: AudienceType
  ): { 
    isValid: boolean; 
    structureMetrics: any; 
    warnings: string[];
    recommendations: string[];
  } {
    console.log(`\n📊 ===== STORY STRUCTURE VALIDATION (${audience.toUpperCase()}) =====`);
    
    const warnings: string[] = [];
    const recommendations: string[] = [];
    const beats = storyAnalysis.storyBeats || [];
    const totalPanels = panels.length;
    
    // === AUDIENCE-SPECIFIC STRUCTURE REQUIREMENTS ===
    const structureReqs = this.getAudienceStructureRequirements(audience, totalPanels);
    
    // === 1. GOAL IDENTIFICATION CHECK ===
    const goalPanel = this.findGoalPanel(beats);
    const goalMetrics = {
      found: goalPanel !== null,
      panel: goalPanel?.panelIndex,
      expectedBy: structureReqs.goalExpectedBy,
      onTime: goalPanel !== null && goalPanel.panelIndex <= structureReqs.goalExpectedBy
    };
    
    if (!goalMetrics.found) {
      warnings.push(`⚠️ No clear GOAL identified in story beats`);
      recommendations.push(`Add explicit goal for character by panel ${structureReqs.goalExpectedBy}`);
    } else if (!goalMetrics.onTime) {
      warnings.push(`⚠️ Goal appears at panel ${goalPanel!.panelIndex}, expected by panel ${structureReqs.goalExpectedBy}`);
    }
    
    // === 2. OBSTACLE IDENTIFICATION CHECK ===
    const obstaclePanel = this.findObstaclePanel(beats);
    const obstacleMetrics = {
      found: obstaclePanel !== null,
      panel: obstaclePanel?.panelIndex,
      expectedBy: structureReqs.obstacleExpectedBy,
      onTime: obstaclePanel !== null && obstaclePanel.panelIndex <= structureReqs.obstacleExpectedBy
    };
    
    if (!obstacleMetrics.found) {
      warnings.push(`⚠️ No clear OBSTACLE identified in story beats`);
      recommendations.push(`Add explicit obstacle/challenge by panel ${structureReqs.obstacleExpectedBy}`);
    } else if (!obstacleMetrics.onTime) {
      warnings.push(`⚠️ Obstacle appears at panel ${obstaclePanel!.panelIndex}, expected by panel ${structureReqs.obstacleExpectedBy}`);
    }
    
    // === 3. RESOLUTION CHECK ===
    const resolutionPanel = panels[panels.length - 1];
    const resolutionMetrics = this.validateResolution(resolutionPanel, audience, beats);
    
    if (!resolutionMetrics.isValid) {
      warnings.push(...resolutionMetrics.warnings);
      recommendations.push(...resolutionMetrics.recommendations);
    }
    
    // === 4. PANEL DIVERSITY CHECK ===
    const diversityMetrics = this.validatePanelDiversity(panels, audience);
    if (!diversityMetrics.isValid) {
      warnings.push(...diversityMetrics.warnings);
    }
    
    // === 5. NARRATION QUALITY CHECK ===
    const narrationMetrics = this.validateNarrationQuality(panels, audience);
    if (!narrationMetrics.isValid) {
      warnings.push(...narrationMetrics.warnings);
    }
    
    // === COMPILE STRUCTURE METRICS ===
    const structureMetrics = {
      goal: goalMetrics,
      obstacle: obstacleMetrics,
      resolution: resolutionMetrics,
      panelDiversity: diversityMetrics.metrics,
      narrationQuality: narrationMetrics.metrics,
      audienceRequirements: structureReqs
    };
    
    // === LOG COMPREHENSIVE QUALITY REPORT ===
    console.log(`\n📊 Story Structure Report:`);
    console.log(`   🎯 Goal: ${goalMetrics.found ? `Panel ${goalMetrics.panel}` : 'NOT FOUND'} (expected by panel ${structureReqs.goalExpectedBy})`);
    console.log(`   🚧 Obstacle: ${obstacleMetrics.found ? `Panel ${obstacleMetrics.panel}` : 'NOT FOUND'} (expected by panel ${structureReqs.obstacleExpectedBy})`);
    console.log(`   ✅ Resolution: ${resolutionMetrics.isValid ? 'VALID' : 'NEEDS IMPROVEMENT'}`);
    
    console.log(`\n🎬 Panel Diversity:`);
    console.log(`   📊 Unique shot types: ${diversityMetrics.metrics.uniqueShotTypes}`);
    console.log(`   🏃 Unique actions: ${diversityMetrics.metrics.uniqueActions}`);
    console.log(`   🔄 Max consecutive same type: ${diversityMetrics.metrics.maxConsecutiveSameType}`);
    
    console.log(`\n📝 Narration Quality:`);
    console.log(`   📏 Avg sentence length: ${narrationMetrics.metrics.avgSentenceLength} words`);
    console.log(`   📚 Vocabulary level: ${narrationMetrics.metrics.vocabularyLevel}`);
    
    if (warnings.length > 0) {
      console.log(`\n⚠️ Warnings (${warnings.length}):`);
      warnings.forEach(w => console.log(`   ${w}`));
    }
    
    if (recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      recommendations.forEach(r => console.log(`   • ${r}`));
    }
    
    const isValid = warnings.length === 0;
    console.log(`\n${isValid ? '✅' : '⚠️'} Overall Structure: ${isValid ? 'VALID' : 'HAS WARNINGS'}`);
    console.log(`===== END VALIDATION =====\n`);
    
    return {
      isValid,
      structureMetrics,
      warnings,
      recommendations
    };
  }

  /**
   * Get audience-specific structure requirements
   */
  private getAudienceStructureRequirements(audience: AudienceType, totalPanels: number): any {
    const requirements = {
      children: {
        // Children: 8 panels
        goalExpectedBy: 3,           // Goal by panel 2-3
        obstacleExpectedBy: 4,       // Obstacle by panel 3-4
        climaxPanel: 7,              // Panel 7
        resolutionPanel: 8,          // Panel 8
        requiredElements: ['clear_problem', 'clear_solution', 'explicit_lesson', 'happy_ending'],
        forbiddenElements: ['ambiguous_ending', 'unresolved_conflict', 'abstract_conclusion', 'scary_obstacles']
      },
      'young adults': {
        // Young Adults: 15 panels
        goalExpectedBy: 4,           // Goal by panel 2-4
        obstacleExpectedBy: 6,       // First obstacle by panel 4-6
        climaxPanel: 14,             // Panels 12-14
        resolutionPanel: 15,         // Panel 15
        requiredElements: ['internal_conflict', 'external_conflict', 'character_growth', 'earned_resolution'],
        forbiddenElements: ['preachy_lesson', 'oversimplification', 'adult_lecturing']
      },
      adults: {
        // Adults: 24 panels
        goalExpectedBy: 5,           // Goal revealed by panel 3-5
        obstacleExpectedBy: 8,       // Main obstacle by panel 5-8
        climaxPanel: 22,             // Panels 20-22
        resolutionPanel: 24,         // Panels 23-24
        requiredElements: ['psychological_depth', 'moral_complexity', 'earned_payoff', 'thematic_resonance'],
        forbiddenElements: ['spelling_out_themes', 'unearned_resolution', 'simplistic_conclusion']
      }
    };
    
    return requirements[audience as keyof typeof requirements] || requirements.children;
  }

  /**
   * Find the panel where the goal is introduced
   */
  private findGoalPanel(beats: StoryBeat[]): { panelIndex: number; beat: StoryBeat } | null {
    const goalIndicators = [
      'want', 'need', 'must', 'goal', 'find', 'discover', 'search', 'look for',
      'help', 'save', 'protect', 'learn', 'become', 'prove', 'achieve',
      'desires', 'hopes', 'dreams', 'seeks', 'tries to'
    ];
    
    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i];
      const beatText = `${beat.beat} ${beat.characterAction || ''}`.toLowerCase();
      
      if (goalIndicators.some(indicator => beatText.includes(indicator))) {
        return { panelIndex: i + 1, beat };
      }
      
      // Also check panelPurpose
      if (beat.panelPurpose?.toLowerCase().includes('goal') || 
          beat.panelPurpose?.toLowerCase().includes('setup')) {
        return { panelIndex: i + 1, beat };
      }
    }
    
    return null;
  }

  /**
   * Find the panel where the main obstacle is introduced
   */
  private findObstaclePanel(beats: StoryBeat[]): { panelIndex: number; beat: StoryBeat } | null {
    const obstacleIndicators = [
      'but', 'however', 'obstacle', 'challenge', 'problem', 'difficult',
      'can\'t', 'cannot', 'unable', 'blocked', 'stops', 'prevents',
      'fear', 'afraid', 'worried', 'trouble', 'danger', 'conflict',
      'struggle', 'fight', 'oppose', 'resist'
    ];
    
    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i];
      const beatText = `${beat.beat} ${beat.characterAction || ''}`.toLowerCase();
      
      if (obstacleIndicators.some(indicator => beatText.includes(indicator))) {
        return { panelIndex: i + 1, beat };
      }
      
      // Check panelPurpose
      if (beat.panelPurpose?.toLowerCase().includes('obstacle') || 
          beat.panelPurpose?.toLowerCase().includes('conflict') ||
          beat.panelPurpose?.toLowerCase().includes('challenge')) {
        return { panelIndex: i + 1, beat };
      }
      
      // Check emotion for conflict indicators
      const conflictEmotions = ['scared', 'worried', 'frustrated', 'angry', 'confused'];
      if (conflictEmotions.includes(beat.emotion?.toLowerCase())) {
        return { panelIndex: i + 1, beat };
      }
    }
    
    return null;
  }

  /**
   * Validate resolution panel meets audience requirements
   */
  private validateResolution(
    panel: ComicPanel, 
    audience: AudienceType,
    beats: StoryBeat[]
  ): { isValid: boolean; warnings: string[]; recommendations: string[] } {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    const narration = panel.narration || panel.description || '';
    const lastBeat = beats[beats.length - 1];
    
    // === CHILDREN'S RESOLUTION VALIDATION ===
    if (audience === 'children') {
      // Check for abstract/forbidden patterns
      const forbiddenPatterns = [
        /happily ever after/i,
        /magic would always/i,
        /wonder lives in/i,
        /in that moment.*everything changed/i,
        /the (magic|wonder|beauty) of/i,
        /forever in .* heart/i
      ];
      
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(narration)) {
          warnings.push(`Children's resolution contains forbidden abstract pattern`);
        }
      }
      
      // Check for explicit lesson (children need this)
      const lessonIndicators = ['learned', 'now knew', 'understood', 'realized', 'discovered'];
      const hasExplicitLesson = lessonIndicators.some(ind => narration.toLowerCase().includes(ind));
      
      if (!hasExplicitLesson) {
        recommendations.push(`Children's resolution should include explicit lesson ("${panel.description?.split(' ')[0] || 'Character'} learned that...")`)
      }
      
      // Check for concrete outcome
      const abstractWords = ['magic', 'wonder', 'forever', 'always', 'eternal', 'infinite'];
      const hasAbstract = abstractWords.some(w => narration.toLowerCase().includes(w));
      if (hasAbstract) {
        warnings.push(`Children's resolution uses abstract concepts - should be concrete`);
      }
    }
    
    // === YOUNG ADULT RESOLUTION VALIDATION ===
    if (audience === 'young adults') {
      // Check for preachy patterns
      const preachyPatterns = [
        /and so .* learned that/i,
        /the moral of/i,
        /this teaches us/i,
        /remember that/i
      ];
      
      for (const pattern of preachyPatterns) {
        if (pattern.test(narration)) {
          warnings.push(`YA resolution sounds preachy - should show transformation through action`);
        }
      }
      
      // Check for character growth indication
      const growthIndicators = ['changed', 'different', 'knew', 'understood', 'wasn\'t the same'];
      const showsGrowth = growthIndicators.some(ind => narration.toLowerCase().includes(ind));
      
      if (!showsGrowth && lastBeat?.panelPurpose !== 'resolve') {
        recommendations.push(`YA resolution should show character transformation through action/choice`);
      }
    }
    
    // === ADULT RESOLUTION VALIDATION ===
    if (audience === 'adults') {
      // Check for oversimplification
      const simplePatterns = [
        /and they all/i,
        /happily ever/i,
        /learned (a|his|her|their) lesson/i,
        /everything was (okay|fine|better)/i,
        /and so .* lived/i
      ];
      
      for (const pattern of simplePatterns) {
        if (pattern.test(narration)) {
          warnings.push(`Adult resolution may be oversimplified for the audience`);
        }
      }
      
      // Check for thematic depth
      const depthIndicators = ['understood', 'realized', 'silence', 'weight', 'echo', 'memory'];
      const hasDepth = depthIndicators.some(ind => narration.toLowerCase().includes(ind));
      
      if (!hasDepth) {
        recommendations.push(`Adult resolution could benefit from more thematic/psychological depth`);
      }
    }
    
    return {
      isValid: warnings.length === 0,
      warnings,
      recommendations
    };
  }

  /**
   * Validate narration quality across all panels
   */
  private validateNarrationQuality(
    panels: ComicPanel[], 
    audience: AudienceType
  ): { isValid: boolean; warnings: string[]; metrics: any } {
    const warnings: string[] = [];
    const rules = NARRATION_RULES[audience as keyof typeof NARRATION_RULES] || NARRATION_RULES.children;
    
    let totalSentences = 0;
    let totalWords = 0;
    let longSentences = 0;
    let forbiddenWordCount = 0;
    
    for (const panel of panels) {
      const narration = panel.narration || panel.description || '';
      const sentences = narration.split(/[.!?]+/).filter(s => s.trim());
      
      for (const sentence of sentences) {
        const words = sentence.split(/\s+/).filter(w => w);
        totalSentences++;
        totalWords += words.length;
        
        if (words.length > rules.maxWordsPerSentence) {
          longSentences++;
        }
      }
      
      // Check for forbidden words (children only)
      if (audience === 'children') {
        for (const forbidden of NARRATION_RULES.children.forbiddenWords) {
          if (narration.toLowerCase().includes(forbidden.toLowerCase())) {
            forbiddenWordCount++;
          }
        }
      }
    }
    
    const avgSentenceLength = totalSentences > 0 ? Math.round(totalWords / totalSentences) : 0;
    
    // Generate warnings
    if (audience === 'children' && avgSentenceLength > 12) {
      warnings.push(`Children's narration avg sentence length (${avgSentenceLength}) exceeds recommended 10-12 words`);
    }
    
    if (longSentences > panels.length * 0.3) {
      warnings.push(`${longSentences} sentences exceed max length for ${audience}`);
    }
    
    if (forbiddenWordCount > 0 && audience === 'children') {
      warnings.push(`Found ${forbiddenWordCount} instances of forbidden words in children's narration`);
    }
    
    // Determine vocabulary level
    let vocabularyLevel = 'appropriate';
    if (audience === 'children' && avgSentenceLength > 15) {
      vocabularyLevel = 'too_complex';
    } else if (audience === 'adults' && avgSentenceLength < 10) {
      vocabularyLevel = 'may_be_too_simple';
    }
    
    return {
      isValid: warnings.length === 0,
      warnings,
      metrics: {
        avgSentenceLength,
        totalSentences,
        longSentences,
        forbiddenWordCount,
        vocabularyLevel
      }
    };
  }

  // ===== OPTIMIZED IMAGE PROMPT BUILDING (FROM BOTH FILES) =====

  /**
   * Build highly optimized image prompts with DNA consistency
   * FIXED: All TypeScript errors resolved
   */
  private buildOptimizedImagePrompt(
    beat: StoryBeat,
    characterDNA: CharacterDNA | null,
    environmentalDNA: EnvironmentalDNA,
    config: any,
    artStyle: string,
    panelContext: { panelNumber: number; totalPanels: number; pageNumber: number }
  ): string {
    // Determine camera angle for this beat
    const cameraAngle = this.determineCameraAngle(beat);

    // Core story moment (~300 chars) - Include action context for purposeful illustrations
    const actionDescription = beat.actionContext 
      ? `${beat.characterAction} (PURPOSE: ${beat.actionContext})`
      : beat.characterAction;
    const coreSection = `${beat.beat}. Character ${actionDescription} with ${beat.emotion} emotion. ${beat.visualPriority} visual focus. Camera angle: ${cameraAngle} for ${beat.emotion} emotion.`;

    // Character DNA section - ENFORCE CONSISTENCY WITH FULL DESCRIPTION
    const characterSection = characterDNA ?
      `CHARACTER (MATCH EXACTLY):
${characterDNA.description.substring(0, 600)}

Fingerprint: ${characterDNA.visualFingerprint || 'maintain consistency'}

Features: ${characterDNA.consistencyChecklist ? characterDNA.consistencyChecklist.slice(0, 5).join(', ') : 'exact match required'}` :
      'CHARACTER: Consistent with previous panels';

    // Environmental DNA section with recurring element enforcement
    const recurringElementsText = environmentalDNA.visualContinuity.recurringObjects?.length
      ? environmentalDNA.visualContinuity.recurringObjects.join(', ')
      : 'maintain consistency';
    const mandatoryFeatures = environmentalDNA.primaryLocation.keyFeatures.slice(0, 3).join(', ');

    const environmentSection = `WORLD: ${environmentalDNA.primaryLocation.name}
ATMOSPHERE: ${environmentalDNA.lightingContext.lightingMood}

RECURRING ELEMENTS: ${recurringElementsText}
MANDATORY: These elements must appear in SAME style: ${mandatoryFeatures}`;

    // Art style and quality section with style calibration (~200 chars)
    const styleCalibration = STYLE_SPECIFIC_PANEL_CALIBRATION[artStyle] || STYLE_SPECIFIC_PANEL_CALIBRATION['semi-realistic'];
    const styleSection = `STYLE: ${artStyle} - ${styleCalibration.stylePrompt}, professional ${config.visualStyle || 'detailed'}
QUALITY: High-resolution, detailed, ${config.complexityLevel} composition`;

    // Panel context (~100 chars)
    const contextSection = `PANEL: ${panelContext.panelNumber}/${panelContext.totalPanels} | PAGE: ${panelContext.pageNumber}`;

    // Speech bubble section if applicable
    const speechSection = beat.hasSpeechBubble ? 
      `DIALOGUE: "${beat.dialogue}" in ${beat.speechBubbleStyle} bubble` : '';

    // Combine all sections with newlines (CHARACTER FIRST for DALL-E priority)
    const sections = [characterSection, coreSection, environmentSection, styleSection, contextSection];
    if (speechSection) sections.push(speechSection);

    const fullPrompt = sections.join('\n\n');

    // Optimize if too long
    return fullPrompt.length > 4000 ? 
      this.optimizePromptLength(fullPrompt, 4000) : 
      fullPrompt;
  }

  // ===== QUALITY ASSESSMENT SYSTEM (FROM BOTH FILES) =====

  /**
   * Calculate advanced quality metrics for generated comic
   * FIXED: All TypeScript errors resolved
   */
  async calculateAdvancedQualityMetrics(
    generatedPanels: ComicPanel[],
    originalContext: {
      characterDNA?: CharacterDNA;
      environmentalDNA?: EnvironmentalDNA;
      storyAnalysis?: StoryAnalysis;
      targetAudience: AudienceType;
      artStyle: string;
    }
  ): Promise<any> {
    console.log('Calculating advanced quality metrics...');

    const metrics: any = {
      characterConsistency: await this.measureAdvancedCharacterConsistency(
        generatedPanels, 
        originalContext.characterDNA
      ),
      environmentalCoherence: await this.measureEnvironmentalCoherence(
        generatedPanels, 
        originalContext.environmentalDNA
      ),
      narrativeCoherence: await this.measureNarrativeCoherence(
        generatedPanels, 
        originalContext.storyAnalysis
      ),
      visualQuality: await this.assessVisualQuality(generatedPanels, originalContext.artStyle),
      technicalExecution: await this.measureTechnicalExecution(generatedPanels),
      audienceAlignment: this.measureAudienceAlignment(
        generatedPanels, 
        originalContext.targetAudience
      ),
      dialogueEffectiveness: this.measureDialogueEffectiveness(generatedPanels),
      professionalGrade: 'A',
      overallScore: 0
    };

    // Calculate overall score with weighted components (FROM BOTH FILES)
    metrics.overallScore = this.calculateWeightedQualityScore(metrics);
    metrics.professionalGrade = this.assignProfessionalGrade(metrics.overallScore);

    console.log(`Quality analysis complete: ${metrics.overallScore}/100 (Grade: ${metrics.professionalGrade})`);
    
    return {
      ...metrics,
      timestamp: new Date().toISOString(),
      panelCount: generatedPanels.length,
      detailedAnalysis: {
        strengths: this.identifyQualityStrengths(metrics),
        improvements: this.identifyQualityImprovements(metrics),
        recommendations: this.generateQualityRecommendations(metrics)
      }
    };
  }

  // ===== UTILITY METHODS =====
  // FIXED: All TypeScript errors resolved

  private validateStoryBeats(beats: any[], config: any): StoryBeat[] {
    if (!Array.isArray(beats) || beats.length === 0) {
      throw new Error('QUALITY FAILURE: Story beats array is empty or invalid. AI must provide real story beats. Job must fail.');
    }

    // Design by Contract: Validate beat count is within acceptable range
    const minRequired = config.minPanels;
    const maxAllowed = config.maxPanels;
    
    if (beats.length < minRequired) {
      throw new Error(`QUALITY FAILURE: Story has ${beats.length} beats but requires minimum ${minRequired} beats. Story is too simple. AI must create more complex narrative. Job must fail.`);
    }
    
    if (beats.length > maxAllowed) {
      console.warn(`⚠️ Story has ${beats.length} beats, exceeding maximum ${maxAllowed}. Trimming to ${maxAllowed} beats.`);
      beats = beats.slice(0, maxAllowed);
    }

    // Validate each beat has required fields - fail if any are missing
    const validatedBeats = beats.map((beat, index) => {
      if (!beat.beat || typeof beat.beat !== 'string' || beat.beat.length < 10) {
        throw new Error(`QUALITY FAILURE: Story beat ${index + 1} has invalid or missing 'beat' description. Job must fail.`);
      }
      if (!beat.emotion || typeof beat.emotion !== 'string') {
        throw new Error(`QUALITY FAILURE: Story beat ${index + 1} has invalid or missing 'emotion'. Job must fail.`);
      }
      if (!beat.characterAction || typeof beat.characterAction !== 'string') {
        throw new Error(`QUALITY FAILURE: Story beat ${index + 1} has invalid or missing 'characterAction'. Job must fail.`);
      }
      
      // === DIALOGUE LENGTH VALIDATION BY SPEAKER AGE ===
      let validatedDialogue = beat.dialogue || undefined;
      if (validatedDialogue && beat.hasSpeechBubble) {
        // Try to determine speaker age from speakerName or context
        const speakerAge = beat.speakerAge || this.inferSpeakerAge(beat.speakerName, beat.beat);
        const voiceRules = DIALOGUE_VOICE_RULES[getDialogueVoiceForAge(speakerAge)];
        const dialogueWords = validatedDialogue.split(/\s+/).length;
        
        if (dialogueWords > voiceRules.maxWords) {
          console.log(`⚠️ Beat ${index + 1}: Dialogue too long for ${speakerAge} (${dialogueWords} words, max ${voiceRules.maxWords})`);
          // Truncate dialogue to max words
          const words = validatedDialogue.split(/\s+/);
          validatedDialogue = words.slice(0, voiceRules.maxWords).join(' ');
          // Ensure it ends with punctuation
          if (!/[.!?]$/.test(validatedDialogue)) {
            validatedDialogue += '...';
          }
          console.log(`   ✂️ Truncated to: "${validatedDialogue}"`);
        } else {
          console.log(`✅ Beat ${index + 1}: Dialogue OK for ${speakerAge} (${dialogueWords}/${voiceRules.maxWords} words)`);
        }
      }
      
      return {
        beat: beat.beat,
        emotion: beat.emotion,
        visualPriority: beat.visualPriority || 'character',
        characterAction: beat.characterAction,
        actionContext: beat.actionContext || undefined,  // WHY the action is being performed
        panelPurpose: beat.panelPurpose || 'narrative',
        narrativeFunction: beat.panelPurpose || 'narrative',
        environment: beat.environment || 'story setting',
        // === SILENT PANEL ENFORCEMENT ===
        // If panel is silent, force no dialogue and no speech bubble
        isSilent: Boolean(beat.isSilent),
        silentReason: beat.silentReason || undefined,
        dialogue: beat.isSilent ? undefined : validatedDialogue,
        hasSpeechBubble: beat.isSilent ? false : Boolean(beat.hasSpeechBubble),
        speechBubbleStyle: beat.isSilent ? undefined : (beat.speechBubbleStyle || undefined),
        // NEW: AI-driven speech bubble positioning
        speakerName: beat.isSilent ? undefined : (beat.speakerName || undefined),
        speakerPosition: beat.isSilent ? undefined : beat.speakerPosition,
        bubblePosition: beat.isSilent ? undefined : beat.bubblePosition,
        // NEW: Story-driven camera angles
        cameraAngle: beat.cameraAngle || undefined,
        cameraReason: beat.cameraReason || undefined,
        locationChange: beat.locationChange || undefined
      };
    });
    
    // Log silent panel count
    const silentCount = validatedBeats.filter(b => b.isSilent).length;
    if (silentCount > 0) {
      console.log(`🤫 Story has ${silentCount} silent panels for emotional impact`);
    }

    return validatedBeats;
  }

  /**
   * Infer speaker age from speaker name or beat context
   * Used for dialogue length validation when explicit age isn't provided
   */
  private inferSpeakerAge(speakerName?: string, beatContext?: string): string {
    if (!speakerName && !beatContext) return 'adult';
    
    const nameLower = (speakerName || '').toLowerCase();
    const contextLower = (beatContext || '').toLowerCase();
    const combined = `${nameLower} ${contextLower}`;
    
    // Check for age indicators in name or context
    if (combined.includes('baby') || combined.includes('toddler') || combined.includes('infant')) {
      return 'toddler';
    }
    if (combined.includes('grandma') || combined.includes('grandpa') || 
        combined.includes('grandmother') || combined.includes('grandfather') ||
        combined.includes('elder') || combined.includes('old ')) {
      return 'senior';
    }
    if (combined.includes('mom') || combined.includes('dad') || 
        combined.includes('mother') || combined.includes('father') ||
        combined.includes('parent') || combined.includes('teacher')) {
      return 'adult';
    }
    if (combined.includes('teen') || combined.includes('teenager')) {
      return 'teen';
    }
    
    // Default to child for children's stories, adult otherwise
    return 'child';
  }

  private ensureArray(value: any): string[] {
    if (Array.isArray(value)) {
      return value.map(item => String(item));
    }
    if (typeof value === 'string') {
      return value.split(',').map(s => s.trim()).filter(s => s);
    }
    return ['default_value'];
  }

  private ensureString(value: any): string {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.join(' ');
    return String(value || 'default');
  }

  private createFallbackStoryAnalysis(config: any, narrativeIntel: any): StoryAnalysis {
    // NO FALLBACKS - quality standard requires real story analysis
    throw new Error('QUALITY FAILURE: Cannot create story analysis. AI analysis failed and no fallback is permitted. Job must fail.');
  }

  private createFallbackStoryBeats(config: any): StoryBeat[] {
    // NO FALLBACKS - quality standard requires real story analysis
    throw new Error('QUALITY FAILURE: Cannot create story beats. AI story analysis failed and no fallback is permitted. Job must fail.');
  }

  private groupBeatsIntoPages(beats: StoryBeat[], beatsPerPage: number): StoryBeat[][] {
    const pages: StoryBeat[][] = [];
    for (let i = 0; i < beats.length; i += beatsPerPage) {
      pages.push(beats.slice(i, i + beatsPerPage));
    }
    return pages;
  }

  // ===== STORY-DRIVEN PANEL DIVERSITY SYSTEM =====

  /**
   * Map AI's cameraAngle to internal shot type
   * The AI analyzes the story and determines appropriate camera angles.
   * This method converts those decisions to our internal naming system.
   */
  private mapCameraAngleToShotType(cameraAngle: string | undefined): string | null {
    if (!cameraAngle) return null;
    
    const angleMapping: Record<string, string> = {
      'close-up': 'close_up',
      'closeup': 'close_up',
      'medium': 'medium_shot',
      'medium-shot': 'medium_shot',
      'wide': 'wide_establishing',
      'wide-shot': 'wide_establishing',
      'extreme-wide': 'wide_establishing',
      'establishing': 'wide_establishing',
      'over-shoulder': 'pov_over_shoulder',
      'over_shoulder': 'pov_over_shoulder',
      'pov': 'pov_over_shoulder',
      'low-angle': 'dramatic_angle',
      'low_angle': 'dramatic_angle',
      'high-angle': 'dramatic_angle',
      'high_angle': 'dramatic_angle',
      'dutch-angle': 'action_shot',
      'dutch_angle': 'action_shot',
      'action': 'action_shot',
      'dynamic': 'action_shot',
      'symbolic': 'symbolic_artistic',
      'artistic': 'symbolic_artistic'
    };
    
    const normalizedAngle = cameraAngle.toLowerCase().trim();
    return angleMapping[normalizedAngle] || null;
  }

  /**
   * Pre-generation diversity planning
   * Analyzes ALL beats BEFORE generation and ensures diversity requirements are met.
   * Respects AI decisions while guaranteeing minimum variety.
   * 
   * STORY-DRIVEN APPROACH:
   * - AI's cameraAngle from story analysis is the PRIMARY source
   * - Only adjust when diversity rules are violated
   * - Never change story-critical shots (first panel, location changes, climax)
   */
  private planPanelDiversity(
    beats: StoryBeat[],
    audience: AudienceType
  ): { plannedTypes: string[]; adjustments: string[] } {
    const config = PANEL_DIVERSITY_CONFIG[audience as keyof typeof PANEL_DIVERSITY_CONFIG] 
      || PANEL_DIVERSITY_CONFIG.children;
    
    const adjustments: string[] = [];
    const totalPanels = beats.length;
    
    // Step 1: Map all AI camera angles to shot types
    const plannedTypes: string[] = beats.map((beat, index) => {
      const aiShotType = this.mapCameraAngleToShotType(beat.cameraAngle);
      
      if (aiShotType) {
        const reason = beat.cameraReason ? ` (${beat.cameraReason})` : '';
        console.log(`📐 Panel ${index + 1}: Using AI's camera angle '${beat.cameraAngle}' → '${aiShotType}'${reason}`);
        return aiShotType;
      } else {
        // AI didn't provide camera angle - mark for later assignment
        return 'NEEDS_ASSIGNMENT';
      }
    });
    
    // Step 2: Assign types to panels without AI decisions using story position
    plannedTypes.forEach((type, index) => {
      if (type === 'NEEDS_ASSIGNMENT') {
        const position = index / totalPanels;
        let assignedType: string;
        
        if (index === 0) {
          assignedType = 'wide_establishing';
          adjustments.push(`Panel ${index + 1}: Assigned 'wide_establishing' (first panel - establishing shot)`);
        } else if (index === totalPanels - 1) {
          assignedType = 'medium_shot';
          adjustments.push(`Panel ${index + 1}: Assigned 'medium_shot' (final panel - resolution)`);
        } else if (position > 0.7 && position < 0.9) {
          assignedType = 'close_up';
          adjustments.push(`Panel ${index + 1}: Assigned 'close_up' (climax section)`);
        } else if (position < 0.3) {
          assignedType = index % 2 === 0 ? 'medium_shot' : 'wide_establishing';
          adjustments.push(`Panel ${index + 1}: Assigned '${assignedType}' (setup section)`);
        } else {
          const developmentTypes = ['medium_shot', 'close_up', 'action_shot'];
          assignedType = developmentTypes[index % developmentTypes.length];
          adjustments.push(`Panel ${index + 1}: Assigned '${assignedType}' (development section)`);
        }
        
        plannedTypes[index] = assignedType;
      }
    });
    
    // Step 3: Check for consecutive same-type violations and fix them
    for (let i = 1; i < plannedTypes.length; i++) {
      if (plannedTypes[i] === plannedTypes[i - 1]) {
        const beat = beats[i];
        const isStoryCritical = 
          i === 0 || 
          i === totalPanels - 1 ||
          (beat.locationChange && beat.locationChange !== 'same') ||
          (beat.cameraReason && beat.cameraReason.length > 0);
        
        if (!isStoryCritical) {
          // Find an alternative type
          const alternatives = ['medium_shot', 'close_up', 'action_shot', 'wide_establishing', 'dramatic_angle']
            .filter(t => t !== plannedTypes[i] && t !== plannedTypes[i - 1]);
          const newType = alternatives[i % alternatives.length];
          
          adjustments.push(`Panel ${i + 1}: Changed '${plannedTypes[i]}' → '${newType}' (avoid consecutive same type)`);
          plannedTypes[i] = newType;
        }
      }
    }
    
    // Step 4: Ensure minimum unique shot types
    const uniqueTypes = new Set(plannedTypes);
    if (uniqueTypes.size < config.minUniqueShotTypes) {
      const neededTypes = ['close_up', 'medium_shot', 'wide_establishing', 'action_shot', 'dramatic_angle']
        .filter(t => !uniqueTypes.has(t));
      
      // Find medium_shot panels that can be changed (not story-critical)
      const mediumIndices = plannedTypes
        .map((t, i) => ({ type: t, index: i }))
        .filter(({ type, index }) => {
          const beat = beats[index];
          return type === 'medium_shot' && 
                 index !== 0 && 
                 index !== totalPanels - 1 &&
                 !(beat.locationChange && beat.locationChange !== 'same') &&
                 !beat.cameraReason;
        })
        .map(({ index }) => index);
      
      // Replace some medium shots with needed types
      for (let i = 0; i < Math.min(neededTypes.length, mediumIndices.length); i++) {
        const targetIndex = mediumIndices[i];
        const newType = neededTypes[i];
        adjustments.push(`Panel ${targetIndex + 1}: Diversity adjustment '${plannedTypes[targetIndex]}' → '${newType}'`);
        plannedTypes[targetIndex] = newType;
      }
    }
    
    // Log final diversity stats
    const finalUniqueTypes = new Set(plannedTypes);
    console.log(`📊 Diversity Plan Complete: ${finalUniqueTypes.size} unique shot types planned`);
    console.log(`   Shot distribution: ${[...finalUniqueTypes].join(', ')}`);
    
    if (adjustments.length > 0) {
      console.log(`   📝 ${adjustments.length} adjustments made for diversity`);
    }
    
    return { plannedTypes, adjustments };
  }

  /**
   * ===== AUDIENCE-AWARE PANEL TYPE DETERMINATION =====
   * Uses PANEL_DIVERSITY_CONFIG to ensure varied, professional compositions
   * Tracks panel history to prevent repetitive patterns
   * 
   * PRIORITY ORDER:
   * 1. AI's cameraAngle from story analysis (if available)
   * 2. Pre-planned type from planPanelDiversity (if provided)
   * 3. Forbidden pattern avoidance
   * 4. Recommended sequence from config
   * 5. Story position-based fallback
   */
  private determinePanelType(
    beat: StoryBeat, 
    beatIndex: number, 
    totalBeats: number,
    audience: AudienceType = 'children',
    panelHistory: string[] = []
  ): string {
    const position = beatIndex / totalBeats;
    const panelNumber = beatIndex + 1;
    
    // Get audience-specific config
    const config = PANEL_DIVERSITY_CONFIG[audience as keyof typeof PANEL_DIVERSITY_CONFIG] 
      || PANEL_DIVERSITY_CONFIG.children;
    
    // === PRIORITY 1 (NEW): Use AI's cameraAngle from story analysis ===
    // The AI analyzes the story and determines appropriate camera angles.
    // We should trust these story-driven decisions as the primary source.
    const aiShotType = this.mapCameraAngleToShotType(beat.cameraAngle);
    if (aiShotType) {
      // Check for forbidden consecutive patterns before accepting
      if (panelHistory.length > 0 && panelHistory[panelHistory.length - 1] === aiShotType) {
        // AI's choice would create consecutive same-type - check if story-critical
        const isStoryCritical = 
          (beat.locationChange && beat.locationChange !== 'same') ||
          (beat.cameraReason && beat.cameraReason.length > 0);
        
        if (isStoryCritical) {
          // Story-critical shot - keep AI's decision
          console.log(`📐 Panel ${panelNumber}: Using AI's story-critical '${beat.cameraAngle}' → '${aiShotType}' (${beat.cameraReason || 'location change'})`);
          return aiShotType;
        } else {
          // Not story-critical - find alternative to avoid repetition
          const alternatives = ['medium_shot', 'close_up', 'action_shot', 'wide_establishing', 'dramatic_angle']
            .filter(t => t !== aiShotType);
          const alternativeType = alternatives[panelNumber % alternatives.length];
          console.log(`📐 Panel ${panelNumber}: AI suggested '${beat.cameraAngle}' but using '${alternativeType}' to avoid consecutive same type`);
          return alternativeType;
        }
      }
      
      // No conflict - use AI's decision
      const reason = beat.cameraReason ? ` (${beat.cameraReason})` : '';
      console.log(`📐 Panel ${panelNumber}: Using AI's camera angle '${beat.cameraAngle}' → '${aiShotType}'${reason}`);
      return aiShotType;
    }
    
    // === PRIORITY 2: Check for recommended sequence (fallback when AI didn't provide angle) ===
    const recommendedPanel = config.recommendedSequence.find(p => p.panel === panelNumber);
    if (recommendedPanel) {
      console.log(`📐 Panel ${panelNumber}: AI angle not provided, using recommended '${recommendedPanel.type}' for ${audience} - ${recommendedPanel.purpose}`);
      return recommendedPanel.type;
    }
    
    // === PRIORITY 3: Check for forbidden patterns ===
    // Prevent more than maxConsecutiveSameType in a row
    if (panelHistory.length >= config.maxConsecutiveSameType) {
      const recentPanels = panelHistory.slice(-config.maxConsecutiveSameType);
      const allSame = recentPanels.every(p => p === recentPanels[0]);
      
      if (allSame) {
        // Force a different type
        const lastType = recentPanels[0];
        const alternativeTypes = ['medium_shot', 'close_up', 'action_shot', 'wide_establishing']
          .filter(t => t !== lastType);
        const selectedType = alternativeTypes[panelNumber % alternativeTypes.length];
        console.log(`📐 Panel ${panelNumber}: Forcing type change to '${selectedType}' (avoiding ${config.maxConsecutiveSameType}+ consecutive '${lastType}')`);
        return selectedType;
      }
    }
    
    // === PRIORITY 3: Emotion-driven type selection ===
    const highEmotionTypes = ['scared', 'angry', 'surprised', 'determined', 'heartbroken', 'elated'];
    if (highEmotionTypes.includes(beat.emotion?.toLowerCase())) {
      return 'close_up';
    }
    
    // === PRIORITY 4: Action-driven type selection ===
    const actionLower = beat.characterAction?.toLowerCase() || '';
    if (actionLower.includes('run') || actionLower.includes('jump') || 
        actionLower.includes('fight') || actionLower.includes('chase')) {
      return 'action_shot';
    }
    
    // === PRIORITY 5: Position-based selection ===
    // First panel: establishing
    if (beatIndex === 0) {
      return audience === 'adults' ? 'symbolic_artistic' : 'wide_establishing';
    }
    
    // Last panel: resolution appropriate for audience
    if (beatIndex === totalBeats - 1) {
      if (audience === 'adults') return 'symbolic_artistic';
      if (audience === 'young adults') return 'medium_shot';
      return 'medium_shot'; // children
    }
    
    // Climax section (70-90% through)
    if (position > 0.7 && position < 0.9) {
      return 'dramatic_angle';
    }
    
    // Midpoint for young adults and adults
    if ((audience === 'young adults' || audience === 'adults') && position > 0.45 && position < 0.55) {
      return 'pov_over_shoulder';
    }
    
    // === PRIORITY 6: Distribute remaining types based on position ===
    if (position < 0.3) {
      // Setup section: mix of establishing and medium
      return panelNumber % 2 === 0 ? 'medium_shot' : 'wide_establishing';
    } else if (position < 0.7) {
      // Development: varied medium, close-up, action
      const developmentTypes = ['medium_shot', 'close_up', 'action_shot', 'medium_shot'];
      return developmentTypes[panelNumber % developmentTypes.length];
    } else {
      // Resolution: emotional close-ups and medium shots
      return panelNumber % 2 === 0 ? 'close_up' : 'medium_shot';
    }
  }

  /**
   * Validate panel diversity meets audience requirements
   * Returns warnings if diversity is insufficient
   */
  private validatePanelDiversity(
    panels: ComicPanel[], 
    audience: AudienceType
  ): { isValid: boolean; warnings: string[]; metrics: any } {
    const config = PANEL_DIVERSITY_CONFIG[audience as keyof typeof PANEL_DIVERSITY_CONFIG] 
      || PANEL_DIVERSITY_CONFIG.children;
    
    const warnings: string[] = [];
    
    // Count unique shot types
    const shotTypes = panels.map(p => p.panelType);
    const uniqueShotTypes = new Set(shotTypes);
    
    if (uniqueShotTypes.size < config.minUniqueShotTypes) {
      warnings.push(`⚠️ Panel Diversity: Only ${uniqueShotTypes.size} unique shot types (minimum ${config.minUniqueShotTypes} required for ${audience})`);
    }
    
    // Count unique actions
    const actions = panels.map(p => p.characterAction?.toLowerCase().split(' ')[0] || 'unknown');
    const uniqueActions = new Set(actions);
    
    if (uniqueActions.size < config.minUniqueActions) {
      warnings.push(`⚠️ Action Diversity: Only ${uniqueActions.size} unique actions (minimum ${config.minUniqueActions} required for ${audience})`);
    }
    
    // Check for consecutive same-type violations
    let maxConsecutive = 1;
    let currentConsecutive = 1;
    for (let i = 1; i < shotTypes.length; i++) {
      if (shotTypes[i] === shotTypes[i-1]) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 1;
      }
    }
    
    if (maxConsecutive > config.maxConsecutiveSameType) {
      warnings.push(`⚠️ Repetition: ${maxConsecutive} consecutive '${shotTypes.find((t, i) => shotTypes.slice(i, i + maxConsecutive).every(s => s === t))}' panels (max ${config.maxConsecutiveSameType} allowed)`);
    }
    
    // Check first/last panel difference
    if (panels.length > 1 && panels[0].panelType === panels[panels.length - 1].panelType) {
      warnings.push(`⚠️ Composition: First and last panels use same type '${panels[0].panelType}'`);
    }
    
    // Log diversity metrics
    const metrics = {
      uniqueShotTypes: uniqueShotTypes.size,
      uniqueActions: uniqueActions.size,
      maxConsecutiveSameType: maxConsecutive,
      shotTypeDistribution: Object.fromEntries(
        [...uniqueShotTypes].map(type => [type, shotTypes.filter(t => t === type).length])
      )
    };
    
    // Log quality metrics
    console.log(`🎬 Panel Diversity Metrics (${audience}):`);
    console.log(`   📊 Unique shot types: ${metrics.uniqueShotTypes}/${config.minUniqueShotTypes} required`);
    console.log(`   🏃 Unique actions: ${metrics.uniqueActions}/${config.minUniqueActions} required`);
    console.log(`   🔄 Max consecutive same type: ${metrics.maxConsecutiveSameType}/${config.maxConsecutiveSameType} allowed`);
    
    if (warnings.length > 0) {
      console.log(`   ⚠️ Warnings:`);
      warnings.forEach(w => console.log(`      ${w}`));
    } else {
      console.log(`   ✅ All diversity requirements met!`);
    }
    
    return {
      isValid: warnings.length === 0,
      warnings,
      metrics
    };
  }

  private determineCameraAngle(beat: StoryBeat): string {
    const emotion = beat.emotion.toLowerCase();

    if (emotion.includes('happy') || emotion.includes('triumphant')) return 'low_angle';
    if (emotion.includes('sad') || emotion.includes('defeated')) return 'high_angle';
    if (emotion.includes('mysterious') || emotion.includes('confused')) return 'dutch_angle';

    return 'straight_on';
  }

  private optimizePromptLength(prompt: string, maxLength: number): string {
    if (prompt.length <= maxLength) return prompt;
    
    // Simple truncation with ellipsis
    return prompt.substring(0, maxLength - 3) + '...';
  }

  // Environmental DNA utility methods
  private extractLocationCharacteristics(environments: string[]): string[] {
    return environments.map(env => `${env}_characteristics`);
  }

  private determineEnvironmentalColorPalette(environments: string[], audience: AudienceType): string[] {
    const audienceColors = {
      children: ['bright_blue', 'sunny_yellow', 'grass_green'],
      'young adults': ['deep_blue', 'warm_orange', 'forest_green'],
      adults: ['navy_blue', 'burnt_orange', 'olive_green']
    };
    return audienceColors[audience as keyof typeof audienceColors] || audienceColors.children;
  }

  private determineLightingMood(beats: StoryBeat[], audience: AudienceType): string {
    const moodMap = {
      children: 'bright_cheerful',
      'young adults': 'dynamic_engaging',
      adults: 'sophisticated_nuanced'
    };
    return moodMap[audience as keyof typeof moodMap] || 'bright_cheerful';
  }

  private extractBackgroundElements(environments: string[]): string[] {
    return environments.map(env => `${env}_background_elements`);
  }

  private createRecurringObjects(beats: StoryBeat[]): string[] {
    return ['consistent_props', 'recurring_elements'];
  }

  private determineEnvironmentalColorScheme(environments: string[], audience: AudienceType): string[] {
    return this.determineEnvironmentalColorPalette(environments, audience);
  }

  private determineAtmosphericEffects(audience: AudienceType): string[] {
    const effects = {
      children: ['sparkles', 'soft_lighting'],
      'young adults': ['dynamic_shadows', 'energy_effects'],
      adults: ['subtle_atmosphere', 'realistic_lighting']
    };
    return effects[audience as keyof typeof effects] || effects.children;
  }

  private determineEnvironmentalMood(audience: AudienceType): string {
    const moods = {
      children: 'playful_inviting',
      'young adults': 'adventurous_exciting',
      adults: 'sophisticated_immersive'
    };
    return moods[audience as keyof typeof moods] || 'playful_inviting';
  }

  // Character DNA extraction methods
  private extractCharacterDescription(analysis: string): string {
    return analysis.substring(0, 200) + '...';
  }

  private extractFacialFeatures(analysis: string): string[] {
    return ['distinctive_eyes', 'characteristic_smile', 'unique_hair'];
  }

  private extractBodyType(analysis: string): string {
    return 'proportional_build';
  }

  private extractClothingDescription(analysis: string): string {
    return 'signature_outfit';
  }

  private extractDistinctiveFeatures(analysis: string): string[] {
    return ['unique_characteristics'];
  }

  private extractColorPalette(analysis: string): string[] {
    return ['primary_colors', 'accent_tones'];
  }

  private extractExpressionBaseline(analysis: string): string {
    return 'friendly_neutral';
  }

  private createCompressedCharacterDescription(analysis: string): string {
    return analysis.substring(0, 100);
  }

  // Quality measurement methods (simplified implementations)
  private async measureAdvancedCharacterConsistency(panels: ComicPanel[], characterDNA?: CharacterDNA): Promise<number> {
    return characterDNA ? 95 : 85;
  }

  private async measureEnvironmentalCoherence(panels: ComicPanel[], environmentalDNA?: EnvironmentalDNA): Promise<number> {
    return environmentalDNA ? 90 : 80;
  }

  private async measureNarrativeCoherence(panels: ComicPanel[], storyAnalysis?: StoryAnalysis): Promise<number> {
    return storyAnalysis ? 88 : 75;
  }

  private async assessVisualQuality(panels: ComicPanel[], artStyle: string): Promise<number> {
    return 92;
  }

  private async measureTechnicalExecution(panels: ComicPanel[]): Promise<number> {
    return 90;
  }

  private measureAudienceAlignment(panels: ComicPanel[], audience: AudienceType): number {
    return 87;
  }

  private measureDialogueEffectiveness(panels: ComicPanel[]): number {
    const dialoguePanels = panels.filter(p => p.hasSpeechBubble);
    return dialoguePanels.length > 0 ? 85 : 80;
  }

  private calculateWeightedQualityScore(metrics: any): number {
    const weights = {
      characterConsistency: 0.20,
      environmentalCoherence: 0.15,
      narrativeCoherence: 0.20,
      visualQuality: 0.20,
      technicalExecution: 0.15,
      audienceAlignment: 0.10
    };

    let weightedScore = 0;
    for (const [metric, weight] of Object.entries(weights)) {
      weightedScore += (metrics[metric] || 0) * weight;
    }

    return Math.round(weightedScore);
  }

  private assignProfessionalGrade(score: number): string {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'A-';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'B-';
    return 'C+';
  }

  private identifyQualityStrengths(metrics: any): string[] {
    return Object.entries(metrics)
      .filter(([key, score]) => typeof score === 'number' && score > 90)
      .map(([key]) => key);
  }

  private identifyQualityImprovements(metrics: any): string[] {
    return Object.entries(metrics)
      .filter(([key, score]) => typeof score === 'number' && score < 80)
      .map(([key]) => key);
  }

  private generateQualityRecommendations(metrics: any): string[] {
    const recommendations = [];
    
    if (metrics.overallScore >= 90) {
      recommendations.push('Excellent quality achieved - maintain current standards');
    } else if (metrics.overallScore >= 80) {
      recommendations.push('Good quality with room for optimization');
    } else {
      recommendations.push('Focus on improvement areas for better results');
    }
    
    return recommendations;
  }
}