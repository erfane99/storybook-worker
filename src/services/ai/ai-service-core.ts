/**
 * ===== AI SERVICE CORE MODULE - MAIN ORCHESTRATOR =====
 * Enterprise-grade modular AI service that orchestrates all specialized engines
 * FIXED: Uses error handler adapter to bridge inherited error handling with modular components
 * 
 * File Location: lib/services/ai/ai-service-core.ts (REPLACES ORIGINAL AI SERVICE)
 * Dependencies: ALL modular components
 * 
 * Features:
 * - Complete modular architecture orchestration (REVOLUTIONARY UPGRADE)
 * - Professional comic book generation with all advanced features (FROM BOTH FILES)
 * - Enterprise-grade error handling, monitoring, and quality assessment (FROM BOTH FILES)
 * - Self-learning pattern evolution with continuous improvement (FROM BOTH FILES)
 * - Advanced narrative intelligence with visual DNA consistency (FROM BOTH FILES)
 * - Professional quality assessment with A+ to C- grading (FROM BOTH FILES)
 * - Circuit breaker protection with intelligent retry mechanisms (FROM BOTH FILES)
 * - Comprehensive health monitoring and metrics collection (FROM BOTH FILES)
 */

import { ErrorAwareBaseService } from '../base/error-aware-base-service.js';
import {
  IAIService,
  IDatabaseService,
  ServiceConfig,
  CharacterDNA,
  EnvironmentalDNA,
  StoryAnalysis,
  StoryBeat,
  AudienceType,
  PanelType,
  SceneGenerationOptions,
  SceneGenerationResult,
  ImageGenerationOptions,
  ImageGenerationResult,
  CharacterDescriptionOptions,
  CharacterDescriptionResult,
  CartoonizeOptions,
  CartoonizeResult,
  ChatCompletionOptions,
  ChatCompletionResult,
  StoryGenerationOptions,
  StoryGenerationResult
} from '../interfaces/service-contracts.js';

import { 
  Result,
  AsyncResult,
  AIServiceUnavailableError,
  AIAuthenticationError,
  AIRateLimitError,
  AIContentPolicyError,
  AITimeoutError
} from '../errors/index.js';

// FIXED: Import ErrorCategory from the correct path (error-types.ts) to resolve enum conflicts
import { ErrorCategory } from '../errors/error-types.js';

// ===== WORLD-CLASS STORY PROMPTS WITH AUDIENCE-SPECIFIC STRUCTURE =====
const WORLD_CLASS_STORY_PROMPTS = {
  systemPrompt: (audience: string, genre: string) => 
    `You are an EMMY-AWARD WINNING comic book writer specializing in ${audience} content. 
    Your ${genre} stories have perfect pacing, emotional depth, and visual richness.
    Every sentence must suggest a panel image.
    
${WORLD_CLASS_STORY_PROMPTS.getAudienceStoryStructure(audience)}`,

  /**
   * ===== AUDIENCE-SPECIFIC STORY STRUCTURE REQUIREMENTS =====
   * Every story MUST have: SETUP, GOAL, OBSTACLE, RISING ACTION, CLIMAX, RESOLUTION
   */
  getAudienceStoryStructure: (audience: string): string => {
    const structures: Record<string, string> = {
      children: `
STORY STRUCTURE FOR CHILDREN (8 panels, Ages 4-8):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Story Complexity: Simple, linear narrative with ONE clear problem and ONE clear solution

REQUIRED STORY BEATS:
• SETUP (panels 1-2): Establish character, setting, and initial situation
• GOAL INTRODUCTION (panel 2-3): What does the character want or need?
• OBSTACLE (panel 3-4): What prevents them from getting it?
• RISING ACTION (panels 4-6): Character attempts to overcome obstacle
• CLIMAX (panel 7): Critical moment of confrontation or decision
• RESOLUTION (panel 8): Outcome and transformation

ACCEPTABLE GOAL TYPES (concrete, relatable):
✓ Find something lost (toy, pet, friend)
✓ Help someone in need (friend is sad, animal is stuck)
✓ Overcome a simple fear (dark, new place, trying something new)
✓ Make a new friend
✓ Learn a new skill

ACCEPTABLE OBSTACLE TYPES (age-appropriate, NOT scary):
✓ Physical barrier (too high, too far, can't reach)
✓ Social challenge (shyness, misunderstanding)
✓ Lack of knowledge (doesn't know how)
✓ Weather or nature (rain stops play, path is blocked)

RESOLUTION REQUIREMENTS:
✓ Character MUST take action (not passive)
✓ Clear cause-and-effect (because X did Y, Z happened)
✓ Explicit lesson stated simply ("Maya learned that...")
✓ Emotionally satisfying (happy, hopeful, or peaceful ending)

FORBIDDEN FOR CHILDREN:
✗ Unresolved conflicts
✗ Ambiguous endings
✗ Abstract philosophical conclusions
✗ Scary obstacles (monsters, death, violence, abandonment)
✗ Complex moral dilemmas
✗ Endings like "The magic would always be there" (too abstract)
✗ Endings like "In that moment, everything changed" (too vague)`,

      'young adults': `
STORY STRUCTURE FOR YOUNG ADULTS (15 panels, Ages 12-17):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Story Complexity: Multi-layered narrative with internal AND external conflicts

REQUIRED STORY BEATS:
• SETUP (panels 1-3): Establish world, relationships, and status quo
• GOAL INTRODUCTION (panels 2-4): Internal or external desire revealed
• FIRST OBSTACLE (panels 4-6): Initial challenge or complication
• RISING ACTION (panels 6-10): Escalating stakes, multiple attempts
• MIDPOINT SHIFT (panels 7-9): New information changes everything
• DARK MOMENT (panels 10-12): All seems lost, internal conflict peaks
• CLIMAX (panels 12-14): Character makes defining choice
• RESOLUTION (panel 15): Consequences shown, transformation evident

ACCEPTABLE GOAL TYPES (identity and relationship focused):
✓ Prove oneself / earn respect
✓ Navigate social dynamics (fitting in vs. being authentic)
✓ Protect or stand up for someone
✓ Discover truth about self or situation
✓ Overcome self-doubt to achieve something meaningful

ACCEPTABLE OBSTACLE TYPES (emotionally complex):
✓ Internal conflict (fear vs. desire, loyalty vs. truth)
✓ Social pressure (peer expectations, authority figures)
✓ Moral gray areas (no clear right answer)
✓ Consequences of past choices
✓ Competing loyalties

RESOLUTION REQUIREMENTS:
✓ Character demonstrates growth or change
✓ Actions have meaningful consequences
✓ May include bittersweet elements
✓ Theme emerges through story (not stated explicitly)
✓ Respects reader intelligence - show don't tell

THEMES TO EMBRACE:
• Identity formation
• First experiences (responsibility, independence, failure)
• Questioning authority/rules
• Loyalty and betrayal
• Finding your voice

FORBIDDEN FOR YOUNG ADULTS:
✗ Preachy moral lessons
✗ Adult lecturing tone
✗ Childish simplification
✗ Cynicism without hope
✗ Neat moral statements in resolution`,

      adults: `
STORY STRUCTURE FOR ADULTS (24 panels, Ages 18+):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Story Complexity: Sophisticated narrative with subtext, moral ambiguity, nuanced psychology

REQUIRED STORY BEATS:
• OPENING IMAGE (panel 1): Visual thesis statement
• SETUP (panels 1-4): World, character psychology, hidden tensions
• INCITING INCIDENT (panels 3-5): Event that disrupts equilibrium
• FIRST ACT TURN (panels 5-7): Point of no return
• RISING COMPLICATIONS (panels 7-14): Layered obstacles, relationships tested
• MIDPOINT REVELATION (panels 11-13): Truth changes perspective
• ALL IS LOST (panels 16-18): Consequences of choices crystallize
• DARK NIGHT (panels 18-20): Internal reckoning
• CLIMAX (panels 20-22): Moment of truth, defining action
• RESOLUTION (panels 23-24): New equilibrium, thematic resonance

ACCEPTABLE GOAL TYPES (existential and consequential):
✓ Reconcile with past decisions
✓ Navigate complex relationships
✓ Face moral/ethical dilemmas with real stakes
✓ Find meaning or purpose
✓ Protect what matters while facing impossible choices

ACCEPTABLE OBSTACLE TYPES (psychologically complex):
✓ Internal demons (guilt, regret, addiction, trauma)
✓ Systemic forces (society, institutions, fate)
✓ Competing valid perspectives
✓ No-win situations requiring sacrifice
✓ Consequences of character's own flaws

RESOLUTION REQUIREMENTS:
✓ Earned emotional payoff (not easy answers)
✓ Character transformation through suffering or insight
✓ Thematic resonance without being preachy
✓ May be tragic, bittersweet, or triumphant
✓ Respects complexity - avoids neat resolutions if unrealistic

NARRATIVE TECHNIQUES TO USE:
• Subtext and implication
• Unreliable perspectives
• Parallel storylines
• Symbolic imagery
• Moral ambiguity embraced

FORBIDDEN FOR ADULTS:
✗ Spelling out themes explicitly
✗ Happy endings that feel unearned
✗ Simplistic moral conclusions
✗ Treating reader as needing guidance
✗ Neat tidy resolutions for complex situations`
    };
    
    return structures[audience] || structures.children;
  },

  genrePrompts: {
    adventure: {
      structure: `ACT 1 (Panels 1-3): Character's ordinary world, inciting incident, decision to act
ACT 2 (Panels 4-18): Rising challenges, inner strength discovered, moment of despair, crucial help arrives
ACT 3 (Panels 19-24): Climactic challenge using lessons learned, victory through courage + cleverness, return changed`,
      emotionalBeats: ['excitement', 'determination', 'fear', 'courage', 'triumph', 'pride'],
      visualElements: ['Dynamic action poses', 'Expansive locations', 'Close-ups during emotions', 'Dramatic lighting'],
      dialogueStyle: 'Short punchy exclamations in action. Reflective during calm. Character catchphrase early.',
      themes: 'Courage isn\'t absence of fear. True strength from within. Help others.'
    },
    
    siblings: {
      structure: `ACT 1 (Panels 1-4): Siblings arguing, each thinks they're right, forced together, resistance
ACT 2 (Panels 5-18): Challenge requires teamwork, each strength crucial, small victories build trust, vulnerable sharing, bonding
ACT 3 (Panels 19-24): United they solve problem, acknowledge each other's value, new dynamic, happy together`,
      emotionalBeats: ['frustration', 'annoyance', 'surprise', 'empathy', 'appreciation', 'love'],
      visualElements: ['Side-by-side comparisons', 'Growing physical proximity', 'Shared expressions', 'Warm settings', 'Unity metaphors'],
      dialogueStyle: 'Realistic sibling banter. Teasing with love. "I\'m sorry" moments. "I never knew..." realizations.',
      themes: 'Family worth fighting for. Differences make stronger. Love transcends competition.'
    },
    
    bedtime: {
      structure: `ACT 1 (Panels 1-3): Day to evening transition, preparing for rest, gentle concern, magical element
ACT 2 (Panels 4-20): Enter dreamlike space, wise guide, peaceful places, solve gentle puzzle, learn lesson, progressive calm
ACT 3 (Panels 21-24): Gentle resolution, return peaceful, settling to sleep, final: sleeping peacefully`,
      emotionalBeats: ['tiredness', 'gentle_curiosity', 'wonder', 'peace', 'contentment', 'sleepiness'],
      visualElements: ['Soft dreamy lighting', 'Pastel palettes', 'Flowing compositions', 'Minimal sharp angles', 'Stars/moons', 'Kind eyes'],
      dialogueStyle: 'Soft soothing words. Short simple sentences. Repetitive rhythmic. Whispered tones.',
      themes: 'Nighttime safe and magical. Rest important. Tomorrow wonderful. You are loved.'
    },
    
    fantasy: {
      structure: `ACT 1 (Panels 1-4): Discover magical element, "can't be real", mentor appears, rules established, stakes
ACT 2 (Panels 5-19): Enter fantastical world, magic has costs, meet allies/foes, learn power, misuse causes problems, wisdom over power
ACT 3 (Panels 20-24): Use magic wisely not just powerfully, balance restored, keep/return choice, growth shown, magic subtle part of life`,
      emotionalBeats: ['wonder', 'awe', 'confusion', 'power', 'humility', 'wisdom'],
      visualElements: ['Spectacular magical effects', 'Mundane vs magical contrast', 'Impossible architecture', 'Mythical creatures', 'Symbolic imagery'],
      dialogueStyle: 'Mix modern and archaic. Incantations. Wise pronouncements. "The old ways say..." Prophetic warnings.',
      themes: 'Power requires responsibility. Wisdom trumps strength. Magic is believing. True magic is compassion.'
    },
    
    history: {
      structure: `ACT 1 (Panels 1-4): Clear historical context, period-appropriate concerns, historical event enters, personal+historical stakes
ACT 2 (Panels 5-19): Navigate period authentically, real details woven naturally, period challenges, accuracy+emotional truth, "What would YOU do", consequences shown
ACT 3 (Panels 20-24): Event concludes, character changed, connection to present, "why this matters", legacy continues`,
      emotionalBeats: ['curiosity', 'challenge', 'perseverance', 'understanding', 'respect', 'inspiration'],
      visualElements: ['Period-accurate costumes/settings', 'Historical artifacts detailed', 'Then vs now comparisons', 'Maps/dates clear', 'Authentic architecture'],
      dialogueStyle: 'Period-appropriate but understandable. Historical figures authentic. Modern character asks modern questions. Educational not preachy.',
      themes: 'History made by real people. Past connects present. Learn from before. Every era had heroes.'
    },
    
    friendship: {
      structure: `ACT 1 (Panels 1-3): Characters meet or reconnect, initial connection or conflict, decide to spend time together
ACT 2 (Panels 4-9): Shared activity builds bond, misunderstanding or challenge tests friendship, moment of vulnerability and honesty
ACT 3 (Panels 10-12): Reconciliation through understanding, demonstrate loyalty through action, friendship stronger than before`,
      emotionalBeats: ['curiosity', 'connection', 'joy', 'hurt', 'understanding', 'love'],
      visualElements: ['Side-by-side moments', 'Shared laughter', 'Physical comfort gestures', 'Matching expressions', 'Warm lighting'],
      dialogueStyle: 'Natural conversation flow. Finishing each other\'s sentences. Inside jokes. Heartfelt apologies. "You\'re my best friend" moments.',
      themes: 'True friends accept differences. Friendship requires honesty. Together we are stronger. Friends forgive.'
    },
    
    courage: {
      structure: `ACT 1 (Panels 1-3): Character faces something scary, shows initial fear, someone believes in them
ACT 2 (Panels 4-9): First attempt fails, almost gives up, finds inner strength, tries again with new approach
ACT 3 (Panels 10-12): Faces fear directly, succeeds through bravery not strength, realizes they were brave all along`,
      emotionalBeats: ['fear', 'doubt', 'determination', 'struggle', 'bravery', 'pride'],
      visualElements: ['Small character vs big challenge', 'Trembling poses becoming steady', 'Light emerging from darkness', 'Triumphant final pose'],
      dialogueStyle: 'Internal doubts spoken aloud. Encouraging words from others. "I can do this" self-talk. Celebratory exclamations.',
      themes: 'Courage is feeling fear and acting anyway. Bravery comes in many forms. Believe in yourself. Fear can be overcome.'
    },
    
    nature: {
      structure: `ACT 1 (Panels 1-3): Character enters natural setting, discovers something wonderful, wants to explore more
ACT 2 (Panels 4-9): Learns about nature's wonders, faces weather or environmental challenge, animal or plant teaches lesson
ACT 3 (Panels 10-12): Helps nature in return, deeper appreciation gained, promises to protect and return`,
      emotionalBeats: ['wonder', 'curiosity', 'awe', 'challenge', 'understanding', 'gratitude'],
      visualElements: ['Lush natural environments', 'Detailed flora and fauna', 'Weather effects', 'Character small against vast nature', 'Golden hour lighting'],
      dialogueStyle: 'Exclamations of wonder. Questions about nature. Animal sounds represented. Quiet contemplative moments. "Thank you, nature" gratitude.',
      themes: 'Nature is precious and fragile. All living things connected. Respect the environment. Nature teaches patience.'
    },
    
    creativity: {
      structure: `ACT 1 (Panels 1-3): Character wants to create something, faces doubt or creative block, gets inspired
ACT 2 (Panels 4-9): Begins creating with enthusiasm, makes mistakes, learns that mistakes are part of the process
ACT 3 (Panels 10-12): Creates something unique and personal, shares with others, inspires someone else to create`,
      emotionalBeats: ['aspiration', 'frustration', 'inspiration', 'flow', 'satisfaction', 'joy'],
      visualElements: ['Art supplies and creative tools', 'Messy creative process', 'Colorful imagination sequences', 'Before/after of creation', 'Proud display of work'],
      dialogueStyle: 'Self-doubt becoming confidence. "What if I try..." experimentation. "I made this!" pride. Encouraging feedback from others.',
      themes: 'Everyone is creative. Mistakes lead to discovery. Art comes from the heart. Creating brings joy.'
    },
    
    sports: {
      structure: `ACT 1 (Panels 1-3): Character wants to play or compete, faces initial challenge or tryout, team dynamics introduced
ACT 2 (Panels 4-9): Training and practice, setback or loss, learns importance of teamwork and perseverance
ACT 3 (Panels 10-12): Big game or competition, uses lessons learned, wins through sportsmanship not just skill`,
      emotionalBeats: ['excitement', 'determination', 'frustration', 'teamwork', 'tension', 'triumph'],
      visualElements: ['Dynamic action poses', 'Team uniforms and equipment', 'Crowd reactions', 'Slow-motion key moments', 'Victory celebrations'],
      dialogueStyle: 'Coach encouragement. Teammate banter. "We can do this!" rallying. Sportsmanship to opponents. Celebratory cheers.',
      themes: 'Teamwork makes the dream work. Practice leads to improvement. Good sportsmanship matters. Never give up.'
    },
    
    mystery: {
      structure: `ACT 1 (Panels 1-3): Something strange or missing discovered, character decides to investigate, first clue found
ACT 2 (Panels 4-9): Follows clues, interviews suspects or witnesses, red herring misleads, breakthrough realization
ACT 3 (Panels 10-12): Confronts truth, reveals solution, mystery solved and order restored`,
      emotionalBeats: ['curiosity', 'suspicion', 'confusion', 'determination', 'surprise', 'satisfaction'],
      visualElements: ['Magnifying glass and detective poses', 'Clue close-ups', 'Shadowy mysterious scenes', 'Thought bubble connections', 'Reveal moment lighting'],
      dialogueStyle: 'Questions and hypotheses. "That\'s strange..." observations. "A-ha!" realizations. Explanation of solution. Grateful thanks from others.',
      themes: 'Curiosity solves problems. Pay attention to details. Truth always comes out. Everyone has a story.'
    },
    
    comedy: {
      structure: `ACT 1 (Panels 1-3): Funny situation established, character's quirk causes problem, comedic misunderstanding begins
ACT 2 (Panels 4-9): Attempts to fix make things worse, physical comedy ensues, escalating absurdity
ACT 3 (Panels 10-12): Unexpected solution, everyone laughs together, character embraces their quirks`,
      emotionalBeats: ['amusement', 'embarrassment', 'chaos', 'more_chaos', 'relief', 'joy'],
      visualElements: ['Exaggerated expressions', 'Physical comedy poses', 'Comedic timing panels', 'Reaction shots', 'Happy group laughter'],
      dialogueStyle: 'Witty one-liners. Funny misunderstandings. "Oops!" moments. Puns and wordplay. Contagious laughter dialogue.',
      themes: 'Laughter heals. Embrace your quirks. Everyone makes mistakes. Joy is contagious.'
    }
  },

  audienceRequirements: {
    children: {
      vocabulary: 'Grade 2-5 reading level. Simple adjectives. Explain complex words.',
      safetyRules: ['NO violence/weapons', 'NO scary monsters', 'NO death/injury', 'NO adult themes', 'Challenges exciting NOT terrifying', 'Clear positive solutions', 'Trustworthy authority figures'],
      panelCount: '8-12 panels',
      wordTarget: '800-1200 words'
    },
    'young adults': {
      vocabulary: 'Grade 6-9 reading level. Contemporary language. Literary devices ok.',
      maturityLevel: 'Can handle: conflict, failure, disappointment, complex relationships, moral ambiguity (with resolution)',
      panelCount: '15-18 panels',
      wordTarget: '1200-1600 words'
    },
    adults: {
      vocabulary: 'Full range. Literary language. Sophisticated metaphors.',
      maturityLevel: 'Complex psychology, moral complexity, realistic consequences, nuanced relationships, bittersweet endings ok',
      panelCount: '20-24 panels',
      wordTarget: '1600-2000 words'
    }
  },

  characterIntegration: (characterDescription: string) => `
CHARACTER: "${characterDescription}"
CRITICAL: Character MUST appear in 80%+ of panels. Consistent appearance, personality, voice.
CHARACTER ARC: Start → Challenge → Growth → Resolution
Show emotions through actions/expressions (visual medium).`,

  dialogueRequirements: (audience: string) => `
DIALOGUE: ${audience === 'children' ? '40-50%' : audience === 'young_adults' ? '50-60%' : '60-70%'} of panels have dialogue
Natural speech for age/time. Every line advances plot OR character. Distinct voices. Visual suggestions.
Include: character thoughts (italics), conversations, exclamations, questions, declarations.
AVOID: info dumps, stating the obvious, unrealistic formal speech.`,

  outputFormat: `
OUTPUT FORMAT:
TITLE: [3-6 word compelling title]

STORY:
[Write complete narrative prose. Structure paragraphs to suggest panel breaks:
- New paragraph = new panel
- Scene transitions = panel breaks  
- Action beats = panels
- Dialogue exchanges = panel breaks
- Emotional shifts = panels

Write VIVID VISUAL LANGUAGE. Every sentence suggests image. Active voice. Show emotions through actions.
Include dialogue naturally with quotation marks.]

END OF STORY`
};

