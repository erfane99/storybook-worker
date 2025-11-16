// Service contracts implementing Interface Segregation Principle
// CONSOLIDATED: Single source of truth for all service interfaces
// Combines enhanced functionality with standard interfaces
// ✅ FIXED: Updated to match enterprise AI service implementation

// ===== TYPE IMPORTS FOR RESULT PATTERN ★
import type {
  AsyncResult,
  Success,
  Failure,
  ServiceError,
  BaseServiceError,
  AIServiceUnavailableError,
  ErrorCategory,
  ErrorSeverity
} from '../errors/index.js';

// ===== IMPORT AND RE-EXPORT JOB TYPES =====
import type { JobData, JobType, JobStatus, JobMetrics } from '../../lib/types';

// Re-export job types so other modules can import them from here
export type { JobData, JobType, JobStatus, JobMetrics };

// ===== CANONICAL Result-union ALIAS ★
export type AIAsyncResult<
  T,
  E = AIServiceUnavailableError,
> = AsyncResult<T, E extends BaseServiceError ? E : AIServiceUnavailableError>;

// ===== CONSOLIDATED AI SERVICE TYPES - SINGLE SOURCE OF TRUTH =====
export type PanelType = 'standard' | 'wide' | 'tall' | 'splash' | 'establishing' | 'closeup';
export type AudienceType = 'children' | 'young adults' | 'adults';
export type GenreType = 'adventure' | 'siblings' | 'bedtime' | 'fantasy' | 'history';

// ===== MODULAR SYSTEM TYPES (ADDED FROM constants-and-types.ts) =====
export type StoryArchetype = 'hero_journey' | 'redemption' | 'discovery' | 'transformation' | 'mystery' | 'adventure';
export type QualityGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-';
export type SpeechBubbleStyle = 'standard' | 'thought' | 'shout' | 'whisper' | 'narrative' | 'electronic' | 'magical';

// ===== RE-EXPORT ERROR TYPES FROM SINGLE SOURCE OF TRUTH =====
export type { ErrorCategory, ErrorSeverity };

// ===== VISUAL CONSISTENCY VALIDATION INTERFACES =====
export interface ConsistencyScore {
  overallScore: number;
  facialConsistency: number;
  bodyProportionConsistency: number;
  clothingConsistency: number;
  colorPaletteConsistency: number;
  artStyleConsistency: number;
  detailedAnalysis: string;
  failureReasons: string[];
  passesThreshold: boolean;
}

export interface ValidationContext {
  jobId: string;
  panelNumber: number;
  attemptNumber: number;
  generatedImageUrl: string;
  characterDNA: CharacterDNA;
  previousPanelUrl?: string;
}

export interface ValidationResult extends ConsistencyScore {
  validationTimestamp: string;
  attemptNumber: number;
  panelNumber: number;
}

// ===== ENVIRONMENTAL CONSISTENCY VALIDATION INTERFACES =====
export interface EnvironmentalConsistencyReport {
  overallCoherence: number;
  panelScores: Array<{
    panelNumber: number;
    locationConsistency: number;
    lightingConsistency: number;
    colorPaletteConsistency: number;
    architecturalStyleConsistency: number;
    atmosphericConsistency: number;
    issues: string[];
  }>;
  crossPanelConsistency: number;
  detailedAnalysis: string;
  passesThreshold: boolean;
  failureReasons: string[];
}

// ===== VISUAL DNA INTERFACES =====
export interface VisualFingerprint {
  face: string;
  body: string;
  clothing: string;
  signature: string;
  colorDNA: string;
  artStyleSignature: string;
}

export interface NarrativeIntelligence {
  storyArchetype: StoryArchetype;
  emotionalArc: string[];
  thematicElements: string[];
  pacingStrategy: 'slow_build' | 'action_packed' | 'emotional_depth' | 'mystery_reveal';
  characterGrowth: string[];
  conflictProgression: string[];
  confidence?: number;
  alternativeArchetypes?: string[];
  audienceAlignment?: number;
  universalAppeal?: number;
  reasoningFactors?: string[];
}

// ===== MISSING INTERFACES NEEDED BY MODULAR SYSTEM =====
export interface ComicPage {
  pageNumber: number;
  scenes: ComicPanel[];
  layoutType: string;
  characterArtStyle: string;
  panelCount: number;
  dialoguePanels: number;
  environmentalTheme: string;
  professionalQuality: boolean;
}

export interface ComicPanel {
  description: string;
  emotion: string;
  imagePrompt: string;
  panelType: PanelType;
  characterAction: string;
  narrativePurpose: string;
  visualPriority: string;
  dialogue?: string;
  hasSpeechBubble: boolean;
  speechBubbleStyle?: string;
  panelNumber: number;
  pageNumber: number;
  environmentalContext?: string;
  professionalStandards: boolean;
  // Enhanced properties for Character DNA system
  generatedImage?: string | null;
  imageGenerated?: boolean;
  characterDNAUsed?: boolean;
  environmentalDNAUsed?: boolean;
  imageGenerationError?: string;
  characterConsistency?: number;
  environmentalConsistency?: number;
}

