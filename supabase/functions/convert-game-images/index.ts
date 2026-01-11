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
    const { gameId, imageUrl } = await req.json();

    if (!gameId || !imageUrl) {
      return new Response(
        JSON.stringify({ error: 'gameId and imageUrl are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Converting image for game ${gameId}: ${imageUrl}`);

    // Check if already converted to local URL
    if (imageUrl.includes('play.scratchpal.com') || imageUrl.includes(Deno.env.get('SUPABASE_URL') || '')) {
      console.log('Image already converted to local URL');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Image already converted',
          localUrl: imageUrl 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download image from original URL with retry logic
    console.log('Downloading image from original URL...');
    let imageResponse;
    let lastError;
    
    // Try up to 3 times with different strategies
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Download attempt ${attempt}/3`);
        
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
        if (imageUrl.includes('texaslottery.com')) {
          headers['Referer'] = 'https://www.texaslottery.com/';
        } else if (imageUrl.includes('flalottery.com')) {
          headers['Referer'] = 'https://www.flalottery.com/';
        }
        
        imageResponse = await fetch(imageUrl, {
          headers,
          redirect: 'follow',
        });
        
        if (!imageResponse.ok) {
          throw new Error(`HTTP ${imageResponse.status}: ${imageResponse.statusText}`);
        }
        
        // Success!
        console.log(`Download successful on attempt ${attempt}`);
        break;
        
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error.message);
        lastError = error;
        
        // Wait before retry (exponential backoff)
        if (attempt < 3) {
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    // If all attempts failed
    if (!imageResponse) {
      console.error('All download attempts failed:', lastError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to download image from original URL after 3 attempts',
          details: lastError?.message || 'Unknown error',
          url: imageUrl
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageBlob = await imageResponse.blob();
    const imageBuffer = await imageBlob.arrayBuffer();

    // Get file extension from URL or content type
    let extension = 'jpg';
    const urlExtMatch = imageUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
    if (urlExtMatch) {
      extension = urlExtMatch[1].toLowerCase();
    } else {
      const contentType = imageResponse.headers.get('content-type');
      if (contentType?.includes('png')) extension = 'png';
      else if (contentType?.includes('gif')) extension = 'gif';
      else if (contentType?.includes('webp')) extension = 'webp';
    }

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `game_${gameId}_${timestamp}.${extension}`;
    const filePath = `${filename}`;

    console.log(`Uploading to Storage: ${filePath}`);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('game-images')
      .upload(filePath, imageBuffer, {
        contentType: imageBlob.type || 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload image to storage', details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Upload successful:', uploadData);

    // Get public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('game-images')
      .getPublicUrl(filePath);

    const localUrl = publicUrlData.publicUrl;

    console.log('Public URL:', localUrl);

    // Update game record
    const { error: updateError } = await supabaseAdmin
      .from('games')
      .update({
        original_image_url: imageUrl,
        image_url: localUrl,
        image_converted: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', gameId);

    if (updateError) {
      console.error('Database update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update game record', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Game record updated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        localUrl,
        originalUrl: imageUrl,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in convert-game-images function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
