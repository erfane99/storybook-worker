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

// ===== CONSOLIDATED TYPE DEFINITIONS =====

// Character Service Types
export interface CharacterDescriptionOptions {
  imageUrl: string;
  style?: string;
}

export interface CharacterDescriptionResult {
  description: string;
  cached: boolean;
}

// Story Service Types
export type GenreType = 'adventure' | 'siblings' | 'bedtime' | 'fantasy' | 'history';
export type AudienceType = 'children' | 'young_adults' | 'adults';

export interface StoryGenerationOptionsEnhanced {
  genre: GenreType;
  characterDescription: string;
  audience: AudienceType;
}

export interface StoryGenerationResult {
  story: string;
  title: string;
  wordCount: number;
}

// Scene Service Types
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
}

// Image Service Types
export interface ImageGenerationOptions {
  image_prompt: string;
  character_description: string;
  emotion: string;
  audience: AudienceType;
  isReusedImage?: boolean;
  cartoon_image?: string;
  user_id?: string;
  style?: string;
  characterArtStyle?: string;
  layoutType?: string;
  panelType?: string;
}

export interface ImageGenerationResult {
  url: string;
  prompt_used: string;
  reused: boolean;
}

// Cartoonize Service Types
export interface CartoonizeOptions {
  prompt: string;
  style: string;
  imageUrl?: string;
  userId?: string;
}

export interface CartoonizeResult {
  url: string;
  cached: boolean;
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

  // ===== CORE AI OPERATIONS IMPLEMENTATION =====

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

  // ✅ ENTERPRISE-GRADE: Deep Content Discovery System
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

