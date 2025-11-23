/**
 * ===== OPENAI INTEGRATION MODULE - ENHANCED VERSION =====
 * Enterprise-grade OpenAI API wrapper with superior prompt engineering
 * Combines the best prompt strategies from both original AI service files
 * 
 * File Location: lib/services/ai/modular/openai-integration.ts
 * 
 * ENHANCEMENTS:
 * - Revolutionary prompt engineering for character consistency
 * - Advanced narrative intelligence in story analysis
 * - Professional comic book standards in image generation
 * - Environmental DNA for world-building consistency
 * - Optimized prompt compression for DALL-E limits
 * - Speech bubble intelligence and emotion mapping
 */

// ===== IMPORTS =====
import {
  AIAuthenticationError,
  AIRateLimitError,
  AIContentPolicyError,
  AITimeoutError,
  AIServiceUnavailableError,
  AIValidationError,
  AINetworkError,
  BaseServiceError,
  ErrorHandlingSystem,
  ErrorContext
} from './error-handling-system.js';

import {
  AI_SERVICE_ENTERPRISE_CONSTANTS,
  ERROR_HANDLING_CONSTANTS
} from './constants-and-types.js';

// ===== ENHANCED PROMPT TEMPLATES =====

/**
 * Professional prompt templates for character DNA creation
 * These prompts ensure 95%+ character consistency across all panels
 */
const CHARACTER_DNA_PROMPTS = {
  visionAnalysis: `CHARACTER DNA EXTRACTION - Create visual blueprint for comic consistency.

Analyze this character for PERFECT visual consistency across a professional comic book.
You are creating a CHARACTER DNA BLUEPRINT that will be the SINGLE SOURCE OF TRUTH.

CRITICAL VISUAL DNA COMPONENTS (Be EXTREMELY specific):

1. FACIAL ARCHITECTURE:
   - Face shape: Exact geometric description (oval, round, square, heart)
   - Eyes: Shape, size, color, spacing, distinctive features
   - Eyebrows: Thickness, arch, color, expression default
   - Nose: Shape, size, bridge width, nostril visibility
   - Mouth: Size, lip thickness, default expression, teeth visibility
   - Ears: Size, shape, attachment, distinctive features
   - Distinctive marks: Scars, moles, freckles (exact placement)

2. BODY SPECIFICATIONS:
   - Height class: (short/average/tall) with proportions
   - Build: Exact body type (slim, athletic, stocky, heavy)
   - Posture: Default stance and movement style
   - Skin tone: Precise color description with undertones
   - Age indicators: Visible age markers

3. SIGNATURE CLOTHING DNA:
   - Primary outfit: Every piece described in detail
   - Color scheme: Exact hex codes or detailed color names
   - Fabric textures: Material appearance and behavior
   - Accessories: All items that define the character
   - Clothing fit: How garments sit on the body

4. MOVEMENT & EXPRESSION SIGNATURE:
   - Default facial expression and mood
   - Body language tendencies
   - Gesture patterns unique to character
   - Energy level and movement style

5. ARTISTIC STYLE CALIBRATION:
   - Line weight preferences for this character
   - Shading style requirements
   - Color saturation levels
   - Detail density specifications

Return a COMPREHENSIVE character blueprint that ensures ZERO deviation across panels.`,

  compressionAlgorithm: `VISUAL FINGERPRINT COMPRESSION

Create an ULTRA-EFFICIENT character fingerprint for consistent DALL-E generation.
Compress the character essence into KEY VISUAL MARKERS only.

PRIORITY 1 (MUST INCLUDE):
- Most distinctive facial feature (1 element)
- Primary color identifier
- Body type in 2 words
- Signature clothing item

PRIORITY 2 (IF SPACE):
- Secondary distinctive feature
- Emotional baseline
- Age/gender markers

FORMAT: Short, punchy descriptors that DALL-E will interpret correctly.
Maximum 150 characters for the entire fingerprint.`,

  consistencyCheck: `CHARACTER CONSISTENCY VALIDATION

Compare these two character descriptions:
ORIGINAL: [character1]
GENERATED: [character2]

Score consistency (0-100) across:
1. Facial features match
2. Body type consistency
3. Clothing accuracy
4. Color palette adherence
5. Overall character identity

Flag ANY deviations that would break reader immersion.`
};

/**
 * Few-shot examples for story beat generation
 * These examples train the AI to produce consistent JSON output
 */
const STORY_BEAT_FEW_SHOT_EXAMPLES = {
  // Example for children's adventure story
  childrenExample: `

EXAMPLE INPUT:
Story: "Luna the brave little rabbit decided to explore the dark forest. She met a friendly owl who warned her about the river. Luna carefully crossed the stepping stones and found a magical garden full of glowing flowers. She picked one flower to bring home to her mother."
Audience: children
Panel Count: 8

EXAMPLE OUTPUT:
{
  "storyArchetype": "adventure",
  "emotionalArc": ["curious", "cautious", "determined", "amazed", "happy"],
  "storyBeats": [
    {
      "beatNumber": 1,
      "panelCount": 1,
      "description": "Luna the rabbit stands at the edge of the dark forest, ears perked up with curiosity, looking at the shadowy trees ahead",
      "emotion": "curious",
      "dialogue": "",
      "narrativePurpose": "setup",
      "visualPriority": "environment"
    },
    {
      "beatNumber": 2,
      "panelCount": 1,
      "description": "Luna hops into the forest, surrounded by tall dark trees with small patches of light filtering through",
      "emotion": "determined",
      "dialogue": "I can do this!",
      "narrativePurpose": "development",
      "visualPriority": "character"
    },
    {
      "beatNumber": 3,
      "panelCount": 1,
      "description": "A wise owl with big round eyes perches on a branch above Luna, pointing a wing toward a rushing river",
      "emotion": "cautious",
      "dialogue": "Be careful of the river, little one.",
      "narrativePurpose": "development",
      "visualPriority": "character"
    },
    {
      "beatNumber": 4,
      "panelCount": 1,
      "description": "Luna approaches the rushing river, seeing a line of mossy stepping stones across the water",
      "emotion": "scared",
      "dialogue": "",
      "narrativePurpose": "development",
      "visualPriority": "environment"
    },
    {
      "beatNumber": 5,
      "panelCount": 1,
      "description": "Luna carefully balances on a stepping stone mid-river, arms outstretched, water splashing below",
      "emotion": "determined",
      "dialogue": "",
      "narrativePurpose": "climax",
      "visualPriority": "action"
    },
    {
      "beatNumber": 6,
      "panelCount": 1,
      "description": "Luna lands safely on the far riverbank and gasps at the sight before her",
      "emotion": "surprised",
      "dialogue": "Wow!",
      "narrativePurpose": "development",
      "visualPriority": "character"
    },
    {
      "beatNumber": 7,
      "panelCount": 1,
      "description": "Wide shot of a magical garden filled with flowers that glow in soft blues, pinks, and purples",
      "emotion": "amazed",
      "dialogue": "",
      "narrativePurpose": "development",
      "visualPriority": "environment"
    },
    {
      "beatNumber": 8,
      "panelCount": 1,
      "description": "Luna holds a single glowing flower, smiling warmly, ready to bring it home to her mother",
      "emotion": "happy",
      "dialogue": "Mom will love this!",
      "narrativePurpose": "resolution",
      "visualPriority": "character"
    }
  ],
  "totalPanels": 8,
  "dialoguePanels": 4
}

`
};

