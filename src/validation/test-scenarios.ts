// Test Scenarios for Integration Validation
// Provides predefined test cases for different validation scenarios

import { JobData, JobType } from '../lib/types.js';
import { ValidationConfig } from './integration-validator.js';

export interface TestScenario {
  name: string;
  description: string;
  config: Partial<ValidationConfig>;
  expectedOutcome: 'pass' | 'fail' | 'partial';
  mockJobs?: JobData[];
}

// ===== PREDEFINED TEST SCENARIOS =====

export const TEST_SCENARIOS: Record<string, TestScenario> = {
  // Quick startup validation
  startup: {
    name: 'Startup Validation',
    description: 'Quick validation for system startup readiness',
    config: {
      enableRollback: true,
      criticalFailureThreshold: 0,
      timeoutMs: 60000,
      skipNonCritical: true,
    },
    expectedOutcome: 'pass',
  },

  // Full integration test
  full: {
    name: 'Full Integration Test',
    description: 'Comprehensive validation of all system components',
    config: {
      enableRollback: false,
      criticalFailureThreshold: 2,
      timeoutMs: 300000,
      skipNonCritical: false,
    },
    expectedOutcome: 'pass',
  },

  // Performance focused test
  performance: {
    name: 'Performance Validation',
    description: 'Focus on performance and load testing',
    config: {
      enableRollback: false,
      criticalFailureThreshold: 5,
      timeoutMs: 180000,
      skipNonCritical: true,
    },
    expectedOutcome: 'pass',
  },

  // Degraded mode test
  degraded: {
    name: 'Degraded Mode Test',
    description: 'Test system behavior with some services unavailable',
    config: {
      enableRollback: false,
      criticalFailureThreshold: 10,
      timeoutMs: 120000,
      skipNonCritical: false,
    },
    expectedOutcome: 'partial',
  },

  // Stress test
  stress: {
    name: 'Stress Test',
    description: 'High load validation with aggressive timeouts',
    config: {
      enableRollback: false,
      criticalFailureThreshold: 1,
      timeoutMs: 30000,
      skipNonCritical: false,
    },
    expectedOutcome: 'partial',
  },

  // Production readiness
  production: {
    name: 'Production Readiness',
    description: 'Strict validation for production deployment',
    config: {
      enableRollback: true,
      criticalFailureThreshold: 0,
      timeoutMs: 240000,
      skipNonCritical: false,
    },
    expectedOutcome: 'pass',
  },
};

// ===== MOCK DATA GENERATORS =====

export function generateMockJob(type: JobType, overrides: Partial<JobData> = {}): JobData {
  const baseJob: any = {
    id: `test-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    status: 'pending',
    progress: 0,
    user_id: 'test-user',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    retry_count: 0,
    max_retries: 3,
input_data: { title: '', story: '', characterImage: '', pages: [], audience: 'children' as any },
    result_data: { storybook_id: '', pages: [], has_errors: false },
    ...overrides,
  };

  // Add type-specific input data
  switch (type) {
    case 'cartoonize':
      baseJob.input_data = {
        prompt: 'Test cartoon prompt',
        style: 'cartoon',
        imageUrl: 'https://example.com/test-image.jpg',
        ...overrides.input_data,
      };
      break;

    case 'storybook':
      baseJob.input_data = {
        title: 'Test Storybook',
        story: 'Once upon a time in a test scenario...',
        characterImage: 'https://example.com/character.jpg',
        pages: [
          {
            pageNumber: 1,
            scenes: [
              {
                description: 'Test scene',
                emotion: 'happy',
                imagePrompt: 'A test scene with characters',
              },
            ],
          },
        ],
        audience: 'children',
        isReusedImage: false,
        ...overrides.input_data,
      };
      break;

    case 'auto-story':
      baseJob.input_data = {
        genre: 'adventure',
        characterDescription: 'A brave test character',
        cartoonImageUrl: 'https://example.com/cartoon.jpg',
        audience: 'children',
        ...overrides.input_data,
      };
      break;

    case 'scenes':
      baseJob.input_data = {
        story: 'A test story for scene generation',
        characterImage: 'https://example.com/character.jpg',
        audience: 'children',
        ...overrides.input_data,
      };
      break;

    case 'image-generation':
      baseJob.input_data = {
        image_prompt: 'A test image prompt',
        character_description: 'Test character',
        emotion: 'happy',
        audience: 'children',
        isReusedImage: false,
        ...overrides.input_data,
      };
      break;
  }

  return baseJob;
}

export function generateMockJobBatch(count: number = 10): JobData[] {
  const jobTypes: JobType[] = ['cartoonize', 'storybook', 'auto-story', 'scenes', 'image-generation'];
  const jobs: JobData[] = [];

  for (let i = 0; i < count; i++) {
    const type = jobTypes[i % jobTypes.length];
    jobs.push(generateMockJob(type));
  }

  return jobs;
}

// ===== SCENARIO RUNNER =====

export class ScenarioRunner {
  static async runScenario(scenarioName: string): Promise<any> {
    const scenario = TEST_SCENARIOS[scenarioName];
    if (!scenario) {
      throw new Error(`Unknown test scenario: ${scenarioName}`);
    }

    console.log(`🎭 Running test scenario: ${scenario.name}`);
    console.log(`📝 Description: ${scenario.description}`);

    const { IntegrationValidator } = await import('./integration-validator.js');
    const validator = new IntegrationValidator(scenario.config);

    const startTime = Date.now();
    const report = await validator.validateIntegration();
    const duration = Date.now() - startTime;

    const result = {
      scenario: scenario.name,
      expected: scenario.expectedOutcome,
      actual: report.overall,
      passed: this.evaluateScenarioResult(report.overall, scenario.expectedOutcome),
      duration,
      report,
    };

    console.log(`🎭 Scenario ${scenario.name}: ${result.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`📊 Expected: ${scenario.expectedOutcome}, Actual: ${report.overall}`);

    return result;
  }

  static async runAllScenarios(): Promise<any[]> {
    console.log('🎭 Running all test scenarios...');

    const results = [];
    for (const scenarioName of Object.keys(TEST_SCENARIOS)) {
      try {
        const result = await this.runScenario(scenarioName);
        results.push(result);
      } catch (error: any) {
        console.error(`❌ Scenario ${scenarioName} failed with error:`, error.message);
        results.push({
          scenario: scenarioName,
          expected: TEST_SCENARIOS[scenarioName].expectedOutcome,
          actual: 'error',
          passed: false,
          error: error.message,
        });
      }
    }

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    console.log(`🎭 All scenarios complete: ${passed}/${total} passed`);

    return results;
  }

  private static evaluateScenarioResult(
    actual: 'passed' | 'failed' | 'partial',
    expected: 'pass' | 'fail' | 'partial'
  ): boolean {
    const mapping = { pass: 'passed', fail: 'failed', partial: 'partial' };
    return actual === mapping[expected];
  }
}

export default ScenarioRunner;