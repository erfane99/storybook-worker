// AI service for all OpenAI interactions
import { BaseService, ServiceConfig, RetryConfig } from '../base/base-service.js';
import { environmentManager } from '../../lib/config/environment.js';

export interface AIConfig extends ServiceConfig {
  apiKey: string;
  baseUrl: string;
  gptTimeout: number;
  dalleTimeout: number;
  maxTokens: number;
  rateLimitRpm: number;
}

export interface ChatCompletionOptions {
  model: string;
  messages: any[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: string };
}

export interface ImageGenerationOptions {
  model: string;
  prompt: string;
  n?: number;
  size?: string;
  quality?: string;
  style?: string;
}

export interface VisionOptions {
  model: string;
  messages: any[];
  maxTokens?: number;
}

export class AIService extends BaseService {
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

  protected async initialize(): Promise<void> {
    const openaiStatus = environmentManager.getServiceStatus('openai');
    
    if (!openaiStatus.isAvailable) {
      this.log('warn', `OpenAI not configured: ${openaiStatus.message}`);
      return;
    }

    this.apiKey = process.env.OPENAI_API_KEY!;
    this.log('info', 'AI service initialized successfully');
  }

  /**
   * Check rate limits
   */
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

  /**
   * Make authenticated request to OpenAI API
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit,
    timeout: number,
    operationName: string
  ): Promise<T> {
    await this.ensureInitialized();
    
    if (!this.apiKey) {
      throw new Error('AI service not available - OpenAI API key missing');
    }

    if (this.isCircuitBreakerOpen()) {
      throw new Error('AI service circuit breaker is open');
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
      this.resetCircuitBreaker();
      return data;
      
    } catch (error: any) {
      this.recordCircuitBreakerFailure();
      this.log('error', `AI API request failed: ${operationName}`, error);
      throw error;
    }
  }

  /**
   * Chat completion with GPT models
   */
  async createChatCompletion(options: ChatCompletionOptions): Promise<any> {
    return this.withRetry(
      async () => {
        return this.makeRequest<any>(
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

  /**
   * Image generation with DALL-E
   */
  async generateImage(options: ImageGenerationOptions): Promise<any> {
    return this.withRetry(
      async () => {
        return this.makeRequest<any>(
          '/images/generations',
          {
            method: 'POST',
            body: JSON.stringify({
              model: options.model,
              prompt: options.prompt,
              n: options.n || 1,
              size: options.size || '1024x1024',
              quality: options.quality || 'standard',
              style: options.style || 'vivid',
            }),
          },
          (this.config as AIConfig).dalleTimeout,
          'generateImage'
        );
      },
      this.dalleRetryConfig,
      'generateImage'
    );
  }

  /**
   * Vision analysis with GPT-4o
   */
  async analyzeImage(options: VisionOptions): Promise<any> {
    return this.withRetry(
      async () => {
        return this.makeRequest<any>(
          '/chat/completions',
          {
            method: 'POST',
            body: JSON.stringify({
              model: options.model,
              messages: options.messages,
              max_tokens: options.maxTokens || 500,
            }),
          },
          (this.config as AIConfig).gptTimeout,
          'analyzeImage'
        );
      },
      this.gptRetryConfig,
      'analyzeImage'
    );
  }

  /**
   * Generate story using GPT-4
   */
  async generateStory(prompt: string, options: Partial<ChatCompletionOptions> = {}): Promise<string> {
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

  /**
   * Generate scenes using GPT-4o
   */
  async generateScenes(systemPrompt: string, userPrompt: string): Promise<any> {
    const result = await this.createChatCompletion({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      responseFormat: { type: 'json_object' },
    });

    if (!result?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI API - no content received');
    }

    try {
      return JSON.parse(result.choices[0].message.content);
    } catch (error) {
      throw new Error('Invalid JSON response from OpenAI');
    }
  }

  /**
   * Describe character using GPT-4o Vision
   */
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

  /**
   * Generate cartoon image using DALL-E 3
   */
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

  isHealthy(): boolean {
    return this.isInitialized && this.apiKey !== null && !this.isCircuitBreakerOpen();
  }

  getStatus() {
    const openaiStatus = environmentManager.getServiceStatus('openai');
    return {
      name: this.config.name,
      initialized: this.isInitialized,
      available: this.isHealthy(),
      circuitBreakerOpen: this.isCircuitBreakerOpen(),
      circuitBreakerFailures: this.circuitBreakerFailures,
      openaiStatus: openaiStatus.status,
      rateLimitStatus: Object.fromEntries(this.rateLimiter),
    };
  }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;