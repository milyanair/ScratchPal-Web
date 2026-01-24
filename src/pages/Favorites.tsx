
import { Layout } from '@/components/layout/Layout';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Favorite, Game, ForumTopic } from '@/types';
import { useState, useEffect } from 'react';
import { GameCard } from '@/components/GameCard';
import { SavedScanCard } from '@/components/SavedScanCard';
import { Heart, Trophy, TrendingUp, Award, ScanLine, MessageSquare, ChevronRight, ShoppingCart, Calendar, DollarSign, Edit2, Trash2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePoints } from '@/hooks/usePoints';
import { useUserColors } from '@/hooks/useUserColor';
import { slugifyCategory } from '@/lib/utils';

type TabType = 'favorites' | 'points';
type ViewType = 'overview' | 'all-games' | 'all-convos' | 'all-scans';

export function Favorites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { pointsHistory, leaderboard, totalPoints } = usePoints();
  const [activeTab, setActiveTab] = useState<TabType>('favorites');
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  
  // Get scanId from navigation state (when returning from game detail)
  const returnToScanId = (location.state as any)?.returnToScanId;
  const openPointsTab = (location.state as any)?.openPointsTab;

  const { data: favorites = [], refetch } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data as Favorite[];
    },
    enabled: !!user,
  });

  const gameFavorites = favorites.filter(f => f.favorite_type === 'game');
  const convoFavorites = favorites.filter(f => f.favorite_type === 'topic');

  // Get user's ticket purchases
  const { data: purchases = [], refetch: refetchPurchases } = useQuery({
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

  // Calculate weekly stats (last 7 days)
  const weeklyStats = purchases.reduce((acc, purchase) => {
    const purchaseDate = new Date(purchase.created_at);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    if (purchaseDate >= sevenDaysAgo) {
      acc.count += purchase.quantity;
      acc.total += purchase.quantity * (purchase.games?.price || 0);
    }
    return acc;
  }, { count: 0, total: 0 });

  // Calculate monthly stats (last 30 days)
  const monthlyStats = purchases.reduce((acc, purchase) => {
    const purchaseDate = new Date(purchase.created_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (purchaseDate >= thirtyDaysAgo) {
      acc.count += purchase.quantity;
      acc.total += purchase.quantity * (purchase.games?.price || 0);
    }
    return acc;
  }, { count: 0, total: 0 });

  // Edit purchase state
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(1);
  const [editDateTime, setEditDateTime] = useState<string>('');

  // Get user profile to check if admin
  const { data: userProfile } = useQuery({
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

  // Get scanned images - include is_sample scans and admin sees all
  const { data: scannedImages = [], refetch: refetchScans } = useQuery({
    queryKey: ['scannedImages', user?.id, isAdmin],
    queryFn: async () => {
      if (!user) return [];
      
      // Admin sees all scans, regular users see only their own scans plus sample scans
      if (isAdmin) {
        const { data, error } = await supabase
          .from('scanned_images')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
      } else {
        // Regular users: fetch their own scans (RLS will enforce this)
        const { data, error } = await supabase
          .from('scanned_images')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
      }
    },
    enabled: !!user,
  });

  const { data: games = [] } = useQuery({
    queryKey: ['favoriteGames', gameFavorites.map(f => f.reference_id)],
    queryFn: async () => {
      if (gameFavorites.length === 0) return [];
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .in('id', gameFavorites.map(f => f.reference_id));
      
      if (error) throw error;
      return data as Game[];
    },
    enabled: gameFavorites.length > 0,
  });

  const { data: topics = [] } = useQuery({
    queryKey: ['favoriteTopics', convoFavorites.map(f => f.reference_id)],
    queryFn: async () => {
      if (convoFavorites.length === 0) return [];
      const { data, error } = await supabase
        .from('forum_topics')
        .select('*')
        .in('id', convoFavorites.map(f => f.reference_id));
      
      if (error) throw error;
      return data as ForumTopic[];
    },
    enabled: convoFavorites.length > 0,
  });

  // Get user's rank from leaderboard
  const userRank = leaderboard.findIndex(entry => entry.user_id === user?.id) + 1;

  // Get all unique user IDs from leaderboard
  const leaderboardUserIds = leaderboard.map(entry => entry.user_id);
  const { data: userColors = {} } = useUserColors(leaderboardUserIds);

  // Auto-switch to scans view if returnToScanId is present
  useEffect(() => {
    if (returnToScanId && scannedImages.length > 0) {
      setActiveTab('favorites');
      setCurrentView('all-scans');
    }
  }, [returnToScanId, scannedImages.length]);

  // Auto-switch to points tab if openPointsTab is true
  useEffect(() => {
    if (openPointsTab) {
      setActiveTab('points');
      // Clear the state to prevent reopening on subsequent navigations
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [openPointsTab, navigate, location.pathname]);

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    console.log('🔄 Pull to refresh triggered');
    const promises = [refetch(), refetchScans(), refetchPurchases()];
    await Promise.all(promises);
  };

  // Handle edit purchase
  const handleEditPurchase = async (purchaseId: string) => {
    try {
      const { error } = await supabase
        .from('purchases')
        .update({
          quantity: editQuantity,
          created_at: editDateTime,
        })
        .eq('id', purchaseId);

      if (error) throw error;

      setEditingPurchaseId(null);
      refetchPurchases();
      // Use toast from sonner
      const { toast } = await import('sonner');
      toast.success('Purchase updated!');
    } catch (error) {
      console.error('Error updating purchase:', error);
      const { toast } = await import('sonner');
      toast.error('Failed to update purchase');
    }
  };

  // Handle delete purchase
  const handleDeletePurchase = async (purchaseId: string) => {
    if (!confirm('Are you sure you want to delete this purchase record?')) return;

    try {
      const { error } = await supabase
        .from('purchases')
        .delete()
        .eq('id', purchaseId);

      if (error) throw error;

      refetchPurchases();
      const { toast } = await import('sonner');
      toast.success('Purchase deleted!');
    } catch (error) {
      console.error('Error deleting purchase:', error);
      const { toast } = await import('sonner');
      toast.error('Failed to delete purchase');
    }
  };

  // Start editing a purchase
  const startEdit = (purchase: any) => {
    setEditingPurchaseId(purchase.id);
    setEditQuantity(purchase.quantity);
    // Format datetime for input
    const date = new Date(purchase.created_at);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    setEditDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
  };

  return (
    <Layout>
      <PullToRefresh onRefresh={handleRefresh} enabled={!!user}>
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Heart className="w-8 h-8 text-favs" />
            <h1 className="text-3xl font-bold">My Favorites</h1>
          </div>
          <p className="text-gray-600">
            Your saved tickets, stores, and conversations
          </p>
        </div>

        {!user && (
          <div className="text-center py-12 bg-white rounded-lg mb-6">
            <p className="text-gray-500">
              Please{' '}
              <button
                onClick={() => navigate('/profile')}
                className="text-teal hover:underline font-semibold"
              >
                sign in
              </button>
              {' '}to view and save favorites
            </p>
          </div>
        )}

        {user && (
          <>
            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b justify-center">
              <button
                onClick={() => {
                  setActiveTab('favorites');
                  setCurrentView('overview');
                }}
                className={`px-6 py-3 font-semibold transition-colors ${
                  activeTab === 'favorites'
                    ? 'border-b-2 border-teal text-teal'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                My Favorites
              </button>
              <button
                onClick={() => setActiveTab('points')}
                className={`px-6 py-3 font-semibold transition-colors ${
                  activeTab === 'points'
                    ? 'border-b-2 border-teal text-teal'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                My Points ({totalPoints.toLocaleString()})
              </button>
            </div>

            {/* Tab Content */}
            <div>
              {activeTab === 'favorites' && currentView === 'overview' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="mb-4">
                      <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                        <ShoppingCart className="w-5 h-5 text-teal" />
                        My Tickets
                      </h3>
                      
                      {/* Weekly & Monthly Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg p-4 border-2 border-teal-200">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-gray-600">This Week</span>
                          </div>
                          <p className="text-3xl font-bold text-teal">🎫{weeklyStats.count}</p>
                          <p className="text-xs text-gray-500 mt-1">purchased</p>
                        </div>
                        
                        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border-2 border-green-200">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-gray-600">This Week</span>
                          </div>
                          <p className="text-3xl font-bold text-green-600">${Math.floor(weeklyStats.total)}</p>
                          <p className="text-xs text-gray-500 mt-1">total spent</p>
                        </div>
                        
                        <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border-2 border-purple-200">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-gray-600">This Month</span>
                          </div>
                          <p className="text-2xl font-bold text-purple-600">🎫{monthlyStats.count} / ${Math.floor(monthlyStats.total)}</p>
                          <p className="text-xs text-gray-500 mt-1">last 30 days</p>
                        </div>
                      </div>
                    </div>
                    
                    {purchases.length === 0 ? (
                      <div className="text-center py-8">
                        <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 mb-3">No ticket purchases tracked yet</p>
                        <p className="text-sm text-gray-400">Use the 🛒 button on game cards to track your purchases</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {purchases.slice(0, 10).map((purchase) => (
                          <div
                            key={purchase.id}
                            className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                          >
                            {editingPurchaseId === purchase.id ? (
                              // Edit Mode
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-xs font-semibold text-gray-600 block mb-1">Quantity</label>
                                    <input
                                      type="number"
                                      value={editQuantity}
                                      onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
                                      min="1"
                                      className="w-full px-3 py-2 border rounded-lg text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-semibold text-gray-600 block mb-1">Date & Time</label>
                                    <input
                                      type="datetime-local"
                                      value={editDateTime}
                                      onChange={(e) => setEditDateTime(e.target.value)}
                                      className="w-full px-3 py-2 border rounded-lg text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEditPurchase(purchase.id)}
                                    className="flex-1 bg-teal text-white px-4 py-2 rounded-lg font-semibold hover:bg-teal/90 text-sm"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingPurchaseId(null)}
                                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-400 text-sm"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              // View Mode
                              <div className="flex items-center gap-3">
                                <div className="flex-1">
                                  {/* Row 1: Game number, then game title */}
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs bg-white px-2 py-0.5 rounded font-semibold">
                                      #{purchase.games?.game_number || 'N/A'}
                                    </span>
                                    <h4 className="font-bold text-sm line-clamp-1">
                                      {purchase.games?.game_name || 'Unknown Game'}
                                    </h4>
                                  </div>
                                  
                                  {/* Row 2: Ticket price, number of tickets */}
                                  <div className="flex items-center gap-3 text-sm mb-1">
                                    <span className="font-semibold text-green-600">
                                      ${purchase.games?.price || 0}
                                    </span>
                                    <span className="text-gray-700">
                                      {purchase.quantity} 🎫
                                    </span>
                                  </div>
                                  
                                  {/* Row 3: Date and time */}
                                  <div className="text-xs text-gray-500">
                                    {new Date(purchase.created_at).toLocaleDateString()} {new Date(purchase.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                  <button
                                    onClick={() => startEdit(purchase)}
                                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-4 h-4 text-teal" />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePurchase(purchase.id)}
                                    className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Games Widget */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <Heart className="w-5 h-5 text-games" />
                        Games
                      </h3>
                      {games.length > 4 && (
                        <button
                          onClick={() => setCurrentView('all-games')}
                          className="text-teal hover:underline font-semibold flex items-center gap-1"
                        >
                          View All <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {games.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No favorite games yet</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {games.slice(0, 4).map((game) => (
                          <GameCard
                            key={game.id}
                            game={game}
                            isFavorited={true}
                            onFavoriteChange={refetch}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Convos Widget */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-hot" />
                        Convos
                      </h3>
                      {topics.length > 4 && (
                        <button
                          onClick={() => setCurrentView('all-convos')}
                          className="text-teal hover:underline font-semibold flex items-center gap-1"
                        >
                          View All <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {topics.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No favorite conversations yet</p>
                    ) : (
                      <div className="space-y-3">
                        {topics.slice(0, 4).map((topic) => (
                          <div
                            key={topic.id}
                            onClick={() => {
                              if (topic.slug) {
                                navigate(`/topic/${slugifyCategory(topic.category)}/${topic.slug}`);
                              } else {
                                navigate(`/topic/${topic.id}`);
                              }
                            }}
                            className="bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs bg-white px-2 py-1 rounded">
                                {topic.category}
                              </span>
                            </div>
                            <h4 className="font-bold text-sm mb-1 line-clamp-1">{topic.title}</h4>
                            <p className="text-gray-600 text-xs line-clamp-2">
                              {topic.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Scans Widget */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <ScanLine className="w-5 h-5 text-teal" />
                        Scans
                      </h3>
                      {scannedImages.length > 4 && (
                        <button
                          onClick={() => setCurrentView('all-scans')}
                          className="text-teal hover:underline font-semibold flex items-center gap-1"
                        >
                          View All <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {scannedImages.length === 0 ? (
                      <div className="text-center py-8">
                        <ScanLine className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 mb-3">No saved scans yet</p>
                        <button
                          onClick={() => navigate('/scan-tickets')}
                          className="gradient-teal text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 text-sm"
                        >
                          Scan Your First Board
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {scannedImages.slice(0, 4).map((scan) => (
                          <SavedScanCard 
                            key={scan.id} 
                            scan={scan}
                            autoOpen={scan.id === returnToScanId}
                            onDelete={refetchScans}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'favorites' && currentView === 'all-games' && (
                <div>
                  <div className="mb-4">
                    <button
                      onClick={() => setCurrentView('overview')}
                      className="text-teal hover:underline font-semibold flex items-center gap-1"
                    >
                      ← Back to Overview
                    </button>
                  </div>
                  {games.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-lg">
                      <p className="text-gray-500">No favorite games yet</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg shadow p-6">
                      <h2 className="text-2xl font-bold mb-6">All Favorite Games ({games.length})</h2>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {games.map((game) => (
                          <GameCard
                            key={game.id}
                            game={game}
                            isFavorited={true}
                            onFavoriteChange={refetch}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'favorites' && currentView === 'all-convos' && (
                <div>
                  <div className="mb-4">
                    <button
                      onClick={() => setCurrentView('overview')}
                      className="text-teal hover:underline font-semibold flex items-center gap-1"
                    >
                      ← Back to Overview
                    </button>
                  </div>
                  {topics.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-lg">
                      <p className="text-gray-500">No favorite conversations yet</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg shadow p-6">
                      <h2 className="text-2xl font-bold mb-6">All Favorite Conversations ({topics.length})</h2>
                      <div className="space-y-4">
                        {topics.map((topic) => (
                          <div
                            key={topic.id}
                            onClick={() => {
                              if (topic.slug) {
                                navigate(`/topic/${slugifyCategory(topic.category)}/${topic.slug}`);
                              } else {
                                navigate(`/topic/${topic.id}`);
                              }
                            }}
                            className="bg-gray-50 rounded-lg p-6 cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs bg-white px-2 py-1 rounded">
                                {topic.category}
                              </span>
                            </div>
                            <h3 className="text-lg font-bold mb-2">{topic.title}</h3>
                            <p className="text-gray-600 text-sm line-clamp-2">
                              {topic.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'favorites' && currentView === 'all-scans' && (
                <div>
                  <div className="mb-4">
                    <button
                      onClick={() => setCurrentView('overview')}
                      className="text-teal hover:underline font-semibold flex items-center gap-1"
                    >
                      ← Back to Overview
                    </button>
                  </div>
                  {scannedImages.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-lg">
                      <ScanLine className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 mb-4">No saved scans yet</p>
                      <button
                        onClick={() => navigate('/scan-tickets')}
                        className="gradient-teal text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90"
                      >
                        Scan Your First Ticket Board
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg shadow p-6">
                      <h2 className="text-2xl font-bold mb-6">All Saved Scans ({scannedImages.length})</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {scannedImages.map((scan) => (
                          <SavedScanCard 
                            key={scan.id} 
                            scan={scan}
                            autoOpen={scan.id === returnToScanId}
                            onDelete={refetchScans}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'points' && (
                <div>
                  {/* User Stats */}
                  <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white rounded-lg shadow-lg p-6 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-3xl font-bold mb-2">{totalPoints.toLocaleString()} Points</h2>
                        {userRank > 0 && (
                          <p className="text-yellow-100 flex items-center gap-2">
                            <Trophy className="w-5 h-5" />
                            Rank #{userRank} on Leaderboard
                          </p>
                        )}
                      </div>
                      <Trophy className="w-16 h-16 opacity-50" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Points History */}
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-teal" />
                        Recent Activity
                      </h3>
                      {pointsHistory.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No activity yet</p>
                      ) : (
                        <div className="space-y-3">
                          {pointsHistory.slice(0, 10).map((history) => (
                            <div key={history.id} className="flex items-center justify-between py-3 border-b last:border-b-0">
                              <div>
                                <p className="font-medium text-sm">{history.activity_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                                {history.description && (
                                  <p className="text-xs text-gray-500 line-clamp-1">{history.description}</p>
                                )}
                                <p className="text-xs text-gray-400">
                                  {new Date(history.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="text-lg font-bold text-teal">+{history.points_earned}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Leaderboard */}
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Award className="w-5 h-5 text-teal" />
                        Top Players
                      </h3>
                      {leaderboard.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No leaderboard data yet</p>
                      ) : (
                        <div className="space-y-2">
                          {leaderboard.slice(0, 10).map((entry) => {
                            const isCurrentUser = entry.user_id === user?.id;
                            const userInitials = entry.user_id.substring(0, 2).toUpperCase();
                            return (
                              <div
                                key={entry.user_id}
                                className={`flex items-center gap-3 p-3 rounded-lg ${
                                  isCurrentUser ? 'bg-teal/10 border-2 border-teal' : 'bg-gray-50'
                                }`}
                              >
                                {/* Rank */}
                                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                                  {entry.rank === 1 && <span className="text-2xl">🥇</span>}
                                  {entry.rank === 2 && <span className="text-2xl">🥈</span>}
                                  {entry.rank === 3 && <span className="text-2xl">🥉</span>}
                                  {entry.rank > 3 && (
                                    <span className="text-sm font-bold text-gray-500">#{entry.rank}</span>
                                  )}
                                </div>

                                {/* User Circle with Initials */}
                                <div 
                                  className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold flex-shrink-0"
                                  style={{ backgroundColor: userColors[entry.user_id] || '#14b8a6' }}
                                >
                                  {userInitials}
                                </div>

                                {/* Current User Label (if applicable) */}
                                {isCurrentUser && (
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-teal">(You)</p>
                                  </div>
                                )}
                                {!isCurrentUser && <div className="flex-1" />}

                                {/* Points */}
                                <div className="text-right">
                                  <span className="font-bold text-yellow-600">
                                    {entry.total_points.toLocaleString()}
                                  </span>
                                  <Trophy className="w-4 h-4 text-yellow-500 inline ml-1" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Show user's rank if not in top 10 */}
                      {userRank > 10 && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-teal/10 border-2 border-teal">
                            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-bold text-gray-500">#{userRank}</span>
                            </div>
                            <div 
                              className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold flex-shrink-0"
                              style={{ backgroundColor: userColors[user!.id] || '#14b8a6' }}
                            >
                              {user?.id.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-teal">(You)</p>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-yellow-600">
                                {totalPoints.toLocaleString()}
                              </span>
                              <Trophy className="w-4 h-4 text-yellow-500 inline ml-1" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      </PullToRefresh>
    </Layout>
  );
}
