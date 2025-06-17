export interface CharacterDescriptionOptions {
    imageUrl: string;
    style?: string;
}
export interface CharacterDescriptionResult {
    description: string;
    cached: boolean;
}
export declare class CharacterService {
    private openaiApiKey;
    constructor();
    describeCharacter(options: CharacterDescriptionOptions): Promise<CharacterDescriptionResult>;
    describeCharacterForScenes(imageUrl: string): Promise<string>;
    isHealthy(): boolean;
}
export declare const characterService: CharacterService;
export default characterService;
