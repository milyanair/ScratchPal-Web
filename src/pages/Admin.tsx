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
  const [activeMainTab, setActiveMainTab] = useState<'imports' | 'games' | 'member-services' | 'scanner'>('imports');
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
                      <th className="px-4 py-3 text-left text-sm font-semibold">Game</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">State</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Price</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Top Prize</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Prizes Left</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Rank</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Converted</th>
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
                    <th className="px-4 py-3 text-left text-sm font-semibold">State</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Price Group</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Total Games</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Avg Rank</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Top Rank</th>
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
            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-2">CSV Import</h2>
              <p className="opacity-90">Import game data from external CSV sources</p>
            </div>

            {/* Two Column Layout for Desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* LEFT COLUMN - Import Controls */}
              <div className="space-y-6">
                {/* Import from URL */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Import from URL</h3>
                  <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <input
                      type="text"
                      value={csvUrl}
                      onChange={(e) => setCsvUrl(e.target.value)}
                      placeholder="Enter CSV URL..."
                      className="flex-1 px-4 py-2 border rounded-lg"
                    />
                    <button
                      onClick={async () => {
                        setIsImporting(true);
                        setImportProgress('Starting import...');
                        try {
                          const { data, error } = await supabase.functions.invoke('import-csv-data', {
                            body: { csvUrl, offset: importOffset, columnMapping },
                          });
                          if (error instanceof FunctionsHttpError) {
                            const errorText = await error.context.text();
                            throw new Error(errorText);
                          }
                          if (error) throw error;
                          setLastImportResult(data);
                          setImportProgress(`Import complete: ${data.records_inserted} inserted, ${data.records_updated} updated, ${data.records_failed} failed`);
                          if (data.has_more) {
                            setImportOffset(data.next_offset);
                            toast.success(`Imported ${data.processed_up_to}/${data.total_rows} rows. Click "Continue Import" to process remaining rows.`);
                          } else {
                            setImportOffset(0);
                            toast.success('Import completed successfully!');
                          }
                          refetchGames();
                          refetchImportLogs();
                        } catch (err: any) {
                          console.error('Import error:', err);
                          setImportProgress(`Error: ${err.message}`);
                          toast.error(err.message || 'Import failed');
                        } finally {
                          setIsImporting(false);
                        }
                      }}
                      disabled={isImporting || !csvUrl}
                      className="gradient-indigo text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50 whitespace-nowrap"
                    >
                      {isImporting ? 'Importing...' : importOffset > 0 ? 'Continue Import' : 'Start Import'}
                    </button>
                  </div>
                  {importOffset > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-yellow-800">
                        <strong>Partial Import:</strong> {importOffset} rows already processed. Click "Continue Import" to process the next batch.
                      </p>
                      <button
                        onClick={() => setImportOffset(0)}
                        className="text-xs text-yellow-600 hover:underline mt-2"
                      >
                        Reset to start from beginning
                      </button>
                    </div>
                  )}
                  {importProgress && (
                    <div className={`rounded-lg p-4 ${importProgress.includes('Error') ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>
                      <p className="text-sm">{importProgress}</p>
                    </div>
                  )}
                </div>

                {/* Upload CSV File */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Upload CSV File</h3>
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files[0];
                      if (file && file.name.endsWith('.csv')) {
                        await uploadCsvFile(file);
                      } else {
                        toast.error('Please upload a CSV file');
                      }
                    }}
                  >
                    {isUploadingCsv ? (
                      <p className="text-gray-600">Uploading...</p>
                    ) : (
                      <>
                        <p className="text-gray-600 mb-2">Drag and drop CSV file here, or</p>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadCsvFile(file);
                          }}
                          className="hidden"
                          id="csv-upload"
                        />
                        <label
                          htmlFor="csv-upload"
                          className="inline-block gradient-indigo text-white px-4 py-2 rounded-lg font-semibold cursor-pointer"
                        >
                          Browse Files
                        </label>
                      </>
                    )}
                  </div>
                  {uploadedCsvUrl && (
                    <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-800 mb-2">✓ File uploaded successfully!</p>
                      <p className="text-xs text-green-600 break-all mb-2">{uploadedCsvUrl}</p>
                      <button
                        onClick={() => setCsvUrl(uploadedCsvUrl)}
                        className="text-sm text-green-600 hover:underline"
                      >
                        Use this file for import
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN - Import Logs */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Import Logs</h3>
                <div className="space-y-4">
                  {importLogs.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No import logs yet</p>
                  ) : (
                    importLogs.map((log: any) => (
                      <div key={log.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            log.status === 'success' ? 'bg-green-100 text-green-800' :
                            log.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {log.status}
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(log.import_date).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2 break-all">{log.source_url}</p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Processed:</span>
                            <span className="ml-2 font-medium">{log.records_processed}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Inserted:</span>
                            <span className="ml-2 font-medium text-green-600">{log.records_inserted}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Updated:</span>
                            <span className="ml-2 font-medium text-blue-600">{log.records_updated}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Failed:</span>
                            <span className="ml-2 font-medium text-red-600">{log.records_failed}</span>
                          </div>
                        </div>
                        {log.error_message && (
                          <p className="text-sm text-red-600 mt-2">{log.error_message}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Column Mapping - Full Width Below */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Column Mapping (Optional)</h3>
              <p className="text-sm text-gray-600 mb-4">
                If your CSV uses different column names, map them to the expected fields. Leave blank to use default column detection.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Object.keys(columnMapping).map((dbField) => (
                  <div key={dbField}>
                    <label className="block text-sm font-medium mb-1">{dbField}</label>
                    <input
                      type="text"
                      value={columnMapping[dbField]}
                      onChange={(e) => {
                        const newMapping = { ...columnMapping, [dbField]: e.target.value };
                        setColumnMapping(newMapping);
                        localStorage.setItem('csv_column_mapping', JSON.stringify(newMapping));
                      }}
                      placeholder={`CSV column for ${dbField}...`}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  const resetMapping = {
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
                  setColumnMapping(resetMapping);
                  localStorage.setItem('csv_column_mapping', JSON.stringify(resetMapping));
                  toast.success('Column mapping reset to defaults');
                }}
                className="mt-4 text-sm text-indigo-600 hover:underline"
              >
                Reset to defaults
              </button>
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
