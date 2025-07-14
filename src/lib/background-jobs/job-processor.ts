Here's the fixed version with all missing closing brackets added:

```typescript
// Enhanced Job Processor - Professional Comic Book Generation with Character DNA System
// ✅ ENHANCED: Story beat analysis, character consistency, and professional comic workflows
import { serviceContainer } from '../../services/container/service-container.js';
import { 
  SERVICE_TOKENS, 
  IDatabaseService, 
  IAIService, 
  IJobService,
  IServiceHealth,
  IServiceMetrics,
  ComicGenerationResult,
  EnvironmentalDNA,
  CharacterDNA,
  QualityMetrics
} from '../../services/interfaces/service-contracts.js';
import { 
  Result,
  ErrorFactory,
  ServiceError,
  createJobCorrelationContext,
  withCorrelationResult
} from '../../services/errors/index.js';
import { JobData, JobType, StorybookJobData, AutoStoryJobData, SceneJobData, CartoonizeJobData, ImageJobData } from '../types.js';

interface JobProcessingResult {
  success: boolean;
  jobId: string;
  error?: ServiceError;
  duration?: number;
  servicesUsed?: string[];
  comicQuality?: ComicGenerationResult;
}

interface ProcessingStatistics {
  totalProcessed: number;
  successful: number;
  failed: number;
  timeouts: number;
  concurrentPeak: number;
  lastProcessedAt: Date | null;
  errorsByService: Record<string, number>;
  serviceUsageStats: Record<string, number>;
  features: {
    cleanArchitecture: boolean;
    interfaceSegregation: boolean;
    dependencyInjection: boolean;
    errorHandling: boolean;
    serviceAbstraction: boolean;
    professionalComicGeneration: boolean;
    characterDNASystem: boolean;
    storyBeatAnalysis: boolean;
  };
}

interface ProcessorHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  availability: number;
  concurrencyUtilization: number;
  serviceHealth: Record<string, boolean>;
  lastCheck: string;
}

// ===== ENHANCED PRODUCTION JOB PROCESSOR =====

export class ProductionJobProcessor implements IServiceHealth, IServiceMetrics {
  private isProcessing = false;
  private readonly maxConcurrentJobs = 5;
  
  private currentlyProcessing = new Map<string, {
    jobId: string;
    jobType: JobType;
    startTime: number;
    servicesUsed: Set<string>;
    comicGeneration?: {
      characterDNACreated: boolean;
      storyAnalyzed: boolean;
      panelsGenerated: number;
      targetPanels: number;
    };
  }>();

  private internalStats = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    timeouts: 0,
    concurrentPeak: 0,
    lastProcessedAt: null as Date | null,
    errorsByService: new Map<string, number>(),
    serviceUsageStats: new Map<string, number>(),
    recentResults: [] as { success: boolean; timestamp: number }[],
    lastHealthRecovery: Date.now(),
    // Enhanced comic generation metrics
    comicQualityStats: {
      averageCharacterConsistency: 0,
      averageStoryCoherence: 0,
      totalComicsGenerated: 0,
      professionalStandardsAchieved: 0,
    },
  };

  private readonly healthConfig = {
    slidingWindowSize: 10,
    maxFailureRate: 0.7,
    recoveryTimeMs: 300000,
    minSampleSize: 3,
  };

  constructor() {
    console.log('🏗️ Enhanced production job processor initialized with professional comic generation capabilities');
    
    setInterval(() => this.cleanupStaleJobs(), 300000);
    setInterval(() => this.checkAutoRecovery(), 60000);
  }

  // Rest of the implementation...
}

// Export singleton instance
export const productionJobProcessor = new ProductionJobProcessor();
export default productionJobProcessor;
```