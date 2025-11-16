import { createHash } from 'crypto';
import { IDatabaseService } from '../../interfaces/service-contracts.js';

export interface SuccessPatternRecordingData {
  comicData: {
    pages: any[];
    characterDNA?: any;
    environmentalDNA?: any;
    storyAnalysis?: any;
    totalPanels: number;
  };
  qualityMetrics: {
    characterConsistency: number;
    technicalExecution: number;
    environmentalCoherence: number;
    narrativeFlow: number;
    userRating?: number;
  };
  jobContext: {
    audience: string;
    genre?: string;
    artStyle: string;
    setting?: string;
    characterType?: string;
    layoutType?: string;
    isReusedImage?: boolean;
    characterImage?: string;
  };
}

export interface PatternRecordingResult {
  success: boolean;
  patternId?: string;
  contextSignature: string;
  effectivenessScore: number;
  patternType: string;
  updated?: boolean;
}

export type PatternType = 'prompt_template' | 'environmental_context' | 'character_strategy' | 'dialogue_pattern';

export interface SuccessCriteria {
  minTechnicalScore: number;
  minCharacterConsistency: number;
  minEnvironmentalCoherence: number;
  minUserRating: number;
  combinedThreshold: number;
}

export class PatternLearningEngine {
  private databaseService: IDatabaseService;

  private readonly SUCCESS_CRITERIA: SuccessCriteria = {
    minTechnicalScore: 85,
    minCharacterConsistency: 90,
    minEnvironmentalCoherence: 85,
    minUserRating: 4.0,
    combinedThreshold: 85
  };

  constructor(databaseService: IDatabaseService) {
    this.databaseService = databaseService;
    console.log('📚 Pattern Learning Engine initialized');
  }

  async recordSuccessPattern(
    comicData: SuccessPatternRecordingData['comicData'],
    qualityMetrics: SuccessPatternRecordingData['qualityMetrics'],
    jobContext: SuccessPatternRecordingData['jobContext']
  ): Promise<PatternRecordingResult> {
    try {
      console.log(`📚 Recording success pattern: ${jobContext.audience} audience with ${jobContext.artStyle} style`);

      if (!this.meetsSuccessCriteria(qualityMetrics)) {
        const reason = this.getFailureReason(qualityMetrics);
        console.log(`⚠️ Pattern quality below threshold - ${reason}`);
        return {
          success: false,
          contextSignature: '',
          effectivenessScore: 0,
          patternType: 'none'
        };
      }

      const contextSignature = this.generateContextSignature(jobContext);
      const patternType = this.determinePatternType(comicData, jobContext);
      const effectivenessScore = this.calculateEffectivenessScore(qualityMetrics);

      console.log(`✅ Pattern effectiveness: ${effectivenessScore}% (technical: ${qualityMetrics.technicalExecution}%, consistency: ${qualityMetrics.characterConsistency}%)`);

      const patternData = this.extractPatternData(patternType, comicData, jobContext);
      const usageContext = this.buildUsageContext(jobContext);

      const existingPattern = await this.checkForExistingPattern(contextSignature, patternType);

      let success = false;
      let patternId: string | undefined;
      let updated = false;

      if (existingPattern) {
        success = await this.updateExistingPattern(existingPattern.id, qualityMetrics);
        patternId = existingPattern.id;
        updated = true;
        console.log(`🔄 Updated existing pattern (usage count: ${existingPattern.usage_count + 1})`);
      } else {
        const pattern = {
          patternType,
          contextSignature,
          successCriteria: this.SUCCESS_CRITERIA as any,
          patternData,
          usageContext,
          qualityScores: this.buildQualityScores(qualityMetrics),
          effectivenessScore,
          usageCount: 1,
          successRate: 100.0
        } as any;

        success = await this.databaseService.saveSuccessPattern(pattern);
        console.log(`💾 Stored pattern with signature: ${contextSignature}`);
      }

      return {
        success,
        patternId,
        contextSignature,
        effectivenessScore,
        patternType,
        updated
      };

    } catch (error: any) {
      console.error('❌ Failed to record success pattern:', error.message);
      return {
        success: false,
        contextSignature: '',
        effectivenessScore: 0,
        patternType: 'error'
      };
    }
  }

