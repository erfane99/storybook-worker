// Shared type definitions for the worker service - DATABASE-FIRST APPROACH
// Types now match actual database schema exactly for ALL job types

export type JobType = 'storybook' | 'auto-story' | 'scenes' | 'cartoonize' | 'image-generation' | 'character-description';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type AudienceType = 'children' | 'young adults' | 'adults';
export type CharacterArtStyle = 'storybook' | 'comic-book' | 'anime' | 'semi-realistic' | 'cartoon';
export type LayoutType = 'comic-book-panels' | 'individual-scenes';
export type GenreType = 'adventure' | 'fantasy' | 'mystery' | 'comedy' | 'friendship' | 'courage' | 'nature' | 'creativity' | 'sports' | 'siblings' | 'bedtime' | 'history';

// ===== MULTI-CHARACTER SUPPORT TYPES =====

/**
 * Character age categories with associated age ranges
 */
export type CharacterAge = 'toddler' | 'child' | 'teen' | 'young-adult' | 'adult' | 'senior';

/**
 * Character gender options for visual rendering
 */
export type CharacterGender = 'boy' | 'girl' | 'man' | 'woman' | 'non-binary';

/**
 * Character role in the story
 * - main: The cartoonized character (appears in 80%+ of panels)
 * - secondary: Described character (rendered by AI based on description)
 */
export type CharacterRole = 'main' | 'secondary';

/**
 * Relationship types between characters
 */
export type CharacterRelationship = 
  | 'sibling' 
  | 'parent' 
  | 'grandparent' 
  | 'friend' 
  | 'cousin' 
  | 'pet' 
  | 'teacher' 
  | 'neighbor';

/**
 * Hair color options for secondary characters
 */
export type HairColor = 'black' | 'brown' | 'blonde' | 'red' | 'gray' | 'white';

/**
 * Eye color options for secondary characters
 */
export type EyeColor = 'brown' | 'blue' | 'green' | 'hazel' | 'gray';

/**
 * Complete story character definition
 * Used for both main (cartoonized) and secondary (described) characters
 */
export interface StoryCharacter {
  /** Unique identifier (UUID) */
  id: string;
  
  /** Required: Character name (used in story generation) */
  name: string;
  
  /** Required: Character age category */
  age: CharacterAge;
  
  /** Required: Character role in the story */
  role: CharacterRole;
  
  /** Required: Character gender for visual rendering */
  gender: CharacterGender;
  
  /** Optional: Relationship to main character (for secondary characters) */
  relationship?: CharacterRelationship;
  
  /** Optional: Hair color for secondary character descriptions */
  hairColor?: HairColor;
  
  /** Optional: Eye color for secondary character descriptions */
  eyeColor?: EyeColor;
  
  /** Only for main character: URL of the cartoonized image */
  cartoonImageUrl?: string;
  
  /** Only for main character: AI-generated character description from cartoonization */
  characterDescription?: string;
}

/**
 * Age description mapping for prompts
 */
export const AGE_DESCRIPTIONS: Record<CharacterAge, string> = {
  'toddler': 'toddler (1-3 years old, very small, chubby cheeks)',
  'child': 'child (4-10 years old, small stature)',
  'teen': 'teenager (11-17 years old, growing, youthful)',
  'young-adult': 'young adult (18-25 years old)',
  'adult': 'adult (26-55 years old)',
  'senior': 'senior (55+ years old, may have gray hair, wrinkles)'
};

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
  title: string;                    // matches database column (NOT NULL)
  story: string;                    // matches database column (NOT NULL)
  character_image: string;          // matches database column (NOT NULL)
  pages: any[];                     // matches database column (jsonb, NOT NULL)
  audience?: AudienceType;          // matches database column
  is_reused_image?: boolean;        // matches database column
  character_description?: string;   // matches database column
  character_art_style?: CharacterArtStyle; // matches database column
  layout_type?: LayoutType;         // matches database column
  processed_pages?: any[];          // matches database column (jsonb)
  storybook_entry_id?: string;      // matches database column
  characters?: StoryCharacter[];    // NEW: Multi-character support (jsonb)
}