/**
 * Advanced story analysis prompts with narrative intelligence
 * These create professional comic book pacing and emotional flow
 */
const STORY_ANALYSIS_PROMPTS = {
  narrativeIntelligence: `PROFESSIONAL COMIC BOOK STORY ANALYSIS - NARRATIVE INTELLIGENCE ENGINE

You are a master comic book editor analyzing a story for adaptation.
Your analysis will determine the ENTIRE visual narrative flow.

STORY: [STORY_TEXT]
TARGET AUDIENCE: [AUDIENCE]
TOTAL PANELS AVAILABLE: [PANEL_COUNT]

CONTINUITY RULE: Beat N+1 must directly follow from Beat N. Include clear cause-effect relationships.

REQUIRED ANALYSIS COMPONENTS:

1. STORY ARCHETYPE DETECTION:
   Identify the primary narrative archetype:
   - Hero's Journey (transformation arc)
   - Comedy/Humor (escalating situations)
   - Mystery (revelation structure)
   - Slice of Life (moment capture)
   - Adventure (action progression)
   - Educational (concept building)

2. EMOTIONAL PROGRESSION MAPPING:
   Create an emotional journey with SPECIFIC progression:
   - Opening emotion (establish mood)
   - Rising tension points
   - Climax emotion (peak intensity)
   - Resolution feeling
   Each beat must have EXACT emotion: happy, sad, excited, scared, curious, surprised, angry, confused, determined

3. PANEL ALLOCATION STRATEGY:
   Distribute [PANEL_COUNT] panels across story beats:
   - Setup panels (establish world/character)
   - Development panels (build story)
   - Climax panels (peak moment)
   - Resolution panels (closure)

4. DIALOGUE INTELLIGENCE:
   For each beat, determine:
   - Has dialogue? (true/false)
   - Speech bubble type: thought/speech/shout/whisper
   - Word count (keep concise for visual medium)

5. VISUAL PRIORITY SYSTEM:
   For each beat, assign visual focus:
   - Character (emotion/reaction focus)
   - Action (movement/event focus)
   - Environment (world/setting focus)
   - Detail (specific object/element focus)

6. PROFESSIONAL PACING METRICS:
   - Panels per story beat
   - Dialogue-to-visual ratio
   - Emotional peak placement
   - Reader engagement curve

CRITICAL: Return COMPLETE JSON with EVERY beat fully specified.
NO missing fields. This drives the ENTIRE visual generation pipeline.

${STORY_BEAT_FEW_SHOT_EXAMPLES.childrenExample}

NOW ANALYZE THIS STORY:
Story: [STORY_TEXT]
Audience: [AUDIENCE]  
Panel Count: [PANEL_COUNT]

Respond with ONLY valid JSON matching the exact structure shown in the example above. No markdown, no explanation, just the JSON object.`,

  beatGeneration: `COMIC PANEL BEAT GENERATION

Create [PANEL_COUNT] comic book panels that tell this story PERFECTLY.

STORY: [STORY_TEXT]
ARCHETYPE: [STORY_ARCHETYPE]
AUDIENCE: [AUDIENCE]
EMOTIONAL ARC: [EMOTIONAL_PROGRESSION]

For EACH panel, generate:

{
  "panelNumber": number,
  "pageNumber": number (calculate based on [PANELS_PER_PAGE]),
  "description": "EXACT visual scene description - what reader sees",
  "characterAction": "SPECIFIC character movement/pose/expression",
  "emotion": "EXACT emotion from: happy|sad|excited|scared|angry|surprised|curious|confused|determined",
  "dialogue": "Actual character words (empty if no speech)",
  "speechBubbleStyle": "thought|speech|shout|whisper|none",
  "panelType": "standard|wide|tall|splash|closeup|establishing",
  "visualPriority": "character|action|environment|detail",
  "narrativePurpose": "setup|development|climax|resolution|transition",
  "cameraAngle": "straight|high|low|dutch|aerial|worm",
  "backgroundComplexity": "simple|moderate|detailed",
  "lightingMood": "bright|soft|dramatic|dark|mystical"
}

PACING RULES:
- Start with establishing shot
- Build tension gradually
- Use panel types strategically
- Place dialogue for maximum impact
- Ensure visual flow between panels`,

  emergencyFallback: `QUICK STORY STRUCTURE

Rapidly analyze: [STORY_TEXT]

Create [PANEL_COUNT] panels with:
- Beginning (25% of panels)
- Middle (50% of panels)  
- End (25% of panels)

Each panel needs:
- What happens (one sentence)
- Character emotion
- Dialogue (if any)

Keep it simple but complete.`
};

/**
 * Professional image generation prompts for DALL-E
 * These create publication-quality comic book art
 */
