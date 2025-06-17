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
export declare class ImageService {
    private openaiApiKey;
    constructor();
    generateSceneImage(options: ImageGenerationOptions): Promise<ImageGenerationResult>;
    isHealthy(): boolean;
}
export declare const imageService: ImageService;
export default imageService;
