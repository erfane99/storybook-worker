import Anthropic from '@anthropic-ai/sdk';
import type { EnvironmentalDNA, AudienceType } from './constants-and-types.js';

export class ClaudeIntegration {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.client = new Anthropic({ apiKey });
  }

  async analyzeStoryEnvironment(
    story: string,
    audience: AudienceType
  ): Promise<EnvironmentalDNA> {
    const systemInstruction = `You are an expert environmental analyst for children's storybooks.
Focus EXCLUSIVELY on:
- Location and setting details (e.g., "enchanted forest", "suburban backyard")
- Lighting conditions (e.g., "moonlit", "bright afternoon sunlight")
- Time of day (e.g., "dawn", "night", "afternoon")
- Atmospheric elements (e.g., "mysterious fog", "cheerful warmth")

CRITICAL: Never mention character demographics, ages, or any personal attributes.
Return ONLY valid JSON with these exact fields.`;

    const analysisPrompt = `Analyze this story's visual environment:

STORY:
${story}

Return JSON:
{
  "primary_location": "main setting description",
  "time_of_day": "dawn|morning|afternoon|evening|night",
  "lighting_conditions": "detailed lighting description",
  "color_palette": ["color1", "color2", "color3"],
  "atmospheric_mood": "mood description",
  "key_visual_elements": ["element1", "element2"]
}`;

    try {
      console.log('🔵 Calling Claude API for environmental analysis...');
      
      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemInstruction,
        messages: [{
          role: 'user',
          content: analysisPrompt
        }]
      });

      const responseText = message.content[0].type === 'text' 
        ? message.content[0].text 
        : '';
      
      console.log('✅ Claude response received:', responseText.substring(0, 200));
      
      const analysis = JSON.parse(responseText);
      
      // Convert Claude's response to EnvironmentalDNA format
      const environmentalDNA: EnvironmentalDNA = {
        primaryLocation: {
          name: analysis.primary_location || 'story setting',
          type: this.classifyLocationType(analysis.primary_location),
          description: analysis.primary_location,
          keyFeatures: analysis.key_visual_elements || [],
          colorPalette: analysis.color_palette || this.getDefaultColorPalette(analysis.time_of_day, audience),
          architecturalStyle: 'consistent'
        },
        lightingContext: {
          timeOfDay: analysis.time_of_day || 'afternoon',
          weatherCondition: 'pleasant',
          lightingMood: analysis.atmospheric_mood || 'warm',
          shadowDirection: this.determineShadowDirection(analysis.time_of_day),
          consistencyRules: ['maintain_lighting_direction', 'consistent_shadow_intensity']
        },
        visualContinuity: {
          backgroundElements: analysis.key_visual_elements || [],
          recurringObjects: [],
          colorConsistency: {
            dominantColors: analysis.color_palette || [],
            accentColors: [],
            avoidColors: ['jarring_contrasts']
          },
          perspectiveGuidelines: 'consistent_viewpoint_flow'
        },
        metadata: {
          createdAt: new Date().toISOString(),
          processingTime: Date.now(),
          audience,
          consistencyTarget: 'claude_environmental_analysis',
          fallback: false
        }
      };

      console.log('✅ Claude environmental DNA created successfully');
      return environmentalDNA;

    } catch (error: any) {
      console.error('❌ Claude API error:', error);
      throw new Error(`Claude environmental analysis failed: ${error?.message || 'Unknown error'}`);
    }
  }

  private classifyLocationType(location: string): 'indoor' | 'outdoor' | 'mixed' {
    const outdoorKeywords = ['backyard', 'garden', 'forest', 'sky', 'park', 'street', 'field', 'mountain', 'beach'];
    const indoorKeywords = ['room', 'house', 'kitchen', 'bedroom', 'hall', 'classroom', 'cottage'];
    
    const text = location.toLowerCase();
    
    if (outdoorKeywords.some(k => text.includes(k))) return 'outdoor';
    if (indoorKeywords.some(k => text.includes(k))) return 'indoor';
    
    return 'mixed';
  }

  private determineShadowDirection(timeOfDay: string): string {
    const shadowMap: Record<string, string> = {
      'dawn': 'long_shadows_from_east',
      'morning': 'moderate_shadows_from_east',
      'afternoon': 'moderate_shadows_from_west',
      'evening': 'long_shadows_from_west',
      'night': 'soft_diffused_from_overhead_moon'
    };
    
    return shadowMap[timeOfDay] || 'soft_diffused';
  }

  private getDefaultColorPalette(timeOfDay: string, audience: AudienceType): string[] {
    const palettes: Record<string, Record<AudienceType, string[]>> = {
      'night': {
        'children': ['deep_blue', 'purple_night_sky', 'silver_moonlight'],
        'young adults': ['navy_blue', 'dark_purple', 'cool_silver'],
        'adults': ['midnight_blue', 'charcoal', 'muted_silver']
      },
      'afternoon': {
        'children': ['bright_blue', 'sunny_yellow', 'grass_green'],
        'young adults': ['sky_blue', 'warm_gold', 'forest_green'],
        'adults': ['azure_blue', 'amber', 'olive_green']
      }
    };
    
    return palettes[timeOfDay]?.[audience] || palettes['afternoon']['children'];
  }
}