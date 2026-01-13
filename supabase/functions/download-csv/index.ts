import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csvUrl } = await req.json();

    if (!csvUrl) {
      return new Response(
        JSON.stringify({ error: 'csvUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Downloading CSV from: ${csvUrl}`);

    // Download CSV from external URL
    const csvResponse = await fetch(csvUrl);
    
    if (!csvResponse.ok) {
      throw new Error(`Failed to download CSV: ${csvResponse.status} ${csvResponse.statusText}`);
    }

    const csvBlob = await csvResponse.blob();
    console.log(`Downloaded CSV, size: ${csvBlob.size} bytes`);

    // Initialize Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generate filename with timestamp
    const timestamp = Date.now();
    const originalFilename = csvUrl.split('/').pop()?.split('?')[0] || 'download.csv';
    const filename = `csv_imports/${originalFilename.replace(/\.csv$/, '')}_${timestamp}.csv`;

    console.log(`Uploading to Storage: ${filename}`);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('game-images')
      .upload(filename, csvBlob, {
        contentType: 'text/csv',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('game-images')
      .getPublicUrl(filename);

    console.log(`✓ CSV uploaded successfully: ${publicUrlData.publicUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrlData.publicUrl,
        filename: filename,
        size: csvBlob.size,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in download-csv function:', error);
    
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