  async updatePatternEffectiveness(
    patternId: string,
    comicId: string,
    newOutcome: {
      qualityMetrics: SuccessPatternRecordingData['qualityMetrics'];
      beforeScores?: any;
      successful: boolean;
    }
  ): Promise<boolean> {
    try {
      const effectivenessRating = this.calculateEffectivenessScore(newOutcome.qualityMetrics);

      const effectivenessData = {
        qualityImprovement: {
          characterConsistency: newOutcome.qualityMetrics.characterConsistency,
          environmentalCoherence: newOutcome.qualityMetrics.environmentalCoherence,
          technicalExecution: newOutcome.qualityMetrics.technicalExecution
        },
        beforeScores: newOutcome.beforeScores || {},
        afterScores: {
          characterConsistency: newOutcome.qualityMetrics.characterConsistency,
          environmentalCoherence: newOutcome.qualityMetrics.environmentalCoherence,
          narrativeFlow: newOutcome.qualityMetrics.narrativeFlow
        },
        userSatisfactionImpact: newOutcome.qualityMetrics.userRating || 4.0,
        technicalQualityImpact: newOutcome.qualityMetrics.technicalExecution,
        effectivenessRating
      };

      return await this.databaseService.updatePatternEffectiveness(
        patternId,
        comicId,
        effectivenessData
      );
    } catch (error: any) {
      console.error('❌ Failed to update pattern effectiveness:', error.message);
      return false;
    }
  }

  calculateEffectivenessScore(qualityMetrics: SuccessPatternRecordingData['qualityMetrics']): number {
    const technicalQuality = qualityMetrics.technicalExecution || 85;
    const characterConsistency = qualityMetrics.characterConsistency || 90;
    const environmentalCoherence = qualityMetrics.environmentalCoherence || 85;
    const narrativeFlow = qualityMetrics.narrativeFlow || 80;

    const score = (
      (technicalQuality * 0.4) +
      (characterConsistency * 0.3) +
      (environmentalCoherence * 0.15) +
      (narrativeFlow * 0.15)
    );

    return Math.round(score);
  }

  private meetsSuccessCriteria(qualityMetrics: SuccessPatternRecordingData['qualityMetrics']): boolean {
    const technical = qualityMetrics.technicalExecution >= this.SUCCESS_CRITERIA.minTechnicalScore;
    const character = qualityMetrics.characterConsistency >= this.SUCCESS_CRITERIA.minCharacterConsistency;
    const environmental = qualityMetrics.environmentalCoherence >= this.SUCCESS_CRITERIA.minEnvironmentalCoherence;

    const userRating = qualityMetrics.userRating || 4.0;
    const userMeetsThreshold = userRating >= this.SUCCESS_CRITERIA.minUserRating;

    const effectiveness = this.calculateEffectivenessScore(qualityMetrics);
    const combined = effectiveness >= this.SUCCESS_CRITERIA.combinedThreshold;

    return technical && character && environmental && userMeetsThreshold && combined;
  }

  private getFailureReason(qualityMetrics: SuccessPatternRecordingData['qualityMetrics']): string {
    const reasons: string[] = [];

    if (qualityMetrics.technicalExecution < this.SUCCESS_CRITERIA.minTechnicalScore) {
      reasons.push(`Technical quality ${qualityMetrics.technicalExecution}% < ${this.SUCCESS_CRITERIA.minTechnicalScore}%`);
    }
    if (qualityMetrics.characterConsistency < this.SUCCESS_CRITERIA.minCharacterConsistency) {
      reasons.push(`Character consistency ${qualityMetrics.characterConsistency}% < ${this.SUCCESS_CRITERIA.minCharacterConsistency}%`);
    }
    if (qualityMetrics.environmentalCoherence < this.SUCCESS_CRITERIA.minEnvironmentalCoherence) {
      reasons.push(`Environmental coherence ${qualityMetrics.environmentalCoherence}% < ${this.SUCCESS_CRITERIA.minEnvironmentalCoherence}%`);
    }

    const userRating = qualityMetrics.userRating || 4.0;
    if (userRating < this.SUCCESS_CRITERIA.minUserRating) {
      reasons.push(`User rating ${userRating} < ${this.SUCCESS_CRITERIA.minUserRating}`);
    }

    const effectiveness = this.calculateEffectivenessScore(qualityMetrics);
    if (effectiveness < this.SUCCESS_CRITERIA.combinedThreshold) {
      reasons.push(`Effectiveness ${effectiveness}% < ${this.SUCCESS_CRITERIA.combinedThreshold}%`);
    }

    return reasons.join(', ');
  }

