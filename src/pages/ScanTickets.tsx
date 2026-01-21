
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { Camera, X, RotateCcw, Upload, Zap, Save, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Game } from '@/types';
import { haptics } from '@/lib/haptics';
import { SavedScanCard } from '@/components/SavedScanCard';

interface TicketMatch {
  game: Game;
  confidence: number;
  position: { x: number; y: number };
}

export function ScanTickets() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [ticketMatches, setTicketMatches] = useState<TicketMatch[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [savingScans, setSavingScans] = useState(false);
  const [scanLimitReached, setScanLimitReached] = useState(false);
  const [nextScanAvailable, setNextScanAvailable] = useState<Date | null>(null);
  const [showSampleScan, setShowSampleScan] = useState(false);
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('all');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const demoVideoRef = useRef<HTMLVideoElement>(null);

  // Check if we should auto-open sample scan from location state
  useEffect(() => {
    if ((location.state as any)?.openSampleScan) {
      setShowSampleScan(true);
      // Clear the state to prevent reopening on subsequent navigations
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  // Get user's selected state (moved up for earlier access)

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

  const selectedState = userPref?.selected_state;

  // Fetch sample scan (most recent one)
  const { data: sampleScan } = useQuery({
    queryKey: ['sampleScan'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanned_images')
        .select('*')
        .eq('is_sample', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  // Helper function to get start of current week (Monday at 00:00)
  const getStartOfWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days; otherwise go back to Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysToMonday);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
  };

  // Check scan usage for rate limiting (5 per week, resets Monday)
  const { data: scanUsage = [], refetch: refetchScanUsage } = useQuery({
    queryKey: ['scanUsage', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const startOfWeek = getStartOfWeek();
      const { data, error } = await supabase
        .from('scan_usage')
        .select('*')
        .eq('user_id', user.id)
        .gte('scanned_at', startOfWeek)
        .order('scanned_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Check if user has reached scan limit (5 per week, resets Monday)
  useEffect(() => {
    if (scanUsage.length >= 5) {
      setScanLimitReached(true);
      // Calculate next Monday at 00:00
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // If Sunday, 1 day; otherwise days until next Monday
      const nextMonday = new Date(now);
      nextMonday.setDate(now.getDate() + daysUntilMonday);
      nextMonday.setHours(0, 0, 0, 0);
      setNextScanAvailable(nextMonday);
    } else {
      setScanLimitReached(false);
      setNextScanAvailable(null);
    }
  }, [scanUsage]);

  // Get all games for the user's state
  const { data: games = [] } = useQuery({
    queryKey: ['games', selectedState],
    queryFn: async () => {
      if (!selectedState) return [];
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('state', selectedState);
      
      if (error) throw error;
      return data as Game[];
    },
    enabled: !!selectedState,
  });

  // Cleanup camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  // Start camera
  const startCamera = async () => {
    haptics.light();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setShowCamera(true);
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Failed to access camera. Please allow camera permissions.');
    }
  };

  // Capture photo from camera
  const capturePhoto = () => {
    haptics.medium();
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Optimize resolution for AI scanning (max 1920x1080)
      const maxWidth = 1920;
      const maxHeight = 1080;
      let width = video.videoWidth;
      let height = video.videoHeight;
      
      // Calculate scaling to fit within max dimensions while preserving aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw scaled image
        ctx.drawImage(video, 0, 0, width, height);
        // Reduce JPEG quality to 0.8 for smaller file size while maintaining scan quality
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageData);
        stopCamera();
      }
    }
  };

  // Auto-analyze when image is captured
  useEffect(() => {
    if (capturedImage && ticketMatches.length === 0 && !analyzing) {
      analyzeImage();
    }
  }, [capturedImage]);

  // Handle photo capture from file input (mobile camera or gallery)
  const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Optimize uploaded image resolution
          const canvas = document.createElement('canvas');
          const maxWidth = 1920;
          const maxHeight = 1080;
          let width = img.width;
          let height = img.height;
          
          // Scale down if necessary
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimizedImage = canvas.toDataURL('image/jpeg', 0.8);
            setCapturedImage(optimizedImage);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Analyze image using OnSpace AI
  const analyzeImage = async () => {
    if (!capturedImage || !selectedState || !user) return;

    // Check scan limit
    if (scanLimitReached) {
      toast.error('Scan limit reached. Please wait before scanning again.');
      return;
    }

    haptics.medium();
    setAnalyzing(true);
    setTicketMatches([]);

    try {
      // Call edge function to analyze the image
      const { data, error } = await supabase.functions.invoke('analyze-tickets', {
        body: {
          image: capturedImage,
          state: selectedState,
          games: games.map(g => ({
            id: g.id,
            game_name: g.game_name,
            game_number: g.game_number,
            price: g.price,
            rank: g.rank,
            top_prizes_remaining: g.top_prizes_remaining,
            total_top_prizes: g.total_top_prizes,
          })),
        },
      });

      if (error) {
        console.error('Analysis error:', error);
        throw new Error('Failed to analyze image');
      }

      console.log('Analysis results:', data);

      // Track scan usage
      const { error: usageError } = await supabase
        .from('scan_usage')
        .insert({ user_id: user.id });
      
      if (usageError) {
        console.error('Error tracking scan usage:', usageError);
      }

      // Refetch scan usage to update limit
      refetchScanUsage();

      // Process results
      if (data.matches && data.matches.length > 0) {
        console.log('=== Ticket Analysis Results ===');
        console.log('Total matches:', data.matches.length);
        data.matches.forEach((match, idx) => {
          console.log(`Match ${idx}:`, {
            game: match.game?.game_name,
            game_id: match.game?.id,
            position: match.position,
            confidence: match.confidence,
          });
        });
        
        setTicketMatches(data.matches);
        toast.success(`Found ${data.matches.length} tickets!`);
        
        // Auto-save scan after successful analysis
        await autoSaveScan(data.matches);
      } else {
        console.log('No matches found in analysis');
        toast.error('No tickets detected. Try a clearer photo.');
      }
    } catch (error: any) {
      console.error('Error analyzing image:', error);
      toast.error(error.message || 'Failed to analyze image');
    } finally {
      setAnalyzing(false);
    }
  };

  // Price range options
  const priceRanges: Record<string, { label: string; min: number; max: number }> = {
    all: { label: 'All', min: 0, max: 999 },
    '1-5': { label: '$1-$5', min: 1, max: 5 },
    '6-10': { label: '$6-$10', min: 6, max: 10 },
    '11-20': { label: '$11-$20', min: 11, max: 20 },
    '21-50': { label: '$21+', min: 21, max: 999 },
  };

  // Filter matches based on selected price range
  const filteredMatches = ticketMatches.filter((match) => {
    const range = priceRanges[selectedPriceRange];
    return match.game.price >= range.min && match.game.price <= range.max;
  });

  // Calculate dot color based on rank (6-tier system)
  const getDotColor = (rank: number) => {
    if (rank >= 85) return 'bg-green-700'; // Best
    if (rank >= 60) return 'bg-green-400'; // Good
    if (rank >= 45) return 'bg-yellow-400'; // OK
    if (rank >= 30) return 'bg-orange-500'; // Fair
    if (rank >= 15) return 'bg-red-500'; // Poor
    return 'bg-gray-400'; // Just Don't
  };

  // Auto-save scan after analysis
  const autoSaveScan = async (matches: TicketMatch[]) => {
    if (!capturedImage || !user || matches.length === 0) return;

    try {
      // Upload image to storage
      const timestamp = Date.now();
      const imageBlob = await fetch(capturedImage).then(r => r.blob());
      const filename = `scan_${user.id}_${timestamp}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('game-images')
        .upload(filename, imageBlob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('game-images')
        .getPublicUrl(filename);

      // Save scan data
      const { error: insertError } = await supabase
        .from('scanned_images')
        .insert({
          user_id: user.id,
          image_url: publicUrlData.publicUrl,
          state: selectedState,
          scan_name: `Scan ${new Date().toLocaleDateString()}`,
          ticket_matches: matches.map(m => ({
            game_id: m.game.id,
            confidence: m.confidence,
            position: m.position,
          })),
        });

      if (insertError) throw insertError;

      // Remove toast notification - user already sees "Found X tickets!" message
    } catch (error: any) {
      console.error('Error auto-saving scan:', error);
      // Don't show error toast for auto-save, it's not critical
    }
  };

  // Save scan to database
  const saveScan = async () => {
    if (!capturedImage || !user || ticketMatches.length === 0) return;

    haptics.medium();
    setSavingScans(true);
    try {
      // Upload image to storage
      const timestamp = Date.now();
      const imageBlob = await fetch(capturedImage).then(r => r.blob());
      const filename = `scan_${user.id}_${timestamp}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('game-images')
        .upload(filename, imageBlob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('game-images')
        .getPublicUrl(filename);

      // Save scan data
      const { error: insertError } = await supabase
        .from('scanned_images')
        .insert({
          user_id: user.id,
          image_url: publicUrlData.publicUrl,
          state: selectedState,
          scan_name: `Scan ${new Date().toLocaleDateString()}`,
          ticket_matches: ticketMatches.map(m => ({
            game_id: m.game.id,
            confidence: m.confidence,
            position: m.position,
          })),
        });

      if (insertError) throw insertError;

      toast.success('Scan saved to My Favorites!');
    } catch (error: any) {
      console.error('Error saving scan:', error);
      toast.error('Failed to save scan');
    } finally {
      setSavingScans(false);
    }
  };

  // Ensure demo video is muted
  useEffect(() => {
    if (demoVideoRef.current) {
      demoVideoRef.current.volume = 0;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Show limited UI for non-logged in users
  if (!user) {
    return (
      <Layout>
        {/* Background Image Container */}
        <div 
          className="min-h-screen relative"
          style={{
            backgroundImage: 'url(https://cdn-ai.onspace.ai/onspace/files/UpzBfP2E3qfRT3drQovGgt/2.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed',
          }}
        >
          {/* Opacity Overlay */}
          <div className="absolute inset-0 bg-white/70" />
          
          {/* Content */}
          <div className="relative max-w-screen-xl mx-auto px-3 py-6">
            {/* Alternative background image: https://cdn-ai.onspace.ai/onspace/files/ZAXNmf9T6fgT7srne7MXE4/1.jpg */}
          <div className="mb-3 text-center">
            <div className="flex justify-center mb-2">
              <img
                src="https://cdn-ai.onspace.ai/onspace/files/nCrVMtAwQ4sMLztPZTX5Yy/scanalyzerTM.png"
                alt="Scanalyzer"
                className="h-20 sm:h-20 object-contain"
              />
            </div>
            <p className="text-sm sm:text-base text-gray-600 px-2">
              Take a photo of a scratchoff ticket-board or lottery machine to get our AI recommendations. Click the View Sample Scan button to see an example of how it works.
            </p>
          </div>

          <div className="bg-transparent rounded-lg p-2">
            <div className="text-center mb-2 flex justify-center">
              <div className="w-full max-w-md aspect-video">
                <video
                  ref={demoVideoRef}
                  src="https://scratchpal.com/scratchwin.mp4"
                  className="w-full h-full object-cover rounded-2xl"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              </div>
            </div>

            {/* Sign In Required Block */}
            <div className="max-w-md mx-auto">
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 mb-3 text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Sign In Required</h2>
                <p className="text-gray-600 mb-4">
                  Please sign in to use the Scanalyzer
                </p>
                <button
                  onClick={() => navigate('/profile')}
                  className="gradient-teal text-white px-6 py-2 rounded-lg font-semibold"
                >
                  Sign In
                </button>
              </div>
            </div>

            {/* View Sample Scan Button */}
            {sampleScan && (
              <div className="flex flex-col gap-3 max-w-md mx-auto">
                <button
                  onClick={() => {
                    haptics.light();
                    setShowSampleScan(true);
                  }}
                  className="border-2 border-gray-300 text-gray-700 px-6 py-3 sm:px-8 sm:py-4 rounded-lg font-semibold flex items-center justify-center gap-2 sm:gap-3 hover:bg-gray-50 transition-colors text-sm sm:text-base"
                >
                  <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                  View Sample Scan
                </button>
              </div>
            )}
          </div>
        </div>
          </div>
        {/* Sample Scan Modal */}
        {showSampleScan && sampleScan && (
          <SavedScanCard 
            key={showSampleScan ? 'open' : 'closed'}
            scan={sampleScan}
            autoOpen={true}
            onClose={() => setShowSampleScan(false)}
          />
        )}
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Background Image Container */}
      <div 
        className="min-h-screen relative"
        style={{
          backgroundImage: 'url(https://cdn-ai.onspace.ai/onspace/files/ZAXNmf9T6fgT7srne7MXE4/1.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
        }}
      >
        {/* Opacity Overlay */}
        <div className="absolute inset-0 bg-white/70" />
        
        {/* Content */}
        <div className="relative max-w-screen-xl mx-auto px-3 py-6">
        {/* Alternative background image: https://cdn-ai.onspace.ai/onspace/files/ZAXNmf9T6fgT7srne7MXE4/1.jpg */}
        <div className="mb-3 text-center">
          <div className="flex justify-center mb-2">
            <img
              src="https://cdn-ai.onspace.ai/onspace/files/nCrVMtAwQ4sMLztPZTX5Yy/scanalyzerTM.png"
              alt="Scanalyzer"
              className="h-20 sm:h-20 object-contain"
            />
          </div>
          <p className="text-sm sm:text-base text-gray-600 px-2">
            Take a photo of a scratchoff ticket-board or lottery machine to get our AI recommendations. Click the View Sample Scan button to see an example of how it works.
          </p>
        </div>

        {/* Camera View */}
        {showCamera && (
          <div className="fixed inset-0 bg-black z-50 flex flex-col">
            <div className="flex-1 relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              
              {/* Camera Controls */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={() => {
                      haptics.light();
                      stopCamera();
                    }}
                    className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"
                  >
                    <X className="w-6 h-6 text-white" />
                  </button>
                  
                  <button
                    onClick={capturePhoto}
                    className="w-20 h-20 rounded-full bg-white flex items-center justify-center ring-4 ring-white/30"
                  >
                    <Camera className="w-8 h-8 text-gray-800" />
                  </button>
                  
                  <div className="w-14 h-14" />
                </div>
              </div>
            </div>
            
            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {/* No Image State */}
        {!capturedImage && !showCamera && (
          <div className="bg-transparent rounded-lg p-2">
            <div className="text-center mb-2 flex justify-center">
              <div className="w-full max-w-md aspect-video">
                <video
                  ref={demoVideoRef}
                  src="https://scratchpal.com/scratchwin.mp4"
                  className="w-full h-full object-cover rounded-2xl"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 max-w-md mx-auto">
              <button
                onClick={() => {
                  haptics.medium();
                  startCamera(); // Changed fileInputRef.current?.click() to startCamera()
                }}
                className="gradient-teal text-white px-6 py-3 sm:px-8 sm:py-4 rounded-lg font-semibold flex items-center justify-center gap-2 sm:gap-3 hover:opacity-90 transition-opacity text-sm sm:text-base"
              >
                <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                Open Camera
              </button>

              <button
                onClick={() => {
                  haptics.light();
                  // Trigger upload from gallery
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = handlePhotoCapture;
                  input.click();
                }}
                className="border-2 border-teal text-teal px-6 py-3 sm:px-8 sm:py-4 rounded-lg font-semibold flex items-center justify-center gap-2 sm:gap-3 hover:bg-teal/5 transition-colors text-sm sm:text-base"
              >
                <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                Upload Photo
              </button>

              {sampleScan && (
                <button
                  onClick={() => {
                    haptics.light();
                    setShowSampleScan(true);
                  }}
                  className="border-2 border-gray-300 text-gray-700 px-6 py-3 sm:px-8 sm:py-4 rounded-lg font-semibold flex items-center justify-center gap-2 sm:gap-3 hover:bg-gray-50 transition-colors text-sm sm:text-base"
                >
                  <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                  View Sample Scan
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="hidden"
              />
            </div>

            {/* Disclaimer Widget */}
            <div className="mt-6 bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 text-center max-w-md mx-auto">
              <p className="text-sm text-gray-700 leading-relaxed mb-2">
                To help cover costs and keep this tool free for everyone, we reluctantly limit AI scans to 5 per person per week. Thanks for playing! If you'd like to support us, visit our{' '}
                <button
                  onClick={() => navigate('/donate')}
                  className="text-teal font-semibold hover:underline"
                >
                  Donate page
                </button>
              </p>
              <div className="mt-3 pt-3 border-t border-yellow-300">
                <p className="text-xs text-gray-600">
                  Scans remaining this week: <span className="font-bold text-teal">{5 - scanUsage.length}</span> / 5
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Resets every Monday at 12:00 AM
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Captured Image View */}
        {capturedImage && !showCamera && (
          <div className="bg-white/90 backdrop-blur-sm rounded-lg overflow-hidden">
            {/* Action Buttons - Above Image */}
            {!analyzing && (
              <div className="p-6 border-b bg-gray-50">
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      haptics.light();
                      setCapturedImage(null);
                      setTicketMatches([]);
                    }}
                    className="flex-1 px-6 py-3 rounded-lg font-semibold border-2 border-gray-300 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-5 h-5" />
                    New Scan
                  </button>
                </div>
              </div>
            )}

            {/* Color Legend - Top */}
            {!analyzing && ticketMatches.length > 0 && (
              <div className="p-6 bg-gray-50 border-b">
                <h3 className="font-bold mb-3 text-sm">Color Legend</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-700" />
                    <span>Best 85-100</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span>Fair 30-44</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                    <span>Good 60-84</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span>Poor 15-29</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <span>OK 45-59</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-400" />
                    <span>Just Don't 0-14</span>
                  </div>
                </div>
              </div>
            )}

            {/* Price Filter Buttons - Above Image */}
            {!analyzing && ticketMatches.length > 0 && (
              <div className="p-6 bg-gray-50 border-b">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm">Filter by Price</h3>
                  <div className="text-xs text-gray-600">
                    Showing {filteredMatches.length} of {ticketMatches.length} tickets
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(priceRanges).map(([key, { label }]) => (
                    <button
                      key={key}
                      onClick={() => {
                        haptics.light();
                        setSelectedPriceRange(key);
                      }}
                      className={`px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedPriceRange === key
                          ? 'gradient-games text-white'
                          : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Image Container with Overlay */}
            <div className="relative">
              <img
                src={capturedImage}
                alt="Captured lottery machine"
                className="w-full h-auto"
              />

              {/* Analyzing Overlay */}
              {analyzing && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin w-16 h-16 mx-auto mb-4 border-4 border-white border-t-transparent rounded-full" />
                    <div className="text-white text-xl font-bold">Analyzing Tickets...</div>
                    <div className="text-white/80 text-sm mt-2">Using AI vision to identify games</div>
                  </div>
                </div>
              )}

              {/* Ticket Match Dots */}
              {!analyzing && filteredMatches.length > 0 && (
                <>
                  {filteredMatches.map((match, index) => {
                    return (
                      <div
                        key={index}
                        className={`absolute w-11 h-11 md:w-[76px] md:h-[76px] rounded-full ${getDotColor(match.game.rank)} opacity-80 flex flex-col items-center justify-center font-bold shadow-lg cursor-pointer hover:scale-110 transition-transform`}
                        style={{
                          left: `${match.position.x}%`,
                          top: `${match.position.y}%`,
                          transform: 'translate(-50%, -50%)',
                          border: '3px solid white',
                        }}
                        onClick={() => navigate(`/games/${match.game.id}`)}
                        title={`${match.game.game_name} - Click to view details`}
                      >
                        {/* Mobile: Just rank in white */}
                        <div className="md:hidden text-white text-lg font-extrabold">
                          {match.game.rank}
                        </div>
                        
                        {/* Desktop: Grey circle with rank + prize ratio */}
                        <div className="hidden md:flex md:flex-col md:items-center">
                          <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-white text-lg font-extrabold mb-1">
                            {match.game.rank}
                          </div>
                          <div className="text-white text-xs font-bold">
                            {match.game.top_prizes_remaining}/{match.game.total_top_prizes}🎁
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Scan Limit Warning */}
            {scanLimitReached && (
              <div className="px-6 pt-6 pb-0">
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800 text-center font-semibold">
                    ⏱️ You've used all 5 scans for this week. Scans reset on{' '}
                    <span className="font-bold">{nextScanAvailable?.toLocaleDateString()} at 12:00 AM</span>
                  </p>
                </div>
              </div>
            )}

            {/* Results Summary */}
            <div className="p-6 border-t bg-gray-50">
              {filteredMatches.length > 0 && (
                <div className="p-4 bg-white rounded-lg border">
                  <h3 className="font-bold mb-3">Detected Tickets ({filteredMatches.length})</h3>
                  <div className="space-y-2">
                    {[...filteredMatches].sort((a, b) => b.game.rank - a.game.rank).map((match, index) => {
                      const ratio = match.game.total_top_prizes > 0
                        ? (match.game.top_prizes_remaining / match.game.total_top_prizes * 100).toFixed(0)
                        : 0;
                      
                      return (
                        <div
                          key={index}
                          className="flex rounded-lg overflow-hidden hover:shadow-md cursor-pointer transition-all"
                          onClick={() => {
                            haptics.light();
                            navigate(`/games/${match.game.id}`);
                          }}
                        >
                          {/* Color Bar */}
                          <div className={`w-[6px] ${getDotColor(match.game.rank)}`} />
                          
                          {/* Content */}
                          <div className="flex-1 flex items-center justify-between p-3 bg-gray-50">
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="font-semibold text-sm">{match.game.game_name}</div>
                                <div className="text-xs text-gray-600">
                                  #{match.game.game_number} • ${match.game.price}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-sm">Rank #{match.game.rank}</div>
                              <div className="text-xs text-gray-600">
                                {match.game.top_prizes_remaining}/{match.game.total_top_prizes} 🏆 ({ratio}%)
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Sample Scan Modal */}
      {showSampleScan && sampleScan && (
        <SavedScanCard 
          key={showSampleScan ? 'open' : 'closed'}
          scan={sampleScan}
          autoOpen={true}
          onClose={() => setShowSampleScan(false)}
        />
      )}
    </Layout>
  );
}
