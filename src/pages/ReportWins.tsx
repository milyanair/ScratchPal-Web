import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Game } from '@/types';
import { Search, Upload, Trophy, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { haptics } from '@/lib/haptics';

export function ReportWins() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedGameId = searchParams.get('gameId');

  const [step, setStep] = useState(1);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [winAmount, setWinAmount] = useState('');
  const [purchaseLocation, setPurchaseLocation] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [gameSearch, setGameSearch] = useState('');

  // Get selected state from localStorage for anonymous users
  const [anonymousState, setAnonymousState] = useState<string>(() => {
    return localStorage.getItem('selected_state') || '';
  });

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

  const selectedState = user ? userPref?.selected_state : anonymousState;

  const { data: games = [] } = useQuery({
    queryKey: ['games', selectedState],
    queryFn: async () => {
      if (!selectedState) return [];
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('state', selectedState)
        .order('game_name');
      
      if (error) throw error;
      return data as Game[];
    },
    enabled: !!selectedState,
  });



  // Preselect game if gameId is in URL
  useEffect(() => {
    if (preselectedGameId && games.length > 0) {
      const game = games.find(g => g.id === preselectedGameId);
      if (game) {
        setSelectedGame(game);
        setStep(2);
      }
    }
  }, [preselectedGameId, games]);

  const filteredGames = games.filter(g =>
    g.game_name.toLowerCase().includes(gameSearch.toLowerCase()) ||
    g.game_number.toLowerCase().includes(gameSearch.toLowerCase())
  );

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
        
        // Check file size (max 10MB)
        if (file.size > 10485760) {
          toast.error(`${file.name} is too large. Max size is 10MB.`);
          continue;
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}_${Date.now()}_${i}.${fileExt}`;
        const filePath = `${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('forum-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
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

  const handleSubmit = async () => {
    if (!selectedGame || !winAmount) {
      toast.error('Please complete all required fields');
      haptics.error(); // Error vibration
      return;
    }

    if (!user) {
      toast.error('Please sign in to report wins');
      haptics.error(); // Error vibration
      return;
    }

    try {
      // Insert win record
      await supabase.from('wins').insert({
        user_id: user.id,
        game_id: selectedGame.id,
        store_id: null,
        win_amount: parseFloat(winAmount),
        image_url: uploadedImages.length > 0 ? uploadedImages[0] : null,
      });

      // Create forum topic for the win
      const topicTitle = `${selectedGame.game_name} Win`;
      
      // Build content with each detail on a separate line
      const topicLines = [
        `State: ${selectedGame.state}`,
        `Game: ${selectedGame.game_name}`,
        `Amount: $${parseFloat(winAmount).toLocaleString()}`
      ];
      
      if (purchaseLocation) {
        topicLines.push(`Purchased From: ${purchaseLocation}`);
      }
      
      const topicContent = topicLines.join('\n');

      await supabase.from('forum_topics').insert({
        user_id: user.id,
        game_id: selectedGame.id,
        category: 'Game Talk',
        title: topicTitle,
        content: topicContent,
        image_urls: uploadedImages.length > 0 ? uploadedImages : null,
      });

      haptics.success(); // Success vibration pattern
      toast.success('Win reported! 🎉');
      navigate('/');
    } catch (error) {
      console.error('Error reporting win:', error);
      haptics.error(); // Error vibration
      toast.error('Failed to report win');
    }
  };

  // Allow everyone to see the page, but require sign-in for submission

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-wins" />
            <h1 className="text-3xl font-bold">Share Your Win</h1>
          </div>
          <p className="text-gray-600">
            Share your winning ticket with the community!
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-0 mb-4">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  step >= s
                    ? 'gradient-wins text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s}
              </div>
              {s < 4 && (
                <div className="flex items-center">
                  <div
                    className={`w-12 h-1 ${
                      step > s ? 'bg-wins' : 'bg-gray-200'
                    }`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Select Game */}
        {step === 1 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Which ticket did you win on?</h2>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={gameSearch}
                onChange={(e) => setGameSearch(e.target.value)}
                placeholder="Search games..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
            <div className="max-h-96 overflow-y-auto space-y-1">
              {filteredGames.map((game) => (
                <button
                  key={game.id}
                  onClick={() => {
                    haptics.light(); // Haptic feedback
                    setSelectedGame(game);
                    setStep(2);
                  }}
                  className="w-full text-left p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="font-semibold">{game.game_name}</div>
                  <div className="text-sm text-gray-600">
                    #{game.game_number} • ${game.price}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Enter Amount */}
        {step === 2 && selectedGame && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">How much did you win?</h2>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Selected Game:</p>
              <p className="font-semibold">{selectedGame.game_name}</p>
              <p className="text-sm text-gray-600">
                Top Prize: ${selectedGame.top_prize.toLocaleString()}
              </p>
            </div>
            <input
              type="number"
              value={winAmount}
              onChange={(e) => setWinAmount(e.target.value)}
              placeholder="Enter win amount"
              className="w-full px-4 py-3 border rounded-lg text-lg mb-4"
              min="0"
              step="0.01"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  haptics.light(); // Haptic feedback
                  setStep(1);
                }}
                className="flex-1 px-6 py-3 border rounded-lg font-semibold"
              >
                Back
              </button>
              <button
                onClick={() => {
                  haptics.light(); // Haptic feedback
                  setStep(3);
                }}
                disabled={!winAmount}
                className="flex-1 gradient-wins text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Purchase Location (Optional) */}
        {step === 3 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Where was this ticket purchased?</h2>
            <p className="text-sm text-gray-600 mb-4">
              Optional - Help others find winning locations
            </p>
            
            <input
              type="text"
              value={purchaseLocation}
              onChange={(e) => setPurchaseLocation(e.target.value)}
              placeholder="Kroger in Sandy Springs, GA"
              className="w-full px-4 py-3 border rounded-lg text-lg mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  haptics.light(); // Haptic feedback
                  setStep(2);
                }}
                className="flex-1 px-6 py-3 border rounded-lg font-semibold"
              >
                Back
              </button>
              <button
                onClick={() => {
                  haptics.light(); // Haptic feedback
                  setStep(4);
                }}
                className="flex-1 gradient-wins text-white px-6 py-3 rounded-lg font-semibold"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Upload Photo (Optional) */}
        {step === 4 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Share a Photo (Optional)</h2>
            <p className="text-sm text-gray-600 mb-4">
              Show off your winning ticket to the community!
            </p>
            
            {/* Image Upload */}
            <div className="mb-4">
              <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-8 text-gray-600 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploading}
                />
                <Upload className="w-8 h-8" />
                <span className="font-medium">{isUploading ? 'Uploading...' : 'Click to Upload Images'}</span>
              </label>

              {/* Image Previews */}
              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {uploadedImages.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={url}
                        alt={`Upload ${idx + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
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

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="font-semibold mb-2">Summary:</h3>
              <p className="text-sm">Game: {selectedGame?.game_name}</p>
              <p className="text-sm">Amount: ${winAmount}</p>
              {purchaseLocation && (
                <p className="text-sm">Purchased From: {purchaseLocation}</p>
              )}
              {uploadedImages.length > 0 && (
                <p className="text-sm">Images: {uploadedImages.length} attached</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  haptics.light(); // Haptic feedback
                  setStep(3);
                }}
                className="flex-1 px-6 py-3 border rounded-lg font-semibold"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 gradient-wins text-white px-6 py-3 rounded-lg font-semibold"
              >
                Submit Win 🎉
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
