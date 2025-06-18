// Complete storybook creation service with comic book support
// Implements graceful degradation pattern

import { environmentManager } from '../config/environment.js';
import { characterService } from './character-service.js';
import { storyService, type GenreType } from './story-service.js';
import { sceneService, type Scene, type Page } from './scene-service.js';
import { imageService, type AudienceType } from './image-service.js';

// ENHANCED: Comic book support interfaces
export interface StorybookCreationOptions {
  title: string;
  story: string;
  characterImage: string;
  pages: Page[];
  audience: AudienceType;
  isReusedImage?: boolean;
  userId?: string;
  characterArtStyle?: string; // NEW: Character art style (anime, comic-book, etc.)
  layoutType?: string; // NEW: Layout type (comic-book-panels, individual-scenes)
}

export interface AutoStoryCreationOptions {
  genre: GenreType;
  characterDescription: string;
  cartoonImageUrl: string;
  audience: AudienceType;
  userId?: string;
  characterArtStyle?: string; // NEW: Character art style
  layoutType?: string; // NEW: Layout type
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
  characterArtStyle?: string; // NEW: Art style used
  layoutType?: string; // NEW: Layout type used
}

export class StorybookService {
  constructor() {
    // Log service availability status
    const openaiStatus = environmentManager.getServiceStatus('openai');
    const supabaseStatus = environmentManager.getServiceStatus('supabase');
    
    if (openaiStatus.isAvailable && supabaseStatus.isAvailable) {
      console.log('✅ StorybookService initialized with full comic book functionality');
    } else {
      console.warn('⚠️ StorybookService initialized with limited functionality:');
      if (!openaiStatus.isAvailable) {
        console.warn(`   - OpenAI: ${openaiStatus.message}`);
      }
      if (!supabaseStatus.isAvailable) {
        console.warn(`   - Supabase: ${supabaseStatus.message}`);
      }
    }
  }

