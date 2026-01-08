import Anthropic from '@anthropic-ai/sdk';
import type { EnvironmentalDNA, AudienceType } from './constants-and-types.js';

// ===== COMIC SCRIPT INTERFACES =====
export interface ComicScriptDialogue {
  speaker: string;
  text: string;
  type: 'speech' | 'thought' | 'shout';
}

export interface ComicScriptPanel {
  panelNumber: number;
  narrativePhase: 'OPENING' | 'SETUP' | 'RISING_ACTION' | 'CLIMAX' | 'RESOLUTION';
  narration: string | null;
  dialogue: ComicScriptDialogue[] | null;
  visualDirection: string;
  emotion: string;
  cameraAngle: 'wide' | 'medium' | 'close-up' | 'dramatic';
}

export interface ComicScript {
  title: string;
  storySummary: string;
  characterName: string;
  panels: ComicScriptPanel[];
}

export interface ComicScriptOptions {
  genre: string;
  audience: AudienceType;
  characterDescription: string;
  panelCount: number;
}

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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: [
          {
            type: 'text',
            text: systemInstruction,
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: [{
          role: 'user',
          content: analysisPrompt
        }]
      });

      const responseText = message.content[0].type === 'text' 
        ? message.content[0].text 
        : '';
      
        console.log('✅ Claude response received:', responseText.substring(0, 200));

        // Strip markdown code fences if present
        let cleanedResponse = responseText.trim();
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        const analysis = JSON.parse(cleanedResponse);
      
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
        const errorMessage = `Claude environmental analysis failed: ${error?.message || 'Unknown error'}`;
        
        // Create non-retryable error to fail job immediately
        const criticalError: any = new Error(errorMessage);
        criticalError.retryable = false;
        criticalError.severity = 'critical';
        
        throw criticalError;
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

  /**
   * Analyze story structure to extract cinematic story beats for comic generation
   * @param story - The full story text to analyze
   * @param audience - Target audience type
   * @param analysisPrompt - The complete analysis prompt built by AIService
   * @returns Raw JSON string response (parsed by AIService)
   */
  async analyzeStoryStructure(
    story: string,
    audience: AudienceType,
    analysisPrompt: string
  ): Promise<string> {
    try {
      console.log('🔵 Calling Claude API for story analysis...');
      
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: analysisPrompt
        }]
      });

      const responseText = message.content[0].type === 'text' 
        ? message.content[0].text 
        : '';
      
      console.log('✅ Claude story analysis received:', responseText.substring(0, 200));

      // Claude may wrap response in markdown - strip it
      let cleanedResponse = responseText.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      return cleanedResponse;

    } catch (error: any) {
      console.error('❌ Claude story analysis error:', error);
      throw new Error(`Claude story analysis failed: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate narration text for comic panel
   * @param prompt - The narration generation prompt
   * @returns Generated narration text
   */
  async generateNarrationText(prompt: string): Promise<string> {
    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        temperature: 0.7,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const narration = message.content[0].type === 'text' 
        ? message.content[0].text 
        : '';

      return narration;

    } catch (error: any) {
      console.error('❌ Claude narration generation error:', error);
      throw new Error(`Claude narration generation failed: ${error?.message || 'Unknown error'}`);
    }
  }

  // ===== OPTION C: SINGLE-PASS COMIC SCRIPT GENERATION =====
  
  /**
   * Generate complete comic script in a single API call
   * This replaces 17+ text API calls with 1 structured call
   * 
   * @param options - Comic script generation options
   * @returns Complete comic script with narration, dialogue, and visual directions
   */
  async generateComicScript(options: ComicScriptOptions): Promise<ComicScript> {
    const { genre, audience, characterDescription, panelCount } = options;
    
    console.log(`🎬 Generating complete comic script: ${panelCount} panels for ${audience} audience (${genre} genre)...`);
    
    const audienceRules = this.getAudienceSpecificRules(audience);
    const genreFramework = this.getGenreFramework(genre);
    const fewShotExample = this.getFewShotExample(audience);
    const midpoint = Math.ceil(panelCount / 2);
    const climax = Math.ceil(panelCount * 0.8);
    const end = panelCount;
    
    const systemPrompt = `You are a professional comic book writer creating panel-by-panel scripts. Your output is used DIRECTLY - every word becomes final narration and dialogue. Write with the precision of a published comic writer.`;

    const userPrompt = `<objective>
Create a ${panelCount}-panel ${audience} comic book script for the ${genre} genre.
Character: ${characterDescription}
</objective>

<output_schema>
You MUST return valid JSON matching this exact structure:
{
  "title": "string (3-6 words)",
  "storySummary": "string (50 words - complete story arc)",
  "characterName": "string (extracted or created from description)",
  "panels": [
    {
      "panelNumber": 1-${panelCount},
      "narrativePhase": "OPENING|SETUP|RISING_ACTION|CLIMAX|RESOLUTION",
      "narration": "string (10-15 words for children, 15-25 for YA, 20-40 for adults) OR null for silent panels",
      "dialogue": [{"speaker": "name", "text": "3-8 words", "type": "speech|thought|shout"}] OR null,
      "visualDirection": "string (50-100 words - what to illustrate)",
      "emotion": "string (character's emotional state)",
      "cameraAngle": "wide|medium|close-up|dramatic"
    }
  ]
}
</output_schema>

<comic_narration_philosophy>
GOLDEN RULE: "If the reader can SEE it, don't WRITE it."

NARRATION MUST ADD what images cannot show:
✓ Character's internal THOUGHTS and FEELINGS
✓ TIME context (how long, when, before/after)
✓ BACKSTORY or MEMORY references  
✓ SENSORY details beyond sight (sounds, smells)
✓ STAKES and CONSEQUENCES

NARRATION MUST NEVER describe:
✗ Physical actions visible in the image
✗ Facial expressions the reader can see
✗ Objects or settings shown in illustration
✗ Character poses or positions

NARRATION FOR EMOTIONAL TRANSITIONS:
When character's emotion changes, narration MUST include the REASON:
✓ "Maybe he was just lonely." (explains why Maya's anger turned to understanding)
✓ "She realized some things are better shared." (explains why she decided to forgive)
✗ "Maya felt happy now." (NO - doesn't explain WHY she's happy)
</comic_narration_philosophy>

<panel_distribution_rules>
- Panels 1-2: OPENING - Set scene with narration (who, where, initial state)
- Panels 3-${midpoint}: RISING ACTION - Primarily dialogue (60%+ should have speech)
- Panel ${climax}: CLIMAX - Most intense moment, can be silent or short impactful narration
- Panel ${climax + 1}: TRANSITION - Character processes what happened (realization/understanding)
- Panels ${end - 1}-${end}: RESOLUTION - Conclude ONLY AFTER transition panel explains the emotional shift

SILENT PANELS (narration = null):
- Use for emotional reaction moments
- Maximum 2 silent panels for children, 3 for YA, 4 for adults
- Never 2 silent panels in a row
</panel_distribution_rules>

<emotional_transition_rules>
CRITICAL - Emotional Arc Coherence:

FORBIDDEN TRANSITIONS (will cause story to feel broken):
✗ Character sad in panel N, suddenly happy in panel N+1 without explanation
✗ Character angry in panel N, suddenly calm in panel N+1 without resolution
✗ Major emotional shift with no CAUSE shown or narrated
✗ Resolution panel with positive emotion when previous panel showed unresolved conflict

REQUIRED TRANSITION PATTERN:
For any emotional shift (e.g., sad→happy, scared→brave, angry→calm):
1. Panel N: Show the initial emotional state
2. Panel N+1: Show the REASON for change (realization, action, discovery)
3. Panel N+2: Show the new emotional state

NARRATION MUST BRIDGE EMOTIONS:
When emotion changes between panels, the narration MUST explain WHY:
- BAD: Panel shows Maya sad, next panel shows Maya happy. Narration: "Maya smiled."
- GOOD: Panel shows Maya sad, next panel shows Maya understanding. Narration: "Maybe Teddy was just lonely too."

CLIMAX-TO-RESOLUTION BRIDGE:
The panel IMMEDIATELY after the climax must be a TRANSITION panel that:
- Shows the character's realization or decision
- Narration explains what the character UNDERSTOOD or DECIDED
- Emotion should be: "understanding", "realization", "acceptance", "determination"
- This panel bridges the conflict to the happy resolution

Example valid emotional arc (mystery genre, children):
Panel 10: emotion="shocked" (discovers teddy took cookies)
Panel 11: emotion="understanding" (realizes teddy was lonely) ← REQUIRED BRIDGE
Panel 12: emotion="compassionate" (hugs teddy, narration explains forgiveness)
Panel 13: emotion="happy" (shares cookies)
Panel 14: emotion="content" (lesson learned)

Example INVALID emotional arc (what we want to prevent):
Panel 10: emotion="shocked" (discovers teddy took cookies)
Panel 11: emotion="happy" (shares cookies) ← BROKEN - skipped understanding!
</emotional_transition_rules>

<narration_variety_rules>
CRITICAL - Avoid repetition:
- NEVER start 2+ panels with same words (e.g., "Maya's heart" twice = FAILURE)
- Vary sentence structures (statement, question, exclamation)
- Mix short punchy (5-8 words) with medium (10-15 words)
- Each narration must feel distinct
</narration_variety_rules>

<dialogue_rules>
- 3-8 words per speech bubble (children) / 5-12 words (YA/adults)
- Include 1-3 thought bubbles across the story for internal moments
- Dialogue reveals character AND advances plot
- Each speaker has consistent voice
</dialogue_rules>

<audience_rules>
${audienceRules}
</audience_rules>

<genre_framework>
${genreFramework}
</genre_framework>

<example_output>
${fewShotExample}
</example_output>

Generate the complete comic script now. Return ONLY valid JSON.`;

try {
  const message = await this.client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    temperature: 0.7,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [{
      role: 'user',
      content: userPrompt
    }]
  });

      const responseText = message.content[0].type === 'text' 
        ? message.content[0].text 
        : '';
      
      console.log('✅ Claude comic script received:', responseText.substring(0, 300));

      // Strip markdown code fences if present
      let cleanedResponse = responseText.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Parse and validate JSON
      let script: ComicScript;
      try {
        script = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('❌ Failed to parse comic script JSON:', cleanedResponse.substring(0, 500));
        throw new Error(`CRITICAL: Claude returned invalid JSON for comic script. Cannot proceed.`);
      }
      
      // Validate required fields
      if (!script.title || !script.panels || !Array.isArray(script.panels)) {
        throw new Error(`CRITICAL: Comic script missing required fields (title or panels)`);
      }
      
      if (script.panels.length < panelCount * 0.8) {
        console.warn(`⚠️ Comic script has ${script.panels.length} panels, expected ${panelCount}`);
      }
      
      console.log(`✅ Comic script generated: "${script.title}" with ${script.panels.length} panels`);
      console.log(`   📊 Character: ${script.characterName}`);
      console.log(`   📝 Summary: ${script.storySummary?.substring(0, 100)}...`);
      
      // Log panel distribution
      const silentPanels = script.panels.filter(p => p.narration === null && p.dialogue === null).length;
      const dialoguePanels = script.panels.filter(p => p.dialogue && p.dialogue.length > 0).length;
      console.log(`   🔇 Silent panels: ${silentPanels}`);
      console.log(`   💬 Dialogue panels: ${dialoguePanels}`);
      
      return script;

    } catch (error: any) {
      console.error('❌ Claude comic script generation error:', error);
      const criticalError: any = new Error(`Claude comic script generation failed: ${error?.message || 'Unknown error'}`);
      criticalError.retryable = false;
      criticalError.severity = 'critical';
      throw criticalError;
    }
  }

  /**
   * Get audience-specific rules for the comic script prompt
   */
  private getAudienceSpecificRules(audience: AudienceType): string {
    const rules: Record<string, string> = {
      'children': `CHILDREN'S COMIC RULES (ages 4-8):
- Vocabulary: Grade 2-5 level (happy, sad, big, small, friend, help)
- FORBIDDEN words: kaleidoscope, ethereal, sanctuary, transcendent, melancholy, enigmatic
- Narration: Maximum 15 words per panel
- Dialogue: Maximum 8 words per bubble
- Story: ONE clear problem, ONE clear solution
- Ending: MUST state lesson explicitly ("Maya learned that...")
- FORBIDDEN endings: "The magic would always be there" / "In that moment, everything changed"
- Tone: Warm, safe, educational, wonder-filled`,

      'young adults': `YOUNG ADULT COMIC RULES (ages 12-17):
- Vocabulary: Grade 6-9 level, contemporary tone
- Narration: Maximum 25 words per panel, first-person internal voice encouraged
- Dialogue: Can include age-appropriate slang, authentic teen voice
- Story: Internal AND external conflict, identity themes
- Ending: Growth-oriented, can be bittersweet, room for interpretation
- Tone: Emotionally resonant, respects intelligence, authentic

EMOTIONAL TRANSITION RULES (YOUNG ADULTS):
Young adult readers are sophisticated - they'll notice broken emotional logic.

FORBIDDEN TRANSITIONS:
✗ Brooding/angry in panel N, suddenly cheerful in N+1 without catalyst
✗ Heartbroken in panel N, moved on in N+1 without processing
✗ Internal conflict unresolved, then sudden confidence
✗ Relationship tension, then instant reconciliation

REQUIRED PATTERN FOR EMOTIONAL SHIFTS:
1. Panel N: Establish the emotional state (internal monologue style)
2. Panel N+1: The CATALYST or REALIZATION (this is the bridge)
3. Panel N+2: The new emotional state with EARNED transformation

NARRATION MUST SHOW INTERNAL PROCESSING:
YA readers connect through internal monologue. When emotions shift:
- BAD: "She felt better now." (tells, doesn't show the journey)
- GOOD: "Maybe I'd been looking at this all wrong." (shows the realization)
- GOOD: "For the first time, the silence didn't feel heavy." (implies the shift)

CLIMAX-TO-RESOLUTION BRIDGE:
After the story's peak moment, include a PROCESSING panel:
- emotion: "reflective", "uncertain-hopeful", "quietly-determined", "accepting"
- Narration shows the character making sense of what happened
- This earns the resolution that follows`,

      'adults': `ADULT COMIC RULES (ages 18+):
- Vocabulary: Full range, literary devices welcome
- Narration: Maximum 40 words, psychological depth, subtext over explicit
- Dialogue: Complex, layered, reveals character through what's NOT said
- Story: Moral complexity, nuanced motivations, realistic consequences
- Ending: Thematic resonance, multiple interpretations possible
- Tone: Sophisticated, treats reader as equal, earned emotional payoffs

EMOTIONAL TRANSITION RULES (ADULTS):
Adult readers demand narrative integrity. Emotional shortcuts destroy immersion.

FORBIDDEN TRANSITIONS:
✗ Despair to hope without the turning point shown
✗ Conflict to resolution without the difficult choice
✗ Betrayal to forgiveness without the reckoning
✗ Any emotional 180° without narrative justification

REQUIRED PATTERN FOR EMOTIONAL SHIFTS:
Adult comics earn emotional transitions through:
1. Panel N: The weight of the current state (subtext-heavy)
2. Panel N+1: The moment of shift - often quiet, often small (the bridge)
3. Panel N+2: The new reality, shown through action or implication

NARRATION PHILOSOPHY FOR TRANSITIONS:
Adult narration works through implication and subtext:
- BAD: "He finally understood and felt at peace." (on-the-nose, amateur)
- GOOD: "Some doors, once opened, change the shape of every room." (thematic)
- GOOD: "It wasn't forgiveness. Not yet. But it was a start." (nuanced, earned)

CLIMAX-TO-RESOLUTION BRIDGE:
The moment AFTER the climax is often the most important panel:
- emotion: "resigned-acceptance", "bittersweet", "quiet-resolve", "weary-hope"
- Narration should resonate thematically, not explain literally
- Trust the reader to feel the shift through implication
- Ambiguity can be powerful - not everything needs resolution`
    };
    
    // Normalize audience key (young_adults -> young adults)
    const normalizedAudience = audience.replace(/_/g, ' ');
    return rules[normalizedAudience] || rules['children'];
  }

  /**
   * Get genre-specific story framework
   */
  private getGenreFramework(genre: string): string {
    const frameworks: Record<string, string> = {
      'adventure': `ADVENTURE GENRE:
- Start with a call to action or discovery
- Include physical journey or quest elements
- Build to exciting climax with problem-solving
- End with return home or new beginning`,

      'fantasy': `FANTASY GENRE:
- Establish magical elements early
- Create wonder through impossible elements
- Magic should have consistent rules
- Resolution can use magic but character growth is key`,

      'mystery': `MYSTERY GENRE:
- Open with a puzzle or question
- Plant clues throughout panels
- Build suspense through discovery
- Reveal solution through character's deduction`,

      'friendship': `FRIENDSHIP GENRE:
- Show initial connection or conflict
- Develop relationship through shared experience
- Test the friendship with a challenge
- Resolve with strengthened bond`,

      'family': `FAMILY GENRE:
- Establish family dynamics
- Create situation that tests family bonds
- Show characters learning about each other
- End with appreciation or understanding`,

      'nature': `NATURE/ANIMAL GENRE:
- Showcase natural world beauty
- Include factual elements (age-appropriate)
- Character learns from or with nature
- Environmental awareness without preaching`
    };
    
    return frameworks[genre.toLowerCase()] || frameworks['adventure'];
  }

  /**
   * Get few-shot example for the specified audience
   */
  private getFewShotExample(audience: AudienceType): string {
    const normalizedAudience = audience.replace(/_/g, ' ');
    
    if (normalizedAudience === 'children') {
      return `{
  "title": "Lily and the Brave Little Star",
  "storySummary": "Lily finds a fallen star who is scared to fly back to the sky. By showing the star that being brave means trying even when scared, Lily helps her new friend find courage, learning that she too can be brave.",
  "characterName": "Lily",
  "panels": [
    {
      "panelNumber": 1,
      "narrativePhase": "OPENING",
      "narration": "The night sky sparkled above Lily's backyard.",
      "dialogue": null,
      "visualDirection": "Wide shot of a backyard at night. A young girl (Lily) in pajamas looks up at a starry sky. Warm light from house windows. Fireflies dot the grass.",
      "emotion": "wonder",
      "cameraAngle": "wide"
    },
    {
      "panelNumber": 2,
      "narrativePhase": "SETUP",
      "narration": null,
      "dialogue": [{"speaker": "Lily", "text": "Oh! What's that glow?", "type": "speech"}],
      "visualDirection": "Medium shot of Lily noticing a soft golden glow behind a bush. Her eyes are wide with curiosity. She's taking a step toward it.",
      "emotion": "curious",
      "cameraAngle": "medium"
    },
    {
      "panelNumber": 3,
      "narrativePhase": "SETUP",
      "narration": "Behind the roses, she found something magical.",
      "dialogue": null,
      "visualDirection": "Close-up of a tiny star character with big worried eyes, sitting in the grass. It glows softly gold. Rose petals around it.",
      "emotion": "discovery",
      "cameraAngle": "close-up"
    },
    {
      "panelNumber": 4,
      "narrativePhase": "RISING_ACTION",
      "narration": null,
      "dialogue": [{"speaker": "Star", "text": "I fell down. I'm too scared to fly back.", "type": "speech"}],
      "visualDirection": "Medium shot of Lily kneeling beside the small star. The star's glow flickers dimly. Lily looks concerned.",
      "emotion": "worried",
      "cameraAngle": "medium"
    },
    {
      "panelNumber": 5,
      "narrativePhase": "CLIMAX",
      "narration": "Lily thought about times she felt scared too.",
      "dialogue": null,
      "visualDirection": "Close-up of Lily's face, eyes looking up thoughtfully at the dark sky. The star watches her hopefully.",
      "emotion": "thoughtful",
      "cameraAngle": "close-up"
    },
    {
      "panelNumber": 6,
      "narrativePhase": "RISING_ACTION",
      "narration": "Maybe being brave didn't mean not being scared at all.",
      "dialogue": null,
      "visualDirection": "Medium shot of Lily having a realization, her expression softening with understanding. She looks at the star with gentle eyes.",
      "emotion": "understanding",
      "cameraAngle": "medium"
    },
    {
      "panelNumber": 7,
      "narrativePhase": "RESOLUTION",
      "narration": null,
      "dialogue": [{"speaker": "Lily", "text": "Being brave means trying even when scared!", "type": "speech"}],
      "visualDirection": "Lily holding the star gently in her cupped hands, speaking encouragingly. The star's glow begins to brighten.",
      "emotion": "encouraging",
      "cameraAngle": "medium"
    },
    {
      "panelNumber": 8,
      "narrativePhase": "RESOLUTION",
      "narration": "Lily learned that she could be brave too.",
      "dialogue": null,
      "visualDirection": "Wide shot of Lily waving as the star flies upward, leaving a trail of sparkles. The star glows brightly now. Lily smiles warmly.",
      "emotion": "proud",
      "cameraAngle": "wide"
    }
  ]
}`;
    } else if (normalizedAudience === 'young adults') {
      return `{
  "title": "The Unfollow",
  "storySummary": "After discovering her best friend's secret social media account mocking her, Alex must decide whether to confront her or walk away, learning that some friendships aren't worth saving.",
  "characterName": "Alex",
  "panels": [
    {
      "panelNumber": 1,
      "narrativePhase": "OPENING",
      "narration": "Three years of friendship. Two thousand shared posts. One screenshot that changed everything.",
      "dialogue": null,
      "visualDirection": "Close-up of Alex's phone screen showing a cruel mocking post, her reflection visible in the dark glass",
      "emotion": "shocked",
      "cameraAngle": "close-up"
    },
    {
      "panelNumber": 2,
      "narrativePhase": "SETUP",
      "narration": null,
      "dialogue": [{"speaker": "Alex", "text": "This can't be real.", "type": "whisper"}],
      "visualDirection": "Alex sitting on her bed, phone in trembling hands, room feeling suddenly smaller",
      "emotion": "denial",
      "cameraAngle": "medium"
    },
    {
      "panelNumber": 3,
      "narrativePhase": "RISING_ACTION",
      "narration": "Every inside joke we'd shared. She'd turned them all into punchlines.",
      "dialogue": null,
      "visualDirection": "Alex scrolling through multiple posts, each one a different betrayal, tears forming",
      "emotion": "hurt",
      "cameraAngle": "close-up"
    },
    {
      "panelNumber": 4,
      "narrativePhase": "RISING_ACTION",
      "narration": null,
      "dialogue": [{"speaker": "Alex", "text": "I defended you. Every single time.", "type": "thought"}],
      "visualDirection": "Alex staring at a framed photo of her and Mia, anger mixing with the hurt",
      "emotion": "angry",
      "cameraAngle": "medium"
    },
    {
      "panelNumber": 5,
      "narrativePhase": "RISING_ACTION",
      "narration": "Part of me wanted to screenshot everything. Expose her like she'd exposed me.",
      "dialogue": null,
      "visualDirection": "Alex's finger hovering over the share button, face conflicted",
      "emotion": "conflicted",
      "cameraAngle": "close-up"
    },
    {
      "panelNumber": 6,
      "narrativePhase": "CLIMAX",
      "narration": null,
      "dialogue": [{"speaker": "Alex", "text": "But then I'd just be her.", "type": "thought"}],
      "visualDirection": "Alex lowering her phone, staring at her own reflection in the dark screen",
      "emotion": "realization",
      "cameraAngle": "dramatic"
    },
    {
      "panelNumber": 7,
      "narrativePhase": "RISING_ACTION",
      "narration": "Revenge would feel good for a minute. Then I'd have to live with being that person.",
      "dialogue": null,
      "visualDirection": "Alex standing up, setting the phone face-down on her desk deliberately",
      "emotion": "resolved",
      "cameraAngle": "medium"
    },
    {
      "panelNumber": 8,
      "narrativePhase": "RESOLUTION",
      "narration": null,
      "dialogue": [{"speaker": "Alex", "text": "You don't get to make me smaller.", "type": "speech"}],
      "visualDirection": "Alex pressing the unfollow button, her expression calm but final",
      "emotion": "empowered",
      "cameraAngle": "close-up"
    },
    {
      "panelNumber": 9,
      "narrativePhase": "RESOLUTION",
      "narration": "Some friendships end with explosions. Ours ended with a click.",
      "dialogue": null,
      "visualDirection": "Wide shot of Alex's room, phone on desk, her walking toward the window and light",
      "emotion": "bittersweet",
      "cameraAngle": "wide"
    },
    {
      "panelNumber": 10,
      "narrativePhase": "RESOLUTION",
      "narration": "I'd find people who laughed with me, not at me. And maybe that was the real unfollow.",
      "dialogue": null,
      "visualDirection": "Alex looking out the window at the city, small smile forming, future ahead",
      "emotion": "hopeful",
      "cameraAngle": "medium"
    }
  ]
}`;
    } else {
      // Adults
      return `{
  "title": "The Last Letter",
  "storySummary": "Twenty years after leaving without explanation, David returns to his hometown for his father's funeral, where an undelivered letter reveals the sacrifice that defined both their lives.",
  "characterName": "David",
  "panels": [
    {
      "panelNumber": 1,
      "narrativePhase": "OPENING",
      "narration": "The town hadn't changed. That was the worst part.",
      "dialogue": null,
      "visualDirection": "David's car entering the small town, everything exactly as he left it twenty years ago, afternoon light casting long shadows",
      "emotion": "apprehensive",
      "cameraAngle": "wide"
    },
    {
      "panelNumber": 2,
      "narrativePhase": "SETUP",
      "narration": "Three days. Funeral, estate, gone. That was the plan.",
      "dialogue": null,
      "visualDirection": "David standing outside his childhood home, hand hesitating on the gate he once slammed shut",
      "emotion": "guarded",
      "cameraAngle": "medium"
    },
    {
      "panelNumber": 3,
      "narrativePhase": "RISING_ACTION",
      "narration": null,
      "dialogue": [{"speaker": "David", "text": "Just boxes. Just things.", "type": "thought"}],
      "visualDirection": "David sorting through his father's study, deliberately avoiding the photographs",
      "emotion": "detached",
      "cameraAngle": "medium"
    },
    {
      "panelNumber": 4,
      "narrativePhase": "RISING_ACTION",
      "narration": "We'd spoken six times in twenty years. Five were about money. One was a wrong number.",
      "dialogue": null,
      "visualDirection": "David finding a drawer full of letters, all addressed to him, all marked 'Return to Sender'",
      "emotion": "confused",
      "cameraAngle": "close-up"
    },
    {
      "panelNumber": 5,
      "narrativePhase": "RISING_ACTION",
      "narration": null,
      "dialogue": [{"speaker": "David", "text": "What is this?", "type": "whisper"}],
      "visualDirection": "David holding one envelope, recognizing his own handwriting - letters he'd sent that were never opened",
      "emotion": "unsettled",
      "cameraAngle": "close-up"
    },
    {
      "panelNumber": 6,
      "narrativePhase": "RISING_ACTION",
      "narration": "At the bottom. Different handwriting. His handwriting. Addressed to me. Never sent.",
      "dialogue": null,
      "visualDirection": "David finding a thick envelope at the bottom of the drawer, his father's handwriting, unsealed",
      "emotion": "stunned",
      "cameraAngle": "close-up"
    },
    {
      "panelNumber": 7,
      "narrativePhase": "CLIMAX",
      "narration": "'I told you to leave because the factory was poisoning people. I knew you'd try to expose it. They would have destroyed you. I chose to be the villain in your story so you could have a story at all.'",
      "dialogue": null,
      "visualDirection": "The letter filling the panel, key phrases visible, David's hands trembling at the edges",
      "emotion": "devastated",
      "cameraAngle": "dramatic"
    },
    {
      "panelNumber": 8,
      "narrativePhase": "RISING_ACTION",
      "narration": null,
      "dialogue": null,
      "visualDirection": "David slumped against the desk, letter fallen to the floor, twenty years of anger collapsing",
      "emotion": "shattered",
      "cameraAngle": "wide"
    },
    {
      "panelNumber": 9,
      "narrativePhase": "RISING_ACTION",
      "narration": "He'd carried this alone. Every cold phone call. Every returned letter. He'd let me hate him.",
      "dialogue": null,
      "visualDirection": "David picking up the letter again, reading it in the fading light, seeing his father differently",
      "emotion": "understanding",
      "cameraAngle": "medium"
    },
    {
      "panelNumber": 10,
      "narrativePhase": "RESOLUTION",
      "narration": "Some sacrifices don't ask for gratitude. They can't.",
      "dialogue": null,
      "visualDirection": "David at the window, holding the letter, watching the sun set over the factory that still stands",
      "emotion": "grief",
      "cameraAngle": "medium"
    },
    {
      "panelNumber": 11,
      "narrativePhase": "RESOLUTION",
      "narration": null,
      "dialogue": [{"speaker": "David", "text": "I'm sorry I never asked why.", "type": "whisper"}],
      "visualDirection": "David at the graveside, alone, placing the letter on the fresh earth",
      "emotion": "remorse",
      "cameraAngle": "wide"
    },
    {
      "panelNumber": 12,
      "narrativePhase": "RESOLUTION",
      "narration": "I'd come to bury a stranger. I left knowing my father for the first time.",
      "dialogue": null,
      "visualDirection": "David walking away from the cemetery, the letter staying behind, carrying something heavier and lighter",
      "emotion": "bittersweet-acceptance",
      "cameraAngle": "wide"
    }
  ]
}`;
    }
  }
}