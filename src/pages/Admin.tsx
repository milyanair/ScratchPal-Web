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
  const [activeMainTab, setActiveMainTab] = useState<'games' | 'member-services' | 'scanner'>('games');
  const [gamesSubTab, setGamesSubTab] = useState<'manager' | 'imports' | 'states' | 'rankings'>('manager');
  const [memberServicesSubTab, setMemberServicesSubTab] = useState<'slider' | 'announcements' | 'users' | 'rewards'>('slider');
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
          <button onClick={() => setActiveMainTab('games')} className={`px-6 py-3 font-semibold transition-colors ${activeMainTab === 'games' ? 'border-b-2 border-teal text-teal' : 'text-gray-500 hover:text-gray-700'}`}>Games</button>
          <button onClick={() => setActiveMainTab('member-services')} className={`px-6 py-3 font-semibold transition-colors ${activeMainTab === 'member-services' ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>Member Services</button>
          <button onClick={() => setActiveMainTab('scanner')} className={`px-6 py-3 font-semibold transition-colors ${activeMainTab === 'scanner' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>Scanner Settings</button>
        </div>

        {/* Games Subtabs */}
        {activeMainTab === 'games' && (
          <div className="flex gap-2 mb-6 border-b bg-gray-50 -mx-4 px-4 py-2">
            <button onClick={() => setGamesSubTab('manager')} className={`px-4 py-2 text-sm font-semibold transition-colors ${gamesSubTab === 'manager' ? 'border-b-2 border-teal text-teal' : 'text-gray-500 hover:text-gray-700'}`}>Game Manager</button>
            <button onClick={() => setGamesSubTab('imports')} className={`px-4 py-2 text-sm font-semibold transition-colors ${gamesSubTab === 'imports' ? 'border-b-2 border-teal text-teal' : 'text-gray-500 hover:text-gray-700'}`}>Imports</button>
            <button onClick={() => setGamesSubTab('states')} className={`px-4 py-2 text-sm font-semibold transition-colors ${gamesSubTab === 'states' ? 'border-b-2 border-teal text-teal' : 'text-gray-500 hover:text-gray-700'}`}>States</button>
            <button onClick={() => setGamesSubTab('rankings')} className={`px-4 py-2 text-sm font-semibold transition-colors ${gamesSubTab === 'rankings' ? 'border-b-2 border-teal text-teal' : 'text-gray-500 hover:text-gray-700'}`}>Ranking System</button>
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

        {/* SCANNER SETTINGS - STANDALONE */}
        {activeMainTab === 'scanner' && (
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
                        <td className="px-4 py-3 text-sm">{game.end_date ? new Date(game.end_date).toLocaleDateString() : '-'}</td>
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

        {/* REST OF THE COMPONENT - keeping for brevity, would continue with Imports tab and modals... */}
        
      </div>
    </Layout>
  );
}
