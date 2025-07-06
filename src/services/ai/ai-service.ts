// Enhanced AI Service - Production Implementation with Professional Comic Book Generation
// ✅ ENHANCED: Character DNA system, story beat analysis, and professional comic formatting
import { EnhancedBaseService } from '../base/enhanced-base-service.js';
import { 
  IAIService,
  ServiceConfig,
  RetryConfig,
  StoryGenerationOptions,
  SceneGenerationResult,
  ChatCompletionOptions,
  ChatCompletionResult,
  CharacterDescriptionOptions,
  CharacterDescriptionResult,
  ImageGenerationOptions,
  ImageGenerationResult,
  CartoonizeOptions,
  CartoonizeResult,
  StoryGenerationResult,
  SceneGenerationOptions,
  AudienceType,
  GenreType,
  SceneMetadata,
  PanelType
} from '../interfaces/service-contracts.js';
import { 
  Result,
  AIServiceUnavailableError,
  AIRateLimitError,
  AIContentPolicyError,
  AITimeoutError,
  AIAuthenticationError,
  ErrorFactory
} from '../errors/index.js';

export interface AIConfig extends ServiceConfig {
  apiKey: string;
  baseUrl: string;
  gptTimeout: number;
  dalleTimeout: number;
  maxTokens: number;
  rateLimitRpm: number;
}

// ===== PROFESSIONAL CHARACTER DNA INTERFACES =====

interface CharacterDNA {
  physicalStructure: {
    faceShape: string;
    eyeDetails: string;
    hairSpecifics: string;
    skinTone: string;
    bodyType: string;
    facialMarks: string;
  };
  clothingSignature: {
    primaryOutfit: string;
    accessories: string;
    colorPalette: string;
    footwear: string;
  };
  uniqueIdentifiers: {
    distinctiveFeatures: string;
    expressions: string;
    posture: string;
    mannerisms: string;
  };
  artStyleAdaptation: {
    [key: string]: string;
  };
  consistencyEnforcers: string[];
  negativePrompts: string[];
}

interface StoryBeat {
  beat: string;
  emotion: string;
  visualPriority: string;
  panelPurpose: string;
  narrativeFunction: string;
  characterAction: string;
  environment: string;
  dialogue?: string;
  hasSpeechBubble?: boolean;
  speechBubbleStyle?: string;
  cleanedDialogue?: string;
}

interface StoryAnalysis {
  storyBeats: StoryBeat[];
  characterArc: string[];
  visualFlow: string[];
  totalPanels: number;
  pagesRequired: number;
  dialoguePanels?: number;
  speechBubbleDistribution?: Record<string, number>;
}

// ===== SPEECH BUBBLE SYSTEM INTERFACES =====

interface SpeechBubbleConfig {
  targetDialoguePercentage: number;
  emotionalDialogueTriggers: string[];
  bubbleStyleMapping: Record<string, string>;
  dialogueCleaningRules: Array<{ pattern: RegExp; replacement: string }>;
}

interface DialoguePattern {
  pattern: RegExp;
  type: 'direct' | 'thought' | 'exclamation' | 'whisper';
  priority: number;
}

interface DialogueCandidate {
  text: string;
  type: string;
  priority: number;
  beatIndex: number;
}

// ===== DEEP CONTENT DISCOVERY INTERFACES =====

interface ContentDiscoveryResult {
  content: any[];
  discoveryPath: string;
  qualityScore: number;
  patternType: 'direct' | 'nested' | 'discovered' | 'fallback';
}

interface DiscoveryPattern {
  name: string;
  path: string[];
  validator: (obj: any) => boolean;
  priority: number;
}

export class AIService extends EnhancedBaseService implements IAIService {
  // ===== PANEL TYPE CONSTANTS =====
  private static readonly PANEL_CONSTANTS = {
    STANDARD: 'standard',
    WIDE: 'wide',
    TALL: 'tall',
    SPLASH: 'splash'
  } as const satisfies Record<string, PanelType>;

  private apiKey: string | null = null;
  private rateLimiter: Map<string, number[]> = new Map();
  private readonly gptRetryConfig: RetryConfig = {
    attempts: 3,
    delay: 2000,
    backoffMultiplier: 2,
    maxDelay: 30000,
  };
  private readonly dalleRetryConfig: RetryConfig = {
    attempts: 2,
    delay: 5000,
    backoffMultiplier: 2,
    maxDelay: 60000,
  };

  // ===== PROFESSIONAL COMIC BOOK CONFIGURATION =====
  private readonly audienceConfig = {
    children: {
      pagesPerStory: 4,
      panelsPerPage: 2,
      totalPanels: 8,
      panelLayout: 'two_panel_vertical',
      readingFlow: 'simple_left_to_right',
      complexityLevel: 'simple',
      dialogueStyle: 'minimal_text',
      visualStyle: 'large_clear_panels',
      colorScheme: 'bright_vibrant',
      analysisInstructions: 'Focus on clear, simple story progression with obvious emotional beats. Each panel should advance the story clearly for young readers.'
    },
    young_adults: {
      pagesPerStory: 5,
      panelsPerPage: 3,
      totalPanels: 15,
      panelLayout: 'three_panel_dynamic',
      readingFlow: 'varied_with_emphasis',
      complexityLevel: 'moderate',
      dialogueStyle: 'conversational',
      visualStyle: 'dynamic_panels',
      colorScheme: 'balanced_palette',
      analysisInstructions: 'Create engaging story progression with character development. Include varied panel sizes and dynamic visual storytelling.'
    },
    adults: {
      pagesPerStory: 6,
      panelsPerPage: 4,
      totalPanels: 24,
      panelLayout: 'four_panel_sophisticated',
      readingFlow: 'complex_visual_storytelling',
      complexityLevel: 'advanced',
      dialogueStyle: 'rich_dialogue',
      visualStyle: 'varied_panel_composition',
      colorScheme: 'sophisticated_palette',
      analysisInstructions: 'Develop complex narrative structure with nuanced character development. Use sophisticated visual storytelling techniques and varied panel compositions.'
    }
  };

  // ===== PROFESSIONAL SPEECH BUBBLE CONFIGURATION =====
  private readonly speechBubbleConfig: SpeechBubbleConfig = {
    targetDialoguePercentage: 35, // 35% of panels should have dialogue
    emotionalDialogueTriggers: [
      'excited', 'angry', 'sad', 'surprised', 'confused', 'happy', 'worried', 'determined',
      'scared', 'curious', 'frustrated', 'delighted', 'nervous', 'confident', 'thoughtful'
    ],
    bubbleStyleMapping: {
      'excited': 'shout',
      'angry': 'shout',
      'surprised': 'shout',
      'happy': 'standard',
      'sad': 'whisper',
      'worried': 'thought',
      'scared': 'whisper',
      'thoughtful': 'thought',
      'confused': 'thought',
      'determined': 'standard',
      'curious': 'standard',
      'frustrated': 'standard'
    },
    dialogueCleaningRules: [
      { pattern: /["'"]/g, replacement: '' }, // Remove quotes
      { pattern: /\s+/g, replacement: ' ' }, // Normalize whitespace
      { pattern: /^\s+|\s+$/g, replacement: '' }, // Trim
      { pattern: /[.]{2,}/g, replacement: '...' }, // Normalize ellipses
    ]
  };

