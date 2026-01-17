import { Game } from '@/types';
import { Award, Heart, Trophy, Megaphone, Gift } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';

interface GameCardProps {
  game: Game;
  isFavorited?: boolean;
  onFavoriteChange?: () => void;
}

export function GameCard({ game, isFavorited = false, onFavoriteChange }: GameCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [favorited, setFavorited] = useState(isFavorited);

  const prizesRemaining = game.top_prizes_remaining;
  const totalPrizes = game.total_top_prizes;
  const percentage = totalPrizes > 0 ? (prizesRemaining / totalPrizes) * 100 : 0;

  // Format numbers with K suffix for values > 1000
  const formatNumber = (num: number) => {
    if (num > 1000) {
      return `${Math.floor(num / 1000)}K`;
    }
    return num.toString();
  };

  // Determine banner color based on percentage
  const getBannerColor = () => {
    if (percentage >= 75) return 'from-green-700 to-green-800'; // Dark green
    if (percentage >= 50) return 'from-green-400 to-green-500'; // Light green
    if (percentage >= 25) return 'from-orange-500 to-orange-600'; // Orange
    return 'from-red-700 to-red-800'; // Maroon red
  };

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.doubleTap(); // Haptic feedback for favorite
    
    if (!user) {
      toast.error('Please sign in to favorite games', {
        action: {
          label: 'Sign In',
          onClick: () => navigate('/profile'),
        },
      });
      return;
    }

    try {
      if (favorited) {
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('favorite_type', 'game')
          .eq('reference_id', game.id);
        setFavorited(false);
        toast.success('Removed from favorites');
      } else {
        await supabase
          .from('favorites')
          .insert({
            user_id: user.id,
            favorite_type: 'game',
            reference_id: game.id,
          });
        setFavorited(true);
        toast.success('Added to favorites');
      }
      onFavoriteChange?.();
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
    }
  };

  const handleReportWin = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.light(); // Haptic feedback
    navigate(`/report-wins?gameId=${game.id}`);
  };

  const handleTalkAbout = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.light(); // Haptic feedback
    
    // Use SEO-friendly URL if slug exists, otherwise fallback to ID
    if (game.slug) {
      navigate(`/games/${game.state.toLowerCase()}/${game.price}/${game.slug}#convos`);
    } else {
      navigate(`/games/${game.id}#convos`);
    }
  };

  const handleRankClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.light(); // Haptic feedback
    
    // Detect mobile devices
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
    
    if (isMobile) {
      // On mobile, navigate within the app
      navigate('/topic/fb39a7fc-568b-4af6-9168-96328976b4be');
    } else {
      // On desktop, open in popup window
      window.open('https://play.scratchpal.com/topic/fb39a7fc-568b-4af6-9168-96328976b4be', '_blank', 'width=800,height=600,scrollbars=yes');
    }
  };

  return (
    <div className="relative bg-gray-300/60 rounded-xl p-1.5">
      <div
        onClick={() => {
          haptics.light(); // Haptic feedback on card tap
          // Use SEO-friendly URL if slug exists, otherwise fallback to ID
          if (game.slug) {
            navigate(`/games/${game.state.toLowerCase()}/${game.price}/${game.slug}`);
          } else {
            navigate(`/games/${game.id}`);
          }
        }}
        className="relative rounded-t-lg overflow-hidden cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-300 aspect-[3/4] bg-gray-200"
        style={{
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), -2px 6px 8px rgba(0, 0, 0, 0.15), 2px 6px 8px rgba(0, 0, 0, 0.15)'
        }}
      >
      {/* Background Image with Caching */}
      <img
        src={game.image_url || 'https://images.unsplash.com/photo-1633265486064-086b219458ec?w=400&h=600&fit=crop&q=80'}
        alt={game.game_name}
        className="absolute inset-0 w-full h-full object-cover object-top"
        loading="lazy"
        decoding="async"
        style={{
          imageRendering: 'auto',
        }}
      />

      {/* Diagonal Ribbon - Top Right */}
      <div
        className={`absolute top-6 -right-8 w-40 bg-gradient-to-r ${getBannerColor()} text-white text-center py-1 rotate-[40deg] flex items-center justify-center`}
        style={{
          boxShadow: 'rgba(0, 0, 0, 0.3) 0px 4px 6px, rgba(0, 0, 0, 0.2) 0px 2px 4px'
        }}
      >
        <p className="font-bold" style={{ fontSize: '0.9rem' }}>
          {prizesRemaining}/{formatNumber(totalPrizes)}🎁left
        </p>
      </div>

      {/* Badges - Right Side with white semi-transparent background pad */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/30 backdrop-blur-sm rounded-xl p-2 flex flex-col gap-0.5 shadow-lg">
        {/* Rank and Favorite Badges - Same Row */}
        <div className="flex gap-1">
          <button
            onClick={handleRankClick}
            className="bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 backdrop-blur rounded-md px-2 py-1 flex items-center justify-center gap-1 shadow-md cursor-pointer hover:from-yellow-500 hover:via-yellow-600 hover:to-yellow-700 transition-all"
          >
            <span className="text-sm">🏅</span>
            <span className="text-white text-xs font-semibold">{game.rank}</span>
          </button>
          <button
            onClick={toggleFavorite}
            className="bg-white/20 backdrop-blur rounded-md px-2 py-1 flex items-center justify-center"
          >
            <Heart className={`w-4 h-4 ${favorited ? 'fill-red-500 text-red-500' : 'text-red-500'}`} />
          </button>
        </div>

        {/* Top Prize Badge */}
        <div className="bg-green-500/90 backdrop-blur rounded-md px-2 py-1 text-white text-xs font-semibold flex items-center justify-center gap-1">
          Top🎁${formatNumber(game.top_prize)}
        </div>

        {/* Share a Win Badge */}
        <button
          onClick={handleReportWin}
          className="gradient-wins backdrop-blur rounded-md px-2 py-1 text-white flex items-center justify-center"
          style={{ opacity: 0.9 }}
        >
          <span className="text-xs font-semibold">Share a Win🏆</span>
        </button>

        {/* Talk About It Badge */}
        <button
          onClick={handleTalkAbout}
          className="gradient-hot backdrop-blur rounded-md px-2 py-1 text-white flex items-center justify-center"
          style={{ opacity: 0.9 }}
        >
          <span className="text-xs font-semibold">Talk About It📢</span>
        </button>
      </div>

        {/* Game Info - Bottom */}
        <div className="absolute bottom-0 left-0 right-0">
          <div className="bg-gray-800/40 backdrop-blur p-2 w-full">
            <h3 className="text-white font-bold text-sm truncate">${game.price}•{game.game_name}</h3>
          </div>
        </div>
      </div>
    </div>
  );
}
