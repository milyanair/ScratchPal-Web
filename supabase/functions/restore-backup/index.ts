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
    const { backupId, tablesToRestore, replaceExisting = false } = await req.json();

    if (!backupId) {
      throw new Error('backupId is required');
    }

    console.log('🔄 Starting backup restoration...');
    console.log('Backup ID:', backupId);
    console.log('Tables to restore:', tablesToRestore || 'all');
    console.log('Replace existing:', replaceExisting);

    // Get backup metadata
    const { data: backup, error: fetchError } = await supabaseAdmin
      .from('backups')
      .select('*')
      .eq('id', backupId)
      .single();

    if (fetchError) throw fetchError;
    if (!backup.file_path) throw new Error('Backup file path not found');

    console.log('✓ Backup record found:', backup.backup_date);

    // Download backup file from storage
    console.log('📥 Downloading backup file...');
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('backups')
      .download(backup.file_path);

    if (downloadError) throw downloadError;

    const fileContent = await fileData.text();
    const backupData = JSON.parse(fileContent);

    console.log('✓ Backup file downloaded and parsed');
    console.log('Backup version:', backupData.version);
    console.log('Backup created:', backupData.created_at);

    // Determine which tables to restore
    const tablesToProcess = tablesToRestore && tablesToRestore.length > 0
      ? tablesToRestore
      : Object.keys(backupData.tables);

    const results: Record<string, any> = {};

    // Restore each table
    for (const tableName of tablesToProcess) {
      try {
        if (!backupData.tables[tableName]) {
          console.log(`  ⚠️ Table ${tableName} not found in backup, skipping`);
          results[tableName] = { status: 'skipped', reason: 'not in backup' };
          continue;
        }

        const tableData = backupData.tables[tableName];
        console.log(`  Restoring table: ${tableName} (${tableData.length} rows)...`);

        if (replaceExisting) {
          // Delete existing data before inserting
          console.log(`    Deleting existing data from ${tableName}...`);
          const { error: deleteError } = await supabaseAdmin
            .from(tableName)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

          if (deleteError) {
            console.error(`    ❌ Failed to delete from ${tableName}:`, deleteError.message);
            results[tableName] = { status: 'failed', error: deleteError.message, phase: 'delete' };
            continue;
          }
          console.log(`    ✓ Existing data deleted`);
        }

        // Insert backup data in batches (500 rows at a time)
        const BATCH_SIZE = 500;
        let inserted = 0;

        for (let i = 0; i < tableData.length; i += BATCH_SIZE) {
          const batch = tableData.slice(i, Math.min(i + BATCH_SIZE, tableData.length));
          
          const { error: insertError } = await supabaseAdmin
            .from(tableName)
            .insert(batch);

          if (insertError) {
            console.error(`    ❌ Failed to insert batch into ${tableName}:`, insertError.message);
            results[tableName] = { 
              status: 'partial', 
              inserted, 
              total: tableData.length,
              error: insertError.message 
            };
            break;
          }

          inserted += batch.length;
          console.log(`    Progress: ${inserted}/${tableData.length} rows inserted`);
        }

        if (inserted === tableData.length) {
          results[tableName] = { status: 'success', rows_restored: inserted };
          console.log(`  ✓ Successfully restored ${inserted} rows to ${tableName}`);
        }

      } catch (tableError: any) {
        console.error(`  ❌ Error restoring ${tableName}:`, tableError.message);
        results[tableName] = { status: 'failed', error: tableError.message };
      }
    }

    // Count successes and failures
    const successful = Object.values(results).filter((r: any) => r.status === 'success').length;
    const failed = Object.values(results).filter((r: any) => r.status === 'failed').length;
    const partial = Object.values(results).filter((r: any) => r.status === 'partial').length;

    console.log('✅ Restoration completed!');
    console.log(`  Success: ${successful}, Failed: ${failed}, Partial: ${partial}`);

    return new Response(
      JSON.stringify({
        success: true,
        backup_id: backupId,
        backup_date: backup.backup_date,
        tables_processed: tablesToProcess.length,
        results,
        summary: {
          successful,
          failed,
          partial,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Restoration failed:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
