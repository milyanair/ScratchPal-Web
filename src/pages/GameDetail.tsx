import { Layout } from '@/components/layout/Layout';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Game, ForumTopic } from '@/types';
import { ArrowLeft, Award, Heart, ThumbsUp, ThumbsDown, Trophy, Upload, X, ScanLine } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';

export function GameDetail() {
  const { id, state, price, slug } = useParams<{ id?: string; state?: string; price?: string; slug?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [newConvoText, setNewConvoText] = useState('');
  
  // Get returnToScan from location state if user came from a scan
  const returnToScanId = (location.state as any)?.returnToScan;
  const isSampleScan = (location.state as any)?.isSampleScan;
  
  // Share Your Win state
  const [winAmount, setWinAmount] = useState('');
  const [purchaseLocation, setPurchaseLocation] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [winStep, setWinStep] = useState(2); // Start at step 2 since game is already selected
  
  // Floating button state
  const [floatingButtonPos, setFloatingButtonPos] = useState({ x: window.innerWidth - 80, y: window.innerHeight / 2 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const [showBounce, setShowBounce] = useState(true);
  
  // SlideOver state
  const [imageSlideState, setImageSlideState] = useState<'peek' | 'full'>('peek');
  
  // Swipe gesture state
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);

  // Get user's game layout preference
  const { data: userPref } = useQuery({
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

  const gameLayout = userPref?.game_layout || 'vertical';

  // Check if mobile (width < 1024px) - MUST be declared before rendering
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { data: game } = useQuery({
    queryKey: ['game', id, state, price, slug],
    queryFn: async () => {
      // Try new SEO-friendly URL format first
      if (state && slug) {
        const { data, error } = await supabase
          .from('games')
          .select('*')
          .eq('state', state.toUpperCase())
          .eq('slug', slug)
          .maybeSingle();
        
        if (!error && data) return data as Game;
      }
      
      // Fallback to ID-based lookup (backwards compatibility)
      if (id) {
        const { data, error } = await supabase
          .from('games')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) throw error;
        return data as Game;
      }
      
      throw new Error('Game not found');
    },
  });

  const { data: recentConvos = [] } = useQuery({
    queryKey: ['gameConvos', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_topics')
        .select('*')
        .eq('game_id', id)
        .order('created_at', { ascending: false })
        .limit(4);
      
      if (error) throw error;
      return data as ForumTopic[];
    },
  });

  // Handle floating button drag
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setHasMoved(false);
    setDragStart({ x: touch.clientX - floatingButtonPos.x, y: touch.clientY - floatingButtonPos.y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const newX = touch.clientX - dragStart.x;
    const newY = touch.clientY - dragStart.y;
    
    // Mark as moved if position changed significantly
    if (Math.abs(newX - floatingButtonPos.x) > 5 || Math.abs(newY - floatingButtonPos.y) > 5) {
      setHasMoved(true);
    }
    
    setFloatingButtonPos({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    
    // If not moved significantly, treat as click
    if (!hasMoved) {
      haptics.medium();
      if (isSampleScan) {
        // Return to sample scan overlay
        navigate('/scan-tickets', { state: { openSampleScan: true } });
      } else {
        // Return to My Favorites > My Scans tab with specific scan
        navigate('/favorites', { state: { returnToScanId } });
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setHasMoved(false);
    setDragStart({ x: e.clientX - floatingButtonPos.x, y: e.clientY - floatingButtonPos.y });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    if (Math.abs(newX - floatingButtonPos.x) > 5 || Math.abs(newY - floatingButtonPos.y) > 5) {
      setHasMoved(true);
    }
    
    setFloatingButtonPos({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    
    if (!hasMoved) {
      haptics.medium();
      if (isSampleScan) {
        // Return to sample scan overlay
        navigate('/scan-tickets', { state: { openSampleScan: true } });
      } else {
        // Return to My Favorites > My Scans tab with specific scan
        navigate('/favorites', { state: { returnToScanId } });
      }
    }
  };

  // Mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart, floatingButtonPos]);

  // Remove bounce animation after 3 seconds
  useEffect(() => {
    if (returnToScanId) {
      const timer = setTimeout(() => {
        setShowBounce(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [returnToScanId]);
  
  // Handle swipe gestures for SlideOver layout
  const handleSwipeStart = (e: React.TouchEvent) => {
    // Ignore swipes that start on input/textarea elements
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }
    setTouchStartX(e.touches[0].clientX);
  };
  
  const handleSwipeMove = (e: React.TouchEvent) => {
    // Ignore swipes on input/textarea elements
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }
    setTouchEndX(e.touches[0].clientX);
  };
  
  const handleSwipeEnd = () => {
    if (touchStartX === 0) return;
    
    const swipeDistance = touchStartX - touchEndX;
    const minSwipeDistance = 50; // Minimum distance to trigger swipe
    
    // Swipe left (show full image)
    if (swipeDistance > minSwipeDistance && imageSlideState === 'peek') {
      haptics.light();
      setImageSlideState('full');
    }
    // Swipe right (show peek view)
    else if (swipeDistance < -minSwipeDistance && imageSlideState === 'full') {
      haptics.light();
      setImageSlideState('peek');
    }
    
    // Reset touch positions
    setTouchStartX(0);
    setTouchEndX(0);
  };

  // Check if game is favorited
  useEffect(() => {
    if (!user || !id) return;

    const checkFavorite = async () => {
      const { data } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('favorite_type', 'game')
        .eq('reference_id', id)
        .single();
      
      setIsFavorited(!!data);
    };

    checkFavorite();
  }, [user, id]);

  // Auto-scroll to convos if hash is present
  useEffect(() => {
    if (location.hash === '#convos') {
      setTimeout(() => {
        document.getElementById('convos')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [location]);

  const toggleFavorite = async () => {
    if (!user) {
      toast.error('Please sign in to favorite games');
      return;
    }

    try {
      if (isFavorited) {
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('favorite_type', 'game')
          .eq('reference_id', id!);
        setIsFavorited(false);
        toast.success('Removed from favorites');
      } else {
        await supabase
          .from('favorites')
          .insert({
            user_id: user.id,
            favorite_type: 'game',
            reference_id: id!,
          });
        setIsFavorited(true);
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
    }
  };

  const handlePostConvo = async () => {
    if (!user) {
      toast.error('Please sign in to post');
      return;
    }

    if (!newConvoText.trim()) {
      toast.error('Please enter a message');
      return;
    }

    try {
      await supabase.from('forum_topics').insert({
        user_id: user.id,
        game_id: id!,
        category: 'Game Talk',
        title: `Discussion about ${game?.game_name}`,
        content: newConvoText,
      });

      setNewConvoText('');
      toast.success('Posted!');
    } catch (error) {
      console.error('Error posting:', error);
      toast.error('Failed to post');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!user) {
      toast.error('Please sign in to upload images');
      return;
    }

    setIsUploading(true);

    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (file.size > 10485760) {
          toast.error(`${file.name} is too large. Max size is 10MB.`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}_${Date.now()}_${i}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('forum-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('forum-images')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      setUploadedImages([...uploadedImages, ...uploadedUrls]);
      toast.success(`${uploadedUrls.length} image(s) uploaded`);
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error('Failed to upload images');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (url: string) => {
    setUploadedImages(uploadedImages.filter(img => img !== url));
  };

  const handleSubmitWin = async () => {
    if (!game || !winAmount) {
      toast.error('Please complete all required fields');
      return;
    }

    if (!user) {
      toast.error('Please sign in to report wins');
      return;
    }

    try {
      // Insert win record
      await supabase.from('wins').insert({
        user_id: user.id,
        game_id: game.id,
        store_id: null,
        win_amount: parseFloat(winAmount),
        image_url: uploadedImages.length > 0 ? uploadedImages[0] : null,
      });

      // Create forum topic for the win
      const topicTitle = `${game.game_name} Win`;
      
      const topicLines = [
        `State: ${game.state}`,
        `Game: ${game.game_name}`,
        `Amount: $${parseFloat(winAmount).toLocaleString()}`
      ];
      
      if (purchaseLocation) {
        topicLines.push(`Purchased From: ${purchaseLocation}`);
      }
      
      const topicContent = topicLines.join('\n');

      await supabase.from('forum_topics').insert({
        user_id: user.id,
        game_id: game.id,
        category: 'Game Talk',
        title: topicTitle,
        content: topicContent,
        image_urls: uploadedImages.length > 0 ? uploadedImages : null,
      });

      toast.success('Win reported! 🎉');
      // Reset form
      setWinAmount('');
      setPurchaseLocation('');
      setUploadedImages([]);
      setWinStep(2);
    } catch (error) {
      console.error('Error reporting win:', error);
      toast.error('Failed to report win');
    }
  };

  if (!game) {
    return (
      <Layout>
        <div className="p-6 text-center">Loading...</div>
      </Layout>
    );
  }

  const percentage = game.total_top_prizes > 0 
    ? ((game.top_prizes_remaining / game.total_top_prizes) * 100).toFixed(0) 
    : 0;

  // Get rank color based on new 6-tier system
  const getRankColor = (rank: number) => {
    if (rank >= 85) return 'bg-green-700'; // Best
    if (rank >= 60) return 'bg-green-400'; // Good
    if (rank >= 45) return 'bg-yellow-400'; // OK
    if (rank >= 30) return 'bg-orange-500'; // Fair
    if (rank >= 15) return 'bg-red-500'; // Poor
    return 'bg-gray-400'; // Just Don't
  };

  return (
    <Layout>
      <div className={`max-w-screen-xl mx-auto ${gameLayout === 'slideover' && isMobile ? 'px-0 py-0' : 'px-4 py-6'}`}>
        {/* Floating Return to Scan Button - Only show if returnToScanId is provided */}
        {returnToScanId && (
          <div
            className="fixed z-50 w-16 h-16 cursor-move touch-none"
            style={{
              left: `${floatingButtonPos.x}px`,
              top: `${floatingButtonPos.y}px`,
              transform: 'translate(-50%, -50%)'
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onClick={(e) => {
              // Handle click if not dragged
              if (!hasMoved && !isDragging) {
                e.preventDefault();
                haptics.medium();
                if (isSampleScan) {
                  // Return to sample scan overlay
                  navigate('/scan-tickets', { state: { openSampleScan: true } });
                } else {
                  // Return to My Favorites > My Scans tab with specific scan
                  navigate('/favorites', { state: { returnToScanId } });
                }
              }
            }}
          >
            <div className={`w-full h-full rounded-full bg-cyan-500 opacity-80 border-4 border-white shadow-2xl flex items-center justify-center hover:opacity-90 transition-opacity ${showBounce ? 'animate-bounce' : ''}`}>
              <span className="text-3xl">↩️</span>
            </div>
          </div>
        )}

        {/* Vertical Layout (default) or Desktop */}
        {(gameLayout === 'vertical' || !isMobile) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Back + Title */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  haptics.light();
                  navigate(-1);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold">{game.game_name}</h1>
            </div>

            {/* Game Info */}
            <div className="bg-gray-200/50 backdrop-blur rounded-lg shadow p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">
                    #{game.game_number}
                  </span>
                  <span className="text-sm bg-teal/10 text-teal px-3 py-1 rounded-full">
                    {game.state}
                  </span>
                  <div className={`w-11 h-11 rounded-full ${getRankColor(game.rank)} border-2 border-white shadow-md flex items-center justify-center`}>
                    <Award className="w-4 h-4 text-white" />
                    <span className="text-sm font-bold text-white">{game.rank}</span>
                  </div>
                  <button
                    onClick={toggleFavorite}
                    className="p-2 rounded-lg hover:bg-gray-100"
                  >
                    <Heart
                      className={`w-6 h-6 ${
                        isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-400 stroke-red-500'
                      }`}
                      strokeWidth={isFavorited ? 0 : 2}
                    />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
                    <ThumbsUp className="w-4 h-4" />
                    <span>{game.upvotes}</span>
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
                    <ThumbsDown className="w-4 h-4" />
                    <span>{game.downvotes}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <div className="text-sm text-gray-500">Ticket Price</div>
                  <div className="text-xl font-bold text-green-600">${game.price}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Top Prize</div>
                  <div className="text-xl font-bold text-teal">
                    ${game.top_prize.toLocaleString()}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="flex flex-col min-[400px]:flex-row min-[400px]:items-center gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="text-sm text-gray-500">Prizes Remaining</div>
                      <div className="text-lg font-bold">
                        {game.top_prizes_remaining} / {game.total_top_prizes}
                        <span className="text-sm font-normal text-gray-500 ml-2">
                          ({percentage}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm text-gray-500">Game Duration</div>
                  <div className="text-sm">
                    <span className="font-normal">Start:</span> <span className="font-bold">{game.start_date ? new Date(game.start_date).toLocaleDateString() : 'N/A'}</span> <span className="font-normal">| End:</span> <span className="font-bold">{game.end_date ? new Date(game.end_date).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
                {game.overall_odds && (
                  <div className="col-span-2">
                    <div className="text-sm text-gray-500">Overall Odds</div>
                    <div className="text-lg font-bold">{game.overall_odds}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Convos */}
            <div id="convos" className="bg-orange-500/40 backdrop-blur rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Recent Convos</h2>
              <div className="space-y-3 mb-4">
                {recentConvos.length === 0 ? (
                  <p className="text-gray-500 text-sm">No conversations yet</p>
                ) : (
                  recentConvos.map((convo) => (
                    <div key={convo.id} className="border-l-4 border-teal pl-3 py-2">
                      <p className="text-sm whitespace-pre-line">{convo.content}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(convo.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <button
                onClick={() => navigate('/hot-topics')}
                className="text-sm text-teal font-medium hover:underline"
              >
                View All →
              </button>
            </div>

            {/* Share Your Win Widget */}
            <div className="bg-purple-500/40 backdrop-blur rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-6 h-6 text-wins" />
                <h2 className="text-xl font-bold">Share Your Win</h2>
              </div>
              
              {/* Step Progress Indicator */}
              <div className="flex items-center justify-center mb-6">
                {/* Step 1 */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    winStep >= 1 ? 'bg-purple-600 text-white' : 'bg-gray-300 text-gray-600'
                  }`}>
                    1
                  </div>
                  <span className="text-xs mt-1 text-gray-600">Game</span>
                </div>
                
                {/* Line 1-2 */}
                <div className={`h-0.5 w-8 mx-1 ${
                  winStep >= 2 ? 'bg-purple-600' : 'bg-gray-300'
                }`}></div>
                
                {/* Step 2 */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    winStep >= 2 ? 'bg-purple-600 text-white' : 'bg-gray-300 text-gray-600'
                  }`}>
                    2
                  </div>
                  <span className="text-xs mt-1 text-gray-600">Amount</span>
                </div>
                
                {/* Line 2-3 */}
                <div className={`h-0.5 w-8 mx-1 ${
                  winStep >= 3 ? 'bg-purple-600' : 'bg-gray-300'
                }`}></div>
                
                {/* Step 3 */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    winStep >= 3 ? 'bg-purple-600 text-white' : 'bg-gray-300 text-gray-600'
                  }`}>
                    3
                  </div>
                  <span className="text-xs mt-1 text-gray-600">Location</span>
                </div>
                
                {/* Line 3-4 */}
                <div className={`h-0.5 w-8 mx-1 ${
                  winStep >= 4 ? 'bg-purple-600' : 'bg-gray-300'
                }`}></div>
                
                {/* Step 4 */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    winStep >= 4 ? 'bg-purple-600 text-white' : 'bg-gray-300 text-gray-600'
                  }`}>
                    4
                  </div>
                  <span className="text-xs mt-1 text-gray-600">Photo</span>
                </div>
              </div>
              
              {/* Step 2: Enter Amount */}
              {winStep === 2 && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">How much did you win?</p>
                  <input
                    type="number"
                    value={winAmount}
                    onChange={(e) => setWinAmount(e.target.value)}
                    placeholder="Enter win amount"
                    className="w-full px-4 py-3 border rounded-lg text-lg mb-4"
                    min="0"
                    step="0.01"
                  />
                  <button
                    onClick={() => setWinStep(3)}
                    disabled={!winAmount}
                    className="w-full gradient-wins text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}

              {/* Step 3: Purchase Location */}
              {winStep === 3 && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">Where was this ticket purchased?</p>
                  <input
                    type="text"
                    value={purchaseLocation}
                    onChange={(e) => setPurchaseLocation(e.target.value)}
                    placeholder="Kroger in Sandy Springs, GA"
                    className="w-full px-4 py-3 border rounded-lg text-lg mb-4"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => setWinStep(2)}
                      className="flex-1 px-6 py-3 border rounded-lg font-semibold"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setWinStep(4)}
                      className="flex-1 gradient-wins text-white px-6 py-3 rounded-lg font-semibold"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Upload Photo */}
              {winStep === 4 && (
                <div>
                  <p className="text-sm text-gray-600 mb-4">Share a photo (optional)</p>
                  
                  <div className="mb-4">
                    <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 text-gray-600 cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={isUploading}
                      />
                      <Upload className="w-6 h-6" />
                      <span className="font-medium">{isUploading ? 'Uploading...' : 'Upload Images'}</span>
                    </label>

                    {uploadedImages.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        {uploadedImages.map((url, idx) => (
                          <div key={idx} className="relative group">
                            <img
                              src={url}
                              alt={`Upload ${idx + 1}`}
                              className="w-full h-24 object-cover rounded-lg"
                            />
                            <button
                              onClick={() => removeImage(url)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
                    <p><strong>Game:</strong> {game.game_name}</p>
                    <p><strong>Amount:</strong> ${winAmount}</p>
                    {purchaseLocation && <p><strong>Purchased From:</strong> {purchaseLocation}</p>}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setWinStep(3)}
                      className="flex-1 px-6 py-3 border rounded-lg font-semibold"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSubmitWin}
                      className="flex-1 gradient-wins text-white px-6 py-3 rounded-lg font-semibold"
                    >
                      Submit Win 🎉
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Talk About It */}
            <div className="bg-orange-500/50 backdrop-blur rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Talk About It</h2>
              <p className="text-sm text-gray-600 mb-3">
                Share your thoughts about this game
              </p>
              <textarea
                value={newConvoText}
                onChange={(e) => setNewConvoText(e.target.value)}
                className="w-full border rounded-lg p-3 mb-3 min-h-[100px]"
                placeholder="What do you think about this game?"
              />
              <button
                onClick={handlePostConvo}
                className="w-full gradient-teal text-white py-3 rounded-lg font-semibold hover:opacity-90"
              >
                Post
              </button>
            </div>
          </div>

          {/* Right Column - Image */}
          <div className="lg:sticky lg:top-24 h-fit">
            <img
              src={
                game.image_url ||
                'https://images.unsplash.com/photo-1633265486064-086b219458ec?w=600&h=900&fit=crop&q=80'
              }
              alt={game.game_name}
              className="w-full rounded-lg shadow-lg"
            />
            <div className="mt-4 text-center space-x-4">
              {/* Source Link */}
              {game.source && game.source_url && (
                <a
                  href={game.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal hover:text-teal/80 font-semibold text-sm underline"
                >
                  Source: {game.source}
                </a>
              )}
              
              {/* Report a Problem Link */}
              <button
                onClick={() => {
                  haptics.light();
                  navigate('/hot-topics', { 
                    state: { 
                      presetCategory: 'Report a Problem',
                      gameId: game.id,
                      gameName: game.game_name,
                      state: game.state
                    } 
                  });
                }}
                className="text-red-600 hover:text-red-700 font-semibold text-sm underline"
              >
                Report a Problem
              </button>
            </div>
          </div>
        </div>
        )}

        {/* SlideOver Layout (mobile only) */}
        {gameLayout === 'slideover' && isMobile && (
        <div className="relative overflow-hidden h-screen">
          <div 
            className="flex gap-2.5 transition-transform duration-300 ease-in-out h-full"
            style={{
              transform: imageSlideState === 'peek' ? 'translateX(0)' : 'translateX(calc(-70% - 10px))'
            }}
            onTouchStart={handleSwipeStart}
            onTouchMove={handleSwipeMove}
            onTouchEnd={handleSwipeEnd}
          >
            {/* Left Side - Content Blocks (70% width) */}
            <div className="flex-shrink-0 overflow-y-auto" style={{ width: '70%' }}>
              <div className="space-y-6 px-4 py-6">
                {/* Back + Title */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      haptics.light();
                      navigate(-1);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h1 className="text-2xl font-bold">{game.game_name}</h1>
                </div>

                {/* Game Info */}
                <div className="bg-gray-200/50 backdrop-blur rounded-lg shadow p-6 space-y-3">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">
                      #{game.game_number}
                    </span>
                    <span className="text-sm bg-teal/10 text-teal px-3 py-1 rounded-full">
                      {game.state}
                    </span>
                    <div className={`w-11 h-11 rounded-full ${getRankColor(game.rank)} border-2 border-white shadow-md flex items-center justify-center`}>
                      <Award className="w-4 h-4 text-white" />
                      <span className="text-sm font-bold text-white">{game.rank}</span>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <div>
                      <div className="text-sm text-gray-500">Ticket Price</div>
                      <div className="text-xl font-bold text-green-600">${game.price}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Top Prize</div>
                      <div className="text-xl font-bold text-teal">
                        ${game.top_prize.toLocaleString()}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-sm text-gray-500">Prizes Remaining</div>
                      <div className="text-lg font-bold">
                        {game.top_prizes_remaining} / {game.total_top_prizes}
                        <span className="text-sm font-normal text-gray-500 ml-2">
                          ({percentage}%)
                        </span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-sm text-gray-500">Game Duration</div>
                      <div className="text-sm">
                        <span className="font-normal">Start:</span> <span className="font-bold">{game.start_date ? new Date(game.start_date).toLocaleDateString() : 'N/A'}</span> <span className="font-normal">| End:</span> <span className="font-bold">{game.end_date ? new Date(game.end_date).toLocaleDateString() : 'N/A'}</span>
                      </div>
                    </div>
                    {game.overall_odds && (
                      <div className="col-span-2">
                        <div className="text-sm text-gray-500">Overall Odds</div>
                        <div className="text-lg font-bold">{game.overall_odds}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Convos */}
                <div id="convos" className="bg-orange-500/40 backdrop-blur rounded-lg shadow p-6">
                  <h2 className="text-xl font-bold mb-4">Recent Convos</h2>
                  <div className="space-y-3 mb-4">
                    {recentConvos.length === 0 ? (
                      <p className="text-gray-500 text-sm">No conversations yet</p>
                    ) : (
                      recentConvos.map((convo) => (
                        <div key={convo.id} className="border-l-4 border-teal pl-3 py-2">
                          <p className="text-sm whitespace-pre-line">{convo.content}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(convo.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => navigate('/hot-topics')}
                    className="text-sm text-teal font-medium hover:underline"
                  >
                    View All →
                  </button>
                </div>

                {/* Share Your Win Widget */}
                <div className="bg-purple-500/40 backdrop-blur rounded-lg shadow p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-6 h-6 text-wins" />
                    <h2 className="text-xl font-bold">Share Your Win</h2>
                  </div>
                  
                  {/* Step Progress Indicator */}
                  <div className="flex items-center justify-center mb-6">
                    {/* Step 1 */}
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        winStep >= 1 ? 'bg-purple-600 text-white' : 'bg-gray-300 text-gray-600'
                      }`}>
                        1
                      </div>
                      <span className="text-xs mt-1 text-gray-600">Game</span>
                    </div>
                    
                    {/* Line 1-2 */}
                    <div className={`h-0.5 w-8 mx-1 ${
                      winStep >= 2 ? 'bg-purple-600' : 'bg-gray-300'
                    }`}></div>
                    
                    {/* Step 2 */}
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        winStep >= 2 ? 'bg-purple-600 text-white' : 'bg-gray-300 text-gray-600'
                      }`}>
                        2
                      </div>
                      <span className="text-xs mt-1 text-gray-600">Amount</span>
                    </div>
                    
                    {/* Line 2-3 */}
                    <div className={`h-0.5 w-8 mx-1 ${
                      winStep >= 3 ? 'bg-purple-600' : 'bg-gray-300'
                    }`}></div>
                    
                    {/* Step 3 */}
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        winStep >= 3 ? 'bg-purple-600 text-white' : 'bg-gray-300 text-gray-600'
                      }`}>
                        3
                      </div>
                      <span className="text-xs mt-1 text-gray-600">Location</span>
                    </div>
                    
                    {/* Line 3-4 */}
                    <div className={`h-0.5 w-8 mx-1 ${
                      winStep >= 4 ? 'bg-purple-600' : 'bg-gray-300'
                    }`}></div>
                    
                    {/* Step 4 */}
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        winStep >= 4 ? 'bg-purple-600 text-white' : 'bg-gray-300 text-gray-600'
                      }`}>
                        4
                      </div>
                      <span className="text-xs mt-1 text-gray-600">Photo</span>
                    </div>
                  </div>
                  
                  {/* Step 2: Enter Amount */}
                  {winStep === 2 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-3">How much did you win?</p>
                      <input
                        type="number"
                        value={winAmount}
                        onChange={(e) => setWinAmount(e.target.value)}
                        placeholder="Enter win amount"
                        className="w-full px-4 py-3 border rounded-lg text-lg mb-4"
                        min="0"
                        step="0.01"
                      />
                      <button
                        onClick={() => setWinStep(3)}
                        disabled={!winAmount}
                        className="w-full gradient-wins text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}

                  {/* Step 3: Purchase Location */}
                  {winStep === 3 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-3">Where was this ticket purchased?</p>
                      <input
                        type="text"
                        value={purchaseLocation}
                        onChange={(e) => setPurchaseLocation(e.target.value)}
                        placeholder="Kroger in Sandy Springs, GA"
                        className="w-full px-4 py-3 border rounded-lg text-lg mb-4"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => setWinStep(2)}
                          className="flex-1 px-6 py-3 border rounded-lg font-semibold"
                        >
                          Back
                        </button>
                        <button
                          onClick={() => setWinStep(4)}
                          className="flex-1 gradient-wins text-white px-6 py-3 rounded-lg font-semibold"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Upload Photo */}
                  {winStep === 4 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-4">Share a photo (optional)</p>
                      
                      <div className="mb-4">
                        <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 text-gray-600 cursor-pointer hover:bg-gray-50 transition-colors">
                          <input
                            type="file"
                            multiple
                            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                            onChange={handleImageUpload}
                            className="hidden"
                            disabled={isUploading}
                          />
                          <Upload className="w-6 h-6" />
                          <span className="font-medium">{isUploading ? 'Uploading...' : 'Upload Images'}</span>
                        </label>

                        {uploadedImages.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 mt-4">
                            {uploadedImages.map((url, idx) => (
                              <div key={idx} className="relative group">
                                <img
                                  src={url}
                                  alt={`Upload ${idx + 1}`}
                                  className="w-full h-24 object-cover rounded-lg"
                                />
                                <button
                                  onClick={() => removeImage(url)}
                                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
                        <p><strong>Game:</strong> {game.game_name}</p>
                        <p><strong>Amount:</strong> ${winAmount}</p>
                        {purchaseLocation && <p><strong>Purchased From:</strong> {purchaseLocation}</p>}
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => setWinStep(3)}
                          className="flex-1 px-6 py-3 border rounded-lg font-semibold"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleSubmitWin}
                          className="flex-1 gradient-wins text-white px-6 py-3 rounded-lg font-semibold"
                        >
                          Submit Win 🎉
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Talk About It */}
                <div className="bg-orange-500/50 backdrop-blur rounded-lg shadow p-6">
                  <h2 className="text-xl font-bold mb-4">Talk About It</h2>
                  <p className="text-sm text-gray-600 mb-3">
                    Share your thoughts about this game
                  </p>
                  <textarea
                    value={newConvoText}
                    onChange={(e) => setNewConvoText(e.target.value)}
                    className="w-full border rounded-lg p-3 mb-3 min-h-[100px]"
                    placeholder="What do you think about this game?"
                  />
                  <button
                    onClick={handlePostConvo}
                    className="w-full gradient-teal text-white py-3 rounded-lg font-semibold hover:opacity-90"
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>

            {/* Right Side - Game Image (initially ~20% showing, slides to 100%) */}
            <div 
              className="flex-shrink-0 relative min-h-screen flex flex-col py-8"
              style={{ width: '100%' }}
            >
              {/* Multiple Triangle Buttons spaced 200px apart */}
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <button
                  key={index}
                  onClick={() => {
                    haptics.light();
                    setImageSlideState(imageSlideState === 'peek' ? 'full' : 'peek');
                  }}
                  className="absolute left-4 z-10 bg-white/40 p-3 rounded-lg hover:bg-white/60 transition-colors"
                  style={{ top: `${31 + (index * 200)}px` }}
                >
                  <span className="text-white text-2xl font-bold">
                    {imageSlideState === 'peek' ? '▶' : '◀'}
                  </span>
                </button>
              ))}
              
              {/* Favorite Heart - positioned below first arrow */}
              <button
                onClick={toggleFavorite}
                className="absolute left-4 z-10 p-2 rounded-lg bg-white/40 hover:bg-white/60 backdrop-blur"
                style={{ top: '95px' }}
              >
                <Heart
                  className={`w-6 h-6 ${
                    isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-400 stroke-red-500'
                  }`}
                  strokeWidth={isFavorited ? 0 : 2}
                />
              </button>
              
              {/* Voting Buttons - positioned between first and second arrow */}
              <div className="absolute left-4 z-10 flex flex-col gap-2" style={{ top: '131px' }}>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-100/90 rounded-lg hover:bg-gray-200 backdrop-blur">
                  <ThumbsUp className="w-4 h-4" />
                  <span>{game.upvotes}</span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-100/90 rounded-lg hover:bg-gray-200 backdrop-blur">
                  <ThumbsDown className="w-4 h-4" />
                  <span>{game.downvotes}</span>
                </button>
              </div>
              
              <img
                src={
                  game.image_url ||
                  'https://images.unsplash.com/photo-1633265486064-086b219458ec?w=600&h=900&fit=crop&q=80'
                }
                alt={game.game_name}
                className="w-full h-auto object-contain shadow-lg"
              />
              
              <div className="mt-4 text-center space-x-4">
                {/* Source Link */}
                {game.source && game.source_url && (
                  <a
                    href={game.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal hover:text-teal/80 font-semibold text-sm underline"
                  >
                    Source: {game.source}
                  </a>
                )}
                
                {/* Report a Problem Link */}
                <button
                  onClick={() => {
                    haptics.light();
                    navigate('/hot-topics', { 
                      state: { 
                        presetCategory: 'Report a Problem',
                        gameId: game.id,
                        gameName: game.game_name,
                        state: game.state
                      } 
                    });
                  }}
                  className="text-red-600 hover:text-red-700 font-semibold text-sm underline"
                >
                  Report a Problem
                </button>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </Layout>
  );
}