// ✅ DATABASE-FIRST: Auto-story job matches actual database schema
export interface AutoStoryJobData extends BaseJobData {
  type: 'auto-story';
  // Individual database columns from auto_story_jobs table
  genre: GenreType;                 // matches database column (NOT NULL) - FIXED: typed as GenreType
  character_description: string;    // matches database column (NOT NULL)
  cartoon_image_url: string;        // matches database column (NOT NULL)
  audience?: AudienceType;          // matches database column
  generated_story?: string;         // matches database column (result field)
  generated_scenes?: any[];         // matches database column (jsonb, result field)
  storybook_entry_id?: string;      // matches database column
  character_art_style?: CharacterArtStyle; // matches database column
  layout_type?: LayoutType;         // matches database column
  characters?: StoryCharacter[];    // NEW: Multi-character support (jsonb)
}

// ✅ DATABASE-FIRST: Scene job matches actual database schema  
export interface SceneJobData extends BaseJobData {
  type: 'scenes';
  // Individual database columns from scene_generation_jobs table
  story: string;                    // matches database column (NOT NULL)
  character_image?: string;         // matches database column
  audience?: AudienceType;          // matches database column
  character_description?: string;   // matches database column
  generated_pages?: any[];          // matches database column (jsonb, result field)
}

// ✅ DATABASE-FIRST: Cartoonize job matches actual database schema
export interface CartoonizeJobData extends BaseJobData {
  type: 'cartoonize';
  // Individual database columns from cartoonize_jobs table
  original_image_data?: string;        // matches database column
  style?: string;                      // matches database column
  original_cloudinary_url?: string;    // matches database column
  generated_image_url?: string;        // matches database column (result field)
  final_cloudinary_url?: string;       // matches database column (result field)
}

// ✅ DATABASE-FIRST: Image generation job matches actual database schema
export interface ImageJobData extends BaseJobData {
  type: 'image-generation';
  // Individual database columns from image_generation_jobs table
  image_prompt: string;             // matches database column (NOT NULL)
  character_description: string;    // matches database column (NOT NULL)
  emotion: string;                  // matches database column (NOT NULL)
  audience?: AudienceType;          // matches database column
  is_reused_image?: boolean;        // matches database column
  cartoon_image?: string;           // matches database column
  style?: string;                   // matches database column
  generated_image_url?: string;     // matches database column (result field)
  final_prompt_used?: string;       // matches database column (result field)
}

export interface CharacterDescriptionJobData extends BaseJobData {
  type: 'character-description';
  image_url: string;
  analysis_type?: string;
  include_personality?: boolean;
  include_clothing?: boolean;
  include_background?: boolean;
  character_description?: string;
}

export type JobData = StorybookJobData | AutoStoryJobData | SceneJobData | CartoonizeJobData | ImageJobData | CharacterDescriptionJobData;

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
  generated_story?: string;
  generated_scenes?: any[];
  generated_pages?: any[];
  generated_image_url?: string;
  final_cloudinary_url?: string;
  final_prompt_used?: string;
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
  characters?: StoryCharacter[];    // NEW: Multi-character support
}

export interface AutoStoryCreationOptions {
  genre: string;
  characterDescription: string;
  cartoonImageUrl: string;
  audience: AudienceType;
  userId?: string;
  characterArtStyle?: CharacterArtStyle;
  layoutType?: LayoutType;
  characters?: StoryCharacter[];    // NEW: Multi-character support
}

export interface SceneGenerationOptions {
  story: string;
  characterImage?: string;
  audience: AudienceType;
  characterDescription?: string;
}

export interface ImageGenerationOptions {
  image_prompt: string;
  character_description: string;
  emotion: string;
  audience: AudienceType;
  isReusedImage?: boolean;
  cartoon_image?: string;
  style?: string;
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