// Import all our modular components - FIXED: Corrected import paths
import {
  AIServiceConfig,
  AudienceType as ModularAudienceType,
  QualityMetrics,
  ServiceRegistration,
  ComprehensiveMetrics,
  AI_SERVICE_ENTERPRISE_CONSTANTS,
  AI_SERVICE_VERSION_INFO,
  PROFESSIONAL_AUDIENCE_CONFIG,
  STORYTELLING_ARCHETYPES,
  DEFAULT_RETRY_CONFIG
} from './modular/constants-and-types.js';

// GEMINI MIGRATION: Switched from OpenAI to Gemini for 95% character consistency
// import { OpenAIIntegration, STYLE_SPECIFIC_PANEL_CALIBRATION } from './modular/openai-integration.js';
import { GeminiIntegration } from './modular/gemini-integration.js';
import { ClaudeIntegration } from './modular/claude-integration.js';
import { STYLE_SPECIFIC_PANEL_CALIBRATION } from './modular/openai-integration.js';
import { ComicGenerationEngine } from './modular/comic-generation-engine.js';
import { NarrativeIntelligenceEngine } from './modular/narrative-intelligence.js';
import { VisualDNASystem } from './modular/visual-dna-system.js';
import { QualityMetricsEngine } from './modular/quality-metrics-engine.js';
import { PatternLearningEngine } from './modular/pattern-learning-engine.js';
import { EnterpriseMonitoring } from './modular/enterprise-monitoring.js';

/**
 * ===== ERROR HANDLER ADAPTER =====
 * Simple adapter that bridges inherited error handling with modular component expectations
 * This eliminates the need to modify any modular files
 */
class ErrorHandlerAdapter {
  constructor(private aiService: AIService) {}

  /**
   * Add missing log method for ErrorHandlerAdapter
   */
  log(level: string, ...args: any[]) {
    console.log(`[ErrorHandler-${level.toUpperCase()}]`, ...args);
  }

  /**
   * Main method that modular components use for error handling
   */
  validateAndSanitizeError(error: any): Error {
    // Convert any error to a standard Error object
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  }

  /**
   * Handle error method for compatibility
   */
  handleError(error: any, operationName: string, context?: any): Error {
    const standardError = this.validateAndSanitizeError(error);
    
    // Log the error using the AI service's logging
    this.log('error', `${operationName} failed:`, standardError.message);
    
    return standardError;
  }

  /**
   * Additional methods that some modular components might expect
   */
  classifyError(error: any): any {
    return {
      category: 'system',
      severity: 'medium',
      isRetryable: true
    };
  }

  isRetryableError(error: any): boolean {
    return true; // Default to retryable for compatibility
  }
}

/**
 * ===== MAIN AI SERVICE CLASS - MODULAR ORCHESTRATOR =====
 * Revolutionary enterprise-grade AI service with complete modular architecture
 */
class AIService extends ErrorAwareBaseService implements IAIService {
  // ===== CORE PROPERTIES =====
  private apiKey: string | null = null;
  private startTime: number = Date.now();
  private _isInitialized: boolean = false;

  isInitialized(): boolean {
    return this._isInitialized;
  }

  // ===== MODULAR ENGINES =====
  // FIXED: Using error handler adapter instead of ErrorHandlingSystem
  private errorHandlerAdapter: ErrorHandlerAdapter;

  // GEMINI MIGRATION: Changed to Gemini for image-based generation
  private geminiIntegration!: GeminiIntegration;
  private claudeIntegration!: ClaudeIntegration;
  private comicEngine!: ComicGenerationEngine;
  private narrativeEngine!: NarrativeIntelligenceEngine;
  private visualDNASystem!: VisualDNASystem;
  private qualityEngine!: QualityMetricsEngine;
  private learningEngine!: PatternLearningEngine;
  private enterpriseMonitoring!: EnterpriseMonitoring;

  // ===== SERVICE CONFIGURATION =====
  private readonly defaultModel: string = 'gpt-4o';
  private readonly defaultImageModel: string = 'dall-e-3';

  constructor(config?: Partial<AIServiceConfig>) {
    // FIXED: Use ErrorCategory from error-types.ts and only use valid enum values
    super({
      name: 'ModularEnterpriseAIService',
      timeout: config?.timeout || 120000,
      retryAttempts: config?.maxRetries || 1,
      retryDelay: config?.retryDelay || 1000,
      circuitBreakerThreshold: 5,
      errorHandling: {
        enableRetry: true,
        maxRetries: 1,
        enableCircuitBreaker: true,
        enableCorrelation: true,
        enableMetrics: true,
        // FIXED: Use only ErrorCategory values that exist in error-types.ts
        retryableCategories: [
          ErrorCategory.NETWORK,
          ErrorCategory.TIMEOUT,
          ErrorCategory.EXTERNAL_SERVICE
        ]
      },
      ...config
    });

    // Initialize the error handler adapter
    this.errorHandlerAdapter = new ErrorHandlerAdapter(this);

    this.log('info', '🚀 Initializing Revolutionary Modular AI Service...');
    this.log('info', `📊 Version: ${AI_SERVICE_VERSION_INFO.version} (${AI_SERVICE_VERSION_INFO.codename})`);
    this.log('info', `🎯 Features: ${AI_SERVICE_ENTERPRISE_CONSTANTS.FEATURES.length} advanced capabilities`);
  }

  // ===== INITIALIZATION =====

  /**
   * Initialize all modular components in proper dependency order
   */
  protected async initializeService(): Promise<void> {
    this.log('info', '🔧 Starting modular service initialization...');

    // Step 1: Get API key from environment
    this.apiKey = process.env.OPENAI_API_KEY || null;
    
    if (!this.apiKey) {
      throw new AIServiceUnavailableError('OpenAI API key not configured - set OPENAI_API_KEY environment variable');
    }

    if (this.apiKey.length < 20) {
      throw new AIAuthenticationError('OpenAI API key appears to be invalid (too short)');
    }

    // Step 2: Initialize core systems (order matters for dependencies)
    await this.initializeModularSystems();

    // Step 3: Validate all systems are ready
    await this.validateSystemReadiness();

    // Step 4: Start enterprise monitoring
    this.startEnterpriseMonitoring();

    this._isInitialized = true;
    this.log('info', '✅ Revolutionary Modular AI Service fully initialized and operational');
  }

  /**
   * Initialize all modular systems in proper dependency order
   * FIXED: Uses error handler adapter - no changes needed to modular files
   */
  private async initializeModularSystems(): Promise<void> {
    this.log('info', '🏗️ Initializing modular systems...');

    try {
      // 1. Enterprise Monitoring (using adapter)
      this.enterpriseMonitoring = new EnterpriseMonitoring(this.errorHandlerAdapter as any);
      this.log('info', '✅ Enterprise Monitoring System initialized');

      // 2. GEMINI Integration (using adapter) - Initialize with error handler adapter
      const geminiApiKey = process.env.GOOGLE_API_KEY || this.apiKey;
      this.geminiIntegration = new GeminiIntegration(geminiApiKey!, this.errorHandlerAdapter as any);
      this.log('info', '✅ Gemini Integration initialized (95% character consistency mode)');

      // 2.5. CLAUDE Integration - Initialize for environmental DNA analysis
      this.claudeIntegration = new ClaudeIntegration();
      this.log('info', '✅ Claude Integration initialized for environmental analysis');

      // 3. Visual DNA System (using adapter) - NOW USES GEMINI
      this.visualDNASystem = new VisualDNASystem(this.geminiIntegration, this.errorHandlerAdapter as any);
      this.log('info', '✅ Visual DNA System initialized with Gemini image-based generation');

      // 4. Narrative Intelligence Engine (still needs text completion)
      // Note: NarrativeIntelligenceEngine might still use OpenAI for text-only tasks
      // For now, we'll pass Gemini which also has text completion
      this.narrativeEngine = new NarrativeIntelligenceEngine(this.geminiIntegration as any, this.errorHandlerAdapter as any);
      this.log('info', '✅ Narrative Intelligence Engine initialized');

      // 5. Quality Metrics Engine (still needs text completion)
      this.qualityEngine = new QualityMetricsEngine(this.geminiIntegration as any, this.errorHandlerAdapter as any);
      this.log('info', '✅ Quality Metrics Engine initialized');

      // 6. Pattern Learning Engine (using database service from container)
      const { serviceContainer } = await import('../container/service-container.js');
      const { SERVICE_TOKENS } = await import('../interfaces/service-contracts.js');
      const databaseService = await serviceContainer.resolve<IDatabaseService>(SERVICE_TOKENS.DATABASE);
      this.learningEngine = new PatternLearningEngine(databaseService);
      this.log('info', '✅ Pattern Learning Engine initialized');

      // Note: Gemini doesn't need learning engine integration like OpenAI did

      // 7. Comic Generation Engine (using adapter) - NOW USES GEMINI
      // 7. Comic Generation Engine (using adapter) - USES GEMINI FOR IMAGES, CLAUDE FOR NARRATION
this.comicEngine = new ComicGenerationEngine(
  this.geminiIntegration, 
  this.errorHandlerAdapter as any,
  this.claudeIntegration
);
this.log('info', '✅ Comic Generation Engine initialized with Gemini image-based panels + Claude narration');

      this.log('info', '🎯 All modular systems initialized successfully');

    } catch (error) {
      this.log('error', 'Failed to initialize modular systems:', error);
      throw error;
    }
  }

  /**
   * Validate all systems are ready for production use
   */
  private async validateSystemReadiness(): Promise<void> {
    const result = await this.withErrorHandling(
      async () => {
        this.log('info', '🔍 Validating system readiness...');

        const validations = [
          { name: 'API Key', check: () => !!this.apiKey },
          { name: 'Error Handler Adapter', check: () => !!this.errorHandlerAdapter },
          { name: 'Gemini Integration', check: () => !!this.geminiIntegration },
          { name: 'Comic Engine', check: () => !!this.comicEngine },
          { name: 'Narrative Engine', check: () => !!this.narrativeEngine },
          { name: 'Visual DNA System', check: () => !!this.visualDNASystem },
          { name: 'Quality Engine', check: () => !!this.qualityEngine },
          { name: 'Learning Engine', check: () => !!this.learningEngine },
          { name: 'Enterprise Monitoring', check: () => !!this.enterpriseMonitoring },
          { name: 'Storytelling Archetypes', check: () => Object.keys(STORYTELLING_ARCHETYPES).length > 0 },
          { name: 'Professional Config', check: () => Object.keys(PROFESSIONAL_AUDIENCE_CONFIG).length === 3 }
        ];

        const failedValidations = validations.filter(v => !v.check());
        
        if (failedValidations.length > 0) {
          const failedNames = failedValidations.map(v => v.name).join(', ');
          throw new AIServiceUnavailableError(
            `System readiness validation failed: ${failedNames}`,
            { service: this.getName(), operation: 'validateSystemReadiness' }
          );
        }

        // Additional enterprise monitoring validation
        const isMonitoringReady = await this.enterpriseMonitoring.validateServiceReadiness();
        if (!isMonitoringReady) {
          throw new AIServiceUnavailableError('Enterprise monitoring system failed readiness validation');
        }

        this.log('info', '✅ All systems passed readiness validation');
        return true;
      },
      'validateSystemReadiness'
    );

    if (!result.success) {
      throw result.error;
    }
  }

  /**
   * Start enterprise monitoring and health checks
   */
  private startEnterpriseMonitoring(): void {
    this.log('info', '📊 Starting enterprise monitoring...');

    // Register this service with the monitoring system
    this.enterpriseMonitoring.registerService({
      name: `ai-service-${Date.now()}`,
      version: AI_SERVICE_VERSION_INFO.version,
      capabilities: [
        'story_analysis_with_narrative_intelligence',
        'character_dna_with_visual_fingerprinting',
        'environmental_dna_world_building',
        'professional_comic_generation',
        'advanced_speech_bubble_intelligence',
        'self_learning_pattern_evolution',
        'multi_audience_support',
        'quality_assessment_with_grading',
        'intelligent_error_recovery',
        'circuit_breaker_protection',
        'performance_monitoring',
        'enterprise_health_checking'
      ],
      healthEndpoint: '/health',
      metricsEndpoint: '/metrics',
      lastHeartbeat: new Date().toISOString(),
      status: 'active'
    });

    this.log('info', '✅ Enterprise monitoring started');
  }

