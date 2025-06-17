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
export declare class SceneService {
    private openaiApiKey;
    constructor();
    generateScenes(options: SceneGenerationOptions): Promise<SceneGenerationResult>;
    isHealthy(): boolean;
}
export declare const sceneService: SceneService;
export default sceneService;
