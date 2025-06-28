// Shared type definitions for the worker service - DATABASE-FIRST APPROACH
// Types now match actual database schema exactly for ACTIVE job types only

export type JobType = 'storybook' | 'cartoonize'; // Only active job types
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type AudienceType = 'children' | 'young_adults' | 'adults';
export type CharacterArtStyle = 'storybook' | 'comic-book' | 'anime' | 'semi-realistic' | 'cartoon';
export type LayoutType = 'comic-book-panels' | 'individual-scenes';

// ✅ DATABASE-FIRST: Base job structure matches actual database columns
export interface BaseJobData {
  id: string;
  user_id?: string;
  status: JobStatus;
  progress: number; // 0-100
  current_step?: string;
  total_steps?: number;
  error_message?: string;
  has_errors?: boolean;
  retry_count: number;
  max_retries: number;
  started_at?: string;
  completed_at?: string;
  estimated_completion_at?: string;
  created_at: string;
  updated_at: string;
}

// ✅ DATABASE-FIRST: Storybook job matches actual database schema
export interface StorybookJobData extends BaseJobData {
  type: 'storybook';
  // Individual database columns (NOT input_data)
  title: string;                    // matches database column
  story: string;                    // matches database column  
  character_image?: string;         // matches database column (OPTIONAL)
  pages: any[];                     // matches database column (jsonb)
  audience?: AudienceType;          // matches database column
  is_reused_image?: boolean;        // matches database column
  character_description?: string;   // matches database column
  character_art_style?: CharacterArtStyle; // matches database column
  layout_type?: LayoutType;         // matches database column
  processed_pages?: any[];          // matches database column (jsonb)
  storybook_entry_id?: string;      // matches database column
}

// ✅ DATABASE-FIRST: Cartoonize job matches EXACT database schema
export interface CartoonizeJobData extends BaseJobData {
  type: 'cartoonize';
  // Individual database columns matching your exact schema
  original_image_data?: string;        // matches database column
  style?: string;                      // matches database column
  original_cloudinary_url?: string;    // matches database column
  generated_image_url?: string;        // matches database column
  final_cloudinary_url?: string;       // matches database column
}

// Union type for active job types only
export type JobData = StorybookJobData | CartoonizeJobData;

export interface JobFilter {
  user_id?: string;
  type?: JobType;
  status?: JobStatus;
  limit?: number;
  offset?: number;
}

// ✅ DATABASE-FIRST: Job update data for database operations
export interface JobUpdateData {
  status?: JobStatus;
  progress?: number;
  current_step?: string;
  error_message?: string;
  result_data?: any;
  started_at?: string;
  completed_at?: string;
  updated_at?: string;
  retry_count?: number;
  has_errors?: boolean;
  processed_pages?: any[];
  storybook_entry_id?: string;
  generated_image_url?: string;
  final_cloudinary_url?: string;
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

// ✅ DATABASE-FIRST: Service interface types match database structure
export interface StorybookCreationOptions {
  title: string;
  story: string;
  characterImage: string;
  pages: any[];
  audience: AudienceType;
  isReusedImage?: boolean;
  userId?: string;
  characterArtStyle?: CharacterArtStyle;
  layoutType?: LayoutType;
}

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

// ✅ DATABASE-FIRST: Comic book types for processed data
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