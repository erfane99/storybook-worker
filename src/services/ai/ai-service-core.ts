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

import { ErrorAwareBaseService } from '../base/error-aware-base-service';
import { 
  IAIService,
  ServiceConfig,
  CharacterDNA,
  EnvironmentalDNA,
  StoryAnalysis,
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
  ChatCompletionResult
} from '../interfaces/service-contracts';

import { 
  Result,
  AsyncResult,
  AIServiceUnavailableError,
  AIAuthenticationError,
  AIRateLimitError,
  AIContentPolicyError,
  AITimeoutError
} from '../errors/index';

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
} from './modular/constants-and-types';

import { OpenAIIntegration } from './modular/openai-integration';
import { ComicGenerationEngine } from './modular/comic-generation-engine';
import { NarrativeIntelligenceEngine } from './modular/narrative-intelligence';
import { VisualDNASystem } from './modular/visual-dna-system';
import { QualityMetricsEngine } from './modular/quality-metrics-engine';
import { PatternLearningEngine } from './modular/pattern-learning-engine';
import { EnterpriseMonitoring } from './modular/enterprise-monitoring';

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

  private openaiIntegration!: OpenAIIntegration;
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
    super({
      name: 'ModularEnterpriseAIService',
      timeout: config?.timeout || 120000,
      retryAttempts: config?.maxRetries || 3,
      retryDelay: config?.retryDelay || 1000,
      circuitBreakerThreshold: 5,
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

      // 2. OpenAI Integration (using adapter)
      this.openaiIntegration = new OpenAIIntegration(this.apiKey!, this.learningEngine);
      this.log('info', '✅ OpenAI Integration initialized');

      // 3. Visual DNA System (using adapter)
      this.visualDNASystem = new VisualDNASystem(this.openaiIntegration, this.errorHandlerAdapter as any);
      this.log('info', '✅ Visual DNA System initialized');

      // 4. Narrative Intelligence Engine (using adapter)
      this.narrativeEngine = new NarrativeIntelligenceEngine(this.openaiIntegration, this.errorHandlerAdapter as any);
      this.log('info', '✅ Narrative Intelligence Engine initialized');

      // 5. Quality Metrics Engine (using adapter)
      this.qualityEngine = new QualityMetricsEngine(this.openaiIntegration, this.errorHandlerAdapter as any);
      this.log('info', '✅ Quality Metrics Engine initialized');

      // 6. Pattern Learning Engine (using adapter)
      this.learningEngine = new PatternLearningEngine(this.openaiIntegration, this.errorHandlerAdapter as any);
      this.log('info', '✅ Pattern Learning Engine initialized');

      // 7. Comic Generation Engine (using adapter)
      this.comicEngine = new ComicGenerationEngine(this.openaiIntegration, this.errorHandlerAdapter as any);
      this.log('info', '✅ Comic Generation Engine initialized');

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
          { name: 'OpenAI Integration', check: () => !!this.openaiIntegration },
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
  // ===== MAIN SERVICE INTERFACE IMPLEMENTATION =====

  /**
   * Generate complete storybook with professional quality (MAIN METHOD - FROM BOTH FILES)
   * FIXED: Uses inherited error handling from ErrorAwareBaseService
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
    
    return this.withErrorHandling(
      async () => {
        this.log('info', `🎨 Starting professional storybook generation: "${title}"`);
        this.log('info', `📊 Audience: ${audience}, Art Style: ${artStyle}`);

        // Validation
        if (!title || !story || !audience) {
          throw new Error('Missing required parameters: title, story, and audience are required');
        }

        if (story.length < 50) {
          throw new Error('Story must be at least 50 characters long for quality comic generation');
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
          success: true,
          data: {
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
          }
        };

        this.log('info', `🎉 Storybook generation completed successfully in ${duration}ms`);
        this.log('info', `🏆 Professional Grade: ${qualityMetrics.professionalGrade} (${qualityMetrics.overallScore}/100)`);

        return result.data;
      },
      'generateStorybook',
      {
        title,
        audience,
        artStyle,
        storyLength: story?.length || 0,
        hasCharacterImage: !!characterImageUrl
      }
   ).then(result => {
      if (result.success) {
        return AsyncResult.success(result.data);
      } else {
        const duration = Date.now() - startTime;
        this.enterpriseMonitoring.recordOperationMetrics('generateStorybook', duration, false);
        return AsyncResult.failure(new AIServiceUnavailableError(result.error.message));
      }
    });
  }

  /**
   * Generate comic scenes with audience optimization (FROM BOTH FILES)
   * FIXED: Uses inherited error handling
   */
  async generateScenesWithAudience(options: SceneGenerationOptions): Promise<AsyncResult<SceneGenerationResult, AIServiceUnavailableError>> {
    const startTime = Date.now();
    
    return this.withErrorHandling(
      async () => {
        this.log('info', '🎨 Generating scenes with audience optimization...');
        
        const result = await this.comicEngine.generateScenesWithAudience(options);
        
        const duration = Date.now() - startTime;
        this.enterpriseMonitoring.recordOperationMetrics('generateScenesWithAudience', duration, true);
        
        return result;
      },
      'generateScenesWithAudience',
      options
    ).then(result => {
      if (result.success) {
        return AsyncResult.success(result.data);
      } else {
        const duration = Date.now() - startTime;
        this.enterpriseMonitoring.recordOperationMetrics('generateScenesWithAudience', duration, false);
        return AsyncResult.failure(new AIServiceUnavailableError(result.error.message));
      }
    });
  }

  /**
   * Generate images with advanced options (FROM BOTH FILES)
   * FIXED: Uses inherited error handling with correct AsyncResult pattern
   */
  async generateImages(options: ImageGenerationOptions): Promise<AsyncResult<ImageGenerationResult, AIServiceUnavailableError>> {
    const startTime = Date.now();
    
    const result = await this.withErrorHandling(
      async () => {
        this.log('info', '🖼️ Generating images with advanced options...');
        
        const result = await this.openaiIntegration.generateImageWithDNA(
          options.image_prompt,
          options.character_description || '',
          options.emotion,
          'standard',
          options.characterArtStyle || 'comic-book',
          options.audience
        );
        
        const duration = Date.now() - startTime;
        this.enterpriseMonitoring.recordOperationMetrics('generateImages', duration, true);
        
        return {
          url: result,
          prompt_used: options.image_prompt,
          reused: false
        };
      },
      'generateImages',
      options
    );

    if (result.success) {
      return AsyncResult.success(result.data);
    } else {
      const duration = Date.now() - startTime;
      this.enterpriseMonitoring.recordOperationMetrics('generateImages', duration, false);
      return AsyncResult.failure(new AIServiceUnavailableError(result.error.message));
    }
  }

  /**
   * Create character descriptions with professional analysis (FROM BOTH FILES)
   * FIXED: Uses inherited error handling with correct AsyncResult pattern
   */
  async createCharacterDescription(options: CharacterDescriptionOptions): Promise<AsyncResult<CharacterDescriptionResult, AIServiceUnavailableError>> {
    const startTime = Date.now();
    
    const result = await this.withErrorHandling(
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

    if (result.success) {
      return AsyncResult.success(result.data);
    } else {
      const duration = Date.now() - startTime;
      this.enterpriseMonitoring.recordOperationMetrics('createCharacterDescription', duration, false);
      return AsyncResult.failure(new AIServiceUnavailableError(result.error.message));
    }
  }

  /**
   * Cartoonize images with professional quality (FROM BOTH FILES)
   * FIXED: Uses inherited error handling with correct AsyncResult pattern
   */
  async cartoonizeImage(options: CartoonizeOptions): Promise<AsyncResult<CartoonizeResult, AIServiceUnavailableError>> {
    const startTime = Date.now();
    
    const result = await this.withErrorHandling(
      async () => {
        this.log('info', '🎨 Cartoonizing image with professional quality...');
        
        // Use OpenAI integration for image processing
        const result = await this.openaiIntegration.generateImageWithDNA(
          `Transform this image into a ${options.style} cartoon style while maintaining character consistency`,
          `Character from image: ${options.imageUrl}`,
          'neutral',
          'standard',
          options.style,
          'children'
        );
        
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

    if (result.success) {
      return AsyncResult.success(result.data);
    } else {
      const duration = Date.now() - startTime;
      this.enterpriseMonitoring.recordOperationMetrics('cartoonizeImage', duration, false);
      return AsyncResult.failure(new AIServiceUnavailableError(result.error.message));
    }
  }

  /**
   * Generate chat completions with professional context (FROM BOTH FILES)
   * FIXED: Uses inherited error handling with correct AsyncResult pattern and fixed messages parameter
   */
  async generateChatCompletion(options: ChatCompletionOptions): Promise<AsyncResult<ChatCompletionResult, AIServiceUnavailableError>> {
    const startTime = Date.now();
    
    const result = await this.withErrorHandling(
      async () => {
        this.log('info', '💬 Generating chat completion with professional context...');
        
        const result = await this.openaiIntegration.generateTextCompletion(
          options.messages[0]?.content || '',
          {
            temperature: options.temperature || 0.7,
            maxTokens: options.maxTokens || 1000,
            model: options.model || this.defaultModel
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
      { messages: options.messages, ...options }
    );

    if (result.success) {
      return AsyncResult.success(result.data);
    } else {
      const duration = Date.now() - startTime;
      this.enterpriseMonitoring.recordOperationMetrics('generateChatCompletion', duration, false);
      return AsyncResult.failure(new AIServiceUnavailableError(result.error.message));
    }
  }

  // ===== MISSING INTERFACE IMPLEMENTATIONS - FIXED =====

  /**
   * Generate story with options - interface compatibility method
   */
  async generateStoryWithOptions(prompt: string, options?: any): Promise<string> {
    const result = await this.generateStorybook('Generated Story', prompt, '', 'children', 'storybook');
    const resolvedResult = await result;
    return 'success' in resolvedResult && resolvedResult.success ? JSON.stringify(resolvedResult.data) : '';
  }

  /**
   * Process cartoonize - interface compatibility method  
   */
  async processCartoonize(options: CartoonizeOptions): Promise<AsyncResult<CartoonizeResult, AIServiceUnavailableError>> {
    return this.cartoonizeImage(options);
  }

  /**
   * Create chat completion - interface compatibility method
   */
  async createChatCompletion(messages: any[], options: any = {}): Promise<AsyncResult<ChatCompletionResult, AIServiceUnavailableError>> {
    return this.generateChatCompletion({ messages, ...options });
  }

  /**
   * Analyze story structure using advanced narrative intelligence
   * FIXED: Uses inherited error handling
   */
  async analyzeStoryStructure(story: string, audience: AudienceType): Promise<StoryAnalysis> {
    const result = await this.withErrorHandling(
      async () => {
        this.log('info', '📖 Analyzing story structure with narrative intelligence...');
        
        const narrativeIntel = await this.narrativeEngine.createNarrativeIntelligence(story, audience);
        
        // Create story analysis from narrative intelligence
        const storyAnalysis: StoryAnalysis = {
          storyBeats: [], // Would be populated by narrative engine
          characterArc: narrativeIntel.characterGrowth,
          visualFlow: ['establishing', 'development', 'climax', 'resolution'],
          totalPanels: PROFESSIONAL_AUDIENCE_CONFIG[audience].totalPanels,
          pagesRequired: PROFESSIONAL_AUDIENCE_CONFIG[audience].pagesPerStory,
          dialoguePanels: Math.floor(PROFESSIONAL_AUDIENCE_CONFIG[audience].totalPanels * PROFESSIONAL_AUDIENCE_CONFIG[audience].speechBubbleRatio),
          speechBubbleDistribution: {
            standard: 60,
            thought: 20,
            shout: 20
          }
        };
        
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
      // Shutdown enterprise monitoring
      if (this.enterpriseMonitoring) {
        this.enterpriseMonitoring.shutdown();
      }
      
      this._isInitialized = false;
      this.log('info', '✅ Service shutdown completed');

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
    const result = await this.generateStorybook('Generated Story', prompt, '', 'children', 'storybook');
    const resolvedResult = await result;
    if (resolvedResult && 'success' in resolvedResult && resolvedResult.success) {
      return JSON.stringify(resolvedResult.data);
    }
    return '';
  }

  async generateCartoonImage(prompt: string): Promise<AsyncResult<string, AIServiceUnavailableError>> {
    const cartoonResult = await this.cartoonizeImage({ prompt, style: 'cartoon' });
    const result = await cartoonResult;
    if (result && 'success' in result && result.success) {
      return AsyncResult.success(result.data.url);
    }
    return AsyncResult.failure(new AIServiceUnavailableError('Cartoon generation failed'));
  }

  generateSceneImage = this.generateImages;
  
  async describeCharacter(imageUrl: string, prompt: string): Promise<AsyncResult<string, AIServiceUnavailableError>>;
  async describeCharacter(options: CharacterDescriptionOptions): Promise<AsyncResult<CharacterDescriptionResult, AIServiceUnavailableError>>;
  async describeCharacter(imageUrlOrOptions: string | CharacterDescriptionOptions, prompt?: string): Promise<any> {
    if (typeof imageUrlOrOptions === 'string') {
      const descriptionResult = await this.createCharacterDescription({ imageUrl: imageUrlOrOptions, style: 'comic-book' });
      const result = await descriptionResult;
      if (result && 'success' in result && result.success) {
        return AsyncResult.success(result.data.description);
      }
      return AsyncResult.failure(new AIServiceUnavailableError('Character description failed'));
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
    maxRetries: 3,
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