export interface GenerationMetadata {
  discoveryPath: string;
  patternType: 'direct' | 'nested' | 'discovered' | 'fallback' | 'optimized';
  qualityScore: number;
  originalStructure: string[];
  storyBeats: number;
  characterConsistencyEnabled: boolean;
  environmentalConsistencyEnabled?: boolean;
  professionalStandards: boolean;
  dialoguePanels: number;
  speechBubbleDistribution: Record<string, number>;
  promptOptimization?: string;
  visualFingerprintingUsed?: boolean;
  narrativeIntelligenceApplied?: boolean;
  qualityAssessmentEnabled?: boolean;
  [key: string]: any;
}

export interface SceneMetadata extends GenerationMetadata {}

// ===== ENHANCED AI SERVICE CONFIG =====
export interface AIServiceConfig {
  // Base service properties
  name: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  circuitBreakerThreshold: number;
  
  // AI-specific properties
  maxTokens?: number;
  temperature?: number;
  model?: string;
  imageModel?: string;
  maxRetries?: number;
  rateLimitPerMinute?: number;
  enableAdvancedNarrative?: boolean;
  enableVisualDNAFingerprinting?: boolean;
  enablePredictiveQuality?: boolean;
  enableCrossGenreLearning?: boolean;
  
  // Error handling config
  errorHandling?: {
    enableRetry?: boolean;
    maxRetries?: number;
    enableCircuitBreaker?: boolean;
    enableCorrelation?: boolean;
    enableMetrics?: boolean;
    retryableCategories?: ErrorCategory[];
  };
}

// ===== CIRCUIT BREAKER AND MONITORING =====
export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
  threshold: number;
  timeout: number;
  successCount: number;
}

export interface ServiceRegistration {
  serviceId: string;
  name: string;
  version: string;
  capabilities: string[];
  healthEndpoint: string;
  metricsEndpoint: string;
  registrationTime: string;
  lastHeartbeat: string;
  status: 'active' | 'inactive' | 'degraded';
}

export interface MetricsCollector {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  circuitBreakerTrips: number;
  lastRequestTime: string;
  operationCounts: Map<string, number>;
  operationTimes: Map<string, number[]>;
  errorCounts: Map<string, number>;
  systemHealth: Array<{
    timestamp: string;
    status: boolean;
    details: any;
  }>;
  qualityScores: number[];
  userSatisfactionScores: number[];
}

export interface ErrorClassification {
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoveryStrategy: string;
  userMessage: string;
  isRetryable: boolean;
  estimatedRecoveryTime?: number;
}

// ===== COMPREHENSIVE METRICS =====
export interface ComprehensiveMetrics {
  timestamp: string;
  serviceInfo: {
    name: string;
    version: string;
    codename: string;
    uptime: string;
    status: string;
    features: number;
    capabilities: number;
  };
  operations: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageResponseTime: number;
    operationsPerMinute: number;
    operationCounts: { [key: string]: number };
    errorCounts: { [key: string]: number };
    operationTimes: { [key: string]: number[] };
  };
  quality: {
    averageScore: number;
    gradeDistribution: any;
    qualityTrend: string;
    userSatisfaction: number;
    scoreDistribution: any;
    totalAssessments: number;
    recentQualityScore: number;
    averageUserSatisfaction: number;
  };
  system: {
    memoryUsage: string;
    activeConnections: number;
    circuitBreakers: number;
    cacheHitRate: number;
    healthChecks: number;
    lastHealthCheck: any;
    healthTrend: string;
    activePatterns: number;
    learningEngineStatus: string;
    performanceScore: number;
  };
  advanced: {
    narrativeIntelligence: {
      archetypesLoaded: number;
      status: string;
      effectiveness: number;
    };
    visualDNAFingerprinting: {
      cacheSize: number;
      hitRate: number;
      compressionEfficiency: number;
      status: string;
    };
    selfLearningEngine: {
      patternsStored: number;
      evolutionCount: number;
      learningEffectiveness: number;
      status: string;
    };
    qualityAssessment: {
      metricsTracked: number;
      averageGrade: string;
      improvementRate: number;
      status: string;
    };
  };
  performance: {
    overallScore: number;
    trend: string;
    recommendations: string[];
  };
  enterprise: {
    complianceScore: number;
    reliabilityRating: number;
    scalabilityIndex: number;
    maintenanceHealth: number;
  };
}

// ===== CHARACTER DESCRIPTION INTERFACES =====
export interface CharacterDescriptionOptions {
  imageUrl: string;
  style?: string;
}

export interface CharacterDescriptionResult {
  description: string;
  cached: boolean;
}

