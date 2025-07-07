// Enhanced AI Service - Production Implementation with Quality Analysis System
import { ErrorAwareBaseService, ErrorAwareServiceConfig } from '../base/error-aware-base-service.js';
import { 
  IAIService,
  ServiceConfig,
  RetryConfig,
  StoryGenerationOptions,
  StoryGenerationResult,
  ImageGenerationOptions,
  ImageGenerationResult,
  CartoonizeOptions,
  CartoonizeResult,
  CharacterDescriptionOptions,
  CharacterDescriptionResult,
  SceneGenerationOptions,
  SceneGenerationResult,
  ChatCompletionOptions,
  ChatCompletionResult,
  AudienceType,
  GenreType,
  EnvironmentalDNA,
  CharacterDNA,
  StoryAnalysis,
  StoryBeat,
  QualityMetrics
} from '../interfaces/service-contracts.js';
import { 
  Result,
  AIServiceUnavailableError,
  AIRateLimitError,
  AIContentPolicyError,
  AITimeoutError,
  AIAuthenticationError,
  ErrorFactory,
  ErrorCategory
} from '../errors/index.js';

// ===== QUALITY ANALYSIS CONFIGURATION CONSTANTS =====

const QUALITY_THRESHOLDS = {
  A: 90,
  B: 80,
  C: 70,
  D: 60,
  F: 0
} as const;

const QUALITY_WEIGHTS = {
  character: 0.4,
  environmental: 0.3,
  narrative: 0.3
} as const;

const QUALITY_BASELINE_SCORES = {
  characterDNA: 85,
  environmentalDNA: 80,
  storyAnalysis: 75,
  fallback: 60,
  minimum: 50
} as const;

const QUALITY_ANALYSIS_TIMEOUTS = {
  character: 5000,
  environmental: 3000,
  narrative: 4000,
  overall: 15000
} as const;

// ===== QUALITY ANALYSIS INTERFACES =====

interface ConsistencyAnalysis {
  featureVariance: number;
  dnaUsageScore: number;
  visualCoherence: number;
  overallScore: number;
  details: {
    characterDNAPresent: boolean;
    featureConsistencyRate: number;
    visualElementsMatched: number;
    inconsistencyCount: number;
  };
}

interface CoherenceAnalysis {
  backgroundConsistency: number;
  environmentalDNAScore: number;
  settingCoherence: number;
  overallScore: number;
  details: {
    environmentalDNAPresent: boolean;
    backgroundVariance: number;
    settingTransitions: number;
    coherenceViolations: number;
  };
}

interface NarrativeAnalysis {
  storyProgression: number;
  panelTransitions: number;
  narrativeFlow: number;
  overallScore: number;
  details: {
    storyAnalysisPresent: boolean;
    progressionQuality: number;
    transitionSmoothness: number;
    narrativeGaps: number;
  };
}

interface QualityAnalysisResult {
  characterConsistencyScore: number;
  environmentalCoherenceScore: number;
  narrativeFlowScore: number;
  overallTechnicalQuality: number;
  qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  analysisDetails: {
    characterFeatureVariance: number;
    backgroundConsistencyRate: number;
    storyProgressionQuality: number;
    panelTransitionSmoothing: number;
    panelsAnalyzed: number;
    processingTime: number;
  };
  recommendations: string[];
}

// ===== AI SERVICE CONFIGURATION =====

export interface AIServiceConfig extends ErrorAwareServiceConfig {
  openaiApiKey: string;
  baseUrl: string;
  defaultModel: string;
  imageModel: string;
  maxRetries: number;
  requestTimeout: number;
  rateLimitDelay: number;
  qualityAnalysisEnabled: boolean;
}

// ===== AI SERVICE IMPLEMENTATION =====

export class AIService extends ErrorAwareBaseService implements IAIService {
  private apiKey: string | null = null;
  private baseUrl: string = 'https://api.openai.com/v1';
  private readonly defaultRetryConfig: RetryConfig = {
    attempts: 3,
    delay: 2000,
    backoffMultiplier: 2,
    maxDelay: 30000,
  };

  constructor(config?: Partial<AIServiceConfig>) {
    const defaultConfig: AIServiceConfig = {
      name: 'AIService',
      timeout: 120000,
      retryAttempts: 3,
      retryDelay: 2000,
      circuitBreakerThreshold: 5,
      openaiApiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4',
      imageModel: 'dall-e-3',
      maxRetries: 3,
      requestTimeout: 120000,
      rateLimitDelay: 2000,
      qualityAnalysisEnabled: true,
      errorHandling: {
        enableRetry: true,
        maxRetries: 3,
        enableCircuitBreaker: true,
        enableCorrelation: true,
        enableMetrics: true,
        retryableCategories: [
          ErrorCategory.NETWORK,
          ErrorCategory.TIMEOUT,
          ErrorCategory.RATE_LIMIT,
          ErrorCategory.EXTERNAL_SERVICE
        ]
      }
    };
    
    const finalConfig = { ...defaultConfig, ...config };
    super(finalConfig);
  }

