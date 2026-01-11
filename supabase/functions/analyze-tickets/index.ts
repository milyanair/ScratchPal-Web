import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface Game {
  id: string;
  game_name: string;
  game_number: string;
  price: number;
  rank: number;
  top_prizes_remaining: number;
  total_top_prizes: number;
}

interface TicketMatch {
  game: Game;
  confidence: number;
  position: { x: number; y: number };
}

interface ScannerConfig {
  min_confidence_threshold: number;
  ai_temperature: number;
  max_tickets_detected: number;
  ai_model: string;
  fuzzy_match_enabled: boolean;
  include_game_price: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, state, games } = await req.json();

    if (!image || !state || !games) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: image, state, games' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing lottery machine image for state: ${state}`);
    console.log(`Available games: ${games.length}`);

    // Create Supabase client for fetching config
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch scanner configuration
    const { data: configData, error: configError } = await supabase
      .from('scanner_config')
      .select('config_key, config_value');

    if (configError) {
      console.error('Failed to fetch scanner config:', configError);
    }

    // Parse configuration with defaults
    const config: ScannerConfig = {
      min_confidence_threshold: 0.6,
      ai_temperature: 0.1,
      max_tickets_detected: 20,
      ai_model: 'google/gemini-3-flash-preview',
      fuzzy_match_enabled: true,
      include_game_price: true,
    };

    if (configData) {
      configData.forEach((item: any) => {
        const key = item.config_key;
        const value = item.config_value;
        
        if (key === 'min_confidence_threshold') config.min_confidence_threshold = parseFloat(value) || 0.6;
        if (key === 'ai_temperature') config.ai_temperature = parseFloat(value) || 0.1;
        if (key === 'max_tickets_detected') config.max_tickets_detected = parseInt(value) || 20;
        if (key === 'ai_model') config.ai_model = value || 'google/gemini-3-flash-preview';
        if (key === 'fuzzy_match_enabled') config.fuzzy_match_enabled = value === 'true';
        if (key === 'include_game_price') config.include_game_price = value === 'true';
      });
    }

    console.log('Scanner config:', config);

    // Extract base64 image data
    const base64Image = image.replace(/^data:image\/\w+;base64,/, '');

    // Call OnSpace AI vision model
    const aiBaseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');
    const aiApiKey = Deno.env.get('ONSPACE_AI_API_KEY');

    if (!aiBaseUrl || !aiApiKey) {
      throw new Error('OnSpace AI credentials not configured');
    }

    // Create detailed prompt for AI analysis with price info if enabled
    const gamesList = games.map((g: Game) => {
      if (config.include_game_price) {
        return `- ${g.game_name} (Game #${g.game_number}, $${g.price})`;
      } else {
        return `- ${g.game_name} (Game #${g.game_number})`;
      }
    }).join('\n');

    const prompt = `You are analyzing a photo of a lottery ticket vending machine or display board. Your task is to identify all visible scratch-off tickets and match them to the provided game list.

AVAILABLE GAMES IN ${state}:
${gamesList}

CRITICAL INSTRUCTIONS FOR ACCURACY:
1. Look carefully at each visible ticket for:
   - Game name (partial matches OK if confident)
   - Game number (the most reliable identifier)
   - Price point (if visible)
   - Any distinguishing visual features

2. ONLY match tickets you can clearly identify
   - If you can't read the game number or name clearly, DO NOT guess
   - It's better to miss a ticket than to match it incorrectly
   - Confidence should reflect how certain you are (0.0-1.0)

3. For each ticket detected:
   - Extract visible game number (remove any leading zeros, just digits)
   - Find the matching game from the list above
   - Estimate position as percentages (x: 0-100%, y: 0-100%) relative to image center
   - Assign confidence based on clarity (0.9+ = very clear, 0.7-0.9 = mostly clear, 0.5-0.7 = partial visibility)

4. Return ONLY up to ${config.max_tickets_detected} tickets (prioritize highest confidence)

5. Return ONLY valid JSON (no markdown, no code blocks, no explanations):

{
  "matches": [
    {
      "game_number": "1234",
      "confidence": 0.95,
      "position": { "x": 25, "y": 30 },
      "detected_text": "MEGA MONEY"
    }
  ]
}

ACCURACY TIPS:
- Game numbers are usually the most reliable way to identify tickets
- If you see multiple rows/columns of tickets, process them systematically
- Position should be the CENTER of each ticket display
- Higher confidence = clearer visibility of identifying information
- Lower confidence if you're making assumptions or partial matches

Analyze the image now and return JSON only:`;

    console.log(`Calling AI model: ${config.ai_model}`);
    console.log(`Temperature: ${config.ai_temperature}, Max tickets: ${config.max_tickets_detected}`);

    const aiResponse = await fetch(`${aiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.ai_model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: config.ai_temperature,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OnSpace AI error:', errorText);
      throw new Error(`AI analysis failed: ${errorText}`);
    }

    const aiResult = await aiResponse.json();
    console.log('AI Response:', JSON.stringify(aiResult, null, 2));

    const aiContent = aiResult.choices?.[0]?.message?.content;
    
    if (!aiContent) {
      throw new Error('No content in AI response');
    }

    console.log('AI Content:', aiContent);

    // Parse AI response (remove markdown code blocks if present)
    let aiData;
    try {
      const cleanContent = aiContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      aiData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw content:', aiContent);
      throw new Error('Failed to parse AI response as JSON');
    }

    if (!aiData.matches || !Array.isArray(aiData.matches)) {
      console.error('Invalid AI response structure:', aiData);
      throw new Error('AI response missing matches array');
    }

    // Fuzzy matching helper
    const fuzzyMatchGameNumber = (detected: string, actual: string): boolean => {
      if (!config.fuzzy_match_enabled) {
        return detected.toLowerCase() === actual.toLowerCase();
      }
      
      // Remove leading zeros and compare
      const cleanDetected = detected.replace(/^0+/, '');
      const cleanActual = actual.replace(/^0+/, '');
      
      return cleanDetected.toLowerCase() === cleanActual.toLowerCase();
    };

    // Match detected tickets to games database
    const ticketMatches: TicketMatch[] = [];
    const lowConfidenceMatches: any[] = [];

    for (const detection of aiData.matches) {
      if (!detection.game_number || !detection.position || !detection.confidence) {
        console.warn('Skipping invalid detection:', detection);
        continue;
      }

      // Apply confidence threshold
      if (detection.confidence < config.min_confidence_threshold) {
        lowConfidenceMatches.push({
          game_number: detection.game_number,
          confidence: detection.confidence,
          reason: 'Below confidence threshold',
        });
        console.log(`⊘ Rejected (low confidence ${detection.confidence}): Game #${detection.game_number}`);
        continue;
      }

      // Find matching game by game number (with fuzzy matching if enabled)
      const matchedGame = games.find((g: Game) => 
        fuzzyMatchGameNumber(detection.game_number, g.game_number)
      );

      if (matchedGame) {
        ticketMatches.push({
          game: matchedGame,
          confidence: detection.confidence,
          position: detection.position,
        });
        console.log(`✓ Matched: ${matchedGame.game_name} (confidence: ${detection.confidence}) at position (${detection.position.x}%, ${detection.position.y}%)`);
      } else {
        console.warn(`✗ No match found for game #${detection.game_number} (confidence: ${detection.confidence})`);
      }
    }

    console.log(`Successfully matched ${ticketMatches.length} tickets (rejected ${lowConfidenceMatches.length} low confidence)`);

    return new Response(
      JSON.stringify({
        success: true,
        matches: ticketMatches,
        detected_count: aiData.matches.length,
        matched_count: ticketMatches.length,
        rejected_count: lowConfidenceMatches.length,
        config_used: {
          model: config.ai_model,
          min_confidence: config.min_confidence_threshold,
          fuzzy_match: config.fuzzy_match_enabled,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in analyze-tickets function:', error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