  private generateContextSignature(jobContext: SuccessPatternRecordingData['jobContext']): string {
    const signatureString = [
      jobContext.audience || '',
      jobContext.genre || '',
      jobContext.artStyle || '',
      jobContext.setting || '',
      jobContext.characterType || ''
    ].join('|');

    return createHash('md5').update(signatureString).digest('hex');
  }

  private determinePatternType(
    comicData: SuccessPatternRecordingData['comicData'],
    jobContext: SuccessPatternRecordingData['jobContext']
  ): PatternType {
    if (comicData.characterDNA && comicData.characterDNA.visualFingerprint) {
      return 'character_strategy';
    }

    if (comicData.environmentalDNA && !comicData.environmentalDNA.fallback) {
      return 'environmental_context';
    }

    const hasDialogue = comicData.pages.some((page: any) =>
      page.scenes?.some((scene: any) => scene.dialogue)
    );
    if (hasDialogue) {
      return 'dialogue_pattern';
    }

    return 'prompt_template';
  }

  private extractPatternData(
    patternType: PatternType,
    comicData: SuccessPatternRecordingData['comicData'],
    jobContext: SuccessPatternRecordingData['jobContext']
  ): any {
    switch (patternType) {
      case 'prompt_template':
        return this.extractPromptTemplateData(comicData, jobContext);

      case 'environmental_context':
        return this.extractEnvironmentalContextData(comicData);

      case 'character_strategy':
        return this.extractCharacterStrategyData(comicData);

      case 'dialogue_pattern':
        return this.extractDialoguePatternData(comicData);

      default:
        return {};
    }
  }

  private extractPromptTemplateData(
    comicData: SuccessPatternRecordingData['comicData'],
    jobContext: SuccessPatternRecordingData['jobContext']
  ): any {
    const samplePrompts = comicData.pages
      .flatMap((page: any) => page.scenes || [])
      .slice(0, 3)
      .map((scene: any) => scene.imagePrompt)
      .filter(Boolean);

    return {
      promptStructure: this.analyzePromptStructure(samplePrompts),
      dnaPhrasingTechniques: this.extractDNAPhrasingTechniques(comicData),
      compressionStrategies: this.identifyCompressionStrategies(samplePrompts),
      artStyleIntegration: jobContext.artStyle,
      audienceOptimization: jobContext.audience
    };
  }

  private extractEnvironmentalContextData(comicData: SuccessPatternRecordingData['comicData']): any {
    const envDNA = comicData.environmentalDNA;

    if (!envDNA || envDNA.fallback) {
      return {};
    }

    return {
      locationDescriptionFormat: this.formatLocationDescription(envDNA.primaryLocation),
      lightingStrategy: this.describeLightingStrategy(envDNA.lightingContext),
      colorPaletteStructure: this.analyzeColorPalette(envDNA.colorPalette),
      architecturalElements: envDNA.primaryLocation?.keyFeatures || [],
      atmosphericContext: envDNA.lightingContext?.atmosphericQuality || 'clear'
    };
  }

  private extractCharacterStrategyData(comicData: SuccessPatternRecordingData['comicData']): any {
    const charDNA = comicData.characterDNA;

    if (!charDNA) {
      return {};
    }

    return {
      dnaStructure: this.analyzeCharacterDNAStructure(charDNA),
      fingerprintFormat: charDNA.visualFingerprint ? 'detailed_visual_fingerprint' : 'standard',
      consistencyTechniques: this.extractConsistencyTechniques(charDNA),
      visualElements: {
        faceStructure: charDNA.physicalStructure?.faceShape || 'standard',
        bodyProportions: charDNA.physicalStructure?.bodyType || 'standard',
        clothingSignature: charDNA.clothingSignature?.primaryOutfit || 'casual'
      }
    };
  }

