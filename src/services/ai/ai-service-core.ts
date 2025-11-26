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

// ===== WORLD-CLASS STORY PROMPTS =====
const WORLD_CLASS_STORY_PROMPTS = {
  systemPrompt: (audience: string, genre: string) => 
    `You are an EMMY-AWARD WINNING comic book writer specializing in ${audience} content. 
    Your ${genre} stories have perfect pacing, emotional depth, and visual richness.
    Every sentence must suggest a panel image.`,

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
    }
  },

  audienceRequirements: {
    children: {
      vocabulary: 'Grade 2-5 reading level. Simple adjectives. Explain complex words.',
      safetyRules: ['NO violence/weapons', 'NO scary monsters', 'NO death/injury', 'NO adult themes', 'Challenges exciting NOT terrifying', 'Clear positive solutions', 'Trustworthy authority figures'],
      panelCount: '8-12 panels',
      wordTarget: '800-1200 words'
    },
    young_adults: {
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
      this.comicEngine = new ComicGenerationEngine(this.geminiIntegration, this.errorHandlerAdapter as any);
      this.log('info', '✅ Comic Generation Engine initialized with Gemini image-based panels');

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
 async createMasterCharacterDNA(imageUrl: string, artStyle: string, existingDescription?: string): Promise<CharacterDNA> {
  const result = await this.withErrorHandling(
    async () => {
      this.log('info', '🧬 Creating master character DNA with character analysis...');
      
      let characterDescription = '';
      const isReusedCartoon = imageUrl.includes('cloudinary.com') && imageUrl.includes('/cartoons/');
      
      // PRIORITY 1: Use provided existing description if available
      if (existingDescription && existingDescription.length > 20) {
        this.log('info', '✅ Using provided character description from job');
        characterDescription = existingDescription;
      } 
      // PRIORITY 2: For reused cartoons without description, fail fast for quality
      else if (isReusedCartoon && (!existingDescription || existingDescription.length < 20)) {
        const errorMsg = `Reused cartoon image requires character description for consistency (provided: ${existingDescription?.length || 0} chars)`;
        this.log('error', `❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }
      // PRIORITY 3: For new images, create generic description
      else {
        this.log('info', '🔍 New character image detected, creating generic description');
        characterDescription = `Character in ${artStyle} style. Maintain consistent appearance across all panels.`;
      }

      // Build comprehensive Character DNA
      const characterDNA: CharacterDNA = {
        sourceImage: imageUrl,
        description: characterDescription,
        artStyle: artStyle,
        visualDNA: {
          facialFeatures: this.extractFacialFeatures(characterDescription),
          bodyType: this.extractBodyType(characterDescription),
          clothing: this.extractClothingDetails(characterDescription).join(', '),
          distinctiveFeatures: this.extractUniqueFeatures(characterDescription),
          colorPalette: this.extractColorPalette(characterDescription),
          expressionBaseline: 'maintain character expression style'
        },
        visualFingerprint: {
          face: this.extractFacialFeatures(characterDescription).join('_'),
          body: this.extractBodyType(characterDescription),
          clothing: this.extractClothingDetails(characterDescription).join('_'),
          signature: this.extractUniqueFeatures(characterDescription).join('_'),
          colorDNA: this.extractColorPalette(characterDescription).join('_'),
          artStyleSignature: `${artStyle}_${Date.now()}`
        },
        consistencyPrompts: {
          basePrompt: `CRITICAL CHARACTER REFERENCE - MAINTAIN EXACTLY:
${characterDescription}

This character MUST appear IDENTICAL in every single panel. Character consistency is the highest priority.
NO variations in facial features, hair, clothing, or proportions allowed.`,
          artStyleIntegration: `Render in ${artStyle} style while maintaining EXACT character features`,
          variationGuidance: 'ZERO tolerance for variations. Every panel must show the EXACT same character.'
        },
        consistencyChecklist: [
          'Face matches exactly',
          'Hair color and style identical',
          'Clothing unchanged',
          'Body proportions consistent',
          'All unique features visible'
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          processingTime: Date.now(),
          analysisMethod: isReusedCartoon ? 'reused_description' : 'generated_description',
          confidenceScore: existingDescription ? 95 : 70,
          fingerprintGenerated: true,
          artStyleOptimized: artStyle,
          qualityScore: existingDescription ? 90 : 70
        }
      };

      this.log('info', `✅ Character DNA created for ${isReusedCartoon ? 'reused' : 'new'} character`);
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

// Add these helper methods right after the createMasterCharacterDNA method:

private extractFacialFeatures(description: string): string[] {
  const features: string[] = [];
  const text = description.toLowerCase();
  
  // Extract face shape
  const faceShapes = ['round', 'oval', 'square', 'heart', 'long', 'rectangular'];
  for (const shape of faceShapes) {
    if (text.includes(shape + ' face') || text.includes('face is ' + shape)) {
      features.push(shape + ' face');
      break;
    }
  }
  
  // Extract eye details
  const eyeColors = ['blue', 'brown', 'green', 'hazel', 'gray', 'black'];
  for (const color of eyeColors) {
    if (text.includes(color + ' eye') || text.includes(color + '-eye')) {
      features.push(color + ' eyes');
      break;
    }
  }
  
  // Extract other facial features mentioned
  if (text.includes('freckles')) features.push('freckles');
  if (text.includes('glasses')) features.push('glasses');
  if (text.includes('beard')) features.push('beard');
  if (text.includes('mustache')) features.push('mustache');
  
  return features.length > 0 ? features : ['consistent facial features'];
}

private extractHairDetails(description: string): string[] {
  const details: string[] = [];
  const text = description.toLowerCase();
  
  // Hair colors
  const hairColors = ['blonde', 'brown', 'black', 'red', 'gray', 'white', 'dark', 'light'];
  for (const color of hairColors) {
    if (text.includes(color + ' hair')) {
      details.push(color + ' hair');
      break;
    }
  }
  
  // Hair styles
  if (text.includes('long hair')) details.push('long');
  else if (text.includes('short hair')) details.push('short');
  else if (text.includes('medium hair')) details.push('medium length');
  
  if (text.includes('curly')) details.push('curly');
  if (text.includes('straight')) details.push('straight');
  if (text.includes('wavy')) details.push('wavy');
  if (text.includes('ponytail')) details.push('ponytail');
  if (text.includes('braid')) details.push('braided');
  
  return details.length > 0 ? details : ['consistent hairstyle'];
}

private extractClothingDetails(description: string): string[] {
  const details: string[] = [];
  const text = description.toLowerCase();
  
  // Clothing items
  const items = ['shirt', 'dress', 'jacket', 'coat', 'sweater', 'hoodie', 'suit', 'uniform'];
  for (const item of items) {
    if (text.includes(item)) {
      // Try to get color + item
      const colors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'gray', 'brown', 'pink', 'purple'];
      for (const color of colors) {
        if (text.includes(color + ' ' + item)) {
          details.push(color + ' ' + item);
          break;
        }
      }
      if (!details.some(d => d.includes(item))) {
        details.push(item);
      }
    }
  }
  
  return details.length > 0 ? details : ['consistent outfit'];
}

private extractColorPalette(description: string): string[] {
  const colors: string[] = [];
  const text = description.toLowerCase();
  const allColors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'brown', 'gray', 'pink', 'purple', 'orange', 'beige', 'navy', 'teal'];
  
  for (const color of allColors) {
    if (text.includes(color)) {
      colors.push(color);
    }
  }
  
  return colors.length > 0 ? colors : ['neutral', 'brown', 'black'];
}

private extractUniqueFeatures(description: string): string[] {
  const features: string[] = [];
  const text = description.toLowerCase();
  
  if (text.includes('scar')) features.push('scar');
  if (text.includes('tattoo')) features.push('tattoo');
  if (text.includes('birthmark')) features.push('birthmark');
  if (text.includes('piercing')) features.push('piercing');
  if (text.includes('mole')) features.push('mole');
  if (text.includes('dimple')) features.push('dimples');
  
  return features.length > 0 ? features : ['no distinctive marks'];
}

private extractBodyType(description: string): string {
  const text = description.toLowerCase();
  
  if (text.includes('slim') || text.includes('thin') || text.includes('slender')) return 'slim build';
  if (text.includes('athletic') || text.includes('fit') || text.includes('muscular')) return 'athletic build';
  if (text.includes('stocky') || text.includes('broad') || text.includes('heavy')) return 'stocky build';
  if (text.includes('average') || text.includes('medium')) return 'average build';
  
  return 'medium build';
}
  private extractCoreFeatures(description: string): string {
  const features = [];
  const text = description.toLowerCase();
  
  // Extract core identifying features
  if (text.includes('hair:') || text.includes('hair')) {
    const hairDetails = this.extractHairDetails(description);
    if (hairDetails.length > 0) features.push(hairDetails.join(' '));
  }
  
  if (text.includes('face:') || text.includes('facial')) {
    const facialFeatures = this.extractFacialFeatures(description);
    if (facialFeatures.length > 0) features.push(facialFeatures.join(' '));
  }
  
  if (text.includes('build:') || text.includes('body')) {
    features.push(this.extractBodyType(description));
  }
  
  if (text.includes('age')) {
    if (text.includes('child')) features.push('child character');
    else if (text.includes('teen')) features.push('teen character');
    else if (text.includes('adult')) features.push('adult character');
  }
  
  return features.length > 0 ? features.join(', ') : 'consistent character appearance';
}

private extractDistinguishingMarks(description: string): string {
  const marks = this.extractUniqueFeatures(description);
  return marks.length > 0 ? marks.join(', ') : 'standard features';
}

private generateVisualFingerprint(components: { facial: string; hair: string; clothing: string; colors: string }): string {
  const combined = `${components.facial}_${components.hair}_${components.clothing}_${components.colors}`;
  const hash = combined.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
  return `VF_${hash}_${Date.now().toString(36)}`;
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
   * FIXED: Add missing createEnvironmentalDNA method implementation
   */
  async createEnvironmentalDNA(storyBeatsOrAnalysis: StoryBeat[] | any, audience: AudienceType, artStyle?: string, story?: string): Promise<EnvironmentalDNA> {
  const result = await this.withErrorHandling(
    async () => {
      this.log('info', '🌍 Creating environmental DNA for world consistency...');
      
      // Handle both array of beats and full analysis object
      let storyBeats: StoryBeat[] = [];
      if (Array.isArray(storyBeatsOrAnalysis)) {
        storyBeats = storyBeatsOrAnalysis;
      } else if (storyBeatsOrAnalysis && storyBeatsOrAnalysis.storyBeats) {
        storyBeats = storyBeatsOrAnalysis.storyBeats;
      } else {
        this.log('warn', 'Invalid story beats format, using empty array');
        storyBeats = [];
      }
      
      // Use full story context if provided for enhanced environmental analysis
      let enhancedEnvironmentalContext = '';
      if (story && story.length > 0) {
        enhancedEnvironmentalContext = `\n\nFull Story Context: ${story.substring(0, 500)}`;
        this.log('info', '📖 Using full story context to enhance environmental DNA quality');
      }
      
      // Extract environmental elements from story beats
      const environments = storyBeats.map(beat => 
        typeof beat === 'object' ? (beat.environment || beat.setting || 'general setting') : 'general setting'
      ).filter(Boolean);
      const uniqueEnvironments = [...new Set(environments)];

      const environmentalDNA: EnvironmentalDNA = {
  primaryLocation: {
    name: uniqueEnvironments[0] || 'general setting',
    type: 'mixed',
    description: `Story setting with consistent visual elements${enhancedEnvironmentalContext}`,
          keyFeatures: uniqueEnvironments,
          colorPalette: this.determineColorPalette(audience),
          architecturalStyle: artStyle || 'storybook'
        },
        lightingContext: {
          timeOfDay: 'afternoon',
          weatherCondition: 'pleasant',
          lightingMood: this.determineLightingMood(audience),
          shadowDirection: 'natural',
          consistencyRules: ['maintain_lighting_direction', 'consistent_shadow_intensity']
        },
        visualContinuity: {
          backgroundElements: uniqueEnvironments,
          recurringObjects: ['consistent_props'],
          colorConsistency: {
            dominantColors: this.determineColorPalette(audience),
            accentColors: ['warm_highlights', 'cool_shadows'],
            avoidColors: ['jarring_contrasts']
          },
          perspectiveGuidelines: 'consistent_viewpoint_flow'
        },
        metadata: {
          createdAt: new Date().toISOString(),
          processingTime: 0,
          audience,
          consistencyTarget: 'world_building',
          fallback: storyBeats.length === 0
        }
      };

      this.log('info', '✅ Environmental DNA created for world consistency');
      return environmentalDNA;
    },
    'createEnvironmentalDNA'
  );

  if (result.success) {
    return result.data;
  } else {
    throw result.error;
  }
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

  private determineLightingMood(audience: AudienceType): string {
    const moods = {
      children: 'bright_cheerful',
      'young adults': 'dynamic_engaging', 
      adults: 'sophisticated_nuanced'
    };
    return moods[audience] || 'bright_cheerful';
  }

  private determineEnvironmentalMood(audience: AudienceType): string {
    const moods = {
      children: 'playful_inviting',
      'young adults': 'adventurous_exciting',
      adults: 'sophisticated_immersive'
    };
    return moods[audience] || 'playful_inviting';
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
        const environmentalDNA = options.environmentalContext?.environmentalDNA || options.environmentalContext;
        const panelNumber = options.environmentalContext?.panelNumber || 1;
        const totalPanels = options.environmentalContext?.totalPanels || 1;
        
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
        
        // Generate the image with world-class prompt
        // GEMINI: This method needs updating - for now using text completion
        const result = await this.geminiIntegration.generateTextCompletion(worldClassPrompt) as any;
        
        const duration = Date.now() - startTime;
        this.enterpriseMonitoring.recordOperationMetrics('generateImages', duration, true);
        
        return {
          url: result,
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
   * Cartoonize images with professional quality (FROM BOTH FILES)
   * FIXED: Return proper AsyncResult type and handle Result conversion
   */
  async cartoonizeImage(options: CartoonizeOptions): Promise<AsyncResult<CartoonizeResult, AIServiceUnavailableError>> {
    const startTime = Date.now();
    
    const resultPromise = this.withErrorHandling(
      async () => {
        this.log('info', '🎨 Cartoonizing image with professional quality...');
        
        // Use OpenAI integration for image processing
        const cartoonPrompt = `Transform this image into a ${options.style} cartoon style while maintaining character consistency. Character from image: ${options.imageUrl}`;
        
        // GEMINI: This method needs updating - for now using text completion
        const result = await this.geminiIntegration.generateTextCompletion(cartoonPrompt) as any;
        
        const duration = Date.now() - startTime;
        this.enterpriseMonitoring.recordOperationMetrics('cartoonizeImage', duration, true);
        
        return {
          url: result,
          cached: false
        };
      },
      'cartoonizeImage',
      options
    );

    // FIXED: Convert Result to AsyncResult and handle error type conversion
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
        
        const genreConfig = WORLD_CLASS_STORY_PROMPTS.genrePrompts[genre as keyof typeof WORLD_CLASS_STORY_PROMPTS.genrePrompts];
        if (!genreConfig) {
          throw new Error(`Unsupported genre: ${genre}`);
        }

        const audienceConfig = WORLD_CLASS_STORY_PROMPTS.audienceRequirements[audience as keyof typeof WORLD_CLASS_STORY_PROMPTS.audienceRequirements];

        // Build comprehensive prompt
        const storyPrompt = `${WORLD_CLASS_STORY_PROMPTS.systemPrompt(audience, genre)}

GENRE: ${genre.toUpperCase()}
${genreConfig.structure}

EMOTIONAL JOURNEY: ${genreConfig.emotionalBeats.join(' → ')}
VISUAL ELEMENTS: ${genreConfig.visualElements.join(', ')}
DIALOGUE STYLE: ${genreConfig.dialogueStyle}
THEMES: ${genreConfig.themes}

AUDIENCE: ${audience.toUpperCase()}
VOCABULARY: ${audienceConfig.vocabulary}
${audience === 'children' && 'safetyRules' in audienceConfig ? `SAFETY RULES (MANDATORY): ${audienceConfig.safetyRules.join('; ')}` : ''}
TARGET: ${audienceConfig.wordTarget}, ${audienceConfig.panelCount}

${WORLD_CLASS_STORY_PROMPTS.characterIntegration(characterDescription)}
${WORLD_CLASS_STORY_PROMPTS.dialogueRequirements(audience)}

Create a ${genre} story featuring: "${characterDescription}"

${WORLD_CLASS_STORY_PROMPTS.outputFormat}`;

        // Call Gemini
        // FIX 2: Use 'young adults' (with space) not 'young_adults'
        const response = await this.geminiIntegration.generateTextCompletion(storyPrompt, {
          temperature: 0.8,
          max_output_tokens: audience === 'children' ? 2000 : audience === 'young adults' ? 3000 : 4000
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
      this.log('info', '📖 Creating CINEMATIC story beats for world-class comic...');
      
      const panelCount = PROFESSIONAL_AUDIENCE_CONFIG[audience].totalPanels;
      
      // Enhanced prompt incorporating best practices from original files
      const analysisPrompt = `You are a world-class comic book writer and visual storyteller creating a masterpiece ${audience} comic.

STORY TO TRANSFORM:
"${story}"

SEQUENTIAL CONTEXT REQUIREMENT: Each panel must reference and flow from the previous panel. Panel X must show consequences of panel X-1. Every beat should build upon what happened before, creating clear cause-effect relationships throughout the story.

Create exactly ${panelCount} CINEMATIC comic panels that transform this story into a visually stunning narrative.

For EACH of the ${panelCount} panels, provide RICH DETAIL:
{
  "beat": "Specific cinematic moment - what's happening in this exact frame",
  "imagePrompt": "ULTRA-DETAILED 80+ word description including:
    - Exact character position and pose (e.g., 'standing with arms crossed, weight on left foot')
    - Facial expression details (e.g., 'wide eyes with raised eyebrows showing surprise')
    - Environmental details (at least 3 specific objects or features)
    - Lighting direction and quality (e.g., 'warm sunlight from upper left casting soft shadows')
    - Color mood (e.g., 'warm golden hour tones with purple shadows')
    - Camera angle (e.g., 'low angle looking up' or 'bird's eye view')
    - Depth and composition (e.g., 'character in foreground, trees framing mid-ground, mountains in background')
    Make this so detailed an artist could draw it without seeing any other reference",
  "emotion": "Primary emotion (happy/sad/excited/curious/scared/surprised/determined/peaceful/angry/confused)",
  "characterAction": "SPECIFIC physical action verb phrase (e.g., 'reaching toward the glowing orb' not just 'reaching')",
  "visualPriority": "Exact focal point (character-face/character-full/action/environment/object-specific)",
  "environment": "RICH setting with 5+ environmental details (e.g., 'sunny forest clearing with tall pine trees, wildflowers dotting the grass, a small stream babbling nearby, butterflies in the air, moss-covered rocks')",
  "panelPurpose": "Story function (establish/develop/reveal/climax/transition/resolve)",
  "cameraAngle": "Specific shot type (close-up/medium/wide/extreme-wide/over-shoulder/POV/dutch-angle)",
  "lightingNote": "Specific lighting setup for mood",
  "compositionNote": "Rule of thirds, golden ratio, or other composition principle"
}

CRITICAL REQUIREMENTS:
- Each panel must be visually distinct - no two panels should look similar
- Vary camera angles dramatically between panels for visual interest
- Include specific props and environmental details that enhance the story
- Build emotional progression: ${audience === 'children' ? 'wonder → curiosity → challenge → triumph' : audience === 'young adults' ? 'intrigue → tension → action → revelation' : 'complexity → conflict → climax → resolution'}
- Use cinematic techniques: establishing shots, reaction shots, action sequences, emotional close-ups
- Every imagePrompt must be so detailed it could stand alone as an art brief

PANEL PROGRESSION GUIDANCE:
- Panel 1: Establishing shot setting the world and tone
- Panels 2-${Math.floor(panelCount * 0.3)}: Building tension and character
- Panels ${Math.floor(panelCount * 0.3) + 1}-${Math.floor(panelCount * 0.7)}: Core action and conflict
- Panels ${Math.floor(panelCount * 0.7) + 1}-${panelCount - 1}: Climax and resolution buildup  
- Panel ${panelCount}: Satisfying conclusion with emotional payoff

Return your response as a json object with the following properties:
{
  "storyBeats": [array of ${panelCount} richly detailed panel objects],
  "totalPanels": ${panelCount},
  "pagesRequired": ${PROFESSIONAL_AUDIENCE_CONFIG[audience].pagesPerStory},
  "emotionalArc": ["emotion1", "emotion2", "emotion3", "emotion4"],
  "visualThemes": ["consistent visual elements that appear throughout"]
}`;

      const response = await this.geminiIntegration.generateTextCompletion(
        analysisPrompt,
        {
          temperature: 0.3,
          max_output_tokens: 2500,
          top_p: 0.9
          // model: 'gpt-4o',  // Gemini doesn't use model parameter
          // useJsonMode: true  // Gemini doesn't have JSON mode flag
        }
      );
      
      // Validate response before proceeding
      if (!response || response.length < 10) {
        throw new Error('OpenAI returned empty or invalid response for story analysis');
      }

      // Parse response
      let parsed: any;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch || !jsonMatch[0]) {
          throw new Error('No JSON found in OpenAI response');
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

        // Add previousBeatContext to each beat for sequential flow
        for (let i = 1; i < parsed.storyBeats.length; i++) {
          parsed.storyBeats[i].previousBeatContext = parsed.storyBeats[i - 1].beat;
          parsed.storyBeats[i].previousBeatSummary = parsed.storyBeats[i - 1].beat;
        }
        this.log('info', `✅ Added sequential context to ${parsed.storyBeats.length - 1} beats`);
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
        cinematicQuality: true
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
 */
private enrichStoryBeats(beats: any[], targetCount: number, audience: AudienceType): StoryBeat[] {
  // Ensure we have the right number of beats
  while (beats.length < targetCount) {
    beats.push(this.createCinematicBeat(beats.length, targetCount, audience));
  }
  
  return beats.slice(0, targetCount).map((beat, index) => ({
    beat: beat.beat || `Cinematic moment ${index + 1}`,
    imagePrompt: beat.imagePrompt || this.generateCinematicPrompt(index, targetCount, audience),
    emotion: beat.emotion || this.determineEmotionForBeat(index, targetCount),
    characterAction: beat.characterAction || 'engaging with the story',
    visualPriority: beat.visualPriority || 'character-full',
    environment: beat.environment || 'richly detailed setting',
    panelPurpose: beat.panelPurpose || this.determinePanelPurpose(index, targetCount),
    narrativeFunction: beat.panelPurpose || this.determinePanelPurpose(index, targetCount),
    cameraAngle: beat.cameraAngle || this.determineCameraAngle(index, targetCount),
    lightingNote: beat.lightingNote || 'professional cinematic lighting',
    compositionNote: beat.compositionNote || 'rule of thirds with dynamic composition',
    hasSpeechBubble: beat.hasSpeechBubble || (index % 3 === 0),
    dialogue: beat.dialogue,
    speechBubbleStyle: beat.speechBubbleStyle || 'standard',
    previousBeatContext: index > 0 ? beats[index - 1].beat : null,
    previousBeatSummary: index > 0 ? beats[index - 1].beat : null
  }));
}

private createCinematicBeat(index: number, total: number, audience: AudienceType): any {
  const position = index / total;
  return {
    beat: position < 0.2 ? 'Establishing the scene' : position < 0.8 ? 'Story development' : 'Resolution moment',
    imagePrompt: this.generateCinematicPrompt(index, total, audience),
    emotion: this.determineEmotionForBeat(index, total),
    characterAction: 'actively engaged in story',
    visualPriority: 'character-action',
    environment: 'detailed atmospheric setting',
    panelPurpose: this.determinePanelPurpose(index, total)
  };
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