  // ===== MISSING INTERFACE METHODS - FIXED: Add delegation to modular engines =====

  /**
   * FIXED: Add missing createMasterCharacterDNA method that delegates to visualDNASystem
   * Preserves all functionality by delegating to existing modular engine
   */
 /**
 * Create master character DNA - DELEGATES to VisualDNASystem
 * This is the correct entry point that job processor calls
 * ENHANCED: Added character identity parameter for multi-character support
 */
async createMasterCharacterDNA(
  imageUrl: string, 
  artStyle: string, 
  existingDescription?: string,
  characterIdentity?: {
    name?: string;
    age?: string;
    gender?: string;
  }
): Promise<CharacterDNA> {
  const result = await this.withErrorHandling(
    async () => {
      this.log('info', '🧬 Creating Character DNA (delegating to VisualDNASystem)...');
      if (characterIdentity?.name) {
        this.log('info', `👤 Character Identity: ${characterIdentity.name}`);
      }
      
      // FIXED: Delegate to the correct modular engine with character identity
      const characterDNA = await this.visualDNASystem.createMasterCharacterDNA(
        imageUrl, 
        artStyle,
        existingDescription,
        characterIdentity  // NEW: Pass character identity for multi-character support
      );
      
      this.log('info', '✅ Character DNA created successfully');
      return characterDNA;
    },
    'createMasterCharacterDNA'
  );

  if (result.success) {
    return result.data;
  } else {
    throw result.error;
  }
}

  /**
   * FIXED: Add missing analyzePanelContinuity method that provides panel flow analysis
   * Simple implementation that analyzes story beat transitions
   */
  async analyzePanelContinuity(storyBeats: any[]): Promise<any> {
    const result = await this.withErrorHandling(
      async () => {
        this.log('info', '🔄 Analyzing panel continuity...');
        
        const continuityAnalysis = {
          totalPanels: storyBeats.length,
          flowAnalysis: storyBeats.map((beat, index) => ({
            panelNumber: index + 1,
            transitionType: index === 0 ? 'opening' : index === storyBeats.length - 1 ? 'closing' : 'progression',
            visualFlow: beat.visualPriority || 'character',
            emotionalProgression: beat.emotion || 'neutral'
          })),
          continuityScore: 85, // Default good continuity score
          recommendations: ['maintain_character_consistency', 'smooth_scene_transitions']
        };

        return continuityAnalysis;
      },
      'analyzePanelContinuity'
    );

    if (result.success) {
      return result.data;
    } else {
      throw result.error;
    }
  }

  /**
   * Create environmental DNA using Claude API (NO FALLBACK - fail-fast quality standard)
   * If Claude fails, the entire job must crash immediately.
   */
  async createEnvironmentalDNA(story: string, storyBeatsOrAnalysis: StoryBeat[] | any, audience: AudienceType, artStyle: string): Promise<EnvironmentalDNA> {
    const result = await this.withErrorHandling(
      async () => {
        this.log('info', '🌍 Creating environmental DNA using Claude API (NO FALLBACK)...');
        
        // Validate story
        if (!story || story.length < 50) {
          this.log('error', '❌ Story too short for environmental analysis');
          throw new Error('CRITICAL: Story must be at least 50 characters. Quality requirement not met. Job must fail.');
        }

        // Claude API ONLY - no fallback
        this.log('info', '🔵 Calling Claude API for environmental analysis...');
        
        const environmentalDNA = await this.claudeIntegration.analyzeStoryEnvironment(story, audience);
        
        this.log('info', '✅ Environmental DNA created via Claude API');
        this.log('info', `   📍 Primary Location: ${environmentalDNA.primaryLocation.name}`);
        this.log('info', `   ⏰ Time of Day: ${environmentalDNA.lightingContext.timeOfDay}`);
        this.log('info', `   🎨 Key Features: ${environmentalDNA.primaryLocation.keyFeatures.slice(0, 3).join(', ')}...`);
        
        return environmentalDNA;
      },
      'createEnvironmentalDNA'
    );

    if (result.success) {
      return result.data;
    } else {
      // If Claude fails, the job MUST fail - no fallback
      this.log('error', '❌ Claude API failed - job must fail immediately');
      throw result.error;
    }
  }

  // ===== UTILITY METHODS (KEPT - used elsewhere) =====
  
  private determineLightingMood(timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night', audience: AudienceType): string {
    const moodMap: Record<string, Record<string, string>> = {
      morning: {
        children: 'fresh and energetic',
        'young adults': 'vibrant and hopeful',
        adults: 'crisp and clear'
      },
      afternoon: {
        children: 'bright and cheerful',
        'young adults': 'warm and dynamic',
        adults: 'natural and balanced'
      },
      evening: {
        children: 'warm and cozy',
        'young adults': 'dramatic and intense',
        adults: 'sophisticated and moody'
      },
      night: {
        children: 'mysterious yet inviting',
        'young adults': 'atmospheric and engaging',
        adults: 'nuanced and sophisticated'
      }
    };
    
    return moodMap[timeOfDay]?.[audience] || 'bright and cheerful';
  }
  
  private determineAccentColors(dominantColors: string[]): string[] {
    return ['warm_highlights', 'cool_shadows'];
  }

  // ===== UTILITY METHODS FOR NEW INTERFACE METHODS =====

  private determineColorPalette(audience: AudienceType): string[] {
    const palettes = {
      children: ['bright_blue', 'sunny_yellow', 'grass_green'],
      'young adults': ['deep_blue', 'warm_orange', 'forest_green'],
      adults: ['navy_blue', 'burnt_orange', 'olive_green']
    };
    return palettes[audience] || palettes.children;
  }

  private determineEnvironmentalMood(audience: AudienceType): string {
    const moods = {
      children: 'playful_inviting',
      'young adults': 'adventurous_exciting',
      adults: 'sophisticated_immersive'
    };
    return moods[audience] || 'playful_inviting';
  }

  /**
   * Build multi-character profiles for story generation
   * NEW: Supports up to 4 characters with main + secondary characters
   */
  private buildMultiCharacterProfiles(characterDescription: string, characters?: any[]): string {
    // If no multi-character data, fall back to legacy single character integration
    if (!characters || characters.length === 0) {
      return WORLD_CLASS_STORY_PROMPTS.characterIntegration(characterDescription);
    }

    const mainCharacter = characters.find(c => c.role === 'main');
    const secondaryCharacters = characters.filter(c => c.role === 'secondary');

    // Build age description mapping
    const getAgeDescription = (age: string): string => {
      const ageMap: Record<string, string> = {
        'toddler': 'toddler (1-3 years old, very small, chubby cheeks)',
        'child': 'child (4-10 years old, small stature)',
        'teen': 'teenager (11-17 years old, growing, youthful)',
        'young-adult': 'young adult (18-25 years old)',
        'adult': 'adult (26-55 years old)',
        'senior': 'senior (55+ years old, may have gray hair, wrinkles)'
      };
      return ageMap[age] || age || 'child';
    };

    let profiles = '';

    // Main character profile
    if (mainCharacter) {
      profiles += `
=== MAIN CHARACTER (appears in 80%+ of panels, MUST match cartoonized image exactly) ===
- Name: ${mainCharacter.name || 'Main Character'}
- Age: ${getAgeDescription(mainCharacter.age)}
- Gender: ${mainCharacter.gender || 'child'}
${characterDescription ? `- Visual Description: ${characterDescription}` : ''}
CRITICAL: Use ONLY this name "${mainCharacter.name}" for the main character. Do NOT invent other names.
`;
    } else {
      // Fallback if no main character defined
      profiles += WORLD_CLASS_STORY_PROMPTS.characterIntegration(characterDescription);
    }

    // Secondary characters profiles
    if (secondaryCharacters.length > 0) {
      profiles += `

=== SECONDARY CHARACTERS (described but not cartoonized - AI will render based on description) ===
`;
      secondaryCharacters.forEach((char, i) => {
        profiles += `
Character ${i + 2}: ${char.name || `Character ${i + 2}`}
- Age: ${getAgeDescription(char.age)}
- Gender: ${char.gender || 'child'}
- Relationship to ${mainCharacter?.name || 'main character'}: ${char.relationship || 'companion'}
- Hair: ${char.hairColor || 'not specified'}
- Eyes: ${char.eyeColor || 'not specified'}
- Visual Style: Must be CONSISTENT across all panels - same height relative to ${mainCharacter?.name || 'main character'}, same facial features, same clothing throughout
`;
      });
    }

    // Add critical character rules
    profiles += `

=== CRITICAL CHARACTER RULES ===
1. Use ONLY the character names provided above - do NOT invent new named characters
2. ${mainCharacter?.name || 'The main character'} is the MAIN character and should appear in most scenes
3. Secondary characters must be described CONSISTENTLY every time they appear:
   - Same physical features (height, hair, eyes) in every panel
   - Same clothing throughout the story (unless story specifically involves costume change)
   - Age-appropriate proportions maintained
4. When characters interact, clearly describe their relative sizes based on ages
5. Generic background characters (shopkeepers, passersby) should NOT have names
6. Every scene should make clear which named characters are present
`;

    return profiles;
  }

  // ===== MAIN SERVICE INTERFACE IMPLEMENTATION =====

  /**
   * Generate complete storybook with professional quality (MAIN METHOD - FROM BOTH FILES)
   * FIXED: Return proper AsyncResult type and handle Result conversion
   */
  async generateStorybook(
    title: string,
    story: string,
    characterDescription: string,
    audience: AudienceType,
    artStyle: string,
    characterImageUrl?: string
  ): Promise<AsyncResult<any, AIServiceUnavailableError>> {
    const startTime = Date.now();
    
    // FIXED: Convert Result to AsyncResult with proper error type conversion
    const resultPromise = this.withErrorHandling(
      async () => {
        this.log('info', `🎨 Starting professional storybook generation: "${title}"`);
        this.log('info', `📊 Audience: ${audience}, Art Style: ${artStyle}`);

        // Enhanced input validation for quality assurance
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
          throw new AIServiceUnavailableError('Invalid title: Title is required for professional comic generation', 
            { service: 'AIService', operation: 'generateStorybook' });
        }

        if (!story || typeof story !== 'string' || story.trim().length < 50) {
          throw new AIServiceUnavailableError('Invalid story: Story must be at least 50 characters long for quality comic generation',
            { service: 'AIService', operation: 'generateStorybook' });
        }

        if (!audience || !['children', 'young adults', 'adults'].includes(audience)) {
          throw new AIServiceUnavailableError('Invalid audience: Valid audience selection required for professional comic generation',
            { service: 'AIService', operation: 'generateStorybook' });
        }

        if (!artStyle || typeof artStyle !== 'string' || artStyle.trim().length === 0) {
          throw new AIServiceUnavailableError('Invalid art style: Art style selection required for professional comic generation',
            { service: 'AIService', operation: 'generateStorybook' });
        }

        if (characterImageUrl && (typeof characterImageUrl !== 'string' || !characterImageUrl.startsWith('http'))) {
          throw new AIServiceUnavailableError('Invalid character image URL: Valid image URL required for character consistency',
            { service: 'AIService', operation: 'generateStorybook' });
        }

        // Step 1: Create character DNA if image provided (FROM BOTH FILES)
        let characterDNA: CharacterDNA | undefined = undefined;
        if (characterImageUrl) {
          this.log('info', '🧬 Creating character DNA with visual fingerprinting...');
          characterDNA = await this.visualDNASystem.createMasterCharacterDNA(characterImageUrl, artStyle) || undefined;
          this.log('info', '✅ Character DNA created with visual consistency markers');
        }

        // Step 2: Generate professional comic with all advanced features (FROM BOTH FILES)
        this.log('info', '🎭 Generating professional comic with narrative intelligence...');
        
        const sceneOptions: SceneGenerationOptions = {
          story,
          audience: audience as ModularAudienceType,
          characterImage: characterImageUrl,
          characterArtStyle: artStyle,
          layoutType: 'comic-book-panels'
        };

        const comicResult = await this.comicEngine.generateScenesWithAudience(sceneOptions);
        
        this.log('info', `✅ Generated ${comicResult.pages.length} pages with ${comicResult.metadata.storyBeats} panels`);

        // Step 3: Assess quality with professional grading (FROM BOTH FILES)
        this.log('info', '📊 Calculating professional quality metrics...');
        
        const allPanels = comicResult.pages.flatMap((page: any) => page.scenes);
        const qualityMetrics = await this.qualityEngine.calculateAdvancedQualityMetrics(
          allPanels,
          {
            characterDNA,
            targetAudience: audience as ModularAudienceType,
            artStyle
          }
        );

        this.log('info', `✅ Quality assessment: ${qualityMetrics.overallScore}/100 (Grade: ${qualityMetrics.professionalGrade})`);

        // Step 4: Store successful patterns for learning (FROM BOTH FILES)
        if (qualityMetrics.overallScore >= 80) {
          this.log('info', '🧠 Storing successful patterns for continuous improvement...');
          
          await this.learningEngine.storeSuccessfulPattern(
            { audience, artStyle, story, characterDNA, title },
            comicResult,
            {
              characterConsistency: qualityMetrics.characterConsistency,
              narrativeCoherence: qualityMetrics.narrativeCoherence,
              visualQuality: qualityMetrics.visualQuality,
              overallScore: qualityMetrics.overallScore
            }
          );
          
          this.log('info', '✅ Successful patterns stored for future learning');
        }

        // Step 5: Record metrics and performance data
        const duration = Date.now() - startTime;
        this.enterpriseMonitoring.recordOperationMetrics('generateStorybook', duration, true);
        this.enterpriseMonitoring.recordQualityMetrics(qualityMetrics.overallScore);

        // Step 6: Format professional response (FROM BOTH FILES)
        const result = {
          title,
          story,
          audience,
          artStyle,
          pages: comicResult.pages,
          characterDNA,
          qualityMetrics,
          metadata: {
            ...comicResult.metadata,
            generationTime: duration,
            version: AI_SERVICE_VERSION_INFO.version,
            qualityGrade: qualityMetrics.professionalGrade,
            professionalStandards: true,
            advancedFeaturesUsed: [
              'narrative_intelligence',
              'visual_dna_fingerprinting',
              'quality_assessment',
              'pattern_learning'
            ].filter(Boolean)
          }
        };

        this.log('info', `🎉 Storybook generation completed successfully in ${duration}ms`);
        this.log('info', `🏆 Professional Grade: ${qualityMetrics.professionalGrade} (${qualityMetrics.overallScore}/100)`);

        return result;
      },
      'generateStorybook',
      {
        title,
        audience,
        artStyle,
        storyLength: story?.length || 0,
        hasCharacterImage: !!characterImageUrl
      }
   );

    // FIXED: Convert Result to AsyncResult and handle error type conversion
    return new AsyncResult(resultPromise.then(result => {
      if (result.success) {
        return Result.success(result.data);
      } else {
        const duration = Date.now() - startTime;
        this.enterpriseMonitoring.recordOperationMetrics('generateStorybook', duration, false);
        // Convert ServiceError to AIServiceUnavailableError
        const aiError = new AIServiceUnavailableError(result.error.message, {
          service: this.getName(),
          operation: 'generateStorybook'
        });
        return Result.failure(aiError);
      }
    }));
  }
