import { Layout } from '@/components/layout/Layout';
import { MessageSlider } from '@/components/MessageSlider';
import { GameCard } from '@/components/GameCard';
import { PullToRefresh } from '@/components/PullToRefresh';
import { Award, Trophy, Heart, Search, ChevronDown, ChevronUp, ThumbsUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Game, Favorite, ForumTopic } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserColors } from '@/hooks/useUserColor';
import { slugifyCategory } from '@/lib/utils';
import { useStateFromUrl } from '@/hooks/useStateFromUrl';
import { toast } from 'sonner';

export function Games() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const stateSetFromUrl = useStateFromUrl();
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'rank' | 'prizes'>('rank');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [displayCount, setDisplayCount] = useState(20);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [ticketTimeFilter, setTicketTimeFilter] = useState<'7D' | '1M'>('1M');

  // Get user's selected state
  const { data: userPref, isLoading: isPrefLoading } = useQuery({
    queryKey: ['userPreference', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
  });

  // Get selected state from localStorage for anonymous users
  const [anonymousState, setAnonymousState] = useState<string>(() => {
    return localStorage.getItem('selected_state') || '';
  });

  // Listen for localStorage changes (for header updates and URL state changes)
  useEffect(() => {
    const handleStorageChange = () => {
      setAnonymousState(localStorage.getItem('selected_state') || '');
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const selectedState = stateSetFromUrl || (user ? userPref?.selected_state : anonymousState);

  // Check if selected state is visible
  const { data: stateConfig, isLoading: isStateConfigLoading } = useQuery({
    queryKey: ['stateConfig', selectedState],
    queryFn: async () => {
      if (!selectedState) return null;
      const { data, error } = await supabase
        .from('state_config')
        .select('*')
        .eq('state_code', selectedState)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedState,
  });

  // Redirect to state selection if no state selected (only after loading completes)
  useEffect(() => {
    // Don't redirect while user preferences are still loading
    if (user && isPrefLoading) return;
    
    // Don't redirect if state is being set from URL
    if (stateSetFromUrl) {
      console.log('State set from URL, skipping redirect:', stateSetFromUrl);
      return;
    }
    
    // Don't redirect if user is on profile page or other protected routes
    const protectedRoutes = ['/profile', '/admin', '/select-state'];
    const isProtectedRoute = protectedRoutes.some(route => window.location.pathname.startsWith(route));
    
    if (!selectedState && !isProtectedRoute) {
      console.log('No state selected, redirecting to state selection');
      navigate('/select-state');
    }
  }, [selectedState, navigate, user, isPrefLoading, stateSetFromUrl]);

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    console.log('🔄 Pull to refresh triggered');
    await Promise.all([
      refetchGames(),
      refetchFavorites(),
    ]);
  };

  // Fetch games (exclude expired games where end_date is today or earlier)
  const { data: games = [], refetch: refetchGames } = useQuery({
    queryKey: ['games', selectedState, sortBy],
    queryFn: async () => {
      if (!selectedState) return [];
      
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('games')
        .select('*')
        .eq('state', selectedState)
        .or(`end_date.is.null,end_date.gt.${today}`); // Include games with no end_date OR end_date > today

      if (sortBy === 'rank') {
        query = query.order('rank', { ascending: false });
      } else {
        query = query.order('top_prizes_remaining', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Game[];
    },
    enabled: !!selectedState,
  });

  // Fetch user favorites
  const { data: favorites = [], refetch: refetchFavorites } = useQuery({
    queryKey: ['favorites', user?.id, 'game'],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', user.id)
        .eq('favorite_type', 'game');
      
      if (error) throw error;
      return data as Favorite[];
    },
    enabled: !!user,
  });

  const favoriteGameIds = new Set(favorites.map(f => f.reference_id));

  // Fetch user's ticket purchases
  const { data: purchases = [] } = useQuery({
    queryKey: ['purchases', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('purchases')
        .select('*, games(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Filter purchases based on time filter
  const getFilteredPurchases = () => {
    const now = new Date();
    const filterDate = new Date();
    
    if (ticketTimeFilter === '7D') {
      filterDate.setDate(now.getDate() - 7);
    } else {
      filterDate.setDate(now.getDate() - 30);
    }
    
    return purchases.filter(purchase => {
      const purchaseDate = new Date(purchase.created_at);
      return purchaseDate >= filterDate;
    });
  };

  const filteredPurchases = getFilteredPurchases();

  // Calculate ticket stats from filtered purchases
  const ticketStats = filteredPurchases.reduce((acc, purchase) => {
    const ticketPrice = purchase.games?.price || 0;
    acc.totalSpent += purchase.quantity * ticketPrice;
    
    if (purchase.is_winner === true) {
      acc.wins += 1;
      acc.winAmount += purchase.win_amount || 0;
    } else if (purchase.is_winner === false) {
      acc.losses += 1;
    }
    
    return acc;
  }, { 
    wins: 0, 
    losses: 0, 
    winAmount: 0,
    totalSpent: 0
  });

  const totalDecided = ticketStats.wins + ticketStats.losses;
  const winPercentage = totalDecided > 0 ? Math.round((ticketStats.wins / totalDecided) * 100) : 0;
  const netAmount = ticketStats.winAmount - ticketStats.totalSpent;

  // Fetch recent forum topics
  const { data: hotTopics = [] } = useQuery({
    queryKey: ['hotTopics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_topics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);
      
      if (error) throw error;
      return data as ForumTopic[];
    },
  });

  // Price range options
  const priceRanges: Record<string, { label: string; min: number; max: number }> = {
    all: { label: 'All', min: 0, max: 999 },
    '1-5': { label: '$1-$5', min: 1, max: 5 },
    '6-10': { label: '$6-$10', min: 6, max: 10 },
    '11-20': { label: '$11-$20', min: 11, max: 20 },
    '21-50': { label: '$21+', min: 21, max: 999 },
  };

  // Filter games
  const filteredGames = games.filter((game) => {
    const range = priceRanges[selectedPriceRange];
    const priceMatch = game.price >= range.min && game.price <= range.max;
    const favoriteMatch = !favoritesOnly || favoriteGameIds.has(game.id);
    const searchMatch = searchTerm === '' || 
      game.game_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      game.game_number.toLowerCase().includes(searchTerm.toLowerCase());
    return priceMatch && favoriteMatch && searchMatch;
  });

  const handleFavoriteChange = () => {
    refetchFavorites();
    refetchGames();
  };

  const toggleTopicExpanded = (topicId: string) => {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  // Get all unique user IDs from hot topics
  const hotTopicUserIds = hotTopics.map(t => t.user_id);
  const { data: userColors = {} } = useUserColors(hotTopicUserIds);

  const getInitials = (index: number) => {
    // Generate consistent initials based on index
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return letters[index % 26];
  };

  const getContentSnippet = (content: string, isExpanded: boolean) => {
    const maxLength = 450; // Tripled from 150
    if (!isExpanded) return '';
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  // Get newest games (top 4 by start_date)
  const newestGames = filteredGames
    .filter(game => game.start_date) // Only games with start dates
    .sort((a, b) => {
      const dateA = new Date(a.start_date!);
      const dateB = new Date(b.start_date!);
      return dateB.getTime() - dateA.getTime(); // Most recent first
    })
    .slice(0, 4);

  // Determine which games to display based on displayCount
  const displayedGames = filteredGames.slice(0, displayCount);
  const hasMoreGames = filteredGames.length > displayCount;

  // Show loading state while checking for selected state
  if ((user && isPrefLoading) || !selectedState || isStateConfigLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading...</div>
        </div>
      </Layout>
    );
  }

  // Show message if state is disabled
  if (stateConfig && stateConfig.is_visible === false) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {selectedState} Temporarily Unavailable
            </h2>
            <p className="text-gray-700 mb-6">
              We're currently experiencing issues with {stateConfig.state_name} game data. 
              Please check back later or select a different state.
            </p>
            <button
              onClick={() => navigate('/select-state')}
              className="gradient-teal text-white px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Select Different State
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PullToRefresh onRefresh={handleRefresh} enabled={!!selectedState && !isStateConfigLoading}>
        <div className="max-w-screen-xl mx-auto mb-6">
          <MessageSlider />
        </div>
      
      <div className="max-w-screen-xl mx-auto px-4 pb-6">
        {/* My Tickets Section - Only show if user is logged in */}
        {user && purchases.length > 0 && (
          <div className="mb-6">
            {/* Header with Time Filter */}
            <div className="flex items-center justify-between mb-4">
              <h2 
                onClick={() => navigate('/favorites')}
                className="text-xl font-bold cursor-pointer hover:text-teal transition-colors"
              >
                My Tickets
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setTicketTimeFilter('7D')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    ticketTimeFilter === '7D'
                      ? 'bg-teal text-white shadow-md'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  7D
                </button>
                <button
                  onClick={() => setTicketTimeFilter('1M')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    ticketTimeFilter === '1M'
                      ? 'bg-teal text-white shadow-md'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  1M
                </button>
              </div>
            </div>

            {/* Summary Blocks */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Win/Loss Block */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border-2 border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-gray-600">🏆W / 💥L</span>
                </div>
                <p className="text-2xl font-bold text-green-600">
                  {ticketStats.wins} / {ticketStats.losses}
                  <span className="text-base ml-2 text-gray-500">({totalDecided})</span>
                </p>
                <p className="text-sm text-gray-600 mt-1">{winPercentage}% winrate</p>
              </div>

              {/* Win$ / Spend Block */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border-2 border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-gray-600">💰W$ / 💸$</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  ${Math.floor(ticketStats.winAmount)}
                  <span className="text-base ml-2 text-gray-500">(-${Math.floor(ticketStats.totalSpent)})</span>
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {netAmount >= 0 ? '+' : ''}${Math.floor(netAmount)} net
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filters - Sticky Container */}
        <div className="sticky top-[85px] z-40 bg-white shadow-md mb-6 -mx-4 px-4 py-4 space-y-4">
          {/* Search Field - Mobile: Full Width Row */}
          <div className="md:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search games..."
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Desktop: Search + Price Buttons + Sort Buttons */}
          <div className="hidden md:flex items-center gap-4 justify-center">
            {/* Search Field */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search games..."
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
              />
            </div>

            {/* Price Filter Buttons */}
            <div className="flex gap-1.5 justify-center">
              {Object.entries(priceRanges).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => setSelectedPriceRange(key)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    selectedPriceRange === key
                      ? 'gradient-games text-white'
                      : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Sort/Filter Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('rank')}
                className={`p-2 rounded-lg transition-colors ${
                  sortBy === 'rank' ? 'gradient-games text-white' : 'bg-gray-200'
                }`}
                title="Sort by Rank"
              >
                <div className="w-8 h-8 flex-shrink-0 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center">
                  <span className="text-lg">🏅</span>
                </div>
              </button>
              <button
                onClick={() => setSortBy('prizes')}
                className={`p-2 rounded-lg transition-colors ${
                  sortBy === 'prizes' ? 'gradient-games text-white' : 'bg-gray-200'
                }`}
                title="Sort by Prizes Remaining"
              >
                <div className="w-8 h-8 flex-shrink-0 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center">
                  <span className="text-lg">🎁</span>
                </div>
              </button>
              <button
                onClick={() => setFavoritesOnly(!favoritesOnly)}
                className={`p-2 rounded-lg transition-colors ${
                  favoritesOnly ? 'gradient-games' : 'bg-gray-200'
                }`}
                title="Favorites Only"
              >
                <div className="w-8 h-8 flex-shrink-0 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center">
                  <span className="text-lg">{favoritesOnly ? '❤️' : '🩶'}</span>
                </div>
              </button>
            </div>
          </div>

          {/* Mobile: Price Buttons + Sort Buttons */}
          <div className="md:hidden flex flex-col gap-3">
            {/* Price Filter Buttons */}
            <div className="flex gap-1.5">
              {Object.entries(priceRanges).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => setSelectedPriceRange(key)}
                  className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                    selectedPriceRange === key
                      ? 'gradient-games text-white'
                      : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Sort/Filter Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('rank')}
                className={`flex-1 p-2 rounded-lg transition-colors ${
                  sortBy === 'rank' ? 'gradient-games text-white' : 'bg-gray-200'
                }`}
                title="Sort by Rank"
              >
                <div className="w-8 h-8 flex-shrink-0 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center mx-auto">
                  <span className="text-lg">🏅</span>
                </div>
              </button>
              <button
                onClick={() => setSortBy('prizes')}
                className={`flex-1 p-2 rounded-lg transition-colors ${
                  sortBy === 'prizes' ? 'gradient-games text-white' : 'bg-gray-200'
                }`}
                title="Sort by Prizes Remaining"
              >
                <div className="w-8 h-8 flex-shrink-0 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center mx-auto">
                  <span className="text-lg">🎁</span>
                </div>
              </button>
              <button
                onClick={() => setFavoritesOnly(!favoritesOnly)}
                className={`flex-1 p-2 rounded-lg transition-colors ${
                  favoritesOnly ? 'gradient-games' : 'bg-gray-200'
                }`}
                title="Favorites Only"
              >
                <div className="w-8 h-8 flex-shrink-0 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center mx-auto">
                  <span className="text-lg">{favoritesOnly ? '❤️' : '🩶'}</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Newest Games Section */}
        {newestGames.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Newest Games</h2>
              <span className="text-sm text-gray-500">
                ↪ by {sortBy === 'rank' ? 'rank' : 'prizes'}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {newestGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  isFavorited={favoriteGameIds.has(game.id)}
                  onFavoriteChange={handleFavoriteChange}
                />
              ))}
            </div>
          </div>
        )}

        {/* Top 20 Games Header */}
        {filteredGames.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Top 20 Games</h2>
            <span className="text-sm text-gray-500">
              ↪ by {sortBy === 'rank' ? 'rank' : 'prizes'}
            </span>
          </div>
        )}

        {/* Games Grid */}
        {filteredGames.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {favoritesOnly 
                ? 'No favorite games yet. Start favoriting games to see them here!'
                : 'No games available for your selected state.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {displayedGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  isFavorited={favoriteGameIds.has(game.id)}
                  onFavoriteChange={handleFavoriteChange}
                />
              ))}
            </div>

            {/* View More Button */}
            {hasMoreGames && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => setDisplayCount(prev => prev + 20)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-8 py-3 rounded-lg font-semibold transition-colors w-72"
                >
                  View More Games ({filteredGames.length - displayCount})
                </button>
              </div>
            )}

            {/* Show Less Button (when more than 20 shown) */}
            {displayCount > 20 && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => {
                    setDisplayCount(20);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-8 py-3 rounded-lg font-semibold transition-colors w-72"
                >
                  Show Less
                </button>
              </div>
            )}
          </>
        )}

        {/* Hot Topics Section */}
        {hotTopics.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold mb-4">Hot Topics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hotTopics.map((topic, index) => {
                const isExpanded = expandedTopics.has(topic.id);
                const contentSnippet = getContentSnippet(topic.content, isExpanded);
                
                // Alternating theme colors (light versions)
                const colorClasses = [
                  'bg-green-50 hover:bg-green-100', // Games green
                  'bg-orange-50 hover:bg-orange-100', // Hot burnt orange
                  'bg-purple-50 hover:bg-purple-100', // Favs mauve/purple
                  'bg-violet-50 hover:bg-violet-100', // Wins purple
                ];
                const colorClass = colorClasses[index % 4];
                
                return (
                  <div 
                    key={topic.id} 
                    className={`${colorClass} rounded-xl shadow-md transition-all duration-300 hover:shadow-lg`}
                  >
                    {/* Card Header */}
                    <div 
                      className="p-4 cursor-pointer"
                      onClick={() => toggleTopicExpanded(topic.id)}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        {/* Identifier Circle */}
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: userColors[topic.user_id] || '#14b8a6' }}
                        >
                          {topic.user_id.substring(0, 2).toUpperCase()}
                        </div>

                        {/* Metadata */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Category Badge */}
                            <span className="bg-white/60 backdrop-blur text-gray-800 px-2 py-1 rounded-full text-xs font-semibold shadow-sm">
                              {topic.category}
                            </span>
                            {/* Upvotes */}
                            <span className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                              <ThumbsUp className="w-3 h-3" />
                              {topic.upvotes}
                            </span>
                          </div>
                          {/* Date */}
                          <span className="text-xs text-gray-600 mt-1 block">
                            {new Date(topic.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Expand/Collapse Icon */}
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-600" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-600" />
                          )}
                        </div>
                      </div>

                      {/* Topic Title */}
                      <h3 className="font-bold text-base text-gray-900 line-clamp-2 mb-2">
                        {topic.title}
                      </h3>

                      {/* Content Preview (when collapsed) */}
                      {!isExpanded && (
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {topic.content}
                        </p>
                      )}
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-4 pb-4">
                        <div className="bg-white/40 backdrop-blur rounded-lg p-3 mb-3">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">
                            {contentSnippet}
                          </p>
                        </div>

                        {/* View More Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (topic.slug) {
                              navigate(`/topic/${slugifyCategory(topic.category)}/${topic.slug}`);
                            } else {
                              navigate(`/topic/${topic.id}`);
                            }
                          }}
                          className="w-full bg-white/60 hover:bg-white/80 backdrop-blur text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                        >
                          View More →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* View More Topics Link */}
            <div className="text-center mt-6">
              <button
                onClick={() => navigate('/hot-topics')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-8 py-3 rounded-lg font-semibold transition-colors w-72"
              >
                View More Topics
              </button>
            </div>
          </div>
        )}
      </div>
      </PullToRefresh>
    </Layout>
  );
}
