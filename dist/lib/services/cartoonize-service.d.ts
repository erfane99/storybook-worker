interface CartoonizeOptions {
    prompt: string;
    style: string;
    imageUrl?: string;
    userId?: string;
}
interface CartoonizeResult {
    url: string;
    cached: boolean;
}
export declare class CartoonizeService {
    private openaiApiKey;
    constructor();
    processCartoonize(options: CartoonizeOptions): Promise<CartoonizeResult>;
    isHealthy(): boolean;
}
export declare const cartoonizeService: CartoonizeService;
export default cartoonizeService;