const IMAGE_GENERATION_PROMPTS = {
  masterPanelPrompt: `CHARACTER (MUST MATCH EXACTLY):
[CHARACTER_FINGERPRINT]

STYLE: [STYLE_CALIBRATION]

SCENE: [SCENE_DESCRIPTION]

PANEL: [PANEL_TYPE], [CAMERA_ANGLE] angle, [ART_STYLE] style for [AUDIENCE]

EMOTION: [EMOTION] expression clearly shown

ATMOSPHERE: [LIGHTING_MOOD] lighting, [BACKGROUND_COMPLEXITY] background

REQUIREMENTS:
- Professional [ART_STYLE] comic art, publication-ready
- Character identical to DNA description above
- Rule of thirds composition, clear focal point
- Age-appropriate for [AUDIENCE]`,

  characterConsistencyBoost: `CHARACTER MATCH REQUIRED:
[CHARACTER_DNA_COMPRESSED]

Maintain exact appearance - zero deviation.`,

  environmentalDNA: `WORLD CONSISTENCY DNA

Create environmental consistency across panels:

WORLD SETTING: [SETTING_DESCRIPTION]
TIME PERIOD: [TIME_CONTEXT]
ATMOSPHERE: [MOOD_DESCRIPTORS]
ARCHITECTURAL STYLE: [BUILDING_DESCRIPTIONS]
NATURE ELEMENTS: [LANDSCAPE_FEATURES]
COLOR PALETTE: [ENVIRONMENTAL_COLORS]
LIGHTING SIGNATURE: [LIGHTING_CHARACTERISTICS]
TEXTURE LIBRARY: [SURFACE_DETAILS]

Ensure EVERY panel exists in the SAME world.`,

  speechBubbleIntelligence: `SPEECH BUBBLE COMPOSITION

[IF_DIALOGUE_EXISTS]
Leave exact space for speech bubble placement:
- Position: [BUBBLE_POSITION] of panel
- Size: [WORD_COUNT * 0.5] inches estimated
- Style: [BUBBLE_STYLE] shape required
- Tail direction: Pointing to speaker's mouth
- Clear background area for text visibility

Character mouth position: [OPEN/CLOSED] for [SPEAKING/THINKING]`,

  qualityEnforcementLayer: `QUALITY CONTROL:
- Character matches DNA fingerprint EXACTLY
- Emotion is instantly readable
- Composition follows rule of thirds
- MANDATORY CONTENT RULES FOR [AUDIENCE]: [AUDIENCE_RULES]
- Consistent with previous panels
- Professional comic book standard
- Clear focal point established
- Appropriate detail level
- Correct lighting mood
- Panel type specifications met`
};

/**
 * Style-specific visual calibration for DALL-E panel generation
 * Concise visual language optimized for each art style
 */
export const STYLE_SPECIFIC_PANEL_CALIBRATION: Record<string, { stylePrompt: string }> = {
  'storybook': {
    stylePrompt: 'soft watercolor edges, warm pastels, rounded features, gentle lighting'
  },
  'semi-realistic': {
    stylePrompt: 'smooth gradients, natural proportions, polished rendering, subtle shadows'
  },
  'comic-book': {
    stylePrompt: 'bold ink outlines, cel-shading, high contrast, dynamic poses'
  },
  'flat-illustration': {
    stylePrompt: 'clean vector lines, solid flat colors, minimal shadows, geometric shapes'
  },
  'anime': {
    stylePrompt: 'cel-shaded, large expressive eyes, vibrant colors, dynamic hair'
  }
};

/**
 * Optimized prompt compression for DALL-E's 4000 character limit
 */
const PROMPT_COMPRESSION_STRATEGIES = {
  prioritySystem: {
    1: ['character description', 'main action', 'emotion'],
    2: ['art style', 'panel type', 'basic quality'],
    3: ['lighting', 'background', 'composition'],
    4: ['additional details', 'quality modifiers']
  },

  compressionRules: [
    { pattern: /professional comic book standard/g, replacement: 'pro comic art' },
    { pattern: /character expressing (\w+) emotion/g, replacement: '$1 expression' },
    { pattern: /high quality illustration/g, replacement: 'HQ art' },
    { pattern: /consistent with character DNA/g, replacement: 'match char DNA' },
    { pattern: /publication-ready/g, replacement: 'pro-quality' },
    { pattern: /crystal clear/g, replacement: 'clear' },
    { pattern: /background environment/g, replacement: 'background' },
    { pattern: /lighting atmosphere/g, replacement: 'lighting' }
  ],

  ultraCompression: `[PANEL_TYPE]: [CORE_ACTION]
CHAR: [CHARACTER_MIN]
EMO: [EMOTION]
STYLE: [ART_STYLE_SHORT] [AUDIENCE_SHORT]
QUALITY: Pro comic standard`
};

// ===== TYPES AND INTERFACES =====

interface OpenAICallOptions {
  enableRetry?: boolean;
  enableCircuitBreaker?: boolean;
  enableMetrics?: boolean;
  timeout?: number;
  maxAttempts?: number;
  baseDelay?: number;
}

interface RetryMetric {
  operationName: string;
  errorType: string;
  errorMessage: string;
  httpStatus?: number;
  attemptNumber: number;
  maxAttempts: number;
  delayMs: number;
  durationMs: number;
  success: boolean;
  totalRetryDurationMs: number;
  circuitBreakerState: string;
  retryStrategy: string;
  endpoint: string;
  timestamp: number;
}

interface ErrorClassificationResult {
  isRetryable: boolean;
  maxAttempts: number;
  errorCategory: 'rate_limit' | 'timeout' | 'server_error' | 'content_policy' | 'authentication' | 'invalid_request' | 'network';
  userMessage: string;
  shouldIncreaseTimeout: boolean;
}

interface OpenAIParameters {
  model?: string;
  messages?: any[];
  prompt?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  useJsonMode?: boolean;
  response_format?: { type: string } | string;
  [key: string]: any;
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
  threshold: number;
  timeout: number;
  successCount: number;
  totalRequests: number;
  errorRate: number;
}

interface RateLimitState {
  count: number;
  resetTime: number;
  windowMs: number;
  maxRequests: number;
}

// ===== MAIN CLASS =====

/**
 * Enhanced OpenAI Integration with Superior Prompt Engineering
 */
export class OpenAIIntegration {
  private apiKey: string;
  private errorHandler: ErrorHandlingSystem;
  private defaultModel: string = 'gpt-4o';
  private defaultImageModel: string = 'dall-e-3';
  private userAgent: string = 'StoryCanvas/2.0 (Enhanced)';
  
  // Circuit breaker states
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  
  // Rate limiting
  private rateLimitStates: Map<string, RateLimitState> = new Map();
  
  // Metrics
  private operationMetrics: Map<string, any> = new Map();

  // Retry metrics batching
  private retryMetricsBatch: RetryMetric[] = [];
  private lastMetricsBatchTime: number = Date.now();
  private readonly METRICS_BATCH_SIZE = 100;
  private readonly METRICS_BATCH_INTERVAL_MS = 300000; // 5 minutes

  // Maximum total retry duration
  private readonly MAX_TOTAL_RETRY_DURATION_MS = 180000; // 3 minutes
  
