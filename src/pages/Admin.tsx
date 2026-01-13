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

export function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeMainTab, setActiveMainTab] = useState<'imports' | 'games' | 'member-services' | 'scanner'>('imports');
  const [gamesSubTab, setGamesSubTab] = useState<'manager' | 'states' | 'rankings'>('manager');
  const [memberServicesSubTab, setMemberServicesSubTab] = useState<'slider' | 'announcements' | 'users' | 'rewards'>('slider');
  const [scannerSubTab, setScannerSubTab] = useState<'scans' | 'settings'>('scans');
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
    // Default mapping (matches current hardcoded logic)
    return {
      game_number: 'game_number',
      game_name: 'game_name',
      state: 'state_code',
      price: 'ticket_price',
      top_prize: 'top_prize_amount',
      top_prizes_remaining: 'top_prizes_remaining',
      total_top_prizes: 'top_prizes_total_original',
      overall_odds: 'overall_odds',
      start_date: 'game_added_date',
      end_date: 'end_date',
      image_url: 'image_url',
      source: 'source',
      source_url: 'source_url',
    };
  });
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [isDetectingColumns, setIsDetectingColumns] = useState(false);

  // Game Manager state
  const [gameSearch, setGameSearch] = useState('');
  const [gameStateFilter, setGameStateFilter] = useState('all');
  const [gamePriceFilter, setGamePriceFilter] = useState('all');
  const [gameSortBy, setGameSortBy] = useState<'rank' | 'name' | 'price' | 'prizes' | 'converted'>('rank');
  const [gameSortOrder, setGameSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

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

  // User Management Query
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
      } else if (gameSortBy === 'name') {
        compareValue = a.game_name.localeCompare(b.game_name);
      } else if (gameSortBy === 'price') {
        compareValue = a.price - b.price;
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

  const { data: rankingSummary = [], refetch: refetchRankingSummary } = useQuery({
    queryKey: ['rankingSummary'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_ranking_summary');
      if (error) throw error;
      return data;
    },
  });

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
        </div>

        {/* Games Subtabs */}
        {activeMainTab === 'games' && (
          <div className="flex gap-2 mb-6 border-b bg-gray-50 -mx-4 px-4 py-2">
            <button onClick={() => setGamesSubTab('manager')} className={`px-4 py-2 text-sm font-semibold transition-colors ${gamesSubTab === 'manager' ? 'border-b-2 border-teal text-teal' : 'text-gray-500 hover:text-gray-700'}`}>Game Manager</button>
            <button onClick={() => setGamesSubTab('states')} className={`px-4 py-2 text-sm font-semibold transition-colors ${gamesSubTab === 'states' ? 'border-b-2 border-teal text-teal' : 'text-gray-500 hover:text-gray-700'}`}>States</button>
            <button onClick={() => setGamesSubTab('rankings')} className={`px-4 py-2 text-sm font-semibold transition-colors ${gamesSubTab === 'rankings' ? 'border-b-2 border-teal text-teal' : 'text-gray-500 hover:text-gray-700'}`}>Ranking System</button>
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

        {/* MEMBER SERVICES - SLIDER MESSAGES */}
        {activeMainTab === 'member-services' && memberServicesSubTab === 'slider' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Slider Messages</h2>
              <button
                onClick={() => {
                  setEditingMessage({
                    id: '',
                    message: '',
                    transition_type: 'fade',
                    duration: 5000,
                    is_active: true,
                    display_order: messages.length,
                  } as SliderMessage);
                  setIsMessageModalOpen(true);
                }}
                className="gradient-teal text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Message
              </button>
            </div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Message</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Transition</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Duration</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Active</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Order</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {messages.map((msg) => (
                    <tr key={msg.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{msg.message}</td>
                      <td className="px-4 py-3 text-sm">{msg.transition_type}</td>
                      <td className="px-4 py-3 text-sm">{msg.duration}ms</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${msg.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {msg.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{msg.display_order}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingMessage(msg); setIsMessageModalOpen(true); }} className="p-1 hover:bg-gray-200 rounded">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteMessage(msg.id)} className="p-1 hover:bg-red-100 rounded text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* GAMES - RANKING SYSTEM */}
        {activeMainTab === 'games' && gamesSubTab === 'rankings' && (
          <div>
            <div className="bg-gradient-to-r from-teal to-cyan-600 text-white rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-2">Automatic Ranking System</h2>
              <p className="mb-4 opacity-90">Rankings are automatically updated when game data changes. The system calculates a 0-100 score based on prize availability (50%), odds (25%), value (15%), and time remaining (10%).</p>
              <div className="bg-white/10 rounded-lg p-4 mb-4">
                <h3 className="font-bold mb-2">Ranking Rules:</h3>
                <ul className="space-y-1 text-sm opacity-90">
                  <li>• Rankings are calculated per state</li>
                  <li>• Only ONE rank 100 game per state (best overall)</li>
                  <li>• Within each price group ($1-$5, $6-$10, $11-$20, $21-$50), games get individual rankings</li>
                  <li>• Multiple games can share the same rank within different price groups</li>
                  <li>• <strong>Expired games (end_date ≤ today) are automatically ranked 0 and excluded from main listings</strong></li>
                </ul>
              </div>
              <button onClick={handleUpdateRanks} disabled={isUpdatingRanks} className="bg-white text-teal px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
                {isUpdatingRanks ? 'Updating Rankings...' : 'Manually Update Rankings'}
              </button>
            </div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b">
                <h3 className="text-lg font-bold">Ranking Distribution by State & Price Group</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">State</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Price Group</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Rank 100</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Rank 99</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Rank 98</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Total Games</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Avg Rank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rankingSummary.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{row.state}</td>
                        <td className="px-4 py-3 text-sm">{row.price_group}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.rank_100_count > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>{row.rank_100_count}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.rank_99_count > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>{row.rank_99_count}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.rank_98_count > 0 ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-500'}`}>{row.rank_98_count}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center font-medium">{row.total_games}</td>
                        <td className="px-4 py-3 text-sm text-center">{row.avg_rank}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MEMBER SERVICES - REWARDS */}
        {activeMainTab === 'member-services' && memberServicesSubTab === 'rewards' && <AdminRewards />}

        {/* GAMES - STATES */}
        {activeMainTab === 'games' && gamesSubTab === 'states' && <AdminStates />}

        {/* IMPORTS - MAIN TAB */}
        {activeMainTab === 'imports' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Data Import & Conversion Tools</h2>
            </div>

            {/* Two-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT COLUMN - CSV Import Tools (Reordered) */}
              <div className="space-y-6">
                {/* CSV Import Section - MOVED TO TOP */}
                <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold mb-2">CSV Data Import</h3>
                  <p className="text-sm opacity-90 mb-4">Import game data from CSV file URL. Processes 200 rows per run - for large files, click Import multiple times to continue. New games will be added, existing games (matching game_number + state) will be updated.</p>
                  <div className="bg-white/10 rounded-lg p-4 mb-4">
                    <label className="block text-sm font-semibold mb-2">CSV File URL</label>
                    <input type="text" value={csvUrl} onChange={(e) => setCsvUrl(e.target.value)} placeholder="https://scratchpal.com/latest_game_data.csv" className="w-full px-4 py-2 rounded-lg text-gray-800 border-none text-sm" />
                    <p className="text-xs opacity-75 mt-2">Expected columns: game_number, game_name, state, price, top_prize, top_prizes_remaining, total_top_prizes, overall_odds, start_date, end_date, image_url</p>
                  </div>
                  
                  {/* Download First Button - Uses Edge Function to bypass CORS */}
                  <button onClick={async () => {
                    if (!csvUrl.trim()) {
                      toast.error('Please enter a CSV file URL');
                      return;
                    }
                    setIsDownloadingCsv(true);
                    try {
                      console.log('Downloading CSV from:', csvUrl);
                      
                      // Use edge function to download CSV (bypasses CORS)
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
                      
                      // Update the CSV URL field with the new local URL
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
                  
                  <button onClick={async () => { if (!csvUrl.trim()) { toast.error('Please enter a CSV file URL'); return; } setIsImporting(true); setImportProgress('Downloading and processing CSV chunk...'); const currentOffset = importOffset; try { const { data, error } = await supabase.functions.invoke('import-csv-data', { body: { csvUrl, offset: currentOffset, columnMapping }, }); if (error) { if (error instanceof FunctionsHttpError) { const errorText = await error.context?.text(); throw new Error(errorText || error.message); } throw error; } setLastImportResult(data); setImportProgress(''); if (data.has_more) { setImportOffset(data.next_offset); toast.success(`Chunk complete! Processed ${data.processed_up_to}/${data.total_rows} rows. ${data.total_rows - data.processed_up_to} remaining. Click Import again to continue.`); } else { setImportOffset(0); if (data.status === 'success') toast.success(`Import complete! All ${data.total_rows} rows processed.`); else if (data.status === 'partial') toast.warning(`Import complete with ${data.records_failed} failures`); else toast.error('Import failed'); } refetchGames(); refetchRankingSummary(); refetchImportLogs(); } catch (error: any) { console.error('Import error:', error); setImportProgress(''); toast.error(error.message || 'Failed to import CSV'); setImportOffset(0); } finally { setIsImporting(false); } }} disabled={isImporting} className="w-full bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                    {isImporting ? (<><div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full" />Importing...</>) : (<><Plus className="w-4 h-4" />{importOffset > 0 ? `Continue Import (from row ${importOffset + 1})` : 'Import CSV Data'}</>)}
                  </button>
                  {importProgress && (<div className="mt-4 p-3 bg-white/20 rounded-lg text-sm">{importProgress}</div>)}
                  {lastImportResult && (<div className="mt-4 bg-white/10 rounded-lg p-4"><h4 className="font-semibold text-sm mb-2">Last Import Results</h4>{lastImportResult.total_rows && (<div className="mb-3 p-2 bg-white/20 rounded text-xs"><div className="font-semibold">Progress: {lastImportResult.processed_up_to}/{lastImportResult.total_rows} rows</div><div className="w-full bg-white/20 rounded-full h-2 mt-1"><div className="bg-white h-2 rounded-full" style={{ width: `${(lastImportResult.processed_up_to / lastImportResult.total_rows) * 100}%` }}></div></div>{lastImportResult.has_more && (<div className="mt-1 text-yellow-300 font-semibold">⚠️ {lastImportResult.total_rows - lastImportResult.processed_up_to} rows remaining - click Import again</div>)}</div>)}<div className="grid grid-cols-2 gap-3 text-xs"><div><div className="opacity-75">Processed</div><div className="text-xl font-bold">{lastImportResult.records_processed}</div></div><div><div className="opacity-75">Inserted</div><div className="text-xl font-bold text-green-300">{lastImportResult.records_inserted}</div></div><div><div className="opacity-75">Updated</div><div className="text-xl font-bold text-blue-300">{lastImportResult.records_updated}</div></div><div><div className="opacity-75">Failed</div><div className="text-xl font-bold text-red-300">{lastImportResult.records_failed}</div></div></div>{lastImportResult.details?.failed?.length > 0 && (<div className="mt-3 p-3 bg-red-500/20 rounded text-xs"><div className="font-semibold mb-1">Errors:</div><div className="space-y-1 max-h-32 overflow-y-auto">{lastImportResult.details.failed.slice(0, 5).map((fail: any, idx: number) => (<div key={idx}>Row {fail.row}: {fail.error}</div>))}{lastImportResult.details.failed.length > 5 && (<div className="opacity-75">...and {lastImportResult.details.failed.length - 5} more</div>)}</div></div>)}</div>)}
                </div>

                {/* Import History - MOVED SECOND */}
                {importLogs.length > 0 && (<div className="bg-white rounded-lg shadow p-6"><h3 className="text-lg font-bold mb-4">Recent Import History</h3><div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left text-xs font-semibold">Date</th><th className="px-3 py-2 text-left text-xs font-semibold">Source</th><th className="px-3 py-2 text-center text-xs font-semibold">Status</th><th className="px-3 py-2 text-center text-xs font-semibold">Results</th></tr></thead><tbody className="divide-y">{importLogs.slice(0, 5).map((log: any) => (<tr key={log.id} className="hover:bg-gray-50"><td className="px-3 py-2 text-xs">{new Date(log.import_date).toLocaleString()}</td><td className="px-3 py-2 text-xs"><a href={log.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{log.source_url.split('/').pop()}</a></td><td className="px-3 py-2 text-center"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${log.status === 'success' ? 'bg-green-100 text-green-800' : log.status === 'partial' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{log.status}</span></td><td className="px-3 py-2 text-center text-xs"><span className="text-green-600 font-semibold">+{log.records_inserted}</span>{' / '}<span className="text-blue-600 font-semibold">↻{log.records_updated}</span>{log.records_failed > 0 && (<>{' / '}<span className="text-red-600 font-semibold">✗{log.records_failed}</span></>)}</td></tr>))}</tbody></table></div></div>)}

                {/* CSV Upload Section - MOVED THIRD */}
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

              {/* RIGHT COLUMN - Image Conversion, Danger Zone, Column Mapping (Reordered) */}
              <div className="space-y-6">
                {/* Image Conversion Tools - FIRST */}
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
                      <p className="text-xs text-gray-600 mb-3">Uses your browser to download images (works for blocked sites like Texas Lottery). Slower but more reliable.</p>
                      <button onClick={async () => { if (!confirm('Convert images using browser? This is slower but works for blocked sites. Keep this tab open during conversion.')) return; setIsClientConverting(true); setClientConversionProgress('Starting browser-based conversion...'); try { let query = supabase.from('games').select('id, game_name, image_url, image_converted, state'); if (gameStateFilter && gameStateFilter !== 'all') query = query.eq('state', gameStateFilter); const { data: games, error: gamesError } = await query; if (gamesError) throw gamesError; const gamesToConvert = games.filter(game => { if (!game.image_url) return false; const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''; if (game.image_url.includes('play.scratchpal.com') || game.image_url.includes(supabaseUrl)) return false; return true; }); setClientConversionStats({ converted: 0, failed: 0, total: gamesToConvert.length }); setClientConversionProgress(`Found ${gamesToConvert.length} games to convert...`); let converted = 0; let failed = 0; for (let i = 0; i < gamesToConvert.length; i++) { const game = gamesToConvert[i]; setClientConversionProgress(`Converting ${i + 1}/${gamesToConvert.length}: ${game.game_name}...`); try { const response = await fetch(game.image_url, { mode: 'cors', cache: 'no-cache', }); if (!response.ok) throw new Error(`HTTP ${response.status}`); const blob = await response.blob(); let extension = 'jpg'; const urlExtMatch = game.image_url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i); if (urlExtMatch) extension = urlExtMatch[1].toLowerCase(); else { const contentType = blob.type; if (contentType?.includes('png')) extension = 'png'; else if (contentType?.includes('gif')) extension = 'gif'; else if (contentType?.includes('webp')) extension = 'webp'; } const timestamp = Date.now(); const filename = `game_${game.id}_${timestamp}.${extension}`; const { error: uploadError } = await supabase.storage.from('game-images').upload(filename, blob, { contentType: blob.type || 'image/jpeg', upsert: false, }); if (uploadError) throw uploadError; const { data: publicUrlData } = supabase.storage.from('game-images').getPublicUrl(filename); const { error: updateError } = await supabase.from('games').update({ original_image_url: game.image_url, image_url: publicUrlData.publicUrl, image_converted: true, updated_at: new Date().toISOString(), }).eq('id', game.id); if (updateError) throw updateError; converted++; setClientConversionStats({ converted, failed, total: gamesToConvert.length }); if (i < gamesToConvert.length - 1) await new Promise(resolve => setTimeout(resolve, 10000)); } catch (error: any) { failed++; setClientConversionStats({ converted, failed, total: gamesToConvert.length }); if (i < gamesToConvert.length - 1) await new Promise(resolve => setTimeout(resolve, 10000)); } } setClientConversionProgress(`Complete! Converted: ${converted}, Failed: ${failed}`); toast.success(`Browser conversion complete: ${converted} images`); if (failed > 0) toast.error(`Failed to convert ${failed} images`); refetchGames(); } catch (error: any) { console.error('Client conversion error:', error); setClientConversionProgress('Conversion failed'); toast.error(error.message || 'Failed to convert images'); } finally { setIsClientConverting(false); } }} disabled={isClientConverting} className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                        {isClientConverting ? 'Converting...' : 'Browser Batch Convert (Slow)'}
                      </button>
                      {clientConversionProgress && (<div className="mt-2"><div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">{clientConversionProgress}</div>{clientConversionStats.total > 0 && (<div className="mt-2 grid grid-cols-3 gap-2 text-xs"><div className="bg-green-50 border border-green-200 rounded p-2 text-center"><div className="font-semibold text-green-800">Converted</div><div className="text-lg font-bold text-green-600">{clientConversionStats.converted}</div></div><div className="bg-red-50 border border-red-200 rounded p-2 text-center"><div className="font-semibold text-red-800">Failed</div><div className="text-lg font-bold text-red-600">{clientConversionStats.failed}</div></div><div className="bg-blue-50 border border-blue-200 rounded p-2 text-center"><div className="font-semibold text-blue-800">Total</div><div className="text-lg font-bold text-blue-600">{clientConversionStats.total}</div></div></div>)}</div>)}
                      <p className="text-xs text-gray-500 mt-2">⚠️ Keep this tab open during conversion. Processes 1 image every 10 seconds to avoid rate limiting.</p>
                    </div>
                  </div>
                </div>

                {/* Bulk Delete Tools (Danger Zone) - SECOND */}
                <div className="bg-white rounded-lg shadow p-6 border-2 border-red-200">
                  <h3 className="text-lg font-bold mb-2 text-red-600">⚠️ Danger Zone</h3>
                  <p className="text-sm text-red-800 font-semibold mb-2">Delete All Games in State</p>
                  <p className="text-xs text-red-600 mb-4">This will permanently delete ALL games for the selected state. This action cannot be undone!</p>
                  <button onClick={async () => { if (gameStateFilter === 'all') { toast.error('Please select a specific state to delete'); return; } const stateGamesCount = allGames.filter(g => g.state === gameStateFilter).length; const confirmText = `DELETE ${gameStateFilter}`; const userInput = prompt(`⚠️ WARNING: This will permanently delete ${stateGamesCount} games from ${gameStateFilter}.\n\nType "${confirmText}" to confirm:`); if (userInput !== confirmText) { toast.error('Deletion cancelled - confirmation text did not match'); return; } try { const { data, error } = await supabase.rpc('delete_games_by_state', { p_state: gameStateFilter, }); if (error) throw error; toast.success(`Deleted ${data.deleted_count} games from ${gameStateFilter}`); refetchGames(); refetchRankingSummary(); } catch (error: any) { console.error('Bulk delete error:', error); toast.error(error.message || 'Failed to delete games'); } }} disabled={gameStateFilter === 'all'} className="w-full bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                    <Trash2 className="w-4 h-4" />
                    Delete All {gameStateFilter !== 'all' ? `${gameStateFilter} Games` : '(Select State First)'}
                  </button>
                </div>

                {/* Column Mapping Configuration - THIRD */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold mb-2">📋 CSV Column Mapping</h3>
                  <p className="text-sm text-gray-600 mb-4">Map CSV columns to database fields. Changes are saved automatically.</p>
                  
                  {/* Detect Columns Button */}
                  <button
                    onClick={async () => {
                      if (!csvUrl.trim()) {
                        toast.error('Please enter a CSV URL first');
                        return;
                      }
                      setIsDetectingColumns(true);
                      try {
                        const response = await fetch(csvUrl);
                        if (!response.ok) throw new Error('Failed to download CSV');
                        const csvText = await response.text();
                        const lines = csvText.trim().split('\n');
                        if (lines.length < 1) throw new Error('CSV is empty');
                        
                        // Detect delimiter
                        const firstLine = lines[0];
                        let delimiter = ',';
                        if (firstLine.split('\t').length > firstLine.split(',').length) {
                          delimiter = '\t';
                        } else if (firstLine.split(';').length > firstLine.split(',').length) {
                          delimiter = ';';
                        } else if (firstLine.split('|').length > firstLine.split(',').length) {
                          delimiter = '|';
                        }
                        
                        const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''));
                        setAvailableColumns(headers);
                        toast.success(`Detected ${headers.length} columns`);
                      } catch (error: any) {
                        console.error('Column detection error:', error);
                        toast.error(error.message || 'Failed to detect columns');
                      } finally {
                        setIsDetectingColumns(false);
                      }
                    }}
                    disabled={isDetectingColumns}
                    className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm mb-4"
                  >
                    {isDetectingColumns ? 'Detecting...' : '🔍 Detect Columns from CSV'}
                  </button>

                  {/* Column Mapping Form */}
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {[
                      { db: 'game_number', label: 'Game Number', required: true },
                      { db: 'game_name', label: 'Game Name', required: true },
                      { db: 'state', label: 'State', required: true },
                      { db: 'price', label: 'Price', required: false },
                      { db: 'top_prize', label: 'Top Prize', required: false },
                      { db: 'top_prizes_remaining', label: 'Prizes Remaining', required: false },
                      { db: 'total_top_prizes', label: 'Total Prizes', required: false },
                      { db: 'overall_odds', label: 'Overall Odds', required: false },
                      { db: 'start_date', label: 'Start Date', required: false },
                      { db: 'end_date', label: 'End Date', required: false },
                      { db: 'image_url', label: 'Image URL', required: false },
                      { db: 'source', label: 'Source', required: false },
                      { db: 'source_url', label: 'Source URL', required: false },
                    ].map(field => (
                      <div key={field.db} className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          <select
                            value={columnMapping[field.db] || ''}
                            onChange={(e) => {
                              const newMapping = { ...columnMapping, [field.db]: e.target.value };
                              setColumnMapping(newMapping);
                              localStorage.setItem('csv_column_mapping', JSON.stringify(newMapping));
                              toast.success(`Mapping saved: ${field.label}`);
                            }}
                            className="w-full px-3 py-2 border rounded text-sm"
                          >
                            <option value="">-- Skip this field --</option>
                            {availableColumns.length > 0 ? (
                              availableColumns.map(col => (
                                <option key={col} value={col}>{col}</option>
                              ))
                            ) : (
                              // Default options if columns haven't been detected
                              <>
                                <option value="game_number">game_number</option>
                                <option value="game_name">game_name</option>
                                <option value="state_code">state_code</option>
                                <option value="state">state</option>
                                <option value="ticket_price">ticket_price</option>
                                <option value="price">price</option>
                                <option value="top_prize_amount">top_prize_amount</option>
                                <option value="top_prize">top_prize</option>
                                <option value="top_prizes_remaining">top_prizes_remaining</option>
                                <option value="top_prizes_total_original">top_prizes_total_original</option>
                                <option value="total_top_prizes">total_top_prizes</option>
                                <option value="overall_odds">overall_odds</option>
                                <option value="odds">odds</option>
                                <option value="game_added_date">game_added_date</option>
                                <option value="start_date">start_date</option>
                                <option value="end_date">end_date</option>
                                <option value="image_url">image_url</option>
                                <option value="source">source</option>
                                <option value="source_url">source_url</option>
                              </>
                            )}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reset Button */}
                  <button
                    onClick={() => {
                      if (confirm('Reset to default column mapping?')) {
                        const defaultMapping = {
                          game_number: 'game_number',
                          game_name: 'game_name',
                          state: 'state_code',
                          price: 'ticket_price',
                          top_prize: 'top_prize_amount',
                          top_prizes_remaining: 'top_prizes_remaining',
                          total_top_prizes: 'top_prizes_total_original',
                          overall_odds: 'overall_odds',
                          start_date: 'game_added_date',
                          end_date: 'end_date',
                          image_url: 'image_url',
                          source: 'source',
                          source_url: 'source_url',
                        };
                        setColumnMapping(defaultMapping);
                        localStorage.setItem('csv_column_mapping', JSON.stringify(defaultMapping));
                        toast.success('Reset to default mapping');
                      }
                    }}
                    className="w-full mt-4 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-50 text-sm"
                  >
                    Reset to Default Mapping
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCANNER - SCANS (NEW PAGE) */}
        {activeMainTab === 'scanner' && scannerSubTab === 'scans' && (
          <div>
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-2">Scan Moderation</h2>
              <p className="opacity-90">Review all scanned tickets from all users. Monitor scan activity and moderate content.</p>
            </div>
            
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">User</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">State</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Scan Name</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Matches</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Sample</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allScans.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No scans found</td>
                    </tr>
                  ) : (
                    allScans.map((scan: any) => (
                      <tr key={scan.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center text-xs font-bold">
                              {scan.user_profiles?.username?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <div className="font-medium">{scan.user_profiles?.username || 'Unknown'}</div>
                              <div className="text-xs text-gray-500">{scan.user_profiles?.email || 'N/A'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">{scan.state}</td>
                        <td className="px-4 py-3 text-sm">{scan.scan_name || 'Unnamed'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                            {Array.isArray(scan.ticket_matches) ? scan.ticket_matches.length : 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(scan.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            scan.is_sample 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {scan.is_sample ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <a
                              href={scan.image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 hover:bg-gray-200 rounded text-blue-600"
                              title="View image"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </a>
                            <button
                              onClick={async () => {
                                if (confirm(`Mark this scan as ${scan.is_sample ? 'private' : 'sample'}?`)) {
                                  try {
                                    const { error } = await supabase
                                      .from('scanned_images')
                                      .update({ is_sample: !scan.is_sample })
                                      .eq('id', scan.id);
                                    
                                    if (error) throw error;
                                    toast.success(`Scan marked as ${!scan.is_sample ? 'sample' : 'private'}`);
                                    refetchScans();
                                  } catch (error: any) {
                                    console.error('Update error:', error);
                                    toast.error('Failed to update scan');
                                  }
                                }
                              }}
                              className="p-1 hover:bg-gray-200 rounded text-purple-600"
                              title={scan.is_sample ? 'Mark as private' : 'Mark as sample'}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm('Delete this scan? This action cannot be undone.')) {
                                  try {
                                    const { error } = await supabase
                                      .from('scanned_images')
                                      .delete()
                                      .eq('id', scan.id);
                                    
                                    if (error) throw error;
                                    toast.success('Scan deleted');
                                    refetchScans();
                                  } catch (error: any) {
                                    console.error('Delete error:', error);
                                    toast.error('Failed to delete scan');
                                  }
                                }
                              }}
                              className="p-1 hover:bg-red-100 rounded text-red-600"
                              title="Delete scan"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SCANNER - SETTINGS (EXISTING CONTENT) */}
        {activeMainTab === 'scanner' && scannerSubTab === 'settings' && (
          <div>
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-2">Scanner Accuracy Settings</h2>
              <p className="opacity-90">Fine-tune the AI ticket scanner parameters to improve accuracy. Changes take effect immediately on next scan.</p>
            </div>
            
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b bg-gray-50">
                <h3 className="text-lg font-bold">Configuration Parameters</h3>
                <p className="text-sm text-gray-600 mt-1">Adjust these values to improve ticket detection accuracy</p>
              </div>
              
              <div className="divide-y">
                {scannerConfig.map((config: any) => (
                  <div key={config.id} className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">{config.config_key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</h4>
                        <p className="text-sm text-gray-600">{config.description}</p>
                        {config.config_key === 'min_confidence_threshold' && (
                          <div className="mt-2 text-xs text-gray-500">
                            <strong>Recommendation:</strong> Start at 0.6. Increase to 0.7-0.8 if getting too many false matches. Decrease to 0.5 if missing valid tickets.
                          </div>
                        )}
                        {config.config_key === 'ai_model' && (
                          <div className="mt-2 text-xs text-gray-500">
                            <strong>Available models:</strong> google/gemini-3-flash-preview (best for speed/accuracy), google/gemini-2.5-pro (most accurate but slower)
                          </div>
                        )}
                        {config.config_key === 'fuzzy_match_enabled' && (
                          <div className="mt-2 text-xs text-gray-500">
                            <strong>Note:</strong> Fuzzy matching helps when ticket numbers have leading zeros (e.g., "0123" matches "123")
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 lg:w-80">
                        {config.config_key === 'fuzzy_match_enabled' ? (
                          <select
                            value={config.config_value}
                            onChange={async (e) => {
                              try {
                                const { error } = await supabase
                                  .from('scanner_config')
                                  .update({ 
                                    config_value: e.target.value,
                                    updated_at: new Date().toISOString(),
                                  })
                                  .eq('id', config.id);
                                
                                if (error) throw error;
                                toast.success('Setting updated');
                                refetchScannerConfig();
                              } catch (error: any) {
                                console.error('Update error:', error);
                                toast.error('Failed to update setting');
                              }
                            }}
                            className="flex-1 px-4 py-2 border rounded-lg"
                          >
                            <option value="true">Enabled</option>
                            <option value="false">Disabled</option>
                          </select>
                        ) : config.config_key === 'ai_model' ? (
                          <select
                            value={config.config_value}
                            onChange={async (e) => {
                              try {
                                const { error } = await supabase
                                  .from('scanner_config')
                                  .update({ 
                                    config_value: e.target.value,
                                    updated_at: new Date().toISOString(),
                                  })
                                  .eq('id', config.id);
                                
                                if (error) throw error;
                                toast.success('AI model updated');
                                refetchScannerConfig();
                              } catch (error: any) {
                                console.error('Update error:', error);
                                toast.error('Failed to update model');
                              }
                            }}
                            className="flex-1 px-4 py-2 border rounded-lg text-sm"
                          >
                            <option value="google/gemini-3-flash-preview">Gemini 3 Flash (Recommended)</option>
                            <option value="google/gemini-2.5-pro">Gemini 2.5 Pro (Slower, More Accurate)</option>
                            <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={config.config_value}
                            onChange={async (e) => {
                              try {
                                const { error } = await supabase
                                  .from('scanner_config')
                                  .update({ 
                                    config_value: e.target.value,
                                    updated_at: new Date().toISOString(),
                                  })
                                  .eq('id', config.id);
                                
                                if (error) throw error;
                                toast.success('Setting updated');
                                refetchScannerConfig();
                              } catch (error: any) {
                                console.error('Update error:', error);
                                toast.error('Failed to update setting');
                              }
                            }}
                            className="flex-1 px-4 py-2 border rounded-lg"
                            placeholder="Enter value"
                          />
                        )}
                        
                        <div className="text-sm text-gray-500">
                          {new Date(config.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
              <h3 className="font-bold mb-2 flex items-center gap-2">
                <span className="text-xl">💡</span>
                Troubleshooting Tips
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li><strong>Too many false matches?</strong> Increase min_confidence_threshold to 0.7-0.8</li>
                <li><strong>Missing valid tickets?</strong> Decrease min_confidence_threshold to 0.5-0.6</li>
                <li><strong>Wrong tickets detected?</strong> Try switching to google/gemini-2.5-pro (slower but more accurate)</li>
                <li><strong>Game numbers not matching?</strong> Enable fuzzy_match_enabled to handle leading zeros</li>
                <li><strong>Scan taking too long?</strong> Reduce max_tickets_detected to 10-15</li>
                <li><strong>Poor image quality?</strong> Ensure good lighting and focus when taking photos</li>
              </ul>
            </div>
          </div>
        )}
        
        {/* MEMBER SERVICES - ANNOUNCEMENTS */}
        {activeMainTab === 'member-services' && memberServicesSubTab === 'announcements' && (
          <div>
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-2">Send Announcement</h2>
              <p className="opacity-90">Send notifications to all users who have announcements enabled</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Title</label>
                <input type="text" value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} placeholder="Enter announcement title..." className="w-full border rounded-lg p-3" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Message</label>
                <textarea value={announcementMessage} onChange={(e) => setAnnouncementMessage(e.target.value)} placeholder="Enter announcement message..." className="w-full border rounded-lg p-3 min-h-[150px]" />
              </div>
              <button onClick={async () => { if (!announcementTitle.trim() || !announcementMessage.trim()) { toast.error('Please enter both title and message'); return; } setIsSendingAnnouncement(true); try { const { data, error } = await supabase.rpc('send_announcement', { p_title: announcementTitle, p_message: announcementMessage, }); if (error) throw error; toast.success(`Announcement sent to ${data.sent_count} users!`); setAnnouncementTitle(''); setAnnouncementMessage(''); } catch (error) { console.error('Error sending announcement:', error); toast.error('Failed to send announcement'); } finally { setIsSendingAnnouncement(false); } }} disabled={isSendingAnnouncement} className="w-full gradient-teal text-white py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                <Send className="w-5 h-5" />
                {isSendingAnnouncement ? 'Sending...' : 'Send Announcement'}
              </button>
            </div>
          </div>
        )}

        {/* MEMBER SERVICES - USERS */}
        {activeMainTab === 'member-services' && memberServicesSubTab === 'users' && (
          <div>
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-2">User Management</h2>
              <p className="opacity-90">View all users, their activity stats, points, and referrals</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <div className="flex gap-4 items-center">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setUserCurrentPage(1); }} placeholder="Search by username or email..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" />
                </div>
                <div className="flex gap-2">
                  <select value={userSortBy} onChange={(e) => setUserSortBy(e.target.value as any)} className="px-3 py-2 border rounded-lg text-sm">
                    <option value="username">Username</option>
                    <option value="points">Points</option>
                    <option value="topics">Topics</option>
                    <option value="replies">Replies</option>
                    <option value="referrals">Referrals</option>
                  </select>
                  <button onClick={() => setUserSortOrder(userSortOrder === 'asc' ? 'desc' : 'asc')} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50" title={userSortOrder === 'asc' ? 'Ascending' : 'Descending'}>
                    {userSortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">User</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Role</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Points</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Topics</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Replies</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Favorites</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Referrals</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(() => {
                    let filtered = [...usersData];
                    if (userSearch.trim()) {
                      const searchLower = userSearch.toLowerCase();
                      filtered = filtered.filter((u) => u.username?.toLowerCase().includes(searchLower) || u.email?.toLowerCase().includes(searchLower));
                    }
                    filtered.sort((a, b) => {
                      let compareValue = 0;
                      if (userSortBy === 'username') compareValue = (a.username || '').localeCompare(b.username || '');
                      else if (userSortBy === 'points') compareValue = a.total_points - b.total_points;
                      else if (userSortBy === 'topics') compareValue = a.topics_count - b.topics_count;
                      else if (userSortBy === 'replies') compareValue = a.posts_count - b.posts_count;
                      else if (userSortBy === 'referrals') compareValue = a.referral_signups - b.referral_signups;
                      return userSortOrder === 'asc' ? compareValue : -compareValue;
                    });
                    const totalUsers = filtered.length;
                    const totalPages = Math.ceil(totalUsers / userPageSize);
                    const startIdx = (userCurrentPage - 1) * userPageSize;
                    const endIdx = Math.min(startIdx + userPageSize, totalUsers);
                    const paginatedUsers = filtered.slice(startIdx, endIdx);
                    if (paginatedUsers.length === 0) return (<tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No users found</td></tr>);
                    return (<>
                      {paginatedUsers.map((user: any) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium">{user.username || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>{user.role}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center font-semibold text-yellow-600">{user.total_points.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-center">{user.topics_count}</td>
                          <td className="px-4 py-3 text-sm text-center">{user.posts_count}</td>
                          <td className="px-4 py-3 text-sm text-center">{user.favorites_count}</td>
                          <td className="px-4 py-3 text-sm text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-semibold text-green-600">{user.referral_signups}</span>
                              <span className="text-xs text-gray-500">({user.referral_visits} visits)</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={8} className="px-4 py-4 bg-gray-50">
                          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="text-sm text-gray-600">Showing {totalUsers === 0 ? 0 : startIdx + 1}-{endIdx} of {totalUsers} users</div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600">Show:</span>
                              <select value={userPageSize} onChange={(e) => { setUserPageSize(Number(e.target.value)); setUserCurrentPage(1); }} className="px-3 py-1 border rounded-lg text-sm">
                                <option value="10">10</option>
                                <option value="20">20</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                              </select>
                              <span className="text-sm text-gray-600">per page</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setUserCurrentPage(Math.max(1, userCurrentPage - 1))} disabled={userCurrentPage === 1} className="px-3 py-1 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <div className="flex gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                  let pageNum;
                                  if (totalPages <= 5) pageNum = i + 1;
                                  else if (userCurrentPage <= 3) pageNum = i + 1;
                                  else if (userCurrentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                  else pageNum = userCurrentPage - 2 + i;
                                  return (<button key={pageNum} onClick={() => setUserCurrentPage(pageNum)} className={`px-3 py-1 rounded-lg text-sm ${userCurrentPage === pageNum ? 'bg-purple-500 text-white' : 'border hover:bg-gray-50'}`}>{pageNum}</button>);
                                })}
                              </div>
                              <button onClick={() => setUserCurrentPage(Math.min(totalPages, userCurrentPage + 1))} disabled={userCurrentPage === totalPages} className="px-3 py-1 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </>);
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* GAMES - GAME MANAGER (TABLE ONLY) */}
        {activeMainTab === 'games' && gamesSubTab === 'manager' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Game Manager</h2>
              <button className="gradient-teal text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4" />
                Add Game
              </button>
            </div>

            {/* Search and Filters */}
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={gameSearch} onChange={(e) => setGameSearch(e.target.value)} placeholder="Search games, numbers, states..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" />
                  </div>
                </div>
                <div><select value={gameStateFilter} onChange={(e) => setGameStateFilter(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="all">All States</option>{availableStates.map((state) => (<option key={state} value={state}>{state}</option>))}</select></div>
                <div><select value={gamePriceFilter} onChange={(e) => setGamePriceFilter(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="all">All Prices</option><option value="1-5">$1-$5</option><option value="6-10">$6-$10</option><option value="11-20">$11-$20</option><option value="21-50">$21-$50</option></select></div>
                <div><div className="flex gap-2"><select value={gameSortBy} onChange={(e) => setGameSortBy(e.target.value as any)} className="flex-1 px-3 py-2 border rounded-lg text-sm"><option value="rank">Rank</option><option value="name">Name</option><option value="price">Price</option><option value="prizes">Prizes Left</option><option value="converted">ImgCvt</option></select><button onClick={() => setGameSortOrder(gameSortOrder === 'asc' ? 'desc' : 'asc')} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50" title={gameSortOrder === 'asc' ? 'Ascending' : 'Descending'}>{gameSortOrder === 'asc' ? '↑' : '↓'}</button></div></div>
              </div>
            </div>

            {/* Games Table */}
            <div className="bg-white rounded-lg shadow overflow-x-auto mb-4">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Game</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Number</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">State</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Price</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Top Prize</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Remaining</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">End Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Rank</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">ImgCvt</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedGames.length === 0 ? (<tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">No games found</td></tr>) : (
                    paginatedGames.map((game) => (
                      <tr key={game.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{game.game_name}</td>
                        <td className="px-4 py-3 text-sm">{game.game_number}</td>
                        <td className="px-4 py-3 text-sm">{game.state}</td>
                        <td className="px-4 py-3 text-sm">${game.price}</td>
                        <td className="px-4 py-3 text-sm">${game.top_prize.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm">{game.top_prizes_remaining} / {game.total_top_prizes}</td>
                        <td className="px-4 py-3 text-sm">{game.end_date ? new Date(game.end_date).toLocaleDateString() : 'N/A'}</td>
                        <td className="px-4 py-3 text-sm">#{game.rank}</td>
                        <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${game.image_converted ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`} title={game.image_converted ? 'Image converted to local storage' : 'Using external image URL'}>{game.image_converted ? 'Yes' : 'No'}</span></td>
                        <td className="px-4 py-3 text-sm"><div className="flex gap-2"><button onClick={() => { setEditingGame(game); setIsEditModalOpen(true); }} className="p-1 hover:bg-gray-200 rounded" title="Edit game"><Pencil className="w-4 h-4" /></button><button onClick={() => deleteGame(game.id)} className="p-1 hover:bg-red-100 rounded text-red-600" title="Delete game"><Trash2 className="w-4 h-4" /></button></div></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-600">Showing {totalGames === 0 ? 0 : startIndex + 1}-{endIndex} of {totalGames} games</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Show:</span>
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="px-3 py-1 border rounded-lg text-sm"><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select>
                  <span className="text-sm text-gray-600">per page</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) pageNum = i + 1;
                      else if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;
                      return (<button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`px-3 py-1 rounded-lg text-sm ${currentPage === pageNum ? 'bg-teal text-white' : 'border hover:bg-gray-50'}`}>{pageNum}</button>);
                    })}
                  </div>
                  <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* GAMES - GAME MANAGER (TABLE ONLY) */}
        {activeMainTab === 'games' && gamesSubTab === 'manager' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Data Import & Conversion Tools</h2>
            </div>

            {/* Two-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT COLUMN - CSV Import Tools (Reordered) */}
              <div className="space-y-6">
                {/* CSV Import Section - MOVED TO TOP */}
                <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold mb-2">CSV Data Import</h3>
                  <p className="text-sm opacity-90 mb-4">Import game data from CSV file URL. Processes 200 rows per run - for large files, click Import multiple times to continue. New games will be added, existing games (matching game_number + state) will be updated.</p>
                  <div className="bg-white/10 rounded-lg p-4 mb-4">
                    <label className="block text-sm font-semibold mb-2">CSV File URL</label>
                    <input type="text" value={csvUrl} onChange={(e) => setCsvUrl(e.target.value)} placeholder="https://scratchpal.com/latest_game_data.csv" className="w-full px-4 py-2 rounded-lg text-gray-800 border-none text-sm" />
                    <p className="text-xs opacity-75 mt-2">Expected columns: game_number, game_name, state, price, top_prize, top_prizes_remaining, total_top_prizes, overall_odds, start_date, end_date, image_url</p>
                  </div>
                  
                  {/* Download First Button - Uses Edge Function to bypass CORS */}
                  <button onClick={async () => {
                    if (!csvUrl.trim()) {
                      toast.error('Please enter a CSV file URL');
                      return;
                    }
                    setIsDownloadingCsv(true);
                    try {
                      console.log('Downloading CSV from:', csvUrl);
                      
                      // Use edge function to download CSV (bypasses CORS)
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
                      
                      // Update the CSV URL field with the new local URL
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
                  
                  <button onClick={async () => { if (!csvUrl.trim()) { toast.error('Please enter a CSV file URL'); return; } setIsImporting(true); setImportProgress('Downloading and processing CSV chunk...'); const currentOffset = importOffset; try { const { data, error } = await supabase.functions.invoke('import-csv-data', { body: { csvUrl, offset: currentOffset, columnMapping }, }); if (error) { if (error instanceof FunctionsHttpError) { const errorText = await error.context?.text(); throw new Error(errorText || error.message); } throw error; } setLastImportResult(data); setImportProgress(''); if (data.has_more) { setImportOffset(data.next_offset); toast.success(`Chunk complete! Processed ${data.processed_up_to}/${data.total_rows} rows. ${data.total_rows - data.processed_up_to} remaining. Click Import again to continue.`); } else { setImportOffset(0); if (data.status === 'success') toast.success(`Import complete! All ${data.total_rows} rows processed.`); else if (data.status === 'partial') toast.warning(`Import complete with ${data.records_failed} failures`); else toast.error('Import failed'); } refetchGames(); refetchRankingSummary(); refetchImportLogs(); } catch (error: any) { console.error('Import error:', error); setImportProgress(''); toast.error(error.message || 'Failed to import CSV'); setImportOffset(0); } finally { setIsImporting(false); } }} disabled={isImporting} className="w-full bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                    {isImporting ? (<><div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full" />Importing...</>) : (<><Plus className="w-4 h-4" />{importOffset > 0 ? `Continue Import (from row ${importOffset + 1})` : 'Import CSV Data'}</>)}
                  </button>
                  {importProgress && (<div className="mt-4 p-3 bg-white/20 rounded-lg text-sm">{importProgress}</div>)}
                  {lastImportResult && (<div className="mt-4 bg-white/10 rounded-lg p-4"><h4 className="font-semibold text-sm mb-2">Last Import Results</h4>{lastImportResult.total_rows && (<div className="mb-3 p-2 bg-white/20 rounded text-xs"><div className="font-semibold">Progress: {lastImportResult.processed_up_to}/{lastImportResult.total_rows} rows</div><div className="w-full bg-white/20 rounded-full h-2 mt-1"><div className="bg-white h-2 rounded-full" style={{ width: `${(lastImportResult.processed_up_to / lastImportResult.total_rows) * 100}%` }}></div></div>{lastImportResult.has_more && (<div className="mt-1 text-yellow-300 font-semibold">⚠️ {lastImportResult.total_rows - lastImportResult.processed_up_to} rows remaining - click Import again</div>)}</div>)}<div className="grid grid-cols-2 gap-3 text-xs"><div><div className="opacity-75">Processed</div><div className="text-xl font-bold">{lastImportResult.records_processed}</div></div><div><div className="opacity-75">Inserted</div><div className="text-xl font-bold text-green-300">{lastImportResult.records_inserted}</div></div><div><div className="opacity-75">Updated</div><div className="text-xl font-bold text-blue-300">{lastImportResult.records_updated}</div></div><div><div className="opacity-75">Failed</div><div className="text-xl font-bold text-red-300">{lastImportResult.records_failed}</div></div></div>{lastImportResult.details?.failed?.length > 0 && (<div className="mt-3 p-3 bg-red-500/20 rounded text-xs"><div className="font-semibold mb-1">Errors:</div><div className="space-y-1 max-h-32 overflow-y-auto">{lastImportResult.details.failed.slice(0, 5).map((fail: any, idx: number) => (<div key={idx}>Row {fail.row}: {fail.error}</div>))}{lastImportResult.details.failed.length > 5 && (<div className="opacity-75">...and {lastImportResult.details.failed.length - 5} more</div>)}</div></div>)}</div>)}
                </div>

                {/* Import History - MOVED SECOND */}
                {importLogs.length > 0 && (<div className="bg-white rounded-lg shadow p-6"><h3 className="text-lg font-bold mb-4">Recent Import History</h3><div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left text-xs font-semibold">Date</th><th className="px-3 py-2 text-left text-xs font-semibold">Source</th><th className="px-3 py-2 text-center text-xs font-semibold">Status</th><th className="px-3 py-2 text-center text-xs font-semibold">Results</th></tr></thead><tbody className="divide-y">{importLogs.slice(0, 5).map((log: any) => (<tr key={log.id} className="hover:bg-gray-50"><td className="px-3 py-2 text-xs">{new Date(log.import_date).toLocaleString()}</td><td className="px-3 py-2 text-xs"><a href={log.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{log.source_url.split('/').pop()}</a></td><td className="px-3 py-2 text-center"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${log.status === 'success' ? 'bg-green-100 text-green-800' : log.status === 'partial' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{log.status}</span></td><td className="px-3 py-2 text-center text-xs"><span className="text-green-600 font-semibold">+{log.records_inserted}</span>{' / '}<span className="text-blue-600 font-semibold">↻{log.records_updated}</span>{log.records_failed > 0 && (<>{' / '}<span className="text-red-600 font-semibold">✗{log.records_failed}</span></>)}</td></tr>))}</tbody></table></div></div>)}

                {/* CSV Upload Section - MOVED THIRD */}
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

              {/* RIGHT COLUMN - Image Conversion, Danger Zone, Column Mapping (Reordered) */}
              <div className="space-y-6">
                {/* Image Conversion Tools - FIRST */}
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
                      <p className="text-xs text-gray-600 mb-3">Uses your browser to download images (works for blocked sites like Texas Lottery). Slower but more reliable.</p>
                      <button onClick={async () => { if (!confirm('Convert images using browser? This is slower but works for blocked sites. Keep this tab open during conversion.')) return; setIsClientConverting(true); setClientConversionProgress('Starting browser-based conversion...'); try { let query = supabase.from('games').select('id, game_name, image_url, image_converted, state'); if (gameStateFilter && gameStateFilter !== 'all') query = query.eq('state', gameStateFilter); const { data: games, error: gamesError } = await query; if (gamesError) throw gamesError; const gamesToConvert = games.filter(game => { if (!game.image_url) return false; const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''; if (game.image_url.includes('play.scratchpal.com') || game.image_url.includes(supabaseUrl)) return false; return true; }); setClientConversionStats({ converted: 0, failed: 0, total: gamesToConvert.length }); setClientConversionProgress(`Found ${gamesToConvert.length} games to convert...`); let converted = 0; let failed = 0; for (let i = 0; i < gamesToConvert.length; i++) { const game = gamesToConvert[i]; setClientConversionProgress(`Converting ${i + 1}/${gamesToConvert.length}: ${game.game_name}...`); try { const response = await fetch(game.image_url, { mode: 'cors', cache: 'no-cache', }); if (!response.ok) throw new Error(`HTTP ${response.status}`); const blob = await response.blob(); let extension = 'jpg'; const urlExtMatch = game.image_url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i); if (urlExtMatch) extension = urlExtMatch[1].toLowerCase(); else { const contentType = blob.type; if (contentType?.includes('png')) extension = 'png'; else if (contentType?.includes('gif')) extension = 'gif'; else if (contentType?.includes('webp')) extension = 'webp'; } const timestamp = Date.now(); const filename = `game_${game.id}_${timestamp}.${extension}`; const { error: uploadError } = await supabase.storage.from('game-images').upload(filename, blob, { contentType: blob.type || 'image/jpeg', upsert: false, }); if (uploadError) throw uploadError; const { data: publicUrlData } = supabase.storage.from('game-images').getPublicUrl(filename); const { error: updateError } = await supabase.from('games').update({ original_image_url: game.image_url, image_url: publicUrlData.publicUrl, image_converted: true, updated_at: new Date().toISOString(), }).eq('id', game.id); if (updateError) throw updateError; converted++; setClientConversionStats({ converted, failed, total: gamesToConvert.length }); if (i < gamesToConvert.length - 1) await new Promise(resolve => setTimeout(resolve, 10000)); } catch (error: any) { failed++; setClientConversionStats({ converted, failed, total: gamesToConvert.length }); if (i < gamesToConvert.length - 1) await new Promise(resolve => setTimeout(resolve, 10000)); } } setClientConversionProgress(`Complete! Converted: ${converted}, Failed: ${failed}`); toast.success(`Browser conversion complete: ${converted} images`); if (failed > 0) toast.error(`Failed to convert ${failed} images`); refetchGames(); } catch (error: any) { console.error('Client conversion error:', error); setClientConversionProgress('Conversion failed'); toast.error(error.message || 'Failed to convert images'); } finally { setIsClientConverting(false); } }} disabled={isClientConverting} className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                        {isClientConverting ? 'Converting...' : 'Browser Batch Convert (Slow)'}
                      </button>
                      {clientConversionProgress && (<div className="mt-2"><div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">{clientConversionProgress}</div>{clientConversionStats.total > 0 && (<div className="mt-2 grid grid-cols-3 gap-2 text-xs"><div className="bg-green-50 border border-green-200 rounded p-2 text-center"><div className="font-semibold text-green-800">Converted</div><div className="text-lg font-bold text-green-600">{clientConversionStats.converted}</div></div><div className="bg-red-50 border border-red-200 rounded p-2 text-center"><div className="font-semibold text-red-800">Failed</div><div className="text-lg font-bold text-red-600">{clientConversionStats.failed}</div></div><div className="bg-blue-50 border border-blue-200 rounded p-2 text-center"><div className="font-semibold text-blue-800">Total</div><div className="text-lg font-bold text-blue-600">{clientConversionStats.total}</div></div></div>)}</div>)}
                      <p className="text-xs text-gray-500 mt-2">⚠️ Keep this tab open during conversion. Processes 1 image every 10 seconds to avoid rate limiting.</p>
                    </div>
                  </div>
                </div>

                {/* Bulk Delete Tools (Danger Zone) - SECOND */}
                <div className="bg-white rounded-lg shadow p-6 border-2 border-red-200">
                  <h3 className="text-lg font-bold mb-2 text-red-600">⚠️ Danger Zone</h3>
                  <p className="text-sm text-red-800 font-semibold mb-2">Delete All Games in State</p>
                  <p className="text-xs text-red-600 mb-4">This will permanently delete ALL games for the selected state. This action cannot be undone!</p>
                  <button onClick={async () => { if (gameStateFilter === 'all') { toast.error('Please select a specific state to delete'); return; } const stateGamesCount = allGames.filter(g => g.state === gameStateFilter).length; const confirmText = `DELETE ${gameStateFilter}`; const userInput = prompt(`⚠️ WARNING: This will permanently delete ${stateGamesCount} games from ${gameStateFilter}.\n\nType "${confirmText}" to confirm:`); if (userInput !== confirmText) { toast.error('Deletion cancelled - confirmation text did not match'); return; } try { const { data, error } = await supabase.rpc('delete_games_by_state', { p_state: gameStateFilter, }); if (error) throw error; toast.success(`Deleted ${data.deleted_count} games from ${gameStateFilter}`); refetchGames(); refetchRankingSummary(); } catch (error: any) { console.error('Bulk delete error:', error); toast.error(error.message || 'Failed to delete games'); } }} disabled={gameStateFilter === 'all'} className="w-full bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                    <Trash2 className="w-4 h-4" />
                    Delete All {gameStateFilter !== 'all' ? `${gameStateFilter} Games` : '(Select State First)'}
                  </button>
                </div>

                {/* Column Mapping Configuration - THIRD */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold mb-2">📋 CSV Column Mapping</h3>
                  <p className="text-sm text-gray-600 mb-4">Map CSV columns to database fields. Changes are saved automatically.</p>
                  
                  {/* Detect Columns Button */}
                  <button
                    onClick={async () => {
                      if (!csvUrl.trim()) {
                        toast.error('Please enter a CSV URL first');
                        return;
                      }
                      setIsDetectingColumns(true);
                      try {
                        const response = await fetch(csvUrl);
                        if (!response.ok) throw new Error('Failed to download CSV');
                        const csvText = await response.text();
                        const lines = csvText.trim().split('\n');
                        if (lines.length < 1) throw new Error('CSV is empty');
                        
                        // Detect delimiter
                        const firstLine = lines[0];
                        let delimiter = ',';
                        if (firstLine.split('\t').length > firstLine.split(',').length) {
                          delimiter = '\t';
                        } else if (firstLine.split(';').length > firstLine.split(',').length) {
                          delimiter = ';';
                        } else if (firstLine.split('|').length > firstLine.split(',').length) {
                          delimiter = '|';
                        }
                        
                        const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''));
                        setAvailableColumns(headers);
                        toast.success(`Detected ${headers.length} columns`);
                      } catch (error: any) {
                        console.error('Column detection error:', error);
                        toast.error(error.message || 'Failed to detect columns');
                      } finally {
                        setIsDetectingColumns(false);
                      }
                    }}
                    disabled={isDetectingColumns}
                    className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm mb-4"
                  >
                    {isDetectingColumns ? 'Detecting...' : '🔍 Detect Columns from CSV'}
                  </button>

                  {/* Column Mapping Form */}
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {[
                      { db: 'game_number', label: 'Game Number', required: true },
                      { db: 'game_name', label: 'Game Name', required: true },
                      { db: 'state', label: 'State', required: true },
                      { db: 'price', label: 'Price', required: false },
                      { db: 'top_prize', label: 'Top Prize', required: false },
                      { db: 'top_prizes_remaining', label: 'Prizes Remaining', required: false },
                      { db: 'total_top_prizes', label: 'Total Prizes', required: false },
                      { db: 'overall_odds', label: 'Overall Odds', required: false },
                      { db: 'start_date', label: 'Start Date', required: false },
                      { db: 'end_date', label: 'End Date', required: false },
                      { db: 'image_url', label: 'Image URL', required: false },
                      { db: 'source', label: 'Source', required: false },
                      { db: 'source_url', label: 'Source URL', required: false },
                    ].map(field => (
                      <div key={field.db} className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          <select
                            value={columnMapping[field.db] || ''}
                            onChange={(e) => {
                              const newMapping = { ...columnMapping, [field.db]: e.target.value };
                              setColumnMapping(newMapping);
                              localStorage.setItem('csv_column_mapping', JSON.stringify(newMapping));
                              toast.success(`Mapping saved: ${field.label}`);
                            }}
                            className="w-full px-3 py-2 border rounded text-sm"
                          >
                            <option value="">-- Skip this field --</option>
                            {availableColumns.length > 0 ? (
                              availableColumns.map(col => (
                                <option key={col} value={col}>{col}</option>
                              ))
                            ) : (
                              // Default options if columns haven't been detected
                              <>
                                <option value="game_number">game_number</option>
                                <option value="game_name">game_name</option>
                                <option value="state_code">state_code</option>
                                <option value="state">state</option>
                                <option value="ticket_price">ticket_price</option>
                                <option value="price">price</option>
                                <option value="top_prize_amount">top_prize_amount</option>
                                <option value="top_prize">top_prize</option>
                                <option value="top_prizes_remaining">top_prizes_remaining</option>
                                <option value="top_prizes_total_original">top_prizes_total_original</option>
                                <option value="total_top_prizes">total_top_prizes</option>
                                <option value="overall_odds">overall_odds</option>
                                <option value="odds">odds</option>
                                <option value="game_added_date">game_added_date</option>
                                <option value="start_date">start_date</option>
                                <option value="end_date">end_date</option>
                                <option value="image_url">image_url</option>
                                <option value="source">source</option>
                                <option value="source_url">source_url</option>
                              </>
                            )}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reset Button */}
                  <button
                    onClick={() => {
                      if (confirm('Reset to default column mapping?')) {
                        const defaultMapping = {
                          game_number: 'game_number',
                          game_name: 'game_name',
                          state: 'state_code',
                          price: 'ticket_price',
                          top_prize: 'top_prize_amount',
                          top_prizes_remaining: 'top_prizes_remaining',
                          total_top_prizes: 'top_prizes_total_original',
                          overall_odds: 'overall_odds',
                          start_date: 'game_added_date',
                          end_date: 'end_date',
                          image_url: 'image_url',
                          source: 'source',
                          source_url: 'source_url',
                        };
                        setColumnMapping(defaultMapping);
                        localStorage.setItem('csv_column_mapping', JSON.stringify(defaultMapping));
                        toast.success('Reset to default mapping');
                      }
                    }}
                    className="w-full mt-4 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-50 text-sm"
                  >
                    Reset to Default Mapping
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isMessageModalOpen && editingMessage && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg max-w-2xl w-full p-6"><h2 className="text-2xl font-bold mb-6">{editingMessage.id ? 'Edit' : 'Add'} Slider Message</h2><div className="space-y-4"><div><label className="block text-sm font-medium mb-2">Message</label><textarea value={editingMessage.message} onChange={(e) => setEditingMessage({ ...editingMessage, message: e.target.value })} className="w-full border rounded-lg px-4 py-2 min-h-[100px]" placeholder="Enter message text..." /></div><div><label className="block text-sm font-medium mb-2">Transition Type</label><select value={editingMessage.transition_type} onChange={(e) => setEditingMessage({ ...editingMessage, transition_type: e.target.value })} className="w-full border rounded-lg px-4 py-2"><option value="fade">Fade</option><option value="slide">Slide</option><option value="zoom">Zoom</option><option value="flip">Flip</option></select></div><div><label className="block text-sm font-medium mb-2">Duration (ms)</label><input type="number" value={editingMessage.duration} onChange={(e) => setEditingMessage({ ...editingMessage, duration: parseInt(e.target.value) || 5000 })} className="w-full border rounded-lg px-4 py-2" step="1000" min="1000" /></div><div><label className="block text-sm font-medium mb-2">Display Order</label><input type="number" value={editingMessage.display_order} onChange={(e) => setEditingMessage({ ...editingMessage, display_order: parseInt(e.target.value) || 0 })} className="w-full border rounded-lg px-4 py-2" /></div><div><label className="flex items-center gap-2"><input type="checkbox" checked={editingMessage.is_active} onChange={(e) => setEditingMessage({ ...editingMessage, is_active: e.target.checked })} className="w-4 h-4" /><span className="text-sm font-medium">Active</span></label></div></div><div className="flex gap-4 mt-6 border-t pt-4"><button onClick={async () => { try { if (editingMessage.id) { const { error } = await supabase.from('slider_messages').update({ message: editingMessage.message, transition_type: editingMessage.transition_type, duration: editingMessage.duration, display_order: editingMessage.display_order, is_active: editingMessage.is_active, }).eq('id', editingMessage.id); if (error) throw error; toast.success('Message updated successfully'); } else { const { error } = await supabase.from('slider_messages').insert({ message: editingMessage.message, transition_type: editingMessage.transition_type, duration: editingMessage.duration, display_order: editingMessage.display_order, is_active: editingMessage.is_active, }); if (error) throw error; toast.success('Message created successfully'); } setIsMessageModalOpen(false); setEditingMessage(null); refetchMessages(); } catch (error: any) { console.error('Save error:', error); toast.error(editingMessage.id ? 'Failed to update message' : 'Failed to create message'); } }} className="flex-1 gradient-teal text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90">{editingMessage.id ? 'Save Changes' : 'Create Message'}</button><button onClick={() => { setIsMessageModalOpen(false); setEditingMessage(null); }} className="flex-1 border border-gray-300 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50">Cancel</button></div></div></div>)}

        {isEditModalOpen && editingGame && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto"><div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8"><h2 className="text-2xl font-bold mb-6">Edit Game</h2><div className="space-y-4 max-h-[70vh] overflow-y-auto"><div><label className="block text-sm font-medium mb-2">Game Name</label><input type="text" value={editingGame.game_name} onChange={(e) => setEditingGame({ ...editingGame, game_name: e.target.value })} className="w-full border rounded-lg px-4 py-2" /></div><div><label className="block text-sm font-medium mb-2">Game Number</label><input type="text" value={editingGame.game_number} onChange={(e) => setEditingGame({ ...editingGame, game_number: e.target.value })} className="w-full border rounded-lg px-4 py-2" /></div><div><label className="block text-sm font-medium mb-2">State</label><input type="text" value={editingGame.state} onChange={(e) => setEditingGame({ ...editingGame, state: e.target.value })} className="w-full border rounded-lg px-4 py-2" maxLength={2} /></div><div><label className="block text-sm font-medium mb-2">Price ($)</label><input type="number" value={editingGame.price} onChange={(e) => setEditingGame({ ...editingGame, price: parseFloat(e.target.value) || 0 })} className="w-full border rounded-lg px-4 py-2" step="0.01" /></div><div><label className="block text-sm font-medium mb-2">Top Prize ($)</label><input type="number" value={editingGame.top_prize} onChange={(e) => setEditingGame({ ...editingGame, top_prize: parseFloat(e.target.value) || 0 })} className="w-full border rounded-lg px-4 py-2" /></div><div><label className="block text-sm font-medium mb-2">Top Prizes Remaining</label><input type="number" value={editingGame.top_prizes_remaining} onChange={(e) => setEditingGame({ ...editingGame, top_prizes_remaining: parseInt(e.target.value) || 0 })} className="w-full border rounded-lg px-4 py-2" /></div><div><label className="block text-sm font-medium mb-2">Total Top Prizes</label><input type="number" value={editingGame.total_top_prizes} onChange={(e) => setEditingGame({ ...editingGame, total_top_prizes: parseInt(e.target.value) || 0 })} className="w-full border rounded-lg px-4 py-2" /></div><div><label className="block text-sm font-medium mb-2">Overall Odds</label><input type="text" value={editingGame.overall_odds || ''} onChange={(e) => setEditingGame({ ...editingGame, overall_odds: e.target.value })} className="w-full border rounded-lg px-4 py-2" placeholder="e.g., 1 in 4.5" /></div><div><label className="block text-sm font-medium mb-2">End Date</label><input type="date" value={editingGame.end_date || ''} onChange={(e) => setEditingGame({ ...editingGame, end_date: e.target.value })} className="w-full border rounded-lg px-4 py-2" /></div><div><label className="block text-sm font-medium mb-2">Image URL</label><input type="text" value={editingGame.image_url || ''} onChange={(e) => setEditingGame({ ...editingGame, image_url: e.target.value })} className="w-full border rounded-lg px-4 py-2" />{editingGame.image_url && (<img src={editingGame.image_url} alt={editingGame.game_name} className="mt-2 max-w-xs rounded-lg border" onError={(e) => { e.currentTarget.style.display = 'none'; }} />)}</div><div><label className="block text-sm font-medium mb-2">Upload New Image</label><input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setIsUploadingImage(true); try { const timestamp = Date.now(); const fileExt = file.name.split('.').pop(); const filename = `game_${editingGame.id}_${timestamp}.${fileExt}`; const { data: uploadData, error: uploadError } = await supabase.storage.from('game-images').upload(filename, file, { contentType: file.type, upsert: false, }); if (uploadError) throw uploadError; const { data: publicUrlData } = supabase.storage.from('game-images').getPublicUrl(filename); setEditingGame({ ...editingGame, original_image_url: editingGame.image_url, image_url: publicUrlData.publicUrl, image_converted: true, }); toast.success('Image uploaded successfully'); } catch (error: any) { console.error('Upload error:', error); toast.error('Failed to upload image'); } finally { setIsUploadingImage(false); } }} className="w-full border rounded-lg px-4 py-2" disabled={isUploadingImage} />{isUploadingImage && (<p className="text-sm text-gray-500 mt-2">Uploading...</p>)}</div><div className="border-t pt-4"><div className="flex items-center justify-between mb-2"><label className="text-sm font-medium">Image Conversion Status</label><span className={`px-3 py-1 rounded-full text-xs font-semibold ${editingGame.image_converted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{editingGame.image_converted ? 'Converted' : 'Not Converted'}</span></div>{editingGame.original_image_url && (<p className="text-sm text-gray-600 mb-2">Original URL: {editingGame.original_image_url.substring(0, 50)}...</p>)}<div className="flex gap-2">{editingGame.image_url && !editingGame.image_converted && (<button onClick={async () => { try { const { data, error } = await supabase.functions.invoke('convert-game-images', { body: { gameId: editingGame.id, imageUrl: editingGame.image_url, }, }); if (error) { if (error instanceof FunctionsHttpError) { const errorText = await error.context?.text(); throw new Error(errorText || error.message); } throw error; } toast.success('Image converted successfully'); setEditingGame({ ...editingGame, original_image_url: editingGame.image_url, image_url: data.localUrl, image_converted: true, }); } catch (error: any) { console.error('Conversion error:', error); toast.error(error.message || 'Failed to convert image'); } }} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-600">Convert to Local Storage</button>)}{editingGame.image_converted && (<button onClick={() => { if (confirm('Reset conversion flag? This will allow the image to be re-downloaded on next import.')) { setEditingGame({ ...editingGame, image_converted: false, }); toast.success('Conversion flag reset'); } }} className="border border-orange-500 text-orange-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-50">Reset Conversion Flag</button>)}</div></div></div><div className="flex gap-4 mt-6 border-t pt-4"><button onClick={async () => { try { const { error } = await supabase.from('games').update({ game_name: editingGame.game_name, game_number: editingGame.game_number, state: editingGame.state, price: editingGame.price, top_prize: editingGame.top_prize, top_prizes_remaining: editingGame.top_prizes_remaining, total_top_prizes: editingGame.total_top_prizes, overall_odds: editingGame.overall_odds, end_date: editingGame.end_date, image_url: editingGame.image_url, image_converted: editingGame.image_converted, original_image_url: editingGame.original_image_url, updated_at: new Date().toISOString(), }).eq('id', editingGame.id); if (error) throw error; toast.success('Game updated successfully'); setIsEditModalOpen(false); setEditingGame(null); refetchGames(); } catch (error: any) { console.error('Update error:', error); toast.error('Failed to update game'); } }} className="flex-1 gradient-teal text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90">Save Changes</button><button onClick={() => { setIsEditModalOpen(false); setEditingGame(null); }} className="flex-1 border border-gray-300 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50">Cancel</button></div></div></div>)}
      </div>
    </Layout>
  );
}
