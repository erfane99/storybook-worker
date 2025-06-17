// Complete storybook creation service
// Orchestrates character, story, scene, and image services

import { environmentManager } from '../config/environment.js';
import { characterService } from './character-service.js';
import { storyService, type GenreType } from './story-service.js';
import { sceneService, type Scene, type Page } from './scene-service.js';
import { imageService, type AudienceType } from './image-service.js';

export interface StorybookCreationOptions {
  title: string;
  story: string;
  characterImage: string;
  pages: Page[];
  audience: AudienceType;
  isReusedImage?: boolean;
  userId?: string;
}

export interface AutoStoryCreationOptions {
  genre: GenreType;
  characterDescription: string;
  cartoonImageUrl: string;
  audience: AudienceType;
  userId?: string;
}

export interface StorybookResult {
  id?: string;
  title: string;
  story: string;
  pages: Page[];
  audience: AudienceType;
  character_description: string;
  has_errors: boolean;
  warning?: string;
}

export class StorybookService {
  constructor() {
    console.log('🔧 Storybook service initialized');
  }

  /**
   * Create a complete storybook from story and character image
   */
  async createStorybook(options: StorybookCreationOptions): Promise<StorybookResult> {
    const { title, story, characterImage, pages, audience, isReusedImage = false, userId } = options;

    console.log('📚 Starting storybook creation...');
    console.log(`📋 Title: ${title}, Audience: ${audience}`);

    // Check service availability
    const openaiStatus = environmentManager.getServiceStatus('openai');
    if (!openaiStatus.isAvailable) {
      throw new Error(`StorybookService not available: ${openaiStatus.message}`);
    }

    let characterDescription = '';
    let hasErrors = false;

    try {
      // Step 1: Character analysis (if not reused)
      if (!isReusedImage) {
        console.log('🔍 Analyzing character image...');
        try {
          const result = await characterService.describeCharacter({
            imageUrl: characterImage
          });
          characterDescription = result.description;
          console.log('✅ Character description:', characterDescription);
        } catch (error: any) {
          console.warn('⚠️ Character description failed, using fallback:', error.message);
          characterDescription = 'a cartoon character';
        }
      }

      // Step 2: Process scenes page by page
      const updatedPages: Page[] = [];
      const totalScenes = pages.reduce((total, page) => total + (page.scenes?.length || 0), 0);
      let processedScenes = 0;

      console.log(`🎨 Processing ${pages.length} pages with ${totalScenes} scenes...`);

      for (const [pageIndex, page] of pages.entries()) {
        console.log(`\n=== Processing Page ${pageIndex + 1} ===`);
        const updatedScenes: Scene[] = [];

        for (const [sceneIndex, scene] of (page.scenes || []).entries()) {
          console.log(`Processing Scene ${sceneIndex + 1} of Page ${pageIndex + 1}`);

          try {
            const imageResult = await imageService.generateSceneImage({
              image_prompt: scene.imagePrompt,
              character_description: characterDescription,
              emotion: scene.emotion,
              audience,
              isReusedImage,
              cartoon_image: characterImage,
              user_id: userId,
              style: 'storybook',
            });

            updatedScenes.push({
              ...scene,
              generatedImage: imageResult.url,
            });

            console.log(`✅ Generated image for Scene ${sceneIndex + 1}`);

          } catch (error: any) {
            console.error(`❌ Failed to generate image for Scene ${sceneIndex + 1}:`, error.message);
            hasErrors = true;
            updatedScenes.push({
              ...scene,
              generatedImage: characterImage, // Fallback to character image
            });
          }

          processedScenes++;
        }

        updatedPages.push({
          pageNumber: pageIndex + 1,
          scenes: updatedScenes,
        });
      }

      console.log('✅ Storybook creation complete');

      return {
        title,
        story,
        pages: updatedPages,
        audience,
        character_description: characterDescription,
        has_errors: hasErrors,
        warning: hasErrors ? 'Some images failed to generate' : undefined,
      };

    } catch (error: any) {
      console.error('❌ Storybook creation failed:', error);
      throw new Error(`Failed to create storybook: ${error.message}`);
    }
  }

