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
    const { tables, backupType = 'database', userId } = await req.json();

    console.log('🗄️ Starting backup creation...');
    console.log('Backup type:', backupType);
    console.log('Tables to backup:', tables || 'all');

    const backupDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Create backup record
    const { data: backupRecord, error: createError } = await supabaseAdmin
      .from('backups')
      .insert({
        backup_date: backupDate,
        backup_type: backupType,
        status: 'in_progress',
        created_by: userId,
      })
      .select()
      .single();

    if (createError) throw createError;

    console.log('✓ Backup record created:', backupRecord.id);

    // Define all tables to backup (excluding system tables)
    const allTables = [
      'games',
      'user_profiles',
      'user_preferences',
      'user_points',
      'points_history',
      'points_config',
      'forum_topics',
      'forum_posts',
      'topic_upvotes',
      'favorites',
      'wins',
      'stores',
      'scanned_images',
      'scan_usage',
      'slider_messages',
      'state_config',
      'import_logs',
      'import_schedule',
      'notifications',
      'notification_preferences',
      'pending_fanfare',
      'referral_codes',
      'referrals',
      'scanner_config',
    ];

    const tablesToBackup = tables && tables.length > 0 ? tables : allTables;
    const backupData: Record<string, any> = {};
    const metadata: Record<string, number> = {};

    // Export each table
    for (const tableName of tablesToBackup) {
      try {
        console.log(`  Exporting table: ${tableName}...`);
        
        const { data, error, count } = await supabaseAdmin
          .from(tableName)
          .select('*', { count: 'exact' });

        if (error) {
          console.error(`  ❌ Failed to export ${tableName}:`, error.message);
          continue;
        }

        backupData[tableName] = data || [];
        metadata[tableName] = count || 0;
        console.log(`  ✓ Exported ${count} rows from ${tableName}`);
      } catch (tableError: any) {
        console.error(`  ❌ Error exporting ${tableName}:`, tableError.message);
      }
    }

    // Create JSON backup file
    const backupContent = JSON.stringify({
      version: '1.0',
      created_at: new Date().toISOString(),
      backup_date: backupDate,
      backup_type: backupType,
      tables: backupData,
      metadata: metadata,
    }, null, 2);

    const fileName = `${backupDate}/${backupType}_${Date.now()}.json`;
    const fileBlob = new Blob([backupContent], { type: 'application/json' });

    // Upload to storage
    console.log('📤 Uploading backup file to storage...');
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('backups')
      .upload(fileName, fileBlob, {
        contentType: 'application/json',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    console.log('✓ Backup file uploaded:', fileName);

    // Update backup record
    const { error: updateError } = await supabaseAdmin
      .from('backups')
      .update({
        status: 'completed',
        file_path: fileName,
        file_size: new Blob([backupContent]).size,
        tables_backed_up: tablesToBackup,
        metadata: metadata,
        completed_at: new Date().toISOString(),
      })
      .eq('id', backupRecord.id);

    if (updateError) throw updateError;

    console.log('✅ Backup completed successfully!');

    return new Response(
      JSON.stringify({
        success: true,
        backup_id: backupRecord.id,
        backup_date: backupDate,
        file_path: fileName,
        file_size: new Blob([backupContent]).size,
        tables_count: tablesToBackup.length,
        total_rows: Object.values(metadata).reduce((sum: number, count: any) => sum + count, 0),
        metadata,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Backup creation failed:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
