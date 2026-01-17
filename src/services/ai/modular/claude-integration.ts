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
  // NEW: Story-introduced characters that need visual consistency
  storyCharacters?: StoryIntroducedCharacter[];
}

// NEW: Characters introduced by the story (animals, creatures, supporting characters)
export interface StoryIntroducedCharacter {
  name: string;                    // e.g., "Bella the Butterfly", "Wise Owl"
  type: 'animal' | 'creature' | 'person' | 'magical';  // Category for rendering
  species?: string;                // e.g., "butterfly", "owl", "fox"
  visualDescription: string;       // Detailed visual description for consistency
  colorScheme: string[];           // e.g., ["orange", "black", "white spots"]
  distinctiveFeatures: string[];   // e.g., ["large blue wings", "friendly eyes"]
  panelsAppearingIn: number[];     // Which panels this character appears in
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
  "storyCharacters": [
    {
      "name": "string (character name, e.g., 'Bella the Butterfly')",
      "type": "animal|creature|person|magical",
      "species": "string (e.g., 'butterfly', 'owl', 'fox') OR null for persons",
      "visualDescription": "string (30-50 words - DETAILED visual description for AI image consistency)",
      "colorScheme": ["color1", "color2"],
      "distinctiveFeatures": ["feature1", "feature2"],
      "panelsAppearingIn": [1, 3, 5, 7]
    }
  ],
  "panels": [
    {
      "panelNumber": 1-${panelCount},
      "narrativePhase": "OPENING|SETUP|RISING_ACTION|CLIMAX|RESOLUTION",
      "narration": "string (10-15 words for children, 15-25 for YA, 20-40 for adults) OR null for silent panels",
      "dialogue": [{"speaker": "name", "text": "3-8 words", "type": "speech|thought|shout"}] OR null,
      "visualDirection": "string (50-100 words - what to illustrate)",
      "emotion": "string (character's emotional state)",
      "cameraAngle": "wide|medium|close-up|low-angle|high-angle|over-shoulder|dramatic"
    }
  ]
}
</output_schema>

<story_characters_extraction>
🦋 CRITICAL: EXTRACT ALL NON-MAIN CHARACTERS FOR VISUAL CONSISTENCY

Any animal, creature, magical being, or supporting person you introduce in your story MUST be added to the "storyCharacters" array so they can be rendered IDENTICALLY in every panel.

FOR EACH CHARACTER, PROVIDE:
1. "name": A memorable name (e.g., "Sunny the Butterfly", "Oliver the Owl", "Grandma Rose")
2. "type": Category - "animal" | "creature" | "person" | "magical"
3. "species": Specific type (butterfly, owl, fox, fairy) OR null for human persons
4. "visualDescription": DETAILED 30-50 word description the AI can use to draw them IDENTICALLY every time:
   - Exact body shape and size relative to main character
   - Specific colors (NOT "colorful" → "bright orange with black stripes")
   - Facial features and expression style
   - Any clothing, accessories, or distinguishing marks
5. "colorScheme": Array of 2-4 specific colors that define this character
6. "distinctiveFeatures": 2-3 unique visual traits that make them instantly recognizable
7. "panelsAppearingIn": Array of panel numbers where this character appears

EXAMPLE (butterfly):
{
  "name": "Sunny the Butterfly",
  "type": "animal",
  "species": "monarch butterfly",
  "visualDescription": "A friendly monarch butterfly with bright orange wings featuring bold black vein patterns and delicate white spots along the wing edges. Has large, expressive sky-blue eyes with long eyelashes, small curled antennae with round golden tips, and a warm welcoming smile. Body is fuzzy black with orange stripes. About the size of the main character's open palm.",
  "colorScheme": ["bright orange", "black", "white spots", "sky-blue eyes", "golden antenna tips"],
  "distinctiveFeatures": ["white spots along wing edges", "large sky-blue eyes with lashes", "golden-tipped curled antennae"],
  "panelsAppearingIn": [2, 3, 4, 5, 6, 7, 8]
}

EXAMPLE (supporting person):
{
  "name": "Grandma Rose",
  "type": "person",
  "species": null,
  "visualDescription": "A warm, elderly woman with soft wrinkled skin, silver-gray hair in a neat bun, and kind hazel eyes behind round gold-rimmed glasses. Wears a lavender cardigan over a cream blouse with a small rose brooch. Has a gentle, knowing smile and slightly stooped posture. About twice the height of the main child character.",
  "colorScheme": ["silver-gray hair", "lavender cardigan", "cream blouse", "gold glasses"],
  "distinctiveFeatures": ["round gold-rimmed glasses", "rose brooch", "silver hair in bun"],
  "panelsAppearingIn": [1, 8, 12, 14]
}

