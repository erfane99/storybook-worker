// Scene generation service using GPT-4o
// Implements graceful degradation pattern

import { environmentManager } from '../config/environment.js';

export type AudienceType = 'children' | 'young_adults' | 'adults';

export interface Scene {
  description: string;
  emotion: string;
  imagePrompt: string;
  generatedImage?: string;
}

export interface Page {
  pageNumber: number;
  scenes: Scene[];
}

export interface SceneGenerationOptions {
  story: string;
  audience: AudienceType;
  characterImage?: string;
}

export interface SceneGenerationResult {
  pages: Page[];
  audience: AudienceType;
  characterImage?: string;
}

export class SceneService {
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
      console.log('✅ SceneService initialized with OpenAI API');
    } else {
      this.openaiApiKey = null;
      console.warn('⚠️ SceneService initialized without OpenAI API - service will be unavailable');
    }
  }

  /**
   * Generate scenes from a story using GPT-4o
   */
  async generateScenes(options: SceneGenerationOptions): Promise<SceneGenerationResult> {
    if (!this.isConfigured || !this.openaiApiKey) {
      throw new Error('SceneService not available: OpenAI API key is missing or invalid. Please configure OPENAI_API_KEY environment variable.');
    }

    const { story, audience = 'children', characterImage } = options;

    console.log('🎬 Starting scene generation...');
    console.log(`📋 Audience: ${audience}`);

    if (!story || story.trim().length < 50) {
      throw new Error('Story must be at least 50 characters long.');
    }

    // Audience-specific configuration
    const audienceConfig = {
      children: { 
        scenes: 10, 
        pages: 4, 
        notes: 'Simple, playful structure. 2–3 scenes per page.' 
      },
      young_adults: { 
        scenes: 14, 
        pages: 6, 
        notes: '2–3 scenes per page with meaningful plot turns.' 
      },
      adults: { 
        scenes: 18, 
        pages: 8, 
        notes: '3–5 scenes per page, allow complexity and layered meaning.' 
      }
    };

    const { scenes, pages, notes } = audienceConfig[audience];

    const systemPrompt = `
You are a professional comic book scene planner for a cartoon storybook app.

Audience: ${audience.toUpperCase()}
Target: ${scenes} scenes, grouped across ${pages} comic-style pages.

Each scene should reflect a strong visual moment or emotional beat from the story. Avoid filler.

Scene requirements:
- description: A short action summary for this scene
- emotion: Main character's emotional state
- imagePrompt: A rich, vivid DALL·E visual description (exclude character description; focus on environment, action, lighting, emotion)

Visual pacing notes:
${notes}

Return your output in this strict format:
{
  "pages": [
    {
      "pageNumber": 1,
      "scenes": [
        {
          "description": "...",
          "emotion": "...",
          "imagePrompt": "..."
        }
      ]
    }
  ]
}
`;

    try {
      console.log('📝 Making request to OpenAI GPT-4o API...');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          temperature: 0.85,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: story }
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

      // Inject character image for visual consistency
      const updatedPages = parsed.pages.map((page: any) => ({
        ...page,
        scenes: page.scenes.map((scene: any) => ({
          ...scene,
          generatedImage: characterImage // used as fallback placeholder until image gen runs
        }))
      }));

      console.log('✅ Successfully generated scenes');
      console.log(`📊 Generated ${updatedPages.length} pages with ${updatedPages.reduce((total: number, page: any) => total + page.scenes.length, 0)} scenes`);

      return {
        pages: updatedPages,
        audience,
        characterImage,
      };

    } catch (error: any) {
      console.error('❌ Scene generation error:', error);
      throw new Error(`Failed to generate scenes: ${error.message}`);
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
export const sceneService = new SceneService();
export default sceneService;