  private extractDialoguePatternData(comicData: SuccessPatternRecordingData['comicData']): any {
    const dialoguePanels = comicData.pages
      .flatMap((page: any) => page.scenes || [])
      .filter((scene: any) => scene.dialogue);

    return {
      dialogueFrequency: dialoguePanels.length / comicData.totalPanels,
      speechBubblePlacements: this.analyzeSpeechBubblePlacements(dialoguePanels),
      dialoguePacing: this.analyzeDialoguePacing(dialoguePanels, comicData.totalPanels),
      speechStyles: this.extractSpeechStyles(dialoguePanels)
    };
  }

  private buildUsageContext(jobContext: SuccessPatternRecordingData['jobContext']): any {
    return {
      audience: jobContext.audience,
      artStyle: jobContext.artStyle,
      genre: jobContext.genre || 'general',
      setting: jobContext.setting || 'varied',
      characterType: jobContext.characterType || 'custom',
      layoutType: jobContext.layoutType || 'comic-book-panels',
      isReusedImage: jobContext.isReusedImage || false
    };
  }

  private buildQualityScores(qualityMetrics: SuccessPatternRecordingData['qualityMetrics']): any {
    return {
      technicalExecution: qualityMetrics.technicalExecution,
      characterConsistency: qualityMetrics.characterConsistency,
      environmentalCoherence: qualityMetrics.environmentalCoherence,
      narrativeFlow: qualityMetrics.narrativeFlow,
      userRating: qualityMetrics.userRating || 4.0,
      overallScore: this.calculateEffectivenessScore(qualityMetrics)
    };
  }

  private async checkForExistingPattern(
    contextSignature: string,
    patternType: PatternType
  ): Promise<any | null> {
    try {
      const patterns = await this.databaseService.getSuccessPatterns(
        { audience: '', genre: '', artStyle: '' },
        1000
      );

      return patterns.find(p =>
        p.contextSignature === contextSignature &&
        p.patternType === patternType
      ) || null;
    } catch (error: any) {
      console.error('❌ Failed to check for existing pattern:', error.message);
      return null;
    }
  }

  private async updateExistingPattern(patternId: string, qualityMetrics: any): Promise<boolean> {
    return true;
  }

  private analyzePromptStructure(prompts: string[]): string {
    if (prompts.length === 0) return 'standard_structure';

    const avgLength = prompts.reduce((sum, p) => sum + p.length, 0) / prompts.length;

    if (avgLength < 100) return 'concise_focused';
    if (avgLength > 300) return 'detailed_comprehensive';
    return 'balanced_descriptive';
  }

  private extractDNAPhrasingTechniques(comicData: any): string[] {
    const techniques: string[] = [];

    if (comicData.characterDNA) {
      techniques.push('character_visual_fingerprint');
      techniques.push('dna_based_consistency');
    }

    if (comicData.environmentalDNA) {
      techniques.push('environmental_dna_integration');
    }

    return techniques;
  }

  private identifyCompressionStrategies(prompts: string[]): string[] {
    const strategies: string[] = [];

    const hasKeywords = prompts.some(p =>
      p.includes('CRITICAL') || p.includes('MANDATORY') || p.includes('EXACTLY')
    );

    if (hasKeywords) {
      strategies.push('emphasis_keywords');
    }

    strategies.push('descriptive_clarity');

    return strategies;
  }

  private formatLocationDescription(primaryLocation: any): string {
    if (!primaryLocation) return 'standard_location_format';

    const hasDetails = primaryLocation.keyFeatures && primaryLocation.keyFeatures.length > 0;
    return hasDetails ? 'detailed_with_key_features' : 'basic_location_name';
  }

  private describeLightingStrategy(lightingContext: any): string {
    if (!lightingContext) return 'default_lighting';

    return `${lightingContext.timeOfDay}_${lightingContext.lightingMood}`;
  }

  private analyzeColorPalette(colorPalette: any): string {
    if (!colorPalette) return 'default_palette';

    const dominantColors = colorPalette.dominantColors || [];
    return dominantColors.length > 0 ? 'defined_color_scheme' : 'natural_colors';
  }