  /**
   * ENHANCED: Create a complete comic book storybook from story and character image
   */
  async createStorybook(options: StorybookCreationOptions): Promise<StorybookResult> {
    const { 
      title, 
      story, 
      characterImage, 
      pages, 
      audience, 
      isReusedImage = false, 
      userId,
      characterArtStyle = 'storybook', // NEW: Default art style
      layoutType = 'comic-book-panels' // NEW: Default layout type
    } = options;

    console.log('📚 Starting comic book storybook creation...');
    console.log(`📋 Title: ${title}, Audience: ${audience}`);
    console.log(`🎨 Art Style: ${characterArtStyle}, Layout: ${layoutType}`);

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

      // Step 2: Process scenes page by page with comic book context
      const updatedPages: Page[] = [];
      const totalScenes = pages.reduce((total, page) => total + (page.scenes?.length || 0), 0);
      let processedScenes = 0;

      console.log(`🎨 Processing ${pages.length} comic book pages with ${totalScenes} panels...`);
      console.log(`🎭 Using ${characterArtStyle} art style for character consistency`);

      for (const [pageIndex, page] of pages.entries()) {
        console.log(`\n=== Processing Comic Book Page ${pageIndex + 1} ===`);
        const updatedScenes: Scene[] = [];

        for (const [sceneIndex, scene] of (page.scenes || []).entries()) {
          console.log(`Processing Panel ${sceneIndex + 1} of Page ${pageIndex + 1} (${characterArtStyle} style)`);

          try {
            // ENHANCED: Pass comic book context to image generation
            const imageResult = await imageService.generateSceneImage({
              image_prompt: scene.imagePrompt,
              character_description: characterDescription,
              emotion: scene.emotion,
              audience,
              isReusedImage,
              cartoon_image: characterImage,
              user_id: userId,
              style: 'storybook',
              characterArtStyle, // NEW: Pass character art style
              layoutType, // NEW: Pass layout type
              panelType: scene.panelType || 'standard', // NEW: Pass panel type
            });

            updatedScenes.push({
              ...scene,
              generatedImage: imageResult.url,
              characterArtStyle, // NEW: Store art style in scene
              layoutType, // NEW: Store layout type in scene
            });

            console.log(`✅ Generated ${characterArtStyle} style panel for Scene ${sceneIndex + 1}`);

          } catch (error: any) {
            console.error(`❌ Failed to generate panel for Scene ${sceneIndex + 1}:`, error.message);
            hasErrors = true;
            updatedScenes.push({
              ...scene,
              generatedImage: characterImage, // Fallback to character image
              characterArtStyle, // NEW: Store art style even for fallback
              layoutType, // NEW: Store layout type even for fallback
            });
          }

          processedScenes++;
        }

        updatedPages.push({
          pageNumber: pageIndex + 1,
          scenes: updatedScenes,
          layoutType, // NEW: Store layout type in page
          characterArtStyle, // NEW: Store art style in page
        });
      }

      console.log('✅ Comic book storybook creation complete');
      console.log(`🎨 Created with ${characterArtStyle} art style and ${layoutType} layout`);

      return {
        title,
        story,
        pages: updatedPages,
        audience,
        character_description: characterDescription,
        has_errors: hasErrors,
        warning: hasErrors ? 'Some comic book panels failed to generate' : undefined,
        characterArtStyle, // NEW: Return art style used
        layoutType, // NEW: Return layout type used
      };

    } catch (error: any) {
      console.error('❌ Comic book storybook creation failed:', error);
      throw new Error(`Failed to create comic book storybook: ${error.message}`);
    }
  }

  /**
   * ENHANCED: Create a complete comic book storybook from auto-generated story
   */
  async createAutoStory(options: AutoStoryCreationOptions): Promise<StorybookResult> {
    const { 
      genre, 
      characterDescription, 
      cartoonImageUrl, 
      audience, 
      userId,
      characterArtStyle = 'storybook', // NEW: Default art style
      layoutType = 'comic-book-panels' // NEW: Default layout type
    } = options;

    console.log('🤖 Starting comic book auto-story creation...');
    console.log(`📋 Genre: ${genre}, Audience: ${audience}`);
    console.log(`🎨 Art Style: ${characterArtStyle}, Layout: ${layoutType}`);

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

      // Step 2: Generate comic book scenes from story
      console.log('🎬 Generating comic book layout...');
      const sceneResult = await sceneService.generateScenes({
        story: storyResult.story,
        audience,
        characterImage: cartoonImageUrl,
        characterArtStyle, // NEW: Pass art style to scene generation
        layoutType, // NEW: Pass layout type to scene generation
      });

      console.log('✅ Comic book layout generated successfully');

      // Step 3: Create complete comic book storybook with images
      console.log('📚 Creating complete comic book storybook...');
      const storybookResult = await this.createStorybook({
        title: storyResult.title,
        story: storyResult.story,
        characterImage: cartoonImageUrl,
        pages: sceneResult.pages,
        audience,
        isReusedImage: true, // Character already described
        userId,
        characterArtStyle, // NEW: Pass art style through
        layoutType, // NEW: Pass layout type through
      });

      console.log('✅ Comic book auto-story creation complete');
      console.log(`🎨 Created with ${characterArtStyle} art style and ${layoutType} layout`);

      return storybookResult;

    } catch (error: any) {
      console.error('❌ Comic book auto-story creation failed:', error);
      throw new Error(`Failed to create comic book auto-story: ${error.message}`);
    }
  }

  /**
   * ENHANCED: Generate comic book scenes from existing story
   */
  async generateScenesFromStory(options: {
    story: string;
    characterImage: string;
    audience: AudienceType;
    characterArtStyle?: string; // NEW: Character art style
    layoutType?: string; // NEW: Layout type
  }): Promise<{ pages: Page[]; character_description?: string }> {
    const { 
      story, 
      characterImage, 
      audience,
      characterArtStyle = 'storybook', // NEW: Default art style
      layoutType = 'comic-book-panels' // NEW: Default layout type
    } = options;

    console.log('🎬 Starting comic book scene generation from story...');
    console.log(`🎨 Art Style: ${characterArtStyle}, Layout: ${layoutType}`);

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

      // ENHANCED: Generate comic book scenes with art style context
      const sceneResult = await sceneService.generateScenes({
        story,
        audience,
        characterImage,
        characterArtStyle, // NEW: Pass art style to scene generation
        layoutType, // NEW: Pass layout type to scene generation
      });

      console.log('✅ Comic book scene generation complete');
      console.log(`🎨 Generated with ${characterArtStyle} art style and ${layoutType} layout`);

      return {
        pages: sceneResult.pages,
        character_description: characterDescription,
      };

    } catch (error: any) {
      console.error('❌ Comic book scene generation failed:', error);
      throw new Error(`Failed to generate comic book scenes: ${error.message}`);
    }
  }

  /**
   * Health check - verify all services are ready with comic book support
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
   * Get service status with comic book feature awareness
   */
  getServiceStatus() {
    const openaiStatus = environmentManager.getServiceStatus('openai');
    const supabaseStatus = environmentManager.getServiceStatus('supabase');
    
    return {
      overall: this.isHealthy(),
      openai: openaiStatus,
      supabase: supabaseStatus,
      services: {
        character: characterService.getStatus(),
        story: storyService.getStatus(),
        scene: sceneService.getStatus(),
        image: imageService.getStatus(),
      },
      features: {
        comicBookSupport: true,
        characterConsistency: true,
        multiPanelLayouts: true,
        variableArtStyles: true,
        supportedArtStyles: ['storybook', 'comic-book', 'anime', 'semi-realistic', 'cartoon'],
        supportedLayouts: ['comic-book-panels', 'individual-scenes'],
      }
    };
  }
}

// Export singleton instance
export const storybookService = new StorybookService();
export default storybookService;