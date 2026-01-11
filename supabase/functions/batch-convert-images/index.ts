import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stateFilter } = await req.json();

    console.log('Starting batch image conversion...');

    // Get all games that need conversion (not yet converted or external URLs)
    let query = supabaseAdmin
      .from('games')
      .select('id, game_name, image_url, image_converted, state');

    if (stateFilter && stateFilter !== 'all') {
      query = query.eq('state', stateFilter);
    }

    const { data: games, error: gamesError } = await query;

    if (gamesError) {
      throw gamesError;
    }

    if (!games || games.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No games found', converted: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter games that need conversion
    const gamesToConvert = games.filter(game => {
      if (!game.image_url) return false;
      
      // Skip if already converted to local URL
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      if (game.image_url.includes('play.scratchpal.com') || game.image_url.includes(supabaseUrl)) {
        return false;
      }
      
      return true;
    });

    console.log(`Found ${gamesToConvert.length} games to convert`);

    let converted = 0;
    let failed = 0;
    const errors: any[] = [];

    // Process each game
    for (const game of gamesToConvert) {
      try {
        console.log(`Converting ${game.game_name} (${game.id})`);

        // Download image with retry logic
        let imageResponse;
        let downloadSuccess = false;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            // Add headers to mimic a real browser request
            const headers: Record<string, string> = {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
            };
            
            // Add referer for certain domains
            if (game.image_url.includes('texaslottery.com')) {
              headers['Referer'] = 'https://www.texaslottery.com/';
            } else if (game.image_url.includes('flalottery.com')) {
              headers['Referer'] = 'https://www.flalottery.com/';
            }
            
            imageResponse = await fetch(game.image_url, {
              headers,
              redirect: 'follow',
            });
            
            if (!imageResponse.ok) {
              throw new Error(`HTTP ${imageResponse.status}`);
            }
            
            // **CRITICAL: Check if response is actually an image, not HTML**
            const contentType = imageResponse.headers.get('content-type') || '';
            if (contentType.includes('text/html')) {
              throw new Error(`Invalid content type: ${contentType} - URL returned HTML (likely 404 page)`);
            }
            
            if (!contentType.includes('image/')) {
              throw new Error(`Invalid content type: ${contentType} - Expected image/* but got ${contentType}`);
            }
            
            downloadSuccess = true;
            break;
            
          } catch (err) {
            if (attempt === 3) throw err;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          }
        }
        
        if (!downloadSuccess || !imageResponse) {
          throw new Error('Failed to download after 3 attempts');
        }

        const imageBlob = await imageResponse.blob();
        const imageBuffer = await imageBlob.arrayBuffer();

        // Get file extension
        let extension = 'jpg';
        const urlExtMatch = game.image_url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
        if (urlExtMatch) {
          extension = urlExtMatch[1].toLowerCase();
        } else {
          const contentType = imageResponse.headers.get('content-type');
          if (contentType?.includes('png')) extension = 'png';
          else if (contentType?.includes('gif')) extension = 'gif';
          else if (contentType?.includes('webp')) extension = 'webp';
        }

        // Generate filename
        const timestamp = Date.now();
        const filename = `game_${game.id}_${timestamp}.${extension}`;

        // Upload to Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('game-images')
          .upload(filename, imageBuffer, {
            contentType: imageBlob.type || 'image/jpeg',
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        // Get public URL
        const { data: publicUrlData } = supabaseAdmin.storage
          .from('game-images')
          .getPublicUrl(filename);

        // Update game record
        const { error: updateError } = await supabaseAdmin
          .from('games')
          .update({
            original_image_url: game.image_url,
            image_url: publicUrlData.publicUrl,
            image_converted: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', game.id);

        if (updateError) {
          throw updateError;
        }

        converted++;
        console.log(`✓ Converted ${game.game_name}`);

        // Delay to avoid rate limiting (longer for Texas lottery)
        const delay = game.image_url.includes('texaslottery.com') ? 500 : 200;
        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (error) {
        console.error(`✗ Failed to convert ${game.game_name}:`, error);
        failed++;
        errors.push({
          gameId: game.id,
          gameName: game.game_name,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: gamesToConvert.length,
        converted,
        failed,
        errors: errors.slice(0, 10), // Return first 10 errors
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in batch-convert-images function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
