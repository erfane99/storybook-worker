// Shared type definitions for the worker service

export type JobType = 'storybook' | 'auto-story' | 'scenes' | 'cartoonize' | 'image-generation';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface JobData {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  current_step?: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  input_data?: Record<string, any>;
  result_data?: Record<string, any>;
}

export interface JobFilter {
  user_id?: string;
  status?: JobStatus;
  type?: JobType;
  limit?: number;
}

export interface JobUpdateData {
  status?: JobStatus;
  progress?: number;
  current_step?: string;
  error_message?: string;
  result_data?: Record<string, any>;
}

// Specific job data interfaces
export interface StorybookJobData extends JobData {
  type: 'storybook';
  input_data: {
    title: string;
    story: string;
    characterImage: string;
    pages: any[];
    audience: string;
    isReusedImage?: boolean;
  };
  result_data?: {
    storybook_id: string;
    pages: any[];
    has_errors: boolean;
    warning?: string;
  };
}

export interface AutoStoryJobData extends JobData {
  type: 'auto-story';
  input_data: {
    genre: string;
    characterDescription: string;
    cartoonImageUrl: string;
    audience: string;
  };
  result_data?: {
    storybook_id: string;
    generated_story: string;
  };
}

export interface SceneJobData extends JobData {
  type: 'scenes';
  input_data: {
    story: string;
    characterImage: string;
    audience: string;
  };
  result_data?: {
    pages: any[];
    character_description: string;
  };
}

export interface CartoonizeJobData extends JobData {
  type: 'cartoonize';
  input_data: {
    prompt: string;
    style: string;
    imageUrl?: string;
  };
  result_data?: {
    url: string;
    cached: boolean;
  };
}

export interface ImageJobData extends JobData {
  type: 'image-generation';
  input_data: {
    image_prompt: string;
    character_description: string;
    emotion: string;
    audience: string;
    isReusedImage: boolean;
    cartoon_image: string;
    style: string;
  };
  result_data?: {
    url: string;
    prompt_used: string;
    reused: boolean;
  };
}

// Cartoonize service types
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

// Worker configuration types
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
}