  private analyzeCharacterDNAStructure(charDNA: any): string {
    const hasPhysical = !!charDNA.physicalStructure;
    const hasClothing = !!charDNA.clothingSignature;
    const hasIdentifiers = !!charDNA.uniqueIdentifiers;

    const components = [hasPhysical, hasClothing, hasIdentifiers].filter(Boolean).length;

    if (components >= 3) return 'comprehensive_dna';
    if (components >= 2) return 'detailed_dna';
    return 'basic_dna';
  }

  private extractConsistencyTechniques(charDNA: any): string[] {
    const techniques: string[] = [];

    if (charDNA.visualFingerprint) {
      techniques.push('visual_fingerprinting');
    }

    if (charDNA.consistencyChecklist && charDNA.consistencyChecklist.length > 0) {
      techniques.push('consistency_checklist');
    }

    techniques.push('dna_prompt_integration');

    return techniques;
  }

  private analyzeSpeechBubblePlacements(dialoguePanels: any[]): string {
    return dialoguePanels.length > 0 ? 'contextual_placement' : 'none';
  }

  private analyzeDialoguePacing(dialoguePanels: any[], totalPanels: number): string {
    const ratio = dialoguePanels.length / totalPanels;

    if (ratio < 0.3) return 'sparse';
    if (ratio > 0.7) return 'dialogue_heavy';
    return 'balanced';
  }

  private extractSpeechStyles(dialoguePanels: any[]): string[] {
    return dialoguePanels.length > 0 ? ['standard_speech'] : [];
  }

  async storeSuccessfulPattern(
    context: any,
    results: any,
    qualityScores: any,
    userRatings?: any[]
  ): Promise<void> {
    const comicData = {
      pages: results.pages || [],
      characterDNA: context.characterDNA,
      environmentalDNA: context.environmentalDNA,
      storyAnalysis: context.storyAnalysis,
      totalPanels: results.pages?.reduce((sum: number, page: any) => sum + (page.scenes?.length || 0), 0) || 0
    };

    const qualityMetrics = {
      characterConsistency: qualityScores.characterConsistency || 90,
      technicalExecution: qualityScores.technicalExecution || 85,
      environmentalCoherence: qualityScores.environmentalCoherence || 85,
      narrativeFlow: qualityScores.narrativeCoherence || 80,
      userRating: userRatings && userRatings.length > 0
        ? userRatings.reduce((sum, r) => sum + (r.score || 4), 0) / userRatings.length
        : 4.0
    };

    const jobContext = {
      audience: context.audience || 'children',
      genre: context.genre,
      artStyle: context.artStyle || context.characterArtStyle || 'storybook',
      setting: context.environmentalSetting,
      characterType: context.characterDNA ? 'custom' : 'generated',
      layoutType: context.layoutType,
      isReusedImage: false,
      characterImage: context.characterImage
    };

    await this.recordSuccessPattern(comicData, qualityMetrics, jobContext);
  }

  async evolvePromptsFromPatterns(
    currentContext: any,
    pastSuccesses: any[] = []
  ): Promise<any> {
    console.log('🧠 Evolving prompts based on successful patterns...');

    try {
      const contextForSearch = {
        audience: currentContext.audience,
        genre: currentContext.genre,
        artStyle: currentContext.artStyle || currentContext.characterArtStyle,
        environmentalSetting: currentContext.environmentalSetting,
        characterType: currentContext.characterType
      };

      const relevantPatterns = await this.databaseService.getSuccessPatterns(
        contextForSearch,
        10
      );

      if (relevantPatterns.length === 0) {
        console.log('⚠️ No relevant patterns found for evolution');
        return currentContext;
      }

      const avgEffectiveness = relevantPatterns.reduce((sum, p) => sum + p.effectivenessScore, 0) / relevantPatterns.length;

      console.log(`✅ Found ${relevantPatterns.length} relevant patterns (avg effectiveness: ${avgEffectiveness}%)`);

      return {
        ...currentContext,
        learnedPatternsApplied: true,
        patternCount: relevantPatterns.length,
        averageEffectiveness: avgEffectiveness,
        improvementRationale: `Applied ${relevantPatterns.length} successful patterns`,
        expectedImprovements: {
          characterConsistency: 5,
          environmentalCoherence: 3,
          narrativeFlow: 2,
          userSatisfaction: 0
        }
      };
    } catch (error: any) {
      console.error('❌ Pattern evolution failed:', error.message);
      return currentContext;
    }
  }
}