IF NO ADDITIONAL CHARACTERS (solo story): Return empty array → "storyCharacters": []
</story_characters_extraction>

<camera_angle_rules>
🎥 MANDATORY CAMERA ANGLE VARIETY (Professional Comic Standard):

STORY POSITION DETERMINES CAMERA:
- Panel 1 (OPENING): MUST be "wide" - establish the world
- Panels 2-3 (SETUP): Mix of "medium" and "close-up"  
- Climax panel (~panel ${Math.ceil(panelCount * 0.75)}): MUST be "close-up" - maximum emotion
- Final panel: MUST be "wide" or "medium" - sense of closure

EMOTION DETERMINES CAMERA:
- Triumph/pride/brave → "low-angle" (character looks heroic)
- Sad/scared/overwhelmed → "high-angle" (character looks small)
- Shock/realization/discovery → "close-up" (capture the feeling)
- Confusion/tension → "dramatic" (visual unease)
- Conversation → "medium" or "over-shoulder"

VARIETY REQUIREMENTS:
- NEVER use the same cameraAngle for 3+ consecutive panels
- Must use at least 4 different camera angles across all panels
- Opening and climax panels must have DIFFERENT angles

FORBIDDEN PATTERNS:
✗ All medium shots (boring, no visual variety)
✗ Same angle repeated 3+ times in a row
✗ Opening panel NOT being "wide"
✗ Climax panel NOT being "close-up" or "dramatic"
</camera_angle_rules>

<comic_narration_philosophy>
🚨 CRITICAL NARRATION RULE - READ BEFORE EVERY PANEL 🚨

THE #1 RULE: "If the reader can SEE it in the image, do NOT write it in narration."

BEFORE writing each narration, ask yourself: "Can the reader see this in the picture?"
- If YES → DO NOT WRITE IT (the image already shows it)
- If NO → This is GOOD narration material (adds invisible context)

═══════════════════════════════════════════════════════════════
EXAMPLES OF BAD vs GOOD NARRATION (STUDY CAREFULLY):
═══════════════════════════════════════════════════════════════

❌ BAD: "Maya played in the sunny garden."
   WHY BAD: Reader can SEE the garden and SEE Maya playing!
✅ GOOD: "Every morning brought new wonders to discover."
   WHY GOOD: Reader cannot see "every morning" or Maya's sense of wonder - narration ADDS this!

❌ BAD: "She bent down to look at the flower."
   WHY BAD: Reader can SEE her bending down!
✅ GOOD: "Her heart beat faster. Would it fly away?"
   WHY GOOD: Reader cannot see heartbeat or internal question - narration ADDS this!

❌ BAD: "The butterfly landed on her hand."
   WHY BAD: Reader can SEE the butterfly on her hand!
✅ GOOD: "She had never been this gentle before."
   WHY GOOD: Reader cannot see comparison to past behavior - narration ADDS this!

❌ BAD: "Maya smiled and jumped up and down."
   WHY BAD: Reader can SEE smiling and jumping!
✅ GOOD: "This was the best day ever!"
   WHY GOOD: Reader cannot see Maya's internal evaluation - narration ADDS this!

❌ BAD: "She walked toward the other children."
   WHY BAD: Reader can SEE her walking!
✅ GOOD: "Maybe they would want to be friends too."
   WHY GOOD: Reader cannot see Maya's hope/thought - narration ADDS this!

═══════════════════════════════════════════════════════════════
WHAT NARRATION MUST ADD (invisible to the reader):
═══════════════════════════════════════════════════════════════
✓ Character's THOUGHTS: "Maybe this could work."
✓ Character's FEELINGS: "Her heart swelled with pride."
✓ Character's HOPES/FEARS: "What if they said no?"
✓ TIME context: "Every morning..." / "For the first time..."
✓ MEMORY/BACKSTORY: "She had never tried this before."
✓ SENSORY beyond sight: "The flowers smelled so sweet."
✓ STAKES: "This was her only chance."
✓ INTERNAL CHANGE: "Something felt different now."