// ===== STORY GENERATION INTERFACES =====
export interface StoryGenerationOptions {
  genre?: GenreType;
  characterDescription?: string;
  audience?: AudienceType;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface StoryGenerationResult {
  story: string;
  title: string;
  wordCount: number;
}

// ===== ENHANCED CHARACTER DNA =====
export interface CharacterDNA {
  sourceImage: string;
  description: string;
  artStyle: string;
  visualDNA: {
    facialFeatures: string[];
    bodyType: string;
    clothing: string;
    distinctiveFeatures: string[];
    colorPalette: string[];
    expressionBaseline: string;
  };
  consistencyPrompts: {
    basePrompt: string;
    artStyleIntegration: string;
    variationGuidance: string;
  };
  consistencyChecklist?: string[];
  metadata: {
    createdAt: string;
    processingTime: number;
    analysisMethod: string;
    confidenceScore: number;
    artStyleOptimized?: string;
    fingerprintGenerated?: boolean;
    qualityScore?: number;
    compressionApplied?: boolean;
  };
  visualFingerprint?: VisualFingerprint;
  facialFeatures?: string[];
  bodyCharacteristics?: string;
  clothingSignature?: string;
  colorPalette?: string[];
  artStyleAdaptation?: string;
  consistencyMarkers?: string[];
}

// ===== ENHANCED ENVIRONMENTAL DNA =====
export interface EnvironmentalDNA {
  primaryLocation: {
    name: string;
    type: 'indoor' | 'outdoor' | 'mixed';
    description: string;
    keyFeatures: string[];
    colorPalette?: string[];
    architecturalStyle?: string;
    characteristics?: string[];
    visualElements?: string[];
  };
  lightingContext: {
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    weatherCondition: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'pleasant';
    lightingMood: string;
    shadowDirection?: string;
    consistencyRules?: string[];
  };
  visualContinuity: {
    backgroundElements: string[];
    recurringObjects?: string[];
    colorConsistency: {
      dominantColors: string[];
      accentColors: string[];
      avoidColors?: string[];
    };
    perspectiveGuidelines?: string;
    transitionElements?: string[];
    styleConsistency?: string;
  };
  atmosphericElements?: string[] | {
    ambientEffects?: string[];
    particleEffects?: string[];
    environmentalMood?: string;
    seasonalContext?: string;
  };
  panelTransitions?: string[] | {
    movementFlow?: string;
    cameraMovement?: string;
    spatialRelationships?: string;
  };
  metadata?: {
    createdAt: string;
    processingTime: number;
    audience: AudienceType;
    consistencyTarget: string;
    fallback?: boolean;
  };
  error?: string;
  atmosphericConditions?: string[];
  colorScheme?: string;
  lightingConditions?: string;
  spatialRelationships?: string[];
  consistencyMarkers?: string[];
  environmentalFlow?: string;
}

// ===== STORY CONTEXT FOR CONTINUITY =====
export interface StoryContext {
  storyBeats: StoryBeat[];
  environmentalDNA: EnvironmentalDNA;
  narrativeFlow: {
    currentBeat: number;
    previousSceneContext?: string;
    nextSceneHint?: string;
    emotionalArc: string[];
  };
  characterDevelopment: {
    emotionalState: string;
    relationships: Record<string, string>;
    growth: string[];
  };
}

// ===== ENHANCED SCENE OPTIONS WITH DNA =====
export interface EnhancedSceneGenerationOptions extends SceneGenerationOptions {
  characterDNA?: CharacterDNA;
  storyContext?: StoryContext;
  previousSceneImage?: string;
  enforceConsistency?: boolean;
}

// ===== JOB PROCESSING CONTEXT =====
export interface JobProcessingContext {
  jobId: string;
  userId: string;
  characterDNA?: CharacterDNA;
  storyContext?: StoryContext;
  visualFingerprint?: string;
  consistencyScore?: number;
}

// ===== ENHANCED STORY BEAT =====
export interface StoryBeat {
  beat: string;
  emotion: string;
  visualPriority: string;
  panelPurpose: string;
  narrativeFunction: string;
  characterAction: string;
  environment: string;
  dialogue?: string;
  hasSpeechBubble?: boolean;
  speechBubbleStyle?: string;
  cleanedDialogue?: string;
  previousBeatContext?: string;
  previousBeatSummary?: string;
  [key: string]: any;
}

// ===== ENHANCED STORY ANALYSIS =====
export interface StoryAnalysis {
  storyBeats: StoryBeat[];
  characterArc: string[];
  visualFlow: string[];
  totalPanels: number;
  pagesRequired: number;
  dialoguePanels?: number;
  speechBubbleDistribution?: Record<string, number>;
  storyArchetype?: string;
  emotionalArc?: string[];
  thematicElements?: string[];
  narrativeIntelligence?: {
    archetypeApplied: string;
    pacingStrategy: string;
    characterGrowthIntegrated: boolean;
  };
  cinematicQuality?: boolean;
}

// ===== ENHANCED QUALITY METRICS =====
export interface QualityMetrics {
  characterConsistency: number;
  narrativeCoherence: number;
  visualQuality: number;
  emotionalResonance: number;
  technicalExecution: number;
  audienceAlignment: number;
  dialogueEffectiveness: number;
  environmentalCoherence?: number;
  storyCoherence?: number;
  panelCount: number;
  professionalStandards: boolean;
  environmentalDNAUsed?: boolean;
  enhancedContextUsed?: boolean;
  parallelProcessed?: boolean;
  parallelDuration?: number;
  successfulPanels?: number;
  performanceGain?: number;
  overallScore: number;
  grade?: string;
  professionalGrade?: string;
  recommendations: string[];
  timestamp?: string;
  audience?: AudienceType;
  artStyle?: string;
  detailedAnalysis?: {
    strengths: string[];
    improvements: string[];
    recommendations: string[];
  };
  // Automated Quality Scoring (0-100)
  automatedScores?: {
    characterConsistencyScore: number;
    environmentalCoherenceScore: number;
    narrativeFlowScore: number;
    overallTechnicalQuality: number;
    qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    analysisDetails: {
      characterFeatureVariance: number;
      backgroundConsistencyRate: number;
      storyProgressionQuality: number;
      panelTransitionSmoothing: number;
    };
  };
  // Performance Metrics
  generationMetrics?: {
    totalGenerationTime: number;
    averageTimePerPanel: number;
    apiCallsUsed: number;
    costEfficiency: number;
  };
}
// ===== ADDITIONAL MODULAR INTERFACES =====
export interface ThematicAnalysis {
  primaryThemes: string[];
  secondaryThemes: string[];
  universalAppeal: number;
  audienceAlignment: number;
  emotionalResonance: number;
}

export interface ArchetypeDetectionResult {
  primaryArchetype: StoryArchetype;
  confidence: number;
  alternativeArchetypes: string[];
  reasoningFactors: string[];
}

export interface StoryAnalysisContext {
  totalPanels: number;
  pagesPerStory: number;
  panelsPerPage: number;
  complexity: string;
  narrativeDepth: string;
  speechBubbleRatio: number;
}

export interface EmotionalProgression {
  startEmotion: string;
  midEmotion: string;
  endEmotion: string;
  progression: string[];
}

export interface CharacterGrowthPattern {
  initial: string;
  development: string[];
  final: string;
}

export interface PatternEvolutionResult {
  originalContext: any;
  evolvedPrompts: any;
  improvementRationale: string;
  patternsApplied: LearningPattern[];
  contextMatch: {
    similarity: number;
    matchingFactors: string[];
    adaptationRequired: string[];
  };
  expectedImprovements: {
    characterConsistency: number;
    environmentalCoherence: number;
    narrativeFlow: number;
    userSatisfaction: number;
  };
  confidenceScore: number;
}

export interface PatternLearningConfig {
  enableSelfLearning: boolean;
  patternStorageLimit: number;
  evolutionThreshold: number;
  effectivenessThreshold: number;
}

export interface QualityEngineConfig {
  enableProfessionalGrading: boolean;
  enableUserSatisfactionTracking: boolean;
  qualityThresholds: {
    excellent: number;
    good: number;
    acceptable: number;
    needsImprovement: number;
  };
}

export interface QualityAssessmentContext {
  characterDNA?: CharacterDNA;
  environmentalDNA?: EnvironmentalDNA;
  storyAnalysis?: StoryAnalysis;
  targetAudience: AudienceType;
  artStyle: string;
}

export interface VisualDNAConfig {
  enableFingerprinting: boolean;
  cacheSize: number;
  compressionLevel: string;
  consistencyThreshold: number;
}

export interface DNAExtractionResult {
  success: boolean;
  dna: any;
  confidence: number;
}

export interface HealthAssessment {
  timestamp: string;
  basicHealth: boolean;
  systemComponents: any;
  performance: any;
  quality: any;
  learning: any;
}

export interface ServiceValidation {
  name: string;
  check: () => boolean;
  passed?: boolean;
  timestamp?: string;
}

export interface EnterpriseMonitoringConfig {
  enableRealTimeMetrics: boolean;
  enableHealthChecking: boolean;
  metricsRetentionDays: number;
}

export interface LearningPattern {
  id: string;
  timestamp: string;
  contextAnalysis: {
    audience: AudienceType;
    artStyle: string;
    storyArchetype: string;
    storyLength: number;
    complexityLevel: 'simple' | 'moderate' | 'complex';
    characterType: string;
    environmentalSetting: string;
  };
  storyPatterns: {
    beatStructure: any[];
    dialogueDistribution: any;
    emotionalProgression: string[];
    narrativeFlow: any;
    panelTypeDistribution: any;
    pacingStrategy: string;
  };
  visualPatterns: {
    characterConsistency: number;
    environmentalCoherence: number;
    compositionPatterns: any[];
    colorHarmony: any;
    visualFlow: any;
    panelTransitions: any;
  };
  engagementMetrics: {
    userRating: number;
    completionRate: number;
    emotionalResonance: number;
    comprehensionLevel: number;
    rereadability: number;
  };
  technicalMetrics: {
    generationTime: number;
    promptEfficiency: number;
    errorRate: number;
    retryCount: number;
    resourceUsage: string;
  };
  successFactors: {
    keyStrengths: string[];
    criticalElements: string[];
    differentiators: string[];
    replicableElements: string[];
  };
  learningMetadata: {
    effectivenessScore: number;
    userSatisfactionScore: number;
    technicalQualityScore: number;
    adaptabilityScore: number;
    contextSimilarity: number;
    evolutionPotential: number;
  };
}

export interface ProfessionalComicStandards {
  gradeLevel: QualityGrade;
  qualityMetrics: {
    characterConsistency: number;
    narrativeCoherence: number;
    visualQuality: number;
    emotionalResonance: number;
    technicalExecution: number;
    audienceAlignment: number;
    dialogueEffectiveness: number;
    environmentalCoherence: number;
  };
  professionalRecommendations: string[];
  panelComposition: 'rule_of_thirds' | 'center_focus' | 'dynamic_diagonal' | 'symmetrical';
  visualHierarchy: 'character_first' | 'environment_first' | 'action_first' | 'emotion_first';
  colorPsychology: 'warm_inviting' | 'cool_mysterious' | 'vibrant_energetic' | 'muted_dramatic';
  readingFlow: 'traditional_lr' | 'manga_rl' | 'dynamic_flow' | 'splash_focus';
  cinematicTechniques: string[];
}

// ===== USER RATING SYSTEM INTERFACES =====
export interface UserRating {
  id: string;
  comicId: string;
  userId: string;
  ratings: {
    characterConsistency: number; // 1-5 stars
    storyFlowNarrative: number;   // 1-5 stars
    artQualityVisualAppeal: number; // 1-5 stars
    sceneBackgroundConsistency: number; // 1-5 stars
    overallComicExperience: number; // 1-5 stars
  };
  averageRating: number; // Calculated average of all ratings
  comment?: string;
  ratingDate: string;
  timeSpentReading?: number; // seconds
  wouldRecommend?: boolean;
}

export interface QualityAnalysisResult {
  comicId: string;
  automatedQuality: QualityMetrics['automatedScores'];
  userRatings?: UserRating[];
  qualitySummary: {
    technicalScore: number; // 0-100 from automated analysis
    userSatisfactionScore: number; // 0-100 from user ratings
    combinedQualityScore: number; // Weighted combination
    qualityTrend: 'improving' | 'stable' | 'declining';
    recommendationsForImprovement: string[];
  };
  benchmarkComparison: {
    aboveAverage: boolean;
    percentileRank: number;
    topPerformingAspects: string[];
    areasForImprovement: string[];
  };
}

export interface QualityTrendData {
  timeframe: string;
  averageScores: {
    technical: number;
    userSatisfaction: number;
    combined: number;
  };
  improvementRate: number;
  totalComicsAnalyzed: number;
  qualityDistribution: {
    excellent: number; // A grade
    good: number;      // B grade
    average: number;   // C grade
    poor: number;      // D grade
    failing: number;   // F grade
  };
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
  characterArtStyle?: string;
  layoutType?: string;
  panelType?: PanelType;
  environmentalContext?: {
    characterDNA?: CharacterDNA;
    environmentalDNA?: EnvironmentalDNA;
    panelNumber?: number;
    totalPanels?: number;
    enforceConsistency?: boolean;
  };
}

export interface ComicGenerationResult {
  success: boolean;
  pages: any[];
  characterDNA?: CharacterDNA;
  environmentalDNA?: EnvironmentalDNA;
  storyAnalysis?: StoryAnalysis;
  qualityMetrics: QualityMetrics;
}

export interface ImageGenerationResult {
  url: string;
  prompt_used: string;
  reused: boolean;
}

// ===== CARTOONIZE INTERFACES =====
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

// ===== SCENE GENERATION INTERFACES =====
export interface SceneGenerationOptions {
  story: string;
  audience?: AudienceType;
  characterImage?: string;
  characterArtStyle?: string;
  layoutType?: string;
  enhancedContext?: any;
}

export interface SceneGenerationResult {
  pages: any[];
  audience: AudienceType;
  characterImage?: string;
  layoutType: string;
  characterArtStyle: string;
  metadata: SceneMetadata;
}

// ===== HEALTH MONITORING INTERFACES =====
export interface IServiceHealth {
  /**
   * Can be sync or async ★
   */
  isHealthy(): boolean | Promise<boolean>;
  
