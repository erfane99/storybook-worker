/**
 * ===== OPENAI INTEGRATION MODULE =====
 * Enterprise-grade OpenAI API wrapper with intelligent retry, circuit breakers,
 * and professional error handling. FIXED: Combines best features from both original files.
 * 
 * File Location: lib/services/ai/modular/openai-integration.ts
 * 
 * Features from currentaiserv.txt:
 * - Advanced circuit breaker implementation with state management
 * - Rate limiting and throttling mechanisms  
 * - Performance optimization with prompt length optimization
 * - Intelligent timeout calculation based on complexity
 * - High-quality prompt building and sanitization
 * 
 * Features from aiservnow.txt:
 * - Enhanced API response validation and error handling
 * - Professional parameter transformation
 * - Advanced retry mechanisms with learning
 * - Comprehensive HTTP status code handling
 * - Robust error classification and recovery
 */

// ===== FIXED IMPORT PATHS =====
import {
  AIAuthenticationError,
  AIRateLimitError,
  AIContentPolicyError,
  AITimeoutError,
  AIServiceUnavailableError,
  AIValidationError,
  AINetworkError,
  ErrorHandlingSystem,
  ErrorContext,
  RetryOptions
} from './error-handling-system.js';

import {
  PROFESSIONAL_PROMPT_TEMPLATES,
  AI_SERVICE_ENTERPRISE_CONSTANTS,
  ERROR_HANDLING_CONSTANTS
} from './constants-and-types.js';

// ===== TYPES AND INTERFACES =====

export interface OpenAICallOptions {
  enableRetry?: boolean;
  enableCircuitBreaker?: boolean;
  enableMetrics?: boolean;
  timeout?: number;
  maxAttempts?: number;
  baseDelay?: number;
}

export interface OpenAIParameters {
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
  [key: string]: any;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
  threshold: number;
  timeout: number;
  successCount: number;
}

export interface RateLimitState {
  count: number;
  resetTime: number;
  windowMs: number;
  maxRequests: number;
}

export interface RetryAttempt {
  attempt: number;
  error?: any;
  duration: number;
  timestamp: number;
  success: boolean;
}

// ===== OPENAI INTEGRATION CLASS =====

export class OpenAIIntegration {
  private apiKey: string;
  private defaultModel: string = 'gpt-4o';
  private userAgent: string = 'StoryCanvas-AI-Service/2.0.0';
  
  // Circuit breaker state management (FROM CURRENTAISERV.TXT)
  private circuitBreakerStates: Map<string, CircuitBreakerState> = new Map();
  
  // Rate limiting (FROM CURRENTAISERV.TXT)
  private rateLimits: Map<string, RateLimitState> = new Map();
  
  // Error handling system integration
  private errorHandler: ErrorHandlingSystem;
  
  // Learning engine reference for retry intelligence
  private learningEngine?: any;
  
  // Metrics collection
  private metrics: Map<string, any[]> = new Map();
  
  // Logging interface
  private logger: any;

  constructor(apiKey: string, learningEngine?: any, logger?: any) {
    this.apiKey = apiKey;
    this.learningEngine = learningEngine;
    this.logger = logger || console;
    this.errorHandler = ErrorHandlingSystem.getInstance(learningEngine, null, logger);

    if (!apiKey) {
      throw new AIAuthenticationError('OpenAI API key is required', {
        service: 'OpenAIIntegration',
        operation: 'constructor'
      });
    }
  }

  // 🔄 ENHANCED OPENAI API CALL (FROM BOTH FILES)

  public async makeOpenAIAPICall<T>(
    endpoint: string,
    parameters: OpenAIParameters,
    timeout: number = 120000,
    operationName: string = 'api_call',
    options: OpenAICallOptions = {}
  ): Promise<T> {
    // FROM CURRENTAISERV.TXT: Circuit breaker check
    if (options.enableCircuitBreaker !== false && this.isCircuitBreakerOpen(endpoint)) {
      throw new AIServiceUnavailableError(
        `Circuit breaker is open for endpoint: ${endpoint}`,
        { service: 'OpenAIIntegration', operation: operationName, endpoint }
      );
    }

    // FROM CURRENTAISERV.TXT: Rate limiting check
    if (!this.checkRateLimit(endpoint)) {
      throw new AIRateLimitError(
        'Rate limit exceeded for endpoint',
        { service: 'OpenAIIntegration', operation: operationName, endpoint }
      );
    }

    const startTime = Date.now();
    
    try {
      // Use error handler retry mechanism if enabled
      if (options.enableRetry !== false) {
        return await this.errorHandler.withIntelligentRetry(
          () => this.executeOpenAICall<T>(endpoint, parameters, timeout, operationName),
          {
            operationName,
            maxAttempts: options.maxAttempts || 3,
            baseDelay: options.baseDelay || 1000,
            maxDelay: 30000,
            circuitBreakerEnabled: options.enableCircuitBreaker !== false
          }
        );
      } else {
        return await this.executeOpenAICall<T>(endpoint, parameters, timeout, operationName);
      }
    } catch (error: any) {
      // FROM CURRENTAISERV.TXT: Circuit breaker failure recording
      this.recordCircuitBreakerFailure(endpoint);
      
      // FROM CURRENTAISERV.TXT: Metrics collection for failures
      this.recordOperationMetrics(operationName, Date.now() - startTime, false);

      throw error;
    }
  }

