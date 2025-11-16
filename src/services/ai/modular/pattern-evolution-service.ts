import { IDatabaseService } from '../../interfaces/service-contracts.js';
import { PatternLearningEngine, RetrievedPattern, PatternType } from './pattern-learning-engine.js';

export interface EvolutionCandidate {
  patterns: RetrievedPattern[];
  contextSignature: string;
  averageEffectiveness: number;
  combinedUsageCount: number;
}

export interface EvolvedPatternResult {
  success: boolean;
  evolvedPatternId?: string;
  originalPatternIds: string[];
  effectivenessImprovement: number;
  mergedElements: string[];
}

export interface DeprecationCandidate {
  patternId: string;
  reason: string;
  effectivenessScore: number;
  usageCount: number;
  lastUsedAt: string;
}

export interface SystemHealthMetrics {
  totalActivePatterns: number;
  deprecatedPatterns: number;
  patternsByType: {
    prompt_template: number;
    environmental_context: number;
    character_strategy: number;
    dialogue_pattern: number;
  };
  averageEffectiveness: number;
  successRateTrend: 'improving' | 'stable' | 'declining';
  patternUsageDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  qualityImprovementVsBaseline: number;
}

export interface MaintenanceReport {
  patternsEvolved: number;
  patternsDeprecated: number;
  systemHealth: SystemHealthMetrics;
  maintenanceTimestamp: string;
  details: string[];
}

export class PatternEvolutionService {
  private databaseService: IDatabaseService;
  private patternLearningEngine: PatternLearningEngine;
  private maintenanceIntervalId: NodeJS.Timeout | null = null;

  private readonly EVOLUTION_THRESHOLDS = {
    minEffectiveness: 85,
    minUsageCount: 10,
    minSuccessRate: 80,
    minPatternsForEvolution: 2,
  };

  private readonly DEPRECATION_THRESHOLDS = {
    lowEffectiveness: 60,
    lowEffectivenessDays: 30,
    lowSuccessRate: 50,
    minUsageForSuccessRate: 5,
    unusedPatternDays: 90,
  };

  private readonly MAINTENANCE_INTERVAL = 24 * 60 * 60 * 1000;

  constructor(databaseService: IDatabaseService, patternLearningEngine: PatternLearningEngine) {
    this.databaseService = databaseService;
    this.patternLearningEngine = patternLearningEngine;
    console.log('🧬 Pattern Evolution Service initialized');
  }

  async evolvePatterns(): Promise<EvolvedPatternResult[]> {
    console.log('🧬 Pattern evolution starting: analyzing high-performers');

    try {
      const evolutionCandidates = await this.identifyEvolutionCandidates();

      if (evolutionCandidates.length === 0) {
        console.log('⚠️ No patterns meet evolution criteria');
        return [];
      }

      console.log(`🔍 Found ${evolutionCandidates.length} evolution candidate groups`);

      const results: EvolvedPatternResult[] = [];

      for (const candidate of evolutionCandidates) {
        try {
          const result = await this.createEvolvedPattern(candidate);
          if (result.success) {
            results.push(result);
            console.log(`✨ Evolved pattern created: ${candidate.averageEffectiveness}% → ${candidate.averageEffectiveness + result.effectivenessImprovement}%`);
          }
        } catch (error: any) {
          console.error(`❌ Failed to evolve pattern group: ${error.message}`);
        }
      }

      console.log(`🧬 Pattern evolution complete: ${results.length} patterns evolved`);
      return results;
    } catch (error: any) {
      console.error('❌ Pattern evolution failed:', error.message);
      return [];
    }
  }

  async cleanupPatterns(): Promise<DeprecationCandidate[]> {
    console.log('🗑️ Pattern cleanup starting: analyzing low-performers');

    try {
      const deprecationCandidates = await this.identifyDeprecationCandidates();

      if (deprecationCandidates.length === 0) {
        console.log('✅ No patterns require deprecation');
        return [];
      }

      console.log(`🔍 Found ${deprecationCandidates.length} patterns for deprecation`);

      const deprecated: DeprecationCandidate[] = [];

      for (const candidate of deprecationCandidates) {
        try {
          const success = await this.deprecatePattern(candidate);
          if (success) {
            deprecated.push(candidate);
          }
        } catch (error: any) {
          console.error(`❌ Failed to deprecate pattern ${candidate.patternId}: ${error.message}`);
        }
      }

      console.log(`🗑️ Deprecated ${deprecated.length} low-performing patterns`);
      return deprecated;
    } catch (error: any) {
      console.error('❌ Pattern cleanup failed:', error.message);
      return [];
    }
  }

