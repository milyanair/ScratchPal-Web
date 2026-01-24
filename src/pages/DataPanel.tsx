import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function DataPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'imports' | 'backup'>('imports');

  // CSV Import state
  const [csvUrl, setCsvUrl] = useState('https://scratchpal.com/latest_game_data.csv');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');
  const [lastImportResult, setLastImportResult] = useState<any>(null);
  const [importOffset, setImportOffset] = useState(0);
  const [uploadedCsvUrl, setUploadedCsvUrl] = useState<string>('');
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const [batchInterval, setBatchInterval] = useState('00:15');
  const [batchFrequency, setBatchFrequency] = useState(5);
  const [isSequentialImporting, setIsSequentialImporting] = useState(false);

  // Column Mapping state
  const [columnMapping] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('csv_column_mapping');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {
      game_id: 'game_id',
      state_code: 'state_code',
      game_number: 'game_number',
      game_slug: 'game_slug',
      game_name: 'game_name',
      ticket_price: 'ticket_price',
      image_url: 'image_url',
      top_prize_amount: 'top_prize_amount',
      top_prizes_total_original: 'top_prizes_total_original',
      game_added_date: 'game_added_date',
      start_date: 'start_date',
      end_date: 'end_date',
      source: 'source',
      source_url: 'source_url',
      top_prizes_claimed: 'top_prizes_claimed',
      top_prizes_remaining: 'top_prizes_remaining',
      last_updated: 'last_updated',
    };
  });

  // Image Conversion state
  const [isConvertingImages, setIsConvertingImages] = useState(false);
  const [conversionProgress, setConversionProgress] = useState<string>('');
  const [isClientConverting, setIsClientConverting] = useState(false);
  const [clientConversionProgress, setClientConversionProgress] = useState<string>('');
  const [clientConversionStats, setClientConversionStats] = useState({ converted: 0, failed: 0, total: 0 });

  // Scheduled Import state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('02:00');
  const [scheduleAutoConvert, setScheduleAutoConvert] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Backup state
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);

  // Check user role
  const { data: userProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const isAdmin = userProfile?.role === 'admin';

  const { data: allGames = [], refetch: refetchGames } = useQuery({
    queryKey: ['adminGames'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: importLogs = [], refetch: refetchImportLogs } = useQuery({
    queryKey: ['importLogs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_logs')
        .select('*')
        .order('import_date', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: importSchedule, refetch: refetchSchedule } = useQuery({
    queryKey: ['importSchedule'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_schedule')
        .select('*')
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const { data: backups = [], refetch: refetchBackups } = useQuery({
    queryKey: ['backups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('backups')
        .select('*')
        .order('backup_date', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
  });

  // Update current time every second
  useState(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  });

  // Sync schedule state with database
  useState(() => {
    if (importSchedule) {
      setScheduleEnabled(importSchedule.enabled);
      setScheduledTime(importSchedule.scheduled_time?.substring(0, 5) || '02:00');
      setScheduleAutoConvert(importSchedule.auto_convert_images || false);
    }
  });

  const uploadCsvFile = async (file: File) => {
    setIsUploadingCsv(true);
    try {
      const timestamp = Date.now();
      const filename = `csv_imports/${file.name.replace(/\.csv$/, '')}_${timestamp}.csv`;

      const { error: uploadError } = await supabase.storage
        .from('game-images')
        .upload(filename, file, {
          contentType: 'text/csv',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('game-images')
        .getPublicUrl(filename);

      setUploadedCsvUrl(publicUrlData.publicUrl);
      toast.success(`CSV uploaded: ${file.name}`);
    } catch (error: any) {
      console.error('CSV upload error:', error);
      toast.error(error.message || 'Failed to upload CSV');
    } finally {
      setIsUploadingCsv(false);
    }
  };

  if (isLoadingProfile) {
    return (
      <Layout hideNav>
        <div className="max-w-screen-xl mx-auto px-4 py-6">
          <p className="text-center text-gray-500">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!user || !isAdmin) {
    return (
      <Layout hideNav>
        <div className="max-w-screen-xl mx-auto px-4 py-6 text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 inline-block">
            <h2 className="text-2xl font-bold text-red-800 mb-2">Access Denied</h2>
            <p className="text-red-600 mb-4">
              {!user ? 'Please sign in to access the data panel' : 'You do not have permission to access this page'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="gradient-teal text-white px-6 py-2 rounded-lg font-semibold"
            >
              Return to Home
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideNav>
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Data Management Panel</h1>
            <p className="text-gray-600 mt-1">Import data and manage backups</p>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="text-sm text-gray-600 hover:text-gray-800 border border-gray-300 px-4 py-2 rounded-lg"
          >
            ← Back to Admin Panel
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button onClick={() => setActiveTab('imports')} className={`px-6 py-3 font-semibold transition-colors ${activeTab === 'imports' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Imports</button>
          <button onClick={() => setActiveTab('backup')} className={`px-6 py-3 font-semibold transition-colors ${activeTab === 'backup' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Backup</button>
        </div>

        {/* IMPORTS TAB */}
        {activeTab === 'imports' && (
          <div>
            {/* Scheduled Import Automation */}
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-bold mb-2">🕐 Scheduled Import Automation</h3>
              <p className="text-sm opacity-90 mb-4">Automatically run CSV imports daily at a scheduled time. Handles multi-chunk imports and optional image conversion.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Settings Column */}
                <div className="bg-white/10 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-3">Settings</h4>
                  
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/20">
                    <div>
                      <div className="font-medium">Enable Automation</div>
                      <div className="text-xs opacity-75">Run import daily at scheduled time</div>
                    </div>
                    <button
                      onClick={async () => {
                        const newEnabled = !scheduleEnabled;
                        setScheduleEnabled(newEnabled);
                        try {
                          const { error } = await supabase
                            .from('import_schedule')
                            .upsert({
                              enabled: newEnabled,
                              csv_url: csvUrl,
                              scheduled_time: scheduledTime + ':00',
                              auto_convert_images: scheduleAutoConvert,
                            });
                          if (error) throw error;
                          toast.success(newEnabled ? 'Scheduled import enabled' : 'Scheduled import disabled');
                          refetchSchedule();
                        } catch (error: any) {
                          toast.error(error.message);
                          setScheduleEnabled(!newEnabled);
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        scheduleEnabled ? 'bg-green-500' : 'bg-white/30'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          scheduleEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-semibold mb-2">Daily Run Time (24-hour)</label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      onBlur={async () => {
                        try {
                          const { error } = await supabase
                            .from('import_schedule')
                            .upsert({
                              enabled: scheduleEnabled,
                              csv_url: csvUrl,
                              scheduled_time: scheduledTime + ':00',
                              auto_convert_images: scheduleAutoConvert,
                            });
                          if (error) throw error;
                          toast.success('Schedule time updated');
                          refetchSchedule();
                        } catch (error: any) {
                          toast.error(error.message);
                        }
                      }}
                      className="w-full px-4 py-2 rounded-lg text-gray-800 border-none text-sm"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Auto-Convert Images</div>
                      <div className="text-xs opacity-75">Run image conversion after import</div>
                    </div>
                    <button
                      onClick={async () => {
                        const newValue = !scheduleAutoConvert;
                        setScheduleAutoConvert(newValue);
                        try {
                          const { error } = await supabase
                            .from('import_schedule')
                            .upsert({
                              enabled: scheduleEnabled,
                              csv_url: csvUrl,
                              scheduled_time: scheduledTime + ':00',
                              auto_convert_images: newValue,
                            });
                          if (error) throw error;
                          toast.success('Auto-conversion ' + (newValue ? 'enabled' : 'disabled'));
                          refetchSchedule();
                        } catch (error: any) {
                          toast.error(error.message);
                          setScheduleAutoConvert(!newValue);
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        scheduleAutoConvert ? 'bg-green-500' : 'bg-white/30'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          scheduleAutoConvert ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
                
                {/* Status Column */}
                <div className="bg-white/10 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-3">Status</h4>
                  
                  <div className="mb-4 pb-4 border-b border-white/20">
                    <div className="text-xs opacity-75 mb-1">Current Time</div>
                    <div className="text-2xl font-bold font-mono">
                      {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                    </div>
                  </div>
                  
                  {importSchedule && (
                    <>
                      <div className="mb-3">
                        <div className="text-xs opacity-75 mb-1">Status</div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                            importSchedule.status === 'completed' ? 'bg-green-500/20 text-green-100' :
                            importSchedule.status === 'running' || importSchedule.status === 'importing' || importSchedule.status === 'converting' ? 'bg-blue-500/20 text-blue-100' :
                            importSchedule.status === 'failed' ? 'bg-red-500/20 text-red-100' :
                            'bg-white/20 text-white'
                          }`}>
                            {importSchedule.status === 'importing' ? '📦 Importing...' :
                             importSchedule.status === 'converting' ? '🖼️ Converting...' :
                             importSchedule.status === 'running' ? '⏳ Running...' :
                             importSchedule.status}
                          </span>
                        </div>
                      </div>
                      
                      {importSchedule.last_run_at && (
                        <div className="mb-3">
                          <div className="text-xs opacity-75 mb-1">Last Run</div>
                          <div className="text-sm">{new Date(importSchedule.last_run_at).toLocaleString()}</div>
                        </div>
                      )}
                      
                      {importSchedule.next_run_at && scheduleEnabled && (
                        <div className="mb-3">
                          <div className="text-xs opacity-75 mb-1">Next Run</div>
                          <div className="text-sm">{new Date(importSchedule.next_run_at).toLocaleString()}</div>
                        </div>
                      )}
                      
                      {importSchedule.current_offset > 0 && (
                        <div className="mb-3">
                          <div className="text-xs opacity-75 mb-1">Progress</div>
                          <div className="text-sm">
                            {importSchedule.current_offset} / {importSchedule.total_rows} rows
                            <div className="w-full bg-white/20 rounded-full h-2 mt-1">
                              <div
                                className="bg-white h-2 rounded-full transition-all"
                                style={{ width: `${(importSchedule.current_offset / importSchedule.total_rows) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {importSchedule.error_message && (
                        <div className="bg-red-500/20 rounded p-2 text-xs">
                          <div className="font-semibold mb-1">Error:</div>
                          <div className="opacity-90">{importSchedule.error_message}</div>
                        </div>
                      )}
                    </>
                  )}
                  
                  {!importSchedule && (
                    <div className="text-sm opacity-75">No schedule configured yet. Enable automation to start.</div>
                  )}
                </div>
              </div>
              
              <button
                onClick={async () => {
                  if (!confirm('Manually trigger scheduled import now? This will run the full import process including all batches.')) return;
                  try {
                    toast.info('Starting scheduled import...');
                    const { error } = await supabase.functions.invoke('scheduled-import');
                    if (error) {
                      if (error instanceof FunctionsHttpError) {
                        const errorText = await error.context?.text();
                        throw new Error(errorText || error.message);
                      }
                      throw error;
                    }
                    toast.success('Scheduled import triggered successfully');
                    refetchSchedule();
                    refetchGames();
                    refetchImportLogs();
                  } catch (error: any) {
                    toast.error(error.message || 'Failed to trigger import');
                  }
                }}
                className="w-full mt-4 bg-white text-purple-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                ▶️ Manually Trigger Import Now
              </button>
            </div>

            {/* Two-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT COLUMN - CSV Import */}
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold mb-2">CSV Data Import</h3>
                  <p className="text-sm opacity-90 mb-4">Import game data from CSV file URL. Processes 200 rows per run.</p>
                  
                  <div className="bg-white/10 rounded-lg p-4 mb-4">
                    <label className="block text-sm font-semibold mb-2">CSV File URL</label>
                    <input type="text" value={csvUrl} onChange={(e) => setCsvUrl(e.target.value)} placeholder="https://scratchpal.com/latest_game_data.csv" className="w-full px-4 py-2 rounded-lg text-gray-800 border-none text-sm mb-3" />
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1">Interval (MM:SS)</label>
                        <input
                          type="text"
                          value={batchInterval}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (/^\d{0,2}:\d{0,2}$/.test(val) || /^\d{0,2}$/.test(val)) {
                              setBatchInterval(val);
                            }
                          }}
                          placeholder="00:15"
                          className="w-full px-3 py-2 rounded-lg text-gray-800 border-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Frequency</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={batchFrequency}
                          onChange={(e) => setBatchFrequency(parseInt(e.target.value) || 1)}
                          placeholder="5"
                          className="w-full px-3 py-2 rounded-lg text-gray-800 border-none text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <button onClick={async () => {
                    if (!csvUrl.trim()) {
                      toast.error('Please enter a CSV file URL');
                      return;
                    }
                    setIsDownloadingCsv(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('download-csv', {
                        body: { csvUrl },
                      });
                      if (error) {
                        if (error instanceof FunctionsHttpError) {
                          const errorText = await error.context?.text();
                          throw new Error(errorText || error.message);
                        }
                        throw error;
                      }
                      setCsvUrl(data.url);
                      setUploadedCsvUrl(data.url);
                      toast.success(`CSV downloaded! (${(data.size / 1024).toFixed(1)} KB)`);
                    } catch (error: any) {
                      toast.error(error.message || 'Failed to download CSV');
                    } finally {
                      setIsDownloadingCsv(false);
                    }
                  }} disabled={isDownloadingCsv} className="w-full bg-white/20 border-2 border-white/50 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm mb-3">
                    {isDownloadingCsv ? (<><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />Downloading...</>) : (<>📥 Download to Storage</>)}
                  </button>
                  
                  <button onClick={async () => {
                    if (!csvUrl.trim()) {
                      toast.error('Please enter a CSV file URL');
                      return;
                    }
                    setIsImporting(true);
                    setImportProgress('Processing...');
                    try {
                      const { data, error } = await supabase.functions.invoke('import-csv-data', {
                        body: { csvUrl, offset: importOffset, columnMapping },
                      });
                      if (error) {
                        if (error instanceof FunctionsHttpError) {
                          const errorText = await error.context?.text();
                          throw new Error(errorText || error.message);
                        }
                        throw error;
                      }
                      setLastImportResult(data);
                      setImportProgress('');
                      if (data.has_more) {
                        setImportOffset(data.next_offset);
                        toast.success(`Processed ${data.processed_up_to}/${data.total_rows} rows`);
                      } else {
                        setImportOffset(0);
                        toast.success('Import complete!');
                      }
                      refetchGames();
                      refetchImportLogs();
                    } catch (error: any) {
                      setImportProgress('');
                      toast.error(error.message || 'Import failed');
                      setImportOffset(0);
                    } finally {
                      setIsImporting(false);
                    }
                  }} disabled={isImporting || isSequentialImporting} className="w-full bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm mb-3">
                    {isImporting ? (<><div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full" />Importing...</>) : (<><Plus className="w-4 h-4" />{importOffset > 0 ? `Continue (row ${importOffset + 1})` : 'Import CSV'}</>)}
                  </button>
                  
                  <button onClick={async () => {
                    if (!csvUrl.trim()) {
                      toast.error('Please enter a CSV file URL');
                      return;
                    }
                    
                    const [minutes, seconds] = batchInterval.split(':').map(v => parseInt(v) || 0);
                    const intervalMs = (minutes * 60 + seconds) * 1000;
                    
                    if (intervalMs < 5000) {
                      toast.error('Interval must be at least 5 seconds');
                      return;
                    }
                    
                    setIsSequentialImporting(true);
                    let currentOffset = importOffset;
                    
                    try {
                      for (let i = 0; i < batchFrequency; i++) {
                        setImportProgress(`Batch ${i + 1}/${batchFrequency}...`);
                        
                        const { data, error } = await supabase.functions.invoke('import-csv-data', {
                          body: { csvUrl, offset: currentOffset, columnMapping },
                        });
                        
                        if (error) throw error;
                        
                        setLastImportResult(data);
                        
                        if (data.has_more) {
                          currentOffset = data.next_offset;
                          setImportOffset(currentOffset);
                          if (i < batchFrequency - 1) {
                            await new Promise(resolve => setTimeout(resolve, intervalMs));
                          }
                        } else {
                          setImportOffset(0);
                          break;
                        }
                      }
                      
                      setImportProgress('');
                      toast.success('Sequential import complete!');
                      refetchGames();
                      refetchImportLogs();
                    } catch (error: any) {
                      setImportProgress('');
                      toast.error(error.message);
                    } finally {
                      setIsSequentialImporting(false);
                    }
                  }} disabled={isImporting || isSequentialImporting} className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                    {isSequentialImporting ? (<><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />Running...</>) : (<>🔄 Sequential Import ({batchFrequency}x)</>)}
                  </button>
                  
                  {importProgress && <div className="mt-4 p-3 bg-white/20 rounded-lg text-sm">{importProgress}</div>}
                  
                  {lastImportResult && (
                    <div className="mt-4 bg-white/10 rounded-lg p-4">
                      <h4 className="font-semibold text-sm mb-2">Last Results</h4>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div><div className="opacity-75">Inserted</div><div className="text-xl font-bold text-green-300">{lastImportResult.records_inserted}</div></div>
                        <div><div className="opacity-75">Updated</div><div className="text-xl font-bold text-blue-300">{lastImportResult.records_updated}</div></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Import History */}
                {importLogs.length > 0 && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-bold mb-4">Import History</h3>
                    <div className="space-y-2">
                      {importLogs.slice(0, 5).map((log: any) => (
                        <div key={log.id} className="text-sm border-b pb-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600">{new Date(log.import_date).toLocaleString()}</span>
                            <span className={`font-semibold ${log.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                              {log.status}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            +{log.records_inserted} / ↻{log.records_updated}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN - Image Conversion & Upload */}
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold mb-2">Image Conversion</h3>
                  <p className="text-sm text-gray-600 mb-4">Convert external images to local storage</p>
                  
                  <button onClick={async () => {
                    if (!confirm('Convert all unconverted images?')) return;
                    setIsConvertingImages(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('batch-convert-images', {
                        body: { stateFilter: 'all' },
                      });
                      if (error) throw error;
                      toast.success(`Converted ${data.converted} images`);
                      refetchGames();
                    } catch (error: any) {
                      toast.error(error.message);
                    } finally {
                      setIsConvertingImages(false);
                    }
                  }} disabled={isConvertingImages} className="w-full gradient-teal text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 text-sm">
                    {isConvertingImages ? 'Converting...' : 'Server Batch Convert'}
                  </button>
                  {conversionProgress && <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm">{conversionProgress}</div>}
                </div>

                <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold mb-2">📤 Upload CSV</h3>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files[0];
                      if (file?.name.endsWith('.csv')) await uploadCsvFile(file);
                    }}
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging ? 'border-white bg-white/20' : 'border-white/50 bg-white/10'}`}
                  >
                    <div className="text-4xl mb-2">📁</div>
                    <p className="font-semibold mb-1">Drop CSV Here</p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) await uploadCsvFile(file);
                      }}
                      className="hidden"
                      id="csv-upload"
                      disabled={isUploadingCsv}
                    />
                    <label htmlFor="csv-upload" className="inline-block bg-white text-green-600 px-6 py-2 rounded-lg font-semibold cursor-pointer hover:bg-gray-100 mt-2">
                      {isUploadingCsv ? 'Uploading...' : 'Choose File'}
                    </label>
                  </div>
                  {uploadedCsvUrl && (
                    <div className="mt-4 bg-white/10 rounded-lg p-4">
                      <p className="font-semibold text-sm mb-2">✅ Uploaded!</p>
                      <button onClick={() => { setCsvUrl(uploadedCsvUrl); toast.success('URL set'); }} className="w-full bg-white text-green-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 text-sm">
                        Use This URL
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BACKUP TAB */}
        {activeTab === 'backup' && (
          <div>
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-2">Database Backup & Restore</h2>
              <p className="opacity-90">Create backups and restore from previous versions</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* CREATE BACKUP */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">Create Backup</h3>
                <p className="text-sm text-gray-600 mb-4">Export all database tables to JSON</p>
                
                <button
                  onClick={async () => {
                    if (!confirm('Create a new backup?')) return;
                    setIsCreatingBackup(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('create-backup', {
                        body: { backupType: 'database', userId: user?.id },
                      });
                      if (error) {
                        if (error instanceof FunctionsHttpError) {
                          const errorText = await error.context?.text();
                          throw new Error(errorText || error.message);
                        }
                        throw error;
                      }
                      toast.success(`Backup created! ${data.tables_count} tables`);
                      refetchBackups();
                    } catch (error: any) {
                      toast.error(error.message);
                    } finally {
                      setIsCreatingBackup(false);
                    }
                  }}
                  disabled={isCreatingBackup}
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCreatingBackup ? (<><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />Creating...</>) : (<><Plus className="w-5 h-5" />Create Backup</>)}
                </button>
              </div>

              {/* RESTORE */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">Restore from Backup</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Select Backup</label>
                  <select
                    className="w-full px-4 py-2 border rounded-lg"
                    value={selectedBackupId || ''}
                    onChange={(e) => setSelectedBackupId(e.target.value)}
                  >
                    <option value="">Choose...</option>
                    {backups.filter(b => b.status === 'completed').map(backup => (
                      <option key={backup.id} value={backup.id}>
                        {new Date(backup.backup_date).toLocaleDateString()} ({(backup.file_size / 1024).toFixed(1)} KB)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="replace"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="replace" className="text-sm">Replace existing data</label>
                </div>

                <button
                  onClick={async () => {
                    if (!selectedBackupId) {
                      toast.error('Select a backup');
                      return;
                    }
                    if (!confirm('⚠️ Restore from backup? This will modify your data.')) return;
                    setIsRestoringBackup(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('restore-backup', {
                        body: { backupId: selectedBackupId, replaceExisting },
                      });
                      if (error) throw error;
                      toast.success('Restore complete!');
                      refetchGames();
                      refetchBackups();
                    } catch (error: any) {
                      toast.error(error.message);
                    } finally {
                      setIsRestoringBackup(false);
                    }
                  }}
                  disabled={isRestoringBackup || !selectedBackupId}
                  className="w-full bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isRestoringBackup ? 'Restoring...' : 'Restore Backup'}
                </button>
              </div>
            </div>

            {/* BACKUP HISTORY */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b">
                <h3 className="text-lg font-bold">Backup History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Size</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {backups.map(backup => (
                      <tr key={backup.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{new Date(backup.backup_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            backup.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {backup.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{backup.file_size ? `${(backup.file_size / 1024).toFixed(1)} KB` : '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={async () => {
                              if (!confirm(`Delete backup from ${backup.backup_date}?`)) return;
                              try {
                                if (backup.file_path) {
                                  await supabase.storage.from('backups').remove([backup.file_path]);
                                }
                                await supabase.from('backups').delete().eq('id', backup.id);
                                toast.success('Deleted');
                                refetchBackups();
                              } catch (error: any) {
                                toast.error('Delete failed');
                              }
                            }}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
