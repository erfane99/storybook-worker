// Enhanced AI Service - Production Implementation with Deep Content Discovery System
import { EnhancedBaseService } from '../base/enhanced-base-service.js';
import { 
  IAIService,
  ServiceConfig,
  RetryConfig,
  StoryGenerationOptions,
  SceneGenerationResult,
  ChatCompletionOptions,
  ChatCompletionResult
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
import { environmentManager } from '../../lib/config/environment.js';

export interface AIConfig extends ServiceConfig {
  apiKey: string;
  baseUrl: string;
  gptTimeout: number;
  dalleTimeout: number;
  maxTokens: number;
  rateLimitRpm: number;
}

// ===== ENHANCED SCENE GENERATION INTERFACES =====

export type AudienceType = 'children' | 'young_adults' | 'adults';

export interface Scene {
  description: string;
  emotion: string;
  imagePrompt: string;
  generatedImage?: string;
  panelType?: string;
  layoutType?: string;
  characterArtStyle?: string;
}

export interface Page {
  pageNumber: number;
  scenes: Scene[];
  layoutType?: string;
  characterArtStyle?: string;
}

export interface EnhancedSceneGenerationOptions {
  story: string;
  audience: AudienceType;
  characterImage?: string;
  characterArtStyle?: string;
  layoutType?: string;
}

export interface EnhancedSceneGenerationResult {
  pages: Page[];
  audience: AudienceType;
  characterImage?: string;
  layoutType?: string;
  characterArtStyle?: string;
  metadata?: any;
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
    },
    {
      name: 'result_pages',
      path: ['result', 'pages'],
      validator: (obj: any) => obj.result && Array.isArray(obj.result.pages) && obj.result.pages.length > 0,
      priority: 75
    },
    {
      name: 'layout_pages',
      path: ['layout', 'pages'],
      validator: (obj: any) => obj.layout && Array.isArray(obj.layout.pages) && obj.layout.pages.length > 0,
      priority: 70
    },
    {
      name: 'comic_scenes',
      path: ['comic', 'scenes'],
      validator: (obj: any) => obj.comic && Array.isArray(obj.comic.scenes) && obj.comic.scenes.length > 0,
      priority: 65
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
    const openaiStatus = environmentManager.getServiceStatus('openai');
    
    if (!openaiStatus.isAvailable) {
      throw new Error(`OpenAI not configured: ${openaiStatus.message}`);
    }

    this.apiKey = process.env.OPENAI_API_KEY!;
  }

  protected async disposeService(): Promise<void> {
    this.rateLimiter.clear();
  }

  protected async checkServiceHealth(): Promise<boolean> {
    return this.apiKey !== null;
  }

  // ===== AI OPERATIONS IMPLEMENTATION =====

  async generateStory(prompt: string, options: StoryGenerationOptions = {}): Promise<string> {
    const result = await this.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Generate a story following the provided guidelines.' }
      ],
      temperature: 0.8,
      maxTokens: 2000,
      ...options,
    });

    if (!result?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI API - no content received');
    }

    return result.choices[0].message.content;
  }

  // ✅ ENHANCED: Comic book style scenes with audience-based configuration
  async generateScenes(systemPrompt: string, userPrompt: string): Promise<SceneGenerationResult> {
    const result = await this.createChatCompletion({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: `${systemPrompt}\n\nRespond with valid JSON containing comic book content. Use clear structure with an array of pages/panels/scenes.` 
        },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      responseFormat: { type: 'json_object' },
    });

    if (!result?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI API - no content received');
    }

    try {
      const parsed = JSON.parse(result.choices[0].message.content);
      
      // ✅ ENTERPRISE CONTENT DISCOVERY: Find content regardless of structure
      const discoveryResult = this.discoverContent(parsed);
      
      // ✅ VALIDATION: Ensure we have usable content
      if (!discoveryResult.content || discoveryResult.content.length === 0) {
        console.error('❌ No valid content discovered in OpenAI response');
        console.error('📄 Raw response structure:', JSON.stringify(parsed, null, 2).substring(0, 1000));
        throw new Error('Could not extract valid comic book content from OpenAI response');
      }
      
      console.log(`✅ Content discovered via ${discoveryResult.patternType} pattern: "${discoveryResult.discoveryPath}"`);
      console.log(`📊 Quality score: ${discoveryResult.qualityScore}/100, Found ${discoveryResult.content.length} pages`);
      
      return { 
        pages: discoveryResult.content, 
        metadata: { 
          discoveryPath: discoveryResult.discoveryPath,
          patternType: discoveryResult.patternType,
          qualityScore: discoveryResult.qualityScore,
          originalStructure: Object.keys(parsed),
          ...parsed.metadata 
        } 
      };
      
    } catch (parseError: any) {
      console.error('❌ Failed to parse OpenAI JSON response:', {
        error: parseError?.message || 'Unknown parsing error',
        rawResponse: result.choices[0].message.content.substring(0, 500) + '...'
      });
      throw new Error(`Invalid JSON response from OpenAI: ${parseError?.message || 'Unknown error'}`);
    }
  }

  // ✅ NEW: Enhanced scene generation with audience-based configuration
  async generateScenesWithAudience(options: EnhancedSceneGenerationOptions): Promise<EnhancedSceneGenerationResult> {
    if (!this.apiKey) {
      throw new Error('AI service not available - OpenAI API key missing');
    }

    const { 
      story, 
      audience = 'children', 
      characterImage,
      characterArtStyle = 'storybook',
      layoutType = 'comic-book-panels'
    } = options;

    console.log('🎬 Starting enhanced comic book scene generation...');
    console.log(`📋 Audience: ${audience}, Art Style: ${characterArtStyle}, Layout: ${layoutType}`);

    if (!story || story.trim().length < 50) {
      throw new Error('Story must be at least 50 characters long.');
    }

    // ✅ PRESERVED: Enhanced audience configuration from scene-service
    const audienceConfig = {
      children: { 
        scenes: 8, 
        pages: 3, 
        panelsPerPage: '2-3',
        notes: 'Simple comic book panels. 2-3 large, clear panels per page with minimal text.' 
      },
      young_adults: { 
        scenes: 12, 
        pages: 4, 
        panelsPerPage: '3-4',
        notes: '3-4 panels per page with dynamic layouts and speech bubbles.' 
      },
      adults: { 
        scenes: 16, 
        pages: 5, 
        panelsPerPage: '3-5',
        notes: '3-5 panels per page, sophisticated comic book layouts with varied panel sizes.' 
      }
    };

    const { scenes, pages, panelsPerPage, notes } = audienceConfig[audience];

    // ✅ PRESERVED: Superior comic book focused system prompt from scene-service
    const systemPrompt = `
You are a professional comic book layout designer for a storybook app that creates COMIC BOOK STYLE layouts.

CRITICAL: You must create comic book PAGES with multiple PANELS, not individual scenes.

Audience: ${audience.toUpperCase()}
Target: ${scenes} total panels arranged across ${pages} comic book pages
Panels per page: ${panelsPerPage}
Character Art Style: ${characterArtStyle} (maintain this art style in all panels)

COMIC BOOK REQUIREMENTS:
- Each page contains multiple panels (like a real comic book)
- Panels show sequential story moments
- Each panel has a specific action/dialogue moment
- Focus on visual storytelling with minimal text
- Panels should flow naturally from one to the next

Panel Structure:
- description: Brief action happening in this panel
- emotion: Character's emotional state in this panel  
- imagePrompt: Detailed visual description for panel generation (exclude character description - focus on environment, action, composition, lighting)
- panelType: 'standard', 'wide', 'tall', or 'splash' (for layout variety)

Visual pacing notes: ${notes}

Return your output in this strict format:
{
  "pages": [
    {
      "pageNumber": 1,
      "scenes": [
        {
          "description": "...",
          "emotion": "...",
          "imagePrompt": "...",
          "panelType": "standard"
        }
      ]
    }
  ]
}
`;

    try {
      console.log('📝 Making request to OpenAI GPT-4o API for enhanced comic book layout...');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          temperature: 0.85,
          messages: [
            { role: 'system', content: systemPrompt },
            { 
              role: 'user', 
              content: `Create a comic book layout for this story. Remember: Multiple panels per page, ${characterArtStyle} art style, ${panelsPerPage} panels per page.\n\nStory: ${story}` 
            }
          ],
          response_format: { type: 'json_object' }
        }),
      });

      console.log('📥 OpenAI response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        
        try {
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          console.error('❌ Failed to parse OpenAI error response:', errorText);
          throw new Error(`OpenAI API request failed with status ${response.status}: ${errorText}`);
        }

        console.error('❌ OpenAI API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });

        const errorMessage = errorData?.error?.message || `OpenAI API request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      const rawData = await response.json();

      if (!rawData?.choices?.[0]?.message?.content) {
        console.error('❌ Invalid OpenAI response structure:', rawData);
        throw new Error('Invalid response from OpenAI API - no content received');
      }

      const result = rawData.choices[0].message.content;
      
      let parsed;
      try {
        parsed = JSON.parse(result);
      } catch (parseError) {
        console.error('❌ Failed to parse OpenAI JSON response:', result);
        throw new Error('Invalid JSON response from OpenAI');
      }

      // ✅ PRESERVED: Enhanced comic book metadata from scene-service
      const updatedPages = parsed.pages.map((page: any) => ({
        ...page,
        layoutType: 'comic-book-panels',
        characterArtStyle: characterArtStyle,
        scenes: page.scenes.map((scene: any) => ({
          ...scene,
          panelType: scene.panelType || 'standard',
          generatedImage: characterImage, // Placeholder until panel generation
          layoutType: 'comic-book-panels',
          characterArtStyle: characterArtStyle
        }))
      }));

      console.log('✅ Successfully generated enhanced comic book layout');
      console.log(`📊 Generated ${updatedPages.length} comic book pages with ${updatedPages.reduce((total: number, page: any) => total + page.scenes.length, 0)} panels total`);

      return {
        pages: updatedPages,
        audience,
        characterImage,
        layoutType: 'comic-book-panels',
        characterArtStyle: characterArtStyle
      };

    } catch (error: any) {
      console.error('❌ Enhanced comic book scene generation error:', error);
      throw new Error(`Failed to generate enhanced comic book scenes: ${error.message}`);
    }
  }

  // ✅ ENTERPRISE-GRADE: Deep Content Discovery System
  private discoverContent(parsed: any): ContentDiscoveryResult {
    console.log('🔍 Starting deep content discovery...');
    
    // Phase 1: Try known patterns (fastest, most reliable)
    const patternResult = this.tryKnownPatterns(parsed);
    if (patternResult) {
      console.log(`✅ Pattern match: ${patternResult.discoveryPath}`);
      return patternResult;
    }
    
    // Phase 2: Deep recursive search (comprehensive fallback)
    const searchResult = this.performDeepSearch(parsed);
    if (searchResult) {
      console.log(`✅ Deep search success: ${searchResult.discoveryPath}`);
      return searchResult;
    }
    
    // Phase 3: Emergency fallback (last resort)
    console.warn('⚠️ Using emergency fallback - no comic content found');
    return {
      content: [],
      discoveryPath: 'emergency_fallback',
      qualityScore: 0,
      patternType: 'fallback'
    };
  }

  // ✅ PHASE 1: Known Pattern Recognition
  private tryKnownPatterns(parsed: any): ContentDiscoveryResult | null {
    // Sort patterns by priority (highest first)
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
        // Continue to next pattern if this one fails
        console.debug(`Pattern ${pattern.name} validation failed:`, error);
      }
    }
    
    return null;
  }

  // ✅ PHASE 2: Deep Recursive Search
  private performDeepSearch(obj: any, currentPath: string[] = []): ContentDiscoveryResult | null {
    if (!obj || typeof obj !== 'object') {
      return null;
    }
    
    // Check if current object is an array of comic content
    if (Array.isArray(obj)) {
      const qualityScore = this.calculateContentQuality(obj);
      if (qualityScore > 50) { // Threshold for acceptable content
        return {
          content: obj,
          discoveryPath: currentPath.join('.') || 'root_array',
          qualityScore,
          patternType: 'discovered'
        };
      }
    }
    
    // Recursively search object properties
    const candidates: ContentDiscoveryResult[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') {
        const result = this.performDeepSearch(value, [...currentPath, key]);
        if (result) {
          candidates.push(result);
        }
      }
    }
    
    // Return the best candidate (highest quality score)
    if (candidates.length > 0) {
      return candidates.sort((a, b) => b.qualityScore - a.qualityScore)[0];
    }
    
    return null;
  }

  // ✅ CONTENT QUALITY ASSESSMENT
  private calculateContentQuality(content: any[]): number {
    if (!Array.isArray(content) || content.length === 0) {
      return 0;
    }
    
    let score = 0;
    const items = content.slice(0, 5); // Check first 5 items for performance
    
    // Size scoring (1-20 items is ideal for comic pages)
    if (content.length >= 1 && content.length <= 20) {
      score += 20;
    } else if (content.length <= 50) {
      score += 10;
    }
    
    // Content structure scoring
    for (const item of items) {
      if (item && typeof item === 'object') {
        score += 10; // Basic object structure
        
        // Comic-specific properties (higher weight)
        const comicProperties = ['description', 'imagePrompt', 'scene', 'emotion', 'dialogue', 'panelNumber', 'pageNumber'];
        const foundProperties = comicProperties.filter(prop => prop in item);
        score += foundProperties.length * 8;
        
        // Generic useful properties
        const genericProperties = ['text', 'content', 'prompt', 'action', 'character'];
        const foundGeneric = genericProperties.filter(prop => prop in item);
        score += foundGeneric.length * 3;
        
        // Nested structure bonus (pages with scenes)
        if (item.scenes && Array.isArray(item.scenes)) {
          score += 15;
        }
      }
    }
    
    return Math.min(100, score);
  }

  // ✅ UTILITY: Extract content by path
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

  async generateCartoonImage(prompt: string): Promise<string> {
    const result = await this.generateImage({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'vivid',
    });

    if (!result?.data?.[0]?.url) {
      throw new Error('Invalid response from OpenAI API - no image URL received');
    }

    return result.data[0].url;
  }

  async describeCharacter(imageUrl: string, prompt: string): Promise<string> {
    const result = await this.analyzeImage({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image for cartoon generation. Only include clearly visible and objective features.' },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      maxTokens: 500,
    });

    if (!result?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI API - no content received');
    }

    return result.choices[0].message.content;
  }

  async createChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    return this.withRetry(
      async () => {
        return this.makeRequest<ChatCompletionResult>(
          '/chat/completions',
          {
            method: 'POST',
            body: JSON.stringify({
              model: options.model,
              messages: options.messages,
              temperature: options.temperature || 0.8,
              max_tokens: options.maxTokens || (this.config as AIConfig).maxTokens,
              response_format: options.responseFormat,
            }),
          },
          (this.config as AIConfig).gptTimeout,
          'createChatCompletion'
        );
      },
      this.gptRetryConfig,
      'createChatCompletion'
    );
  }

  // ===== PRIVATE HELPER METHODS =====

  private checkRateLimit(endpoint: string): boolean {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const requests = this.rateLimiter.get(endpoint) || [];
    
    // Remove old requests outside the window
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
        
        // Classify error for retry logic
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
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;