  async runMaintenance(): Promise<MaintenanceReport> {
    console.log('🔧 Starting pattern maintenance cycle');

    const maintenanceTimestamp = new Date().toISOString();
    const details: string[] = [];

    try {
      const evolvedPatterns = await this.evolvePatterns();
      details.push(`Evolved ${evolvedPatterns.length} high-performing patterns`);

      const deprecatedPatterns = await this.cleanupPatterns();
      details.push(`Deprecated ${deprecatedPatterns.length} low-performing patterns`);

      const systemHealth = await this.getSystemHealth();
      details.push(`Active patterns: ${systemHealth.totalActivePatterns}`);
      details.push(`Average effectiveness: ${systemHealth.averageEffectiveness}%`);
      details.push(`Success rate trend: ${systemHealth.successRateTrend}`);

      console.log('📊 Learning system health:', {
        activePatterns: systemHealth.totalActivePatterns,
        averageEffectiveness: `${systemHealth.averageEffectiveness}%`,
        trend: systemHealth.successRateTrend,
      });

      console.log('✅ Pattern maintenance cycle complete');

      return {
        patternsEvolved: evolvedPatterns.length,
        patternsDeprecated: deprecatedPatterns.length,
        systemHealth,
        maintenanceTimestamp,
        details,
      };
    } catch (error: any) {
      console.error('❌ Maintenance cycle failed:', error.message);
      throw error;
    }
  }

