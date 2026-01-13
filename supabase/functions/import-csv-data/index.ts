import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface CSVRow {
  game_number: string;
  game_name: string;
  state: string;
  price: number;
  top_prize: number;
  top_prizes_remaining: number;
  total_top_prizes: number;
  overall_odds?: string;
  start_date?: string;
  end_date?: string;
  image_url?: string;
  source?: string;
  source_url?: string;
}

interface ImportResult {
  status: 'success' | 'partial' | 'failed';
  records_processed: number;
  records_inserted: number;
  records_updated: number;
  records_failed: number;
  error_message?: string;
  details: {
    inserted: string[];
    updated: string[];
    failed: Array<{ row: number; error: string }>;
  };
}

function parseCSV(csvText: string): CSVRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  // Detect delimiter (check first line for common delimiters)
  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.split('\t').length > firstLine.split(',').length) {
    delimiter = '\t';
  } else if (firstLine.split(';').length > firstLine.split(',').length) {
    delimiter = ';';
  } else if (firstLine.split('|').length > firstLine.split(',').length) {
    delimiter = '|';
  }
  
  console.log(`Detected delimiter: "${delimiter === '\t' ? '\\t' : delimiter}"`);

  // Parse header
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''));
  console.log(`CSV Headers (${headers.length}):`, headers);
  
  // Parse rows
  const rows: CSVRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // CSV parser (handles quoted fields)
    const values: string[] = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === delimiter && !insideQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim()); // Add last value

    // Map values to CSVRow object
    const row: any = {};
    headers.forEach((header, index) => {
      const value = values[index]?.replace(/"/g, '').trim() || '';
      
      // **EXACT COLUMN NAME MATCHES FIRST** (more reliable for known formats)
      if (header === 'game_number') {
        row.game_number = value;
      } else if (header === 'game_name') {
        row.game_name = value;
      } else if (header === 'state_code' || header === 'state') {
        row.state = value.toUpperCase();
      } else if (header === 'ticket_price' || header === 'price') {
        row.price = parseFloat(value.replace(/[$,]/g, '')) || 0;
      } else if (header === 'top_prize_amount' || header === 'top_prize') {
        row.top_prize = parseFloat(value.replace(/[$,]/g, '')) || 0;
      } else if (header === 'top_prizes_remaining') {
        row.top_prizes_remaining = parseInt(value.replace(/,/g, '')) || 0;
      } else if (header === 'top_prizes_total_original' || header === 'total_top_prizes') {
        row.total_top_prizes = parseInt(value.replace(/,/g, '')) || 0;
      } else if (header === 'overall_odds' || header === 'odds') {
        row.overall_odds = value;
      } else if (header === 'game_added_date' || header === 'start_date') {
        row.start_date = value;
      } else if (header === 'end_date') {
        row.end_date = value;
      } else if (header === 'image_url') {
        row.image_url = value;
      } else if (header === 'source_url') {
        row.source_url = value;
      } else if (header === 'source') {
        row.source = value;
      }
      // **FALLBACK: FUZZY MATCHING** (for non-standard column names)
      else if (header.includes('game') && header.includes('number')) {
        row.game_number = value;
      } else if (header.includes('game') && header.includes('name')) {
        row.game_name = value;
      } else if (header.includes('state')) {
        row.state = value.toUpperCase();
      } else if (header.includes('price')) {
        row.price = parseFloat(value.replace(/[$,]/g, '')) || 0;
      } else if (header.includes('top') && header.includes('prize') && !header.includes('remaining') && !header.includes('total') && !header.includes('claimed')) {
        row.top_prize = parseFloat(value.replace(/[$,]/g, '')) || 0;
      } else if (header.includes('remaining') && !header.includes('claimed')) {
        row.top_prizes_remaining = parseInt(value.replace(/,/g, '')) || 0;
      } else if (header.includes('total') && header.includes('prize') && !header.includes('claimed')) {
        row.total_top_prizes = parseInt(value.replace(/,/g, '')) || 0;
      } else if (header.includes('odds')) {
        row.overall_odds = value;
      } else if ((header.includes('start') || header.includes('added')) && header.includes('date')) {
        row.start_date = value;
      } else if (header.includes('end') && header.includes('date')) {
        row.end_date = value;
      } else if (header.includes('image')) {
        row.image_url = value;
      } else if (header.includes('source') && header.includes('url')) {
        row.source_url = value;
      } else if (header.includes('source') && !header.includes('url')) {
        row.source = value;
      }
    });

    // Debug: Log first row to see what we're getting
    if (i === 1) {
      console.log(`Sample row ${i} values (${values.length}):`, values.slice(0, 5));
      console.log('Mapped row:', JSON.stringify(row, null, 2));
    }

    // Validate required fields
    if (row.game_number && row.game_name && row.state) {
      rows.push(row as CSVRow);
    } else if (i <= 3) {
      // Log why first few rows are rejected
      console.log(`Row ${i} rejected - missing required fields:`, {
        has_game_number: !!row.game_number,
        has_game_name: !!row.game_name,
        has_state: !!row.state,
      });
    }
  }

  console.log(`Successfully parsed ${rows.length} valid rows out of ${lines.length - 1} total rows`);
  return rows;
}

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

    // Initialize Supabase client for Storage access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let csvText: string;

    // **DETECT IF URL IS FROM SUPABASE STORAGE**
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const isSupabaseStorage = csvUrl.includes(supabaseUrl) && csvUrl.includes('/storage/v1/object/public/');

    if (isSupabaseStorage) {
      console.log('✓ Detected Supabase Storage URL - using Storage SDK');
      
      // Extract bucket and path from URL
      // Format: https://{PROJECT}.supabase.co/storage/v1/object/public/{BUCKET}/{PATH}
      const urlParts = csvUrl.split('/storage/v1/object/public/');
      if (urlParts.length !== 2) {
        throw new Error('Invalid Supabase Storage URL format');
      }
      
      const [bucket, ...pathParts] = urlParts[1].split('/');
      const filePath = pathParts.join('/');
      
      console.log(`Downloading from bucket: ${bucket}, path: ${filePath}`);
      
      // Use Storage SDK to download directly (bypasses public URL gateway)
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from(bucket)
        .download(filePath);
      
      if (downloadError) {
        throw new Error(`Storage download failed: ${downloadError.message}`);
      }
      
      csvText = await fileData.text();
      console.log(`✓ Downloaded from Storage SDK, size: ${csvText.length} bytes`);
    } else {
      console.log('Using standard HTTP fetch for external URL');
      
      // Use standard fetch for external URLs
      const csvResponse = await fetch(csvUrl);
    
      console.log(`Response status: ${csvResponse.status} ${csvResponse.statusText}`);
      console.log(`Response content-type: ${csvResponse.headers.get('content-type')}`);
      
      if (!csvResponse.ok) {
        throw new Error(`Failed to download CSV: ${csvResponse.status} ${csvResponse.statusText}`);
      }

      csvText = await csvResponse.text();
      console.log(`✓ CSV downloaded, size: ${csvText.length} bytes`);
      console.log(`✓ First 500 characters: ${csvText.substring(0, 500)}`);
      
      // **CRITICAL: COMPREHENSIVE HTML DETECTION**
      // Check first 1000 characters for ANY signs of HTML
      const preview = csvText.substring(0, 1000).trim().toLowerCase();
      
      // Multiple detection strategies (ANY match = HTML detected)
      const htmlIndicators = [
        preview.startsWith('<html'),
        preview.startsWith('<!doctype'),
        preview.includes('<html>'),
        preview.includes('</html>'),
        preview.includes('<head>'),
        preview.includes('</head>'),
        preview.includes('<body>'),
        preview.includes('</body>'),
        preview.includes('<title>'),
        preview.includes('</title>'),
        // Common error page patterns
        (preview.includes('bad gateway') && preview.includes('<')),
        (preview.includes('not found') && preview.includes('<')),
        (preview.includes('forbidden') && preview.includes('<')),
        (preview.includes('unauthorized') && preview.includes('<')),
        (preview.includes('service unavailable') && preview.includes('<')),
        (preview.includes('<center>') || preview.includes('<h1>')),
      ];
      
      const isHTML = htmlIndicators.some(indicator => indicator);
      
      if (isHTML) {
        console.error('🚨 HTML DETECTED - NOT A CSV FILE!');
        console.error('Response preview:', csvText.substring(0, 1000));
        
        // Extract error title from HTML if available
        const titleMatch = csvText.match(/<title>(.*?)<\/title>/i);
        const errorTitle = titleMatch ? titleMatch[1] : 'Unknown HTML page';
        
        throw new Error(
          `🚨 CSV IMPORT BLOCKED - HTML ERROR PAGE DETECTED\n\n` +
          `The CSV URL returned an HTML error page: "${errorTitle}"\n\n` +
          `COMMON CAUSES:\n` +
          `  • 502 Bad Gateway - Server is down, overloaded, or under maintenance\n` +
          `  • 404 Not Found - File doesn't exist or URL is incorrect\n` +
          `  • 403 Forbidden - Access denied or authentication required\n` +
          `  • 503 Service Unavailable - Server temporarily offline\n` +
          `  • Rate limiting or firewall blocking automated requests\n\n` +
          `TROUBLESHOOTING STEPS:\n` +
          `  1. Open the CSV URL directly in your browser to verify it works\n` +
          `  2. Check if the server is online and responding\n` +
          `  3. Verify the URL is correct (copy-paste carefully)\n` +
          `  4. Try uploading CSV to Supabase Storage (recommended)\n` +
          `  5. Check if authentication/API keys are required\n\n` +
          `URL: ${csvUrl}\n\n` +
          `Response preview:\n${csvText.substring(0, 500)}\n...`
        );
      }
      
      // Check content-type header as secondary validation
      const contentType = csvResponse.headers.get('content-type') || '';
      if (contentType.toLowerCase().includes('text/html')) {
        console.error('🚨 Content-Type header indicates HTML!');
        throw new Error(
          `🚨 INVALID CONTENT TYPE\n\n` +
          `Content-Type header: ${contentType}\n` +
          `Expected: text/csv, text/plain, or application/csv\n\n` +
          `The URL is serving a web page, not a CSV file.\n` +
          `Please verify the URL points to a downloadable CSV file.\n\n` +
          `URL: ${csvUrl}`
        );
      }
      
      console.log('✓ Content validation passed - proceeding with CSV parsing');
    }

    // Parse CSV
    let rows: CSVRow[];
    try {
      rows = parseCSV(csvText);
      console.log(`Parsed ${rows.length} rows from CSV`);
    } catch (parseError: any) {
      throw new Error(`CSV parsing failed: ${parseError.message}`);
    }

    const result: ImportResult = {
      status: 'success',
      records_processed: rows.length,
      records_inserted: 0,
      records_updated: 0,
      records_failed: 0,
      details: {
        inserted: [],
        updated: [],
        failed: [],
      },
    };

    // **SIMPLIFIED BATCH PROCESSING: Use individual lookups to avoid complex OR queries**
    const BATCH_SIZE = 10; // Smaller batches for stability
    console.log(`Processing ${rows.length} rows in batches of ${BATCH_SIZE}...`);
    
    for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, rows.length);
      const batch = rows.slice(batchStart, batchEnd);
      console.log(`Processing batch ${batchStart / BATCH_SIZE + 1} (rows ${batchStart + 1}-${batchEnd})...`);
      
      // Process each row individually to avoid complex queries that trigger 502 errors
      for (let i = 0; i < batch.length; i++) {
        const row = batch[i];
        const rowIndex = batchStart + i;
        
        try {
          // Check if game exists (simple query with 3 exact matches)
          const { data: existingGames, error: checkError } = await supabaseAdmin
            .from('games')
            .select('id, image_converted, source, source_url')
            .eq('game_number', row.game_number)
            .eq('state', row.state)
            .eq('top_prize', row.top_prize)
            .limit(1);
            
          if (checkError) {
            console.error(`Error checking game ${row.game_number}:`, checkError);
            result.records_failed++;
            result.details.failed.push({ row: rowIndex + 2, error: checkError.message });
            continue;
          }
          
          const existing = existingGames && existingGames.length > 0 ? existingGames[0] : null;
          
          if (existing) {
            // Build update object
            const updateObj: any = {
              top_prizes_remaining: row.top_prizes_remaining,
              total_top_prizes: row.total_top_prizes,
              end_date: row.end_date || null,
              updated_at: new Date().toISOString(),
            };

            // Only update image_url if image hasn't been converted AND new image_url exists
            if ((!existing.image_converted || existing.image_converted === false) && row.image_url) {
              updateObj.image_url = row.image_url;
            }

            // Only update source and source_url if current fields are blank/null
            if ((!existing.source || existing.source.trim() === '') && row.source) {
              updateObj.source = row.source;
            }

            if ((!existing.source_url || existing.source_url.trim() === '') && row.source_url) {
              updateObj.source_url = row.source_url;
            }
            
            // Update existing game
            const { error: updateError } = await supabaseAdmin
              .from('games')
              .update(updateObj)
              .eq('id', existing.id);
              
            if (updateError) {
              console.error(`Update error for ${row.game_name}:`, updateError);
              result.records_failed++;
              result.details.failed.push({ row: rowIndex + 2, error: updateError.message });
            } else {
              result.records_updated++;
              result.details.updated.push(row.game_name);
            }
          } else {
            // Insert new game
            const { error: insertError } = await supabaseAdmin
              .from('games')
              .insert({
                game_number: row.game_number,
                game_name: row.game_name,
                state: row.state,
                price: row.price,
                top_prize: row.top_prize,
                top_prizes_remaining: row.top_prizes_remaining,
                total_top_prizes: row.total_top_prizes,
                overall_odds: row.overall_odds || null,
                start_date: row.start_date || null,
                end_date: row.end_date || null,
                image_url: row.image_url || null,
                source: row.source || null,
                source_url: row.source_url || null,
                rank: 0,
              });
              
            if (insertError) {
              console.error(`Insert error for ${row.game_name}:`, insertError);
              result.records_failed++;
              result.details.failed.push({ row: rowIndex + 2, error: insertError.message });
            } else {
              result.records_inserted++;
              result.details.inserted.push(`${row.game_name} (${row.game_number})`);
            }
          }
        } catch (rowError: any) {
          console.error(`Error processing row ${rowIndex + 2}:`, rowError);
          result.records_failed++;
          result.details.failed.push({ row: rowIndex + 2, error: rowError.message });
        }
      }
      
      console.log(`✓ Batch ${batchStart / BATCH_SIZE + 1} complete`);
    }

    // Update result status
    if (result.records_failed === rows.length) {
      result.status = 'failed';
      result.error_message = 'All records failed to import';
    } else if (result.records_failed > 0) {
      result.status = 'partial';
      result.error_message = `${result.records_failed} records failed`;
    }

    // Log import to database
    const { error: logError } = await supabaseAdmin
      .from('import_logs')
      .insert({
        source_url: csvUrl,
        status: result.status,
        records_processed: result.records_processed,
        records_inserted: result.records_inserted,
        records_updated: result.records_updated,
        records_failed: result.records_failed,
        error_message: result.error_message || null,
        details: result.details,
      });

    if (logError) {
      console.error('Failed to log import:', logError);
    }

    // Trigger ranking update if any games were modified
    if (result.records_inserted > 0 || result.records_updated > 0) {
      console.log('Triggering ranking update...');
      const { error: rankError } = await supabaseAdmin.rpc('update_game_ranks');
      if (rankError) {
        console.error('Failed to update rankings:', rankError);
      } else {
        console.log('Rankings updated successfully');
      }
    }

    console.log(`Import complete:`, result);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in import-csv-data function:', error);
    
    return new Response(
      JSON.stringify({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