/**
   * Generate comic scenes with audience optimization (FROM BOTH FILES)
   * FIXED: Return proper AsyncResult type and handle Result conversion
   */
  async generateScenesWithAudience(options: SceneGenerationOptions): Promise<AsyncResult<SceneGenerationResult, AIServiceUnavailableError>> {
    const startTime = Date.now();
    
    // FIXED: Convert Result to AsyncResult with proper error type conversion
    const resultPromise = this.withErrorHandling(
      async () => {
        this.log('info', '🎨 Generating scenes with audience optimization...');
        
        const result = await this.comicEngine.generateScenesWithAudience(options);
        
        const duration = Date.now() - startTime;
        this.enterpriseMonitoring.recordOperationMetrics('generateScenesWithAudience', duration, true);
        
        return result;
      },
      'generateScenesWithAudience',
      options
    );

    // FIXED: Convert Result to AsyncResult and handle error type conversion
    return new AsyncResult(resultPromise.then(result => {
      if (result.success) {
        return Result.success(result.data);
      } else {
        const duration = Date.now() - startTime;
        this.enterpriseMonitoring.recordOperationMetrics('generateScenesWithAudience', duration, false);
        // Convert ServiceError to AIServiceUnavailableError
        const aiError = new AIServiceUnavailableError(result.error.message, {
          service: this.getName(),
          operation: 'generateScenesWithAudience'
        });
        return Result.failure(aiError);
      }
    }));
  }

  /**
   * Generate images with advanced options (FROM BOTH FILES)
   * ENHANCED: World-class prompt architecture with all professional elements
   */
  async generateImages(options: ImageGenerationOptions): Promise<AsyncResult<ImageGenerationResult, AIServiceUnavailableError>> {
    const startTime = Date.now();
    
    const resultPromise = this.withErrorHandling(
      async () => {
        this.log('info', '🖼️ Generating images with WORLD-CLASS prompt architecture...');
        
        // Extract DNA elements from environmentalContext
        const characterDNA = options.environmentalContext?.characterDNA;
        // ✅ FIXED: Direct extraction - environmentalContext contains the DNA objects directly
        // Previous code had flawed fallback logic that caused environmentalDNA to be null
        const environmentalDNA = options.environmentalContext?.environmentalDNA as EnvironmentalDNA | null;
        const panelNumber = options.environmentalContext?.panelNumber || 1;
        const totalPanels = options.environmentalContext?.totalPanels || 1;
        
        // Debug logging for environmental DNA propagation
        if (environmentalDNA) {
          this.log('info', `🌍 Environmental DNA received: timeOfDay=${environmentalDNA.lightingContext?.timeOfDay}, location=${environmentalDNA.primaryLocation?.name?.substring(0, 30)}...`);
        } else {
          this.log('warn', `⚠️ No environmental DNA in context - panels may have inconsistent environments`);
        }
        
        // Panel type specifications (from original files)
        const panelSpecs: Record<string, string> = {
          'standard': 'Standard comic panel with balanced composition',
          'wide': 'Wide panoramic panel showing full environmental context',
          'tall': 'Tall dramatic panel emphasizing vertical action and emotion',
          'splash': 'Large splash panel for maximum visual impact',
          'closeup': 'Intimate close-up panel revealing character emotion',
          'establishing': 'Establishing shot panel setting the scene and atmosphere'
        };
        
        const panelType = options.panelType || 'standard';
        const panelSpec = panelSpecs[panelType] || panelSpecs.standard;
        
        // Build WORLD-CLASS prompt with all elements
        let worldClassPrompt = '';
        
        // 1. CHARACTER DNA ENFORCEMENT (FIRST - highest priority for DALL-E)
        if (characterDNA && characterDNA.description) {
          worldClassPrompt += `CHARACTER (MATCH EXACTLY):
${characterDNA.description}
${characterDNA.visualFingerprint ? `Fingerprint: ${characterDNA.visualFingerprint}` : ''}
${characterDNA.consistencyChecklist ? 'Must maintain: ' + characterDNA.consistencyChecklist.slice(0, 5).join(', ') : ''}

`;
        } else if (options.character_description) {
          worldClassPrompt += `CHARACTER: ${options.character_description}\n\n`;
        }
        
        // 2. SCENE ACTION
        worldClassPrompt += `SCENE: ${options.image_prompt}\n\n`;
        
        // 3. PANEL TYPE & COMPOSITION
        worldClassPrompt += `PANEL: ${panelSpec}\n`;
        
        // 4. ENVIRONMENTAL CONSISTENCY
        if (environmentalDNA && 'primaryLocation' in environmentalDNA && environmentalDNA.primaryLocation) {
          worldClassPrompt += `
ENVIRONMENT: ${environmentalDNA.primaryLocation.name}, ${environmentalDNA.lightingContext?.timeOfDay || 'afternoon'} ${environmentalDNA.lightingContext?.lightingMood || 'bright'} lighting
Elements: ${environmentalDNA.primaryLocation.keyFeatures?.slice(0, 3).join(', ') || 'consistent background'}
Colors: ${environmentalDNA.primaryLocation.colorPalette?.slice(0, 3).join(', ') || 'vibrant palette'}

`;
        }
        
        // 5. EMOTIONAL CONTEXT
        if (options.emotion) {
          worldClassPrompt += `EMOTION: ${options.emotion} expression clearly shown\n`;
        }
        
        // 6. QUALITY SPECIFICATIONS (condensed) with style calibration
        const audienceSpecs = {
          'children': 'bright, colorful, friendly, safe',
          'young adults': 'dynamic, engaging, sophisticated',
          'adults': 'nuanced, complex, cinematic'
        };
        
        const styleCalibration = STYLE_SPECIFIC_PANEL_CALIBRATION[options.characterArtStyle || 'storybook'] || STYLE_SPECIFIC_PANEL_CALIBRATION['semi-realistic'];
        
        worldClassPrompt += `
REQUIREMENTS: Professional ${options.characterArtStyle || 'storybook'} comic art (${styleCalibration.stylePrompt}) for ${options.audience}, ${audienceSpecs[options.audience] || audienceSpecs.children}, panel ${panelNumber}/${totalPanels}, publication-ready quality`;
        
        // INTELLIGENT COMPRESSION if needed
        if (worldClassPrompt.length > 3800) {
          this.log('warn', `Prompt too long (${worldClassPrompt.length} chars), applying intelligent compression...`);
          worldClassPrompt = this.compressPromptIntelligently(worldClassPrompt);
          this.log('info', `Compressed to ${worldClassPrompt.length} chars while preserving critical elements`);
        }
        
        this.log('info', `World-class prompt created (${worldClassPrompt.length} chars) with DNA: ${!!characterDNA}, Env: ${!!environmentalDNA}`);
        
        // ✅ CRITICAL FIX: Use generatePanelWithCharacter for ACTUAL IMAGE generation
        // Previously used generateTextCompletion which returned TEXT instead of image URL
        const cartoonImageUrl = options.cartoon_image || characterDNA?.cartoonImage;
        
        if (!cartoonImageUrl) {
          throw new Error('No cartoon image URL provided for panel generation. Required for character consistency.');
        }
        
        // Generate actual image using Gemini's image-to-image generation
        // ✅ CRITICAL: Pass environmentalContext to enforce time/location/lighting consistency
        // Get feedback image enhancement from context if available
        const feedbackImageEnhancement = options.enhancedContext?.learnedPatterns?.feedbackEnhancements?.imageEnhancement || '';

        const imageUrl = await this.geminiIntegration.generatePanelWithCharacter(
          cartoonImageUrl,
          worldClassPrompt,  // Use the world-class prompt as scene description
          options.emotion || 'neutral',
          {
            artStyle: options.characterArtStyle || 'storybook',
            cameraAngle: panelType === 'closeup' ? 'close-up' : panelType === 'wide' ? 'wide angle' : 'eye level',
            lighting: environmentalDNA?.lightingContext?.lightingMood || 'natural',
            panelType: panelType,
            feedbackImageEnhancement: feedbackImageEnhancement,
            backgroundComplexity: environmentalDNA ? 'detailed' : 'moderate',
            temperature: 0.7,
            // ✅ NEW: Pass environmental context for MANDATORY enforcement in Gemini prompts
            environmentalContext: {
              characterDNA: characterDNA,
              environmentalDNA: environmentalDNA,
              panelNumber: panelNumber,
              totalPanels: totalPanels
            }
          }
        );
        
        const duration = Date.now() - startTime;
        this.enterpriseMonitoring.recordOperationMetrics('generateImages', duration, true);
        
        // ✅ VALIDATION: Ensure we got a valid Cloudinary URL, not text
        if (!imageUrl || !imageUrl.includes('cloudinary.com')) {
          this.log('error', `Invalid image URL returned: ${imageUrl?.substring(0, 100)}`);
          throw new Error('Panel generation returned invalid URL instead of Cloudinary image');
        }
        
        return {
          url: imageUrl,
          prompt_used: worldClassPrompt,
          reused: false,
          quality: 'world-class',
          dnaEnforced: !!characterDNA,
          environmentEnforced: !!environmentalDNA,
          panelType: panelType,
          panelNumber: panelNumber,
          totalPanels: totalPanels
        };
      },
      'generateImages',
      options
    );

    // Convert Result to AsyncResult
    return new AsyncResult(resultPromise.then(result => {
      if (result.success) {
        return Result.success(result.data as any); // Type assertion for complex return type
      } else {
        const duration = Date.now() - startTime;
        this.enterpriseMonitoring.recordOperationMetrics('generateImages', duration, false);
        const aiError = new AIServiceUnavailableError(result.error.message, {
          service: this.getName(),
          operation: 'generateImages'
        });
        return Result.failure(aiError);
      }
    }));
  }

  /**
   * Intelligent prompt compression that preserves critical elements
   * Prioritizes Character DNA, scene action, and quality specs
   */
  private compressPromptIntelligently(prompt: string): string {
    const lines = prompt.split('\n').filter(line => line.trim());
    let essential: string[] = [];
    
    // Priority 1: Character consistency (MOST IMPORTANT)
    const characterLines = lines.filter(line =>
      line.includes('CHARACTER CONSISTENCY CRITICAL') ||
      line.includes('Visual Fingerprint:') ||
      line.includes('MUST MAINTAIN:') ||
      line.includes('DNA') ||
      line.includes('FINGERPRINT') ||
      line.includes('VISUAL') ||
      line.includes('CONSISTENCY') ||
      (line.length > 20 && line.toLowerCase().includes('character'))
    ).slice(0, 10);
    essential.push(...characterLines);
    
    // Priority 2: Scene action (CORE CONTENT)
    const sceneLines = lines.filter(line => 
      line.includes('SCENE ACTION:') ||
      (line.length > 15 && !line.includes(':') && !line.includes('CRITICAL'))
    ).slice(0, 3);
    essential.push(...sceneLines);
    
    // Priority 3: Style and quality
    const qualityLines = lines.filter(line =>
      line.includes('Style:') ||
      line.includes('TARGET:') ||
      line.includes('Panel')
    ).slice(0, 3);
    essential.push(...qualityLines);
    
    // Priority 4: Emotion
    const emotionLines = lines.filter(line => line.includes('EMOTION:')).slice(0, 1);
    essential.push(...emotionLines);
    
    // Build compressed prompt
    let compressed = essential.join('\n');

    // Verify character DNA section length
    const charSection = compressed.match(/CHARACTER[\s\S]*?(?=\n\n|$)/);
    if (charSection && charSection[0].length < 400) {
      // Keep more character content if DNA section is too short
      const moreCharLines = lines.filter(line =>
        line.includes('CHARACTER CONSISTENCY CRITICAL') ||
        line.includes('Visual Fingerprint:') ||
        line.includes('MUST MAINTAIN:') ||
        line.includes('DNA') ||
        line.includes('FINGERPRINT') ||
        line.includes('VISUAL') ||
        line.includes('CONSISTENCY') ||
        (line.length > 20 && line.toLowerCase().includes('character'))
      ).slice(0, 15);

      // Rebuild essential with more character lines
      essential = [
        ...moreCharLines,
        ...sceneLines,
        ...qualityLines,
        ...emotionLines
      ];
      compressed = essential.join('\n');
    }

    // Further compress if still too long - PRESERVE CHARACTER DNA LINES
    if (compressed.length > 3800) {
      // Identify character lines to preserve
      const isCharacterLine = (line: string) => {
        return line.includes('CHARACTER') ||
               line.includes('DNA') ||
               line.includes('FINGERPRINT') ||
               line.includes('Visual Fingerprint') ||
               line.includes('MUST MAINTAIN') ||
               line.includes('CONSISTENCY CRITICAL');
      };

      // Truncate only non-character lines
      compressed = essential.map(line => {
        if (isCharacterLine(line)) {
          return line; // Keep character lines full length
        }
        return line.length > 100 ? line.substring(0, 100) : line;
      }).join('\n');
    }
    
    // Nuclear option - ultra minimal (prioritize character DNA)
    if (compressed.length > 3800) {
      // Instead of truncating further, compress OTHER sections more aggressively
      const nonCharLines = essential.filter(line => {
        return !line.includes('CHARACTER') &&
               !line.includes('DNA') &&
               !line.includes('FINGERPRINT') &&
               !line.includes('Visual Fingerprint') &&
               !line.includes('MUST MAINTAIN') &&
               !line.includes('CONSISTENCY CRITICAL');
      });

      // Keep ALL character lines but only top 5 non-character lines
      const finalCharLines = lines.filter(line =>
        line.includes('CHARACTER CONSISTENCY CRITICAL') ||
        line.includes('Visual Fingerprint:') ||
        line.includes('MUST MAINTAIN:') ||
        line.includes('DNA') ||
        line.includes('FINGERPRINT') ||
        line.includes('VISUAL') ||
        line.includes('CONSISTENCY')
      ).slice(0, 10);

      compressed = [
        ...finalCharLines,
        ...nonCharLines.slice(0, 5)
      ].join('\n');
    }
    
    return compressed;
  }

  /**
   * Create character descriptions with professional analysis (FROM BOTH FILES)
   * FIXED: Return proper AsyncResult type and handle Result conversion
   */
  async createCharacterDescription(options: CharacterDescriptionOptions): Promise<AsyncResult<CharacterDescriptionResult, AIServiceUnavailableError>> {
    const startTime = Date.now();
    
    const resultPromise = this.withErrorHandling(
      async () => {
        this.log('info', '👤 Creating character description with professional analysis...');
        
        const characterDNA = await this.visualDNASystem.createMasterCharacterDNA(
          options.imageUrl,
          options.style || 'comic-book'
        );
        
        const duration = Date.now() - startTime;
        this.enterpriseMonitoring.recordOperationMetrics('createCharacterDescription', duration, true);
        
        return {
          description: characterDNA.description,
          cached: false
        };
      },
      'createCharacterDescription',
      options
    );

    // FIXED: Convert Result to AsyncResult and handle error type conversion
    return new AsyncResult(resultPromise.then(result => {
      if (result.success) {
        return Result.success(result.data);
      } else {
        const duration = Date.now() - startTime;
        this.enterpriseMonitoring.recordOperationMetrics('createCharacterDescription', duration, false);
        // Convert ServiceError to AIServiceUnavailableError
        const aiError = new AIServiceUnavailableError(result.error.message, {
          service: this.getName(),
          operation: 'createCharacterDescription'
        });
        return Result.failure(aiError);
      }
    }));
  }

 /**
 * Cartoonize images with professional quality
 * FIXED: Uses Gemini image-to-image generation for 95% consistency
 */