  // 🎯 CORE API EXECUTION (FROM AISERVNOW.TXT WITH CURRENTAISERV.TXT ENHANCEMENTS)

  private async executeOpenAICall<T>(
    endpoint: string,
    parameters: OpenAIParameters,
    timeout: number,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();

    // FROM BOTH FILES: Parameter transformation and validation
    const transformedParams = this.transformOpenAIParameters(parameters);
    
    // FROM CURRENTAISERV.TXT: Prompt optimization
    if (transformedParams.prompt) {
      transformedParams.prompt = this.optimizePromptLength(transformedParams.prompt, 4000);
    }

    // FROM CURRENTAISERV.TXT: Enhanced fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      console.log(`🔄 OpenAI API call: ${operationName} to ${endpoint}`);
      
      const response = await fetch(`https://api.openai.com/v1${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': this.userAgent,
        },
        body: JSON.stringify(transformedParams),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // FROM AISERVNOW.TXT: Enhanced error response handling
      if (!response.ok) {
        await this.handleAPIErrorResponse(response, operationName, endpoint);
      }

      const result = await response.json();
      
      // FROM AISERVNOW.TXT: Response validation
      this.validateAPIResponse(result, endpoint, operationName);
      
      // FROM CURRENTAISERV.TXT: Success metrics and circuit breaker reset
      this.recordCircuitBreakerSuccess(endpoint);
      this.recordOperationMetrics(operationName, Date.now() - startTime, true);
      
      console.log(`✅ OpenAI API call completed: ${operationName}`);
      return result;

    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new AITimeoutError(
          `Request timed out after ${timeout}ms`,
          { service: 'OpenAIIntegration', operation: operationName, timeout }
        );
      }
      
      // Re-throw our custom errors as-is
      if (error instanceof AIServiceUnavailableError || 
          error instanceof AIAuthenticationError ||
          error instanceof AIRateLimitError ||
          error instanceof AIContentPolicyError ||
          error instanceof AITimeoutError ||
          error instanceof AIValidationError ||
          error instanceof AINetworkError) {
        throw error;
      }
      
      // Convert unknown errors to service unavailable
      throw new AIServiceUnavailableError(
        `API request failed: ${error.message}`,
        { service: 'OpenAIIntegration', operation: operationName, originalError: error.message }
      );
    }
  }

  // 🔧 PARAMETER TRANSFORMATION (FROM BOTH FILES)

  private transformOpenAIParameters(options: OpenAIParameters): any {
    const transformed: any = {
      model: options.model || this.defaultModel,
    };

    // Core parameters
    if (options.messages) transformed.messages = options.messages;
    if (options.prompt) transformed.prompt = options.prompt;
    if (options.max_tokens) transformed.max_tokens = options.max_tokens;
    if (options.temperature !== undefined) transformed.temperature = options.temperature;
    if (options.top_p !== undefined) transformed.top_p = options.top_p;
    if (options.frequency_penalty !== undefined) transformed.frequency_penalty = options.frequency_penalty;
    if (options.presence_penalty !== undefined) transformed.presence_penalty = options.presence_penalty;
    if (options.stop) transformed.stop = options.stop;
    if (options.stream !== undefined) transformed.stream = options.stream;

    // Image generation specific
    if (options.size) transformed.size = options.size;
    if (options.quality) transformed.quality = options.quality;
    if (options.response_format) transformed.response_format = options.response_format;
    if (options.style) transformed.style = options.style;

    // Additional OpenAI parameters
    Object.keys(options).forEach(key => {
      if (!transformed.hasOwnProperty(key) && options[key] !== undefined) {
        transformed[key] = options[key];
      }
    });

    return transformed;
  }

  // 🌐 HTTP ERROR RESPONSE HANDLING (FROM AISERVNOW.TXT)

  private async handleAPIErrorResponse(response: Response, operationName: string, endpoint: string): Promise<never> {
    let errorData: any = {};
    
    try {
      errorData = await response.json();
    } catch {
      // Ignore JSON parsing errors - use default error structure
    }

    const errorMessage = errorData.error?.message || errorData.message || `HTTP ${response.status}`;
    const errorCode = errorData.error?.code || errorData.code;
    const errorType = errorData.error?.type || errorData.type;

    // Enhanced context
    const context: ErrorContext = {
      service: 'OpenAIIntegration',
      operation: operationName,
      endpoint,
      errorCode,
      httpStatus: response.status,
      timestamp: Date.now()
    };

    // Add retry-after header if present
    if (response.headers.get('retry-after')) {
      context.retryAfter = response.headers.get('retry-after');
    }

    // FROM AISERVNOW.TXT: Enhanced HTTP status code handling
    switch (response.status) {
      case 400:
        throw new AIContentPolicyError(
          `Bad request: ${errorMessage}`,
          { ...context, errorType: errorType || 'bad_request' }
        );

      case 401:
        throw new AIAuthenticationError(
          `Authentication failed: ${errorMessage}`,
          { ...context, errorType: errorType || 'authentication_failed' }
        );

      case 403:
        throw new AIContentPolicyError(
          `Forbidden: ${errorMessage}`,
          { ...context, errorType: errorType || 'forbidden' }
        );

      case 422:
        throw new AIValidationError(
          `Validation failed: ${errorMessage}`,
          { ...context, errorType: errorType || 'validation_error' }
        );

      case 429:
        throw new AIRateLimitError(
          `Rate limit exceeded: ${errorMessage}`,
          { 
            ...context, 
            errorType: errorType || 'rate_limit_exceeded',
            retryAfter: response.headers.get('retry-after')
          }
        );

      case 500:
        throw new AIServiceUnavailableError(
          `Internal server error: ${errorMessage}`,
          { ...context, errorType: errorType || 'internal_server_error' }
        );

      case 502:
        throw new AIServiceUnavailableError(
          `Bad gateway: ${errorMessage}`,
          { ...context, errorType: errorType || 'bad_gateway' }
        );

      case 503:
        throw new AIServiceUnavailableError(
          `Service unavailable: ${errorMessage}`,
          { ...context, errorType: errorType || 'service_unavailable' }
        );

      case 504:
        throw new AITimeoutError(
          `Gateway timeout: ${errorMessage}`,
          { ...context, errorType: errorType || 'gateway_timeout' }
        );

      default:
        if (response.status >= 500) {
          throw new AIServiceUnavailableError(
            `Server error: ${errorMessage}`,
            { ...context, errorType: errorType || 'server_error' }
          );
        } else if (response.status >= 400) {
          throw new AIValidationError(
            `Client error: ${errorMessage}`,
            { ...context, errorType: errorType || 'client_error' }
          );
        } else {
          throw new AIServiceUnavailableError(
            `Unexpected response: ${errorMessage}`,
            { ...context, errorType: errorType || 'unexpected_response' }
          );
        }
    }
  }

  // 🔍 RESPONSE VALIDATION (FROM AISERVNOW.TXT)

  private validateAPIResponse(result: any, endpoint: string, operationName: string): void {
    if (!result) {
      throw new AIServiceUnavailableError(
        'Empty response from OpenAI API',
        { service: 'OpenAIIntegration', operation: operationName, endpoint }
      );
    }

    // Chat completions validation
    if (endpoint.includes('/chat/completions')) {
      if (!result.choices || !Array.isArray(result.choices) || result.choices.length === 0) {
        throw new AIServiceUnavailableError(
          'Invalid chat completion response structure',
          { service: 'OpenAIIntegration', operation: operationName, endpoint }
        );
      }

      if (!result.choices[0].message) {
        throw new AIServiceUnavailableError(
          'Missing message in chat completion response',
          { service: 'OpenAIIntegration', operation: operationName, endpoint }
        );
      }
    }

    // Image generation validation
    if (endpoint.includes('/images/generations')) {
      if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
        throw new AIServiceUnavailableError(
          'Invalid image generation response structure',
          { service: 'OpenAIIntegration', operation: operationName, endpoint }
        );
      }

      if (!result.data[0].url) {
        throw new AIServiceUnavailableError(
          'Missing image URL in generation response',
          { service: 'OpenAIIntegration', operation: operationName, endpoint }
        );
      }
    }

    // Text completions validation
    if (endpoint.includes('/completions')) {
      if (!result.choices || !Array.isArray(result.choices) || result.choices.length === 0) {
        throw new AIServiceUnavailableError(
          'Invalid completion response structure',
          { service: 'OpenAIIntegration', operation: operationName, endpoint }
        );
      }
    }
  }
/**
 * ===== OPENAI INTEGRATION PART 2 =====
 * Circuit breaker management, rate limiting, optimization utilities, and high-level API methods
 * Continuation of openai-integration.ts
 */

  // 🔒 CIRCUIT BREAKER PATTERN (FROM CURRENTAISERV.TXT)

  private isCircuitBreakerOpen(endpoint: string): boolean {
    const state = this.getCircuitBreakerState(endpoint);
    
    if (state.state === 'open') {
      // Check if timeout period has passed
      if (Date.now() - state.lastFailure > state.timeout) {
        // Move to half-open state
        state.state = 'half-open';
        state.successCount = 0;
        this.logger.log(`🔄 Circuit breaker for ${endpoint} moving to half-open state`);
      }
      return state.state === 'open';
    }
    
    return false;
  }

  private getCircuitBreakerState(endpoint: string): CircuitBreakerState {
    if (!this.circuitBreakerStates.has(endpoint)) {
      this.circuitBreakerStates.set(endpoint, {
        failures: 0,
        lastFailure: 0,
        state: 'closed',
        threshold: ERROR_HANDLING_CONSTANTS.CIRCUIT_BREAKER_THRESHOLD,
        timeout: ERROR_HANDLING_CONSTANTS.CIRCUIT_BREAKER_TIMEOUT,
        successCount: 0
      });
    }
    return this.circuitBreakerStates.get(endpoint)!;
  }

  private recordCircuitBreakerFailure(endpoint: string): void {
    const state = this.getCircuitBreakerState(endpoint);
    state.failures++;
    state.lastFailure = Date.now();
    state.successCount = 0;
    
    if (state.failures >= state.threshold) {
      state.state = 'open';
      this.logger.warn(`🔴 Circuit breaker OPENED for ${endpoint} after ${state.failures} failures`);
    }
  }

  private recordCircuitBreakerSuccess(endpoint: string): void {
    const state = this.getCircuitBreakerState(endpoint);
    
    if (state.state === 'half-open') {
      state.successCount++;
      if (state.successCount >= 2) { // Require 2 successes to close
        state.state = 'closed';
        state.failures = 0;
        this.logger.log(`🟢 Circuit breaker CLOSED for ${endpoint} after successful recovery`);
      }
    } else if (state.state === 'closed') {
      // Reset failure count on successful operation
      state.failures = Math.max(0, state.failures - 1);
    }
  }

  // 🚦 RATE LIMITING (FROM CURRENTAISERV.TXT)

  private checkRateLimit(endpoint: string): boolean {
    const now = Date.now();
    const limit = this.getRateLimitState(endpoint);
    
    if (now > limit.resetTime) {
      // Reset the limit window
      limit.count = 1;
      limit.resetTime = now + limit.windowMs;
      return true;
    }
    
    if (limit.count >= limit.maxRequests) {
      this.logger.warn(`🚦 Rate limit exceeded for ${endpoint}: ${limit.count}/${limit.maxRequests}`);
      return false;
    }
    
    limit.count++;
    return true;
  }

  private getRateLimitState(endpoint: string): RateLimitState {
    if (!this.rateLimits.has(endpoint)) {
      this.rateLimits.set(endpoint, {
        count: 0,
        resetTime: Date.now() + 60000, // 1 minute window
        windowMs: 60000,
        maxRequests: 60 // 60 requests per minute default
      });
    }
    return this.rateLimits.get(endpoint)!;
  }

  // 📊 METRICS COLLECTION (FROM CURRENTAISERV.TXT)

  private recordOperationMetrics(operationName: string, duration: number, success: boolean): void {
    const metrics = {
      operation: operationName,
      duration,
      success,
      timestamp: Date.now()
    };

    if (!this.metrics.has(operationName)) {
      this.metrics.set(operationName, []);
    }
    
    const operationMetrics = this.metrics.get(operationName)!;
    operationMetrics.push(metrics);
    
    // Keep only last 100 metrics per operation
    if (operationMetrics.length > 100) {
      operationMetrics.splice(0, operationMetrics.length - 100);
    }
  }

  // 🎯 PERFORMANCE OPTIMIZATION UTILITIES (FROM CURRENTAISERV.TXT)

  private optimizePromptLength(prompt: string, maxLength: number = 4000): string {
    if (prompt.length <= maxLength) return prompt;
    
    this.logger.warn(`⚠️ Prompt optimization required: ${prompt.length} chars > ${maxLength} limit`);
    
    // Intelligent truncation preserving key sections
    const sections = prompt.split('\n\n');
    const essential = sections.filter(section => 
      section.includes('CHARACTER_DNA:') ||
      section.includes('COMIC PANEL:') ||
      section.includes('SPEECH_BUBBLE:') ||
      section.includes('QUALITY:') ||
      section.includes('DESCRIPTION:') ||
      section.includes('EMOTION:') ||
      section.includes('STYLE:')
    );
    
    let optimized = essential.join('\n\n');
    
    // If still too long, apply character-level truncation
    if (optimized.length > maxLength) {
      optimized = optimized.substring(0, maxLength - 100) + '\nProfessional comic book quality required.';
    }
    
    this.logger.log(`✅ Prompt optimized: ${prompt.length} → ${optimized.length} chars`);
    return optimized;
  }

  private sanitizePrompt(prompt: string): string {
    return prompt
      .replace(/[<>]/g, '') // Remove HTML-like brackets
      .replace(/[^\w\s.,!?'"]/g, '') // Keep basic punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, 10000); // Length limit
  }

  private calculateProcessingComplexity(context: any): 'simple' | 'moderate' | 'complex' | 'intensive' {
    let complexity = 0;
    
    if (context.characterImage) complexity += 2;
    if (context.audience === 'adults') complexity += 1;
    if (context.storyLength > 1000) complexity += 1;
    if (context.artStyle !== 'storybook') complexity += 1;
    if (context.totalPanels > 15) complexity += 2;
    
    if (complexity <= 2) return 'simple';
    if (complexity <= 4) return 'moderate';
    if (complexity <= 6) return 'complex';
    return 'intensive';
  }

  private estimateOptimalTimeout(complexity: 'simple' | 'moderate' | 'complex' | 'intensive'): number {
    const timeouts = {
      simple: 60000,    // 1 minute
      moderate: 120000, // 2 minutes
      complex: 180000,  // 3 minutes
      intensive: 300000 // 5 minutes
    };
    
    return timeouts[complexity];
  }

  // 🎨 HIGH-LEVEL API METHODS (FROM BOTH FILES)

  /**
   * Generate text completion using OpenAI
   */
  public async generateTextCompletion(
    prompt: string,
    options: Partial<OpenAIParameters> = {}
  ): Promise<string> {
    const sanitizedPrompt = this.sanitizePrompt(prompt);
    const optimizedPrompt = this.optimizePromptLength(sanitizedPrompt);

    const parameters: OpenAIParameters = {
      model: options.model || this.defaultModel,
      messages: [
        {
          role: 'user',
          content: optimizedPrompt
        }
      ],
      max_tokens: options.max_tokens || 2000,
      temperature: options.temperature || 0.7,
      ...options
    };

    try {
      const result = await this.makeOpenAIAPICall<any>(
        '/chat/completions',
        parameters,
        180000,
        'generateTextCompletion'
      );

      return result.choices[0].message.content;
    } catch (error: any) {
      this.logger.error('Text completion failed:', error);
      throw error;
    }
  }

  /**
   * Generate cartoon image using DALL-E (FROM BOTH FILES)
   */
  public async generateCartoonImage(prompt: string): Promise<string> {
    // Enhanced prompt validation
    if (!prompt || prompt.trim().length === 0) {
      throw new AIContentPolicyError('Empty prompt provided to DALL-E API', {
        service: 'OpenAIIntegration',
        operation: 'generateCartoonImage'
      });
    }

    // Final length validation
    if (prompt.length > 4000) {
      throw new AIContentPolicyError(`Prompt too long: ${prompt.length} characters. Must be under 4000.`, {
        service: 'OpenAIIntegration',
        operation: 'generateCartoonImage'
      });
    }

    const parameters = {
      model: 'dall-e-3',
      prompt: this.optimizePromptLength(prompt, 4000),
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url'
    };

    try {
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
    } catch (error: any) {
      // Enhanced error handling for prompt issues
      if (error.message?.includes('string too long')) {
        throw new AIContentPolicyError(
          `DALL-E prompt length error: ${prompt.length} chars exceeds 4000 limit`,
          { service: 'OpenAIIntegration', operation: 'generateCartoonImage' }
        );
      }
      throw error;
    }
  }

  /**
   * Analyze story for comic book adaptation (FROM BOTH FILES)
   */
  public async analyzeStoryForComic(
    story: string,
    audience: string,
    panelCount: number = 12
  ): Promise<any> {
    const promptTemplate = PROFESSIONAL_PROMPT_TEMPLATES.storyAnalysis.base
      .replace('{story}', story)
      .replace('{audience}', audience)
      .replace('{panelCount}', panelCount.toString());

    // Add audience-specific requirements
    let enhancedPrompt = promptTemplate;
    if (audience === 'children' && PROFESSIONAL_PROMPT_TEMPLATES.storyAnalysis.children) {
      enhancedPrompt += '\n\n' + PROFESSIONAL_PROMPT_TEMPLATES.storyAnalysis.children;
    } else if (audience === 'young adults' && PROFESSIONAL_PROMPT_TEMPLATES.storyAnalysis.youngAdults) {
      enhancedPrompt += '\n\n' + PROFESSIONAL_PROMPT_TEMPLATES.storyAnalysis.youngAdults;
    } else if (audience === 'adults' && PROFESSIONAL_PROMPT_TEMPLATES.storyAnalysis.adults) {
      enhancedPrompt += '\n\n' + PROFESSIONAL_PROMPT_TEMPLATES.storyAnalysis.adults;
    }

    try {
      const result = await this.generateTextCompletion(enhancedPrompt, {
        max_tokens: 3000,
        temperature: 0.8
      });

      // Parse the result into structured format
      return this.parseStoryAnalysisResult(result);
    } catch (error: any) {
      this.logger.error('Story analysis failed:', error);
      throw error;
    }
  }

  /**
   * Generate image with character DNA consistency (FROM BOTH FILES)
   */
  public async generateImageWithDNA(
    imagePrompt: string,
    characterDescription: string,
    emotion: string,
    panelType: string,
    artStyle: string,
    audience: string,
    visualDNA?: any
  ): Promise<string> {
    // Use professional image generation template
    let enhancedPrompt = PROFESSIONAL_PROMPT_TEMPLATES.imageGeneration.base
      .replace('{description}', imagePrompt)
      .replace('{characterDescription}', characterDescription)
      .replace('{emotion}', emotion)
      .replace('{panelType}', panelType)
      .replace('{artStyle}', artStyle)
      .replace('{audience}', audience);

    // Add visual DNA consistency if available
    if (visualDNA && PROFESSIONAL_PROMPT_TEMPLATES.imageGeneration.visualDNA) {
      const dnaPrompt = PROFESSIONAL_PROMPT_TEMPLATES.imageGeneration.visualDNA
        .replace('{visualDNA}', visualDNA.signature || '')
        .replace('{facialDNA}', visualDNA.face || '')
        .replace('{bodyDNA}', visualDNA.body || '')
        .replace('{clothingDNA}', visualDNA.clothing || '')
        .replace('{colorDNA}', visualDNA.colorDNA || '')
        .replace('{artStyleDNA}', visualDNA.artStyleSignature || '');
      
      enhancedPrompt += '\n\n' + dnaPrompt;
    }

    return await this.generateCartoonImage(enhancedPrompt);
  }

  /**
   * Assess quality of generated content (FROM BOTH FILES)
   */
  public async assessContentQuality(
    generatedContent: any,
    originalContext: any,
    audience: string
  ): Promise<any> {
    const promptTemplate = PROFESSIONAL_PROMPT_TEMPLATES.qualityAssessment.base
      .replace('{content}', JSON.stringify(generatedContent).substring(0, 2000))
      .replace('{context}', JSON.stringify(originalContext).substring(0, 1000))
      .replace('{audience}', audience);

    try {
      const result = await this.generateTextCompletion(promptTemplate, {
        max_tokens: 1500,
        temperature: 0.3 // Lower temperature for more consistent quality assessment
      });

      return this.parseQualityAssessmentResult(result);
    } catch (error: any) {
      this.logger.error('Quality assessment failed:', error);
      throw error;
    }
  }

  // 🔧 PARSING UTILITIES

  private parseStoryAnalysisResult(result: string): any {
    try {
      // Extract structured information from the analysis result
      const analysis = {
        storyBeats: this.extractStoryBeats(result),
        characterDevelopment: this.extractCharacterDevelopment(result),
        visualComposition: this.extractVisualComposition(result),
        dialogueOptimization: this.extractDialogueOptimization(result),
        pacingStrategy: this.extractPacingStrategy(result)
      };

      return analysis;
    } catch (error) {
      this.logger.warn('Failed to parse story analysis, returning raw result');
      return { rawAnalysis: result };
    }
  }

  private parseQualityAssessmentResult(result: string): any {
    try {
      // Extract quality metrics from the assessment result
      const assessment = {
        characterConsistency: this.extractScoreFromText(result, 'Character Consistency'),
        narrativeCoherence: this.extractScoreFromText(result, 'Narrative Coherence'),
        visualQuality: this.extractScoreFromText(result, 'Visual Quality'),
        emotionalResonance: this.extractScoreFromText(result, 'Emotional Resonance'),
        technicalExecution: this.extractScoreFromText(result, 'Technical Execution'),
        audienceAlignment: this.extractScoreFromText(result, 'Audience Alignment'),
        overallGrade: this.extractGradeFromText(result),
        recommendations: this.extractRecommendations(result)
      };

      return assessment;
    } catch (error) {
      this.logger.warn('Failed to parse quality assessment, returning raw result');
      return { rawAssessment: result };
    }
  }

  private extractStoryBeats(text: string): string[] {
    const beatMatches = text.match(/(?:story beats?|beats?):?\s*([^.]*)/gi);
    return beatMatches ? beatMatches.map(match => match.trim()) : [];
  }

  private extractCharacterDevelopment(text: string): string[] {
    const devMatches = text.match(/(?:character development|character growth):?\s*([^.]*)/gi);
    return devMatches ? devMatches.map(match => match.trim()) : [];
  }

  private extractVisualComposition(text: string): string[] {
    const visualMatches = text.match(/(?:visual composition|visual):?\s*([^.]*)/gi);
    return visualMatches ? visualMatches.map(match => match.trim()) : [];
  }

  private extractDialogueOptimization(text: string): string[] {
    const dialogueMatches = text.match(/(?:dialogue optimization|dialogue):?\s*([^.]*)/gi);
    return dialogueMatches ? dialogueMatches.map(match => match.trim()) : [];
  }

  private extractPacingStrategy(text: string): string {
    const pacingMatch = text.match(/(?:pacing strategy|pacing):?\s*([^.]*)/i);
    return pacingMatch ? pacingMatch[1].trim() : 'moderate';
  }

  private extractScoreFromText(text: string, metric: string): number {
    const scorePattern = new RegExp(`${metric}[:\\s]*(\\d+)(?:-\\d+)?`, 'i');
    const match = text.match(scorePattern);
    return match ? parseInt(match[1], 10) : 75; // Default score
  }

  private extractGradeFromText(text: string): string {
    const gradePattern = /(?:grade|overall):?\s*([A-F][+-]?)/i;
    const match = text.match(gradePattern);
    return match ? match[1] : 'B';
  }

  private extractRecommendations(text: string): string[] {
    const recPattern = /(?:recommendations?|improve):?\s*([^.]*)/gi;
    const matches = text.match(recPattern);
    return matches ? matches.map(match => match.trim()) : [];
  }

  // 🔄 HEALTH CHECK AND MONITORING

  public async performHealthCheck(): Promise<{
    isHealthy: boolean;
    details: any;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    let isHealthy = true;

    try {
      // Test basic API connectivity
      const testResult = await this.makeOpenAIAPICall<any>(
        '/chat/completions',
        {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Test connectivity' }],
          max_tokens: 10
        },
        30000,
        'health_check',
        { enableRetry: false }
      );

      if (!testResult?.choices?.[0]?.message) {
        isHealthy = false;
        recommendations.push('OpenAI API connectivity test failed');
      }

    } catch (error: any) {
      isHealthy = false;
      recommendations.push(`OpenAI API health check failed: ${error.message}`);
    }

    // Check circuit breaker states
    const openCircuits = Array.from(this.circuitBreakerStates.entries())
      .filter(([, state]) => state.state === 'open');

    if (openCircuits.length > 0) {
      isHealthy = false;
      recommendations.push(`Circuit breakers open for: ${openCircuits.map(([endpoint]) => endpoint).join(', ')}`);
    }

    // Check rate limit status
    const rateLimitIssues = Array.from(this.rateLimits.entries())
      .filter(([, limit]) => limit.count >= limit.maxRequests);

    if (rateLimitIssues.length > 0) {
      recommendations.push(`Rate limits exceeded for: ${rateLimitIssues.map(([endpoint]) => endpoint).join(', ')}`);
    }

    if (isHealthy) {
      recommendations.push('OpenAI Integration is operating normally');
    }

    return {
      isHealthy,
      details: {
        circuitBreakers: Object.fromEntries(this.circuitBreakerStates),
        rateLimits: Object.fromEntries(this.rateLimits),
        metrics: this.getMetricsSummary(),
        timestamp: new Date().toISOString()
      },
      recommendations
    };
  }

  // 📈 METRICS AND ANALYTICS

  public getMetrics(): {
    circuitBreakers: Record<string, CircuitBreakerState>;
    rateLimits: Record<string, any>;
    performance: any;
    health: any;
  } {
    return {
      circuitBreakers: this.getCircuitBreakerStatus(),
      rateLimits: this.getRateLimitStatus(),
      performance: {
        totalRequests: this.getTotalRequests(),
        averageResponseTime: this.getAverageResponseTime(),
        successRate: this.getSuccessRate()
      },
      health: {
        apiKeyConfigured: !!this.apiKey,
        timestamp: new Date().toISOString()
      }
    };
  }

  private getCircuitBreakerStatus(): Record<string, CircuitBreakerState> {
    return Object.fromEntries(this.circuitBreakerStates);
  }

  private getRateLimitStatus(): Record<string, any> {
    return Object.fromEntries(this.rateLimits);
  }

  private getMetricsSummary(): any {
    const allMetrics: any[] = [];
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }

    const totalRequests = allMetrics.length;
    const successfulRequests = allMetrics.filter(m => m.success).length;
    const averageResponseTime = totalRequests > 0 
      ? allMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests 
      : 0;

    return {
      totalRequests,
      successfulRequests,
      failedRequests: totalRequests - successfulRequests,
      successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100,
      averageResponseTime: Math.round(averageResponseTime)
    };
  }

  private getTotalRequests(): number {
    let total = 0;
    for (const metrics of this.metrics.values()) {
      total += metrics.length;
    }
    return total;
  }

  private getAverageResponseTime(): number {
    const summary = this.getMetricsSummary();
    return summary.averageResponseTime;
  }

  private getSuccessRate(): number {
    const summary = this.getMetricsSummary();
    return summary.successRate;
  }

  // 🧹 CLEANUP AND MAINTENANCE

  public clearMetrics(): void {
    this.metrics.clear();
    this.logger.log('🧹 OpenAI Integration metrics cleared');
  }

  public resetCircuitBreakers(): void {
    for (const [endpoint, state] of this.circuitBreakerStates) {
      state.state = 'closed';
      state.failures = 0;
      state.successCount = 0;
      this.logger.log(`🔄 Reset circuit breaker for ${endpoint}`);
    }
  }

  public resetRateLimits(): void {
    this.rateLimits.clear();
    this.logger.log('🔄 Rate limits reset');
  }

  /**
   * Dispose of resources and cleanup
   */
  public dispose(): void {
    this.circuitBreakerStates.clear();
    this.rateLimits.clear();
    this.metrics.clear();
    this.logger.log('🧹 OpenAI Integration disposed and cleaned up');
  }
}

// ===== FACTORY FUNCTIONS =====

/**
 * Create OpenAI integration with enterprise configuration
 */
export function createOpenAIIntegration(
  apiKey: string,
  learningEngine?: any,
  logger?: any
): OpenAIIntegration {
  return new OpenAIIntegration(apiKey, learningEngine, logger);
}

/**
 * Create OpenAI integration with validation
 */
export async function createValidatedOpenAIIntegration(
  apiKey: string,
  learningEngine?: any,
  logger?: any
): Promise<OpenAIIntegration> {
  const integration = new OpenAIIntegration(apiKey, learningEngine, logger);
  
  // Perform initial health check
  const health = await integration.performHealthCheck();
  
  if (!health.isHealthy) {
    throw new AIServiceUnavailableError(
      `OpenAI integration failed validation: ${health.recommendations.join(', ')}`,
      { service: 'OpenAIIntegration', operation: 'createValidatedOpenAIIntegration' }
    );
  }
  
  console.log('✅ OpenAI Integration validated and ready');
  return integration;
}

// ===== EXPORT TYPES =====

export type {
  OpenAICallOptions,
  OpenAIParameters,
  CircuitBreakerState,
  RateLimitState,
  RetryAttempt
};