  /**
   * Get health status with meaningful indicators
   */
  getHealthStatus(): ServiceHealthStatus;
}

export interface ServiceHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  lastCheck: string;
  availability: number; // 0-100 percentage
  responseTime?: number; // milliseconds
}

// ===== METRICS INTERFACES =====
export interface IServiceMetrics {
  /**
   * Get performance metrics (computed, not raw internal state)
   */
  getMetrics(): ServiceMetrics;
  
  /**
   * Reset metrics counters
   */
  resetMetrics(): void;
}

export interface ServiceMetrics {
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageResponseTime: number;
  uptime: number;
  lastActivity: string;
}

// ===== LIFECYCLE MANAGEMENT INTERFACES =====
export interface IServiceLifecycle {
  /**
   * Initialize the service
   */
  initialize(): Promise<void>;
  
  /**
   * Gracefully shutdown the service
   */
  dispose(): Promise<void>;
  
  /**
   * Get initialization status
   */
  isInitialized(): boolean;
}

// ===== BUSINESS OPERATION INTERFACES =====
export interface IDatabaseOperations {
  // Job Management
  getPendingJobs(filter?: JobFilter, limit?: number): Promise<JobData[]>;
  getJobStatus(jobId: string): Promise<JobData | null>;
  updateJobProgress(jobId: string, progress: number, currentStep?: string): Promise<boolean>;
  markJobCompleted(jobId: string, resultData: any): Promise<boolean>;
  markJobFailed(jobId: string, errorMessage: string, shouldRetry?: boolean): Promise<boolean>;
  
