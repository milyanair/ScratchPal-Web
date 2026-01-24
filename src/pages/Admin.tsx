import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SliderMessage, Game } from '@/types';
import { Trash2, Search, ChevronLeft, ChevronRight, Send, Database, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { AdminRewards } from './AdminRewards';
import { AdminStates } from './AdminStates';
import { SavedScanCard } from '@/components/SavedScanCard';

export function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeMainTab, setActiveMainTab] = useState<'games' | 'member-services' | 'scanner'>('games');
  const [gamesSubTab, setGamesSubTab] = useState<'manager' | 'states' | 'state-games' | 'rankings'>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'state-games') return 'state-games';
    if (hash === 'states') return 'states';
    if (hash === 'rankings') return 'rankings';
    return 'manager';
  });
  const [memberServicesSubTab, setMemberServicesSubTab] = useState<'slider' | 'announcements' | 'users' | 'rewards'>('slider');
  const [scannerSubTab, setScannerSubTab] = useState<'scans' | 'settings'>('scans');
  
  const [isUpdatingRanks, setIsUpdatingRanks] = useState(false);
  const [editingMessage, setEditingMessage] = useState<SliderMessage | null>(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

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
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');

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

  const { data: usersData = [] } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, email, role');
      
      if (profilesError) throw profilesError;

      return profiles;
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

  const { data: scannerConfig = [] } = useQuery({
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <button
            onClick={() => navigate('/data-panel')}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 flex items-center gap-2"
          >
            <Database className="w-5 h-5" />
            Data Management
          </button>
        </div>

        {/* Main Tabs */}
        <div className="flex gap-2 mb-6 border-b">
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
              <p className="opacity-90">View all active games grouped by state and price</p>
            </div>

            {(() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              const activeGames = allGames.filter(game => {
                if (!game.end_date) return true;
                const endDate = new Date(game.end_date);
                endDate.setHours(0, 0, 0, 0);
                return endDate >= today;
              });

              const gamesByState: Record<string, Game[]> = {};
              activeGames.forEach(game => {
                if (!gamesByState[game.state]) {
                  gamesByState[game.state] = [];
                }
                gamesByState[game.state].push(game);
              });

              const sortedStates = Object.keys(gamesByState).sort();

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
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-xl font-bold mb-4">Quick Index</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sortedStates.map(state => (
                        <div key={state} className="border rounded-lg p-4">
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

                  {sortedStates.map(state => (
                    <div key={state} className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-xl font-bold mb-4">{state} ({gamesByState[state].length} games)</h3>
                      
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
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => deleteGame(game.id)}
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
              <p className="opacity-90">View and update game rankings</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <button
                onClick={handleUpdateRanks}
                disabled={isUpdatingRanks}
                className="gradient-teal text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
              >
                {isUpdatingRanks ? 'Updating...' : 'Update All Rankings Now'}
              </button>
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

        {/* MEMBER SERVICES - SLIDER */}
        {activeMainTab === 'member-services' && memberServicesSubTab === 'slider' && (
          <div>
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-2">Slider Messages</h2>
              <p className="opacity-90">Manage homepage messages</p>
            </div>

            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Messages</h3>
              <button
                onClick={() => {
                  setEditingMessage({
                    id: '',
                    message: '',
                    transition_type: 'fade',
                    duration: 5000,
                    is_active: true,
                    display_order: messages.length,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  });
                  setIsMessageModalOpen(true);
                }}
                className="gradient-purple text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                Add Message
              </button>
            </div>

            <div className="grid gap-4">
              {messages.map(message => (
                <div key={message.id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{message.message}</p>
                    <div className="flex gap-4 text-sm text-gray-600 mt-2">
                      <span>Transition: {message.transition_type}</span>
                      <span>Duration: {message.duration}ms</span>
                      <span>Order: {message.display_order}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        message.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {message.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => {
                        setEditingMessage(message);
                        setIsMessageModalOpen(true);
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this message?')) {
                          deleteMessage(message.id);
                        }
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg">
                  <p className="text-gray-500">No messages yet. Click "Add Message" to create one.</p>
                </div>
              )}
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
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Message</label>
                <textarea
                  value={announcementMessage}
                  onChange={(e) => setAnnouncementMessage(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows={4}
                />
              </div>
              <button className="gradient-purple text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2">
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
              <p className="opacity-90">View and manage users</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Total Users: {usersData.length}</p>
            </div>
          </div>
        )}

        {/* MEMBER SERVICES - REWARDS */}
        {activeMainTab === 'member-services' && memberServicesSubTab === 'rewards' && (
          <AdminRewards />
        )}

        {/* Slider Message Modal */}
        {isMessageModalOpen && editingMessage && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full p-6">
              <h2 className="text-2xl font-bold mb-6">
                {editingMessage.id ? 'Edit Message' : 'Add New Message'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Message Text</label>
                  <textarea
                    value={editingMessage.message}
                    onChange={(e) =>
                      setEditingMessage({ ...editingMessage, message: e.target.value })
                    }
                    className="w-full border rounded-lg px-4 py-2"
                    rows={3}
                    placeholder="Enter your message..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Transition Type</label>
                    <select
                      value={editingMessage.transition_type}
                      onChange={(e) =>
                        setEditingMessage({ ...editingMessage, transition_type: e.target.value })
                      }
                      className="w-full border rounded-lg px-4 py-2"
                    >
                      <option value="fade">Fade</option>
                      <option value="zoom">Zoom</option>
                      <option value="flip">Flip</option>
                      <option value="slide">Slide</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Duration (ms)</label>
                    <input
                      type="number"
                      value={editingMessage.duration}
                      onChange={(e) =>
                        setEditingMessage({
                          ...editingMessage,
                          duration: parseInt(e.target.value) || 5000,
                        })
                      }
                      className="w-full border rounded-lg px-4 py-2"
                      min="1000"
                      step="500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Display Order</label>
                    <input
                      type="number"
                      value={editingMessage.display_order}
                      onChange={(e) =>
                        setEditingMessage({
                          ...editingMessage,
                          display_order: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full border rounded-lg px-4 py-2"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Status</label>
                    <label className="flex items-center gap-3 border rounded-lg px-4 py-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingMessage.is_active}
                        onChange={(e) =>
                          setEditingMessage({
                            ...editingMessage,
                            is_active: e.target.checked,
                          })
                        }
                        className="w-5 h-5 rounded"
                      />
                      <span className="text-sm font-medium">Active</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-6 border-t pt-4">
                <button
                  onClick={async () => {
                    if (!editingMessage.message.trim()) {
                      toast.error('Please enter a message');
                      return;
                    }

                    try {
                      if (editingMessage.id) {
                        const { error } = await supabase
                          .from('slider_messages')
                          .update({
                            message: editingMessage.message,
                            transition_type: editingMessage.transition_type,
                            duration: editingMessage.duration,
                            display_order: editingMessage.display_order,
                            is_active: editingMessage.is_active,
                            updated_at: new Date().toISOString(),
                          })
                          .eq('id', editingMessage.id);

                        if (error) throw error;
                        toast.success('Message updated!');
                      } else {
                        const { error } = await supabase
                          .from('slider_messages')
                          .insert({
                            message: editingMessage.message,
                            transition_type: editingMessage.transition_type,
                            duration: editingMessage.duration,
                            display_order: editingMessage.display_order,
                            is_active: editingMessage.is_active,
                          });

                        if (error) throw error;
                        toast.success('Message added!');
                      }

                      setIsMessageModalOpen(false);
                      setEditingMessage(null);
                      refetchMessages();
                    } catch (error: any) {
                      console.error('Save error:', error);
                      toast.error(error.message || 'Failed to save message');
                    }
                  }}
                  className="flex-1 gradient-purple text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90"
                >
                  {editingMessage.id ? 'Save Changes' : 'Add Message'}
                </button>
                <button
                  onClick={() => {
                    setIsMessageModalOpen(false);
                    setEditingMessage(null);
                  }}
                  className="flex-1 border border-gray-300 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
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
              <p className="opacity-90">Configure AI scanner</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="space-y-4">
                {scannerConfig.map((config: any) => (
                  <div key={config.id} className="border-b pb-4">
                    <div className="font-medium">{config.config_key}</div>
                    <div className="text-sm text-gray-600">{config.config_value}</div>
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
