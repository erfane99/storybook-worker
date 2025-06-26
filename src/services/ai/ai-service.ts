// Enhanced AI Service - Production Implementation with Best Practice JSON Handling
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

  // ✅ BEST PRACTICE: Robust scene generation with flexible JSON handling
  async generateScenes(systemPrompt: string, userPrompt: string): Promise<SceneGenerationResult> {
    const result = await this.createChatCompletion({
      model: 'gpt-4o',
      messages: [
        // ✅ FLEXIBLE PROMPT: Work with AI natural tendencies
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
      
      // ✅ ROBUST NORMALIZATION: Handle any reasonable structure
      const normalizedResult = this.normalizeSceneStructure(parsed);
      
      // ✅ VALIDATION: Ensure we have usable content
      if (!normalizedResult.pages || !Array.isArray(normalizedResult.pages) || normalizedResult.pages.length === 0) {
        console.error('❌ OpenAI response after normalization:', normalizedResult);
        throw new Error('Could not extract valid scene structure from OpenAI response');
      }
      
      console.log(`✅ Successfully parsed ${normalizedResult.pages.length} pages from OpenAI response`);
      return { pages: normalizedResult.pages, metadata: parsed.metadata || {} };
      
    } catch (parseError: any) {
      console.error('❌ Failed to parse OpenAI JSON response:', {
        error: parseError?.message || 'Unknown parsing error',
        rawResponse: result.choices[0].message.content.substring(0, 500) + '...'
      });
      throw new Error(`Invalid JSON response from OpenAI: ${parseError?.message || 'Unknown error'}`);
    }
  }

  // ✅ ROBUST NORMALIZATION: Handle multiple possible structures
  private normalizeSceneStructure(parsed: any): { pages: any[] } {
    // Try different possible key names that OpenAI might use
    const possibleArrayKeys = ['pages', 'panels', 'scenes', 'comic_pages', 'storyboards', 'frames'];
    
    for (const key of possibleArrayKeys) {
      if (parsed[key] && Array.isArray(parsed[key]) && parsed[key].length > 0) {
        console.log(`🔄 Found content under key: "${key}"`);
        return { pages: parsed[key] };
      }
    }
    
    // Fallback: Look for any array in the response
    const arrays = Object.entries(parsed)
      .filter(([_, value]): value is any[] => Array.isArray(value) && value.length > 0)
      .sort(([, a], [, b]) => (b as any[]).length - (a as any[]).length); // Sort by length, largest first
    
    if (arrays.length > 0) {
      const [foundKey, foundArray] = arrays[0];
      console.log(`🔄 Using array found under key: "${foundKey}"`);
      return { pages: foundArray as any[] };
    }
    
    // Final fallback: Return empty structure (will be caught by validation)
    console.warn('⚠️ No valid arrays found in OpenAI response');
    return { pages: [] };
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