async cartoonizeImage(options: CartoonizeOptions): Promise<AsyncResult<CartoonizeResult, AIServiceUnavailableError>> {
  const startTime = Date.now();
  
  const resultPromise = this.withErrorHandling(
    async () => {
      this.log('info', '🎨 Cartoonizing image with Gemini image-based generation...');
      
      // Create minimal CharacterAnalysis object (Gemini sees the photo anyway)
      const minimalAnalysis = {
        description: `Character in ${options.style} art style`,
        facialFeatures: {},
        bodyType: {},
        clothing: {},
        distinctiveFeatures: [],
        colorPalette: {},
        skinTone: '',
        hairDetails: {},
        expressionBaseline: 'neutral'
      };
      
      // FIXED: Use Gemini's image-to-image generation
      const cartoonUrl = await this.geminiIntegration.generateCartoonFromPhoto(
        options.imageUrl || '',
        options.style || 'storybook',
        minimalAnalysis
      );
      
      const duration = Date.now() - startTime;
      this.enterpriseMonitoring.recordOperationMetrics('cartoonizeImage', duration, true);
      
      return {
        url: cartoonUrl,
        cached: false
      };
    },
    'cartoonizeImage',
    options
  );

  // Convert Result to AsyncResult and handle error type conversion
  return new AsyncResult(resultPromise.then(result => {
    if (result.success) {
      return Result.success(result.data);
    } else {
      const duration = Date.now() - startTime;
      this.enterpriseMonitoring.recordOperationMetrics('cartoonizeImage', duration, false);
      // Convert ServiceError to AIServiceUnavailableError
      const aiError = new AIServiceUnavailableError(result.error.message, {
        service: this.getName(),
        operation: 'cartoonizeImage'
      });
      return Result.failure(aiError);
    }
  }));
}

  /**
   * Generate chat completions with professional context (FROM BOTH FILES)
   * FIXED: Return proper AsyncResult type, fix method signature, and handle Result conversion
   */
  async generateChatCompletion(options: ChatCompletionOptions): Promise<AsyncResult<ChatCompletionResult, AIServiceUnavailableError>> {
    const startTime = Date.now();
    
    const resultPromise = this.withErrorHandling(
      async () => {
        this.log('info', '💬 Generating chat completion with professional context...');
        
        const result = await this.geminiIntegration.generateTextCompletion(
          options.messages[0]?.content || '',
          {
            temperature: options.temperature !== undefined ? options.temperature : 0.7,
            max_output_tokens: options.maxTokens || 1000,
            top_p: 0.9,
            // model: // Gemini doesn't use model parameter options.model || this.defaultModel
          }
        );
        
        const duration = Date.now() - startTime;
        this.enterpriseMonitoring.recordOperationMetrics('generateChatCompletion', duration, true);
        
        return {
          choices: [{
            message: {
              content: result,
              role: 'assistant'
            }
          }],
          model: options.model || this.defaultModel,
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          }
        };
      },
      'generateChatCompletion',
      options
    );

    // FIXED: Convert Result to AsyncResult and handle error type conversion
    return new AsyncResult(resultPromise.then(result => {
      if (result.success) {
        return Result.success(result.data);
      } else {
        const duration = Date.now() - startTime;
        this.enterpriseMonitoring.recordOperationMetrics('generateChatCompletion', duration, false);
        // Convert ServiceError to AIServiceUnavailableError
        const aiError = new AIServiceUnavailableError(result.error.message, {
          service: this.getName(),
          operation: 'generateChatCompletion'
        });
        return Result.failure(aiError);
      }
    }));
  }

  // ===== MISSING INTERFACE IMPLEMENTATIONS - FIXED =====

  /**
   * Generate story with options - interface compatibility method
   * FIXED: Correct method signature to match interface and replace non-existent method call
   * ENHANCED: Multi-character support with up to 4 characters
   */
  async generateStoryWithOptions(options: StoryGenerationOptions): Promise<AsyncResult<StoryGenerationResult, AIServiceUnavailableError>> {
    const startTime = Date.now();
    
    const resultPromise = this.withErrorHandling(
      async () => {
        // FIX 1: Validate genre is provided
        if (!options.genre) {
          throw new Error('Genre is required for story generation');
        }
        
        const audience = options.audience || 'children';
        const genre = options.genre; // Now guaranteed to be defined
        const characterDescription = options.characterDescription || 'a character'; // FIX: Provide default
        const characters = options.characters || [];  // NEW: Multi-character support
        
        // NEW: Build character profiles for multi-character stories
        const characterProfiles = this.buildMultiCharacterProfiles(characterDescription, characters);
        const characterCount = characters.length;
        
        if (characterCount > 0) {
          console.log(`👥 Story generation with ${characterCount} character(s)`);
        }
        
        const genreConfig = WORLD_CLASS_STORY_PROMPTS.genrePrompts[genre as keyof typeof WORLD_CLASS_STORY_PROMPTS.genrePrompts];
        if (!genreConfig) {
          throw new Error(`Unsupported genre: ${genre}`);
        }

        const audienceConfig = WORLD_CLASS_STORY_PROMPTS.audienceRequirements[audience as keyof typeof WORLD_CLASS_STORY_PROMPTS.audienceRequirements];
        const config = PROFESSIONAL_AUDIENCE_CONFIG[audience as keyof typeof PROFESSIONAL_AUDIENCE_CONFIG];

        // Build comprehensive prompt with 7 master comic creator principles
        const storyPrompt = `You are a master storyteller combining the principles of Will Eisner (sequential art), Scott McCloud (panel transitions), Stan Lee (emotional authenticity), Jack Kirby (visual power), Neil Gaiman (layered storytelling), Alan Moore (thematic depth), and Art Spiegelman (dramatic pacing).

<objective>
Create a ${audience} ${genre} story for ${characterProfiles.split('\n')[0] || 'the character'}. The story will become a ${config.minPanels}-${config.maxPanels} panel comic book, so write with visual storytelling and panel-to-panel flow in mind. Embed all 7 master comic creator principles PROACTIVELY into the narrative structure.
</objective>

<panel_requirement>
CRITICAL: Create a story that naturally contains ${config.minPanels}-${config.maxPanels} distinct narrative moments.
Target: ${config.totalPanels} story beats (distinct visual moments).

Structure your story to have EXACTLY this many key events:
- Children: 10-14 narrative moments (aim for 12)
- Young Adults: 18-22 narrative moments (aim for 20)  
- Adults: 24-30 narrative moments (aim for 27)

Each narrative moment = one panel in the comic.
Plan your story arc to naturally fit this panel budget.
</panel_requirement>

<genre_framework>
GENRE: ${genre.toUpperCase()}
${genreConfig.structure}

EMOTIONAL JOURNEY: ${genreConfig.emotionalBeats.join(' → ')}
KEY VISUAL MOMENTS: ${genreConfig.visualElements.join(', ')}
DIALOGUE STYLE: ${genreConfig.dialogueStyle}
CORE THEMES: ${genreConfig.themes}
</genre_framework>

<character_context>
${characterProfiles}
</character_context>

<audience_requirements>
AUDIENCE: ${audience.toUpperCase()}
TARGET LENGTH: ${audienceConfig.wordTarget}
PANEL ALLOCATION: ${config.minPanels}-${config.maxPanels} panels (${config.pagesPerStory} pages)
VOCABULARY: ${audienceConfig.vocabulary}
${audience === 'children' && 'safetyRules' in audienceConfig ? `
SAFETY RULES (MANDATORY):
${(audienceConfig as any).safetyRules.map((rule: string) => `• ${rule}`).join('\n')}
` : ''}
${audience !== 'children' ? `MATURITY LEVEL: ${(audienceConfig as any).maturityLevel}` : ''}
</audience_requirements>

<seven_master_principles>
Embed these principles PROACTIVELY as you write:

▸▸▸ PRINCIPLE 1: EISNER - FROZEN MOMENTS ◂◂◂
Write scenes as FROZEN MOMENTS IN TIME, not summaries:
- BAD: "Maya fell to the ground feeling sad"
- GOOD: "Maya's hands slip from the rung. Her body tilts backward, grass rushing up. Her eyes widen—the moment frozen between climb and fall."

Write 70%+ of your story moments as present-tense action-in-progress.

▸▸▸ PRINCIPLE 2: McCLOUD - SMOOTH TRANSITIONS ◂◂◂
Ensure scenes flow naturally with clear connections:
- Action-to-Action (65%): Same character continues action across scenes
- Subject-to-Subject (20%): Shift focus within same location
- Scene-to-Scene (15% MAX): Time/location jumps WITH clear transition phrases

Use phrases like: "Moments later...", "Meanwhile...", "As the sun rose..." for scene changes.

▸▸▸ PRINCIPLE 3: STAN LEE - TRANSFORMATION MOMENTS ◂◂◂
CRITICAL: When emotion changes significantly (sad→happy, scared→brave), SHOW THE TURNING POINT:
- Don't jump from defeat to triumph—show the moment realization dawns
- Include beats like: "Her eyes widened. Wait... what if..." or "Something clicked inside her"
- Make emotional shifts VISIBLE and EARNED

Example structure:
Scene A: Character discouraged, sitting alone
Scene B: **"She looked up. In the distance, a light flickered. Hope stirred in her chest."** ← TRANSFORMATION MOMENT
Scene C: Character standing, determined, moving toward light

▸▸▸ PRINCIPLE 4: KIRBY - VISUAL POWER MOMENTS ◂◂◂
Describe KEY emotional moments with VISUAL POWER:
- Triumph: "She stood tall, sun breaking through clouds behind her like a spotlight"
- Defeat: "Small and alone, she sat beneath towering trees that seemed to close in"
- Realization: "Her face filled the moment—eyes suddenly understanding, mouth forming 'oh'"

Match visual scale to emotional weight.

▸▸▸ PRINCIPLE 5: GAIMAN - LAYERED RICHNESS ◂◂◂
Every scene should have THREE LAYERS:
1. Physical: What's happening (action)
2. Sensory: What character experiences (sight, sound, touch, smell)
3. Emotional/Symbolic: What it MEANS (internal state, theme)

Example: "She gripped the cold metal rung (physical), rust flaking beneath sweaty palms (sensory), each grip tighter than the last—holding on as her confidence slipped (symbolic/emotional)."

▸▸▸ PRINCIPLE 6: MOORE - SYMBOLIC THREADS ◂◂◂
Weave ONE symbolic element throughout:
- An object that represents the theme (stuffed animal = comfort, broken toy = loss, flower = growth)
- A color with meaning (blue = safety, red = danger, gold = discovery)
- A recurring visual (shadows lengthening = fear growing, light breaking through = hope)

Introduce it early, reference it 2-3 times meaningfully, transform it by the end.

▸▸▸ PRINCIPLE 7: SPIEGELMAN - DRAMATIC PACING ◂◂◂
Structure your story with varied emotional intensity:
- Opening (weight: 6/10): Strong start, establish stakes
- Rising action (weight: 5-7/10): Build tension incrementally
- Climax (weight: 10/10): BIGGEST moment—this should be described with maximum detail and emotion
- Resolution (weight: 7-8/10): Satisfying but not overwhelming

The climax should be your longest, most detailed scene description (3-4 sentences).
</seven_master_principles>

<story_structure>
Your story MUST follow this proven structure:

ACT 1 - SETUP (First 25% of panels):
- Establish character in their normal world
- Show what they want or need
- Introduce the challenge/problem clearly

ACT 2 - RISING ACTION (Middle 50% of panels):
- Character attempts to overcome challenge
- Obstacles escalate
- Include 2-3 try-fail cycles
- Show character learning/adapting
- BUILD to emotional low point

ACT 3 - CLIMAX & RESOLUTION (Final 25% of panels):
- Darkest moment OR biggest challenge
- **TRANSFORMATION MOMENT** (Principle 3: visible turning point)
- Character applies what they learned
- Resolution that shows change
- Clear lesson or growth demonstrated

${audience === 'children' ? `
CHILDREN'S STORY SPECIFIC RULES:
- Problem and solution must be CONCRETE (not abstract)
- Lesson must be EXPLICIT and SIMPLE: "${characterProfiles.match(/Name: ([^\n]+)/)?.[1] || 'Character'} learned that..."
- Ending must be POSITIVE and CLEAR
- NO ambiguous or philosophical conclusions
- Examples of good endings:
  ✓ "Now Maya knew—asking for help was brave, not weak."
  ✓ "From that day on, Leo wasn't scared of the dark. The stars were his friends."
  ✗ "And the magic would always be there" (too abstract)
  ✗ "In that moment, everything changed" (too vague)

PANEL BUDGET AWARENESS:
You have 10-14 panels to tell this story. Plan accordingly:
- Setup: 2-3 panels
- Rising action: 4-6 panels
- Climax: 1-2 panels
- Resolution: 2-3 panels
DO NOT create overly simple stories. Each panel needs a distinct story moment.
` : ''}
</story_structure>

<dialogue_requirements>
${WORLD_CLASS_STORY_PROMPTS.dialogueRequirements(audience)}

DIALOGUE INTEGRATION WITH PRINCIPLES:
- Transformation moments often need inner dialogue: "Wait... what if I..."
- Emotional peaks need exclamations: "Yes!", "Oh no!", "I can do this!"
- Keep dialogue SHORT (3-8 words per speech bubble)
- Every line must advance plot OR reveal character
</dialogue_requirements>

<output_format>
Return your story in this EXACT format:

TITLE: [Compelling 3-6 word title]

STORY:
[Write the complete narrative. Make it ${audienceConfig.wordTarget}. Structure into clear scenes with paragraph breaks. Include dialogue in quotation marks. Apply all 7 principles throughout. Make the climax your longest, most detailed scene.]

END OF STORY

Do NOT add any commentary, analysis, or meta-text. Just the title and story.
</output_format>

<critical_reminders>
✓ Write scenes as frozen moments (Eisner)
✓ Connect scenes smoothly (McCloud)
✓ Show emotional turning points (Stan Lee)
✓ Match visual description to emotion (Kirby)
✓ Add sensory + symbolic layers (Gaiman)
✓ Weave ONE symbolic element throughout (Moore)
✓ Make climax the most detailed, intense scene (Spiegelman)
✓ Character appears in 80%+ of scenes
✓ Ending is clear, satisfying, and shows growth
${audience === 'children' ? '✓ Age-appropriate, safe, educational content ONLY' : ''}
</critical_reminders>

Now write the story.`;

        // Call Gemini
        // FIX 2: Use 'young adults' (with space) not 'young_adults'
        const response = await this.geminiIntegration.generateTextCompletion(storyPrompt, {
          temperature: 0.8,
          max_output_tokens: audience === 'children' ? 6000 : audience === 'young adults' ? 8000 : 10000
        });

        // Extract title and story
        const titleMatch = response.match(/TITLE:\s*(.+)/);
        const title = titleMatch ? titleMatch[1].trim() : `${genre.charAt(0).toUpperCase() + genre.slice(1)} Adventure`;
        
        const storyMatch = response.match(/STORY:\s*([\s\S]+?)(?:END OF STORY|$)/);
        const story = storyMatch ? storyMatch[1].trim() : response;

        const duration = Date.now() - startTime;
        this.enterpriseMonitoring.recordOperationMetrics('generateStoryWithOptions', duration, true);

        // FIX 3: Return only properties defined in StoryGenerationResult interface
        return {
          story: story,
          title: title,
          wordCount: story.split(/\s+/).length // Required by interface
        };
      },
      'generateStoryWithOptions'
    );

    return new AsyncResult(resultPromise.then(result => {
      if (result.success) {
        return Result.success(result.data);
      } else {
        const aiError = new AIServiceUnavailableError(result.error.message, {
          service: this.getName(),
          operation: 'generateStoryWithOptions'
        });
        return Result.failure(aiError);
      }
    }));
  }


  /**
   * Process cartoonize - interface compatibility method  
   */
  async processCartoonize(options: CartoonizeOptions): Promise<AsyncResult<CartoonizeResult, AIServiceUnavailableError>> {
    return this.cartoonizeImage(options);
  }

  /**
   * Create chat completion - interface compatibility method
   * FIXED: Correct method signature to match interface
   */
  async createChatCompletion(options: ChatCompletionOptions): Promise<AsyncResult<ChatCompletionResult, AIServiceUnavailableError>> {
    return this.generateChatCompletion(options);
  }

  async analyzeStoryStructure(story: string, audience: AudienceType): Promise<StoryAnalysis> {
  const result = await this.withErrorHandling(
    async () => {
      this.log('info', `📖 Analyzing story structure for ${audience} audience using Claude API with 7 Master Principles...`);
      
      const config = PROFESSIONAL_AUDIENCE_CONFIG[audience];
      const panelCount = config.totalPanels;
      
      // Narrative intelligence for archetype detection
      const narrativeIntel = {
        storyArchetype: 'adventure', // Will be detected by Claude
        emotionalArc: audience === 'children' 
          ? ['curious', 'nervous', 'determined', 'triumphant', 'joyful']
          : audience === 'young adults'
          ? ['intrigued', 'challenged', 'conflicted', 'resolved', 'transformed']
          : ['complex', 'conflicted', 'tested', 'transformed', 'enlightened'],
        thematicElements: ['courage', 'growth', 'discovery'],
        pacingStrategy: audience === 'children' ? 'clear_progression' : 'emotional_depth',
        characterGrowth: ['introduction', 'challenge', 'growth', 'transformation']
      };

      const analysisPrompt = `You are a master comic book story analyst combining the expertise of Will Eisner (sequential art), Scott McCloud (panel transitions), Stan Lee (emotional authenticity), Jack Kirby (visual power), Neil Gaiman (layered storytelling), Alan Moore (thematic depth), and Art Spiegelman (dramatic pacing).

<objective>
Analyze the provided story and generate ${config.minPanels}-${config.maxPanels} story beats (${panelCount} optimal) for ${audience} comic book adaptation. Each beat must be a compelling visual moment with proper panel-to-panel continuity, following ${narrativeIntel.storyArchetype} archetype structure. Apply all 7 professional comic book standards to achieve world-class quality.
</objective>

<narrative_intelligence>
STORY ARCHETYPE: ${narrativeIntel.storyArchetype.toUpperCase()}
EMOTIONAL PROGRESSION: ${narrativeIntel.emotionalArc.join(' → ')}
THEMATIC ELEMENTS: ${narrativeIntel.thematicElements.join(', ')}
PACING STRATEGY: ${narrativeIntel.pacingStrategy}
CHARACTER GROWTH ARC: ${narrativeIntel.characterGrowth.join(', ')}

AUDIENCE: ${audience.toUpperCase()}
TARGET: ${config.minPanels}-${config.maxPanels} panels (${panelCount} optimal) across ${config.pagesPerStory} pages
COMPLEXITY: ${config.complexityLevel}
NARRATIVE DEPTH: ${config.narrativeDepth}
</narrative_intelligence>

<story_input>
${story}
</story_input>

<instructions>
Generate story beats following this comprehensive three-step process:

PANEL COUNT FLEXIBILITY:
Generate ${config.minPanels}-${config.maxPanels} beats based on story's natural complexity.
- DO NOT force-pad short stories with filler beats
- DO NOT artificially compress complex stories
- Let story content determine beat count within the range
- Aim for ${config.totalPanels} beats if story naturally supports it
- Accept ${config.minPanels} beats for simpler stories
- Use up to ${config.maxPanels} beats for complex narratives

═══ STEP 1: INITIAL BEAT GENERATION WITH 7 MASTER PRINCIPLES ═══

Break story into ${config.minPanels}-${config.maxPanels} beats (aim for ${panelCount}), applying ALL professional standards:

▸▸▸ PRINCIPLE 1: EISNER - MOMENT CAPTURE ◂◂◂
Each beat = ONE FROZEN MOMENT IN TIME (not a summary of completed action)
- BAD: "Maya fell onto grass" (past tense, completed result)
- GOOD: "Maya's hands slip from rung, body tilts backward mid-air, grass rushing up below" (present tense, frozen moment)
- 70%+ of beats MUST show action-in-progress
- Show the EXACT INSTANT something happens, not before/after

▸▸▸ PRINCIPLE 2: McCLOUD - TRANSITION AWARENESS ◂◂◂
Classify how each beat connects to previous beat:
- Action-to-Action (65%): Same character continues action
- Subject-to-Subject (20%): Same scene, different focus
- Scene-to-Scene (15% MAX): Time/location jump
Plan transitions consciously to maintain visual flow.

▸▸▸ PRINCIPLE 3: STAN LEE - EMOTIONAL TRANSFORMATION ◂◂◂
When emotion changes 2+ levels (e.g., sad → happy), INSERT transformation beat:
- Show the MOMENT realization/change happens
- Close-up on face capturing the shift
- Example: Sad (Panel 7) → Helper arrives (Panel 8) → **CLOSE-UP: Eyes widen with understanding** (NEW Panel 8.5) → Happy (Panel 9)
Track emotional jumps and ensure visible turning points.

▸▸▸ PRINCIPLE 4: KIRBY - CAMERA-EMOTION POWER ◂◂◂
Camera angles MUST amplify emotions, not just show action:
- Defeat/vulnerability → high-angle (character looks small)
- Triumph/power → low-angle (character looks heroic)
- Realization/intimacy → close-up (emotion fills frame)
- Discovery → wide-angle (character in vast space)
Choose angles that FEEL the emotion, not just see it.

▸▸▸ PRINCIPLE 5: GAIMAN - LAYERED BEATS ◂◂◂
Each beat should have THREE LAYERS:
- Physical: What character's body is doing
- Sensory: What they see/hear/feel/smell (environment texture)
- Symbolic/Emotional: What it MEANS (internal state)

Example LAYERED beat:
"Maya's fingers slip from cold metal rung (physical), rough surface scraping her palms (sensory), her confident grip dissolving into helplessness (symbolic/emotional)"

NOT just: "Maya falls from ladder"

Add richness through sensory details and emotional subtext.

▸▸▸ PRINCIPLE 6: MOORE - VISUAL SYMBOLISM ◂◂◂
Identify recurring symbolic objects/elements across the story:
- Objects that represent themes (stuffed animal = comfort, broken toy = loss)
- Colors that carry meaning (blue for safety, red for danger)
- Visual motifs that echo through panels (shadows, reflections, repeated shapes)

Track these symbols and note when they appear:
- First appearance: Establish meaning
- Recurrence: Reinforce theme
- Transformation: Show character growth

Example: Blue bunny appears in background when character feels safe (Panel 2, 5, 9)

▸▸▸ PRINCIPLE 7: SPIEGELMAN - EMOTIONAL WEIGHT SIZING ◂◂◂
Assign emotionalWeight score (1-10) to each beat:
- 1-3: Transitional moments, minor beats (small panels)
- 4-7: Standard story progression (medium panels)
- 8-10: Climax, major realizations, peak emotions (large/splash panels)

This guides panel sizing on page layout:
- Climax beat (~75% through story): emotionalWeight = 10 (full page potential)
- Resolution beat: emotionalWeight = 7-8 (satisfying closure)
- Setup beats: emotionalWeight = 4-6 (establish efficiently)

═══ STEP 2: COMPREHENSIVE SELF-VALIDATION (MUST RUN BEFORE RETURNING JSON) ═══

Before finalizing beats, validate against ALL 7 professional standards:

✓ CHECK 1 - McCLOUD TRANSITION DISTRIBUTION:
Count transition types between consecutive beats:
- Action-to-Action: TARGET 60-70%
- Subject-to-Subject: TARGET 20-25%
- Scene-to-Scene: TARGET 10-15% MAXIMUM

IF Scene-to-Scene >15%: INSERT bridging Action-to-Action beats.
IF Action-to-Action <50%: Story feels disconnected - consolidate jumps.

✓ CHECK 2 - EISNER MOMENT CAPTURE:
- 70%+ of beats MUST show action-in-progress (present tense), NOT completed results
- Physical states must be ONGOING: "climbing" not "climbed", "falling" not "fell"
- Emotional moments must be VISIBLE: "eyes widen with realization" not "learned lesson"

IF <70% action-in-progress: REWRITE static beats as dynamic frozen moments.

✓ CHECK 3 - CONTINUITY GAP DETECTION:
For each consecutive pair, verify: "Can reader understand how we got from Beat N to Beat N+1?"

COMMON GAP PATTERN (MUST FIX):
❌ Beat 8: "Helper approaches"
❌ Beat 9: "Character learned lesson"
MISSING: The actual helping action!

✅ CORRECT: Insert Beat showing helper's hands lifting character, working together.

✓ CHECK 4 - KIRBY CAMERA-EMOTION SYNC:
Verify camera angles amplify emotions:
- Defeat → high-angle | Triumph → low-angle | Realization → close-up | Discovery → wide
IF mismatched: ADJUST cameraAngle field.

✓ CHECK 5 - STAN LEE EMOTIONAL TRANSFORMATION:
Scan emotional progression for jumps of 2+ levels:
- Sad → Neutral → Happy = OK (gradual)
- Sad → Happy = MISSING transformation beat
- Scared → Curious → Confident = OK
- Scared → Confident = MISSING realization moment

IF emotional jump >1 level without intermediate beat: INSERT close-up transformation panel.

✓ CHECK 6 - GAIMAN LAYERED RICHNESS:
Review 5 random beats for layering:
- Does it have physical description? (what's happening)
- Does it have sensory details? (how it feels/looks/sounds)
- Does it have emotional/symbolic depth? (what it means)

IF <60% of beats have all 3 layers: ADD sensory and symbolic details to flat beats.

✓ CHECK 7 - MOORE SYMBOLIC TRACKING:
Identify if story has recurring symbolic elements (objects, colors, motifs):
- Are they introduced meaningfully?
- Do they recur at thematically appropriate moments?
- Do they transform/resolve by story's end?

IF symbols exist but inconsistent: ADJUST beat descriptions to include them.
IF no symbols identified but story would benefit: ADD one recurring element (stuffed animal, special object, color motif).

✓ CHECK 8 - SPIEGELMAN EMOTIONAL WEIGHT:
Review emotionalWeight scores across all beats:
- Highest weight (9-10) should be at climax (~75% through story)
- Should have variety: mix of 3-6 (transitions), 6-8 (story beats), 9-10 (peaks)
- Opening beat should be 6-7 (strong start, not overwhelming)
- Resolution should be 7-8 (satisfying, not anti-climactic)

IF climax isn't highest weight: ADJUST scores.
IF too many 9-10 scores (>2): Reduces impact - LOWER some to 7-8.

═══ STEP 3: FINAL VALIDATION STATEMENT ═══

Before returning JSON, confirm ALL checks:
"All 7 master principles validated:
✓ Eisner: 70%+ beats show frozen moments in time
✓ McCloud: Transition distribution optimal (65/20/15)
✓ Stan Lee: All emotional shifts have visible transformation beats
✓ Kirby: Camera angles amplify every emotion
✓ Gaiman: Beats have physical + sensory + symbolic layers
✓ Moore: Symbolic elements tracked and meaningful
✓ Spiegelman: Emotional weight scores guide dramatic pacing
✓ Zero continuity gaps - every action has consequence"

If ANY check fails, FIX in STEP 1, then re-validate.
Only return JSON after ALL checks pass.
</instructions>

<critical_requirements>
Preserve all existing system requirements:

1. ACTION CONTEXT (Prevents literal/confusing illustrations):
Every characterAction MUST explain PURPOSE/GOAL, not just physical movement.
- BAD: "picking up stick" → AI draws random stick-holding
- GOOD: "picking up long stick to use as reaching tool to retrieve ball stuck under bush"
Include actionContext field explaining WHY action matters.

2. SPEECH BUBBLE POSITIONING (Professional comic standard):
When hasSpeechBubble is true:
- speakerName: Character's actual name
- speakerPosition: "left", "center", or "right"
- bubblePosition: OPPOSITE speaker (professional convention)

3. CAMERA ANGLE INTELLIGENCE:
Choose based on STORY MOMENT:
- Character discovers object → close-up
- Enters new location → wide/extreme-wide
- Emotional confrontation → close-up
- Physical action → low-angle/dutch-angle
- Feels overwhelmed → high-angle
- Triumphant → low-angle
- Climax → close-up

Provide cameraReason explaining choice.
DIVERSITY: Minimum 4 unique angles, no consecutive duplicates.

4. MULTI-CHARACTER SUPPORT:
- charactersPresent: Array of names in panel
- primaryCharacter: Main focus
- secondaryCharactersInScene: Array of {name, action, position}

5. DIALOGUE QUALITY:
SHORT (3-8 words), age-appropriate.
Examples: "What's this?", "I can do this!", "Oh no...", "Yes!"
</critical_requirements>

<few_shot_example>
INPUT:
Story: "Luna the brave rabbit decided to explore the dark forest. She hopped through tall trees nervously. A wise owl perched above warned her about the river ahead. Luna carefully approached the water's edge and saw stepping stones. She took a deep breath, gathered her courage, then leaped between stones with determination. On the far side, Luna discovered a magical garden full of glowing flowers and gasped in wonder, realizing her bravery had led to something beautiful."
Audience: children
Panels: 10-14 (optimal 12)

OUTPUT:
{
  "storyArchetype": "adventure",
  "emotionalArc": ["curious", "nervous", "cautious", "scared", "determined", "triumphant", "amazed"],
  "thematicElements": ["courage", "discovery", "perseverance", "wonder"],
  "symbolicElements": ["glowing_flowers_represent_reward_for_bravery"],
  "storyBeats": [
    {
      "beatNumber": 1,
      "beat": "Luna rabbit stands at dark forest edge, ears perked with curiosity, gazing at shadowy trees ahead, morning light behind her creating long shadow forward into unknown",
      "emotion": "curious",
      "characterAction": "standing alert at forest boundary, weight shifted forward on front paws, body language showing readiness to hop forward",
      "actionContext": "preparing to enter unknown territory, gathering courage for adventure into the dark forest",
      "physicalLayer": "Standing upright, ears fully extended, front paws at edge",
      "sensoryLayer": "Cool morning air, dark shadows contrasting with bright clearing behind, smell of pine and earth",
      "symbolicLayer": "Threshold between safety and adventure, light (known) vs shadow (unknown)",
      "cameraAngle": "wide",
      "cameraReason": "Wide establishing shot shows Luna small against vast forest, emphasizes the journey ahead and makes viewer feel the scale of her courage",
      "panelType": "establishing_shot",
      "transitionType": "first_panel",
      "emotionalWeight": 6,
      "dialogue": "",
      "hasSpeechBubble": false,
      "locationChange": "forest_edge",
      "symbolicElements": ["long shadow pointing into forest = path of courage"]
    },
    {
      "beatNumber": 2,
      "beat": "Luna mid-hop between tall dark trees, ears pulled slightly back, eyes wide scanning surroundings, dappled shadows playing across her fur, twigs crackling under feet",
      "emotion": "nervous",
      "characterAction": "hopping cautiously through dense trees, body tense, glancing side to side with each hop",
      "actionContext": "navigating unfamiliar forest, alert for dangers while maintaining forward progress despite fear",
      "physicalLayer": "Mid-hop, body arched, muscles tense, ears swiveling",
      "sensoryLayer": "Dark shadows all around, sounds of forest creaking, rough bark visible on nearby trees, filtered sunlight",
      "symbolicLayer": "Moving through uncertainty, surrounded but not stopped, courage overcoming fear",
      "cameraAngle": "medium",
      "cameraReason": "Medium shot captures Luna's nervous body language and oppressive dark surroundings while keeping her as focal point",
      "panelType": "medium_shot",
      "transitionType": "action_to_action",
      "emotionalWeight": 5,
      "dialogue": "The trees are so tall...",
      "hasSpeechBubble": true,
      "speechBubbleStyle": "thought",
      "speakerName": "Luna",
      "speakerPosition": "center",
      "bubblePosition": "top-center",
      "locationChange": "same"
    },
    {
      "beatNumber": 3,
      "beat": "Wise owl with enormous round amber eyes perches on thick branch directly above Luna, one wing extended pointing toward rushing river in distance, moonlight catching feathers",
      "emotion": "cautious",
      "characterAction": "looking up at owl from below, ears forward in alert listening position, body still, absorbing warning",
      "actionContext": "receiving crucial warning about danger ahead, processing information to decide how to proceed safely",
      "physicalLayer": "Head tilted back, eyes locked on owl, paws planted, tail still",
      "sensoryLayer": "Owl's deep wise voice, river sounds faintly audible in distance, cool breeze rustling leaves",
      "symbolicLayer": "Wisdom offered to courage, guidance from experience, moment of choice",
      "cameraAngle": "low_angle",
      "cameraReason": "Low angle looking up makes owl appear wise and important from Luna's perspective, emphasizes power dynamic and gravity of warning",
      "panelType": "medium_shot",
      "transitionType": "subject_to_subject",
      "emotionalWeight": 6,
      "dialogue": "Careful of the river, little one",
      "hasSpeechBubble": true,
      "speechBubbleStyle": "speech",
      "speakerName": "Owl",
      "speakerPosition": "right",
      "bubblePosition": "top-left",
      "locationChange": "same"
    },
    {
      "beatNumber": 4,
      "beat": "Luna crouched low at river's rocky edge, peering down at water rushing over smooth gray stepping stones, mist rising from splashing water, distance between stones looking vast",
      "emotion": "scared",
      "characterAction": "crouched with body low to ground, ears flat against head showing fear, eyes calculating distance between stones with visible worry",
      "actionContext": "confronting the actual challenge warned about, assessing whether courage is enough to attempt crossing",
      "physicalLayer": "Body compressed, muscles coiled, breathing quick, paws gripping rocks",
      "sensoryLayer": "Cold mist on face, loud rushing water sounds, stones look slippery and wet, spray dampening fur",
      "symbolicLayer": "Facing fear directly, the gap between wanting to be brave and taking brave action",
      "cameraAngle": "high_angle",
      "cameraReason": "High angle shows Luna looking small and vulnerable facing the challenge, emphasizes danger and her fear",
      "panelType": "medium_shot",
      "transitionType": "action_to_action",
      "emotionalWeight": 7,
      "dialogue": "It's so far...",
      "hasSpeechBubble": true,
      "speechBubbleStyle": "thought",
      "speakerName": "Luna",
      "speakerPosition": "center",
      "bubblePosition": "top-center",
      "locationChange": "river_edge"
    },
    {
      "beatNumber": 5,
      "beat": "CLOSE-UP: Luna's face filling frame, eyes squeezed shut for moment, then opening with fierce determination, whiskers trembling, jaw set, visible transformation from scared to resolved",
      "emotion": "determined",
      "characterAction": "taking deep breath, steeling nerves, internal shift from fear to courage visible in tightening facial expression",
      "actionContext": "making the conscious choice to be brave despite fear, the transformation moment where courage wins",
      "physicalLayer": "Face muscles tighten, eyes go from fearful to determined, breath held then released",
      "sensoryLayer": "Heart pounding in chest, cold mist on face, sound of rushing water fading as focus narrows",
      "symbolicLayer": "THE TRANSFORMATION MOMENT - fear acknowledged but overcome, choice to act despite uncertainty",
      "cameraAngle": "extreme_close_up",
      "cameraReason": "Extreme close-up on face captures the exact moment of internal transformation, the turning point from fear to courage - Stan Lee principle of showing emotional shifts",
      "panelType": "reaction_shot",
      "transitionType": "moment_to_moment",
      "emotionalWeight": 9,
      "dialogue": "I can do this!",
      "hasSpeechBubble": true,
      "speechBubbleStyle": "speech",
      "speakerName": "Luna",
      "speakerPosition": "center",
      "bubblePosition": "top-center",
      "locationChange": "same"
    },
    {
      "beatNumber": 6,
      "beat": "Luna frozen mid-leap between stepping stones, all four legs extended in powerful jump, water splashing dramatically below, body forming perfect arc against sky, face showing intense concentration",
      "emotion": "determined",
      "characterAction": "airborne between stones, legs stretched to maximum, eyes locked on target stone, entire body committed to jump",
      "actionContext": "executing plan to cross river, using newfound courage to overcome fear with decisive action",
      "physicalLayer": "Full extension mid-air, muscles engaged, claws extended for landing, tail streaming behind",
      "sensoryLayer": "Wind rushing past ears, spray of water below, sound of water loud, feeling of weightlessness",
      "symbolicLayer": "Courage in action, the leap of faith, commitment without guarantee",
      "cameraAngle": "eye_level",
      "cameraReason": "Eye level captures the dynamic moment of action and determination, reader experiences jump WITH Luna",
      "panelType": "action_shot",
      "transitionType": "action_to_action",
      "emotionalWeight": 8,
      "dialogue": "",
      "hasSpeechBubble": false,
      "locationChange": "same"
    },
    {
      "beatNumber": 7,
      "beat": "Luna lands safely on far bank, body rising up tall with pride, ears forward in triumph, morning sun breaking through trees illuminating her from behind like spotlight",
      "emotion": "triumphant",
      "characterAction": "standing tall on far riverbank, chest puffed out, head held high, moment of victory and self-realization",
      "actionContext": "recognizing successful completion of challenge, feeling pride in courage that led to achievement",
      "physicalLayer": "Standing at full height, weight balanced confidently, posture proud",
      "sensoryLayer": "Warm sunlight on face, ground solid beneath feet, quieter without river noise, victorious feeling",
      "symbolicLayer": "Courage rewarded, crossing from doubt to confidence, light representing triumph over shadow/fear",
      "cameraAngle": "low_angle",
      "cameraReason": "Low angle makes Luna look heroic and powerful, celebrating her triumph - Kirby principle of camera amplifying emotion",
      "panelType": "reaction_shot",
      "transitionType": "action_to_action",
      "emotionalWeight": 8,
      "dialogue": "I did it!",
      "hasSpeechBubble": true,
      "speechBubbleStyle": "speech",
      "speakerName": "Luna",
      "speakerPosition": "left",
      "bubblePosition": "top-right",
      "locationChange": "far_riverbank"
    },
    {
      "beatNumber": 8,
      "beat": "Luna frozen in complete awe inside magical garden entrance, mouth open in gasp, eyes huge and sparkling, surrounded by countless glowing blue flowers that mirror her wonder, flowers pulsing with soft light like heartbeat",
      "emotion": "amazed",
      "characterAction": "standing perfectly still in overwhelming wonder, every muscle frozen except eyes which are wide with astonishment",
      "actionContext": "experiencing reward for bravery - the magical discovery that comes from having courage to explore unknown",
      "physicalLayer": "Body completely still, eyes at maximum width, ears fully forward, breathing stopped mid-breath",
      "sensoryLayer": "Soft glowing light washing over fur, sweet floral scent, warm peaceful air, gentle humming sound from flowers, magical tingle in air",
      "symbolicLayer": "Reward for courage = beauty and wonder, glowing flowers represent the light found by being brave, full circle from darkness to light",
      "cameraAngle": "close_up",
      "cameraReason": "Close-up on face captures peak emotional moment of wonder and amazement, while flowers visible in background show the reward",
      "panelType": "reaction_shot",
      "transitionType": "scene_to_scene",
      "emotionalWeight": 10,
      "dialogue": "It's... beautiful!",
      "hasSpeechBubble": true,
      "speechBubbleStyle": "speech",
      "speakerName": "Luna",
      "speakerPosition": "left",
      "bubblePosition": "top-right",
      "locationChange": "magical_garden",
      "symbolicElements": ["glowing_blue_flowers = reward_for_courage, mirror_Luna's_inner_light"]
    }
  ],
  "validationResults": {
    "eisnerMomentCapture": 100,
    "mccloudTransitions": {
      "actionToAction": 71,
      "subjectToSubject": 14,
      "sceneToScene": 14,
      "momentToMoment": 14
    },
    "stanLeeTransformation": 100,
    "kirbyCameraEmotion": 100,
    "gaimanLayering": 100,
    "mooreSymbolism": 100,
    "spiegelmanWeighting": 100,
    "continuityGaps": 0,
    "allChecksPassed": true
  },
  "totalPanels": 8,
  "pagesRequired": 3
}

VALIDATION NOTES:
✓ EISNER: 100% - All beats show frozen moments ("mid-hop", "frozen mid-leap", "standing perfectly still")
✓ McCLOUD: 71% Action-to-Action (beats 2,4,6,7,8), 14% Subject-to-Subject (beat 3), 14% Moment-to-Moment (beat 5), 14% Scene-to-Scene (beat 8)
✓ STAN LEE: 100% - Emotional jump from scared (beat 4) to determined (beat 6) has transformation beat (beat 5: close-up of internal shift)
✓ KIRBY: 100% - scared=high-angle, determined=close-up, triumphant=low-angle, amazed=close-up
✓ GAIMAN: 100% - Every beat has physical + sensory + symbolic layers
✓ MOORE: 100% - Symbolic elements tracked: shadow (beat 1), light vs darkness theme, glowing flowers (beat 8)
✓ SPIEGELMAN: 100% - Weight progression: 6→5→6→7→9→8→8→10 (climax at beat 8)
✓ CONTINUITY: 0 gaps - Complete flow from forest edge → through trees → owl warns → river edge → transformation → leap → far bank → garden
</few_shot_example>

<output_format>
Return ONLY valid JSON matching this EXACT schema:

{
  "storyArchetype": string (REQUIRED),
  "emotionalArc": string[] (REQUIRED),
  "thematicElements": string[] (REQUIRED),
  "symbolicElements": string[] (NEW - recurring symbols/motifs),
  "storyBeats": [
    {
      "beatNumber": number (REQUIRED),
      "beat": string (REQUIRED - rich multi-layered moment),
      "emotion": string (REQUIRED),
      "characterAction": string (REQUIRED - physical + purpose),
      "actionContext": string (REQUIRED - WHY doing action),
      "physicalLayer": string (NEW - body doing),
      "sensoryLayer": string (NEW - character senses),
      "symbolicLayer": string (NEW - emotional/thematic meaning),
      "cameraAngle": string (REQUIRED),
      "cameraReason": string (REQUIRED - why this angle),
      "panelType": string (REQUIRED),
      "transitionType": string (REQUIRED),
      "emotionalWeight": number (NEW - 1-10 for panel sizing),
      "dialogue": string,
      "hasSpeechBubble": boolean (REQUIRED),
      "speechBubbleStyle": string | null,
      "speakerName": string (if hasSpeechBubble=true),
      "speakerPosition": string (if hasSpeechBubble=true),
      "bubblePosition": string (if hasSpeechBubble=true),
      "locationChange": string (REQUIRED),
      "visualPriority": string,
      "panelPurpose": string,
      "environment": string,
      "symbolicElements": string[] (if symbols in beat),
      "charactersPresent": string[] (if multi-character),
      "primaryCharacter": string (if multi-character),
      "secondaryCharactersInScene": array (if applicable)
    }
  ],
  "validationResults": {
    "eisnerMomentCapture": number (0-100, must be ≥70),
    "mccloudTransitions": {
      "actionToAction": number,
      "subjectToSubject": number,
      "sceneToScene": number,
      "momentToMoment": number
    },
    "stanLeeTransformation": number (0-100, 100 if all jumps have transformation),
    "kirbyCameraEmotion": number (0-100, must be ≥85),
    "gaimanLayering": number (0-100, % with all 3 layers),
    "mooreSymbolism": number (0-100, symbolic consistency),
    "spiegelmanWeighting": number (0-100, weight distribution),
    "continuityGaps": number (must be 0),
    "allChecksPassed": boolean (must be true)
  },
  "totalPanels": number,
  "pagesRequired": number
}

CRITICAL OUTPUT RULES:
- No markdown code blocks (no \`\`\`json)
- No preamble or explanation
- Just pure valid JSON
- All REQUIRED fields must be present
- validationResults.allChecksPassed MUST be true
- NEW fields (physicalLayer, sensoryLayer, symbolicLayer, emotionalWeight) MUST be present
</output_format>

<safety_constraints>
Content MUST be appropriate for ${audience} audience:

CHILDREN (age 4-10):
- FORBIDDEN: Violence, weapons, scary monsters, death, injury, adult themes, dark imagery
- REQUIRED: Bright environments, safe situations, positive resolutions, trustworthy adults
- Challenges exciting NOT terrifying

YOUNG ADULTS (age 11-17):
- ALLOWED: Mild conflict, disappointment, complex relationships, moral challenges
- FORBIDDEN: Graphic violence, adult content, nihilistic themes
- REQUIRED: Character growth, hope, meaningful resolution

ADULTS (age 18+):
- ALLOWED: Complex psychology, moral ambiguity, realistic consequences, mature themes
- REQUIRED: Sophisticated storytelling, thematic depth, intellectual resonance
- Follow professional comic book standards (not explicit/gratuitous)
</safety_constraints>

Now analyze the story and return the validated JSON with all 7 master principles applied.`;

      const response = await this.claudeIntegration.analyzeStoryStructure(
        story,
        audience,
        analysisPrompt
      );
      
      // Validate response before proceeding
      if (!response || response.length < 10) {
        throw new Error('OpenAI returned empty or invalid response for story analysis');
      }

      // Parse response
      let parsed: any;
      try {
        // Strip markdown code blocks before parsing (Gemini returns ```json wrapping)
        let cleanedResponse = response.trim();
        cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch || !jsonMatch[0]) {
          throw new Error('No JSON found in Gemini response');
        }
        parsed = JSON.parse(jsonMatch[0]);
        
        // Validate the parsed response has required fields
        if (!parsed.storyBeats || !Array.isArray(parsed.storyBeats) || parsed.storyBeats.length === 0) {
          throw new Error('Invalid story analysis: missing or empty storyBeats array');
        }
        
        // Validate each beat has minimum required fields
        for (let i = 0; i < parsed.storyBeats.length; i++) {
          const beat = parsed.storyBeats[i];
          if (!beat || typeof beat !== 'object') {
            throw new Error(`Story beat ${i + 1} is invalid or missing`);
          }
        }
        
        this.log('info', `✅ Story analysis parsed successfully with ${parsed.storyBeats.length} beats`);

        // Enhanced validation logging for all 7 master principles
        if (parsed.validationResults) {
          if (parsed.validationResults.allChecksPassed) {
            console.log('✅ WORLD-CLASS VALIDATION: All 7 master principles passed', {
              eisner: `${parsed.validationResults.eisnerMomentCapture}%`,
              mccloud: `${parsed.validationResults.mccloudTransitions?.actionToAction || 0}% A2A`,
              stanLee: `${parsed.validationResults.stanLeeTransformation}%`,
              kirby: `${parsed.validationResults.kirbyCameraEmotion}%`,
              gaiman: `${parsed.validationResults.gaimanLayering}%`,
              moore: `${parsed.validationResults.mooreSymbolism}%`,
              spiegelman: `${parsed.validationResults.spiegelmanWeighting}%`,
              gaps: parsed.validationResults.continuityGaps
            });
          } else {
            console.warn('⚠️ Some validation checks below threshold:', {
              eisner: parsed.validationResults.eisnerMomentCapture >= 70 ? '✓' : '✗',
              mccloud: (parsed.validationResults.mccloudTransitions?.sceneToScene || 0) <= 15 ? '✓' : '✗',
              stanLee: parsed.validationResults.stanLeeTransformation >= 90 ? '✓' : '✗',
              kirby: parsed.validationResults.kirbyCameraEmotion >= 85 ? '✓' : '✗',
              gaiman: parsed.validationResults.gaimanLayering >= 60 ? '✓' : '✗',
              moore: parsed.validationResults.mooreSymbolism >= 70 ? '✓' : '✗',
              spiegelman: parsed.validationResults.spiegelmanWeighting >= 80 ? '✓' : '✗'
            });
          }
        }

        // Log symbolic elements if found
        if (parsed.symbolicElements && parsed.symbolicElements.length > 0) {
          console.log('🎨 Symbolic elements tracked:', parsed.symbolicElements.join(', '));
        }

        // Add previousBeatContext to each beat for sequential flow
        for (let i = 1; i < parsed.storyBeats.length; i++) {
          parsed.storyBeats[i].previousBeatContext = parsed.storyBeats[i - 1].beat;
          parsed.storyBeats[i].previousBeatSummary = parsed.storyBeats[i - 1].beat;
        }
        this.log('info', `✅ Added sequential context to ${parsed.storyBeats.length - 1} beats`);

        // ===== ASPECT-TO-ASPECT STRATEGIC INSERTION =====
        // After emotional peaks (weight 9-10), consider inserting frozen-moment panels
        // This creates manga-style emotional depth by showing multiple viewpoints of key moments
        const aspectToAspectConfig = {
          children: { maxInsertions: 1, minWeightTrigger: 10 },
          'young adults': { maxInsertions: 2, minWeightTrigger: 9 },
          adults: { maxInsertions: 3, minWeightTrigger: 9 }
        };
        
        const aspectConfig = aspectToAspectConfig[audience as keyof typeof aspectToAspectConfig] || aspectToAspectConfig.children;
        let aspectInsertions = 0;
        
        // Scan for high-weight beats that could benefit from aspect-to-aspect
        for (let i = parsed.storyBeats.length - 1; i >= 0 && aspectInsertions < aspectConfig.maxInsertions; i--) {
          const beat = parsed.storyBeats[i];
          const weight = beat.emotionalWeight || 5;
          
          // Only insert after climax-level beats, not at the very end
          if (weight >= aspectConfig.minWeightTrigger && i < parsed.storyBeats.length - 2) {
            // Check if next beat is NOT already aspect-to-aspect
            const nextBeat = parsed.storyBeats[i + 1];
            if (nextBeat?.transitionType !== 'aspect_to_aspect') {
              // Create aspect-to-aspect beat showing environment's reaction to the emotional moment
              const aspectBeat = {
                beatNumber: beat.beatNumber + 0.5,
                beat: `[FROZEN MOMENT] The ${beat.environment || 'scene'} itself seems to hold its breath - ${beat.symbolicLayer || 'the weight of the moment suspended in time'}`,
                emotion: beat.emotion,
                characterAction: 'frozen in the emotional moment, world paused around them',
                actionContext: 'environment reflects internal emotional state',
                physicalLayer: beat.physicalLayer,
                sensoryLayer: `Time seems to stop. ${beat.sensoryLayer || 'Every detail crystallized.'}`,
                symbolicLayer: `The world mirrors the character's ${beat.emotion} - a breath between heartbeats`,
                cameraAngle: 'wide',
                cameraReason: 'Wide angle to show environment echoing emotional state (aspect-to-aspect)',
                panelType: 'establishing_shot',
                transitionType: 'aspect_to_aspect',
                emotionalWeight: Math.max(7, weight - 1),
                dialogue: undefined,
                hasSpeechBubble: false,
                isSilent: true,
                silentReason: 'visual_impact' as const,
                locationChange: 'same',
                environment: beat.environment,
                visualPriority: 'environment',
                panelPurpose: 'emotional_echo',
                previousBeatContext: beat.beat,
                previousBeatSummary: beat.beat
              };
              
              // Insert after the high-weight beat
              parsed.storyBeats.splice(i + 1, 0, aspectBeat as any);
              aspectInsertions++;
              this.log('info', `🎭 Inserted aspect-to-aspect panel after beat ${beat.beatNumber} (weight: ${weight})`);
            }
          }
        }
        
        // Renumber beats if insertions were made
        if (aspectInsertions > 0) {
          parsed.storyBeats.forEach((beat: StoryBeat, idx: number) => {
            beat.beatNumber = idx + 1;
          });
          parsed.totalPanels = parsed.storyBeats.length;
          this.log('info', `✅ Inserted ${aspectInsertions} aspect-to-aspect panels. New total: ${parsed.totalPanels}`);
        }
      } catch (e: any) {
        // Log the actual error and response for debugging
        this.log('error', `Failed to parse story analysis: ${e.message}`);
        this.log('error', `Raw response (first 500 chars): ${response?.substring(0, 500) || 'No response'}`);
        
        // Fail fast - no fallback
        throw new Error(`Story analysis failed - unable to create high-quality story structure. Error: ${e.message}`);
      }
      
      // Validate and enhance beats
      const enrichedBeats = this.enrichStoryBeats(parsed.storyBeats || [], panelCount, audience);
      
      const storyAnalysis: StoryAnalysis = {
        storyBeats: enrichedBeats,
        characterArc: ['introduction', 'development', 'challenge', 'resolution'],
        visualFlow: parsed.visualThemes || ['establishing', 'rising action', 'climax', 'resolution'],
        totalPanels: panelCount,
        pagesRequired: PROFESSIONAL_AUDIENCE_CONFIG[audience].pagesPerStory,
        dialoguePanels: Math.floor(panelCount * 0.4),
        speechBubbleDistribution: { standard: 60, thought: 20, shout: 20 },
        emotionalArc: parsed.emotionalArc || ['curious', 'engaged', 'challenged', 'triumphant'],
        cinematicQuality: true,
        // NEW: 7 Master Principles data
        storyArchetype: parsed.storyArchetype,
        thematicElements: parsed.thematicElements,
        symbolicElements: parsed.symbolicElements,
        validationResults: parsed.validationResults
      };
      
      this.log('info', `✅ Created ${storyAnalysis.storyBeats.length} CINEMATIC story beats with rich visual detail`);
      return storyAnalysis;
    },
    'analyzeStoryStructure'
  );

  if (result.success) {
    return result.data;
  } else {
    throw result.error;
  }
}

