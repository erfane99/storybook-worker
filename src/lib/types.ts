// Shared type definitions for the worker service - matches backend exactly with comic book support
export type JobType = 'storybook' | 'auto-story' | 'scenes' | 'cartoonize' | 'image-generation';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type AudienceType = 'children' | 'young_adults' | 'adults';
export type CharacterArtStyle = 'storybook' | 'comic-book' | 'anime' | 'semi-realistic' | 'cartoon';
export type LayoutType = 'comic-book-panels' | 'individual-scenes';

export interface BaseJobData {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number; // 0-100
  current_step?: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  input_data: any;
  result_data?: any;
}

// ENHANCED: Storybook generation job with comic book support
export interface StorybookJobData extends BaseJobData {
  type: 'storybook';
  input_data: {
    title: string;
    story: string;
    characterImage: string;
    pages: any[];
    audience: AudienceType;
    isReusedImage?: boolean;
    characterArtStyle?: CharacterArtStyle; // NEW: Character art style
    layoutType?: LayoutType; // NEW: Layout type
  };
  result_data?: {
    storybook_id: string;
    pages: any[];
    has_errors: boolean;
    warning?: string;
    character_art_style?: CharacterArtStyle; // NEW: Result includes art style
    layout_type?: LayoutType; // NEW: Result includes layout type
  };
}

// ENHANCED: Auto-story generation job with comic book support
export interface AutoStoryJobData extends BaseJobData {
  type: 'auto-story';
  input_data: {
    genre: string;
    characterDescription: string;
    cartoonImageUrl: string;
    audience: AudienceType;
    characterArtStyle?: CharacterArtStyle; // NEW: Character art style
    layoutType?: LayoutType; // NEW: Layout type
  };
  result_data?: {
    storybook_id: string;
    generated_story: string;
    character_art_style?: CharacterArtStyle; // NEW: Result includes art style
    layout_type?: LayoutType; // NEW: Result includes layout type
  };
}

// ENHANCED: Scene generation job with comic book support
export interface SceneJobData extends BaseJobData {
  type: 'scenes';
  input_data: {
    story: string;
    characterImage: string;
    audience: AudienceType;
    characterArtStyle?: CharacterArtStyle; // NEW: Character art style
    layoutType?: LayoutType; // NEW: Layout type
  };
  result_data?: {
    pages: any[];
    character_description?: string;
    character_art_style?: CharacterArtStyle; // NEW: Result includes art style
    layout_type?: LayoutType; // NEW: Result includes layout type
  };
}

// ENHANCED: Image cartoonization job with style tracking
export interface CartoonizeJobData extends BaseJobData {
  type: 'cartoonize';
  input_data: {
    prompt: string;
    style: string;
    imageUrl?: string;
  };
  result_data?: {
    url: string;
    cached: boolean;
    style?: string; // NEW: Track style in result
  };
}

// ENHANCED: Single image generation job with comic book support
export interface ImageJobData extends BaseJobData {
  type: 'image-generation';
  input_data: {
    image_prompt: string;
    character_description: string;
    emotion: string;
    audience: AudienceType;
    isReusedImage?: boolean;
    cartoon_image?: string;
    style?: string;
    characterArtStyle?: CharacterArtStyle; // NEW: Character art style
    layoutType?: LayoutType; // NEW: Layout type (usually individual for single images)
  };
  result_data?: {
    url: string;
    prompt_used: string;
    reused: boolean;
    character_art_style?: CharacterArtStyle; // NEW: Result includes art style
    layout_type?: LayoutType; // NEW: Result includes layout type
  };
}

export type JobData = StorybookJobData | AutoStoryJobData | SceneJobData | CartoonizeJobData | ImageJobData;

export interface JobFilter {
  user_id?: string;
  type?: JobType;
  status?: JobStatus;
  limit?: number;
  offset?: number;
}

// Fixed JobUpdateData interface with all required properties
export interface JobUpdateData {
  status?: JobStatus;
  progress?: number;
  current_step?: string;
  error_message?: string;
  result_data?: any;
  started_at?: string;
  completed_at?: string;
  updated_at?: string;
  retry_count?: number; // ✅ This was missing - causing the TypeScript error!
}

// Job metrics interface
export interface JobMetrics {
  totalJobs: number;
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  successRate: number;
}

// ENHANCED: Service interface types with comic book support
export interface StorybookCreationOptions {
  title: string;
  story: string;
  characterImage: string;
  pages: any[];
  audience: AudienceType;
  isReusedImage?: boolean;
  userId?: string;
  characterArtStyle?: CharacterArtStyle; // NEW: Character art style
  layoutType?: LayoutType; // NEW: Layout type
}

export interface AutoStoryCreationOptions {
  genre: string;
  characterDescription: string;
  cartoonImageUrl: string;
  audience: AudienceType;
  userId?: string;
  characterArtStyle?: CharacterArtStyle; // NEW: Character art style
  layoutType?: LayoutType; // NEW: Layout type
}

export interface SceneGenerationOptions {
  story: string;
  characterImage: string;
  audience: AudienceType;
  characterArtStyle?: CharacterArtStyle; // NEW: Character art style
  layoutType?: LayoutType; // NEW: Layout type
}

export interface ImageGenerationOptions {
  image_prompt: string;
  character_description: string;
  emotion: string;
  audience: AudienceType;
  isReusedImage?: boolean;
  cartoon_image?: string;
  user_id?: string;
  style?: string;
  characterArtStyle?: CharacterArtStyle; // NEW: Character art style
  layoutType?: LayoutType; // NEW: Layout type
}

// Additional worker-specific types
export interface CartoonizeOptions {
  prompt: string;
  style: string;
  imageUrl?: string;
  userId?: string;
}

export interface CartoonizeResult {
  url: string;
  cached: boolean;
}

export interface WorkerConfig {
  port: number;
  environment: string;
  jobScanInterval: string;
  maxConcurrentJobs: number;
  initialScanDelay: number;
}

export interface JobStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  lastProcessedAt: Date | null;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  service: string;
  version: string;
  timestamp: string;
  environment: string;
  config?: {
    maxConcurrentJobs: number;
    scanInterval: string;
  };
  features?: {
    comicBookSupport: boolean;
    characterConsistency: boolean;
    multiPanelLayouts: boolean;
    variableArtStyles: boolean;
  };
}

// ENHANCED: Comic book specific types
export interface ComicPanelData {
  panel_number: number;
  scene_description: string;
  image_url: string;
  text_overlay?: string;
  character_emotions?: string[];
}

export interface ComicPageData {
  page_number: number;
  panels: ComicPanelData[];
  layout_style: 'two-panel' | 'three-panel' | 'four-panel' | 'six-panel';
  page_title?: string;
}

export interface StorybookResult {
  title: string;
  story: string;
  pages: ComicPageData[];
  audience: AudienceType;
  character_description: string;
  has_errors: boolean;
  warning?: string;
  character_art_style?: CharacterArtStyle;
  layout_type?: LayoutType;
}