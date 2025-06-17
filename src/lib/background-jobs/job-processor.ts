import { jobManager } from './job-manager.js';
import { JobData, JobType, StorybookJobData, AutoStoryJobData, SceneJobData, CartoonizeJobData, ImageJobData } from '../types.js';
import { cartoonizeService } from '../services/cartoonize-service.js';
import { characterService } from '../services/character-service.js';
import { storyService } from '../services/story-service.js';
import { sceneService } from '../services/scene-service.js';
import { imageService } from '../services/image-service.js';
import { storybookService } from '../services/storybook-service.js';

class BackgroundJobProcessor {
  private isProcessing = false;
  private maxConcurrentJobs = 3;
  private currentlyProcessing = new Set<string>();

  constructor() {
    console.log('🔧 Background job processor initialized');
  }

  // Main processing function - processes one step at a time
  async processNextJobStep(): Promise<boolean> {
    if (this.isProcessing || this.currentlyProcessing.size >= this.maxConcurrentJobs) {
      return false;
    }

    this.isProcessing = true;
    let processedAny = false;

    try {
      // Get pending jobs
      const pendingJobs = await jobManager.getPendingJobs({}, 10);
      
      for (const job of pendingJobs) {
        if (this.currentlyProcessing.has(job.id)) {
          continue; // Skip if already processing
        }

        if (this.currentlyProcessing.size >= this.