  // Storybook Management
  saveStorybookEntry(data: StorybookEntryData): Promise<StorybookEntry>;
  getStorybookEntry(id: string): Promise<StorybookEntry | null>;
  
  // Quality Measurement System
  saveQualityMetrics(comicId: string, qualityData: QualityMetrics): Promise<boolean>;
  getQualityMetrics(comicId: string): Promise<QualityMetrics | null>;
  saveUserRating(rating: UserRating): Promise<boolean>;
  getUserRatings(comicId: string): Promise<UserRating[]>;
  getQualityTrends(timeframe: string, limit?: number): Promise<QualityTrendData[]>;
  
  // Success Pattern Learning System
  saveSuccessPattern(pattern: SuccessPattern): Promise<boolean>;
  getSuccessPatterns(
    context: {
      audience?: string;
      genre?: string;
      artStyle?: string;
      environmentalSetting?: string;
      characterType?: string;
    },
    limit?: number
  ): Promise<SuccessPattern[]>;
  updatePatternEffectiveness(
    patternId: string,
    comicId: string,
    effectivenessData: {
      qualityImprovement: any;
      beforeScores: any;
      afterScores: any;
      userSatisfactionImpact: number;
      technicalQualityImpact: number;
      effectivenessRating: number;
    }
  ): Promise<boolean>;
  logPromptEvolution(
    evolutionData: {
      evolutionType: string;
      originalPrompt: string;
      evolvedPrompt: string;
      improvementRationale: string;
      patternsApplied: string[];
      contextMatch: any;
      expectedImprovements: any;
      comicId?: string;
    }
  ): Promise<boolean>;
  getLearningMetrics(): Promise<LearningMetrics>;
  deprecatePattern(patternId: string, reason: string): Promise<boolean>;

