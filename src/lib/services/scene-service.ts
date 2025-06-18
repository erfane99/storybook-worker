// Scene generation service using GPT-4o with comic book panel support
// Implements graceful degradation pattern

import { environmentManager } from '../config/environment.js';

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

export interface SceneGenerationOptions {
  story: string;
  audience: AudienceType;
  characterImage?: string;
  characterArtStyle?: string;
  layoutType?: string;
}

export interface SceneGenerationResult {
  pages: Page[];
  audience: AudienceType;
  characterImage?: string;
  layoutType?: string;
  characterArtStyle?: string;
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
   * Generate comic book style scenes from a story using GPT-4o
   */
  async generateScenes(options: SceneGenerationOptions): Promise<SceneGenerationResult> {
    if (!this.isConfigured || !this.openaiApiKey) {
      throw new Error('SceneService not available: OpenAI API key is missing or invalid. Please configure OPENAI_API_KEY environment variable.');
    }

    const { 
      story, 
      audience = 'children', 
      characterImage,
      characterArtStyle = 'storybook',
      layoutType = 'comic-book-panels'
    } = options;

    console.log('🎬 Starting comic book scene generation...');
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
          'Authorization': `Bearer ${this.openaiApiKey}`,
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