  /**
   * Create a complete storybook from auto-generated story
   */
  async createAutoStory(options: AutoStoryCreationOptions): Promise<StorybookResult> {
    const { genre, characterDescription, cartoonImageUrl, audience, userId } = options;

    console.log('🤖 Starting auto-story creation...');
    console.log(`📋 Genre: ${genre}, Audience: ${audience}`);

    // Check service availability
    const openaiStatus = environmentManager.getServiceStatus('openai');
    if (!openaiStatus.isAvailable) {
      throw new Error(`StorybookService not available: ${openaiStatus.message}`);
    }

    try {
      // Step 1: Generate story
      console.log('📝 Generating story...');
      const storyResult = await storyService.generateStory({
        genre,
        characterDescription,
        audience,
      });

      console.log('✅ Story generated successfully');

      // Step 2: Generate scenes from story
      console.log('🎬 Generating scenes...');
      const sceneResult = await sceneService.generateScenes({
        story: storyResult.story,
        audience,
        characterImage: cartoonImageUrl,
      });

      console.log('✅ Scenes generated successfully');

      // Step 3: Create complete storybook with images
      console.log('📚 Creating complete storybook...');
      const storybookResult = await this.createStorybook({
        title: storyResult.title,
        story: storyResult.story,
        characterImage: cartoonImageUrl,
        pages: sceneResult.pages,
        audience,
        isReusedImage: true, // Character already described
        userId,
      });

      console.log('✅ Auto-story creation complete');

      return storybookResult;

    } catch (error: any) {
      console.error('❌ Auto-story creation failed:', error);
      throw new Error(`Failed to create auto-story: ${error.message}`);
    }
  }

  /**
   * Generate scenes from existing story
   */
  async generateScenesFromStory(options: {
    story: string;
    characterImage: string;
    audience: AudienceType;
  }): Promise<{ pages: Page[]; character_description?: string }> {
    const { story, characterImage, audience } = options;

    console.log('🎬 Starting scene generation from story...');

    // Check service availability
    const openaiStatus = environmentManager.getServiceStatus('openai');
    if (!openaiStatus.isAvailable) {
      throw new Error(`StorybookService not available: ${openaiStatus.message}`);
    }

    try {
      // Get character description
      let characterDescription = 'a young protagonist';
      if (characterImage) {
        try {
          characterDescription = await characterService.describeCharacterForScenes(characterImage);
          console.log('✅ Generated character description:', characterDescription);
        } catch (error: any) {
          console.warn('⚠️ Failed to describe character, using default:', error.message);
        }
      }

      // Generate scenes
      const sceneResult = await sceneService.generateScenes({
        story,
        audience,
        characterImage,
      });

      console.log('✅ Scene generation complete');

      return {
        pages: sceneResult.pages,
        character_description: characterDescription,
      };

    } catch (error: any) {
      console.error('❌ Scene generation failed:', error);
      throw new Error(`Failed to generate scenes: ${error.message}`);
    }
  }

  /**
   * Health check - verify all services are ready
   */
  isHealthy(): boolean {
    return (
      characterService.isHealthy() &&
      storyService.isHealthy() &&
      sceneService.isHealthy() &&
      imageService.isHealthy()
    );
  }

  /**
   * Get service status with configuration awareness
   */
  getServiceStatus() {
    const openaiStatus = environmentManager.getServiceStatus('openai');
    
    return {
      overall: this.isHealthy(),
      openai: openaiStatus,
      services: {
        character: characterService.getStatus(),
        story: storyService.getStatus(),
        scene: sceneService.getStatus(),
        image: imageService.getStatus(),
      }
    };
  }
}

// Export singleton instance
export const storybookService = new StorybookService();
export default storybookService;