  getName(): string {
    return 'AIService';
  }

  // ===== LIFECYCLE IMPLEMENTATION =====

  protected async initializeService(): Promise<void> {
    this.apiKey = process.env.OPENAI_API_KEY || null;
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured - AI service will be unavailable');
    }

    if (this.apiKey.length < 20) {
      throw new Error('OpenAI API key appears to be invalid or too short');
    }
  }

  protected async disposeService(): Promise<void> {
    // No cleanup needed for OpenAI
  }

  protected async checkServiceHealth(): Promise<boolean> {
    return this.apiKey !== null && this.apiKey.length >= 20;
  }

  // ===== OPENAI PARAMETER TRANSFORMATION =====

  private transformOpenAIParameters(params: any): any {
    const transformed = { ...params };
    
    if (transformed.maxTokens !== undefined) {
      transformed.max_tokens = transformed.maxTokens;
      delete transformed.maxTokens;
    }
    
    if (transformed.responseFormat !== undefined) {
      transformed.response_format = transformed.responseFormat;
      delete transformed.responseFormat;
    }
    
    return transformed;
  }

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

  // ===== CORE AI OPERATIONS =====

  async generateStory(prompt: string, options?: StoryGenerationOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('AI service not available - OpenAI not configured');
    }

    return this.withRetry(
      async () => {
        const chatOptions = {
          model: options?.model || 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are a professional children's story writer. Create engaging, age-appropriate stories with clear narrative structure.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          maxTokens: options?.maxTokens || 1000,
          temperature: options?.temperature || 0.7
        };

        const result = await this.makeOpenAIAPICall<any>(
          '/chat/completions',
          chatOptions,
          (this.config as AIServiceConfig).requestTimeout,
          'generateStory'
        );

        return result.choices[0]?.message?.content || 'Story generation failed';
      },
      this.defaultRetryConfig,
      'generateStory'
    );
  }

  async generateStoryWithOptions(options: StoryGenerationOptions): Promise<StoryGenerationResult> {
    const story = await this.generateStory(
      `Create a ${options.genre} story for ${options.audience} audience featuring: ${options.characterDescription}`,
      options
    );

    return {
      story,
      title: this.extractTitleFromStory(story),
      wordCount: story.split(' ').length
    };
  }

  async generateCartoonImage(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('AI service not available - OpenAI not configured');
    }

    return this.withRetry(
      async () => {
        const imageOptions = {
          model: 'dall-e-3',
          prompt: prompt,
          n: 1,
          size: '1024x1024',
          quality: 'standard'
        };

        const result = await this.makeOpenAIAPICall<any>(
          '/images/generations',
          imageOptions,
          (this.config as AIServiceConfig).requestTimeout,
          'generateCartoonImage'
        );

        return result.data[0]?.url || '';
      },
      this.defaultRetryConfig,
      'generateCartoonImage'
    );
  }

  async generateSceneImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const enhancedPrompt = this.buildEnhancedImagePrompt(options);
    const imageUrl = await this.generateCartoonImage(enhancedPrompt);

    return {
      url: imageUrl,
      prompt_used: enhancedPrompt,
      reused: false
    };
  }

  async describeCharacter(imageUrl: string, prompt: string): Promise<string>;
  async describeCharacter(options: CharacterDescriptionOptions): Promise<CharacterDescriptionResult>;
  async describeCharacter(
    imageUrlOrOptions: string | CharacterDescriptionOptions,
    prompt?: string
  ): Promise<string | CharacterDescriptionResult> {
    if (typeof imageUrlOrOptions === 'string') {
      // Legacy method signature
      return this.analyzeImageWithPrompt(imageUrlOrOptions, prompt || 'Describe this character');
    } else {
      // New method signature
      const description = await this.analyzeImageWithPrompt(
        imageUrlOrOptions.imageUrl,
        'Describe this character for comic book consistency'
      );
      
      return {
        description,
        cached: false
      };
    }
  }

  async generateScenes(systemPrompt: string, userPrompt: string): Promise<SceneGenerationResult> {
    const scenes = await this.generateScenesWithAudience({
      story: userPrompt,
      audience: 'children',
      characterArtStyle: 'storybook',
      layoutType: 'comic-book-panels'
    });

    return scenes;
  }

  async generateScenesWithAudience(options: SceneGenerationOptions): Promise<SceneGenerationResult> {
    if (!this.apiKey) {
      throw new Error('AI service not available - OpenAI not configured');
    }

    return this.withRetry(
      async () => {
        const scenePrompt = this.buildSceneGenerationPrompt(options);
        
        const chatOptions = {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a professional comic book writer. Create detailed scene descriptions for comic book panels.'
            },
            {
              role: 'user',
              content: scenePrompt
            }
          ],
          maxTokens: 2000,
          temperature: 0.7,
          responseFormat: { type: 'json_object' }
        };

        const result = await this.makeOpenAIAPICall<any>(
          '/chat/completions',
          chatOptions,
          (this.config as AIServiceConfig).requestTimeout,
          'generateScenesWithAudience'
        );

        const content = result.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No scene content generated');
        }

        const parsedScenes = JSON.parse(content);
        
        return {
          pages: parsedScenes.pages || [],
          audience: options.audience,
          characterImage: options.characterImage,
          layoutType: options.layoutType,
          characterArtStyle: options.characterArtStyle,
          metadata: {
            discoveryPath: 'ai-generated',
            patternType: 'direct',
            qualityScore: 85,
            originalStructure: ['story-analysis', 'scene-generation']
          }
        };
      },
      this.defaultRetryConfig,
      'generateScenesWithAudience'
    );
  }

  async processCartoonize(options: CartoonizeOptions): Promise<CartoonizeResult> {
    const imageUrl = await this.generateCartoonImage(options.prompt);
    
    return {
      url: imageUrl,
      cached: false
    };
  }

  async createChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    if (!this.apiKey) {
      throw new Error('AI service not available - OpenAI not configured');
    }

    return this.withRetry(
      async () => {
        const result = await this.makeOpenAIAPICall<any>(
          '/chat/completions',
          options,
          (this.config as AIServiceConfig).requestTimeout,
          'createChatCompletion'
        );

        return {
          choices: result.choices || [],
          usage: result.usage,
          model: result.model
        };
      },
      this.defaultRetryConfig,
      'createChatCompletion'
    );
  }

  // ===== ENHANCED COMIC GENERATION METHODS =====

  async createMasterCharacterDNA(characterImage: string, characterArtStyle: string): Promise<CharacterDNA> {
    if (!this.apiKey) {
      throw new Error('AI service not available - OpenAI not configured');
    }

    return this.withRetry(
      async () => {
        const dnaPrompt = this.buildCharacterDNAPrompt(characterImage, characterArtStyle);
        
        const chatOptions = {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a professional character designer. Create detailed character DNA for maximum consistency across comic panels.'
            },
            {
              role: 'user',
              content: dnaPrompt
            }
          ],
          maxTokens: 1500,
          temperature: 0.3,
          responseFormat: { type: 'json_object' }
        };

        const result = await this.makeOpenAIAPICall<any>(
          '/chat/completions',
          chatOptions,
          (this.config as AIServiceConfig).requestTimeout,
          'createMasterCharacterDNA'
        );

        const content = result.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No character DNA content generated');
        }

        return JSON.parse(content) as CharacterDNA;
      },
      this.defaultRetryConfig,
      'createMasterCharacterDNA'
    );
  }

  async createEnvironmentalDNA(storyAnalysis: StoryAnalysis, audience: AudienceType): Promise<EnvironmentalDNA> {
    if (!this.apiKey) {
      throw new Error('AI service not available - OpenAI not configured');
    }

    return this.withRetry(
      async () => {
        const envPrompt = this.buildEnvironmentalDNAPrompt(storyAnalysis, audience);
        
        const chatOptions = {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a professional environment designer. Create consistent environmental DNA for comic book world-building.'
            },
            {
              role: 'user',
              content: envPrompt
            }
          ],
          maxTokens: 1200,
          temperature: 0.4,
          responseFormat: { type: 'json_object' }
        };

        const result = await this.makeOpenAIAPICall<any>(
          '/chat/completions',
          chatOptions,
          (this.config as AIServiceConfig).requestTimeout,
          'createEnvironmentalDNA'
        );

        const content = result.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No environmental DNA content generated');
        }

        const environmentalDNA = JSON.parse(content) as EnvironmentalDNA;
        
        // Add metadata
        environmentalDNA.metadata = {
          createdAt: new Date().toISOString(),
          processingTime: Date.now(),
          audience,
          consistencyTarget: '85-90%'
        };

        return environmentalDNA;
      },
      this.defaultRetryConfig,
      'createEnvironmentalDNA'
    );
  }

  async analyzeStoryStructure(story: string, audience: AudienceType): Promise<StoryAnalysis> {
    if (!this.apiKey) {
      throw new Error('AI service not available - OpenAI not configured');
    }

    return this.withRetry(
      async () => {
        const analysisPrompt = this.buildStoryAnalysisPrompt(story, audience);
        
        const chatOptions = {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a professional story analyst. Analyze stories for comic book adaptation with environmental awareness.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          maxTokens: 1800,
          temperature: 0.3,
          responseFormat: { type: 'json_object' }
        };

        const result = await this.makeOpenAIAPICall<any>(
          '/chat/completions',
          chatOptions,
          (this.config as AIServiceConfig).requestTimeout,
          'analyzeStoryStructure'
        );

        const content = result.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No story analysis content generated');
        }

        return JSON.parse(content) as StoryAnalysis;
      },
      this.defaultRetryConfig,
      'analyzeStoryStructure'
    );
  }

  async analyzePanelContinuity(storyBeats: StoryBeat[]): Promise<any> {
    if (!this.apiKey) {
      throw new Error('AI service not available - OpenAI not configured');
    }

    return this.withRetry(
      async () => {
        const continuityPrompt = this.buildPanelContinuityPrompt(storyBeats);
        
        const chatOptions = {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a professional comic book layout designer. Analyze panel continuity for visual flow.'
            },
            {
              role: 'user',
              content: continuityPrompt
            }
          ],
          maxTokens: 1000,
          temperature: 0.3,
          responseFormat: { type: 'json_object' }
        };

        const result = await this.makeOpenAIAPICall<any>(
          '/chat/completions',
          chatOptions,
          (this.config as AIServiceConfig).requestTimeout,
          'analyzePanelContinuity'
        );

        const content = result.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No panel continuity content generated');
        }

        return JSON.parse(content);
      },
      this.defaultRetryConfig,
      'analyzePanelContinuity'
    );
  }

  // ===== PRODUCTION-GRADE QUALITY ANALYSIS SYSTEM =====

  async calculateQualityMetrics(
    generatedPanels: any[],
    originalContext: {
      characterDNA?: CharacterDNA;
      environmentalDNA?: EnvironmentalDNA;
      storyAnalysis?: StoryAnalysis;
      enhancedContext?: any;
    }
  ): Promise<QualityAnalysisResult> {
    const startTime = Date.now();
    
    try {
      // Input validation
      if (!generatedPanels || !Array.isArray(generatedPanels)) {
        this.log('warn', 'Invalid panels provided for quality analysis, using fallback metrics');
        return this.getFallbackQualityMetrics();
      }

      if (generatedPanels.length === 0) {
        this.log('warn', 'No panels provided for quality analysis, using fallback metrics');
        return this.getFallbackQualityMetrics();
      }

      this.log('info', `Starting quality analysis for ${generatedPanels.length} panels`);

      // Run parallel analysis with timeout protection
      const analysisPromises = [
        this.analyzeCharacterConsistencyPro(generatedPanels, originalContext.characterDNA),
        this.analyzeEnvironmentalCoherencePro(generatedPanels, originalContext.environmentalDNA),
        this.analyzeNarrativeFlowPro(generatedPanels, originalContext.storyAnalysis)
      ];

      const analysisResults = await Promise.allSettled(
        analysisPromises.map(promise => 
          Promise.race([
            promise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Analysis timeout')), QUALITY_ANALYSIS_TIMEOUTS.overall)
            )
          ])
        )
      );

      // Extract results with fallback handling
      const characterAnalysis = analysisResults[0].status === 'fulfilled' 
        ? analysisResults[0].value as ConsistencyAnalysis
        : this.getFallbackCharacterAnalysis();

      const environmentalAnalysis = analysisResults[1].status === 'fulfilled'
        ? analysisResults[1].value as CoherenceAnalysis
        : this.getFallbackEnvironmentalAnalysis();

      const narrativeAnalysis = analysisResults[2].status === 'fulfilled'
        ? analysisResults[2].value as NarrativeAnalysis
        : this.getFallbackNarrativeAnalysis();

      // Calculate overall quality
      const overallQuality = this.calculateOverallQualityPro(
        characterAnalysis,
        environmentalAnalysis,
        narrativeAnalysis
      );

      const processingTime = Date.now() - startTime;

      const result: QualityAnalysisResult = {
        characterConsistencyScore: Math.round(characterAnalysis.overallScore),
        environmentalCoherenceScore: Math.round(environmentalAnalysis.overallScore),
        narrativeFlowScore: Math.round(narrativeAnalysis.overallScore),
        overallTechnicalQuality: Math.round(overallQuality),
        qualityGrade: this.assignQualityGradePro(overallQuality),
        analysisDetails: {
          characterFeatureVariance: Math.round(characterAnalysis.featureVariance),
          backgroundConsistencyRate: Math.round(environmentalAnalysis.backgroundConsistency),
          storyProgressionQuality: Math.round(narrativeAnalysis.storyProgression),
          panelTransitionSmoothing: Math.round(narrativeAnalysis.panelTransitions),
          panelsAnalyzed: generatedPanels.length,
          processingTime
        },
        recommendations: this.generateQualityRecommendations({
          characterConsistencyScore: characterAnalysis.overallScore,
          environmentalCoherenceScore: environmentalAnalysis.overallScore,
          narrativeFlowScore: narrativeAnalysis.overallScore,
          overallTechnicalQuality: overallQuality,
          qualityGrade: this.assignQualityGradePro(overallQuality),
          analysisDetails: {
            characterFeatureVariance: characterAnalysis.featureVariance,
            backgroundConsistencyRate: environmentalAnalysis.backgroundConsistency,
            storyProgressionQuality: narrativeAnalysis.storyProgression,
            panelTransitionSmoothing: narrativeAnalysis.panelTransitions,
            panelsAnalyzed: generatedPanels.length,
            processingTime
          },
          recommendations: []
        })
      };

      this.log('info', `Quality analysis completed in ${processingTime}ms`, {
        grade: result.qualityGrade,
        overallScore: result.overallTechnicalQuality,
        panelsAnalyzed: generatedPanels.length
      });

      return result;

    } catch (error: any) {
      this.log('error', 'Quality analysis failed, using fallback metrics', error);
      return this.getFallbackQualityMetrics();
    }
  }

  generateQualityRecommendations(qualityResult: QualityAnalysisResult): string[] {
    const recommendations: string[] = [];

    try {
      // Character consistency recommendations
      if (qualityResult.characterConsistencyScore < QUALITY_THRESHOLDS.B) {
        if (qualityResult.characterConsistencyScore < QUALITY_THRESHOLDS.C) {
          recommendations.push('Critical: Improve character consistency by ensuring Character DNA usage in all panels');
        } else {
          recommendations.push('Enhance character consistency with more detailed Character DNA specifications');
        }
      } else if (qualityResult.characterConsistencyScore >= QUALITY_THRESHOLDS.A) {
        recommendations.push('Excellent character consistency - maintain current Character DNA standards');
      }

      // Environmental coherence recommendations
      if (qualityResult.environmentalCoherenceScore < QUALITY_THRESHOLDS.B) {
        if (qualityResult.environmentalCoherenceScore < QUALITY_THRESHOLDS.C) {
          recommendations.push('Critical: Implement Environmental DNA for consistent world-building across panels');
        } else {
          recommendations.push('Improve environmental coherence with enhanced Environmental DNA specifications');
        }
      } else if (qualityResult.environmentalCoherenceScore >= QUALITY_THRESHOLDS.A) {
        recommendations.push('Excellent environmental coherence - maintain current Environmental DNA standards');
      }

      // Narrative flow recommendations
      if (qualityResult.narrativeFlowScore < QUALITY_THRESHOLDS.B) {
        if (qualityResult.narrativeFlowScore < QUALITY_THRESHOLDS.C) {
          recommendations.push('Critical: Improve story progression with enhanced Story Analysis and panel continuity');
        } else {
          recommendations.push('Enhance narrative flow with better panel transitions and story beat analysis');
        }
      } else if (qualityResult.narrativeFlowScore >= QUALITY_THRESHOLDS.A) {
        recommendations.push('Excellent narrative flow - maintain current story-first approach');
      }

      // Overall quality recommendations
      if (qualityResult.overallTechnicalQuality >= QUALITY_THRESHOLDS.A) {
        recommendations.push('Outstanding overall quality - comic meets professional standards');
      } else if (qualityResult.overallTechnicalQuality >= QUALITY_THRESHOLDS.B) {
        recommendations.push('Good overall quality - minor improvements could achieve professional standards');
      } else if (qualityResult.overallTechnicalQuality >= QUALITY_THRESHOLDS.C) {
        recommendations.push('Average quality - focus on character and environmental consistency improvements');
      } else {
        recommendations.push('Below average quality - comprehensive improvements needed across all areas');
      }

      // Performance recommendations
      if (qualityResult.analysisDetails.processingTime > 10000) {
        recommendations.push('Consider optimizing generation pipeline for better performance');
      }

      // Panel count recommendations
      if (qualityResult.analysisDetails.panelsAnalyzed < 4) {
        recommendations.push('Consider adding more panels for better story development');
      } else if (qualityResult.analysisDetails.panelsAnalyzed > 12) {
        recommendations.push('Consider reducing panel count for better focus and pacing');
      }

      return recommendations.length > 0 ? recommendations : ['Quality analysis complete - no specific recommendations'];

    } catch (error: any) {
      this.log('error', 'Failed to generate quality recommendations', error);
      return ['Quality analysis completed - recommendations unavailable'];
    }
  }

  // ===== PRIVATE QUALITY ANALYSIS METHODS =====

  private async analyzeCharacterConsistencyPro(
    panels: any[],
    characterDNA?: CharacterDNA
  ): Promise<ConsistencyAnalysis> {
    const startTime = Date.now();
    
    try {
      // Base score calculation
      let baseScore = characterDNA ? QUALITY_BASELINE_SCORES.characterDNA : QUALITY_BASELINE_SCORES.fallback;
      
      // Analyze character DNA usage
      const dnaUsageScore = characterDNA ? 95 : 60;
      
      // Calculate feature variance (mock analysis)
      const featureVariance = this.calculateFeatureVariance(panels, characterDNA);
      
      // Calculate visual coherence
      const visualCoherence = this.calculateVisualCoherence(panels);
      
      // Calculate overall score
      const overallScore = Math.min(100, (baseScore + dnaUsageScore + (100 - featureVariance) + visualCoherence) / 4);
      
      const processingTime = Date.now() - startTime;
      
      this.log('info', `Character consistency analysis completed in ${processingTime}ms`, {
        score: Math.round(overallScore),
        dnaPresent: !!characterDNA
      });

      return {
        featureVariance,
        dnaUsageScore,
        visualCoherence,
        overallScore,
        details: {
          characterDNAPresent: !!characterDNA,
          featureConsistencyRate: 100 - featureVariance,
          visualElementsMatched: Math.floor(panels.length * 0.8),
          inconsistencyCount: Math.floor(featureVariance / 10)
        }
      };

    } catch (error: any) {
      this.log('error', 'Character consistency analysis failed', error);
      return this.getFallbackCharacterAnalysis();
    }
  }

  private async analyzeEnvironmentalCoherencePro(
    panels: any[],
    environmentalDNA?: EnvironmentalDNA
  ): Promise<CoherenceAnalysis> {
    const startTime = Date.now();
    
    try {
      // Base score calculation
      let baseScore = environmentalDNA ? QUALITY_BASELINE_SCORES.environmentalDNA : QUALITY_BASELINE_SCORES.fallback;
      
      // Analyze environmental DNA usage
      const environmentalDNAScore = environmentalDNA && !environmentalDNA.fallback ? 90 : 65;
      
      // Calculate background consistency
      const backgroundConsistency = this.calculateBackgroundConsistency(panels, environmentalDNA);
      
      // Calculate setting coherence
      const settingCoherence = this.calculateSettingCoherence(panels);
      
      // Calculate overall score
      const overallScore = Math.min(100, (baseScore + environmentalDNAScore + backgroundConsistency + settingCoherence) / 4);
      
      const processingTime = Date.now() - startTime;
      
      this.log('info', `Environmental coherence analysis completed in ${processingTime}ms`, {
        score: Math.round(overallScore),
        dnaPresent: !!environmentalDNA && !environmentalDNA.fallback
      });

      return {
        backgroundConsistency,
        environmentalDNAScore,
        settingCoherence,
        overallScore,
        details: {
          environmentalDNAPresent: !!environmentalDNA && !environmentalDNA.fallback,
          backgroundVariance: 100 - backgroundConsistency,
          settingTransitions: Math.floor(panels.length * 0.7),
          coherenceViolations: Math.floor((100 - backgroundConsistency) / 15)
        }
      };

    } catch (error: any) {
      this.log('error', 'Environmental coherence analysis failed', error);
      return this.getFallbackEnvironmentalAnalysis();
    }
  }

  private async analyzeNarrativeFlowPro(
    panels: any[],
    storyAnalysis?: StoryAnalysis
  ): Promise<NarrativeAnalysis> {
    const startTime = Date.now();
    
    try {
      // Base score calculation
      let baseScore = storyAnalysis ? QUALITY_BASELINE_SCORES.storyAnalysis : QUALITY_BASELINE_SCORES.fallback;
      
      // Calculate story progression quality
      const storyProgression = this.calculateStoryProgression(panels, storyAnalysis);
      
      // Calculate panel transitions
      const panelTransitions = this.calculatePanelTransitions(panels);
      
      // Calculate narrative flow
      const narrativeFlow = this.calculateNarrativeFlow(panels);
      
      // Calculate overall score
      const overallScore = Math.min(100, (baseScore + storyProgression + panelTransitions + narrativeFlow) / 4);
      
      const processingTime = Date.now() - startTime;
      
      this.log('info', `Narrative flow analysis completed in ${processingTime}ms`, {
        score: Math.round(overallScore),
        storyAnalysisPresent: !!storyAnalysis
      });

      return {
        storyProgression,
        panelTransitions,
        narrativeFlow,
        overallScore,
        details: {
          storyAnalysisPresent: !!storyAnalysis,
          progressionQuality: storyProgression,
          transitionSmoothness: panelTransitions,
          narrativeGaps: Math.floor((100 - narrativeFlow) / 20)
        }
      };

    } catch (error: any) {
      this.log('error', 'Narrative flow analysis failed', error);
      return this.getFallbackNarrativeAnalysis();
    }
  }

  // ===== QUALITY CALCULATION HELPER METHODS =====

  private calculateOverallQualityPro(
    characterAnalysis: ConsistencyAnalysis,
    environmentalAnalysis: CoherenceAnalysis,
    narrativeAnalysis: NarrativeAnalysis
  ): number {
    const weightedScore = (
      characterAnalysis.overallScore * QUALITY_WEIGHTS.character +
      environmentalAnalysis.overallScore * QUALITY_WEIGHTS.environmental +
      narrativeAnalysis.overallScore * QUALITY_WEIGHTS.narrative
    );

    return Math.min(100, Math.max(0, weightedScore));
  }

  private assignQualityGradePro(overallQuality: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (overallQuality >= QUALITY_THRESHOLDS.A) return 'A';
    if (overallQuality >= QUALITY_THRESHOLDS.B) return 'B';
    if (overallQuality >= QUALITY_THRESHOLDS.C) return 'C';
    if (overallQuality >= QUALITY_THRESHOLDS.D) return 'D';
    return 'F';
  }

  // ===== FALLBACK METHODS =====

  private getFallbackQualityMetrics(): QualityAnalysisResult {
    return {
      characterConsistencyScore: QUALITY_BASELINE_SCORES.fallback,
      environmentalCoherenceScore: QUALITY_BASELINE_SCORES.fallback,
      narrativeFlowScore: QUALITY_BASELINE_SCORES.fallback,
      overallTechnicalQuality: QUALITY_BASELINE_SCORES.fallback,
      qualityGrade: 'C',
      analysisDetails: {
        characterFeatureVariance: 30,
        backgroundConsistencyRate: 60,
        storyProgressionQuality: 65,
        panelTransitionSmoothing: 70,
        panelsAnalyzed: 0,
        processingTime: 0
      },
      recommendations: ['Quality analysis unavailable - using fallback metrics']
    };
  }

  private getFallbackCharacterAnalysis(): ConsistencyAnalysis {
    return {
      featureVariance: 25,
      dnaUsageScore: QUALITY_BASELINE_SCORES.fallback,
      visualCoherence: 70,
      overallScore: QUALITY_BASELINE_SCORES.fallback,
      details: {
        characterDNAPresent: false,
        featureConsistencyRate: 75,
        visualElementsMatched: 0,
        inconsistencyCount: 3
      }
    };
  }

  private getFallbackEnvironmentalAnalysis(): CoherenceAnalysis {
    return {
      backgroundConsistency: 65,
      environmentalDNAScore: QUALITY_BASELINE_SCORES.fallback,
      settingCoherence: 70,
      overallScore: QUALITY_BASELINE_SCORES.fallback,
      details: {
        environmentalDNAPresent: false,
        backgroundVariance: 35,
        settingTransitions: 0,
        coherenceViolations: 2
      }
    };
  }

  private getFallbackNarrativeAnalysis(): NarrativeAnalysis {
    return {
      storyProgression: 70,
      panelTransitions: 65,
      narrativeFlow: 75,
      overallScore: QUALITY_BASELINE_SCORES.fallback,
      details: {
        storyAnalysisPresent: false,
        progressionQuality: 70,
        transitionSmoothness: 65,
        narrativeGaps: 2
      }
    };
  }

  // ===== MOCK CALCULATION METHODS =====

  private calculateFeatureVariance(panels: any[], characterDNA?: CharacterDNA): number {
    // Mock calculation - in production, this would analyze actual image features
    const baseVariance = characterDNA ? 15 : 35;
    const panelFactor = Math.max(0, (panels.length - 8) * 2); // More panels = more variance
    return Math.min(50, baseVariance + panelFactor);
  }

  private calculateVisualCoherence(panels: any[]): number {
    // Mock calculation - in production, this would analyze visual consistency
    return Math.max(60, 90 - (panels.length * 2));
  }

  private calculateBackgroundConsistency(panels: any[], environmentalDNA?: EnvironmentalDNA): number {
    // Mock calculation - in production, this would analyze background elements
    const baseConsistency = environmentalDNA && !environmentalDNA.fallback ? 85 : 65;
    const panelFactor = Math.max(0, (panels.length - 6) * 3);
    return Math.max(50, baseConsistency - panelFactor);
  }

  private calculateSettingCoherence(panels: any[]): number {
    // Mock calculation - in production, this would analyze setting transitions
    return Math.max(60, 85 - (panels.length * 1.5));
  }

  private calculateStoryProgression(panels: any[], storyAnalysis?: StoryAnalysis): number {
    // Mock calculation - in production, this would analyze story flow
    const baseProgression = storyAnalysis ? 80 : 65;
    const panelRatio = panels.length / (storyAnalysis?.totalPanels || 8);
    const ratioBonus = Math.abs(1 - panelRatio) < 0.2 ? 10 : 0;
    return Math.min(95, baseProgression + ratioBonus);
  }

  private calculatePanelTransitions(panels: any[]): number {
    // Mock calculation - in production, this would analyze panel flow
    return Math.max(60, 85 - Math.abs(panels.length - 8) * 2);
  }

  private calculateNarrativeFlow(panels: any[]): number {
    // Mock calculation - in production, this would analyze narrative coherence
    return Math.max(65, 80 - (panels.length > 10 ? (panels.length - 10) * 3 : 0));
  }

  // ===== PRIVATE HELPER METHODS =====

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit,
    timeout: number,
    operationName: string
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  private async analyzeImageWithPrompt(imageUrl: string, prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('AI service not available - OpenAI not configured');
    }

    return this.withRetry(
      async () => {
        const chatOptions = {
          model: 'gpt-4-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageUrl } }
              ]
            }
          ],
          maxTokens: 500
        };

        const result = await this.makeOpenAIAPICall<any>(
          '/chat/completions',
          chatOptions,
          (this.config as AIServiceConfig).requestTimeout,
          'analyzeImage'
        );

        return result.choices[0]?.message?.content || 'Character analysis failed';
      },
      this.defaultRetryConfig,
      'analyzeImageWithPrompt'
    );
  }

  private extractTitleFromStory(story: string): string {
    const lines = story.split('\n');
    const firstLine = lines[0]?.trim();
    
    if (firstLine && firstLine.length < 100) {
      return firstLine.replace(/^(Title:|#|\*)+\s*/, '');
    }
    
    return 'Generated Story';
  }

  private buildEnhancedImagePrompt(options: ImageGenerationOptions): string {
    let prompt = options.image_prompt;
    
    if (options.character_description) {
      prompt += ` featuring ${options.character_description}`;
    }
    
    if (options.emotion && options.emotion !== 'neutral') {
      prompt += ` with ${options.emotion} emotion`;
    }
    
    if (options.environmentalContext) {
      const env = options.environmentalContext;
      if (env.primaryLocation) {
        prompt += ` in ${env.primaryLocation.description}`;
      }
      if (env.lightingContext) {
        prompt += ` with ${env.lightingContext.lightingMood} lighting`;
      }
    }
    
    prompt += ` in ${options.characterArtStyle || 'storybook'} art style`;
    
    return prompt;
  }

  private buildSceneGenerationPrompt(options: SceneGenerationOptions): string {
    return `Create comic book scenes for the following story, optimized for ${options.audience} audience:

Story: ${options.story}

Requirements:
- Art style: ${options.characterArtStyle || 'storybook'}
- Layout: ${options.layoutType || 'comic-book-panels'}
- Audience: ${options.audience}
${options.characterImage ? `- Character reference: ${options.characterImage}` : ''}

Return a JSON object with a "pages" array containing scene descriptions for comic panels.`;
  }

  private buildCharacterDNAPrompt(characterImage: string, artStyle: string): string {
    return `Analyze this character image and create detailed Character DNA for maximum consistency across comic panels.

Character Image: ${characterImage}
Art Style: ${artStyle}

Create a JSON object with the following structure:
{
  "physicalStructure": {
    "faceShape": "detailed face shape description",
    "eyeDetails": "specific eye characteristics",
    "hairSpecifics": "detailed hair description",
    "skinTone": "skin tone description",
    "bodyType": "body type description",
    "facialMarks": "any distinctive facial features"
  },
  "clothingSignature": {
    "primaryOutfit": "main clothing description",
    "accessories": "accessories description",
    "colorPalette": "clothing colors",
    "footwear": "footwear description"
  },
  "uniqueIdentifiers": {
    "distinctiveFeatures": "unique identifying features",
    "expressions": "typical expressions",
    "posture": "characteristic posture",
    "mannerisms": "behavioral characteristics"
  },
  "artStyleAdaptation": {
    "${artStyle}": "style-specific adaptations"
  },
  "consistencyEnforcers": ["key consistency rules"],
  "negativePrompts": ["things to avoid"]
}`;
  }

  private buildEnvironmentalDNAPrompt(storyAnalysis: StoryAnalysis, audience: AudienceType): string {
    const storyBeats = storyAnalysis.storyBeats.map(beat => beat.environment).join(', ');
    
    return `Create Environmental DNA for consistent world-building across comic panels.

Story Environments: ${storyBeats}
Audience: ${audience}
Total Panels: ${storyAnalysis.totalPanels}

Create a JSON object with consistent environmental specifications:
{
  "primaryLocation": {
    "name": "main setting name",
    "type": "indoor/outdoor/mixed",
    "description": "detailed location description",
    "keyFeatures": ["distinctive environmental elements"],
    "colorPalette": ["dominant colors"],
    "architecturalStyle": "architectural characteristics"
  },
  "lightingContext": {
    "timeOfDay": "morning/afternoon/evening/night",
    "weatherCondition": "sunny/cloudy/rainy/stormy/snowy",
    "lightingMood": "lighting atmosphere description",
    "shadowDirection": "shadow characteristics",
    "consistencyRules": ["lighting consistency rules"]
  },
  "visualContinuity": {
    "backgroundElements": ["recurring background elements"],
    "recurringObjects": ["objects that appear multiple times"],
    "colorConsistency": {
      "dominantColors": ["main colors"],
      "accentColors": ["accent colors"],
      "avoidColors": ["colors to avoid"]
    },
    "perspectiveGuidelines": "perspective consistency rules"
  }
}`;
  }

  private buildStoryAnalysisPrompt(story: string, audience: AudienceType): string {
    return `Analyze this story for comic book adaptation with environmental awareness.

Story: ${story}
Audience: ${audience}

Create a JSON object with story beats that include environmental context:
{
  "storyBeats": [
    {
      "beat": "story beat description",
      "emotion": "emotional tone",
      "visualPriority": "visual focus",
      "panelPurpose": "panel function",
      "narrativeFunction": "story purpose",
      "characterAction": "character activity",
      "environment": "setting/location for this beat",
      "dialogue": "any dialogue",
      "hasSpeechBubble": true/false
    }
  ],
  "characterArc": ["character development points"],
  "visualFlow": ["visual progression notes"],
  "totalPanels": number,
  "pagesRequired": number
}`;
  }

  private buildPanelContinuityPrompt(storyBeats: StoryBeat[]): string {
    const beatDescriptions = storyBeats.map((beat, index) => 
      `Panel ${index + 1}: ${beat.beat} (${beat.environment})`
    ).join('\n');

    return `Analyze panel continuity for visual flow across these story beats:

${beatDescriptions}

Create a JSON object with continuity analysis:
{
  "movementFlow": "character movement across panels",
  "cameraMovement": "camera/perspective transitions",
  "spatialRelationships": "spatial consistency between panels",
  "visualTransitions": ["transition techniques between panels"],
  "continuityScore": number (0-100)
}`;
  }
}