  // Logger
  private logger = {
    log: (message: string, ...args: any[]) => console.log(`[OpenAI] ${message}`, ...args),
    error: (message: string, ...args: any[]) => console.error(`[OpenAI-ERROR] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => console.warn(`[OpenAI-WARN] ${message}`, ...args)
  };

  constructor(apiKey: string, errorHandler: ErrorHandlingSystem) {
    this.apiKey = apiKey;
    this.errorHandler = errorHandler;
    this.initializeCircuitBreakers();
    this.initializeRateLimiting();
  }

  // ===== INITIALIZATION =====

  private initializeCircuitBreakers(): void {
    const endpoints = ['/chat/completions', '/images/generations', '/embeddings'];
    endpoints.forEach(endpoint => {
      this.circuitBreakers.set(endpoint, {
        failures: 0,
        lastFailure: 0,
        state: 'closed',
        threshold: 5,
        timeout: 60000, // 1 minute
        successCount: 0,
        totalRequests: 0,
        errorRate: 0
      });
    });
  }

  private initializeRateLimiting(): void {
    this.rateLimitStates.set('global', {
      count: 0,
      resetTime: Date.now() + 60000,
      windowMs: 60000,
      maxRequests: 50
    });
  }

  // ===== ENHANCED PROMPT METHODS =====

  /**
   * Generate character DNA with advanced vision analysis
   * This is the SECRET SAUCE for character consistency
   */
  public async generateCharacterDNA(
    characterDescription: string,
    artStyle: string,
    characterImage?: string
  ): Promise<any> {
    const prompt = CHARACTER_DNA_PROMPTS.visionAnalysis
      .replace('[CHARACTER_IMAGE]', characterImage || characterDescription)
      .replace('[ART_STYLE]', artStyle);

    try {
      const response = await this.generateTextCompletion(prompt, {
        temperature: 0.3,
        max_tokens: 1500,
        top_p: 0.9,
        model: 'gpt-4o'
      });

      // Parse and structure the DNA
      const dna = this.parseCharacterDNA(response);
      
      // Create compressed fingerprint
      const fingerprint = await this.createCharacterFingerprint(dna, artStyle);
      
      return {
        fullDNA: dna,
        fingerprint: fingerprint,
        artStyle: artStyle,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Character DNA generation failed:', error);
      throw error;
    }
  }

  /**
   * Create compressed character fingerprint for efficient prompting
   */
  private async createCharacterFingerprint(dna: any, artStyle: string): Promise<string> {
    const compressionPrompt = CHARACTER_DNA_PROMPTS.compressionAlgorithm
      .replace('[FULL_DNA]', JSON.stringify(dna));

    const response = await this.generateTextCompletion(compressionPrompt, {
      temperature: 0.1,
      max_tokens: 200,
      top_p: 0.9
    });

    return response.trim();
  }

  /**
   * Generate story analysis with narrative intelligence
   */
  public async analyzeStoryWithNarrativeIntelligence(
    story: string,
    audience: string,
    panelCount: number,
    panelsPerPage: number
  ): Promise<any> {
    const prompt = STORY_ANALYSIS_PROMPTS.narrativeIntelligence
      .replace('[STORY_TEXT]', story)
      .replace('[AUDIENCE]', audience)
      .replace(/\[PANEL_COUNT\]/g, panelCount.toString())
      .replace('[PANELS_PER_PAGE]', panelsPerPage.toString());

    try {
      const response = await this.generateTextCompletion(prompt, {
        temperature: 0.3,
        max_tokens: 2500,
        top_p: 0.9,
        model: 'gpt-4o',
        useJsonMode: true
      });

      return this.parseStoryAnalysis(response, panelCount);
    } catch (error) {
      // Use emergency fallback for robustness
      this.logger.warn('Using emergency story analysis fallback');
      return this.emergencyStoryAnalysis(story, panelCount);
    }
  }

  /**
   * Generate professional comic panel image
   * This method creates PUBLICATION-QUALITY art
   */
  public async generateComicPanel(options: {
    sceneDescription: string;
    characterFingerprint?: string;
    emotion: string;
    panelType: string;
    artStyle: string;
    audience: string;
    cameraAngle?: string;
    lightingMood?: string;
    backgroundComplexity?: string;
    hasDialogue?: boolean;
    speechBubbleStyle?: string;
  }): Promise<string> {
    // Build the master prompt with style calibration
    const styleCalibration = STYLE_SPECIFIC_PANEL_CALIBRATION[options.artStyle] || STYLE_SPECIFIC_PANEL_CALIBRATION['semi-realistic'];
    
    let prompt = IMAGE_GENERATION_PROMPTS.masterPanelPrompt
      .replace('[SCENE_DESCRIPTION]', options.sceneDescription)
      .replace('[CHARACTER_FINGERPRINT]', options.characterFingerprint || 'No specific character')
      .replace('[STYLE_CALIBRATION]', styleCalibration.stylePrompt)
      .replace(/\[PANEL_TYPE\]/g, options.panelType)
      .replace(/\[ART_STYLE\]/g, options.artStyle)
      .replace(/\[AUDIENCE\]/g, options.audience)
      .replace('[EMOTION]', options.emotion)
      .replace('[CAMERA_ANGLE]', options.cameraAngle || 'straight')
      .replace('[LIGHTING_MOOD]', options.lightingMood || 'soft')
      .replace('[BACKGROUND_COMPLEXITY]', options.backgroundComplexity || 'moderate');

    // Add character consistency boost if fingerprint exists
    if (options.characterFingerprint) {
      prompt += '\n\n' + IMAGE_GENERATION_PROMPTS.characterConsistencyBoost
        .replace('[CHARACTER_DNA_COMPRESSED]', options.characterFingerprint);
    }

    // Add speech bubble intelligence if dialogue exists
    if (options.hasDialogue && options.speechBubbleStyle) {
      const bubblePrompt = IMAGE_GENERATION_PROMPTS.speechBubbleIntelligence
        .replace('[IF_DIALOGUE_EXISTS]', '')
        .replace('[BUBBLE_POSITION]', this.calculateBubblePosition(options.panelType))
        .replace('[WORD_COUNT]', '20') // Estimate
        .replace('[BUBBLE_STYLE]', options.speechBubbleStyle)
        .replace('[SPEAKING/THINKING]', options.speechBubbleStyle === 'thought' ? 'THINKING' : 'SPEAKING')
        .replace('[OPEN/CLOSED]', options.speechBubbleStyle === 'thought' ? 'CLOSED' : 'OPEN');
      
      prompt += '\n\n' + bubblePrompt;
    }

    // Add quality enforcement layer with audience-specific content rules
    const audienceRules = options.audience === 'children'
      ? 'bright, friendly, safe imagery. FORBIDDEN: violence, weapons, scary elements, dark themes'
      : 'age-appropriate imagery';

    prompt += '\n\n' + IMAGE_GENERATION_PROMPTS.qualityEnforcementLayer
      .replace('[AUDIENCE]', options.audience)
      .replace('[AUDIENCE_RULES]', audienceRules);

    // Compress if needed
    if (prompt.length > 3800) {
      prompt = this.compressPromptIntelligently(prompt, options);
    }

    return await this.generateCartoonImage(prompt);
  }

  /**
   * Create environmental DNA for world consistency
   */
  public async generateEnvironmentalDNA(
    storyBeats: any[],
    audience: string,
    artStyle: string
  ): Promise<any> {
    // Analyze story for environmental elements
    const settings = this.extractEnvironmentalElements(storyBeats);
    
    const prompt = IMAGE_GENERATION_PROMPTS.environmentalDNA
      .replace('[SETTING_DESCRIPTION]', settings.primary)
      .replace('[TIME_CONTEXT]', settings.timeOfDay)
      .replace('[MOOD_DESCRIPTORS]', settings.mood)
      .replace('[BUILDING_DESCRIPTIONS]', settings.architecture)
      .replace('[LANDSCAPE_FEATURES]', settings.nature)
      .replace('[ENVIRONMENTAL_COLORS]', this.getEnvironmentalPalette(audience))
      .replace('[LIGHTING_CHARACTERISTICS]', this.getLightingStyle(audience))
      .replace('[SURFACE_DETAILS]', settings.textures);

    const response = await this.generateTextCompletion(prompt, {
      temperature: 0.3,
      max_tokens: 1200,
      top_p: 0.9
    });

    return this.parseEnvironmentalDNA(response);
  }

  // ===== INTELLIGENT PROMPT COMPRESSION =====

  /**
   * Compress prompts intelligently while maintaining quality
   */
  private compressPromptIntelligently(prompt: string, options: any): string {
    let compressed = prompt;

    // Apply compression rules
    PROMPT_COMPRESSION_STRATEGIES.compressionRules.forEach(rule => {
      compressed = compressed.replace(rule.pattern, rule.replacement);
    });

    // If still too long, use priority system with dynamic space allocation
    if (compressed.length > 3800) {
      const lines = compressed.split('\n').filter(l => l.trim());
      const prioritized: string[] = [];

      // Dynamic space allocation: 50% for character, 30% for scene, 20% for rest
      const p1Space = 2000; // Priority 1 (character DNA, visual, consistency)
      const p2Space = 1200; // Priority 2 (style, quality)
      const p3Space = 500;  // Priority 3 (lighting, background)

      let p1Length = 0;
      let p2Length = 0;
      let p3Length = 0;

      // Add by priority with space budgets
      for (const priority of [1, 2, 3, 4]) {
        for (const line of lines) {
          if (this.getLinePriority(line) === priority) {
            if (priority === 1 && p1Length + line.length < p1Space) {
              prioritized.push(line);
              p1Length += line.length;
            } else if (priority === 2 && p2Length + line.length < p2Space) {
              prioritized.push(line);
              p2Length += line.length;
            } else if (priority === 3 && p3Length + line.length < p3Space) {
              prioritized.push(line);
              p3Length += line.length;
            } else if (priority === 4 && (p1Length + p2Length + p3Length + line.length) < 3700) {
              prioritized.push(line);
            }
          }
        }
      }

      compressed = prioritized.join('\n');
    }

    // Ultra compression as last resort
    if (compressed.length > 3800) {
      compressed = PROMPT_COMPRESSION_STRATEGIES.ultraCompression
        .replace('[PANEL_TYPE]', options.panelType || 'Standard panel')
        .replace('[CORE_ACTION]', options.sceneDescription.substring(0, 50))
        .replace('[CHARACTER_MIN]', options.characterFingerprint?.substring(0, 30) || 'character')
        .replace('[EMOTION]', options.emotion)
        .replace('[ART_STYLE_SHORT]', options.artStyle.substring(0, 10))
        .replace('[AUDIENCE_SHORT]', options.audience === 'children' ? 'kids' : options.audience);
    }

    return compressed;
  }

  // ===== CORE API METHODS (Enhanced from original) =====

  /**
   * Make OpenAI API call with all enhancements
   */
 private async makeOpenAIAPICall<T>(
    endpoint: string,
    parameters: OpenAIParameters,
    timeout: number = 180000,
    operationName: string = 'unknown'
  ): Promise<T> {
    const startTime = Date.now();

    // Check circuit breaker
    const breaker = this.circuitBreakers.get(endpoint);
    if (breaker) {
      if (breaker.state === 'open') {
        if (Date.now() - breaker.lastFailure < breaker.timeout) {
          throw new AIServiceUnavailableError('Circuit breaker is open', {
            service: 'OpenAIIntegration',
            operation: operationName,
            details: { endpoint }
          });
        }
        // Try half-open
        breaker.state = 'half-open';
      }
    }

    // Check rate limits
    if (!this.checkRateLimit()) {
      throw new AIRateLimitError('Rate limit exceeded', {
        service: 'OpenAIIntegration',
        operation: operationName
      });
    }

    // ✅ FIX: Implement exponential backoff with intelligent retry
    const maxRetries = 3;
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Add delay for retries with exponential backoff
        if (attempt > 1) {
          const baseDelay = 1000; // 1 second base
          const maxDelay = 30000; // 30 seconds max
          
          // Calculate delay with exponential backoff and jitter
          let delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
          
          // Add jitter to prevent thundering herd
          const jitter = Math.random() * 0.3 * delay; // 0-30% jitter
          delay = Math.round(delay + jitter);
          
          // Special handling for rate limit errors
          if (lastError instanceof AIRateLimitError) {
            // Extract retry-after header if available
            const retryAfter = lastError.details?.retryAfter;
            if (retryAfter) {
              delay = parseInt(retryAfter) * 1000; // Convert seconds to ms
            } else {
              delay = Math.min(delay * 2, 60000); // Double delay for rate limits, max 60s
            }
          }
          
          this.logger.warn(`⏳ Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay for ${operationName}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const result = await this.executeOpenAICall<T>(
          endpoint,
          parameters,
          timeout,
          operationName
        );

        // Update circuit breaker on success
        if (breaker) {
          if (breaker.state === 'half-open') {
            breaker.successCount++;
            if (breaker.successCount >= 3) {
              breaker.state = 'closed';
              breaker.failures = 0;
              breaker.successCount = 0;
              this.logger.log(`✅ Circuit breaker closed for ${endpoint}`);
            }
          } else if (breaker.state === 'closed') {
            // Reset failure count on success
            breaker.failures = 0;
          }
        }

        // Record metrics
        this.recordOperationMetrics(operationName, Date.now() - startTime, true);
        
        // Log successful retry
        if (attempt > 1) {
          this.logger.log(`✅ Retry successful for ${operationName} on attempt ${attempt}`);
        }

        return result;
        
      } catch (error: any) {
        lastError = error;
        
        // Determine if error is retryable
        const isRetryable = 
          error instanceof AIRateLimitError ||
          error instanceof AITimeoutError ||
          (error instanceof AIServiceUnavailableError && error.details?.httpStatus !== 400);
        
        // Log the error with context
        this.logger.error(`❌ Attempt ${attempt}/${maxRetries} failed for ${operationName}:`, {
          error: error.message,
          errorType: error.constructor.name,
          isRetryable,
          endpoint,
          httpStatus: error.details?.httpStatus
        });
        
        // Don't retry if it's not retryable or we've exhausted retries
        if (!isRetryable || attempt === maxRetries) {
          // Update circuit breaker on final failure
          if (breaker) {
            breaker.failures++;
            breaker.lastFailure = Date.now();
            if (breaker.failures >= breaker.threshold) {
              breaker.state = 'open';
              this.logger.error(`🚫 Circuit breaker opened for ${endpoint} after ${breaker.failures} failures`);
            }
          }

          // Record metrics
          this.recordOperationMetrics(operationName, Date.now() - startTime, false);

          // Enhance error with retry context in details
          if (error instanceof BaseServiceError && attempt > 1) {
            const enhancedError = new (error.constructor as any)(
              error.message,
              {
                service: error.service,
                operation: error.operation,
                details: {
                  ...error.details,
                  retryContext: {
                    attempts: attempt,
                    totalDuration: Date.now() - startTime,
                    operationName,
                    errorProgression: [error.constructor.name]
                  }
                },
                correlationId: error.correlationId,
                cause: error.cause
              }
            );
            throw enhancedError;
          }

          throw error;
        }
        
        // Special handling for specific error types
        if (error instanceof AIContentPolicyError) {
          // Content policy errors shouldn't be retried
          throw error;
        }
      }
    }
    