  // ✅ CONSOLIDATED: Single describeCharacter method handling all use cases
  async describeCharacter(imageUrlOrOptions: string | CharacterDescriptionOptions, prompt?: string): Promise<string | CharacterDescriptionResult> {
    // Handle both legacy string parameter and new options object
    let imageUrl: string;
    let style: string = 'storybook';
    let returnFullResult: boolean = false;

    if (typeof imageUrlOrOptions === 'string') {
      // Legacy usage: describeCharacter(imageUrl, prompt)
      imageUrl = imageUrlOrOptions;
      if (!prompt) {
        throw new Error('Prompt is required when using legacy string parameter');
      }
    } else {
      // New usage: describeCharacter(options)
      imageUrl = imageUrlOrOptions.imageUrl;
      style = imageUrlOrOptions.style || 'storybook';
      returnFullResult = true;
      
      // Use default character prompt for new usage
      prompt = `You are a professional character artist. Your task is to observe a real image of a person and return a precise, vivid, factual description of only the clearly visible physical traits. 

Never include disclaimers or apologies. Never say "I'm sorry" or "I can't help with that". Focus solely on what you can observe with high confidence. Only describe traits that are unambiguous and clearly visible in the image, such as:

- Gender presentation based on appearance
- Hair length, color, and texture if visible
- Skin tone (e.g., "light olive", "medium brown")
- Eye color if clearly visible
- Clothing style and color
- Accessories (e.g., "wearing red glasses", "gold earrings")
- Facial expression (e.g., "smiling", "neutral", "angry")

Avoid vague words like "appears to", "seems to", "probably", "possibly". Avoid all subjectivity.`;
    }

    console.log('🔍 Starting character description...');
    console.log('🌐 Image URL:', imageUrl);

    try {
      // GPT-4o Vision request
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: prompt,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Describe this image for cartoon generation. Only include clearly visible and objective features.'
                },
                {
                  type: 'image_url',
                  image_url: { url: imageUrl }
                }
              ]
            }
          ],
          max_tokens: 500,
        }),
      });

      console.log('📥 OpenAI response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        
        try {
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          throw new Error(`Failed to parse error: ${errorText}`);
        }

        const message = errorData?.error?.message || 'Unknown OpenAI error';
        throw new Error(`OpenAI API Error: ${message}`);
      }

      const data = await response.json();

      if (!data?.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from OpenAI API - no content received');
      }

      const description = data.choices[0].message.content;
      console.log('✅ Character described successfully');

      // Return appropriate format based on usage
      if (returnFullResult) {
        return {
          description,
          cached: false,
        };
      } else {
        return description;
      }

    } catch (error: any) {
      console.error('❌ Character description error:', error);
      throw new Error(`Failed to describe character: ${error.message}`);
    }
  }

  /**
   * Simple character description for scenes (with fallback)
   */
  async describeCharacterForScenes(imageUrl: string): Promise<string> {
    if (!this.apiKey) {
      console.warn('⚠️ AI Service not available, using default description');
      return 'a young protagonist';
    }

    try {
      console.log('🔍 Making request to OpenAI Vision API for character description...');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a cartoon illustrator assistant. Your job is to analyze a character image and provide a short, repeatable cartoon description (face, hair, clothing, etc.). Exclude background or action.'
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Describe this cartoon character' },
                { type: 'image_url', image_url: { url: imageUrl } }
              ]
            }
          ],
        }),
      });

      console.log('📥 Character description response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to describe character:', errorText);
        throw new Error('Failed to describe character image');
      }

      const data = await response.json();

      if (!data?.choices?.[0]?.message?.content) {
        console.error('❌ Invalid character description response:', data);
        throw new Error('Invalid response from character description API');
      }

      console.log('✅ Successfully described character');
      return data.choices[0].message.content;

    } catch (error: any) {
      console.warn('⚠️ Failed to describe character, using default:', error.message);
      return 'a young protagonist';
    }
  }

  // ===== ENHANCED STORY GENERATION =====

  async generateStoryEnhanced(options: StoryGenerationOptionsEnhanced): Promise<StoryGenerationResult> {
    const { genre, characterDescription, audience } = options;

    console.log('📝 Starting enhanced story generation...');
    console.log(`📋 Genre: ${genre}, Audience: ${audience}`);

    // Genre-specific prompts
    const genrePrompts = {
      adventure: 'Create an exciting adventure story filled with discovery, challenges to overcome, and personal growth.',
      siblings: 'Write a heartwarming story about the joys and challenges of sibling relationships, focusing on sharing, understanding, and family bonds.',
      bedtime: 'Create a gentle, soothing bedtime story with calming imagery and a peaceful resolution that helps children transition to sleep.',
      fantasy: 'Craft a magical tale filled with wonder, enchantment, and imaginative elements that spark creativity.',
      history: 'Tell an engaging historical story that brings the past to life while weaving in educational elements naturally.',
    };

    // Audience-specific configuration
    const audienceConfig = {
      children: {
        prompt: `
          Story Requirements:
          - Use simple, clear language suitable for young readers
          - Keep sentences short and direct
          - Include repetitive elements and patterns
          - Focus on positive themes and clear morals
          - Create opportunities for interactive engagement
          - Maintain a gentle pace with 5-8 distinct scenes
          - Use familiar concepts and relatable situations
          - Include moments of humor and playfulness
          - Ensure emotional safety throughout the story
          
          Language Guidelines:
          - Vocabulary: Simple, everyday words with occasional new terms explained through context
          - Sentence Structure: Short, clear sentences with basic patterns
          - Dialogue: Natural, age-appropriate conversations
          - Descriptions: Vivid but straightforward, focusing on primary colors and basic emotions
          
          Emotional Elements:
          - Clear emotional expressions
          - Simple conflict resolution
          - Emphasis on friendship, family, and kindness
          - Positive reinforcement of good behavior
          - Gentle handling of challenging situations`,
        wordCount: '300-400',
        scenes: '5-8'
      },
      young_adults: {
        prompt: `
          Story Requirements:
          - Develop more complex character arcs and relationships
          - Include meaningful personal growth and self-discovery
          - Address relevant social and emotional themes
          - Create engaging dialogue with distinct character voices
          - Build tension and resolution across 8-12 scenes
          - Incorporate subtle humor and wit
          - Balance entertainment with deeper messages
          
          Language Guidelines:
          - Vocabulary: Rich and varied, including metaphors and imagery
          - Sentence Structure: Mix of simple and complex sentences
          - Dialogue: Natural conversations that reveal character
          - Descriptions: Detailed and evocative, painting clear mental pictures
          
          Emotional Elements:
          - Complex emotional situations
          - Realistic internal conflicts
          - Exploration of relationships and identity
          - Nuanced character development
          - Meaningful resolution that allows for reflection`,
        wordCount: '600-800',
        scenes: '8-12'
      },
      adults: {
        prompt: `
          Story Requirements:
          - Craft sophisticated narrative structures
          - Develop layered character relationships
          - Explore complex themes and moral ambiguity
          - Create subtle, nuanced dialogue
          - Build a rich narrative across 10-15 scenes
          - Include symbolic and metaphorical elements
          - Address mature themes thoughtfully
          
          Language Guidelines:
          - Vocabulary: Sophisticated and precise
          - Sentence Structure: Complex and varied
          - Dialogue: Subtle, revealing subtext and character depth
          - Descriptions: Rich, atmospheric, with careful attention to detail
          
          Emotional Elements:
          - Deep psychological insights
          - Complex moral choices
          - Sophisticated relationship dynamics
          - Nuanced emotional resolution
          - Room for interpretation and reflection`,
        wordCount: '800-1200',
        scenes: '10-15'
      }
    };

    const config = audienceConfig[audience];
    const genrePrompt = genrePrompts[genre];

    if (!genrePrompt) {
      throw new Error(`Invalid genre: ${genre}`);
    }

    const storyPrompt = `You are a professional story writer crafting a high-quality, imaginative, and emotionally engaging story in the ${genre} genre.
This story is for a ${audience} audience and will be turned into a cartoon storybook with illustrations.

The main character is described as follows:
"${characterDescription}"

✨ Story Guidelines:
- Use descriptive language that matches the visual traits of the character
- Keep the character's appearance, personality, and role consistent throughout
- Include rich sensory details that can be illustrated
- Create ${config.scenes} distinct visual scenes that flow naturally
- Build emotional connection through character reactions and feelings
- Maintain a clear story arc: setup, challenge/conflict, resolution
- Target word count: ${config.wordCount} words

Genre-specific guidance:
${genrePrompt}

Audience-specific requirements:
${config.prompt}

✍️ Write a cohesive story that brings this character to life in an engaging way. Focus on creating vivid scenes that will translate well to illustrations.`;

    try {
      console.log('📝 Making request to OpenAI GPT-4 API...');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: storyPrompt
            },
            {
              role: 'user',
              content: 'Generate a story following the provided guidelines.'
            }
          ],
          temperature: 0.8,
          max_tokens: 2000,
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

      const data = await response.json();
      
      if (!data?.choices?.[0]?.message?.content) {
        console.error('❌ Invalid OpenAI response structure:', data);
        throw new Error('Invalid response from OpenAI API - no content received');
      }

      const generatedStory = data.choices[0].message.content;
      const wordCount = generatedStory.split(/\s+/).length;
      
      console.log('✅ Successfully generated story');
      console.log(`📊 Word count: ${wordCount}`);

      return {
        story: generatedStory,
        title: `${genre.charAt(0).toUpperCase() + genre.slice(1)} Story`,
        wordCount,
      };

    } catch (error: any) {
      console.error('❌ Story generation error:', error);
      throw new Error(`Failed to generate story: ${error.message}`);
    }
  }

  // ===== ENHANCED SCENE GENERATION WITH AUDIENCE CONFIGURATION =====

  async generateScenesWithAudience(options: EnhancedSceneGenerationOptions): Promise<EnhancedSceneGenerationResult> {
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

    // ENHANCED: Comic book specific audience configuration
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

    // ENHANCED: Comic book focused system prompt
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
      console.log('📝 Making request to OpenAI GPT-4o API for comic book layout...');

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

      // ENHANCED: Add comic book metadata to each panel
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

      console.log('✅ Successfully generated comic book layout');
      console.log(`📊 Generated ${updatedPages.length} comic book pages with ${updatedPages.reduce((total: number, page: any) => total + page.scenes.length, 0)} panels total`);

      return {
        pages: updatedPages,
        audience,
        characterImage,
        layoutType: 'comic-book-panels',
        characterArtStyle: characterArtStyle
      };

    } catch (error: any) {
      console.error('❌ Comic book scene generation error:', error);
      throw new Error(`Failed to generate comic book scenes: ${error.message}`);
    }
  }

  // ===== ENHANCED IMAGE GENERATION =====

  async generateSceneImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const {
      image_prompt,
      character_description,
      emotion,
      audience,
      isReusedImage = false,
      cartoon_image,
      user_id,
      style = 'storybook',
      characterArtStyle = 'storybook',
      layoutType = 'comic-book-panels',
      panelType = 'standard'
    } = options;

    console.log('🎨 Starting comic book panel generation...');
    console.log(`🎭 Panel Type: ${panelType}, Art Style: ${characterArtStyle}, Layout: ${layoutType}`);

    // Check cache first if applicable
    if (user_id && cartoon_image) {
      try {
        const { getCachedCartoonImage } = await import('../../lib/supabase/cache-utils.js');
        const cachedUrl = await getCachedCartoonImage(cartoon_image, characterArtStyle, user_id);
        if (cachedUrl) {
          console.log('✅ Found cached cartoon image');
          return {
            url: cachedUrl,
            prompt_used: image_prompt,
            reused: true,
          };
        }
      } catch (cacheError) {
        console.warn('⚠️ Cache lookup failed, continuing with generation:', cacheError);
      }
    }

    // ENHANCED: Audience-specific comic book styling
    const audienceStyles = {
      children: 'Create a bright, colorful comic book panel with simple, bold shapes and clear action. Use vibrant colors and friendly compositions suitable for young readers.',
      young_adults: 'Design a dynamic comic book panel with detailed backgrounds and expressive character poses. Use sophisticated color palettes and engaging visual storytelling.',
      adults: 'Craft a mature comic book panel with complex compositions, nuanced lighting, and detailed artistic elements. Employ sophisticated visual narrative techniques.',
    };

    // ENHANCED: Character art style integration
    const artStylePrompts = {
      'storybook': 'soft, whimsical art style with gentle colors and clean lines',
      'semi-realistic': 'semi-realistic style with smooth shading and detailed facial features',
      'comic-book': 'bold comic book style with strong outlines, vivid colors, and dynamic shading',
      'flat-illustration': 'modern flat illustration style with minimal shading and vibrant flat colors',
      'anime': 'anime art style with expressive features, stylized proportions, and crisp linework'
    };

    // ENHANCED: Panel type specifications
    const panelSpecs = {
      'standard': 'Create a standard rectangular comic book panel with balanced composition',
      'wide': 'Create a wide panoramic comic book panel that spans horizontally, perfect for establishing shots or action sequences',
      'tall': 'Create a tall vertical comic book panel that emphasizes height or dramatic moments',
      'splash': 'Create a dramatic splash panel that could span most of a page, with dynamic composition and high impact'
    };

    // ENHANCED: Build the comprehensive comic book panel prompt
    const characterConsistencyPrompt = isReusedImage && character_description 
      ? `CRITICAL: Use this EXACT character appearance consistently: ${character_description}. Do not create a new character - use this specific character description exactly.`
      : `Character: ${character_description}`;

    const finalPrompt = [
      `${panelSpecs[panelType as keyof typeof panelSpecs] || panelSpecs.standard}`,
      `Scene: ${image_prompt}`,
      `Emotional state: ${emotion}`,
      characterConsistencyPrompt,
      `Art Style: ${artStylePrompts[characterArtStyle as keyof typeof artStylePrompts] || artStylePrompts.storybook}`,
      `Comic Book Elements: Include panel borders, appropriate comic book styling, and clear visual storytelling`,
      audienceStyles[audience] || audienceStyles.children,
      'Maintain character appearance consistency with previous panels if this is part of a series.'
    ].filter(Boolean).join('\n\n');

    try {
      console.log('🎨 Making request to OpenAI DALL-E API for comic book panel...');
      console.log('🎭 Character Art Style:', characterArtStyle);
      console.log('📖 Panel Type:', panelType);

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: finalPrompt,
          n: 1,
          size: '1024x1024',
          quality: 'standard',
          style: 'vivid',
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

      const data = await response.json();
      
      if (!data?.data?.[0]?.url) {
        console.error('❌ Invalid OpenAI response structure:', data);
        throw new Error('Invalid response from OpenAI API - no image URL received');
      }

      const imageUrl = data.data[0].url;
      console.log('✅ Successfully generated comic book panel');
      console.log(`🎨 Panel Style: ${characterArtStyle}, Type: ${panelType}`);

      // Save to cache if applicable
      if (user_id && cartoon_image) {
        try {
          const { saveCartoonImageToCache } = await import('../../lib/supabase/cache-utils.js');
          await saveCartoonImageToCache(cartoon_image, imageUrl, characterArtStyle, user_id);
        } catch (cacheError) {
          console.warn('⚠️ Failed to save to cache (non-critical):', cacheError);
        }
      }

      return {
        url: imageUrl,
        prompt_used: finalPrompt,
        reused: false,
      };

    } catch (error: any) {
      console.error('❌ Comic book panel generation error:', error);
      throw new Error(`Failed to generate comic book panel: ${error.message}`);
    }
  }

  // ===== CARTOONIZE FUNCTIONALITY =====

  // Inline style prompts to avoid import issues
  private readonly stylePrompts = {
    'storybook': 'Use a soft, whimsical storybook style with gentle colors and clean lines.',
    'semi-realistic': 'Use a semi-realistic cartoon style with smooth shading and facial detail accuracy.',
    'comic-book': 'Use a bold comic book style with strong outlines, vivid colors, and dynamic shading.',
    'flat-illustration': 'Use a modern flat illustration style with minimal shading, clean vector lines, and vibrant flat colors.',
    'anime': 'Use anime style with expressive eyes, stylized proportions, and crisp linework inspired by Japanese animation.'
  };

  // Inline prompt cleaning function
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

  async processCartoonize(options: CartoonizeOptions): Promise<CartoonizeResult> {
    const { prompt, style = 'semi-realistic', imageUrl, userId } = options;

    console.log('🎨 Starting cartoonize processing...');

    // Optional cache check
    if (userId) {
      try {
        const { getCachedImage } = await import('../../lib/supabase/cache-utils.js');
        const cachedUrl = await getCachedImage(prompt, style, userId);
        if (cachedUrl) {
          console.log('✅ Found cached image');
          return { url: cachedUrl, cached: true };
        }
      } catch (cacheError) {
        console.warn('⚠️ Cache lookup failed, continuing with generation:', cacheError);
      }
    }

    // Clean and prepare prompt
    const cleanPrompt = this.cleanStoryPrompt(prompt);
    const stylePrompt = this.stylePrompts[style as keyof typeof this.stylePrompts] || this.stylePrompts['semi-realistic'];
    const finalPrompt = `Create a cartoon-style portrait of the person described below. Focus on accurate facial features and clothing details. ${cleanPrompt}. ${stylePrompt}`;

    console.log('🎨 Making request to OpenAI DALL-E API...');

    // Call OpenAI DALL-E API
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: finalPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'vivid',
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

    const data = await response.json();
    
    if (!data?.data?.[0]?.url) {
      console.error('❌ Invalid OpenAI response structure:', data);
      throw new Error('Invalid response from OpenAI API - no image URL received');
    }

    const generatedUrl = data.data[0].url;
    console.log('✅ Successfully generated image');

    // Optional cache save
    if (userId) {
      try {
        const { saveToCache } = await import('../../lib/supabase/cache-utils.js');
        await saveToCache(prompt, generatedUrl, style, userId);
      } catch (cacheError) {
        console.warn('⚠️ Failed to save to cache (non-critical):', cacheError);
      }
    }

    return {
      url: generatedUrl,
      cached: false,
    };
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

  // ✅ ENTERPRISE DEEP CONTENT DISCOVERY SYSTEM
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

  // ===== STATUS METHODS =====

  getStatus() {
    const openaiStatus = environmentManager.getServiceStatus('openai');
    return {
      configured: this.apiKey !== null,
      available: this.isHealthy(),
      status: openaiStatus.status,
      message: openaiStatus.message
    };
  }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;