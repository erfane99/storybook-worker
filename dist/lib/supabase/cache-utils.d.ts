export declare function getCachedImage(originalPrompt: string, style: string, userId?: string): Promise<string | null>;
export declare function saveToCache(originalPrompt: string, cartoonUrl: string, style: string, userId: string): Promise<void>;
export declare function getCachedCartoonImage(originalUrl: string, style: string, userId?: string): Promise<string | null>;
export declare function saveCartoonImageToCache(originalUrl: string, cartoonizedUrl: string, style: string, userId?: string): Promise<void>;