/**
 * Enrich story beats with additional cinematic details
 * QUALITY STANDARD: No generic beats - AI must provide complete analysis
 */
private enrichStoryBeats(beats: any[], targetCount: number, audience: AudienceType): StoryBeat[] {
  // Validate we have beats
  if (!Array.isArray(beats) || beats.length === 0) {
    throw new Error('QUALITY FAILURE: No story beats provided by AI. Cannot proceed without real story analysis. Job must fail.');
  }
  
  // Get config for range validation (Design by Contract principle)
  const config = PROFESSIONAL_AUDIENCE_CONFIG[audience];
  const minRequired = config.minPanels;
  const maxAllowed = config.maxPanels;

  // Validate beat count is within acceptable range - NO PADDING with generic content
  if (beats.length < minRequired) {
    throw new Error(`QUALITY FAILURE: AI provided ${beats.length} story beats but minimum ${minRequired} are required for ${audience} audience. Story is too simple. AI must create more complex narrative. Job must fail.`);
  }

  if (beats.length > maxAllowed) {
    console.warn(`⚠️ AI provided ${beats.length} beats, exceeding maximum ${maxAllowed}. Trimming to ${maxAllowed} beats.`);
    beats = beats.slice(0, maxAllowed);
  }

  // Update targetCount to actual beat count (within range)
  targetCount = beats.length;
  
  // Validate and map beats - fail if critical fields are missing
  return beats.slice(0, targetCount).map((beat, index) => {
    if (!beat.beat || beat.beat.length < 10) {
      throw new Error(`QUALITY FAILURE: Story beat ${index + 1} has invalid description "${beat.beat}". Job must fail.`);
    }
    
    return {
      beat: beat.beat,
      imagePrompt: beat.imagePrompt || beat.beat, // imagePrompt can fall back to beat description
      emotion: beat.emotion || this.determineEmotionForBeat(index, targetCount),
      characterAction: beat.characterAction || 'interacting with scene',
      visualPriority: beat.visualPriority || 'character-full',
      environment: beat.environment || 'story setting',
      panelPurpose: beat.panelPurpose || this.determinePanelPurpose(index, targetCount),
      narrativeFunction: beat.panelPurpose || this.determinePanelPurpose(index, targetCount),
      cameraAngle: beat.cameraAngle || this.determineCameraAngle(index, targetCount),
      cameraReason: beat.cameraReason || undefined,  // NEW: AI's explanation for camera choice
      locationChange: beat.locationChange || undefined,  // NEW: Scene change indicator
      lightingNote: beat.lightingNote || 'cinematic lighting',
      compositionNote: beat.compositionNote || 'rule of thirds composition',
      hasSpeechBubble: beat.hasSpeechBubble || false,
      dialogue: beat.dialogue,
      speechBubbleStyle: beat.speechBubbleStyle || 'standard',
      // NEW: AI-driven speech bubble positioning
      speakerName: beat.speakerName || undefined,
      speakerPosition: beat.speakerPosition || undefined,
      bubblePosition: beat.bubblePosition || undefined,
      previousBeatContext: index > 0 ? beats[index - 1].beat : null,
      previousBeatSummary: index > 0 ? beats[index - 1].beat : null
    };
  });
}

