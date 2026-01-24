import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SliderMessage, Game } from '@/types';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Pencil, Trash2, Plus, Search, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { AdminRewards } from './AdminRewards';
import { AdminStates } from './AdminStates';
import { SavedScanCard } from '@/components/SavedScanCard';

export function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeMainTab, setActiveMainTab] = useState<'imports' | 'games' | 'member-services' | 'scanner' | 'backup'>('imports');
  const [gamesSubTab, setGamesSubTab] = useState<'manager' | 'states' | 'state-games' | 'rankings'>(() => {
    // Check URL hash for direct linking
    const hash = window.location.hash.replace('#', '');
    if (hash === 'state-games') return 'state-games';
    if (hash === 'states') return 'states';
    if (hash === 'rankings') return 'rankings';
    return 'manager';
  });
  const [memberServicesSubTab, setMemberServicesSubTab] = useState<'slider' | 'announcements' | 'users' | 'rewards'>('slider');
  const [scannerSubTab, setScannerSubTab] = useState<'scans' | 'settings'>('scans');
  
  // ... rest of state variables (unchanged)
  const [isUpdatingRanks, setIsUpdatingRanks] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isConvertingImages, setIsConvertingImages] = useState(false);
  const [conversionProgress, setConversionProgress] = useState<string>('');
  const [isClientConverting, setIsClientConverting] = useState(false);
  const [clientConversionProgress, setClientConversionProgress] = useState<string>('');
  const [clientConversionStats, setClientConversionStats] = useState({ converted: 0, failed: 0, total: 0 });
  const [editingMessage, setEditingMessage] = useState<SliderMessage | null>(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

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
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>(() => {
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
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [isDetectingColumns, setIsDetectingColumns] = useState(false);

  // Game Manager state
  const [gameSearch, setGameSearch] = useState('');
  const [gameStateFilter, setGameStateFilter] = useState('all');
  const [gamePriceFilter, setGamePriceFilter] = useState('all');
  const [gameSortBy, setGameSortBy] = useState<'rank' | 'name' | 'price' | 'prizes' | 'converted' | 'game' | 'state' | 'top_prize'>('rank');
  const [gameSortOrder, setGameSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Ranking System state
  const [rankingSortBy, setRankingSortBy] = useState<'state' | 'price_group' | 'total_games' | 'avg_rank' | 'top_rank'>('state');
  const [rankingSortOrder, setRankingSortOrder] = useState<'asc' | 'desc'>('asc');

  // User Management state
  const [userSearch, setUserSearch] = useState('');
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(20);
  const [userSortBy, setUserSortBy] = useState<'username' | 'points' | 'topics' | 'replies' | 'referrals' | 'created'>('points');
  const [userSortOrder, setUserSortOrder] = useState<'asc' | 'desc'>('desc');

  // Announcements state
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false);

  // Scheduled Import state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('02:00');
  const [scheduleAutoConvert, setScheduleAutoConvert] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Backup state
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [selectedTablesToBackup, setSelectedTablesToBackup] = useState<string[]>([]);
  const [selectedTablesToRestore, setSelectedTablesToRestore] = useState<string[]>([]);
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

  // ... continue with queries and other logic
  const { data: usersData = [], refetch: refetchUsers } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, email, role');
      
      if (profilesError) throw profilesError;

      const { data: points, error: pointsError } = await supabase
        .from('user_points')
        .select('user_id, total_points');
      
      if (pointsError) throw pointsError;

      const userStats = await Promise.all(
        profiles.map(async (profile) => {
          const { count: topicsCount } = await supabase
            .from('forum_topics')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id);

          const { count: postsCount } = await supabase
            .from('forum_posts')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id);

          const { count: favoritesCount } = await supabase
            .from('favorites')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id);

          const { data: referrals } = await supabase
            .from('referrals')
            .select('is_signup')
            .eq('referrer_id', profile.id);

          const referralVisits = referrals?.filter(r => !r.is_signup).length || 0;
          const referralSignups = referrals?.filter(r => r.is_signup).length || 0;

          const userPoints = points.find(p => p.user_id === profile.id);

          return {
            ...profile,
            total_points: userPoints?.total_points || 0,
            topics_count: topicsCount || 0,
            posts_count: postsCount || 0,
            favorites_count: favoritesCount || 0,
            referral_visits: referralVisits,
            referral_signups: referralSignups,
          };
        })
      );

      return userStats;
    },
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['adminSliderMessages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('slider_messages')
        .select('*')
        .order('display_order');
      
      if (error) throw error;
      return data as SliderMessage[];
    },
  });

  const { data: allGames = [], refetch: refetchGames } = useQuery({
    queryKey: ['adminGames'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Game[];
    },
  });

  const { data: scannerConfig = [], refetch: refetchScannerConfig } = useQuery({
    queryKey: ['scannerConfig'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanner_config')
        .select('*')
        .order('config_key');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: allScans = [], refetch: refetchScans } = useQuery({
    queryKey: ['adminScans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanned_images')
        .select('*, user_profiles(username, email)')
        .order('created_at', { ascending: false })
        .limit(100);
      
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
      
      if (error && error.code !== 'PGRST116') throw error; // Ignore "no rows returned" error
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

  const availableStates = useMemo(() => {
    const states = new Set(allGames.map(g => g.state));
    return Array.from(states).sort();
  }, [allGames]);

  const filteredAndSortedGames = useMemo(() => {
    let filtered = [...allGames];

    if (gameSearch.trim()) {
      const searchLower = gameSearch.toLowerCase();
      filtered = filtered.filter(
        (game) =>
          game.game_name.toLowerCase().includes(searchLower) ||
          game.game_number.toLowerCase().includes(searchLower) ||
          game.state.toLowerCase().includes(searchLower)
      );
    }

    if (gameStateFilter !== 'all') {
      filtered = filtered.filter((game) => game.state === gameStateFilter);
    }

    if (gamePriceFilter !== 'all') {
      if (gamePriceFilter === '1-5') {
        filtered = filtered.filter((game) => game.price >= 1 && game.price <= 5);
      } else if (gamePriceFilter === '6-10') {
        filtered = filtered.filter((game) => game.price >= 6 && game.price <= 10);
      } else if (gamePriceFilter === '11-20') {
        filtered = filtered.filter((game) => game.price >= 11 && game.price <= 20);
      } else if (gamePriceFilter === '21-50') {
        filtered = filtered.filter((game) => game.price >= 21 && game.price <= 50);
      }
    }

    filtered.sort((a, b) => {
      let compareValue = 0;

      if (gameSortBy === 'rank') {
        compareValue = (b.rank || 0) - (a.rank || 0);
      } else if (gameSortBy === 'name' || gameSortBy === 'game') {
        compareValue = a.game_name.localeCompare(b.game_name);
      } else if (gameSortBy === 'state') {
        compareValue = a.state.localeCompare(b.state);
      } else if (gameSortBy === 'price') {
        compareValue = a.price - b.price;
      } else if (gameSortBy === 'top_prize') {
        compareValue = (a.top_prize || 0) - (b.top_prize || 0);
      } else if (gameSortBy === 'prizes') {
        compareValue = b.top_prizes_remaining - a.top_prizes_remaining;
      } else if (gameSortBy === 'converted') {
        compareValue = (a.image_converted ? 1 : 0) - (b.image_converted ? 1 : 0);
      }

      return gameSortOrder === 'asc' ? compareValue : -compareValue;
    });

    return filtered;
  }, [allGames, gameSearch, gameStateFilter, gamePriceFilter, gameSortBy, gameSortOrder]);

  const totalGames = filteredAndSortedGames.length;
  const totalPages = Math.ceil(totalGames / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalGames);
  const paginatedGames = filteredAndSortedGames.slice(startIndex, endIndex);

  useMemo(() => {
    setCurrentPage(1);
  }, [gameSearch, gameStateFilter, gamePriceFilter, gameSortBy, gameSortOrder]);

  const { data: rankingSummaryRaw = [], refetch: refetchRankingSummary } = useQuery({
    queryKey: ['rankingSummary'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_ranking_summary');
      if (error) throw error;
      return data;
    },
  });

  const rankingSummary = useMemo(() => {
    const sorted = [...rankingSummaryRaw];
    sorted.sort((a, b) => {
      let compareValue = 0;

      if (rankingSortBy === 'state') {
        compareValue = a.state.localeCompare(b.state);
      } else if (rankingSortBy === 'price_group') {
        compareValue = a.price_group.localeCompare(b.price_group);
      } else if (rankingSortBy === 'total_games') {
        compareValue = a.total_games - b.total_games;
      } else if (rankingSortBy === 'avg_rank') {
        compareValue = (a.avg_rank || 0) - (b.avg_rank || 0);
      } else if (rankingSortBy === 'top_rank') {
        compareValue = (a.top_rank || 0) - (b.top_rank || 0);
      }

      return rankingSortOrder === 'asc' ? compareValue : -compareValue;
    });
    return sorted;
  }, [rankingSummaryRaw, rankingSortBy, rankingSortOrder]);

  const handleUpdateRanks = async () => {
    setIsUpdatingRanks(true);
    try {
      const { error } = await supabase.rpc('update_game_ranks');
      if (error) throw error;
      toast.success('Rankings updated successfully!');
      refetchGames();
      refetchRankingSummary();
    } catch (error) {
      console.error('Error updating ranks:', error);
      toast.error('Failed to update rankings');
    } finally {
      setIsUpdatingRanks(false);
    }
  };

  const deleteMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('slider_messages')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Message deleted');
      refetchMessages();
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  };

  const deleteGame = async (id: string) => {
    try {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Game deleted');
      refetchGames();
    } catch (error) {
      console.error('Error deleting game:', error);
      toast.error('Failed to delete game');
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

  const uploadCsvFile = async (file: File) => {
    setIsUploadingCsv(true);
    try {
      const timestamp = Date.now();
      const filename = `csv_imports/${file.name.replace(/\.csv$/, '')}_${timestamp}.csv`;

      console.log('Uploading CSV to:', filename);

      const { data: uploadData, error: uploadError } = await supabase.storage
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

  if (!user || !isAdmin) {
    return (
      <Layout hideNav>
        <div className="max-w-screen-xl mx-auto px-4 py-6 text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 inline-block">
            <h2 className="text-2xl font-bold text-red-800 mb-2">Access Denied</h2>
            <p className="text-red-600 mb-4">
              {!user ? 'Please sign in to access the admin panel' : 'You do not have permission to access this page'}
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
        <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>

        {/* Main Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button onClick={() => setActiveMainTab('imports')} className={`px-6 py-3 font-semibold transition-colors ${activeMainTab === 'imports' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Imports</button>
          <button onClick={() => setActiveMainTab('games')} className={`px-6 py-3 font-semibold transition-colors ${activeMainTab === 'games' ? 'border-b-2 border-teal text-teal' : 'text-gray-500 hover:text-gray-700'}`}>Games</button>
          <button onClick={() => setActiveMainTab('member-services')} className={`px-6 py-3 font-semibold transition-colors ${activeMainTab === 'member-services' ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>Member Services</button>
          <button onClick={() => setActiveMainTab('scanner')} className={`px-6 py-3 font-semibold transition-colors ${activeMainTab === 'scanner' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>Scanner</button>
          <button onClick={() => setActiveMainTab('backup')} className={`px-6 py-3 font-semibold transition-colors ${activeMainTab === 'backup' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Backup</button>
        </div>

        {/* Games Subtabs */}
        {activeMainTab === 'games' && (
          <div className="flex gap-2 mb-6 border-b bg-gray-50 -mx-4 px-4 py-2">
            <button onClick={() => { setGamesSubTab('manager'); window.location.hash = 'manager'; }} className={`px-4 py-2 text-sm font-semibold transition-colors ${gamesSubTab === 'manager' ? 'border-b-2 border-teal text-teal' : 'text-gray-500 hover:text-gray-700'}`}>Game Manager</button>
            <button onClick={() => { setGamesSubTab('states'); window.location.hash = 'states'; }} className={`px-4 py-2 text-sm font-semibold transition-colors ${gamesSubTab === 'states' ? 'border-b-2 border-teal text-teal' : 'text-gray-500 hover:text-gray-700'}`}>States</button>
            <button onClick={() => { setGamesSubTab('state-games'); window.location.hash = 'state-games'; }} className={`px-4 py-2 text-sm font-semibold transition-colors ${gamesSubTab === 'state-games' ? 'border-b-2 border-teal text-teal' : 'text-gray-500 hover:text-gray-700'}`}>State Games</button>
            <button onClick={() => { setGamesSubTab('rankings'); window.location.hash = 'rankings'; }} className={`px-4 py-2 text-sm font-semibold transition-colors ${gamesSubTab === 'rankings' ? 'border-b-2 border-teal text-teal' : 'text-gray-500 hover:text-gray-700'}`}>Ranking System</button>
          </div>
        )}

        {/* Scanner Subtabs */}
        {activeMainTab === 'scanner' && (
          <div className="flex gap-2 mb-6 border-b bg-gray-50 -mx-4 px-4 py-2">
            <button onClick={() => setScannerSubTab('scans')} className={`px-4 py-2 text-sm font-semibold transition-colors ${scannerSubTab === 'scans' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>Scans</button>
            <button onClick={() => setScannerSubTab('settings')} className={`px-4 py-2 text-sm font-semibold transition-colors ${scannerSubTab === 'settings' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>Settings</button>
          </div>
        )}

        {/* Member Services Subtabs */}
        {activeMainTab === 'member-services' && (
          <div className="flex gap-2 mb-6 border-b bg-gray-50 -mx-4 px-4 py-2">
            <button onClick={() => setMemberServicesSubTab('slider')} className={`px-4 py-2 text-sm font-semibold transition-colors ${memberServicesSubTab === 'slider' ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>Slider Messages</button>
            <button onClick={() => setMemberServicesSubTab('announcements')} className={`px-4 py-2 text-sm font-semibold transition-colors ${memberServicesSubTab === 'announcements' ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>Announcements</button>
            <button onClick={() => setMemberServicesSubTab('users')} className={`px-4 py-2 text-sm font-semibold transition-colors ${memberServicesSubTab === 'users' ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>Users</button>
            <button onClick={() => setMemberServicesSubTab('rewards')} className={`px-4 py-2 text-sm font-semibold transition-colors ${memberServicesSubTab === 'rewards' ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>Rewards</button>
          </div>
        )}

        {/* GAMES - STATE GAMES */}
        {activeMainTab === 'games' && gamesSubTab === 'state-games' && (
          <div>
            <div className="bg-gradient-to-r from-teal to-cyan-600 text-white rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-2">Active Games by State</h2>
              <p className="opacity-90">View all active games (no end date or end date in the future) grouped by state</p>
            </div>

            {(() => {
              // Filter active games
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              const activeGames = allGames.filter(game => {
                if (!game.end_date) return true; // No end date = active
                const endDate = new Date(game.end_date);
                endDate.setHours(0, 0, 0, 0);
                return endDate >= today; // End date hasn't passed
              });

              // Group by state
              const gamesByState: Record<string, Game[]> = {};
              activeGames.forEach(game => {
                if (!gamesByState[game.state]) {
                  gamesByState[game.state] = [];
                }
                gamesByState[game.state].push(game);
              });

              // Sort states alphabetically
              const sortedStates = Object.keys(gamesByState).sort();

              // Group games by price within each state
              const gamesByStateAndPrice: Record<string, Record<string, Game[]>> = {};
              
              Object.entries(gamesByState).forEach(([state, games]) => {
                gamesByStateAndPrice[state] = {
                  '$1-$5': [],
                  '$6-$10': [],
                  '$11-$20': [],
                  '$21-$50': [],
                };
                
                games.forEach(game => {
                  if (game.price >= 1 && game.price <= 5) {
                    gamesByStateAndPrice[state]['$1-$5'].push(game);
                  } else if (game.price >= 6 && game.price <= 10) {
                    gamesByStateAndPrice[state]['$6-$10'].push(game);
                  } else if (game.price >= 11 && game.price <= 20) {
                    gamesByStateAndPrice[state]['$11-$20'].push(game);
                  } else if (game.price >= 21 && game.price <= 50) {
                    gamesByStateAndPrice[state]['$21-$50'].push(game);
                  }
                });
              });

              return (
                <div className="space-y-8">
                  {/* Quick Index Section */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-xl font-bold mb-4">Quick Index</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sortedStates.map(state => (
                        <div key={state} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <h4 className="font-bold text-lg mb-2">{state}</h4>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(gamesByStateAndPrice[state]).map(([priceRange, games]) => {
                              if (games.length === 0) return null;
                              const firstGame = games[0];
                              const slug = firstGame.slug || `${firstGame.game_number}-${firstGame.game_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                              return (
                                <a
                                  key={priceRange}
                                  href={`/games/${firstGame.state}/${firstGame.price}/${slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-medium text-teal hover:underline bg-teal/10 px-2 py-1 rounded"
                                >
                                  {priceRange} ({games.length})
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* State Sections */}
                  {sortedStates.map(state => (
                    <div key={state} id={`state-${state}`} className="bg-white rounded-lg shadow p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold mb-2">{state}</h3>
                          <div className="flex flex-wrap gap-3">
                            {Object.entries(gamesByStateAndPrice[state]).map(([priceRange, games]) => {
                              if (games.length === 0) return null;
                              const firstGame = games[0];
                              const slug = firstGame.slug || `${firstGame.game_number}-${firstGame.game_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                              return (
                                <a
                                  key={priceRange}
                                  href={`/games/${firstGame.state}/${firstGame.price}/${slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-teal hover:underline"
                                >
                                  {priceRange} ({games.length})
                                </a>
                              );
                            })}
                          </div>
                        </div>
                        <span className="text-sm text-gray-600">{gamesByState[state].length} active games</span>
                      </div>
                      
                      {/* Price Groups */}
                      <div className="space-y-6">
                        {Object.entries(gamesByStateAndPrice[state]).map(([priceRange, games]) => {
                          if (games.length === 0) return null;
                          
                          return (
                            <div key={priceRange}>
                              <h4 className="text-md font-semibold mb-3 text-gray-700">{priceRange} ({games.length})</h4>
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-4">
                                {games.map(game => {
                                  const slug = game.slug || `${game.game_number}-${game.game_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                                  return (
                                    <a
                                      key={game.id}
                                      href={`/games/${game.state}/${game.price}/${slug}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="group relative overflow-hidden rounded-lg border-2 border-gray-200 hover:border-teal transition-all aspect-[2/3] bg-gray-100 block"
                                    >
                                      <img
                                        src={game.image_url || 'https://images.unsplash.com/photo-1633265486064-086b219458ec?w=300&h=450&fit=crop&q=80'}
                                        alt={game.game_name}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="absolute bottom-0 left-0 right-0 p-2">
                                          <p className="text-white text-xs font-semibold line-clamp-2">{game.game_name}</p>
                                          <p className="text-white/80 text-xs">${game.price}</p>
                                        </div>
                                      </div>
                                      {/* Rank Badge */}
                                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1">
                                        <span className="text-white text-xs font-bold">#{game.rank}</span>
                                      </div>
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  
                  {sortedStates.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-lg">
                      <p className="text-gray-500">No active games found</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
        
        {/* GAMES - GAME MANAGER */}
        {activeMainTab === 'games' && gamesSubTab === 'manager' && (
          <div>
            <div className="bg-gradient-to-r from-teal to-cyan-600 text-white rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-2">Game Manager</h2>
              <p className="opacity-90">Search, filter, and manage all scratch-off games</p>
            </div>

            {/* Search and Filters */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search games..."
                    value={gameSearch}
                    onChange={(e) => setGameSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  />
                </div>
                <select
                  value={gameStateFilter}
                  onChange={(e) => setGameStateFilter(e.target.value)}
                  className="px-4 py-2 border rounded-lg"
                >
                  <option value="all">All States</option>
                  {availableStates.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
                <select
                  value={gamePriceFilter}
                  onChange={(e) => setGamePriceFilter(e.target.value)}
                  className="px-4 py-2 border rounded-lg"
                >
                  <option value="all">All Prices</option>
                  <option value="1-5">$1-$5</option>
                  <option value="6-10">$6-$10</option>
                  <option value="11-20">$11-$20</option>
                  <option value="21-50">$21-$50</option>
                </select>
                <select
                  value={`${gameSortBy}-${gameSortOrder}`}
                  onChange={(e) => {
                    const [sortBy, sortOrder] = e.target.value.split('-');
                    setGameSortBy(sortBy as any);
                    setGameSortOrder(sortOrder as any);
                  }}
                  className="px-4 py-2 border rounded-lg"
                >
                  <option value="rank-desc">Rank (High to Low)</option>
                  <option value="rank-asc">Rank (Low to High)</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="price-asc">Price (Low to High)</option>
                  <option value="price-desc">Price (High to Low)</option>
                  <option value="prizes-desc">Prizes (High to Low)</option>
                  <option value="prizes-asc">Prizes (Low to High)</option>
                  <option value="converted-asc">Not Converted First</option>
                  <option value="converted-desc">Converted First</option>
                </select>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Showing {startIndex + 1}-{endIndex} of {totalGames} games</span>
                <div className="flex gap-2 items-center">
                  <span>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2 py-1 border rounded"
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Games Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        onClick={() => {
                          if (gameSortBy === 'game') {
                            setGameSortOrder(gameSortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setGameSortBy('game');
                            setGameSortOrder('asc');
                          }
                        }}
                        className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          Game
                          {gameSortBy === 'game' && (
                            <span className="text-teal">{gameSortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          if (gameSortBy === 'state') {
                            setGameSortOrder(gameSortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setGameSortBy('state');
                            setGameSortOrder('asc');
                          }
                        }}
                        className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          State
                          {gameSortBy === 'state' && (
                            <span className="text-teal">{gameSortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          if (gameSortBy === 'price') {
                            setGameSortOrder(gameSortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setGameSortBy('price');
                            setGameSortOrder('asc');
                          }
                        }}
                        className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          Price
                          {gameSortBy === 'price' && (
                            <span className="text-teal">{gameSortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          if (gameSortBy === 'top_prize') {
                            setGameSortOrder(gameSortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setGameSortBy('top_prize');
                            setGameSortOrder('desc');
                          }
                        }}
                        className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          Top Prize
                          {gameSortBy === 'top_prize' && (
                            <span className="text-teal">{gameSortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          if (gameSortBy === 'prizes') {
                            setGameSortOrder(gameSortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setGameSortBy('prizes');
                            setGameSortOrder('desc');
                          }
                        }}
                        className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          Prizes Left
                          {gameSortBy === 'prizes' && (
                            <span className="text-teal">{gameSortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          if (gameSortBy === 'rank') {
                            setGameSortOrder(gameSortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setGameSortBy('rank');
                            setGameSortOrder('desc');
                          }
                        }}
                        className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          Rank
                          {gameSortBy === 'rank' && (
                            <span className="text-teal">{gameSortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          if (gameSortBy === 'converted') {
                            setGameSortOrder(gameSortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setGameSortBy('converted');
                            setGameSortOrder('desc');
                          }
                        }}
                        className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          Converted
                          {gameSortBy === 'converted' && (
                            <span className="text-teal">{gameSortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedGames.map(game => (
                      <tr key={game.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium">{game.game_name}</div>
                          <div className="text-sm text-gray-500">#{game.game_number}</div>
                        </td>
                        <td className="px-4 py-3">{game.state}</td>
                        <td className="px-4 py-3">${game.price}</td>
                        <td className="px-4 py-3">${game.top_prize?.toLocaleString()}</td>
                        <td className="px-4 py-3">{game.top_prizes_remaining} / {game.total_top_prizes}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-teal/10 text-teal">
                            #{game.rank}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            game.image_converted 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {game.image_converted ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => deleteGame(game.id)}
                            className="text-red-600 hover:text-red-800 ml-2"
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="px-4 py-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* GAMES - STATES */}
        {activeMainTab === 'games' && gamesSubTab === 'states' && (
          <AdminStates />
        )}

        {/* GAMES - RANKINGS */}
        {activeMainTab === 'games' && gamesSubTab === 'rankings' && (
          <div>
            <div className="bg-gradient-to-r from-teal to-cyan-600 text-white rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-2">Ranking System</h2>
              <p className="opacity-90">View ranking algorithm summary and trigger manual updates</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <button
                onClick={handleUpdateRanks}
                disabled={isUpdatingRanks}
                className="gradient-teal text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
              >
                {isUpdatingRanks ? 'Updating...' : 'Update All Rankings Now'}
              </button>
              <p className="text-sm text-gray-600 mt-2">
                Manually trigger a ranking calculation for all games
              </p>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      onClick={() => {
                        if (rankingSortBy === 'state') {
                          setRankingSortOrder(rankingSortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setRankingSortBy('state');
                          setRankingSortOrder('asc');
                        }
                      }}
                      className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        State
                        {rankingSortBy === 'state' && (
                          <span className="text-teal">{rankingSortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        if (rankingSortBy === 'price_group') {
                          setRankingSortOrder(rankingSortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setRankingSortBy('price_group');
                          setRankingSortOrder('asc');
                        }
                      }}
                      className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Price Group
                        {rankingSortBy === 'price_group' && (
                          <span className="text-teal">{rankingSortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        if (rankingSortBy === 'total_games') {
                          setRankingSortOrder(rankingSortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setRankingSortBy('total_games');
                          setRankingSortOrder('desc');
                        }
                      }}
                      className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Total Games
                        {rankingSortBy === 'total_games' && (
                          <span className="text-teal">{rankingSortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        if (rankingSortBy === 'avg_rank') {
                          setRankingSortOrder(rankingSortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setRankingSortBy('avg_rank');
                          setRankingSortOrder('desc');
                        }
                      }}
                      className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Avg Rank
                        {rankingSortBy === 'avg_rank' && (
                          <span className="text-teal">{rankingSortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        if (rankingSortBy === 'top_rank') {
                          setRankingSortOrder(rankingSortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setRankingSortBy('top_rank');
                          setRankingSortOrder('desc');
                        }
                      }}
                      className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Top Rank
                        {rankingSortBy === 'top_rank' && (
                          <span className="text-teal">{rankingSortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rankingSummary.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{row.state}</td>
                      <td className="px-4 py-3">{row.price_group}</td>
                      <td className="px-4 py-3">{row.total_games}</td>
                      <td className="px-4 py-3">{row.avg_rank?.toFixed(1) || 'N/A'}</td>
                      <td className="px-4 py-3">{row.top_rank || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* IMPORTS TAB */}
        {activeMainTab === 'imports' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Data Import & Conversion Tools</h2>
            </div>

            {/* Scheduled Import Automation */}
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-bold mb-2">🕐 Scheduled Import Automation</h3>
              <p className="text-sm opacity-90 mb-4">Automatically run CSV imports daily at a scheduled time. Handles multi-chunk imports and optional image conversion.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Settings */}
                <div className="bg-white/10 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-3">Settings</h4>
                  
                  {/* Enable Toggle */}
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
                  
                  {/* Scheduled Time */}
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
                  
                  {/* Auto Convert Images */}
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
                
                {/* Right: Status */}
                <div className="bg-white/10 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-3">Status</h4>
                  
                  {/* Current Time */}
                  <div className="mb-4 pb-4 border-b border-white/20">
                    <div className="text-xs opacity-75 mb-1">Current Time</div>
                    <div className="text-2xl font-bold font-mono">
                      {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                    </div>
                  </div>
                  
                  {/* Schedule Status */}
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
              
              {/* Manual Trigger Button */}
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
              
              <p className="text-xs opacity-75 mt-3 text-center">
                ⚠️ To enable automatic daily execution, set up a cron job to call the scheduled-import edge function. See documentation for setup instructions.
              </p>
            </div>

            {/* Two-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT COLUMN - CSV Import Tools */}
              <div className="space-y-6">
                {/* CSV Import Section */}
                <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold mb-2">CSV Data Import</h3>
                  <p className="text-sm opacity-90 mb-4">Import game data from CSV file URL. Processes 200 rows per run - for large files, click Import multiple times to continue. New games will be added, existing games (matching state + slug) will be updated.</p>
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
                          onBlur={async () => {
                            // Format and validate
                            const parts = batchInterval.split(':');
                            let minutes = 0;
                            let seconds = 0;
                            if (parts.length === 2) {
                              minutes = parseInt(parts[0]) || 0;
                              seconds = parseInt(parts[1]) || 0;
                            } else if (parts.length === 1) {
                              seconds = parseInt(parts[0]) || 0;
                            }
                            const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                            setBatchInterval(formatted);
                            
                            // Save to database
                            try {
                              await supabase.from('import_schedule').upsert({
                                enabled: scheduleEnabled,
                                csv_url: csvUrl,
                                scheduled_time: scheduledTime + ':00',
                                auto_convert_images: scheduleAutoConvert,
                                batch_interval: `${minutes} minutes ${seconds} seconds`,
                              });
                            } catch (err) {
                              console.error('Failed to save interval:', err);
                            }
                          }}
                          placeholder="00:15"
                          className="w-full px-3 py-2 rounded-lg text-gray-800 border-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Frequency (batches)</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={batchFrequency}
                          onChange={(e) => setBatchFrequency(parseInt(e.target.value) || 1)}
                          onBlur={async () => {
                            // Save to database
                            try {
                              await supabase.from('import_schedule').upsert({
                                enabled: scheduleEnabled,
                                csv_url: csvUrl,
                                scheduled_time: scheduledTime + ':00',
                                auto_convert_images: scheduleAutoConvert,
                                batch_frequency: batchFrequency,
                              });
                            } catch (err) {
                              console.error('Failed to save frequency:', err);
                            }
                          }}
                          placeholder="5"
                          className="w-full px-3 py-2 rounded-lg text-gray-800 border-none text-sm"
                        />
                      </div>
                    </div>
                    
                    <p className="text-xs opacity-75 mt-2">Expected columns: game_id, state_code, game_number, game_slug, game_name, ticket_price, image_url, top_prize_amount, top_prizes_total_original, game_added_date, start_date, end_date, source, source_url, top_prizes_claimed, top_prizes_remaining, last_updated</p>
                  </div>
                  
                  {/* Download First Button */}
                  <button onClick={async () => {
                    if (!csvUrl.trim()) {
                      toast.error('Please enter a CSV file URL');
                      return;
                    }
                    setIsDownloadingCsv(true);
                    try {
                      console.log('Downloading CSV from:', csvUrl);
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
                      toast.success(`CSV downloaded and saved to Storage! (${(data.size / 1024).toFixed(1)} KB)`);
                      console.log('Local URL:', data.url);
                    } catch (error: any) {
                      console.error('CSV download error:', error);
                      toast.error(error.message || 'Failed to download CSV');
                    } finally {
                      setIsDownloadingCsv(false);
                    }
                  }} disabled={isDownloadingCsv} className="w-full bg-white/20 border-2 border-white/50 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm mb-3">
                    {isDownloadingCsv ? (<><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />Downloading...</>) : (<>📥 Download to Storage First</>)}
                  </button>
                  
                  <button onClick={async () => { if (!csvUrl.trim()) { toast.error('Please enter a CSV file URL'); return; } setIsImporting(true); setImportProgress('Downloading and processing CSV chunk...'); const currentOffset = importOffset; try { const { data, error } = await supabase.functions.invoke('import-csv-data', { body: { csvUrl, offset: currentOffset, columnMapping }, }); if (error) { if (error instanceof FunctionsHttpError) { const errorText = await error.context?.text(); throw new Error(errorText || error.message); } throw error; } setLastImportResult(data); setImportProgress(''); if (data.has_more) { setImportOffset(data.next_offset); toast.success(`Chunk complete! Processed ${data.processed_up_to}/${data.total_rows} rows. ${data.total_rows - data.processed_up_to} remaining. Click Import again to continue.`); } else { setImportOffset(0); if (data.status === 'success') toast.success(`Import complete! All ${data.total_rows} rows processed.`); else if (data.status === 'partial') toast.warning(`Import complete with ${data.records_failed} failures`); else toast.error('Import failed'); } refetchGames(); refetchRankingSummary(); refetchImportLogs(); } catch (error: any) { console.error('Import error:', error); setImportProgress(''); toast.error(error.message || 'Failed to import CSV'); setImportOffset(0); } finally { setIsImporting(false); } }} disabled={isImporting || isSequentialImporting} className="w-full bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm mb-3">
                    {isImporting ? (<><div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full" />Importing...</>) : (<><Plus className="w-4 h-4" />{importOffset > 0 ? `Continue Import (from row ${importOffset + 1})` : 'Import CSV Data'}</>)}
                  </button>
                  
                  <button onClick={async () => {
                    if (!csvUrl.trim()) {
                      toast.error('Please enter a CSV file URL');
                      return;
                    }
                    
                    // Parse interval
                    const [minutes, seconds] = batchInterval.split(':').map(v => parseInt(v) || 0);
                    const intervalMs = (minutes * 60 + seconds) * 1000;
                    
                    if (intervalMs < 5000) {
                      toast.error('Interval must be at least 5 seconds');
                      return;
                    }
                    
                    if (batchFrequency < 1 || batchFrequency > 100) {
                      toast.error('Frequency must be between 1 and 100');
                      return;
                    }
                    
                    setIsSequentialImporting(true);
                    setImportProgress(`Starting sequential import: ${batchFrequency} batches, ${minutes}m ${seconds}s interval...`);
                    
                    let currentOffset = importOffset;
                    let totalInserted = 0;
                    let totalUpdated = 0;
                    let batchesCompleted = 0;
                    
                    try {
                      for (let i = 0; i < batchFrequency; i++) {
                        setImportProgress(`Batch ${i + 1}/${batchFrequency}: Processing from row ${currentOffset + 1}...`);
                        
                        const { data, error } = await supabase.functions.invoke('import-csv-data', {
                          body: { csvUrl, offset: currentOffset, columnMapping },
                        });
                        
                        if (error) {
                          if (error instanceof FunctionsHttpError) {
                            const errorText = await error.context?.text();
                            throw new Error(errorText || error.message);
                          }
                          throw error;
                        }
                        
                        totalInserted += data.records_inserted || 0;
                        totalUpdated += data.records_updated || 0;
                        batchesCompleted++;
                        setLastImportResult(data);
                        
                        if (data.has_more) {
                          currentOffset = data.next_offset;
                          setImportOffset(currentOffset);
                          
                          // Wait before next batch (unless it's the last one)
                          if (i < batchFrequency - 1) {
                            setImportProgress(`Batch ${i + 1} complete. Waiting ${minutes}m ${seconds}s before next batch...`);
                            await new Promise(resolve => setTimeout(resolve, intervalMs));
                          }
                        } else {
                          // No more data to import
                          setImportOffset(0);
                          setImportProgress('');
                          toast.success(`Sequential import complete! ${batchesCompleted} batches processed. Total: +${totalInserted} inserted, ↻${totalUpdated} updated`);
                          break;
                        }
                      }
                      
                      // Completed all batches but more data remains
                      if (currentOffset > importOffset) {
                        setImportProgress('');
                        toast.success(`Sequential import complete! ${batchesCompleted} batches processed. Total: +${totalInserted} inserted, ↻${totalUpdated} updated. More data remains - run again to continue.`);
                      }
                      
                      refetchGames();
                      refetchRankingSummary();
                      refetchImportLogs();
                    } catch (error: any) {
                      console.error('Sequential import error:', error);
                      setImportProgress('');
                      toast.error(`Sequential import failed at batch ${batchesCompleted + 1}: ${error.message}`);
                    } finally {
                      setIsSequentialImporting(false);
                    }
                  }} disabled={isImporting || isSequentialImporting} className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                    {isSequentialImporting ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        Sequential Import Running...
                      </>
                    ) : (
                      <>
                        🔄 Import CSV in Sequence ({batchFrequency}x)
                      </>
                    )}
                  </button>
                  {importProgress && (<div className="mt-4 p-3 bg-white/20 rounded-lg text-sm">{importProgress}</div>)}
                  {lastImportResult && (<div className="mt-4 bg-white/10 rounded-lg p-4"><h4 className="font-semibold text-sm mb-2">Last Import Results</h4>{lastImportResult.total_rows && (<div className="mb-3 p-2 bg-white/20 rounded text-xs"><div className="font-semibold">Progress: {lastImportResult.processed_up_to}/{lastImportResult.total_rows} rows</div><div className="w-full bg-white/20 rounded-full h-2 mt-1"><div className="bg-white h-2 rounded-full" style={{ width: `${(lastImportResult.processed_up_to / lastImportResult.total_rows) * 100}%` }}></div></div>{lastImportResult.has_more && (<div className="mt-1 text-yellow-300 font-semibold">⚠️ {lastImportResult.total_rows - lastImportResult.processed_up_to} rows remaining - click Import again</div>)}</div>)}<div className="grid grid-cols-2 gap-3 text-xs"><div><div className="opacity-75">Processed</div><div className="text-xl font-bold">{lastImportResult.records_processed}</div></div><div><div className="opacity-75">Inserted</div><div className="text-xl font-bold text-green-300">{lastImportResult.records_inserted}</div></div><div><div className="opacity-75">Updated</div><div className="text-xl font-bold text-blue-300">{lastImportResult.records_updated}</div></div><div><div className="opacity-75">Failed</div><div className="text-xl font-bold text-red-300">{lastImportResult.records_failed}</div></div></div>{lastImportResult.details?.failed?.length > 0 && (<div className="mt-3 p-3 bg-red-500/20 rounded text-xs"><div className="font-semibold mb-1">Errors:</div><div className="space-y-1 max-h-32 overflow-y-auto">{lastImportResult.details.failed.slice(0, 5).map((fail: any, idx: number) => (<div key={idx}>Row {fail.row}: {fail.error}</div>))}{lastImportResult.details.failed.length > 5 && (<div className="opacity-75">...and {lastImportResult.details.failed.length - 5} more</div>)}</div></div>)}</div>)}
                </div>

                {/* Import History */}
                {importLogs.length > 0 && (<div className="bg-white rounded-lg shadow p-6"><h3 className="text-lg font-bold mb-4">Recent Import History</h3><div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left text-xs font-semibold">Date</th><th className="px-3 py-2 text-left text-xs font-semibold">Source</th><th className="px-3 py-2 text-center text-xs font-semibold">Status</th><th className="px-3 py-2 text-center text-xs font-semibold">Results</th></tr></thead><tbody className="divide-y">{importLogs.slice(0, 5).map((log: any) => (<tr key={log.id} className="hover:bg-gray-50"><td className="px-3 py-2 text-xs">{new Date(log.import_date).toLocaleString()}</td><td className="px-3 py-2 text-xs"><a href={log.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{log.source_url.split('/').pop()}</a></td><td className="px-3 py-2 text-center"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${log.status === 'success' ? 'bg-green-100 text-green-800' : log.status === 'partial' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{log.status}</span></td><td className="px-3 py-2 text-center text-xs"><span className="text-green-600 font-semibold">+{log.records_inserted}</span>{' / '}<span className="text-blue-600 font-semibold">↻{log.records_updated}</span>{log.records_failed > 0 && (<>{' / '}<span className="text-red-600 font-semibold">✗{log.records_failed}</span></>)}</td></tr>))}</tbody></table></div></div>)}

                {/* CSV Upload Section */}
                <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold mb-2">📤 Upload CSV File</h3>
                  <p className="text-sm opacity-90 mb-4">Upload your CSV file to Supabase Storage to get a reliable URL for importing. Files will be permanently stored and accessible.</p>
                  
                  {/* Drag & Drop Area */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files[0];
                      if (!file) return;
                      if (!file.name.endsWith('.csv')) {
                        toast.error('Please upload a CSV file');
                        return;
                      }
                      await uploadCsvFile(file);
                    }}
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragging
                        ? 'border-white bg-white/20'
                        : 'border-white/50 bg-white/10 hover:bg-white/15'
                    }`}
                  >
                    <div className="mb-4">
                      <div className="text-4xl mb-2">📁</div>
                      <p className="font-semibold mb-1">Drag & Drop CSV File Here</p>
                      <p className="text-sm opacity-75">or click to browse</p>
                    </div>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        await uploadCsvFile(file);
                      }}
                      className="hidden"
                      id="csv-upload-input"
                      disabled={isUploadingCsv}
                    />
                    <label
                      htmlFor="csv-upload-input"
                      className="inline-block bg-white text-green-600 px-6 py-2 rounded-lg font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      {isUploadingCsv ? 'Uploading...' : 'Choose File'}
                    </label>
                  </div>

                  {/* Upload Result */}
                  {uploadedCsvUrl && (
                    <div className="mt-4 bg-white/10 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm mb-1">✅ File Uploaded Successfully!</p>
                          <p className="text-xs opacity-75 break-all">{uploadedCsvUrl}</p>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(uploadedCsvUrl);
                            toast.success('URL copied to clipboard!');
                          }}
                          className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs font-semibold whitespace-nowrap"
                        >
                          Copy URL
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          setCsvUrl(uploadedCsvUrl);
                          toast.success('URL pasted into import field');
                        }}
                        className="w-full bg-white text-green-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 text-sm mt-2"
                      >
                        Use This URL for Import
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN - Image Conversion */}
              <div className="space-y-6">
                {/* Image Conversion Tools */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold mb-2">Image Conversion Tools</h3>
                  <p className="text-sm text-gray-600 mb-2">Convert external image URLs to local storage. Images already hosted on play.scratchpal.com will be skipped.</p>
                  <p className="text-sm text-gray-600 mb-4"><strong>Status:</strong> {filteredAndSortedGames.filter(g => g.image_converted).length} of {filteredAndSortedGames.length} games have converted images {gameStateFilter !== 'all' && `(${gameStateFilter} only)`}</p>
                  <div className="space-y-4">
                    {/* Server Conversion */}
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Server Conversion</h4>
                      <p className="text-xs text-gray-600 mb-3">Fast server-side conversion. May fail for sites that block automated requests.</p>
                      <button onClick={async () => { if (!confirm('Convert all unconverted images using server? This may fail for sites that block automated requests.')) return; setIsConvertingImages(true); setConversionProgress('Starting batch conversion...'); try { const { data, error } = await supabase.functions.invoke('batch-convert-images', { body: { stateFilter: gameStateFilter }, }); if (error) { if (error instanceof FunctionsHttpError) { const errorText = await error.context?.text(); throw new Error(errorText || error.message); } throw error; } setConversionProgress(`Complete! Converted: ${data.converted}, Failed: ${data.failed}`); toast.success(`Converted ${data.converted} images`); if (data.failed > 0) toast.error(`Failed to convert ${data.failed} images - use browser method for blocked sites`); refetchGames(); } catch (error: any) { console.error('Batch conversion error:', error); setConversionProgress('Conversion failed'); toast.error(error.message || 'Failed to convert images'); } finally { setIsConvertingImages(false); } }} disabled={isConvertingImages} className="w-full gradient-teal text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                        {isConvertingImages ? 'Converting...' : 'Server Batch Convert'}
                      </button>
                      {conversionProgress && (<div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">{conversionProgress}</div>)}
                    </div>

                    {/* Browser Conversion */}
                    <div className="border-t pt-4">
                      <h4 className="font-semibold text-sm mb-2">Browser-Based Conversion</h4>
                      <p className="text-xs text-gray-600 mb-3">Uses your browser to download images (works for blocked sites). Slower but more reliable. Keep this tab open during conversion.</p>
                      <button onClick={async () => { if (!confirm('Convert images using browser? This is slower but works for blocked sites. Keep this tab open during conversion.')) return; setIsClientConverting(true); setClientConversionProgress('Starting browser-based conversion...'); try { let query = supabase.from('games').select('id, game_name, image_url, image_converted, state'); if (gameStateFilter && gameStateFilter !== 'all') query = query.eq('state', gameStateFilter); const { data: games, error: gamesError } = await query; if (gamesError) throw gamesError; const gamesToConvert = games.filter(game => { if (!game.image_url) return false; const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''; if (game.image_url.includes('play.scratchpal.com') || game.image_url.includes(supabaseUrl)) return false; return true; }); setClientConversionStats({ converted: 0, failed: 0, total: gamesToConvert.length }); setClientConversionProgress(`Found ${gamesToConvert.length} games to convert...`); let converted = 0; let failed = 0; for (let i = 0; i < gamesToConvert.length; i++) { const game = gamesToConvert[i]; setClientConversionProgress(`Converting ${i + 1}/${gamesToConvert.length}: ${game.game_name}...`); try { const response = await fetch(game.image_url, { mode: 'cors', cache: 'no-cache', }); if (!response.ok) throw new Error(`HTTP ${response.status}`); const blob = await response.blob(); let extension = 'jpg'; const urlExtMatch = game.image_url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i); if (urlExtMatch) extension = urlExtMatch[1].toLowerCase(); else { const contentType = blob.type; if (contentType?.includes('png')) extension = 'png'; else if (contentType?.includes('gif')) extension = 'gif'; else if (contentType?.includes('webp')) extension = 'webp'; } const timestamp = Date.now(); const filename = `game_${game.id}_${timestamp}.${extension}`; const { error: uploadError } = await supabase.storage.from('game-images').upload(filename, blob, { contentType: blob.type || 'image/jpeg', upsert: false, }); if (uploadError) throw uploadError; const { data: publicUrlData } = supabase.storage.from('game-images').getPublicUrl(filename); const { error: updateError } = await supabase.from('games').update({ original_image_url: game.image_url, image_url: publicUrlData.publicUrl, image_converted: true, updated_at: new Date().toISOString(), }).eq('id', game.id); if (updateError) throw updateError; converted++; setClientConversionStats({ converted, failed, total: gamesToConvert.length }); if (i < gamesToConvert.length - 1) await new Promise(resolve => setTimeout(resolve, 1000)); } catch (error: any) { failed++; setClientConversionStats({ converted, failed, total: gamesToConvert.length }); if (i < gamesToConvert.length - 1) await new Promise(resolve => setTimeout(resolve, 1000)); } } setClientConversionProgress(`Complete! Converted: ${converted}, Failed: ${failed}`); toast.success(`Browser conversion complete: ${converted} images`); if (failed > 0) toast.error(`${failed} images failed to convert`); refetchGames(); } catch (error: any) { console.error('Browser conversion error:', error); setClientConversionProgress('Conversion failed'); toast.error(error.message || 'Failed to convert images'); } finally { setIsClientConverting(false); } }} disabled={isClientConverting} className="w-full bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                        {isClientConverting ? 'Converting...' : 'Browser Batch Convert'}
                      </button>
                      {clientConversionProgress && (<div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800"><div className="font-semibold mb-2">{clientConversionProgress}</div>{clientConversionStats.total > 0 && (<div className="flex gap-4 text-xs"><span>Total: {clientConversionStats.total}</span><span className="text-green-600">Converted: {clientConversionStats.converted}</span><span className="text-red-600">Failed: {clientConversionStats.failed}</span></div>)}</div>)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MEMBER SERVICES - SLIDER */}
        {activeMainTab === 'member-services' && memberServicesSubTab === 'slider' && (
          <div>
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-2">Slider Messages</h2>
              <p className="opacity-90">Manage rotating messages shown on the homepage</p>
            </div>

            <div className="grid gap-4">
              {messages.map(message => (
                <div key={message.id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{message.message}</p>
                    <div className="flex gap-4 text-sm text-gray-600 mt-2">
                      <span>Duration: {message.duration}ms</span>
                      <span>Transition: {message.transition_type}</span>
                      <span>Order: {message.display_order}</span>
                      <span className={message.is_active ? 'text-green-600' : 'text-gray-400'}>
                        {message.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMessage(message.id)}
                    className="text-red-600 hover:text-red-800 ml-4"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MEMBER SERVICES - ANNOUNCEMENTS */}
        {activeMainTab === 'member-services' && memberServicesSubTab === 'announcements' && (
          <div>
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-2">Send Announcement</h2>
              <p className="opacity-90">Send notifications to all users</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Enter announcement title..."
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Message</label>
                <textarea
                  value={announcementMessage}
                  onChange={(e) => setAnnouncementMessage(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows={4}
                  placeholder="Enter announcement message..."
                />
              </div>
              <button
                className="gradient-purple text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2"
              >
                <Send className="w-5 h-5" />
                Send to All Users
              </button>
            </div>
          </div>
        )}

        {/* MEMBER SERVICES - USERS */}
        {activeMainTab === 'member-services' && memberServicesSubTab === 'users' && (
          <div>
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-2">User Management</h2>
              <p className="opacity-90">View and manage user accounts</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Total Users: {usersData.length}</p>
              <div className="mt-4 text-sm text-gray-500">
                User management interface would be implemented here
              </div>
            </div>
          </div>
        )}

        {/* MEMBER SERVICES - REWARDS */}
        {activeMainTab === 'member-services' && memberServicesSubTab === 'rewards' && (
          <AdminRewards />
        )}

        {/* SCANNER - SCANS */}
        {activeMainTab === 'scanner' && scannerSubTab === 'scans' && (
          <div>
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-2">Recent Scans</h2>
              <p className="opacity-90">View all user ticket scans</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allScans.map((scan: any) => (
                <SavedScanCard
                  key={scan.id}
                  scan={scan}
                  games={allGames}
                  onDelete={() => refetchScans()}
                />
              ))}
            </div>
          </div>
        )}

        {/* BACKUP TAB */}
        {activeMainTab === 'backup' && (
          <div>
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-2">Database Backup & Restore</h2>
              <p className="opacity-90">Create daily backups of database tables and restore from previous versions</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* CREATE BACKUP */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">Create New Backup</h3>
                <p className="text-sm text-gray-600 mb-4">Export all database tables to a JSON backup file stored in the backups bucket.</p>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Backup Type</label>
                  <select className="w-full px-4 py-2 border rounded-lg" defaultValue="database">
                    <option value="database">Full Database Backup</option>
                  </select>
                </div>

                <button
                  onClick={async () => {
                    if (!confirm('Create a new database backup? This will export all tables to storage.')) return;
                    setIsCreatingBackup(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('create-backup', {
                        body: {
                          backupType: 'database',
                          userId: user?.id,
                        },
                      });
                      if (error) {
                        if (error instanceof FunctionsHttpError) {
                          const errorText = await error.context?.text();
                          throw new Error(errorText || error.message);
                        }
                        throw error;
                      }
                      toast.success(`Backup created successfully! ${data.tables_count} tables, ${data.total_rows} rows`);
                      refetchBackups();
                    } catch (error: any) {
                      console.error('Backup creation error:', error);
                      toast.error(error.message || 'Failed to create backup');
                    } finally {
                      setIsCreatingBackup(false);
                    }
                  }}
                  disabled={isCreatingBackup}
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreatingBackup ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Creating Backup...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Create Backup Now
                    </>
                  )}
                </button>
              </div>

              {/* RESTORE FROM BACKUP */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">Restore from Backup</h3>
                <p className="text-sm text-gray-600 mb-4">Select a backup date to restore database tables from a previous version.</p>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Select Backup</label>
                  <select
                    className="w-full px-4 py-2 border rounded-lg"
                    value={selectedBackupId || ''}
                    onChange={(e) => setSelectedBackupId(e.target.value)}
                  >
                    <option value="">Choose a backup...</option>
                    {backups.filter(b => b.status === 'completed').map(backup => (
                      <option key={backup.id} value={backup.id}>
                        {new Date(backup.backup_date).toLocaleDateString()} - {backup.tables_backed_up?.length || 0} tables ({(backup.file_size / 1024).toFixed(1)} KB)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="replace-existing"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor="replace-existing" className="text-sm text-gray-700">
                    Replace existing data (delete current data before restore)
                  </label>
                </div>

                <button
                  onClick={async () => {
                    if (!selectedBackupId) {
                      toast.error('Please select a backup to restore');
                      return;
                    }
                    if (!confirm(`⚠️ WARNING: This will restore data from the selected backup.${replaceExisting ? ' All current data in restored tables will be DELETED first.' : ''} Continue?`)) return;
                    setIsRestoringBackup(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('restore-backup', {
                        body: {
                          backupId: selectedBackupId,
                          replaceExisting,
                        },
                      });
                      if (error) {
                        if (error instanceof FunctionsHttpError) {
                          const errorText = await error.context?.text();
                          throw new Error(errorText || error.message);
                        }
                        throw error;
                      }
                      toast.success(`Restore completed! Success: ${data.summary.successful}, Failed: ${data.summary.failed}`);
                      refetchGames();
                      refetchBackups();
                    } catch (error: any) {
                      console.error('Restore error:', error);
                      toast.error(error.message || 'Failed to restore backup');
                    } finally {
                      setIsRestoringBackup(false);
                    }
                  }}
                  disabled={isRestoringBackup || !selectedBackupId}
                  className="w-full bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isRestoringBackup ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Restoring...
                    </>
                  ) : (
                    'Restore Selected Backup'
                  )}
                </button>
              </div>
            </div>

            {/* BACKUP HISTORY */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b">
                <h3 className="text-lg font-bold">Backup History</h3>
                <p className="text-sm text-gray-600 mt-1">View, download, or delete previous backups</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Tables</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Size</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Created</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {backups.map(backup => (
                      <tr key={backup.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">
                          {new Date(backup.backup_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm capitalize">{backup.backup_type}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                            backup.status === 'completed' ? 'bg-green-100 text-green-800' :
                            backup.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            backup.status === 'archived' ? 'bg-gray-100 text-gray-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {backup.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{backup.tables_backed_up?.length || 0}</td>
                        <td className="px-4 py-3 text-sm">{backup.file_size ? `${(backup.file_size / 1024).toFixed(1)} KB` : '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(backup.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {backup.status === 'completed' && backup.file_path && (
                              <>
                                <button
                                  onClick={async () => {
                                    try {
                                      const { data, error } = await supabase.storage
                                        .from('backups')
                                        .download(backup.file_path);
                                      if (error) throw error;
                                      const url = URL.createObjectURL(data);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = `backup-${backup.backup_date}.json`;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                      toast.success('Backup downloaded');
                                    } catch (error: any) {
                                      toast.error('Failed to download backup');
                                    }
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                  title="Download"
                                >
                                  Download
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Archive backup from ${backup.backup_date}? This will mark it as archived.`)) return;
                                    try {
                                      const { error } = await supabase
                                        .from('backups')
                                        .update({ status: 'archived' })
                                        .eq('id', backup.id);
                                      if (error) throw error;
                                      toast.success('Backup archived');
                                      refetchBackups();
                                    } catch (error: any) {
                                      toast.error('Failed to archive backup');
                                    }
                                  }}
                                  className="text-gray-600 hover:text-gray-800 text-sm"
                                  title="Archive"
                                >
                                  Archive
                                </button>
                              </>
                            )}
                            <button
                              onClick={async () => {
                                if (!confirm(`⚠️ DELETE backup from ${backup.backup_date}? This cannot be undone.`)) return;
                                try {
                                  if (backup.file_path) {
                                    await supabase.storage.from('backups').remove([backup.file_path]);
                                  }
                                  const { error } = await supabase
                                    .from('backups')
                                    .delete()
                                    .eq('id', backup.id);
                                  if (error) throw error;
                                  toast.success('Backup deleted');
                                  refetchBackups();
                                } catch (error: any) {
                                  toast.error('Failed to delete backup');
                                }
                              }}
                              className="text-red-600 hover:text-red-800"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {backups.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          No backups found. Create your first backup above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SCANNER - SETTINGS */}
        {activeMainTab === 'scanner' && scannerSubTab === 'settings' && (
          <div>
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-2">Scanner Settings</h2>
              <p className="opacity-90">Configure AI scanner parameters</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 mb-4">Scanner configuration settings</p>
              <div className="space-y-4">
                {scannerConfig.map((config: any) => (
                  <div key={config.id} className="border-b pb-4">
                    <div className="font-medium">{config.config_key}</div>
                    <div className="text-sm text-gray-600">{config.config_value}</div>
                    {config.description && (
                      <div className="text-xs text-gray-500 mt-1">{config.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
