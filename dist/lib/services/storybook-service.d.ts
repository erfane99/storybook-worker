import { type GenreType } from './story-service.js';
import { type Page } from './scene-service.js';
import { type AudienceType } from './image-service.js';
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
export declare class StorybookService {
    constructor();
    createStorybook(options: StorybookCreationOptions): Promise<StorybookResult>;
    createAutoStory(options: AutoStoryCreationOptions): Promise<StorybookResult>;
    generateScenesFromStory(options: {
        story: string;
        characterImage: string;
        audience: AudienceType;
    }): Promise<{
        pages: Page[];
        character_description?: string;
    }>;
    isHealthy(): boolean;
    getServiceStatus(): {
        character: boolean;
        story: boolean;
        scene: boolean;
        image: boolean;
        overall: boolean;
    };
}
export declare const storybookService: StorybookService;
export default storybookService;
