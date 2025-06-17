export type GenreType = 'adventure' | 'siblings' | 'bedtime' | 'fantasy' | 'history';
export type AudienceType = 'children' | 'young_adults' | 'adults';
export interface StoryGenerationOptions {
    genre: GenreType;
    characterDescription: string;
    audience: AudienceType;
}
export interface StoryGenerationResult {
    story: string;
    title: string;
    wordCount: number;
}
export declare class StoryService {
    private openaiApiKey;
    constructor();
    generateStory(options: StoryGenerationOptions): Promise<StoryGenerationResult>;
    isHealthy(): boolean;
}
export declare const storyService: StoryService;
export default storyService;
