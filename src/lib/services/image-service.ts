// Image generation service using DALL-E 3
// Extracted from /api/story/generate-cartoon-image

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
}

export interface ImageGenerationResult {
  url: string;
  prompt_used: string;
  reused: boolean;
}

export class ImageService {
  private openaiApiKey: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY in your environment variables.');
    }
    this.openaiApiKey = apiKey;
  }

  /**
   * Generate scene image using DALL-E 3
   */
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
    } = options;

    console.log('🎨 Starting scene image generation...');

    // Check cache first if applicable
    if (user_id && cartoon_image) {
      try {
        const { getCachedCartoonImage } = await import('@/lib/supabase/cache-utils.js');
        const cachedUrl = await getCachedCartoonImage(cartoon_image, style, user_id);
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

    // Audience-specific styling
    const audienceStyles = {
      children: 'Create a bright, clear illustration with simple shapes and warm colors. Focus on readability and emotional expression.',
      young_adults: 'Use dynamic composition with strong lines and detailed environments. Balance realism with stylized elements.',
      adults: 'Employ sophisticated lighting, detailed textures, and nuanced emotional expression. Maintain artistic maturity.',
    };

    // Build the final prompt
    const finalPrompt = [
      `Scene: ${image_prompt}`,
      `Emotional state: ${emotion}`,
      isReusedImage ? 'Include the same cartoon character as previously described below.' : '',
      `Character description: ${character_description}`,
      audienceStyles[audience] || audienceStyles.children,
    ].filter(Boolean).join('\n\n');

    try {
      console.log('🎨 Making request to OpenAI DALL-E API...');

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
      console.log('✅ Successfully generated cartoon image');

      // Save to cache if applicable
      if (user_id && cartoon_image) {
        try {
          const { saveCartoonImageToCache } = await import('@/lib/supabase/cache-utils.js');
          await saveCartoonImageToCache(cartoon_image, imageUrl, style, user_id);
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
      console.error('❌ Image generation error:', error);
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }

  /**
   * Health check
   */
  isHealthy(): boolean {
    return !!this.openaiApiKey;
  }
}

// Export singleton instance
export const imageService = new ImageService();
export default imageService;