═══════════════════════════════════════════════════════════════
WHAT NARRATION MUST NEVER DESCRIBE (visible to the reader):
═══════════════════════════════════════════════════════════════
✗ Physical actions: walking, running, sitting, standing, reaching
✗ Facial expressions: smiling, frowning, crying
✗ Body positions: bending, kneeling, jumping
✗ Setting descriptions: sunny garden, tall trees, blue sky
✗ Object descriptions: pretty flower, colorful butterfly
✗ What characters are wearing or holding

═══════════════════════════════════════════════════════════════
SELF-CHECK FOR EVERY NARRATION:
═══════════════════════════════════════════════════════════════
Before finalizing each narration, verify:
□ Does this describe something the image will show? → REWRITE
□ Does this add thoughts, feelings, time, or stakes? → GOOD
□ Would removing this lose important invisible context? → KEEP IT

EMOTIONAL TRANSITIONS:
When character's emotion changes, narration MUST explain WHY:
✓ "Maybe he was just lonely too." (explains shift from fear to understanding)
✓ "She realized friends help each other." (explains shift from hesitant to brave)
✗ "Maya felt happy now." (NO - doesn't explain WHY)
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
- Tone: Warm, safe, educational, wonder-filled

GRAMMAR RULES (CRITICAL - CHILDREN):
- ALL dialogue MUST use complete, grammatically correct sentences
- NEVER drop auxiliary verbs: WRONG "I hungry" → CORRECT "I'm hungry"
- NEVER drop articles: WRONG "Want cookie" → CORRECT "I want a cookie"
- Children's books use SIMPLE grammar, not BROKEN grammar
- CORRECT examples: "I can help!", "Let's go!", "I'm scared.", "Thank you!", "Can I try?"
- WRONG examples: "Me help", "I hungry", "Want go", "Me scared"

ENDING RULES (CRITICAL - EXACTLY ONE LESSON):
- The FINAL panel must contain EXACTLY ONE simple lesson
- Format: "[Character name] learned that [concrete lesson]."
- The lesson must be CONCRETE and ACTIONABLE
- GOOD lessons: "sharing makes friends happy", "trying new things can be fun", "asking for help is okay"
- BAD lessons: "magic lives in our hearts", "wonder is everywhere", "the adventure never ends"
- FORBIDDEN: Multiple lesson statements across different panels
- FORBIDDEN endings: "The magic would always be there" / "In that moment, everything changed"
- Only the LAST panel states the lesson - previous panels show the OUTCOME/CELEBRATION`,

      'young adults': `YOUNG ADULT COMIC RULES (ages 12-17):
- Vocabulary: Grade 6-9 level, contemporary tone
- Narration: Maximum 25 words per panel, first-person internal voice encouraged
- Dialogue: Can include age-appropriate slang, authentic teen voice
- Story: Internal AND external conflict, identity themes
- Tone: Emotionally resonant, respects intelligence, authentic

DIALOGUE AUTHENTICITY (CRITICAL - YOUNG ADULTS):
- Dialogue must sound like real teenagers, not adults writing teenagers
- Slang is okay but don't overdo it - teens speak normally most of the time
- Contractions are natural: "I'm", "don't", "can't", "won't"
- Avoid formal speech patterns that no teen would use
- GOOD: "Wait, seriously?", "I didn't mean for this to happen", "Just... give me a sec"
- BAD: "I am most distressed by this situation", "One must consider the consequences"

ENDING RULES (CRITICAL - NO PREACHING):
- Show transformation through ACTION and CHOICE, not stated lessons
- The character demonstrates growth - readers infer the meaning
- FORBIDDEN: "And so [character] learned that...", "The moral of the story...", "This taught [character] that..."
- GOOD endings: Character makes a different choice than they would have at the start
- GOOD endings: Quiet moment showing the character has changed
- Can be bittersweet - not everything needs to be perfectly resolved
- ONE resolution moment, not multiple philosophical statements

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
- Tone: Sophisticated, treats reader as equal, earned emotional payoffs

DIALOGUE SOPHISTICATION (CRITICAL - ADULTS):
- Dialogue reveals character through subtext and what's left unsaid
- People rarely say exactly what they mean - show this
- Interruptions, trailing off, subject changes are realistic
- Each character has a distinct voice based on background
- GOOD: "I'm fine." (when clearly not fine - reader sees the gap)
- BAD: "I am feeling sad because of what happened earlier and I wish things were different"

ENDING RULES (CRITICAL - NO OVERSIMPLIFICATION):
- Endings should resonate thematically, not state themes explicitly
- Trust readers to understand without being told
- FORBIDDEN: "And they all lived happily ever after", "[Character] finally understood that..."
- FORBIDDEN: Neat resolutions that ignore complexity established earlier
- GOOD endings: Ambiguity that invites reflection
- GOOD endings: Bittersweet moments that honor the story's complexity
- ONE thematic resolution moment - not multiple concluding statements
- The ending should feel inevitable yet surprising

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
- End with return home or new beginning

OBSTACLE PLAUSIBILITY (CRITICAL FOR ALL AUDIENCES):
Obstacles MUST be genuinely challenging for the character's abilities:
- For toddlers/young children: reaching high places, crossing small gaps, finding hidden things, helping creatures stuck in places they can't reach
- For teens: social challenges, moral dilemmas, proving themselves, navigating complex relationships
- For adults: psychological barriers, systemic obstacles, conflicting loyalties, meaningful sacrifices
BAD OBSTACLES (too trivial): lifting a leaf, opening an unlocked door, walking a short distance
GOOD OBSTACLES require genuine effort, courage, cleverness, or sacrifice to overcome
Ask: "Would this character actually struggle with this?" If no, make it harder.`,

      'fantasy': `FANTASY GENRE:
- Establish magical elements early
- Create wonder through impossible elements
- Magic should have consistent rules
- Resolution can use magic but character growth is key

OBSTACLE PLAUSIBILITY (CRITICAL FOR ALL AUDIENCES):
Even in fantasy, obstacles must feel genuinely challenging:
- Magic should have COSTS or LIMITATIONS that create real stakes
- The character's non-magical qualities (courage, kindness, cleverness) should matter
- For children: magical creatures need help only the character can provide, magical items are hard to reach/earn
- For teens/adults: magical power comes with moral weight, easy solutions have consequences
BAD: Magic solves everything effortlessly
GOOD: Magic creates as many problems as it solves, requiring character growth`,

      'mystery': `MYSTERY GENRE:
- Open with a puzzle or question
- Plant clues throughout panels
- Build suspense through discovery
- Reveal solution through character's deduction

OBSTACLE PLAUSIBILITY (CRITICAL FOR ALL AUDIENCES):
The mystery must be appropriately challenging:
- For children: clues should be findable but not obvious, solution requires connecting 2-3 observations
- For teens: red herrings, social dynamics complicate investigation, personal stakes
- For adults: layered mysteries, unreliable information, moral complexity in the truth
BAD: Mystery solved by accident or single obvious clue
GOOD: Character must actively investigate, make mistakes, and piece things together`,

      'friendship': `FRIENDSHIP GENRE:
- Show initial connection or conflict
- Develop relationship through shared experience
- Test the friendship with a challenge
- Resolve with strengthened bond

OBSTACLE PLAUSIBILITY (CRITICAL FOR ALL AUDIENCES):
Friendship challenges must feel real:
- For children: misunderstandings, sharing conflicts, different preferences, being left out
- For teens: loyalty tests, peer pressure, jealousy, growing apart, betrayal and forgiveness
- For adults: life changes, distance, competing priorities, deep-seated patterns
BAD: Trivial disagreement instantly resolved with "sorry"
GOOD: Conflict reveals something true about the characters that must be worked through`,

      'family': `FAMILY GENRE:
- Establish family dynamics
- Create situation that tests family bonds
- Show characters learning about each other
- End with appreciation or understanding

OBSTACLE PLAUSIBILITY (CRITICAL FOR ALL AUDIENCES):
Family challenges must have real emotional weight:
- For children: new sibling adjustment, parent attention, feeling different, family rules
- For teens: independence vs. connection, family expectations, generational gaps, family secrets
- For adults: caregiving, inheritance, long-held resentments, family patterns repeating
BAD: Surface-level disagreement with easy reconciliation
GOOD: Challenge reveals deeper family dynamics that characters must navigate`,

      'nature': `NATURE/ANIMAL GENRE:
- Showcase natural world beauty
- Include factual elements (age-appropriate)
- Character learns from or with nature
- Environmental awareness without preaching

OBSTACLE PLAUSIBILITY (CRITICAL FOR ALL AUDIENCES):
Nature-based challenges must respect natural world realities:
- For children: weather changes, animal needs differ from human needs, nature requires patience
- For teens: human impact on nature, survival challenges, connection vs. exploitation
- For adults: ecological complexity, competing needs, long-term consequences
BAD: Nature instantly cooperates with human wishes
GOOD: Character must adapt to nature's rhythms and rules, not the other way around`,

      'courage': `COURAGE GENRE:
- Character faces a fear or daunting challenge
- Show the internal struggle alongside external obstacles
- Build to a moment requiring brave action
- Resolution shows growth, not just success

OBSTACLE PLAUSIBILITY (CRITICAL FOR ALL AUDIENCES):
The fear or challenge must be proportionally significant:
- For children: age-appropriate fears (dark, new situations, performing), real emotional stakes
- For teens: social fears, standing up for beliefs, risking rejection
- For adults: existential fears, moral courage, sacrificing comfort for principle
BAD: Fear is trivial or overcome instantly
GOOD: Courage is hard-won and the fear was genuinely threatening`,

      'creativity': `CREATIVITY GENRE:
- Character has a creative vision or problem needing creative solution
- Show the creative process with setbacks
- Climax involves breakthrough or artistic expression
- Resolution celebrates unique perspective

OBSTACLE PLAUSIBILITY (CRITICAL FOR ALL AUDIENCES):
Creative challenges must feel genuinely difficult:
- For children: materials don't work as expected, others don't understand the vision, self-doubt
- For teens: creative block, criticism, balancing originality with acceptance
- For adults: artistic integrity vs. commercial pressure, creative exhaustion, finding authentic voice
BAD: Perfect creation emerges effortlessly
GOOD: Creation requires iteration, failure, and persistence`
    };
    
    return frameworks[genre.toLowerCase()] || frameworks['adventure'];
  }