  // Validation Result Storage
  savePanelValidationResult(validationData: {
    jobId: string;
    panelNumber: number;
    overallScore: number;
    facialConsistency: number;
    bodyProportionConsistency: number;
    clothingConsistency: number;
    colorPaletteConsistency: number;
    artStyleConsistency: number;
    detailedAnalysis: string;
    failureReasons: string[];
    passesThreshold: boolean;
    attemptNumber: number;
  }): Promise<boolean>;

  saveEnvironmentalValidationResult(validationData: {
    jobId: string;
    pageNumber: number;
    overallCoherence: number;
    locationConsistency: number;
    lightingConsistency: number;
    colorPaletteConsistency: number;
    architecturalConsistency: number;
    crossPanelConsistency: number;
    panelScores: Array<{
      panelNumber: number;
      locationConsistency: number;
      lightingConsistency: number;
      colorPaletteConsistency: number;
      architecturalStyleConsistency: number;
      atmosphericConsistency: number;
      issues: string[];
    }>;
    detailedAnalysis: string;
    failureReasons: string[];
    passesThreshold: boolean;
    attemptNumber: number;
    regenerationTriggered: boolean;
  }): Promise<boolean>;

  storeCartoonizationQualityMetrics(
    cartoonizeJobId: string,
    attemptNumber: number,
    qualityReport: {
      overallQuality: number;
      visualClarity: number;
      characterFidelity: number;
      styleAccuracy: number;
      ageAppropriateness: number;
      professionalStandard: number;
      detailedAnalysis: string;
      failureReasons: string[];
      passesThreshold: boolean;
      recommendations: string[];
    }
  ): Promise<boolean>;

  // Transaction Support
  executeTransaction<T>(operations: DatabaseOperation<T>[]): Promise<T[]>;
}

export interface IAIOperations {
  // Text Generation
  generateStory(prompt: string, options?: StoryGenerationOptions): Promise<string>;
  
  // ✅ FIXED: Added missing enterprise methods
  analyzeStoryStructure(story: string, audience: AudienceType): Promise<StoryAnalysis>;
  createMasterCharacterDNA(imageUrl: string, artStyle: string, existingDescription?: string): Promise<CharacterDNA>;
  createEnvironmentalDNA(storyBeats: StoryBeat[], audience: AudienceType, artStyle?: string): Promise<EnvironmentalDNA>;
  analyzePanelContinuity(storyBeats: any[]): Promise<any>;
  
  // Enhanced Scene Generation with Audience Support
  generateScenesWithAudience(options: SceneGenerationOptions): Promise<AIAsyncResult<SceneGenerationResult>>;
  
  // Image Generation
  generateCartoonImage(prompt: string): Promise<AIAsyncResult<string>>;
  generateSceneImage(options: ImageGenerationOptions): Promise<AIAsyncResult<ImageGenerationResult>>;
  
  // Vision Analysis - Method Overloading for Different Use Cases
  describeCharacter(imageUrl: string, prompt: string): Promise<AIAsyncResult<string>>;
  describeCharacter(options: CharacterDescriptionOptions): Promise<AIAsyncResult<CharacterDescriptionResult>>;
  
  // Story Generation
  generateStoryWithOptions(options: StoryGenerationOptions): Promise<AIAsyncResult<StoryGenerationResult>>;
  
  // Cartoonize Operations
  processCartoonize(options: CartoonizeOptions): Promise<AIAsyncResult<CartoonizeResult>>;
  
  // Chat Completion
  createChatCompletion(options: ChatCompletionOptions): Promise<AIAsyncResult<ChatCompletionResult>>;
}

export interface IStorageOperations {
  // Image Management
  uploadImage(imageData: Buffer | string, options?: UploadOptions): Promise<UploadResult>;
  deleteImage(publicId: string): Promise<boolean>;
  generateUrl(publicId: string, transformations?: any): string;
  
