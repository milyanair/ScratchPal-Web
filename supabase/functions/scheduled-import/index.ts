import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('🕐 Scheduled import job triggered');

    // Get the schedule configuration
    const { data: schedules, error: fetchError } = await supabaseAdmin
      .from('import_schedule')
      .select('*')
      .eq('enabled', true)
      .limit(1);

    if (fetchError) throw fetchError;
    if (!schedules || schedules.length === 0) {
      console.log('ℹ️ No enabled schedules found');
      return new Response(
        JSON.stringify({ message: 'No enabled schedules' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const schedule = schedules[0];
    console.log(`📋 Found schedule: ${schedule.id}, Status: ${schedule.status}`);

    // Check if we should run (prevent overlapping runs)
    if (schedule.status === 'running' || schedule.status === 'importing' || schedule.status === 'converting') {
      console.log('⚠️ Import already running, skipping...');
      return new Response(
        JSON.stringify({ message: 'Import already in progress' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to running
    await supabaseAdmin
      .from('import_schedule')
      .update({
        status: 'running',
        last_run_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', schedule.id);

    console.log('🚀 Starting import process...');

    // **PHASE 1: CSV IMPORT (with chunking)**
    let importComplete = false;
    let currentOffset = schedule.current_offset || 0;
    let totalImported = 0;
    let totalUpdated = 0;
    let importAttempts = 0;
    const MAX_IMPORT_ATTEMPTS = 100; // Safety limit (100 chunks * 200 rows = 20,000 rows max)

    while (!importComplete && importAttempts < MAX_IMPORT_ATTEMPTS) {
      importAttempts++;
      console.log(`📦 Import chunk ${importAttempts}, offset: ${currentOffset}`);

      // Update status
      await supabaseAdmin
        .from('import_schedule')
        .update({
          status: 'importing',
          current_offset: currentOffset,
        })
        .eq('id', schedule.id);

      try {
        // Call import-csv-data edge function
        const { data: importResult, error: importError } = await supabaseAdmin.functions.invoke(
          'import-csv-data',
          {
            body: {
              csvUrl: schedule.csv_url,
              offset: currentOffset,
            },
          }
        );

        if (importError) {
          throw new Error(`Import failed: ${importError.message}`);
        }

        console.log(`✓ Chunk complete: +${importResult.records_inserted} inserted, ↻${importResult.records_updated} updated`);

        totalImported += importResult.records_inserted || 0;
        totalUpdated += importResult.records_updated || 0;

        // Check if there are more rows to process
        if (importResult.has_more) {
          currentOffset = importResult.next_offset;
          console.log(`➡️ More rows to process, continuing from offset ${currentOffset}...`);
          
          // Update progress
          await supabaseAdmin
            .from('import_schedule')
            .update({
              current_offset: currentOffset,
              total_rows: importResult.total_rows,
            })
            .eq('id', schedule.id);

          // Small delay between chunks to avoid overload
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          importComplete = true;
          console.log(`✅ Import complete! Total: +${totalImported} inserted, ↻${totalUpdated} updated`);
        }
      } catch (chunkError: any) {
        console.error(`❌ Chunk ${importAttempts} failed:`, chunkError.message);
        
        // Record error and stop
        await supabaseAdmin
          .from('import_schedule')
          .update({
            status: 'failed',
            error_message: `Import failed at chunk ${importAttempts}: ${chunkError.message}`,
            current_offset: 0, // Reset for next run
          })
          .eq('id', schedule.id);

        return new Response(
          JSON.stringify({
            status: 'failed',
            error: chunkError.message,
            chunks_processed: importAttempts,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (importAttempts >= MAX_IMPORT_ATTEMPTS) {
      console.error('⚠️ Reached maximum import attempts, stopping');
      await supabaseAdmin
        .from('import_schedule')
        .update({
          status: 'failed',
          error_message: `Import stopped after ${MAX_IMPORT_ATTEMPTS} chunks (safety limit)`,
          current_offset: 0,
        })
        .eq('id', schedule.id);
    }

    // **PHASE 2: IMAGE CONVERSION (optional)**
    let conversionResult = null;
    if (schedule.auto_convert_images && importComplete) {
      console.log('🖼️ Starting automatic image conversion...');
      
      await supabaseAdmin
        .from('import_schedule')
        .update({ status: 'converting' })
        .eq('id', schedule.id);

      try {
        const { data: convertData, error: convertError } = await supabaseAdmin.functions.invoke(
          'batch-convert-images',
          { body: { stateFilter: 'all' } }
        );

        if (convertError) {
          throw new Error(`Conversion failed: ${convertError.message}`);
        }

        conversionResult = convertData;
        console.log(`✅ Image conversion complete: ${convertData.converted} converted, ${convertData.failed} failed`);
      } catch (convertError: any) {
        console.error('❌ Image conversion failed:', convertError.message);
        // Don't fail the whole job if conversion fails, just log it
        conversionResult = { error: convertError.message };
      }
    }

    // **FINAL: Mark as completed and calculate next run**
    const nextRunTime = await supabaseAdmin
      .rpc('calculate_next_run_time', { scheduled_time: schedule.scheduled_time });

    await supabaseAdmin
      .from('import_schedule')
      .update({
        status: 'completed',
        current_offset: 0, // Reset for next run
        next_run_at: nextRunTime.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', schedule.id);

    console.log('🎉 Scheduled import job completed successfully!');

    return new Response(
      JSON.stringify({
        status: 'success',
        import: {
          chunks_processed: importAttempts,
          records_inserted: totalImported,
          records_updated: totalUpdated,
        },
        conversion: conversionResult,
        next_run: nextRunTime.data,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Scheduled import job failed:', error);

    // Try to update schedule status
    try {
      await supabaseAdmin
        .from('import_schedule')
        .update({
          status: 'failed',
          error_message: error.message,
          current_offset: 0,
        })
        .limit(1);
    } catch (updateError) {
      console.error('Failed to update schedule status:', updateError);
    }

    return new Response(
      JSON.stringify({
        status: 'failed',
        error: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
