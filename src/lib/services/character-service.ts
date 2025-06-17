// Character description service using GPT-4o Vision
// Extracted from /api/image/describe

export interface CharacterDescriptionOptions {
  imageUrl: string;
  style?: string;
}

export interface CharacterDescriptionResult {
  description: string;
  cached: boolean;
}

export class CharacterService {
  private openaiApiKey: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY in your environment variables.');
    }
    this.openaiApiKey = apiKey;
  }

  /**
   * Generate character description from image using GPT-4o Vision
   */
  async describeCharacter(options: CharacterDescriptionOptions): Promise<CharacterDescriptionResult> {
    const { imageUrl, style = 'storybook' } = options;

    console.log('🔍 Starting character description...');
    console.log('🌐 Image URL:', imageUrl);

    const characterPrompt = `You are a professional character artist. Your task is to observe a real image of a person and return a precise, vivid, factual description of only the clearly visible physical traits. 

Never include disclaimers or apologies. Never say "I'm sorry" or "I can't help with that". Focus solely on what you can observe with high confidence. Only describe traits that are unambiguous and clearly visible in the image, such as:

- Gender presentation based on appearance
- Hair length, color, and texture if visible
- Skin tone (e.g., "light olive", "medium brown")
- Eye color if clearly visible
- Clothing style and color
- Accessories (e.g., "wearing red glasses", "gold earrings")
- Facial expression (e.g., "smiling", "neutral", "angry")

Avoid vague words like "appears to", "seems to", "probably", "possibly". Avoid all subjectivity.`;

    try {
      // GPT-4o Vision request
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: characterPrompt,
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

      return {
        description,
        cached: false,
      };

    } catch (error: any) {
      console.error('❌ Character description error:', error);
      throw new Error(`Failed to describe character: ${error.message}`);
    }
  }

  /**
   * Simple character description for scenes (shorter version)
   */
  async describeCharacterForScenes(imageUrl: string): Promise<string> {
    try {
      console.log('🔍 Making request to OpenAI Vision API for character description...');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
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

  /**
   * Health check
   */
  isHealthy(): boolean {
    return !!this.openaiApiKey;
  }
}

// Export singleton instance
export const characterService = new CharacterService();
export default characterService;
