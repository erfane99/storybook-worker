import { characterService } from './character-service.js';
import { storyService } from './story-service.js';
import { sceneService } from './scene-service.js';
import { imageService } from './image-service.js';
export class StorybookService {
    constructor() {
        console.log('🔧 Storybook service initialized');
    }
    async createStorybook(options) {
        const { title, story, characterImage, pages, audience, isReusedImage = false, userId } = options;
        console.log('📚 Starting storybook creation...');
        console.log(`📋 Title: ${title}, Audience: ${audience}`);
        let characterDescription = '';
        let hasErrors = false;
        try {
            if (!isReusedImage) {
                console.log('🔍 Analyzing character image...');
                try {
                    const result = await characterService.describeCharacter({
                        imageUrl: characterImage
                    });
                    characterDescription = result.description;
                    console.log('✅ Character description:', characterDescription);
                }
                catch (error) {
                    console.warn('⚠️ Character description failed, using fallback:', error.message);
                    characterDescription = 'a cartoon character';
                }
            }
            const updatedPages = [];
            const totalScenes = pages.reduce((total, page) => total + (page.scenes?.length || 0), 0);
            let processedScenes = 0;
            console.log(`🎨 Processing ${pages.length} pages with ${totalScenes} scenes...`);
            for (const [pageIndex, page] of pages.entries()) {
                console.log(`\n=== Processing Page ${pageIndex + 1} ===`);
                const updatedScenes = [];
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
                    }
                    catch (error) {
                        console.error(`❌ Failed to generate image for Scene ${sceneIndex + 1}:`, error.message);
                        hasErrors = true;
                        updatedScenes.push({
                            ...scene,
                            generatedImage: characterImage,
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
        }
        catch (error) {
            console.error('❌ Storybook creation failed:', error);
            throw new Error(`Failed to create storybook: ${error.message}`);
        }
    }
    async createAutoStory(options) {
        const { genre, characterDescription, cartoonImageUrl, audience, userId } = options;
        console.log('🤖 Starting auto-story creation...');
        console.log(`📋 Genre: ${genre}, Audience: ${audience}`);
        try {
            console.log('📝 Generating story...');
            const storyResult = await storyService.generateStory({
                genre,
                characterDescription,
                audience,
            });
            console.log('✅ Story generated successfully');
            console.log('🎬 Generating scenes...');
            const sceneResult = await sceneService.generateScenes({
                story: storyResult.story,
                audience,
                characterImage: cartoonImageUrl,
            });
            console.log('✅ Scenes generated successfully');
            console.log('📚 Creating complete storybook...');
            const storybookResult = await this.createStorybook({
                title: storyResult.title,
                story: storyResult.story,
                characterImage: cartoonImageUrl,
                pages: sceneResult.pages,
                audience,
                isReusedImage: true,
                userId,
            });
            console.log('✅ Auto-story creation complete');
            return storybookResult;
        }
        catch (error) {
            console.error('❌ Auto-story creation failed:', error);
            throw new Error(`Failed to create auto-story: ${error.message}`);
        }
    }
    async generateScenesFromStory(options) {
        const { story, characterImage, audience } = options;
        console.log('🎬 Starting scene generation from story...');
        try {
            let characterDescription = 'a young protagonist';
            if (characterImage) {
                try {
                    characterDescription = await characterService.describeCharacterForScenes(characterImage);
                    console.log('✅ Generated character description:', characterDescription);
                }
                catch (error) {
                    console.warn('⚠️ Failed to describe character, using default:', error.message);
                }
            }
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
        }
        catch (error) {
            console.error('❌ Scene generation failed:', error);
            throw new Error(`Failed to generate scenes: ${error.message}`);
        }
    }
    isHealthy() {
        return (characterService.isHealthy() &&
            storyService.isHealthy() &&
            sceneService.isHealthy() &&
            imageService.isHealthy());
    }
    getServiceStatus() {
        return {
            character: characterService.isHealthy(),
            story: storyService.isHealthy(),
            scene: sceneService.isHealthy(),
            image: imageService.isHealthy(),
            overall: this.isHealthy(),
        };
    }
}
export const storybookService = new StorybookService();
export default storybookService;
//# sourceMappingURL=storybook-service.js.map