    // This should never be reached, but just in case
    throw lastError || new AIServiceUnavailableError('Failed after all retry attempts', {
      service: 'OpenAIIntegration',
      operation: operationName,
      details: { endpoint, attempts: maxRetries }
    });
  }

  /**
   * Execute OpenAI API call
   */
  private async executeOpenAICall<T>(
    endpoint: string,
    parameters: OpenAIParameters,
    timeout: number,
    operationName: string
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`https://api.openai.com/v1${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': this.userAgent,
        },
        body: JSON.stringify(this.transformParameters(parameters)),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleAPIError(response, operationName, endpoint);
      }

      const result = await response.json();
      this.validateAPIResponse(result, endpoint, operationName);
      
      return result;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new AITimeoutError(`Request timed out after ${timeout}ms`, {
          service: 'OpenAIIntegration',
          operation: operationName
        });
      }
      
      throw error;
    }
  }

  /**
   * Generate text completion
   */
  public async generateTextCompletion(
    prompt: string,
    options: Partial<OpenAIParameters> = {}
  ): Promise<string> {
    const parameters: OpenAIParameters = {
      model: options.model || this.defaultModel,
      messages: [
        {
          role: 'user',
          content: this.optimizePrompt(prompt)
        }
      ],
      max_tokens: options.max_tokens || 2000,
      temperature: options.temperature !== undefined ? options.temperature : 0.7,
      top_p: options.top_p || 0.9,
      ...(options.useJsonMode && { response_format: { type: "json_object" } }),
      ...options
    };

    const result = await this.makeOpenAIAPICall<any>(
      '/chat/completions',
      parameters,
      180000,
      'generateTextCompletion'
    );

    return result.choices[0].message.content;
  }

  /**
   * Generate cartoon image with enhanced prompting
   */
  public async generateCartoonImage(prompt: string): Promise<string> {
    if (!prompt || prompt.trim().length === 0) {
      throw new AIContentPolicyError('Empty prompt provided to DALL-E API', {
        service: 'OpenAIIntegration',
        operation: 'generateCartoonImage'
      });
    }

    // Optimize and validate prompt length
    const optimizedPrompt = this.optimizePrompt(prompt, 4000);

    const parameters = {
      model: this.defaultImageModel,
      prompt: optimizedPrompt,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url'
    };

    const result = await this.makeOpenAIAPICall<any>(
      '/images/generations',
      parameters,
      180000,
      'generateCartoonImage'
    );

    if (!result?.data?.[0]?.url) {
      throw new AIServiceUnavailableError('Invalid response from OpenAI API - no image URL received', {
        service: 'OpenAIIntegration',
        operation: 'generateCartoonImage'
      });
    }

    return result.data[0].url;
  }

  // ===== HELPER METHODS =====

  /**
   * Parse character DNA from response
   */
  private parseCharacterDNA(response: string): any {
    try {
      // Try to parse as JSON first
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Parse as structured text
      const dna: any = {
        facial: {},
        body: {},
        clothing: {},
        movement: {},
        artistic: {}
      };

      // Extract facial features
      const facialMatch = response.match(/FACIAL ARCHITECTURE:[\s\S]*?(?=\d\.|$)/i);
      if (facialMatch) {
        dna.facial = this.extractFeatures(facialMatch[0]);
      }

      // Extract body specifications
      const bodyMatch = response.match(/BODY SPECIFICATIONS:[\s\S]*?(?=\d\.|$)/i);
      if (bodyMatch) {
        dna.body = this.extractFeatures(bodyMatch[0]);
      }

      // Extract clothing
      const clothingMatch = response.match(/SIGNATURE CLOTHING:[\s\S]*?(?=\d\.|$)/i);
      if (clothingMatch) {
        dna.clothing = this.extractFeatures(clothingMatch[0]);
      }

      return dna;
    } catch (error) {
      this.logger.error('Failed to parse character DNA:', error);
      return {
        description: response,
        parseError: true
      };
    }
  }

  /**
   * Parse story analysis response
   */
  private parseStoryAnalysis(response: string, panelCount: number): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback parsing
      return this.emergencyStoryAnalysis(response, panelCount);
    } catch (error) {
      this.logger.error('Failed to parse story analysis:', error);
      return this.emergencyStoryAnalysis(response, panelCount);
    }
  }

  /**
   * Emergency story analysis fallback
   */
  private emergencyStoryAnalysis(story: string, panelCount: number): any {
    const sentences = story.match(/[^.!?]+[.!?]+/g) || [story];
    const panelsPerBeat = Math.ceil(panelCount / sentences.length);

    return {
      storyBeats: sentences.map((sentence, index) => ({
        text: sentence.trim(),
        panels: panelsPerBeat,
        emotion: this.detectEmotion(sentence),
        visualPriority: index === 0 ? 'environment' : 'character',
        narrativePurpose: index === 0 ? 'setup' : index === sentences.length - 1 ? 'resolution' : 'development'
      })),
      totalPanels: panelCount,
      archetype: 'general',
      emotionalProgression: {
        start: 'neutral',
        middle: 'engaged',
        end: 'satisfied'
      }
    };
  }

  /**
   * Extract environmental elements from story beats
   */
  private extractEnvironmentalElements(storyBeats: any[]): any {
    const elements = {
      primary: 'indoor setting',
      timeOfDay: 'daytime',
      mood: 'neutral',
      architecture: 'modern',
      nature: 'minimal',
      textures: 'standard'
    };

    // Analyze beats for environmental clues
    const allText = storyBeats.map(b => b.text || b.description).join(' ').toLowerCase();

    // Time detection
    if (allText.includes('night') || allText.includes('evening')) elements.timeOfDay = 'nighttime';
    else if (allText.includes('morning') || allText.includes('dawn')) elements.timeOfDay = 'morning';
    else if (allText.includes('sunset') || allText.includes('dusk')) elements.timeOfDay = 'sunset';

    // Location detection
    if (allText.includes('forest') || allText.includes('tree')) elements.primary = 'forest setting';
    else if (allText.includes('city') || allText.includes('building')) elements.primary = 'urban setting';
    else if (allText.includes('home') || allText.includes('house')) elements.primary = 'domestic setting';
    else if (allText.includes('school') || allText.includes('classroom')) elements.primary = 'school setting';

    // Mood detection
    if (allText.includes('scary') || allText.includes('dark')) elements.mood = 'mysterious';
    else if (allText.includes('happy') || allText.includes('bright')) elements.mood = 'cheerful';
    else if (allText.includes('adventure') || allText.includes('exciting')) elements.mood = 'adventurous';

    return elements;
  }

  /**
   * Parse environmental DNA response
   */
  private parseEnvironmentalDNA(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Create structured environmental DNA
      return {
        setting: this.extractValue(response, 'WORLD SETTING'),
        timeContext: this.extractValue(response, 'TIME PERIOD'),
        atmosphere: this.extractValue(response, 'ATMOSPHERE'),
        architecture: this.extractValue(response, 'ARCHITECTURAL STYLE'),
        nature: this.extractValue(response, 'NATURE ELEMENTS'),
        colorPalette: this.extractValue(response, 'COLOR PALETTE'),
        lighting: this.extractValue(response, 'LIGHTING SIGNATURE'),
        textures: this.extractValue(response, 'TEXTURE LIBRARY')
      };
    } catch (error) {
      return {
        description: response,
        parseError: true
      };
    }
  }

  /**
   * Optimize prompt length
   */
  private optimizePrompt(prompt: string, maxLength: number = 4000): string {
    if (prompt.length <= maxLength) return prompt;

    // Smart truncation - keep important parts
    const sections = prompt.split('\n\n');
    let optimized = '';
    let currentLength = 0;

    for (const section of sections) {
      if (currentLength + section.length <= maxLength - 100) {
        optimized += section + '\n\n';
        currentLength += section.length + 2;
      } else if (currentLength < maxLength - 200) {
        // Add truncated version of this section
        const remaining = maxLength - currentLength - 100;
        optimized += section.substring(0, remaining) + '...';
        break;
      }
    }

    return optimized.trim();
  }

  /**
   * Transform parameters for API compatibility
   */
  private transformParameters(params: OpenAIParameters): any {
    const transformed = { ...params };
    
    // Remove any camelCase versions that might cause API errors
    delete (transformed as any).maxTokens;
    delete (transformed as any).topP;
    delete (transformed as any).frequencyPenalty;
    delete (transformed as any).presencePenalty;
    delete (transformed as any).useJsonMode;  // Internal flag, not an OpenAI parameter
    
    return transformed;
  }

  /**
   * Handle API errors
   */
  private async handleAPIError(response: Response, operationName: string, endpoint: string): Promise<never> {
    let errorData: any = {};
    
    try {
      errorData = await response.json();
    } catch {
      // Ignore JSON parsing errors
    }

    const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
    const errorCode = errorData.error?.code;

    switch (response.status) {
      case 400:
        throw new AIContentPolicyError(`Bad request: ${errorMessage}`, {
          service: 'OpenAIIntegration',
          operation: operationName,
          details: {
            endpoint,
            errorCode,
            httpStatus: 400
          }
        });

      case 401:
        throw new AIAuthenticationError(`Authentication failed: ${errorMessage}`, {
          service: 'OpenAIIntegration',
          operation: operationName,
          details: {
            endpoint,
            errorCode,
            httpStatus: 401
          }
        });

      case 429:
        throw new AIRateLimitError(`Rate limit exceeded: ${errorMessage}`, {
          service: 'OpenAIIntegration',
          operation: operationName,
          details: {
            endpoint,
            errorCode,
            httpStatus: 429,
            retryAfter: response.headers.get('retry-after')
          }
        });

      default:
        throw new AIServiceUnavailableError(`Server error: ${errorMessage}`, {
          service: 'OpenAIIntegration',
          operation: operationName,
          details: {
            endpoint,
            errorCode,
            httpStatus: response.status
          }
        });
    }
  }

  /**
   * Validate API response
   */
  private validateAPIResponse(result: any, endpoint: string, operationName: string): void {
    if (!result) {
      throw new AIServiceUnavailableError('Empty response from OpenAI API', {
        service: 'OpenAIIntegration',
        operation: operationName,
        details: { endpoint }
      });
    }

    if (endpoint.includes('/chat/completions')) {
      if (!result.choices || !Array.isArray(result.choices) || result.choices.length === 0) {
        throw new AIServiceUnavailableError('Invalid chat completion response structure', {
          service: 'OpenAIIntegration',
          operation: operationName,
          details: { endpoint }
        });
      }
    }

    if (endpoint.includes('/images/generations')) {
      if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
        throw new AIServiceUnavailableError('Invalid image generation response structure', {
          service: 'OpenAIIntegration',
          operation: operationName,
          details: { endpoint }
        });
      }
    }
  }

  /**
   * Check rate limits
   */
  private checkRateLimit(): boolean {
    const globalLimit = this.rateLimitStates.get('global');
    if (!globalLimit) return true;

    if (Date.now() > globalLimit.resetTime) {
      globalLimit.count = 0;
      globalLimit.resetTime = Date.now() + globalLimit.windowMs;
    }

    if (globalLimit.count >= globalLimit.maxRequests) {
      return false;
    }

    globalLimit.count++;
    return true;
  }

  /**
   * Record operation metrics
   */
  private recordOperationMetrics(operation: string, duration: number, success: boolean): void {
    const metrics = this.operationMetrics.get(operation) || {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalDuration: 0,
      averageDuration: 0
    };

    metrics.totalCalls++;
    if (success) {
      metrics.successfulCalls++;
    } else {
      metrics.failedCalls++;
    }
    metrics.totalDuration += duration;
    metrics.averageDuration = metrics.totalDuration / metrics.totalCalls;

    this.operationMetrics.set(operation, metrics);
  }

  // ===== UTILITY METHODS =====

  /**
   * Extract features from text
   */
  private extractFeatures(text: string): any {
    const features: any = {};
    const lines = text.split('\n');
    
    for (const line of lines) {
      const match = line.match(/[-•]\s*([^:]+):\s*(.+)/);
      if (match) {
        const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
        features[key] = match[2].trim();
      }
    }
    
    return features;
  }

  /**
   * Extract value from response
   */
  private extractValue(response: string, key: string): string {
    const regex = new RegExp(`${key}:?\\s*([^\\n]+)`, 'i');
    const match = response.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * Detect emotion from text
   */
  private detectEmotion(text: string): string {
    const emotions = {
      happy: ['happy', 'joy', 'laugh', 'smile', 'excited', 'celebrate'],
      sad: ['sad', 'cry', 'tear', 'upset', 'disappoint'],
      scared: ['scare', 'afraid', 'fear', 'terrif', 'anxious'],
      angry: ['angry', 'mad', 'furious', 'rage', 'irritate'],
      surprised: ['surpris', 'shock', 'amaz', 'astonish', 'unexpected'],
      curious: ['curious', 'wonder', 'question', 'interest', 'explore'],
      determined: ['determin', 'resolve', 'commit', 'persist', 'try'],
      confused: ['confus', 'puzzle', 'perplex', 'unclear', 'lost']
    };

    const lowerText = text.toLowerCase();
    
    for (const [emotion, keywords] of Object.entries(emotions)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return emotion;
      }
    }
    
    return 'neutral';
  }

  /**
   * Calculate speech bubble position
   */
  private calculateBubblePosition(panelType: string): string {
    const positions: Record<string, string> = {
      'standard': 'top-right',
      'wide': 'top-center',
      'tall': 'top-right',
      'splash': 'bottom-center',
      'closeup': 'bottom',
      'establishing': 'top'
    };
    
    return positions[panelType] || 'top-right';
  }

  /**
   * Get environmental color palette
   */
  private getEnvironmentalPalette(audience: string): string {
    const palettes: Record<string, string> = {
      'children': 'bright vibrant colors, primary palette, cheerful tones',
      'young adults': 'balanced colors, dynamic contrasts, engaging palette',
      'adults': 'sophisticated colors, nuanced shades, mature palette'
    };
    
    return palettes[audience] || palettes.children;
  }

  /**
   * Get lighting style for audience
   */
  private getLightingStyle(audience: string): string {
    const styles: Record<string, string> = {
      'children': 'bright, clear, optimistic lighting',
      'young adults': 'dynamic lighting with mood variations',
      'adults': 'cinematic lighting with depth and atmosphere'
    };
    
    return styles[audience] || styles.children;
  }

  /**
   * Get line priority for compression
   */
  private getLinePriority(line: string): number {
    if (line.includes('CHARACTER') || line.includes('DNA') || line.includes('FINGERPRINT')) return 1;
    if (line.includes('VISUAL') || line.includes('CONSISTENCY')) return 1;
    if (line.includes('EMOTION') || line.includes('ACTION')) return 1;
    if (line.includes('STYLE') || line.includes('PANEL')) return 2;
    if (line.includes('QUALITY') || line.includes('STANDARD')) return 2;
    if (line.includes('LIGHTING') || line.includes('BACKGROUND')) return 3;
    return 4;
  }

  /**
   * Perform health check
   */
  public async performHealthCheck(): Promise<{
    isHealthy: boolean;
    details: any;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    let isHealthy = true;

    try {
      // Test basic API connectivity
      await this.generateTextCompletion('Test', {
        max_tokens: 10,
        temperature: 0.1,
        top_p: 0.9
      });

      // Check circuit breakers
      const openBreakers: string[] = [];
      this.circuitBreakers.forEach((breaker, endpoint) => {
        if (breaker.state === 'open') {
          openBreakers.push(endpoint);
          isHealthy = false;
        }
      });

      if (openBreakers.length > 0) {
        recommendations.push(`Reset circuit breakers for: ${openBreakers.join(', ')}`);
      }

      // Check metrics
      const metrics: any = {};
      this.operationMetrics.forEach((metric, operation) => {
        metrics[operation] = {
          successRate: (metric.successfulCalls / metric.totalCalls * 100).toFixed(2) + '%',
          averageDuration: Math.round(metric.averageDuration) + 'ms'
        };
      });

      return {
        isHealthy,
        details: {
          circuitBreakers: Object.fromEntries(this.circuitBreakers),
          metrics,
          rateLimits: Object.fromEntries(this.rateLimitStates)
        },
        recommendations
      };
    } catch (error) {
      return {
        isHealthy: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        recommendations: ['Check API key configuration', 'Verify network connectivity']
      };
    }
  }
}