  // Cleanup Operations
  cleanupFailedUploads(publicIds: string[]): Promise<void>;
}

export interface IJobOperations {
  // Job Lifecycle
  getPendingJobs(filter?: JobFilter, limit?: number): Promise<JobData[]>;
  getJobStatus(jobId: string): Promise<JobData | null>;
  updateJobProgress(jobId: string, progress: number, currentStep?: string): Promise<boolean>;
  markJobCompleted(jobId: string, resultData: any): Promise<boolean>;
  markJobFailed(jobId: string, errorMessage: string, shouldRetry?: boolean): Promise<boolean>;
  cancelJob(jobId: string, reason?: string): Promise<boolean>;
  
  // Metrics and Monitoring
  getJobMetrics(jobType?: JobType): Promise<JobMetrics>;
}

export interface IAuthOperations {
  // Authentication
  validateToken(token: string): Promise<TokenValidationResult>;
  getUserContext(token: string): Promise<UserContext | null>;
  
  // Authorization
  checkPermission(userContext: UserContext, permission: string): Promise<boolean>;
  
  // Service Authentication
  validateServiceRole(key: string): Promise<boolean>;
  getServiceContext(): UserContext;
}

// ===== SUBSCRIPTION OPERATIONS INTERFACE =====
export interface ISubscriptionOperations {
  // Core Subscription Limit Checking
  checkUserLimits(userId: string, limitType?: string): Promise<LimitCheckResult>;
  getUserSubscriptionData(userId: string, limitType: string): Promise<UserSubscriptionData>;
  
  // Cache Management
  refreshUserCache(userId: string): Promise<boolean>;
  clearCache(): void;
  getCacheStats(): {
    totalEntries: number;
    oldestEntry: string | null;
    newestEntry: string | null;
  };
  
  // Configuration Management
  getSubscriptionLimits(): SubscriptionLimits;
  updateSubscriptionLimits(newLimits: Partial<SubscriptionLimits>): void;
}

// ===== CONFIGURATION INTERFACES =====
export interface IServiceConfiguration {
  /**
   * Get service configuration (read-only)
   */
  getConfiguration(): ServiceConfig;
  
  /**
   * Get timeout for specific operation
   */
  getTimeout(operation: string): number;
  
  /**
   * Get retry configuration for operation
   */
  getRetryConfig(operation: string): RetryConfig;
  
  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature: string): boolean;
}

// ===== COMPOSITE SERVICE INTERFACES =====
export interface IDatabaseService extends 
  IDatabaseOperations, 
  IServiceHealth, 
  IServiceMetrics, 
  IServiceLifecycle {
  getName(): string;
}

export interface IAIService extends 
  IAIOperations, 
  IServiceHealth, 
  IServiceMetrics, 
  IServiceLifecycle {
  getName(): string;
  
  // Quality Analysis Methods
  calculateQualityMetrics(
    generatedPanels: any[],
    originalContext: {
      characterDNA?: any;
      environmentalDNA?: any;
      storyAnalysis?: any;
      targetAudience: string;
      artStyle: string;
    }
  ): Promise<any>;
  
  generateQualityRecommendations(qualityMetrics: any): string[];
  
  // Success Pattern Learning Methods
  storeSuccessfulPattern(
    context: any,
    results: any,
    qualityScores: QualityMetrics,
    userRatings?: UserRating[]
  ): Promise<boolean>;
  
  evolvePromptsFromPatterns(
  currentContext: any,
  pastSuccesses: SuccessPattern[]
): Promise<PatternEvolutionResult>;
  
  findSimilarSuccessPatterns(
    context: {
      audience: string;
      genre?: string;
      artStyle: string;
      environmentalSetting?: string;
      characterType?: string;
    },
    limit?: number
  ): Promise<SuccessPattern[]>;
}

// ===== SUCCESS PATTERN LEARNING INTERFACES =====
export interface SuccessPattern {
  id: string;
  patternType: 'prompt_template' | 'environmental_context' | 'character_strategy' | 'dialogue_pattern';
  contextSignature: string;
  successCriteria: {
    minTechnicalScore: number;
    minUserRating: number;
    combinedThreshold: number;
  };
  patternData: {
    promptTemplate?: string;
    environmentalElements?: string[];
    characterTechniques?: string[];
    dialogueStrategies?: string[];
    visualElements?: string[];
    contextualModifiers?: string[];
  };
  usageContext: {
    audience: string;
    genre?: string;
    artStyle: string;
    environmentalSetting?: string;
    characterType?: string;
    layoutType?: string;
  };
  qualityScores: {
    averageTechnicalScore: number;
    averageUserRating: number;
    consistencyRate: number;
    improvementRate: number;
  };
  effectivenessScore: number; // 0-100
  usageCount: number;
  successRate: number; // percentage
  createdAt: string;
  lastUsedAt: string;
  isDeprecated?: boolean;
  deprecationReason?: string;
  deprecationDate?: string;
}

export interface LearningMetrics {
  totalPatternsStored: number;
  activePatterns: number;
  averageEffectiveness: number;
  improvementRate: number;
  patternsByType: Record<string, number>;
  recentSuccesses: number;
  learningTrend: 'improving' | 'stable' | 'declining';
}