/**
   * Get few-shot example for the specified audience
   * IMPROVED: All narrations now demonstrate "invisible context" principle
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
    "narration": "Every night, Lily hoped to find something magical.",
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
    "narration": "Her heart beat fast. Could this really be...?",
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
    "narration": "Lily remembered feeling scared too, sometimes.",
    "dialogue": null,
    "visualDirection": "Close-up of Lily's face, eyes looking up thoughtfully at the dark sky. The star watches her hopefully.",
    "emotion": "thoughtful",
    "cameraAngle": "close-up"
  },
  {
    "panelNumber": 6,
    "narrativePhase": "RISING_ACTION",
    "narration": "Maybe being brave meant trying anyway.",
    "dialogue": null,
    "visualDirection": "Medium shot of Lily having a realization, her expression softening with understanding. She looks at the star with gentle eyes.",
    "emotion": "understanding",
    "cameraAngle": "medium"
  },
  {
    "panelNumber": 7,
    "narrativePhase": "RESOLUTION",
    "narration": null,
    "dialogue": [{"speaker": "Lily", "text": "You can do it! I believe in you!", "type": "speech"}],
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
    "narration": "Every inside joke we'd shared—she'd turned them all into punchlines for strangers.",
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
    "narration": "Part of me wanted to screenshot everything. Make her feel exactly what I felt.",
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
    "narration": "Revenge would taste sweet for a minute. Then I'd have to live with being that person forever.",
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
    "narration": "Some friendships end with explosions. This one ended with a single click.",
    "dialogue": null,
    "visualDirection": "Wide shot of Alex's room, phone on desk, her walking toward the window and light",
    "emotion": "bittersweet",
    "cameraAngle": "wide"
  },
  {
    "panelNumber": 10,
    "narrativePhase": "RESOLUTION",
    "narration": "Somewhere out there were people who'd laugh with me, not at me. And that was worth finding.",
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
    "narration": "Twenty years, and the town hadn't changed. That was the cruelest part.",
    "dialogue": null,
    "visualDirection": "David's car entering the small town, everything exactly as he left it twenty years ago, afternoon light casting long shadows",
    "emotion": "apprehensive",
    "cameraAngle": "wide"
  },
  {
    "panelNumber": 2,
    "narrativePhase": "SETUP",
    "narration": "Three days. Funeral, estate, gone. That was the plan. Plans are what we make when we think we're still in control.",
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
    "narration": "Six phone calls in twenty years. Five about money. One was a wrong number he'd pretended was intentional.",
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
    "narration": "His handwriting. The same scrawl that had signed every cold birthday card. But this one had never been sent.",
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
    "narration": "Every cold silence. Every returned letter. Every birthday ignored. He'd made himself the monster so David could escape.",
    "dialogue": null,
    "visualDirection": "David picking up the letter again, reading it in the fading light, seeing his father differently",
    "emotion": "understanding",
    "cameraAngle": "medium"
  },
  {
    "panelNumber": 10,
    "narrativePhase": "RESOLUTION",
    "narration": "Some sacrifices don't ask for gratitude. They can't afford to.",
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
    "narration": "He'd come to bury a stranger. He left knowing his father for the first time.",
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