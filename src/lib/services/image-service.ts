// Image generation service using DALL-E 3 with comic book panel support
// Implements graceful degradation pattern

import { environmentManager } from '../config/environment.js';

export type AudienceType = 'children' | 'young_adults' | 'adults';

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

export class ImageService {
  private openaiApiKey: string | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initializeConfiguration();
  }

  private initializeConfiguration(): void {
    const openaiStatus = environmentManager.getServiceStatus('openai');
    this.isConfigured = openaiStatus.isAvailable;
    
    if (this.isConfigured) {
      this.openaiApiKey = process.env.OPENAI_API_KEY!;
      console.log('✅ ImageService initialized with OpenAI API');
    } else {
      this.openaiApiKey = null;
      console.warn('⚠️ ImageService initialized without OpenAI API - service will be unavailable');
    }
  }

  /**
   * Generate comic book panel image using DALL-E 3 with character consistency
   */
  async generateSceneImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    if (!this.isConfigured || !this.openaiApiKey) {
      throw new Error('ImageService not available: OpenAI API key is missing or invalid. Please configure OPENAI_API_KEY environment variable.');
    }

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
        const { getCachedCartoonImage } = await import('../supabase/cache-utils.js');
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
          'Authorization': `Bearer ${this.openaiApiKey}`,
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
          const { saveCartoonImageToCache } = await import('../supabase/cache-utils.js');
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

  /**
   * Health check with graceful degradation awareness
   */
  isHealthy(): boolean {
    return this.isConfigured && !!this.openaiApiKey;
  }

  getStatus() {
    const openaiStatus = environmentManager.getServiceStatus('openai');
    return {
      configured: this.isConfigured,
      available: this.isHealthy(),
      status: openaiStatus.status,
      message: openaiStatus.message
    };
  }
}

// Export singleton instance
export const imageService = new ImageService();
export default imageService;