export interface IStorageService extends 
  IStorageOperations, 
  IServiceHealth, 
  IServiceMetrics, 
  IServiceLifecycle {
  getName(): string;
}

export interface IJobService extends 
  IJobOperations, 
  IServiceHealth, 
  IServiceMetrics, 
  IServiceLifecycle {
  getName(): string;
}

export interface IAuthService extends 
  IAuthOperations, 
  IServiceHealth, 
  IServiceMetrics, 
  IServiceLifecycle {
  getName(): string;
}

export interface ISubscriptionService extends 
  ISubscriptionOperations, 
  IServiceHealth, 
  IServiceMetrics, 
  IServiceLifecycle {
  getName(): string;
}

export interface IConfigService extends 
  IServiceConfiguration, 
  IServiceHealth, 
  IServiceLifecycle {
  getName(): string;
}

// ===== CONTAINER INTERFACES =====
export interface IServiceContainer {
  // Service Registration
  register<T>(token: string, factory: ServiceFactory<T>, options?: ServiceOptions): void;
  
  // Service Resolution
  resolve<T>(token: string): Promise<T>;
  resolveSync<T>(token: string): T | null;
  
  // Container Management
  isRegistered(token: string): boolean;
  dispose(): Promise<void>;
  
  // Health Aggregation (computed, not exposing internal state)
  getHealth(): Promise<ContainerHealthReport>;
}

export interface ContainerHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, ServiceHealthStatus>;
  timestamp: string;
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

// ===== SUPPORTING TYPES =====
export interface ServiceFactory<T> {
  (container: IServiceContainer): T | Promise<T>;
}

export interface ServiceOptions {
  singleton?: boolean;
  lazy?: boolean;
  dependencies?: string[];
  healthCheck?: boolean;
}

export interface JobFilter {
  user_id?: string;
  type?: JobType;
  status?: JobStatus;
  limit?: number;
  offset?: number;
}

export interface StorybookEntryData {
  title: string;
  story: string;
  pages: any[];
  user_id?: string;
  audience: string;
  character_description: string;
  has_errors: boolean;
}

export interface StorybookEntry {
  id: string;
  title: string;
  story: string;
  pages: any[];
  user_id?: string;
  audience: string;
  character_description: string;
  has_errors: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabaseOperation<T> {
  (client: any): Promise<T>;
}

export interface ChatCompletionOptions {
  model?: string;
  messages: any[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: string };
}

export interface ChatCompletionResult {
  choices: any[];
  usage?: any;
  model: string;
}

export interface UploadOptions {
  folder?: string;
  publicId?: string;
  transformation?: any;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
}

export interface UploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

export interface TokenValidationResult {
  valid: boolean;
  user?: UserContext;
  error?: string;
}

export interface UserContext {
  id: string;
  email?: string;
  role: 'user' | 'admin' | 'service';
  permissions: string[];
}

// ===== SUBSCRIPTION TYPES =====
export type UserTier = 'free' | 'basic' | 'premium' | 'admin';

export interface SubscriptionLimits {
  free: number;
  basic: number;
  premium: number;
  admin: number;
}

export interface UserSubscriptionData {
  userId: string;
  userType: UserTier;
  currentUsage: number;
  tierLimit: number;
  canCreate: boolean;
  upgradeMessage?: string;
  resetDate?: string;
}

export interface LimitCheckResult {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  userType: string;
  upgradeMessage?: string;
  resetDate?: string;
}

export interface ServiceConfig {
  name: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  circuitBreakerThreshold: number;
}

export interface RetryConfig {
  attempts: number;
  delay: number;
  backoffMultiplier: number;
  maxDelay: number;
}

// ===== INTELLIGENT PROMPT COMPRESSION INTERFACES =====
export interface CompressionReport {
  originalTokenCount: number;
  compressedTokenCount: number;
  compressionRatio: number;
  dnaProtectionVerified: boolean;
  sectionsCompressed: string[];
  warnings?: string[];
}

export interface CompressionOptions {
  characterDNA?: CharacterDNA;
  environmentalDNA?: EnvironmentalDNA;
  maxTokens: number;
  preserveStructure?: boolean;
}

// Service Token Constants
export const SERVICE_TOKENS = {
  DATABASE: 'IDatabaseService',
  AI: 'IAIService',
  STORAGE: 'IStorageService',
  JOB: 'IJobService',
  AUTH: 'IAuthService',
  SUBSCRIPTION: 'ISubscriptionService',
  CONFIG: 'IConfigService',
  VISUAL_CONSISTENCY_VALIDATOR: 'IVisualConsistencyValidator',
  ENVIRONMENTAL_CONSISTENCY_VALIDATOR: 'IEnvironmentalConsistencyValidator',
  CARTOONIZATION_QUALITY_VALIDATOR: 'ICartoonizationQualityValidator',
} as const;

export type ServiceToken = typeof SERVICE_TOKENS[keyof typeof SERVICE_TOKENS];

export type IJobProcessor = IJobService;
export type ICloudinaryService = IStorageService;
export type ISceneGenerationService = IAIService;
export type ICartoonizationService = IAIService;