private createCinematicBeat(index: number, total: number, audience: AudienceType): any {
  // NO GENERIC BEATS - quality standard requires AI-generated content
  throw new Error('QUALITY FAILURE: Cannot create generic cinematic beat. AI must provide all story beats. Job must fail.');
}

private generateCinematicPrompt(index: number, total: number, audience: AudienceType): string {
  const position = index / total;
  const shotTypes = ['wide establishing shot', 'medium character shot', 'close-up emotional shot', 'action shot', 'reaction shot'];
  const shot = shotTypes[index % shotTypes.length];
  
  return `${shot} with rich environmental detail, professional composition, cinematic lighting, 
          ${audience === 'children' ? 'bright cheerful colors' : 'sophisticated color grading'}, 
          clear focal point, depth of field, atmospheric perspective`;
}

private determineEmotionForBeat(index: number, total: number): string {
  const position = index / total;
  if (position < 0.2) return 'curious';
  if (position < 0.4) return 'engaged';
  if (position < 0.6) return 'challenged';
  if (position < 0.8) return 'determined';
  return 'satisfied';
}

private determinePanelPurpose(index: number, total: number): string {
  const position = index / total;
  if (position < 0.15) return 'establish';
  if (position < 0.7) return 'develop';
  if (position < 0.85) return 'climax';
  return 'resolve';
}