  // ===== DIALOGUE PATTERN DETECTION =====
  private readonly dialoguePatterns: DialoguePattern[] = [
    { pattern: /"([^"]+)"/g, type: 'direct', priority: 100 },
    { pattern: /'([^']+)'/g, type: 'direct', priority: 95 },
    { pattern: /said\s+([^.!?]+)[.!?]/gi, type: 'direct', priority: 90 },
    { pattern: /thought\s+([^.!?]+)[.!?]/gi, type: 'thought', priority: 85 },
    { pattern: /shouted\s+([^.!?]+)[.!?]/gi, type: 'exclamation', priority: 80 },
    { pattern: /whispered\s+([^.!?]+)[.!?]/gi, type: 'whisper', priority: 75 },
    { pattern: /exclaimed\s+([^.!?]+)[.!?]/gi, type: 'exclamation', priority: 70 }
  ];

  // ===== ENTERPRISE CONTENT DISCOVERY PATTERNS =====
  private readonly discoveryPatterns: DiscoveryPattern[] = [
    // Direct patterns (highest priority)
    {
      name: 'direct_pages',
      path: ['pages'],
      validator: (obj: any) => Array.isArray(obj.pages) && obj.pages.length > 0,
      priority: 100
    },
    {
      name: 'direct_panels',
      path: ['panels'],
      validator: (obj: any) => Array.isArray(obj.panels) && obj.panels.length > 0,
      priority: 95
    },
    {
      name: 'direct_scenes',
      path: ['scenes'],
      validator: (obj: any) => Array.isArray(obj.scenes) && obj.scenes.length > 0,
      priority: 90
    },
    
    // Nested patterns (common OpenAI structures)
    {
      name: 'comicbook_pages',
      path: ['comicBook', 'pages'],
      validator: (obj: any) => obj.comicBook && Array.isArray(obj.comicBook.pages) && obj.comicBook.pages.length > 0,
      priority: 85
    },
    {
      name: 'story_panels',
      path: ['story', 'panels'],
      validator: (obj: any) => obj.story && Array.isArray(obj.story.panels) && obj.story.panels.length > 0,
      priority: 80
    }
  ];

  constructor() {
    const config: AIConfig = {
      name: 'AIService',
      timeout: 120000,
      retryAttempts: 3,
      retryDelay: 2000,
      circuitBreakerThreshold: 5,
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      gptTimeout: 90000,
      dalleTimeout: 180000,
      maxTokens: 2000,
      rateLimitRpm: 60,
    };
    
    super(config);
  }

  getName(): string {
    return 'AIService';
  }

  // ===== LIFECYCLE IMPLEMENTATION =====

  protected async initializeService(): Promise<void> {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not configured: OPENAI_API_KEY environment variable is missing');
    }

    if (!apiKey || apiKey.length < 20) {
      throw new Error('Valid OPENAI_API_KEY required - key appears to be invalid or too short');
    }

    if (this.isPlaceholderValue(apiKey)) {
      throw new Error('OpenAI API key is a placeholder value. Please configure a real OpenAI API key.');
    }

    this.apiKey = apiKey;
    await this.testAPIConnectivity();
    
    this.log('info', 'AI service initialized with professional comic book generation capabilities');
  }

  protected async disposeService(): Promise<void> {
    this.rateLimiter.clear();
    this.apiKey = null;
  }

  protected async checkServiceHealth(): Promise<boolean> {
    try {
      if (!this.apiKey || !this.apiKey.startsWith('sk-') || this.apiKey.length < 20) {
        return false;
      }

      const recentRequests = this.rateLimiter.get('/chat/completions') || [];
      const now = Date.now();
      const windowMs = 60000;
      const activeRequests = recentRequests.filter(time => now - time < windowMs);
      
      if (activeRequests.length >= (this.config as AIConfig).rateLimitRpm) {
        return false;
      }

      if (Math.random() < 0.1) {
        try {
          await this.testAPIConnectivity();
        } catch (error) {
          this.log('warn', 'API connectivity test failed during health check', error);
          return false;
        }
      }

      return true;
    } catch (error) {
      this.log('error', 'AI service health check failed', error);
      return false;
    }
  }

  // ===== ENVIRONMENTAL CONSISTENCY METHODS =====

  /**
   * Create Environmental DNA for consistent world-building across panels
   * Extracts locations, lighting, weather, and visual continuity rules from story
   */
  async createEnvironmentalDNA(storyAnalysis: any, audience: AudienceType): Promise<any> {
    const result = await this.withErrorHandling(
      async () => {
        console.log('🌍 Creating Environmental DNA for world consistency...');
        
        const storyBeats = storyAnalysis?.storyBeats || [];
        const storyText = storyAnalysis?.story || 'A story unfolds';
        
        const environmentalPrompt = `You are a professional comic book environmental designer. Analyze this story and create consistent environmental DNA for all panels.

STORY ANALYSIS:
${JSON.stringify(storyBeats, null, 2)}

STORY TEXT:
${storyText}

AUDIENCE: ${audience}

Create environmental DNA with these components:

1. PRIMARY LOCATION:
   - Name and type of main setting
   - Key visual features and landmarks
   - Architectural style and period
   - Color palette (3-5 dominant colors)

2. LIGHTING CONTEXT:
   - Time of day (morning/afternoon/evening/night)
   - Weather condition (sunny/cloudy/rainy/stormy)
   - Lighting mood (bright/dramatic/soft/mysterious)
   - Shadow direction and intensity

3. VISUAL CONTINUITY RULES:
   - Background elements that should appear consistently
   - Color consistency guidelines
   - Perspective and camera angle preferences
   - Atmospheric effects (fog, dust, particles)

4. ENVIRONMENTAL MOOD:
   - Overall atmosphere (cheerful/mysterious/adventurous/cozy)
   - Seasonal context if relevant
   - Cultural or historical setting details

Return as JSON with this structure:
{
  "primaryLocation": {
    "name": "Location name",
    "type": "indoor/outdoor/mixed",
    "description": "Detailed description",
    "keyFeatures": ["feature1", "feature2"],
    "colorPalette": ["#color1", "#color2", "#color3"]
  },
  "lightingContext": {
    "timeOfDay": "afternoon",
    "weatherCondition": "sunny",
    "lightingMood": "bright",
    "shadowDirection": "left"
  },
  "visualContinuity": {
    "backgroundElements": ["element1", "element2"],
    "colorConsistency": "warm/cool/neutral",
    "perspectiveGuidelines": "eye-level/low-angle/high-angle"
  },
  "atmosphericElements": {
    "ambientEffects": ["effect1", "effect2"],
    "environmentalMood": "cheerful",
    "seasonalContext": "spring/summer/fall/winter"
  }
}`;

        const options = {
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are a professional comic book environmental designer specializing in world consistency.' },
            { role: 'user', content: environmentalPrompt }
          ],
          maxTokens: 1000,
          temperature: 0.3,
          responseFormat: { type: 'json_object' }
        };

        const response = await this.makeOpenAIAPICall<any>(
          '/chat/completions',
          options,
          120000,
          'createEnvironmentalDNA'
        );

        if (!response?.choices?.[0]?.message?.content) {
          throw new Error('No environmental DNA content received from AI service');
        }

        const environmentalDNA = JSON.parse(response.choices[0].message.content);
        
        console.log(`✅ Environmental DNA created: ${environmentalDNA.primaryLocation?.name || 'Unknown Location'}`);
        console.log(`☀️ Lighting: ${environmentalDNA.lightingContext?.timeOfDay || 'afternoon'} - ${environmentalDNA.lightingContext?.lightingMood || 'bright'}`);
        
        return environmentalDNA;
      },
      'createEnvironmentalDNA'
    );

    return result.success ? result.data : this.getFallbackEnvironmentalDNA();
  }

  /**
   * Analyze panel continuity for smooth visual flow between panels
   */
  async analyzePanelContinuity(storyBeats: any[]): Promise<any> {
    const result = await this.withErrorHandling(
      async () => {
        console.log('🔄 Analyzing panel continuity for visual flow...');
        
        const continuityPrompt = `You are a professional comic book layout designer. Analyze these story beats and create panel continuity guidelines for smooth visual flow.

STORY BEATS:
${JSON.stringify(storyBeats, null, 2)}

Create panel continuity analysis with:

1. PANEL FLOW MAPPING:
   - Character positioning across panels
   - Environmental transitions between scenes
   - Visual bridges between panels

2. CHARACTER MOVEMENT:
   - Primary character arc through panels
   - Spatial relationships between characters
   - Movement direction consistency

3. CAMERA MOVEMENT:
   - Zoom levels (close-up/medium/wide)
   - Angle changes (eye-level/high/low)
   - Perspective shifts

4. READING FLOW:
   - Panel composition for left-to-right reading
   - Visual rhythm and pacing
   - Balance between action and dialogue panels

Return as JSON:
{
  "panelFlow": [
    {
      "panelIndex": 0,
      "characterPositions": "description",
      "environmentalTransition": "description",
      "visualBridge": "description"
    }
  ],
  "characterMovementMap": {
    "primaryCharacterArc": "description",
    "spatialRelationships": "description"
  },
  "cameraMovement": {
    "zoomProgression": "description",
    "angleStrategy": "description"
  },
  "readingFlow": {
    "panelComposition": "description",
    "visualRhythm": "description"
  }
}`;

        const options = {
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are a professional comic book layout designer specializing in visual flow.' },
            { role: 'user', content: continuityPrompt }
          ],
          maxTokens: 800,
          temperature: 0.3,
          responseFormat: { type: 'json_object' }
        };

        const response = await this.makeOpenAIAPICall<any>(
          '/chat/completions',
          options,
          90000,
          'analyzePanelContinuity'
        );

        if (!response?.choices?.[0]?.message?.content) {
          throw new Error('No panel continuity content received from AI service');
        }

        const panelContinuity = JSON.parse(response.choices[0].message.content);
        
        console.log(`✅ Panel continuity analyzed: ${panelContinuity.panelFlow?.length || 0} panel transitions mapped`);
        
        return panelContinuity;
      },
      'analyzePanelContinuity'
    );

    return result.success ? result.data : this.getFallbackPanelContinuity();
  }

  /**
   * Build environmentally aware prompt by enriching the base prompt with environmental context
   * This maintains interface segregation by enhancing prompts rather than changing interfaces
   */
  private buildEnvironmentallyAwarePrompt(
    basePrompt: string,
    environmentalContext: any,
    panelIndex?: number
  ): string {
    if (!environmentalContext || environmentalContext.fallback) {
      return basePrompt;
    }

    const envDNA = environmentalContext.environmentalDNA;
    const continuity = environmentalContext.panelContinuity;
    
    if (!envDNA) {
      return basePrompt;
    }

    // Build environmental enhancement
    let environmentalEnhancement = '';
    
    // Add location context
    if (envDNA.primaryLocation) {
      environmentalEnhancement += `\n\nENVIRONMENTAL CONTEXT:
Setting: ${envDNA.primaryLocation.name} (${envDNA.primaryLocation.type})
Key Features: ${envDNA.primaryLocation.keyFeatures?.join(', ') || 'Standard features'}
Color Palette: ${envDNA.primaryLocation.colorPalette?.join(', ') || 'Natural colors'}`;
    }
    
    // Add lighting context
    if (envDNA.lightingContext) {
      environmentalEnhancement += `
Lighting: ${envDNA.lightingContext.timeOfDay || 'afternoon'} lighting with ${envDNA.lightingContext.lightingMood || 'bright'} mood
Weather: ${envDNA.lightingContext.weatherCondition || 'clear'} conditions
Shadows: ${envDNA.lightingContext.shadowDirection || 'natural'} shadow direction`;
    }
    
    // Add visual continuity
    if (envDNA.visualContinuity) {
      environmentalEnhancement += `
Background Elements: ${envDNA.visualContinuity.backgroundElements?.join(', ') || 'Consistent backgrounds'}
Color Consistency: ${envDNA.visualContinuity.colorConsistency || 'natural'} color scheme
Perspective: ${envDNA.visualContinuity.perspectiveGuidelines || 'eye-level'} perspective`;
    }
    
    // Add atmospheric elements
    if (envDNA.atmosphericElements) {
      environmentalEnhancement += `
Atmosphere: ${envDNA.atmosphericElements.environmentalMood || 'neutral'} mood
Ambient Effects: ${envDNA.atmosphericElements.ambientEffects?.join(', ') || 'None'}`;
    }
    
    // Add panel continuity if available
    if (continuity && typeof panelIndex === 'number' && continuity.panelFlow?.[panelIndex]) {
      const panelFlow = continuity.panelFlow[panelIndex];
      environmentalEnhancement += `

PANEL CONTINUITY:
Character Positioning: ${panelFlow.characterPositions || 'Natural positioning'}
Environmental Transition: ${panelFlow.environmentalTransition || 'Smooth transition'}
Visual Bridge: ${panelFlow.visualBridge || 'Consistent flow'}`;
    }
    
    // Add environmental consistency requirements
    environmentalEnhancement += `

ENVIRONMENTAL CONSISTENCY REQUIREMENTS:
- Maintain consistent lighting and weather throughout
- Use established color palette for backgrounds
- Keep environmental elements consistent with previous panels
- Ensure smooth visual flow and continuity
- Target 85-90% environmental consistency`;

    return basePrompt + environmentalEnhancement;
  }

  /**
   * Fallback environmental DNA for reliability
   */
  private getFallbackEnvironmentalDNA(): any {
    return {
      primaryLocation: {
        name: 'Generic Setting',
        type: 'mixed',
        description: 'A versatile setting suitable for the story',
        keyFeatures: ['natural lighting', 'appropriate backgrounds'],
        colorPalette: ['#87CEEB', '#90EE90', '#F5DEB3'] // Sky blue, light green, wheat
      },
      lightingContext: {
        timeOfDay: 'afternoon',
        weatherCondition: 'clear',
        lightingMood: 'bright',
        shadowDirection: 'natural'
      },
      visualContinuity: {
        backgroundElements: ['consistent backgrounds'],
        colorConsistency: 'natural',
        perspectiveGuidelines: 'eye-level'
      },
      atmosphericElements: {
        ambientEffects: [],
        environmentalMood: 'neutral',
        seasonalContext: 'temperate'
      },
      fallback: true
    };
  }

  /**
   * Fallback panel continuity for reliability
   */
  private getFallbackPanelContinuity(): any {
    return {
      panelFlow: [],
      characterMovementMap: {
        primaryCharacterArc: 'Natural character progression',
        spatialRelationships: 'Consistent positioning'
      },
      cameraMovement: {
        zoomProgression: 'Varied zoom levels',
        angleStrategy: 'Eye-level perspective'
      },
      readingFlow: {
        panelComposition: 'Left-to-right reading flow',
        visualRhythm: 'Balanced pacing'
      },
      fallback: true
    };
  }

  // ===== ENHANCED STORY ANALYSIS WITH DIALOGUE EXTRACTION =====

  // ===== OPENAI PARAMETER TRANSFORMATION LAYER =====

  /**
   * Transform TypeScript camelCase parameters to OpenAI snake_case format
   * Industry standard approach used by Google/AWS SDKs
   */
  private transformOpenAIParameters(params: any): any {
    const transformed = { ...params };
    
    // Transform maxTokens to max_tokens
    if (transformed.maxTokens !== undefined) {
      transformed.max_tokens = transformed.maxTokens;
      delete transformed.maxTokens;
    }
    
    // Transform responseFormat to response_format
    if (transformed.responseFormat !== undefined) {
      transformed.response_format = transformed.responseFormat;
      delete transformed.responseFormat;
    }
    
    // Transform topP to top_p
    if (transformed.topP !== undefined) {
      transformed.top_p = transformed.topP;
      delete transformed.topP;
    }
    
    // Transform frequencyPenalty to frequency_penalty
    if (transformed.frequencyPenalty !== undefined) {
      transformed.frequency_penalty = transformed.frequencyPenalty;
      delete transformed.frequencyPenalty;
    }
    
    // Transform presencePenalty to presence_penalty
    if (transformed.presencePenalty !== undefined) {
      transformed.presence_penalty = transformed.presencePenalty;
      delete transformed.presencePenalty;
    }
    
    return transformed;
  }

  /**
   * Centralized OpenAI API call handler with parameter transformation
   * Prevents parameter format bugs and provides consistent error handling
   */
  private async makeOpenAIAPICall<T>(
    endpoint: string,
    params: any,
    timeout: number,
    operationName: string
  ): Promise<T> {
    const transformedParams = this.transformOpenAIParameters(params);
    
    return this.makeRequest<T>(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(transformedParams),
      },
      timeout,
      operationName
    );
  }

  /**
   * Extract dialogue from story and assign speech bubbles to 30-40% of panels strategically
   */
  async extractDialogueFromStory(story: string, storyAnalysis: StoryAnalysis, audience: AudienceType): Promise<StoryAnalysis> {
    console.log('🎭 Extracting dialogue and assigning speech bubbles strategically...');

    const targetDialoguePanels = Math.round(storyAnalysis.storyBeats.length * (this.speechBubbleConfig.targetDialoguePercentage / 100));
    
    // Step 1: Detect existing dialogue patterns in the story
    const existingDialogue = this.detectDialogueInStory(story);
    
    // Step 2: Enhance story beats with speech bubble information
    const enhancedBeats: StoryBeat[] = [];
    let dialoguePanelCount = 0;
    const speechBubbleDistribution: Record<string, number> = {
      standard: 0,
      thought: 0,
      shout: 0,
      whisper: 0,
      narrative: 0
    };

    // Step 3: Score each beat for dialogue potential
    const beatScores = storyAnalysis.storyBeats.map((beat, index) => ({
      index,
      beat,
      score: this.calculateDialogueScore(beat, index, storyAnalysis.storyBeats.length),
      hasExistingDialogue: existingDialogue.some(d => d.beatIndex === index)
    }));

    // Step 4: Sort by score and assign dialogue to top candidates
    beatScores.sort((a, b) => b.score - a.score);

    for (let i = 0; i < storyAnalysis.storyBeats.length; i++) {
      const originalBeat = storyAnalysis.storyBeats[i];
      const beatScore = beatScores.find(bs => bs.index === i);
      
      let enhancedBeat: StoryBeat = { ...originalBeat };

      // Determine if this panel should have dialogue
      const shouldHaveDialogue = this.shouldPanelHaveDialogue(
        beatScore!,
        dialoguePanelCount,
        targetDialoguePanels,
        existingDialogue
      );

      if (shouldHaveDialogue && dialoguePanelCount < targetDialoguePanels) {
        // Find existing dialogue or generate new dialogue
        const existingDialogueForBeat = existingDialogue.find(d => d.beatIndex === i);
        let dialogue = '';

        if (existingDialogueForBeat) {
          dialogue = existingDialogueForBeat.text;
        } else {
          dialogue = await this.generateContextualDialogue(originalBeat, audience);
        }

        // Clean and format dialogue
        const cleanedDialogue = this.cleanDialogue(dialogue);
        const speechBubbleStyle = this.determineSpeechBubbleStyle(originalBeat.emotion, dialogue);

        enhancedBeat = {
          ...originalBeat,
          dialogue: cleanedDialogue,
          hasSpeechBubble: true,
          speechBubbleStyle,
          cleanedDialogue
        };

        dialoguePanelCount++;
        speechBubbleDistribution[speechBubbleStyle]++;

        console.log(`🎭 Panel ${i + 1}: Added ${speechBubbleStyle} speech bubble - "${cleanedDialogue}"`);
      } else {
        enhancedBeat = {
          ...originalBeat,
          hasSpeechBubble: false
        };
      }

      enhancedBeats.push(enhancedBeat);
    }

    console.log(`✅ Speech bubble assignment complete: ${dialoguePanelCount}/${targetDialoguePanels} panels have dialogue`);
    console.log(`📊 Speech bubble distribution:`, speechBubbleDistribution);

    return {
      ...storyAnalysis,
      storyBeats: enhancedBeats,
      dialoguePanels: dialoguePanelCount,
      speechBubbleDistribution
    };
  }

  // ===== ENHANCED COMIC BOOK GENERATION METHODS =====

  /**
   * Create Environmental DNA for consistent world-building across panels
   * Extracts locations, lighting, weather, time-of-day from story analysis
   */
  async createEnvironmentalDNA(
    storyAnalysis: any,
    audience: AudienceType
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      console.log('🌍 Creating Environmental DNA for consistent world-building...');
      
      const environmentalPrompt = `You are a professional comic book environmental designer. Analyze this story and create consistent environmental DNA for all panels.

STORY ANALYSIS:
${JSON.stringify(storyAnalysis, null, 2)}

AUDIENCE: ${audience}

Create comprehensive environmental DNA that ensures 85-90% consistency across all panels. Return your response as valid JSON in this exact format:

{
  "primaryLocation": {
    "name": "Main setting name",
    "type": "indoor/outdoor/mixed",
    "description": "Detailed visual description",
    "keyFeatures": ["feature1", "feature2", "feature3"],
    "colorPalette": ["#color1", "#color2", "#color3"],
    "architecturalStyle": "Style description"
  },
  "secondaryLocations": [
    {
      "name": "Secondary location name",
      "type": "indoor/outdoor/mixed",
      "description": "Visual description",
      "transitionFrom": "primary/other location",
      "keyFeatures": ["feature1", "feature2"]
    }
  ],
  "lightingContext": {
    "timeOfDay": "morning/afternoon/evening/night",
    "weatherCondition": "sunny/cloudy/rainy/stormy/snowy",
    "lightingMood": "bright/warm/dramatic/mysterious/soft",
    "shadowDirection": "left/right/overhead/backlit",
    "consistencyRules": ["rule1", "rule2", "rule3"]
  },
  "visualContinuity": {
    "backgroundElements": ["element1", "element2", "element3"],
    "recurringObjects": ["object1", "object2"],
    "colorConsistency": {
      "dominantColors": ["#color1", "#color2"],
      "accentColors": ["#color3", "#color4"],
      "avoidColors": ["#color5", "#color6"]
    },
    "perspectiveGuidelines": "Camera angle and perspective rules"
  },
  "atmosphericElements": {
    "ambientEffects": ["effect1", "effect2"],
    "particleEffects": ["particles if any"],
    "environmentalMood": "overall emotional tone",
    "seasonalContext": "spring/summer/fall/winter/none"
  },
  "panelTransitions": {
    "movementFlow": "How characters move through space",
    "cameraMovement": "How perspective changes between panels",
    "spatialRelationships": "How locations connect to each other"
  }
}

CRITICAL REQUIREMENTS:
- Extract actual locations and settings from the story
- Ensure lighting and weather consistency throughout
- Create visual rules that maintain 85-90% environmental consistency
- Consider ${audience} audience for appropriate environmental complexity
- Plan for smooth visual transitions between panels
- Include specific color palettes for consistency`;

      const options = {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: environmentalPrompt
          }
        ],
        maxTokens: 2000,
        temperature: 0.3, // Lower temperature for consistency
        responseFormat: { type: 'json_object' }
      };

      const result = await this.makeOpenAIAPICall<any>(
        '/chat/completions',
        options,
        120000, // 2 minutes timeout
        'createEnvironmentalDNA'
      );

      if (!result.choices?.[0]?.message?.content) {
        throw new Error('No environmental DNA content received from OpenAI');
      }

      const environmentalDNA = JSON.parse(result.choices[0].message.content);
      
      // Validate environmental DNA structure
      if (!environmentalDNA.primaryLocation || !environmentalDNA.lightingContext) {
        throw new Error('Invalid environmental DNA structure received');
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Environmental DNA created successfully in ${duration}ms`);
      console.log(`🌍 Primary Location: ${environmentalDNA.primaryLocation.name}`);
      console.log(`☀️ Lighting: ${environmentalDNA.lightingContext.timeOfDay} - ${environmentalDNA.lightingContext.lightingMood}`);
      
      return {
        ...environmentalDNA,
        metadata: {
          createdAt: new Date().toISOString(),
          processingTime: duration,
          audience: audience,
          consistencyTarget: '85-90%'
        }
      };

    } catch (error: any) {
      console.error('❌ Environmental DNA creation failed:', error);
      
      // Return fallback environmental DNA to prevent workflow failure
      return {
        primaryLocation: {
          name: 'Generic Setting',
          type: 'mixed',
          description: 'A versatile environment suitable for the story',
          keyFeatures: ['open space', 'natural lighting', 'neutral background'],
          colorPalette: ['#87CEEB', '#F5F5DC', '#8FBC8F'],
          architecturalStyle: 'Simple and clean'
        },
        lightingContext: {
          timeOfDay: 'afternoon',
          weatherCondition: 'sunny',
          lightingMood: 'bright',
          shadowDirection: 'left',
          consistencyRules: ['Maintain consistent lighting direction', 'Keep shadows soft']
        },
        visualContinuity: {
          backgroundElements: ['sky', 'ground', 'horizon'],
          recurringObjects: [],
          colorConsistency: {
            dominantColors: ['#87CEEB', '#F5F5DC'],
            accentColors: ['#8FBC8F'],
            avoidColors: ['#FF0000', '#000000']
          }
        },
        fallback: true,
        error: error.message
      };
    }
  }

  /**
   * Analyze panel continuity for cross-panel relationship mapping
   * Plans character movement and environmental transitions
   */
  async analyzePanelContinuity(storyBeats: any[]): Promise<any> {
    const startTime = Date.now();
    
    try {
      console.log('🔄 Analyzing panel continuity for visual flow...');
      
      const continuityPrompt = `You are a professional comic book layout artist. Analyze these story beats and create a continuity map for seamless visual flow between panels.

STORY BEATS:
${JSON.stringify(storyBeats, null, 2)}

Create a comprehensive continuity analysis. Return your response as valid JSON in this exact format:

{
  "panelFlow": [
    {
      "panelIndex": 0,
      "characterPositions": {
        "mainCharacter": "left/center/right/background",
        "secondaryCharacters": ["position1", "position2"],
        "movementDirection": "entering/exiting/static/moving_left/moving_right"
      },
      "environmentalTransition": {
        "locationChange": true/false,
        "cameraAngle": "close-up/medium/wide/establishing",
        "perspectiveShift": "none/slight/dramatic",
        "continuityElements": ["element1", "element2"]
      },
      "visualBridge": {
        "connectsToPrevious": "How this panel connects to previous",
        "connectsToNext": "How this panel connects to next",
        "transitionType": "cut/fade/zoom/pan/match_cut"
      }
    }
  ],
  "characterMovementMap": {
    "primaryCharacterArc": "Overall movement pattern through story",
    "spatialRelationships": "How characters relate to each other spatially",
    "consistencyRules": ["rule1", "rule2", "rule3"]
  },
  "environmentalTransitions": {
    "locationChanges": [
      {
        "fromPanel": 0,
        "toPanel": 1,
        "transitionType": "smooth/cut/establishing",
        "bridgingElements": ["element1", "element2"]
      }
    ],
    "cameraMovement": "Overall camera movement strategy",
    "visualCohesion": "How to maintain visual unity"
  },
  "panelComposition": {
    "readingFlow": "How panels guide reader's eye",
    "balanceStrategy": "Visual weight distribution",
    "rhythmPattern": "Pacing through panel sizes and layouts"
  }
}

CRITICAL REQUIREMENTS:
- Plan smooth character movement between panels
- Ensure environmental consistency across location changes
- Create visual bridges that connect panels seamlessly
- Consider comic book reading flow and pacing
- Maintain spatial relationships and character positioning
- Plan camera angles for optimal storytelling`;

      const options = {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: continuityPrompt
          }
        ],
        maxTokens: 1500,
        temperature: 0.2, // Very low temperature for consistency
        responseFormat: { type: 'json_object' }
      };

      const result = await this.makeOpenAIAPICall<any>(
        '/chat/completions',
        options,
        90000, // 1.5 minutes timeout
        'analyzePanelContinuity'
      );

      if (!result.choices?.[0]?.message?.content) {
        throw new Error('No panel continuity analysis received from OpenAI');
      }

      const continuityAnalysis = JSON.parse(result.choices[0].message.content);
      
      // Validate continuity analysis structure
      if (!continuityAnalysis.panelFlow || !continuityAnalysis.characterMovementMap) {
        throw new Error('Invalid continuity analysis structure received');
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Panel continuity analysis completed in ${duration}ms`);
      console.log(`🔄 Analyzed ${continuityAnalysis.panelFlow.length} panel transitions`);
      
      return {
        ...continuityAnalysis,
        metadata: {
          createdAt: new Date().toISOString(),
          processingTime: duration,
          panelCount: storyBeats.length
        }
      };

    } catch (error: any) {
      console.error('❌ Panel continuity analysis failed:', error);
      
      // Return basic continuity fallback
      return {
        panelFlow: storyBeats.map((_, index) => ({
          panelIndex: index,
          characterPositions: {
            mainCharacter: 'center',
            movementDirection: 'static'
          },
          environmentalTransition: {
            locationChange: false,
            cameraAngle: 'medium',
            perspectiveShift: 'none'
          },
          visualBridge: {
            transitionType: 'cut'
          }
        })),
        characterMovementMap: {
          primaryCharacterArc: 'Standard progression through story',
          consistencyRules: ['Maintain character positioning', 'Keep camera angles consistent']
        },
        fallback: true,
        error: error.message
      };
    }
  }

  // ===== ENHANCED CHARACTER DNA SYSTEM =====

  async createMasterCharacterDNA(imageUrl: string, artStyle: string): Promise<CharacterDNA> {
    console.log('🧬 Creating professional character DNA for maximum consistency...');

    const prompt = `You are a professional comic book character designer creating a detailed character model sheet for consistent comic book illustration.

CRITICAL MISSION: Analyze this person's appearance with extreme detail to ensure 100% character consistency across all comic book panels.

REQUIRED ANALYSIS DEPTH:
1. FACIAL STRUCTURE: Exact face shape, jawline definition, cheekbone structure, forehead characteristics
2. EYE DETAILS: Precise color, shape, size, eyebrow style, eyelash length, eye spacing
3. HAIR SPECIFICATIONS: Exact color with highlights/lowlights, texture (straight/wavy/curly), length, style, hairline shape
4. SKIN CHARACTERISTICS: Tone, texture, any distinctive marks, freckles, scars, birthmarks
5. BODY TYPE: Height estimation, build, proportions, posture tendencies
6. CLOTHING ANALYSIS: Specific garments, exact colors, patterns, fit, accessories
7. UNIQUE IDENTIFIERS: Any distinctive features that make this person immediately recognizable
8. EXPRESSION PATTERNS: Default facial expression, smile characteristics, eyebrow position

COMIC BOOK ADAPTATION REQUIREMENTS:
- How to maintain these exact features in ${artStyle} art style
- Key features that must NEVER change across panels
- Specific details that ensure immediate character recognition
- Consistency enforcers to prevent AI variations

OUTPUT REQUIREMENTS:
Create a comprehensive character DNA that prevents any character variations in comic generation.
Focus on features that are most likely to vary and provide specific prevention measures.

This character model sheet will be used to ensure identical appearance across all comic book panels.

Analyze the provided image and create a detailed character DNA profile.`;

    const options = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: [
            { 
              type: 'text', 
              text: 'Create a detailed professional character model sheet from this image. Focus on preventing character variations in comic book generation.' 
            },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      max_tokens: 800,
    };

    const result = await this.makeOpenAIAPICall<any>(
      '/chat/completions',
      options,
      120000,
      'createMasterCharacterDNA'
    );

    if (!result?.choices?.[0]?.message?.content) {
      throw new Error('Failed to generate character DNA - no analysis received');
    }

    const analysisText = result.choices[0].message.content;
    
    // Parse the analysis into structured DNA
    const characterDNA: CharacterDNA = {
      physicalStructure: {
        faceShape: this.extractDetail(analysisText, 'face shape', 'oval face with defined features'),
        eyeDetails: this.extractDetail(analysisText, 'eye', 'medium brown eyes with natural arch eyebrows'),
        hairSpecifics: this.extractDetail(analysisText, 'hair', 'shoulder-length brown hair with natural texture'),
        skinTone: this.extractDetail(analysisText, 'skin', 'medium skin tone with healthy complexion'),
        bodyType: this.extractDetail(analysisText, 'body', 'average height with proportional build'),
        facialMarks: this.extractDetail(analysisText, 'marks|freckle|scar', 'natural facial features')
      },
      clothingSignature: {
        primaryOutfit: this.extractDetail(analysisText, 'clothing|shirt|jacket', 'casual comfortable clothing'),
        accessories: this.extractDetail(analysisText, 'accessory|jewelry|watch', 'minimal accessories'),
        colorPalette: this.extractDetail(analysisText, 'color', 'earth tone color palette'),
        footwear: this.extractDetail(analysisText, 'shoe|foot', 'casual footwear')
      },
      uniqueIdentifiers: {
        distinctiveFeatures: this.extractDetail(analysisText, 'distinctive|unique', 'friendly approachable appearance'),
        expressions: this.extractDetail(analysisText, 'expression|smile', 'warm genuine smile'),
        posture: this.extractDetail(analysisText, 'posture|stance', 'confident relaxed posture'),
        mannerisms: this.extractDetail(analysisText, 'manner|gesture', 'natural friendly demeanor')
      },
      artStyleAdaptation: {
        [artStyle]: `Maintain all physical features in ${artStyle} style while preserving character identity`,
        consistencyRule: `Adapt to ${artStyle} art style without changing core character features`,
        styleGuideline: `${artStyle} interpretation must keep character immediately recognizable`
      },
      consistencyEnforcers: [
        'IDENTICAL character across all panels',
        'EXACT same facial features and expressions',
        'CONSISTENT clothing and accessories', 
        'UNCHANGING character proportions',
        'MAINTAINED character identity',
        'SAME character throughout story'
      ],
      negativePrompts: [
        'no aging or age changes',
        'no facial hair additions or changes',
        'no clothing variations or outfit changes',
        'no facial feature alterations',
        'no body type modifications',
        'no personality changes',
        'no style inconsistencies'
      ]
    };

    console.log('✅ Professional character DNA created with maximum consistency protocols');
    return characterDNA;
  }

  private extractDetail(text: string, pattern: string, fallback: string): string {
    const regex = new RegExp(`(${pattern}).*?[.!]`, 'gi');
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      return matches[0].replace(/^[^a-zA-Z]*/, '').trim();
    }
    return fallback;
  }

  // ===== PROFESSIONAL STORY BEAT ANALYSIS =====

  async analyzeStoryStructure(story: string, audience: AudienceType): Promise<StoryAnalysis> {
    const result = await this.withErrorHandling(
      async () => {
        console.log(`🔍 Analyzing story structure for ${audience} audience with professional comic methodology...`);
        console.log('📍 Including environmental context extraction for world consistency...');
        
        const storyAnalysisPrompt = `You are a professional comic book story analyst and environmental designer. Analyze this story for ${audience} audience and create structured story beats with environmental context.

AUDIENCE: ${audience.toUpperCase()}
TARGET PANELS: ${this.audienceConfig[audience].totalPanels}
COMPLEXITY: ${this.audienceConfig[audience].complexityLevel}

ANALYSIS REQUIREMENTS:
${this.audienceConfig[audience].analysisInstructions}

STORY TO ANALYZE:
${story}

Create story beats optimized for comic book panels with environmental context and dialogue integration:

1. ENVIRONMENTAL ANALYSIS:
   Extract and identify:
   - Primary locations and settings
   - Time of day and weather conditions
   - Environmental mood and atmosphere
   - Visual themes and consistency elements

2. STORY BEATS ANALYSIS:
   For each story beat, provide:
   - description: Clear scene description
   - emotion: Primary emotion (happy, sad, excited, scared, surprised, angry, peaceful, curious)
   - imagePrompt: Detailed visual description for image generation
   - setting: Specific location/environment for this beat
   - environmentalMood: Atmosphere and mood of the environment
   - panelType: standard/wide/tall/splash based on story importance
   - hasSpeechBubble: true/false based on dialogue needs
   - dialogue: Character dialogue if hasSpeechBubble is true

3. DIALOGUE INTEGRATION:
   - Identify natural dialogue moments
   - Assign speech bubbles to 30-40% of panels strategically
   - Focus on emotional peaks and character interactions
   - Ensure dialogue enhances story progression

Return as JSON:
{
  "storyAnalysis": {
    "storyBeats": [
      {
        "description": "Scene description",
        "emotion": "happy",
        "imagePrompt": "Detailed visual prompt",
        "setting": "Specific location",
        "environmentalMood": "Atmosphere description",
        "panelType": "standard",
        "hasSpeechBubble": true,
        "dialogue": "Character speech"
      }
    ],
    "dialoguePanels": 3,
    "totalPanels": 8,
    "primaryLocations": ["location1", "location2"],
    "environmentalThemes": ["theme1", "theme2"],
    "audienceOptimized": true
  }
}`;

        const options = {
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are a professional comic book story analyst specializing in environmental consistency and dialogue integration.' },
            { role: 'user', content: storyAnalysisPrompt }
          ],
          maxTokens: 2000,
          temperature: 0.7,
          responseFormat: { type: 'json_object' }
        };

        const response = await this.makeOpenAIAPICall<any>(
          '/chat/completions',
          options,
          120000,
          'analyzeStoryStructure'
        );

        if (!response?.choices?.[0]?.message?.content) {
          throw new Error('No story analysis content received from AI service');
        }

        const analysisResult = JSON.parse(response.choices[0].message.content);
        
        // Extract dialogue from story beats
        const enhancedResult = await this.extractDialogueFromStory(analysisResult, audience);
        
        console.log(`✅ Story analysis with environmental context complete: ${enhancedResult.storyBeats?.length || 0} beats, ${enhancedResult.dialoguePanels || 0} dialogue panels`);
        console.log(`🌍 Environmental themes: ${enhancedResult.environmentalThemes?.join(', ') || 'General'}`);
        console.log(`📍 Primary locations: ${enhancedResult.primaryLocations?.join(', ') || 'Mixed settings'}`);
        
        return enhancedResult;
      },
      'analyzeStoryStructure'
    );

    return result.success ? result.data : this.getFallbackStoryAnalysis(audience);
  }

  private adjustStoryBeats(beats: StoryBeat[], targetCount: number): StoryBeat[] {
    if (beats.length === targetCount) return beats;
    
    if (beats.length > targetCount) {
      // Too many beats - keep most important ones
      return beats.slice(0, targetCount);
    } else {
      // Too few beats - expand key moments
      const expandedBeats = [...beats];
      while (expandedBeats.length < targetCount) {
        // Duplicate and modify key emotional moments
        const indexToExpand = Math.floor(expandedBeats.length / 2);
        const beatToExpand = expandedBeats[indexToExpand];
        expandedBeats.splice(indexToExpand + 1, 0, {
          ...beatToExpand,
          beat: `${beatToExpand.beat}_reaction`,
          panelPurpose: `reaction_to_${beatToExpand.panelPurpose}`,
          visualPriority: 'character_reaction'
        });
      }
      return expandedBeats;
    }
  }

  // ===== AI OPERATIONS IMPLEMENTATION =====

  async generateStory(prompt: string, options: StoryGenerationOptions = {}): Promise<string> {
    const options_obj = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.8,
    };

    const result = await this.makeOpenAIAPICall<any>(
      '/chat/completions',
      options_obj,
      90000,
      'generateStory'
    );

    if (!result?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI API - no content received');
    }

    return result.choices[0].message.content;
  }

  async generateStoryWithOptions(storyOptions: StoryGenerationOptions): Promise<StoryGenerationResult> {
    const {
      genre = 'adventure',
      characterDescription = 'a young protagonist',
      audience = 'children',
      temperature = 0.8,
      maxTokens = 2000,
      model = 'gpt-4'
    } = storyOptions;

    const prompt = this.buildStoryPrompt(genre, characterDescription, audience);
    
    const options = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: storyOptions.maxTokens || 1500,
      temperature: storyOptions.temperature || 0.8,
    };

    const result = await this.makeOpenAIAPICall<any>(
      '/chat/completions',
      options,
      90000,
      'generateStoryWithOptions'
    );

    if (!result?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI API - no content received');
    }

    const generatedStory = result.choices[0].message.content;
    const wordCount = generatedStory.split(/\s+/).length;
    
    return {
      story: generatedStory,
      title: `${genre.charAt(0).toUpperCase() + genre.slice(1)} Story`,
      wordCount,
    };
  }

  // ===== PROFESSIONAL COMIC BOOK SCENE GENERATION =====

  async generateScenesWithAudience(options: SceneGenerationOptions): Promise<SceneGenerationResult> {
    const {
      story,
      audience = 'children',
      characterImage,
      characterArtStyle = 'storybook',
      layoutType = 'comic-book-panels'
    } = options;

    if (!story || story.trim().length < 50) {
      throw new Error('Story must be at least 50 characters long.');
    }

    console.log(`🎨 Generating professional comic book layout for ${audience} audience...`);

    // Step 1: Analyze story structure using professional methodology
    const storyAnalysis = await this.analyzeStoryStructure(story, audience);
    
    // Step 2: Create character DNA if character image provided
    let characterDNA: CharacterDNA | null = null;
    if (characterImage) {
      characterDNA = await this.createMasterCharacterDNA(characterImage, characterArtStyle);
    }

    // Step 3: Generate professional comic book pages
    const config = this.audienceConfig[audience];
    const pages = await this.generateComicBookPages(storyAnalysis, characterDNA, config, characterArtStyle);

    console.log(`✅ Professional comic book layout generated: ${pages.length} pages with ${config.totalPanels} total panels`);

    return {
      pages,
      audience,
      characterImage,
      layoutType,
      characterArtStyle,
      metadata: {
        discoveryPath: 'professional_comic_generation',
        patternType: 'direct',
        qualityScore: 100,
        originalStructure: ['professional_story_analysis', 'character_dna_system', 'comic_book_pages'],
        storyBeats: storyAnalysis.storyBeats.length,
        characterConsistencyEnabled: !!characterDNA,
        professionalStandards: true,
        dialoguePanels: storyAnalysis.dialoguePanels || 0,
        speechBubbleDistribution: storyAnalysis.speechBubbleDistribution || {}
      }
    };
  }

  private async generateComicBookPages(
    storyAnalysis: StoryAnalysis, 
    characterDNA: CharacterDNA | null, 
    config: any, 
    artStyle: string
  ): Promise<any[]> {
    const pages = [];
    const beatsPerPage = Math.ceil(storyAnalysis.storyBeats.length / config.pagesPerStory);

    for (let pageNum = 1; pageNum <= config.pagesPerStory; pageNum++) {
      const startBeat = (pageNum - 1) * beatsPerPage;
      const endBeat = Math.min(startBeat + beatsPerPage, storyAnalysis.storyBeats.length);
      const pageBeats = storyAnalysis.storyBeats.slice(startBeat, endBeat);

      // Ensure exactly the right number of panels per page
      while (pageBeats.length < config.panelsPerPage && storyAnalysis.storyBeats.length > endBeat) {
        pageBeats.push(storyAnalysis.storyBeats[endBeat + pageBeats.length - beatsPerPage]);
      }
      
      if (pageBeats.length > config.panelsPerPage) {
        pageBeats.splice(config.panelsPerPage);
      }

      const pageScenes = pageBeats.map((beat, panelIndex) => ({
        description: beat.beat,
        emotion: beat.emotion,
        imagePrompt: this.buildProfessionalPanelPrompt(beat, characterDNA, artStyle, config),
        panelType: this.determinePanelType(panelIndex, config.panelsPerPage),
        characterAction: beat.characterAction,
        narrativePurpose: beat.panelPurpose,
        visualPriority: beat.visualPriority,
        dialogue: beat.dialogue,
        hasSpeechBubble: beat.hasSpeechBubble || false,
        speechBubbleStyle: beat.speechBubbleStyle,
        panelNumber: panelIndex + 1,
        pageNumber: pageNum
      }));

      pages.push({
        pageNumber: pageNum,
        scenes: pageScenes,
        layoutType: config.panelLayout,
        characterArtStyle: artStyle,
        panelCount: pageScenes.length,
        dialoguePanels: pageScenes.filter(scene => scene.hasSpeechBubble).length
      });
    }

    return pages;
  }

  private buildProfessionalPanelPrompt(
    beat: StoryBeat, 
    characterDNA: CharacterDNA | null, 
    artStyle: string, 
    config: any
  ): string {
    const characterPrompt = characterDNA ? this.buildCharacterDNAPrompt(characterDNA, artStyle) : '';
    
    // ✅ ENHANCED: Speech bubble requirements based on beat.hasSpeechBubble
    let speechBubbleSection = '';
    
    if (beat.hasSpeechBubble && beat.dialogue) {
      const bubbleStyle = beat.speechBubbleStyle || 'standard';
      const dialogue = beat.cleanedDialogue || beat.dialogue;
      
      const bubbleStyleInstructions = {
        standard: 'Clean oval speech bubble with clear text, positioned near character\'s mouth',
        thought: 'Cloud-style thought bubble with scalloped edges, connected to character\'s head',
        shout: 'Jagged, explosive speech bubble with bold text for loud/excited speech',
        whisper: 'Dashed outline speech bubble with smaller text for quiet speech',
        narrative: 'Rectangular caption box for story narration, positioned at top or bottom of panel'
      };
      
      speechBubbleSection = `
CRITICAL SPEECH BUBBLE REQUIREMENTS:
- MANDATORY: Include ${bubbleStyle} speech bubble in this panel
- DIALOGUE TEXT: "${dialogue}"
- BUBBLE STYLE: ${bubbleStyleInstructions[bubbleStyle as keyof typeof bubbleStyleInstructions]}
- POSITIONING: Position speech bubble to not obscure important visual elements
- CHARACTER SIGHT LINE: Ensure character's mouth/head position supports speech bubble placement
- READABILITY: Speech bubble must be clearly readable with appropriate text size
- PROFESSIONAL QUALITY: Comic book industry standard speech bubble design
- INTEGRATION: Speech bubble should feel naturally integrated into the panel composition`;
    } else {
      speechBubbleSection = `
NO SPEECH BUBBLE REQUIRED:
- This panel focuses on visual storytelling without dialogue
- Emphasize character expressions and body language
- Use visual elements to convey emotion and narrative
- Ensure clear character positioning and environmental details
- Focus on advancing story through visual composition alone`;
    }
    
    return `PROFESSIONAL COMIC BOOK PANEL:

NARRATIVE PURPOSE: ${beat.panelPurpose}
STORY MOMENT: ${beat.beat}
CHARACTER ACTION: ${beat.characterAction}
EMOTIONAL STATE: ${beat.emotion}
VISUAL FOCUS: ${beat.visualPriority}
ENVIRONMENT: ${beat.environment}

${characterPrompt}

${speechBubbleSection}

COMIC BOOK PRODUCTION STANDARDS:
- Panel Style: ${config.panelLayout} for ${config.complexityLevel} storytelling
- Visual Flow: ${config.readingFlow}
- Art Style: ${artStyle} with professional comic book formatting
- Color Scheme: ${config.colorScheme}
- Panel Borders: Professional comic book gutters and panel separation
- Target Audience: Appropriate for ${config.complexityLevel} readers

TECHNICAL SPECIFICATIONS:
- Format: Professional comic book panel illustration
- Quality: Publication-ready comic book artwork
- Composition: ${config.visualStyle}

CRITICAL REQUIREMENTS:
- Character consistency across all panels
- Clear visual storytelling that advances narrative
- Professional comic book production quality`;
  }

  private buildCharacterDNAPrompt(characterDNA: CharacterDNA, artStyle: string): string {
    return `CHARACTER CONSISTENCY PROTOCOL - MAXIMUM IMPORTANCE:

PHYSICAL STRUCTURE (NEVER ALTER):
- Face: ${characterDNA.physicalStructure.faceShape}
- Eyes: ${characterDNA.physicalStructure.eyeDetails}
- Hair: ${characterDNA.physicalStructure.hairSpecifics}
- Skin: ${characterDNA.physicalStructure.skinTone}
- Body: ${characterDNA.physicalStructure.bodyType}
- Features: ${characterDNA.physicalStructure.facialMarks}

CLOTHING SIGNATURE (IDENTICAL EVERY PANEL):
- Outfit: ${characterDNA.clothingSignature.primaryOutfit}
- Accessories: ${characterDNA.clothingSignature.accessories}
- Colors: ${characterDNA.clothingSignature.colorPalette}
- Footwear: ${characterDNA.clothingSignature.footwear}

UNIQUE IDENTIFIERS (MAINTAIN EXACTLY):
- Distinctive: ${characterDNA.uniqueIdentifiers.distinctiveFeatures}
- Expression: ${characterDNA.uniqueIdentifiers.expressions}
- Posture: ${characterDNA.uniqueIdentifiers.posture}
- Mannerisms: ${characterDNA.uniqueIdentifiers.mannerisms}

ART STYLE ADAPTATION:
${characterDNA.artStyleAdaptation[artStyle] || `Maintain all features in ${artStyle} style`}

CONSISTENCY ENFORCEMENT:
${characterDNA.consistencyEnforcers.join('\n- ')}

STRICTLY FORBIDDEN:
${characterDNA.negativePrompts.join('\n- ')}

VERIFICATION: Character must be identical to previous panels in this comic book story.`;
  }

 private determinePanelType(panelIndex: number, totalPanels: number): PanelType {
  const { STANDARD, WIDE, TALL } = AIService.PANEL_CONSTANTS;
  
  if (totalPanels <= 2) {
    return panelIndex === 0 ? WIDE : STANDARD;
  } else if (totalPanels <= 4) {
    return panelIndex === totalPanels - 1 ? WIDE : STANDARD;
  } else {
    // Professional panel variety for complex layouts - type-safe switch pattern
    const typeIndex = panelIndex % 4;
    switch (typeIndex) {
      case 0: return STANDARD;
      case 1: return WIDE;
      case 2: return TALL;
      case 3: return STANDARD;
      default: return STANDARD; // Type safety guarantee
    }
  }
}

  // ===== ENHANCED SCENE IMAGE GENERATION =====

  async generateSceneImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const result = await this.withErrorHandling(
      async () => {
        console.log('🎨 Generating professional character-consistent comic panel...');
        
        // Enhanced prompt building with environmental awareness
        const enhancedPrompt = this.buildProfessionalPanelPrompt(
          options.image_prompt,
          options.character_description,
          options.emotion,
          options.audience,
          options.characterArtStyle || 'storybook',
          options.layoutType || 'comic-book-panels',
          options.panelType || 'standard',
          options.environmentalContext // Pass environmental context for prompt enhancement
        );
        
        const imageOptions = {
          model: 'dall-e-3',
          prompt: enhancedPrompt,
          size: '1024x1024',
          quality: 'standard',
          response_format: 'url'
        };

        const response = await this.makeOpenAIAPICall<any>(
          '/images/generations',
          imageOptions,
          180000,
          'generateSceneImage'
        );

        if (!response?.data?.[0]?.url) {
          throw new Error('No image URL received from AI service');
        }

        console.log('✅ Professional character-consistent comic panel generated');

        return {
          url: response.data[0].url,
          prompt_used: enhancedPrompt,
          reused: false,
        };
      },
      'generateSceneImage'
    );

    return result.success ? result.data : { url: '', prompt_used: options.image_prompt, reused: false };
  }

  private buildProfessionalPanelPrompt(
    image_prompt: string,
    character_description: string,
    emotion: string,
    audience: AudienceType,
    characterArtStyle: string = 'storybook',
    layoutType: string = 'comic-book-panels',
    panelType: PanelType = 'standard',
    environmentalContext?: any
  ): string {
    // First, enhance the base prompt with environmental context if available
    const environmentallyAwarePrompt = environmentalContext 
      ? this.buildEnvironmentallyAwarePrompt(image_prompt, environmentalContext)
      : image_prompt;
    
    const audienceConfig = this.getAudienceConfiguration(audience);
    const artStyleConfig = this.getArtStyleConfiguration(characterArtStyle);
    const layoutConfig = this.getLayoutConfiguration(layoutType);
    const panelConfig = this.getPanelConfiguration(panelType);

    return `PROFESSIONAL COMIC BOOK PANEL GENERATION:

SCENE DESCRIPTION:
${environmentallyAwarePrompt}

CHARACTER REQUIREMENTS:
${character_description}
Emotional State: ${emotion}

COMIC BOOK PRODUCTION STANDARDS:
- Professional ${characterArtStyle} art style with ${audienceConfig.artComplexity} detail level
- ${layoutConfig.panelStyle} panel composition optimized for ${audience} audience
- ${audienceConfig.colorPalette} color palette with ${audienceConfig.lightingStyle} lighting
${environmentalContext && !environmentalContext.fallback ? '- Environmental consistency maintained with established world-building' : ''}
- Character consistency: ${character_description}
- Emotional tone: ${emotion} expression and body language
- Panel type: ${panelType} (${this.getPanelTypeDescription(panelType)})

TECHNICAL SPECIFICATIONS:
- Format: Professional comic book panel illustration
- Quality: Publication-ready comic book artwork
- Composition: ${panelConfig.composition}
- Visual storytelling: Clear narrative progression

CRITICAL REQUIREMENTS:
- Avoid any inappropriate content for ${audience} audience
- Ensure professional comic book quality and composition
- Maintain character consistency throughout the scene
${environmentalContext && !environmentalContext.fallback ? '- Follow environmental DNA guidelines for world consistency' : ''}
- Use ${audienceConfig.safetyGuidelines} content guidelines`;
  }

  // ===== ENHANCED SCENE GENERATION WITH ENVIRONMENTAL CONTEXT =====

  private async generateScenesWithAudience(options: SceneGenerationOptions): Promise<SceneGenerationResult> {
    const result = await this.withErrorHandling(
      async () => {
        console.log(`🎬 Generating scenes for ${options.audience} audience with environmental consistency and professional methodology...`);
        
        const audienceConfig = this.getAudienceConfiguration(options.audience);
        const artStyleConfig = this.getArtStyleConfiguration(options.characterArtStyle || 'storybook');
        
        const scenePrompt = `You are a professional comic book creator generating scenes for ${options.audience} audience with environmental consistency.

STORY: ${options.story}
AUDIENCE: ${options.audience}
CHARACTER IMAGE: ${options.characterImage || 'No character image provided'}
CHARACTER ART STYLE: ${options.characterArtStyle || 'storybook'}
LAYOUT TYPE: ${options.layoutType || 'comic-book-panels'}
${options.enhancedContext ? 'ENHANCED CONTEXT: Environmental and character consistency enabled' : ''}

Create professional comic book scenes with:
1. Environmental consistency across all panels
2. Character consistency if character image provided
3. Age-appropriate content for ${options.audience} audience
4. Professional comic book layout and composition
5. Clear visual storytelling progression

Return as JSON with pages array containing scenes for each page.`;

        const sceneOptions = {
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are a professional comic book creator specializing in environmental consistency and character development.' },
            { role: 'user', content: scenePrompt }
          ],
          maxTokens: 2000,
          temperature: 0.7,
          responseFormat: { type: 'json_object' }
        };

        const response = await this.makeOpenAIAPICall<any>(
          '/chat/completions',
          sceneOptions,
          120000,
          'generateScenesWithAudience'
        );

        if (!response?.choices?.[0]?.message?.content) {
          throw new Error('No scene content received from AI service');
        }

        const generatedScenes = JSON.parse(response.choices[0].message.content);
        
        console.log(`✅ Scene generation complete: ${generatedScenes.pages?.length || 0} pages created`);
        console.log(`🌍 Environmental consistency: ${options.enhancedContext && !options.enhancedContext.fallback ? 'Enhanced' : 'Standard'}`);
        
        return {
          pages: generatedScenes.pages || [],
          audience: options.audience,
          characterImage: options.characterImage,
          layoutType: options.layoutType || 'comic-book-panels',
          characterArtStyle: options.characterArtStyle || 'storybook',
          environmentalConsistency: options.enhancedContext && !options.enhancedContext.fallback ? 'enhanced' : 'standard',
          metadata: {
            discoveryPath: 'generateScenesWithAudience',
            patternType: 'direct',
            qualityScore: 95,
            originalStructure: ['story', 'audience', 'characterImage', 'artStyle', 'layout', 'environmentalContext']
          }
        };
      },
      'generateScenesWithAudience'
    );

    return result.success ? result.data : this.getFallbackSceneResult(options);
  }

  // ===== CHARACTER DESCRIPTION METHODS =====

  async describeCharacter(imageUrl: string, prompt: string): Promise<string>;
  async describeCharacter(options: CharacterDescriptionOptions): Promise<CharacterDescriptionResult>;
  async describeCharacter(imageUrlOrOptions: string | CharacterDescriptionOptions, prompt?: string): Promise<string | CharacterDescriptionResult> {
    if (typeof imageUrlOrOptions === 'string') {
      const imageUrl = imageUrlOrOptions;
      const characterPrompt = prompt || 'Describe this character for professional comic book creation.';
      
      const options = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
      };

      const result = await this.makeOpenAIAPICall<any>(
        '/chat/completions',
        options,
        60000,
        'describeCharacter'
      );

      if (!result?.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from OpenAI API - no content received');
      }

      return result.choices[0].message.content;
    } else {
      const { imageUrl, style = 'storybook' } = imageUrlOrOptions;
      
      const characterPrompt = `You are a professional comic book character designer creating detailed character descriptions for ${style} style artwork with maximum consistency.`;
      
      const options = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
      };

      const result = await this.makeOpenAIAPICall<any>(
        '/chat/completions',
        options,
        60000,
        'describeCharacterWithOptions'
      );

      if (!result?.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from OpenAI API - no content received');
      }

      return {
        description: result.choices[0].message.content,
        cached: false,
      };
    }
  }

  // ===== CARTOONIZE PROCESSING =====

  async processCartoonize(options: CartoonizeOptions): Promise<CartoonizeResult> {
    const { prompt, style = 'cartoon', imageUrl, userId } = options;

    console.log('🎨 Professional character cartoonization processing...');

    const cleanPrompt = this.cleanStoryPrompt(prompt);
    const stylePrompt = this.getStylePrompt(style);
    const finalPrompt = `Create a professional ${style} style character portrait with maximum detail for comic book consistency.

CHARACTER DESCRIPTION: ${cleanPrompt}

STYLE REQUIREMENTS: ${stylePrompt}

PROFESSIONAL STANDARDS:
- High-quality character design suitable for comic book illustration
- Detailed facial features and expressions for character consistency
- Clear, distinctive clothing and accessories
- Professional character art that can be used across multiple comic panels
- Maintain character identity for story continuity

TECHNICAL SPECIFICATIONS:
- Publication-ready character illustration
- Suitable for character reference and comic book generation
- Detailed enough for consistent character reproduction`;

    const generatedUrl = await this.generateCartoonImage(finalPrompt);

    console.log('✅ Professional character cartoonization completed');

    return {
      url: generatedUrl,
      cached: false,
    };
  }

  // ===== LEGACY SCENE GENERATION (FALLBACK) =====

  async generateScenes(systemPrompt: string, userPrompt: string): Promise<SceneGenerationResult> {
    const jsonSystemPrompt = `${systemPrompt}\n\nIMPORTANT: Respond with valid JSON containing professional comic book content.`;
    
    const options = {
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      max_tokens: 3000,
      temperature: 0.8,
      response_format: { type: 'json_object' }
    };

    const result = await this.makeOpenAIAPICall<any>(
      '/chat/completions',
      options,
      120000,
      'generateScenes'
    );

    if (!result?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI API - no content received');
    }

    try {
      const parsed = JSON.parse(result.choices[0].message.content);
      const discoveryResult = this.discoverContent(parsed);
      
      if (!discoveryResult.content || discoveryResult.content.length === 0) {
        console.error('❌ No valid content discovered in OpenAI response');
        throw new Error('Could not extract valid comic book content from OpenAI response');
      }
      
      console.log(`✅ Content discovered via ${discoveryResult.patternType} pattern`);
      
      return { 
        pages: discoveryResult.content,
        audience: 'children',
        characterImage: undefined,
        layoutType: 'comic-book-panels',
        characterArtStyle: 'storybook',
        metadata: { 
          discoveryPath: discoveryResult.discoveryPath,
          patternType: discoveryResult.patternType,
          qualityScore: discoveryResult.qualityScore,
          originalStructure: Object.keys(parsed),
          ...parsed.metadata 
        } 
      };
      
    } catch (parseError: any) {
      console.error('❌ Failed to parse OpenAI JSON response:', parseError);
      throw new Error(`Invalid JSON response from OpenAI: ${parseError?.message || 'Unknown error'}`);
    }
  }

  // ===== CHAT COMPLETION =====

  async createChatCompletion(chatOptions: ChatCompletionOptions): Promise<ChatCompletionResult> {
    if (chatOptions.responseFormat?.type === 'json_object') {
      const hasJsonKeyword = chatOptions.messages.some(message => {
        if (typeof message.content === 'string') {
          return message.content.toLowerCase().includes('json');
        }
        return false;
      });

      if (!hasJsonKeyword) {
        console.warn('⚠️ Adding JSON keyword to prompt for OpenAI API compliance');
        const lastUserMessageIndex = chatOptions.messages.map(m => m.role).lastIndexOf('user');
        if (lastUserMessageIndex >= 0) {
          const lastMessage = chatOptions.messages[lastUserMessageIndex];
          if (typeof lastMessage.content === 'string') {
            lastMessage.content += '\n\nIMPORTANT: Respond with valid JSON format.';
          }
        }
      }
    }

    return this.withRetry(
      async () => {
        const options = {
          model: chatOptions.model || 'gpt-4o',
          messages: chatOptions.messages,
          max_tokens: chatOptions.maxTokens || 1000,
          temperature: chatOptions.temperature || 0.7,
          response_format: chatOptions.responseFormat
        };

        const result = await this.makeOpenAIAPICall<any>(
          '/chat/completions',
          options,
          120000,
          'createChatCompletion'
        );

        return result;
      },
      this.gptRetryConfig,
      'createChatCompletion'
    );
  }

  async generateCartoonImage(prompt: string): Promise<string> {
    const options = {
      model: 'dall-e-3',
      prompt: prompt,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url'
    };

    const result = await this.makeOpenAIAPICall<any>(
      '/images/generations',
      options,
      180000,
      'generateCartoonImage'
    );

    if (!result?.data?.[0]?.url) {
      throw new Error('Invalid response from OpenAI API - no image URL received');
    }

    return result.data[0].url;
  }

  // ===== PRIVATE HELPER METHODS =====

  private async testAPIConnectivity(): Promise<void> {
    try {
      const testResponse = await this.makeRequest<any>(
        '/models',
        { method: 'GET' },
        5000,
        'testConnectivity'
      );

      if (!testResponse || !testResponse.data) {
        throw new Error('API connectivity test failed - invalid response');
      }

      this.log('info', 'OpenAI API connectivity verified');
    } catch (error: any) {
      this.log('error', 'OpenAI API connectivity test failed', error);
      throw new Error(`OpenAI API connectivity test failed: ${error.message}`);
    }
  }

  private isPlaceholderValue(value: string): boolean {
    const placeholderPatterns = [
      'your_', 'placeholder', 'example', 'test_key', 'demo_', 'localhost', 'http://localhost'
    ];
    return placeholderPatterns.some(pattern => 
      value.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  private buildStoryPrompt(genre: GenreType, characterDescription: string, audience: AudienceType): string {
    const genrePrompts = {
      adventure: 'Create an exciting adventure story filled with discovery, challenges, and personal growth.',
      siblings: 'Write a heartwarming story about sibling relationships, sharing, and family bonds.',
      bedtime: 'Create a gentle, soothing bedtime story with calming imagery and peaceful resolution.',
      fantasy: 'Craft a magical tale filled with wonder, enchantment, and imaginative elements.',
      history: 'Tell an engaging historical story that brings the past to life with educational elements.',
    };

    const config = this.audienceConfig[audience];
    const genrePrompt = genrePrompts[genre];

    return `You are a professional story writer crafting high-quality, imaginative stories for comic book adaptation.

STORY REQUIREMENTS:
- Genre: ${genre} - ${genrePrompt}
- Character: ${characterDescription}
- Audience: ${audience} (${config.complexityLevel} complexity)
- Target Length: Suitable for ${config.totalPanels} comic book panels

COMIC BOOK ADAPTATION FOCUS:
- Create ${config.totalPanels} distinct visual moments
- Include rich sensory details for illustration
- Build clear emotional progression for character
- Ensure strong visual storytelling potential
- Create memorable scenes that translate well to comics

PROFESSIONAL STANDARDS:
- Engaging narrative with clear story arc
- Character consistency and development
- Visual scenes that advance the plot
- Appropriate complexity for ${audience} audience
- Strong beginning, middle, and satisfying conclusion

Write a cohesive story optimized for professional comic book adaptation.`;
  }

  private getStylePrompt(style: string): string {
    const stylePrompts = {
      'storybook': 'Soft, whimsical storybook art with gentle colors, clean lines, and friendly character design.',
      'semi-realistic': 'Semi-realistic cartoon style with smooth shading, detailed facial features, and natural proportions.',
      'comic-book': 'Bold comic book style with strong outlines, vivid colors, dynamic shading, and heroic character design.',
      'flat-illustration': 'Modern flat illustration style with minimal shading, clean vector lines, and vibrant flat colors.',
      'anime': 'Anime art style with expressive eyes, stylized proportions, and crisp linework inspired by Japanese animation.'
    };
    return stylePrompts[style as keyof typeof stylePrompts] || stylePrompts['semi-realistic'];
  }

  private cleanStoryPrompt(prompt: string): string {
    return prompt
      .trim()
      .replace(/\b(adorable|cute|precious|delightful|charming|lovely|beautiful|perfect)\s/gi, '')
      .replace(/\b(gazing|peering|staring)\s+(?:curiously|intently|lovingly|sweetly)\s+at\b/gi, 'looking at')
      .replace(/\badding a touch of\s+\w+\b/gi, '')
      .replace(/\bwith a hint of\s+\w+\b/gi, '')
      .replace(/\bexuding\s+(?:innocence|wonder|joy|happiness)\b/gi, '')
      .replace(/\b(cozy|perfect for|wonderfully|overall cuteness)\s/gi, '')
      .replace(/\b(?:filled with|radiating|emanating)\s+(?:warmth|joy|happiness|wonder)\b/gi, '')
      .replace(/\b(a|an)\s+(baby|toddler|child|teen|adult)\s+(boy|girl|man|woman)\b/gi, '$2 $3')
      .replace(/\s+/g, ' ')
      .replace(/[.!]+$/, '');
  }

  // ===== CONTENT DISCOVERY SYSTEM =====

  private discoverContent(parsed: any): ContentDiscoveryResult {
    console.log('🔍 Starting professional content discovery...');
    
    const patternResult = this.tryKnownPatterns(parsed);
    if (patternResult) {
      console.log(`✅ Pattern match: ${patternResult.discoveryPath}`);
      return patternResult;
    }
    
    const searchResult = this.performDeepSearch(parsed);
    if (searchResult) {
      console.log(`✅ Deep search success: ${searchResult.discoveryPath}`);
      return searchResult;
    }
    
    console.warn('⚠️ Using emergency fallback - no comic content found');
    return {
      content: [],
      discoveryPath: 'emergency_fallback',
      qualityScore: 0,
      patternType: 'fallback'
    };
  }

  private tryKnownPatterns(parsed: any): ContentDiscoveryResult | null {
    const sortedPatterns = [...this.discoveryPatterns].sort((a, b) => b.priority - a.priority);
    
    for (const pattern of sortedPatterns) {
      try {
        if (pattern.validator(parsed)) {
          const content = this.extractContentByPath(parsed, pattern.path);
          if (content && Array.isArray(content) && content.length > 0) {
            const qualityScore = this.calculateContentQuality(content);
            
            console.log(`🎯 Pattern "${pattern.name}" matched with quality ${qualityScore}/100`);
            
            return {
              content,
              discoveryPath: pattern.path.join('.'),
              qualityScore,
              patternType: pattern.path.length === 1 ? 'direct' : 'nested'
            };
          }
        }
      } catch (error) {
        console.debug(`Pattern ${pattern.name} validation failed:`, error);
      }
    }
    
    return null;
  }

  private performDeepSearch(obj: any, currentPath: string[] = []): ContentDiscoveryResult | null {
    if (!obj || typeof obj !== 'object') return null;
    
    if (Array.isArray(obj)) {
      const qualityScore = this.calculateContentQuality(obj);
      if (qualityScore > 50) {
        return {
          content: obj,
          discoveryPath: currentPath.join('.') || 'root_array',
          qualityScore,
          patternType: 'discovered'
        };
      }
    }
    
    const candidates: ContentDiscoveryResult[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') {
        const result = this.performDeepSearch(value, [...currentPath, key]);
        if (result) {
          candidates.push(result);
        }
      }
    }
    
    if (candidates.length > 0) {
      return candidates.sort((a, b) => b.qualityScore - a.qualityScore)[0];
    }
    
    return null;
  }

  private calculateContentQuality(content: any[]): number {
    if (!Array.isArray(content) || content.length === 0) return 0;
    
    let score = 0;
    const items = content.slice(0, 5);
    
    if (content.length >= 1 && content.length <= 20) {
      score += 20;
    } else if (content.length <= 50) {
      score += 10;
    }
    
    for (const item of items) {
      if (item && typeof item === 'object') {
        score += 10;
        
        const comicProperties = ['description', 'imagePrompt', 'scene', 'emotion', 'dialogue', 'panelNumber', 'pageNumber'];
        const foundProperties = comicProperties.filter(prop => prop in item);
        score += foundProperties.length * 8;
        
        const genericProperties = ['text', 'content', 'prompt', 'action', 'character'];
        const foundGeneric = genericProperties.filter(prop => prop in item);
        score += foundGeneric.length * 3;
        
        if (item.scenes && Array.isArray(item.scenes)) {
          score += 15;
        }
      }
    }
    
    return Math.min(100, score);
  }

  private extractContentByPath(obj: any, path: string[]): any {
    let current = obj;
    for (const key of path) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return null;
      }
    }
    return current;
  }

  private checkRateLimit(endpoint: string): boolean {
    const now = Date.now();
    const windowMs = 60000;
    const requests = this.rateLimiter.get(endpoint) || [];
    
    const recentRequests = requests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= (this.config as AIConfig).rateLimitRpm) {
      return false;
    }
    
    recentRequests.push(now);
    this.rateLimiter.set(endpoint, recentRequests);
    return true;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit,
    timeout: number,
    operationName: string
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error('AI service not available - OpenAI API key missing');
    }

    if (!this.checkRateLimit(endpoint)) {
      throw new Error('Rate limit exceeded for OpenAI API');
    }

    const url = `${(this.config as AIConfig).baseUrl}${endpoint}`;
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await this.withTimeout(
        fetch(url, requestOptions),
        timeout,
        operationName
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        
        try {
          errorData = JSON.parse(errorText);
        } catch {
          throw new Error(`OpenAI API request failed with status ${response.status}: ${errorText}`);
        }

        const errorMessage = errorData?.error?.message || `OpenAI API request failed with status ${response.status}`;
        const error = new Error(errorMessage);
        
        if (response.status === 429) {
          (error as any).type = 'rate_limit';
        } else if (response.status >= 500) {
          (error as any).type = 'connection';
        } else if (response.status === 401 || response.status === 403) {
          (error as any).type = 'authentication';
        } else {
          (error as any).type = 'validation';
        }
        
        throw error;
      }

      const data = await response.json();
      return data;
      
    } catch (error: any) {
      this.log('error', `AI API request failed: ${operationName}`, error);
      throw error;
    }
  }

  private async generateImage(options: any): Promise<any> {
    return this.withRetry(
      async () => {
        return this.makeRequest<any>(
          '/images/generations',
          {
            method: 'POST',
            body: JSON.stringify(options),
          },
          (this.config as AIConfig).dalleTimeout,
          'generateImage'
        );
      },
      this.dalleRetryConfig,
      'generateImage'
    );
  }

  private async analyzeImage(options: any): Promise<any> {
    return this.withRetry(
      async () => {
        return this.makeRequest<any>(
          '/chat/completions',
          {
            method: 'POST',
            body: JSON.stringify(options),
          },
          (this.config as AIConfig).gptTimeout,
          'analyzeImage'
        );
      },
      this.gptRetryConfig,
      'analyzeImage'
    );
  }

  // ===== ENHANCED COMIC BOOK GENERATION METHODS =====

  /**
   * Enhanced comic book generation with environmental context
   */
  async generateComicBookWithEnvironmentalContext(
    story: string,
    audience: AudienceType,
    character_image?: string,
    character_art_style: string = 'storybook',
    layout_type: string = 'comic-book-panels'
  ): Promise<any> {
    try {
      console.log('🎨 Starting enhanced comic book generation with environmental context...');
      
      // Step 1: Analyze story structure
      const storyBeats = await this.analyzeStoryStructure(story, audience);
      console.log(`✅ Story structure analyzed: ${storyBeats.storyBeats.length} narrative beats for ${audience} audience`);
      
      // ENHANCED: Add environmental extraction to story analysis
      console.log('🌍 Extracting environmental context from story analysis...');
      const environmentalContext = {
        primarySetting: this.extractPrimarySetting(story),
        timeContext: this.extractTimeContext(story),
        weatherMood: this.extractWeatherMood(story),
        locationTransitions: this.identifyLocationTransitions(storyBeats.storyBeats)
      };
      
      // Enhanced scene image generation with character DNA
      const sceneResult = await (aiService as any).generateScenesWithAudience({
        story: story,
        audience: audience as any,
        characterImage: character_image,
        characterArtStyle: character_art_style,
        layoutType: layout_type,
        environmentalContext: environmentalContext // ENHANCED: Pass environmental context
      });
      
      if (sceneResult && sceneResult.pages && Array.isArray(sceneResult.pages)) {
        console.log(`✅ Enhanced comic book generation completed: ${sceneResult.pages.length} pages with environmental consistency`);
        return sceneResult;
      } else {
        throw new Error('Invalid scene generation result structure');
      }
      
    } catch (error: any) {
      console.error('❌ Enhanced comic book generation failed:', error);
      throw new Error(`Enhanced comic book generation failed: ${error.message}`);
    }
  }

  // ===== ENVIRONMENTAL EXTRACTION HELPER METHODS =====

  private extractPrimarySetting(story: string): string {
    // Extract primary setting from story text
    const settingKeywords = {
      indoor: ['house', 'room', 'kitchen', 'bedroom', 'school', 'classroom', 'library'],
      outdoor: ['park', 'garden', 'forest', 'beach', 'playground', 'yard', 'outside'],
      fantasy: ['castle', 'kingdom', 'magical', 'enchanted', 'fairy', 'dragon'],
      modern: ['city', 'street', 'car', 'computer', 'phone', 'mall']
    };
    
    const storyLower = story.toLowerCase();
    
    for (const [category, keywords] of Object.entries(settingKeywords)) {
      if (keywords.some(keyword => storyLower.includes(keyword))) {
        return category;
      }
    }
    
    return 'mixed';
  }

  private extractTimeContext(story: string): string {
    const timeKeywords = {
      morning: ['morning', 'sunrise', 'dawn', 'breakfast'],
      afternoon: ['afternoon', 'lunch', 'midday', 'noon'],
      evening: ['evening', 'sunset', 'dinner', 'dusk'],
      night: ['night', 'dark', 'moon', 'stars', 'bedtime']
    };
    
    const storyLower = story.toLowerCase();
    
    for (const [time, keywords] of Object.entries(timeKeywords)) {
      if (keywords.some(keyword => storyLower.includes(keyword))) {
        return time;
      }
    }
    
    return 'afternoon'; // Default to afternoon
  }

  private extractWeatherMood(story: string): string {
    const weatherKeywords = {
      sunny: ['sunny', 'bright', 'clear', 'warm'],
      cloudy: ['cloudy', 'overcast', 'gray', 'grey'],
      rainy: ['rain', 'wet', 'storm', 'thunder'],
      snowy: ['snow', 'cold', 'winter', 'ice']
    };
    
    const storyLower = story.toLowerCase();
    
    for (const [weather, keywords] of Object.entries(weatherKeywords)) {
      if (keywords.some(keyword => storyLower.includes(keyword))) {
        return weather;
      }
    }
    
    return 'sunny'; // Default to sunny
  }

  private identifyLocationTransitions(storyBeats: any[]): any[] {
    const transitions = [];
    
    for (let i = 1; i < storyBeats.length; i++) {
      const prevBeat = storyBeats[i - 1];
      const currentBeat = storyBeats[i];
      
      // Simple heuristic to detect location changes
      if (this.detectLocationChange(prevBeat.description, currentBeat.description)) {
        transitions.push({
          fromPanel: i - 1,
          toPanel: i,
          transitionType: 'location_change',
          description: `Transition from ${prevBeat.setting || 'previous location'} to ${currentBeat.setting || 'new location'}`
        });
      }
    }
    
    return transitions;
  }

  private detectLocationChange(prevDescription: string, currentDescription: string): boolean {
    const locationWords = ['room', 'outside', 'kitchen', 'park', 'school', 'home', 'garden', 'forest'];
    
    const prevLocations = locationWords.filter(word => prevDescription.toLowerCase().includes(word));
    const currentLocations = locationWords.filter(word => currentDescription.toLowerCase().includes(word));
    
    // If different location words are found, assume location change
    return prevLocations.length > 0 && currentLocations.length > 0 && 
           !prevLocations.some(loc => currentLocations.includes(loc));
  }

  /**
   * Extract character description from Character DNA
   */
  private extractCharacterDescription(characterDNA: CharacterDNA): string {
    const physicalFeatures = [
      characterDNA.physicalStructure.faceShape,
      characterDNA.physicalStructure.eyeDetails,
      characterDNA.physicalStructure.hairSpecifics,
      characterDNA.physicalStructure.skinTone
    ].filter(Boolean).join(', ');

    const clothingDetails = [
      characterDNA.clothingSignature.primaryOutfit,
      characterDNA.clothingSignature.colorPalette
    ].filter(Boolean).join(', ');

    const uniqueFeatures = characterDNA.uniqueIdentifiers.distinctiveFeatures;

    return `${physicalFeatures}. Wearing ${clothingDetails}. ${uniqueFeatures}`.trim();
  }

  // ===== ENHANCED SPEECH BUBBLE SYSTEM =====

  /**
   * Detect existing dialogue patterns in story text
   */
  private detectDialogueInStory(story: string): DialogueCandidate[] {
    const dialogueCandidates: DialogueCandidate[] = [];
    
    for (const pattern of this.dialoguePatterns) {
      let match;
      while ((match = pattern.pattern.exec(story)) !== null) {
        dialogueCandidates.push({
          text: match[1] || match[0],
          type: pattern.type,
          priority: pattern.priority,
          beatIndex: -1 // Will be assigned later based on story position
        });
      }
    }

    // Sort by priority and assign to story beats
    dialogueCandidates.sort((a, b) => b.priority - a.priority);
    
    return dialogueCandidates;
  }

  /**
   * Calculate dialogue score for a story beat
   */
  private calculateDialogueScore(beat: StoryBeat, index: number, totalBeats: number): number {
    let score = 0;

    // Emotional dialogue triggers
    if (this.speechBubbleConfig.emotionalDialogueTriggers.includes(beat.emotion.toLowerCase())) {
      score += 30;
    }

    // Narrative function bonuses
    switch (beat.narrativeFunction) {
      case 'climax':
        score += 25;
        break;
      case 'rising_action':
        score += 20;
        break;
      case 'setup':
        score += 15;
        break;
      case 'resolution':
        score += 10;
        break;
    }

    // Character action bonuses
    if (beat.characterAction.toLowerCase().includes('speak') || 
        beat.characterAction.toLowerCase().includes('say') ||
        beat.characterAction.toLowerCase().includes('talk')) {
      score += 35;
    }

    // Position-based bonuses
    if (index === 0) score += 20; // Opening panel
    if (index === totalBeats - 1) score += 25; // Closing panel
    if (index === Math.floor(totalBeats / 2)) score += 15; // Middle panel

    // Distribution pressure (encourage even spread)
    const position = index / totalBeats;
    if (position > 0.2 && position < 0.8) score += 10; // Middle 60% of story

    return score;
  }

  /**
   * Determine if a panel should have dialogue based on strategic placement
   */
  private shouldPanelHaveDialogue(
    beatScore: { index: number; beat: StoryBeat; score: number; hasExistingDialogue: boolean },
    currentDialogueCount: number,
    targetDialogueCount: number,
    existingDialogue: DialogueCandidate[]
  ): boolean {
    // Always include existing dialogue
    if (beatScore.hasExistingDialogue) {
      return true;
    }

    // Don't exceed target
    if (currentDialogueCount >= targetDialogueCount) {
      return false;
    }

    // High-scoring beats get priority
    if (beatScore.score >= 50) {
      return true;
    }

    // Fill remaining slots with medium-scoring beats
    const remainingSlots = targetDialogueCount - currentDialogueCount;
    const remainingBeats = existingDialogue.length - beatScore.index;
    
    if (remainingSlots > 0 && beatScore.score >= 25 && remainingSlots >= remainingBeats * 0.3) {
      return true;
    }

    return false;
  }

  /**
   * Generate contextual dialogue for emotional moments
   */
  private async generateContextualDialogue(beat: StoryBeat, audience: AudienceType): Promise<string> {
    const emotionDialogueMap: Record<string, string[]> = {
      excited: ["Wow!", "This is amazing!", "I can't believe it!", "Yes!", "Incredible!"],
      happy: ["I'm so happy!", "This is wonderful!", "Perfect!", "Great!", "Yay!"],
      sad: ["I'm sorry...", "This is hard...", "I don't understand...", "Why?", "Oh no..."],
      angry: ["That's not fair!", "I don't like this!", "Stop!", "No way!", "This is wrong!"],
      surprised: ["What?!", "Really?", "I didn't expect that!", "Wow!", "No way!"],
      confused: ["I don't understand...", "What does that mean?", "Huh?", "I'm confused...", "How?"],
      worried: ["I'm scared...", "What if...?", "I hope everything's okay...", "I'm worried...", "Be careful..."],
      determined: ["I can do this!", "Let's go!", "I won't give up!", "I'm ready!", "Here we go!"],
      scared: ["Help!", "I'm scared!", "What was that?", "I don't like this...", "Stay close..."],
      curious: ["What's that?", "I wonder...", "Can we look?", "Tell me more!", "How does it work?"],
      frustrated: ["This is hard!", "I can't do it!", "Why won't it work?", "Ugh!", "This is annoying!"],
      delighted: ["This is perfect!", "I love it!", "How wonderful!", "Amazing!", "Beautiful!"],
      nervous: ["I'm nervous...", "What if I mess up?", "I hope this works...", "Here goes nothing...", "Wish me luck!"],
      confident: ["I've got this!", "No problem!", "Easy!", "I know what to do!", "Trust me!"],
      thoughtful: ["Hmm...", "Let me think...", "I wonder if...", "Maybe...", "That's interesting..."]
    };

    const emotion = beat.emotion.toLowerCase();
    const dialogueOptions = emotionDialogueMap[emotion] || ["...", "Yes.", "Okay.", "I see.", "Alright."];
    
    // Select appropriate dialogue based on audience
    let selectedDialogue = dialogueOptions[Math.floor(Math.random() * dialogueOptions.length)];
    
    // Adjust complexity for audience
    if (audience === 'children') {
      selectedDialogue = selectedDialogue.replace(/[.]{3}/g, '...');
      if (selectedDialogue.length > 20) {
        selectedDialogue = dialogueOptions.find(d => d.length <= 20) || "Wow!";
      }
    }

    return selectedDialogue;
  }

  /**
   * Clean dialogue for speech bubble formatting
   */
  private cleanDialogue(dialogue: string): string {
    let cleaned = dialogue;
    
    // Apply cleaning rules
    for (const rule of this.speechBubbleConfig.dialogueCleaningRules) {
      cleaned = cleaned.replace(rule.pattern, rule.replacement);
    }
    
    // Ensure proper length for speech bubbles
    if (cleaned.length > 50) {
      cleaned = cleaned.substring(0, 47) + '...';
    }
    
    // Ensure proper punctuation
    if (!/[.!?]$/.test(cleaned) && cleaned.length > 0) {
      cleaned += '.';
    }
    
    return cleaned;
  }

  /**
   * Determine speech bubble style based on emotion and dialogue content
   */
  private determineSpeechBubbleStyle(emotion: string, dialogue: string): string {
    const emotionLower = emotion.toLowerCase();
    
    // Check for thought indicators
    if (dialogue.toLowerCase().includes('think') || 
        dialogue.toLowerCase().includes('wonder') ||
        dialogue.toLowerCase().includes('maybe') ||
        emotionLower === 'thoughtful') {
      return 'thought';
    }
    
    // Check for shouting indicators
    if (dialogue.includes('!') || 
        dialogue.toUpperCase() === dialogue ||
        emotionLower === 'excited' ||
        emotionLower === 'angry' ||
        emotionLower === 'surprised') {
      return 'shout';
    }
    
    // Check for whisper indicators
    if (dialogue.includes('...') || 
        dialogue.toLowerCase().includes('whisper') ||
        emotionLower === 'sad' ||
        emotionLower === 'scared' ||
        emotionLower === 'worried') {
      return 'whisper';
    }
    
    // Use emotion-based mapping
    return this.speechBubbleConfig.bubbleStyleMapping[emotionLower] || 'standard';
  }

  // ===== FALLBACK METHODS =====

  private getFallbackStoryAnalysis(audience: AudienceType): StoryAnalysis {
    const config = this.audienceConfig[audience];
    return {
      storyBeats: Array(config.totalPanels).fill(null).map((_, index) => ({
        beat: `Story moment ${index + 1}`,
        emotion: 'neutral',
        visualPriority: 'character',
        panelPurpose: 'story progression',
        narrativeFunction: 'rising_action',
        characterAction: 'character action',
        environment: 'appropriate setting'
      })),
      characterArc: ['Beginning', 'Development', 'Resolution'],
      visualFlow: ['Establishing', 'Building', 'Climax', 'Resolution'],
      totalPanels: config.totalPanels,
      pagesRequired: config.pagesPerStory
    };
  }

  private getFallbackSceneResult(options: SceneGenerationOptions): SceneGenerationResult {
    return {
      pages: [],
      audience: options.audience,
      characterImage: options.characterImage,
      layoutType: options.layoutType || 'comic-book-panels',
      characterArtStyle: options.characterArtStyle || 'storybook',
      metadata: {
        discoveryPath: 'fallback',
        patternType: 'fallback',
        qualityScore: 0,
        originalStructure: ['fallback']
      }
    };
  }

  // ===== CONFIGURATION HELPER METHODS =====

  private getAudienceConfiguration(audience: AudienceType): any {
    return {
      artComplexity: audience === 'children' ? 'simple' : audience === 'young_adults' ? 'moderate' : 'detailed',
      colorPalette: audience === 'children' ? 'bright and vibrant' : audience === 'young_adults' ? 'balanced' : 'sophisticated',
      lightingStyle: audience === 'children' ? 'soft and friendly' : audience === 'young_adults' ? 'dynamic' : 'dramatic',
      safetyGuidelines: audience === 'children' ? 'child-safe' : audience === 'young_adults' ? 'teen-appropriate' : 'adult-suitable'
    };
  }

  private getArtStyleConfiguration(style: string): any {
    return {
      technique: style === 'storybook' ? 'soft illustration' : style === 'comic-book' ? 'bold comic art' : 'cartoon style',
      lineWeight: style === 'storybook' ? 'gentle lines' : style === 'comic-book' ? 'strong outlines' : 'clean lines',
      shading: style === 'storybook' ? 'soft shading' : style === 'comic-book' ? 'dramatic shadows' : 'minimal shading'
    };
  }

  private getLayoutConfiguration(layoutType: string): any {
    return {
      panelStyle: layoutType === 'comic-book-panels' ? 'traditional comic panels' : 'storybook layout',
      composition: layoutType === 'comic-book-panels' ? 'dynamic panel composition' : 'centered illustration',
      flow: layoutType === 'comic-book-panels' ? 'sequential storytelling' : 'page-by-page narrative'
    };
  }

  private getPanelConfiguration(panelType: PanelType): any {
    return {
      composition: panelType === 'wide' ? 'panoramic composition' : panelType === 'tall' ? 'vertical emphasis' : panelType === 'splash' ? 'full-page impact' : 'balanced composition',
      focus: panelType === 'wide' ? 'environmental scope' : panelType === 'tall' ? 'character emphasis' : panelType === 'splash' ? 'dramatic moment' : 'story progression'
    };
  }

  private getPanelTypeDescription(panelType: PanelType): string {
    const descriptions = {
      standard: 'balanced rectangular panel for story progression',
      wide: 'panoramic panel for establishing shots and action',
      tall: 'vertical panel for character focus and emotion',
      splash: 'large dramatic panel for climactic moments'
    };
    return descriptions[panelType] || descriptions.standard;
  }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;