  async getSystemHealth(): Promise<SystemHealthMetrics> {
    try {
      const allPatterns = await this.databaseService.getSuccessPatterns({}, 10000);

      const activePatterns = allPatterns.filter((p: any) => !p.isDeprecated);
      const deprecatedPatterns = allPatterns.filter((p: any) => p.isDeprecated);

      const patternsByType = {
        prompt_template: 0,
        environmental_context: 0,
        character_strategy: 0,
        dialogue_pattern: 0,
      };

      for (const pattern of activePatterns) {
        if (pattern.patternType in patternsByType) {
          patternsByType[pattern.patternType as keyof typeof patternsByType]++;
        }
      }

      const averageEffectiveness = activePatterns.length > 0
        ? activePatterns.reduce((sum: number, p: any) => sum + (p.effectivenessScore || 0), 0) / activePatterns.length
        : 0;

      const successRates = activePatterns.map((p: any) => p.successRate || 0);
      const recentSuccessRate = successRates.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, successRates.length);
      const olderSuccessRate = successRates.slice(0, -10).reduce((a, b) => a + b, 0) / Math.max(1, successRates.length - 10);

      let successRateTrend: 'improving' | 'stable' | 'declining' = 'stable';
      if (recentSuccessRate > olderSuccessRate + 5) {
        successRateTrend = 'improving';
      } else if (recentSuccessRate < olderSuccessRate - 5) {
        successRateTrend = 'declining';
      }

      const patternUsageDistribution = {
        high: activePatterns.filter((p: any) => (p.usageCount || 0) >= 20).length,
        medium: activePatterns.filter((p: any) => (p.usageCount || 0) >= 5 && (p.usageCount || 0) < 20).length,
        low: activePatterns.filter((p: any) => (p.usageCount || 0) < 5).length,
      };

      const qualityImprovementVsBaseline = Math.max(0, averageEffectiveness - 75);

      return {
        totalActivePatterns: activePatterns.length,
        deprecatedPatterns: deprecatedPatterns.length,
        patternsByType,
        averageEffectiveness: Math.round(averageEffectiveness * 100) / 100,
        successRateTrend,
        patternUsageDistribution,
        qualityImprovementVsBaseline: Math.round(qualityImprovementVsBaseline * 100) / 100,
      };
    } catch (error: any) {
      console.error('❌ Failed to calculate system health:', error.message);
      throw error;
    }
  }

  async manualEvolve(patternIds: string[]): Promise<EvolvedPatternResult> {
    console.log(`🔧 Manual evolution triggered for ${patternIds.length} patterns`);

    try {
      const allPatterns = await this.databaseService.getSuccessPatterns({}, 10000);
      const selectedPatterns = allPatterns.filter((p: any) => patternIds.includes(p.id));

      if (selectedPatterns.length < 2) {
        throw new Error('At least 2 patterns required for evolution');
      }

      const contextSignatures = [...new Set(selectedPatterns.map((p: any) => p.contextSignature))];
      if (contextSignatures.length > 1) {
        throw new Error('All patterns must have the same context signature');
      }

      const candidate: EvolutionCandidate = {
        patterns: selectedPatterns.map((p: any) => ({
          id: p.id,
          patternType: p.patternType,
          patternData: p.patternData,
          effectivenessScore: p.effectivenessScore,
          usageCount: p.usageCount,
          successRate: p.successRate,
          matchType: 'exact' as const,
        })),
        contextSignature: contextSignatures[0],
        averageEffectiveness: selectedPatterns.reduce((sum: number, p: any) => sum + p.effectivenessScore, 0) / selectedPatterns.length,
        combinedUsageCount: selectedPatterns.reduce((sum: number, p: any) => sum + p.usageCount, 0),
      };

      const result = await this.createEvolvedPattern(candidate);

      console.log(`✨ Manual evolution complete: ${result.success ? 'success' : 'failed'}`);
      return result;
    } catch (error: any) {
      console.error('❌ Manual evolution failed:', error.message);
      throw error;
    }
  }

  startScheduler(): void {
    if (this.maintenanceIntervalId) {
      console.log('⚠️ Scheduler already running');
      return;
    }

    console.log(`🕐 Starting maintenance scheduler (runs every 24 hours)`);

    this.maintenanceIntervalId = setInterval(async () => {
      try {
        console.log('🕐 Scheduled maintenance starting');
        await this.runMaintenance();
      } catch (error: any) {
        console.error('❌ Scheduled maintenance failed:', error.message);
      }
    }, this.MAINTENANCE_INTERVAL);

    console.log('✅ Maintenance scheduler started');
  }

  stopScheduler(): void {
    if (this.maintenanceIntervalId) {
      clearInterval(this.maintenanceIntervalId);
      this.maintenanceIntervalId = null;
      console.log('🛑 Maintenance scheduler stopped');
    }
  }

  private async identifyEvolutionCandidates(): Promise<EvolutionCandidate[]> {
    try {
      const allPatterns = await this.databaseService.getSuccessPatterns({}, 10000);

      const highPerformers = allPatterns.filter((p: any) =>
        !p.isDeprecated &&
        p.effectivenessScore >= this.EVOLUTION_THRESHOLDS.minEffectiveness &&
        p.usageCount >= this.EVOLUTION_THRESHOLDS.minUsageCount &&
        p.successRate >= this.EVOLUTION_THRESHOLDS.minSuccessRate
      );

      const groupedByContext = new Map<string, any[]>();
      for (const pattern of highPerformers) {
        const existing = groupedByContext.get(pattern.contextSignature) || [];
        existing.push(pattern);
        groupedByContext.set(pattern.contextSignature, existing);
      }

      const candidates: EvolutionCandidate[] = [];

      for (const [contextSignature, patterns] of groupedByContext.entries()) {
        if (patterns.length >= this.EVOLUTION_THRESHOLDS.minPatternsForEvolution) {
          const averageEffectiveness = patterns.reduce((sum, p) => sum + p.effectivenessScore, 0) / patterns.length;
          const combinedUsageCount = patterns.reduce((sum, p) => sum + p.usageCount, 0);

          candidates.push({
            patterns: patterns.map(p => ({
              id: p.id,
              patternType: p.patternType,
              patternData: p.patternData,
              effectivenessScore: p.effectivenessScore,
              usageCount: p.usageCount,
              successRate: p.successRate,
              matchType: 'exact' as const,
            })),
            contextSignature,
            averageEffectiveness,
            combinedUsageCount,
          });
        }
      }

      return candidates;
    } catch (error: any) {
      console.error('❌ Failed to identify evolution candidates:', error.message);
      return [];
    }
  }

  private async createEvolvedPattern(candidate: EvolutionCandidate): Promise<EvolvedPatternResult> {
    try {
      const commonElements = this.extractCommonElements(candidate.patterns);
      const mergedData = this.mergePatternData(candidate.patterns, commonElements);

      const patternType = candidate.patterns[0].patternType;

      const evolvedPattern = {
        patternType,
        contextSignature: candidate.contextSignature,
        successCriteria: {
          minTechnicalScore: 85,
          minUserRating: 4.0,
          combinedThreshold: 85,
        },
        patternData: mergedData,
        usageContext: this.extractUsageContext(candidate.patterns),
        qualityScores: this.calculateAverageQualityScores(candidate.patterns),
        effectivenessScore: candidate.averageEffectiveness + 3,
        usageCount: 1,
        successRate: 100.0,
      };

      const saved = await this.databaseService.saveSuccessPattern(evolvedPattern as any);

      if (!saved) {
        throw new Error('Failed to save evolved pattern');
      }

      await this.logEvolution(
        candidate.patterns.map(p => p.id),
        mergedData,
        commonElements,
        candidate.averageEffectiveness
      );

      return {
        success: true,
        originalPatternIds: candidate.patterns.map(p => p.id),
        effectivenessImprovement: 3,
        mergedElements: commonElements,
      };
    } catch (error: any) {
      console.error('❌ Failed to create evolved pattern:', error.message);
      return {
        success: false,
        originalPatternIds: candidate.patterns.map(p => p.id),
        effectivenessImprovement: 0,
        mergedElements: [],
      };
    }
  }

  private extractCommonElements(patterns: RetrievedPattern[]): string[] {
    const commonElements: string[] = [];

    if (patterns.length === 0) return commonElements;

    const allTechniques = patterns.flatMap(p => {
      const data = p.patternData;
      const techniques: string[] = [];

      if (data.dnaPhrasingTechniques) {
        techniques.push(...data.dnaPhrasingTechniques);
      }
      if (data.compressionStrategies) {
        techniques.push(...data.compressionStrategies);
      }
      if (data.consistencyTechniques) {
        techniques.push(...data.consistencyTechniques);
      }

      return techniques;
    });

    const techniqueCounts = new Map<string, number>();
    for (const technique of allTechniques) {
      techniqueCounts.set(technique, (techniqueCounts.get(technique) || 0) + 1);
    }

    for (const [technique, count] of techniqueCounts.entries()) {
      if (count >= Math.ceil(patterns.length / 2)) {
        commonElements.push(technique);
      }
    }

    return commonElements;
  }

  private mergePatternData(patterns: RetrievedPattern[], commonElements: string[]): any {
    const merged: any = {
      evolvedFrom: patterns.map(p => p.id),
      evolutionTimestamp: new Date().toISOString(),
      commonSuccessfulElements: commonElements,
    };

    if (patterns[0].patternType === 'prompt_template') {
      merged.promptStructure = 'evolved_comprehensive';
      merged.dnaPhrasingTechniques = commonElements.filter(e => e.includes('dna') || e.includes('fingerprint'));
      merged.compressionStrategies = commonElements.filter(e => e.includes('compression') || e.includes('emphasis'));
    } else if (patterns[0].patternType === 'character_strategy') {
      merged.dnaStructure = 'comprehensive_dna';
      merged.consistencyTechniques = commonElements;
      merged.fingerprintFormat = 'detailed_visual_fingerprint';
    } else if (patterns[0].patternType === 'environmental_context') {
      merged.locationDescriptionFormat = 'detailed_with_key_features';
      merged.lightingStrategy = 'consistent_enforcement';
      merged.colorPaletteStructure = 'defined_color_scheme';
    }

    return merged;
  }

  private extractUsageContext(patterns: RetrievedPattern[]): any {
    const firstPattern = patterns[0];
    return {
      audience: firstPattern.patternData.audienceOptimization || 'children',
      artStyle: firstPattern.patternData.artStyleIntegration || 'storybook',
      genre: 'evolved',
      evolved: true,
    };
  }

  private calculateAverageQualityScores(patterns: RetrievedPattern[]): any {
    const avgEffectiveness = patterns.reduce((sum, p) => sum + p.effectivenessScore, 0) / patterns.length;

    return {
      overallScore: avgEffectiveness,
      technicalExecution: avgEffectiveness,
      characterConsistency: avgEffectiveness,
    };
  }

  private async logEvolution(
    originalPatternIds: string[],
    evolvedData: any,
    commonElements: string[],
    originalEffectiveness: number
  ): Promise<void> {
    try {
      await this.databaseService.logPromptEvolution({
        evolutionType: 'pattern_integration',
        originalPrompt: `Combined ${originalPatternIds.length} patterns`,
        evolvedPrompt: JSON.stringify(evolvedData),
        improvementRationale: `Merged ${commonElements.length} common successful elements from high-performing patterns`,
        patternsApplied: originalPatternIds,
        contextMatch: { evolved: true },
        expectedImprovements: {
          effectivenessIncrease: 3,
          baselineEffectiveness: originalEffectiveness,
        },
      });
    } catch (error: any) {
      console.error('❌ Failed to log evolution:', error.message);
    }
  }

  private async identifyDeprecationCandidates(): Promise<DeprecationCandidate[]> {
    try {
      const allPatterns = await this.databaseService.getSuccessPatterns({}, 10000);

      const candidates: DeprecationCandidate[] = [];

      const now = Date.now();
      const thirtyDaysAgo = now - (this.DEPRECATION_THRESHOLDS.lowEffectivenessDays * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = now - (this.DEPRECATION_THRESHOLDS.unusedPatternDays * 24 * 60 * 60 * 1000);

      for (const pattern of allPatterns) {
        if (pattern.isDeprecated) continue;

        const lastUsedDate = new Date(pattern.lastUsedAt).getTime();

        if (
          pattern.effectivenessScore < this.DEPRECATION_THRESHOLDS.lowEffectiveness &&
          lastUsedDate < thirtyDaysAgo
        ) {
          candidates.push({
            patternId: pattern.id,
            reason: `Low effectiveness (${pattern.effectivenessScore}%) for more than 30 days`,
            effectivenessScore: pattern.effectivenessScore,
            usageCount: pattern.usageCount,
            lastUsedAt: pattern.lastUsedAt,
          });
        } else if (
          pattern.successRate < this.DEPRECATION_THRESHOLDS.lowSuccessRate &&
          pattern.usageCount >= this.DEPRECATION_THRESHOLDS.minUsageForSuccessRate
        ) {
          candidates.push({
            patternId: pattern.id,
            reason: `Poor success rate (${pattern.successRate}%) after ${pattern.usageCount} uses`,
            effectivenessScore: pattern.effectivenessScore,
            usageCount: pattern.usageCount,
            lastUsedAt: pattern.lastUsedAt,
          });
        } else if (
          pattern.usageCount === 0 &&
          new Date(pattern.createdAt).getTime() < ninetyDaysAgo
        ) {
          candidates.push({
            patternId: pattern.id,
            reason: 'Unused pattern for more than 90 days',
            effectivenessScore: pattern.effectivenessScore,
            usageCount: pattern.usageCount,
            lastUsedAt: pattern.lastUsedAt,
          });
        }
      }

      return candidates;
    } catch (error: any) {
      console.error('❌ Failed to identify deprecation candidates:', error.message);
      return [];
    }
  }

  private async deprecatePattern(candidate: DeprecationCandidate): Promise<boolean> {
    try {
      console.log(`🗑️ Deprecating pattern ${candidate.patternId.substring(0, 8)}: ${candidate.reason}`);

      const success = await this.databaseService.deprecatePattern(candidate.patternId, candidate.reason);

      if (success) {
        console.log(`✅ Pattern ${candidate.patternId.substring(0, 8)} deprecated successfully`);
      }

      return success;
    } catch (error: any) {
      console.error(`❌ Failed to deprecate pattern ${candidate.patternId}:`, error.message);
      return false;
    }
  }
}

export default PatternEvolutionService;