private determineCameraAngle(index: number, total: number): string {
  const angles = ['wide', 'medium', 'close-up', 'over-shoulder', 'low-angle', 'high-angle', 'dutch-angle'];
  return angles[index % angles.length];
}

  /**
   * Calculate advanced quality metrics for generated comic
   * FIXED: Uses inherited error handling
   */
  async calculateQualityMetrics(
    generatedPanels: any[],
    originalContext: {
      characterDNA?: CharacterDNA;
      environmentalDNA?: EnvironmentalDNA;
      storyAnalysis?: StoryAnalysis;
      targetAudience: AudienceType;
      artStyle: string;
    }
  ): Promise<any> {
    const result = await this.withErrorHandling(
      async () => {
        return await this.qualityEngine.calculateAdvancedQualityMetrics(
          generatedPanels,
          originalContext
        );
      },
      'calculateQualityMetrics'
    );

    if (result.success) {
      return result.data;
    } else {
      throw result.error;
    }
  }

  /**
   * Generate quality recommendations based on metrics
   * FIXED: No error handling needed for this utility method
   */
  generateQualityRecommendations(qualityMetrics: any): string[] {
    const recommendations: string[] = [];
    
    if (qualityMetrics.characterConsistency < 80) {
      recommendations.push('Improve character consistency with Visual DNA system');
    }
    
    if (qualityMetrics.narrativeCoherence < 80) {
      recommendations.push('Strengthen narrative structure with story intelligence');
    }
    
    if (qualityMetrics.visualQuality < 80) {
      recommendations.push('Enhance visual composition and art quality');
    }
    
    return recommendations;
  }

  /**
   * Store successful pattern for learning
   * FIXED: Uses inherited error handling
   */
  async storeSuccessfulPattern(
    context: any,
    results: any,
    qualityScores: QualityMetrics,
    userRatings?: any[]
  ): Promise<boolean> {
    const result = await this.withErrorHandling(
      async () => {
        await this.learningEngine.storeSuccessfulPattern(context, results, qualityScores, userRatings);
        return true;
      },
      'storeSuccessfulPattern'
    );

    if (result.success) {
      return result.data;
    } else {
      this.log('error', 'Failed to store successful pattern:', result.error);
      return false;
    }
  }

  /**
   * Evolve prompts from successful patterns
   * FIXED: Uses inherited error handling
   */
  async evolvePromptsFromPatterns(
    currentContext: any,
    pastSuccesses: any[]
  ): Promise<any> {
    const result = await this.withErrorHandling(
      async () => {
        return await this.learningEngine.evolvePromptsFromPatterns(currentContext, pastSuccesses);
      },
      'evolvePromptsFromPatterns'
    );

    if (result.success) {
      return result.data;
    } else {
      throw result.error;
    }
  }

  /**
   * Find similar success patterns for learning
   * FIXED: Uses inherited error handling
   */
  async findSimilarSuccessPatterns(
    context: {
      audience: string;
      genre?: string;
      artStyle: string;
      environmentalSetting?: string;
      characterType?: string;
    },
    limit?: number
  ): Promise<any[]> {
    const result = await this.withErrorHandling(
      async () => {
        // This would typically query a database of success patterns
        // For now, return empty array as placeholder
        return [];
      },
      'findSimilarSuccessPatterns'
    );

    if (result.success) {
      return result.data;
    } else {
      this.log('error', 'Failed to find similar patterns:', result.error);
      return [];
    }
  }

  // ===== ENTERPRISE MONITORING AND HEALTH =====

  /**
   * Check service health across all modular components
   * FIXED: Uses inherited error handling
   */
  isHealthy(): boolean {
    try {
      if (!this._isInitialized) return false;
      return this.enterpriseMonitoring?.isHealthy?.() ?? false;
    } catch (error) {
      this.log('error', 'Health check failed:', error);
      return false;
    }
  }

  /**
   * Get comprehensive metrics across all systems
   * FIXED: No error handling needed for this getter method
   */
  getComprehensiveMetrics(): ComprehensiveMetrics {
    try {
      return this.enterpriseMonitoring.getComprehensiveMetrics();
    } catch (error) {
      this.log('error', 'Failed to get comprehensive metrics:', error);
      throw error;
    }
  }

  /**
   * Get service registration information
   * FIXED: No error handling needed for this getter method
   */
  getServiceRegistration(): ServiceRegistration {
    return this.enterpriseMonitoring.getServiceRegistration();
  }

  /**
   * Validate service readiness for production use
   * FIXED: Uses inherited error handling
   */
  async validateReadiness(): Promise<boolean> {
    const result = await this.withErrorHandling(
      async () => {
        return await this.enterpriseMonitoring.validateServiceReadiness();
      },
      'validateReadiness'
    );

    if (result.success) {
      return result.data;
    } else {
      this.log('error', 'Readiness validation failed:', result.error);
      return false;
    }
  }

  // ===== LIFECYCLE MANAGEMENT =====

  /**
   * Graceful service shutdown
   */
  protected async disposeService(): Promise<void> {
    this.log('info', '🔄 Starting graceful service shutdown...');
    
    try {
      // Comprehensive resource cleanup
      if (this.enterpriseMonitoring) {
        this.enterpriseMonitoring.shutdown();
      }
      
      // OpenAI Integration doesn't have a dispose method, just clear references
      // No cleanup needed for OpenAI Integration
      
      // Safe cleanup of engine references
      if (this.learningEngine) {
        this.learningEngine = undefined as any;
      }
      
      if (this.qualityEngine) {
        this.qualityEngine = undefined as any;
      }
      
      // Clear any remaining references
      this.errorHandlerAdapter = null as any;
      
      this._isInitialized = false;
      this.log('info', '✅ Service shutdown completed with full resource cleanup');

    } catch (error) {
      this.log('error', 'Error during shutdown:', error);
      throw error;
    }
  }

  // ===== HEALTH CHECK OVERRIDE =====

  protected async checkServiceHealth(): Promise<boolean> {
    try {
      if (!this.isInitialized) return false;
      return this.enterpriseMonitoring ? this.enterpriseMonitoring.isHealthy() : false;
    } catch (error) {
      return false;
    }
  }

  // ===== UTILITY METHODS =====

  getName(): string {
    return 'ModularEnterpriseAIService';
  }

  getVersion(): string {
    return AI_SERVICE_VERSION_INFO.version;
  }

  getUptime(): string {
    const uptimeMs = Date.now() - this.startTime;
    const uptimeSeconds = Math.floor(uptimeMs / 1000);
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  // ===== INTERFACE ALIASES FOR IAIService COMPATIBILITY =====
  async generateStory(prompt: string, options?: any): Promise<string> {
    const storyOptions: StoryGenerationOptions = {
      genre: options?.genre || 'adventure',
      characterDescription: options?.characterDescription || '',
      audience: options?.audience || 'children'
    };
    
    const result = await this.generateStoryWithOptions(storyOptions);
    const resolvedResult = await result;
    // FIXED: Proper data access pattern with await
    if (resolvedResult && 'success' in resolvedResult && resolvedResult.success) {
      return JSON.stringify((resolvedResult as any).data);
    }
    return '';
  }

  async generateCartoonImage(prompt: string): Promise<AsyncResult<string, AIServiceUnavailableError>> {
    const cartoonResult = await this.cartoonizeImage({ prompt, style: 'cartoon' });
    
    // FIXED: Convert AsyncResult<CartoonizeResult> to AsyncResult<string>
    return new AsyncResult(cartoonResult.toPromise().then(result => {
      if (result.success) {
        return Result.success(result.data.url);
      } else {
        return Result.failure(result.error);
      }
    }));
  }

  generateSceneImage = this.generateImages;

  /**
   * Generate panel with enhanced guidance for failed panel regeneration
   * CRITICAL: Used when a panel fails validation and needs regeneration with specific fixes
   * This returns an actual Cloudinary URL (not text!)
   * ENHANCED: Added multi-character support with mainCharacterName and secondaryCharacters
   */
  async generatePanelWithEnhancedGuidance(options: {
    cartoonImageUrl: string;
    sceneDescription: string;
    emotion: string;
    enhancedGuidance: string;
    artStyle: string;
    panelType?: string;
    cameraAngle?: string;
    lighting?: string;
    backgroundComplexity?: string;
    environmentalContext?: {
      characterDNA?: any;
      environmentalDNA?: any;
      panelNumber?: number;
      totalPanels?: number;
    };
    mainCharacterName?: string;  // NEW: Multi-character support
    secondaryCharacters?: any[];  // NEW: Secondary characters for panel rendering
  }): Promise<AsyncResult<{ url: string }, AIServiceUnavailableError>> {
    const startTime = Date.now();
    
    const resultPromise = this.withErrorHandling(
      async () => {
        this.log('info', '🔄 Generating panel with enhanced guidance for regeneration...');
        
        // ✅ Use Gemini's enhanced guidance method (returns Cloudinary URL)
        // ✅ CRITICAL: Pass environmentalContext for environmental consistency enforcement
        // ✅ NEW: Pass multi-character context for consistent rendering
        const imageUrl = await this.geminiIntegration.generatePanelWithEnhancedGuidance(
          options.cartoonImageUrl,
          options.sceneDescription,
          options.emotion,
          options.enhancedGuidance,
          {
            artStyle: options.artStyle,
            cameraAngle: options.cameraAngle,
            lighting: options.lighting,
            panelType: options.panelType,
            backgroundComplexity: options.backgroundComplexity,
            temperature: 0.6,
            // ✅ Pass environmental context for MANDATORY enforcement in regeneration
            environmentalContext: options.environmentalContext,
            // ✅ NEW: Pass multi-character context
            mainCharacterName: options.mainCharacterName,
            secondaryCharacters: options.secondaryCharacters
          }
        );
        
        const duration = Date.now() - startTime;
        this.enterpriseMonitoring.recordOperationMetrics('generatePanelWithEnhancedGuidance', duration, true);
        
        // ✅ VALIDATION: Ensure we got a valid Cloudinary URL, not text
        if (!imageUrl || !imageUrl.includes('cloudinary.com')) {
          this.log('error', `Invalid image URL returned: ${imageUrl?.substring(0, 100)}`);
          throw new Error('Enhanced panel generation returned invalid URL instead of Cloudinary image');
        }
        
        this.log('info', `✅ Enhanced panel generated: ${imageUrl.substring(0, 60)}...`);
        
        return { url: imageUrl };
      },
      'generatePanelWithEnhancedGuidance',
      options
    );

    return new AsyncResult(resultPromise.then(result => {
      if (result.success) {
        return Result.success(result.data);
      } else {
        const duration = Date.now() - startTime;
        this.enterpriseMonitoring.recordOperationMetrics('generatePanelWithEnhancedGuidance', duration, false);
        const aiError = new AIServiceUnavailableError(result.error.message, {
          service: this.getName(),
          operation: 'generatePanelWithEnhancedGuidance'
        });
        return Result.failure(aiError);
      }
    }));
  }
  
  async describeCharacter(imageUrl: string, prompt: string): Promise<AsyncResult<string, AIServiceUnavailableError>>;
  async describeCharacter(options: CharacterDescriptionOptions): Promise<AsyncResult<CharacterDescriptionResult, AIServiceUnavailableError>>;
  async describeCharacter(imageUrlOrOptions: string | CharacterDescriptionOptions, prompt?: string): Promise<any> {
    if (typeof imageUrlOrOptions === 'string') {
      const descriptionResult = await this.createCharacterDescription({ imageUrl: imageUrlOrOptions, style: 'comic-book' });
      
      // FIXED: Convert AsyncResult<CharacterDescriptionResult> to AsyncResult<string>
      return new AsyncResult(descriptionResult.toPromise().then(result => {
        if (result.success) {
          return Result.success(result.data.description);
        } else {
          return Result.failure(result.error);
        }
      }));
    } else {
      return this.createCharacterDescription(imageUrlOrOptions);
    }
  }
}

// ===== EXPORT CONFIGURATIONS =====

/**
 * Create enterprise AI service instance with optimal configuration
 */
export function createEnterpriseAIService(config?: Partial<AIServiceConfig>): AIService {
  const enterpriseConfig: Partial<AIServiceConfig> = {
    enableAdvancedNarrative: true,
    enableVisualDNAFingerprinting: true,
    enablePredictiveQuality: true,
    enableCrossGenreLearning: true,
    maxRetries: 1,
    retryDelay: 1000,
    timeout: 120000,
    ...config
  };
  
  return new AIService(enterpriseConfig);
}

/**
 * Initialize enterprise AI service with validation
 */
export async function initializeEnterpriseAIService(config?: Partial<AIServiceConfig>): Promise<AIService> {
  const service = createEnterpriseAIService(config);
  
  try {
    await service.initialize();
    
    const isReady = await service.validateReadiness();
    if (!isReady) {
      throw new AIServiceUnavailableError('Enterprise AI service failed readiness validation');
    }
    
    console.log('🚀 Enterprise AI Service successfully initialized and validated');
    console.log(`📊 Version: ${service.getVersion()}`);
    console.log(`🎯 Features: ${AI_SERVICE_ENTERPRISE_CONSTANTS.FEATURES.length} advanced capabilities`);
    
    return service;
  } catch (error) {
    console.error('❌ Failed to initialize Enterprise AI Service:', error);
    throw error;
  }
}

// Export the main class and factory functions
export default AIService;
export { AIService };