import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { Game } from '@/types';
import { useNavigate } from 'react-router-dom';
import { haptics } from '@/lib/haptics';

interface SavedScanCardProps {
  scan: {
    id: string;
    image_url: string;
    scan_name: string;
    state: string;
    ticket_matches: Array<{
      game_id: string;
      confidence: number;
      position: { x: number; y: number };
    }>;
    created_at: string;
    is_sample?: boolean;
  };
  autoOpen?: boolean;
  onClose?: () => void;
  onDelete?: () => void;
  showAdminActions?: boolean;
}

export function SavedScanCard({ scan, autoOpen = false, onClose, onDelete, showAdminActions = false }: SavedScanCardProps) {
  const [showModal, setShowModal] = useState(autoOpen);
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('all');
  const navigate = useNavigate();

  const handleClose = () => {
    setShowModal(false);
    setSelectedPriceRange('all'); // Reset filter on close
    onClose?.();
  };

  // Price range options
  const priceRanges: Record<string, { label: string; min: number; max: number }> = {
    all: { label: 'All', min: 0, max: 999 },
    '1-5': { label: '$1-$5', min: 1, max: 5 },
    '6-10': { label: '$6-$10', min: 6, max: 10 },
    '11-20': { label: '$11-$20', min: 11, max: 20 },
    '21-50': { label: '$21+', min: 21, max: 999 },
  };

  // Fetch game data for matched tickets
  const { data: games = [] } = useQuery({
    queryKey: ['scanGames', scan.id],
    queryFn: async () => {
      const gameIds = scan.ticket_matches.map(m => m.game_id);
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .in('id', gameIds);
      
      if (error) throw error;
      return data as Game[];
    },
  });

  // Create ticket matches with full game data
  const ticketMatches = scan.ticket_matches
    .map(match => {
      const game = games.find(g => g.id === match.game_id);
      if (!game) return null;
      return {
        game,
        confidence: match.confidence,
        position: match.position,
      };
    })
    .filter(Boolean) as Array<{
      game: Game;
      confidence: number;
      position: { x: number; y: number };
    }>;

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

  const handleDelete = async () => {
    if (!confirm('Delete this scan?')) return;
    
    try {
      const { error } = await supabase
        .from('scanned_images')
        .delete()
        .eq('id', scan.id);

      if (error) throw error;
      toast.success('Scan deleted');
      handleClose();
      onDelete?.();
    } catch (error: any) {
      console.error('Error deleting scan:', error);
      toast.error('Failed to delete scan');
    }
  };

  return (
    <>
      {/* Card Preview */}
      <div
        onClick={() => setShowModal(true)}
        className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
      >
        <div className="relative aspect-video">
          <img
            src={scan.image_url}
            alt={scan.scan_name}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-semibold">
            {scan.ticket_matches.length} tickets
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-bold mb-1">{scan.scan_name}</h3>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {new Date(scan.created_at).toLocaleDateString()} • {scan.state}
            </p>
            {!scan.is_sample && !showAdminActions && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                title="Delete scan"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Full Screen Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto">
          <div className="min-h-screen p-4">
            <div className="max-w-4xl mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-white">
                  <h2 className="text-xl font-bold">{scan.scan_name}</h2>
                  <p className="text-sm opacity-80">
                    {new Date(scan.created_at).toLocaleDateString()} • {scan.state}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Color Legend */}
              {ticketMatches.length > 0 && (
                <div className="mb-4 bg-white/10 backdrop-blur rounded-lg p-4">
                  <h3 className="font-bold mb-3 text-sm text-white">Color Legend</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-white text-xs">
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

              {/* Price Filter Buttons */}
              {ticketMatches.length > 0 && (
                <div className="mb-4 bg-white/10 backdrop-blur rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm text-white">Filter by Price</h3>
                    <div className="text-xs text-white/80">
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
                            : 'bg-white/20 hover:bg-white/30 text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Image Container with Overlay */}
              <div className="relative bg-black rounded-lg overflow-hidden">
                <img
                  src={scan.image_url}
                  alt="Scanned tickets"
                  className="w-full h-auto"
                />

                {/* Ticket Match Dots */}
                {filteredMatches.length > 0 && (
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
                          onClick={() => {
                            haptics.medium();
                            handleClose();
                            // Generate SEO-friendly URL
                            const slug = match.game.slug || `${match.game.game_number}-${match.game.game_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
                            navigate(`/games/${match.game.state.toLowerCase()}/${match.game.price}/${slug}`, {
                              state: { 
                                returnToScan: scan.id,
                                isSampleScan: scan.is_sample || false
                              }
                            });
                          }}
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

              {/* Results Summary */}
              <div className="mt-6 bg-white rounded-lg p-4 mb-8">
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
                              handleClose();
                              // Generate SEO-friendly URL
                              const slug = match.game.slug || `${match.game.game_number}-${match.game.game_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
                              navigate(`/games/${match.game.state.toLowerCase()}/${match.game.price}/${slug}`, {
                                state: { 
                                  returnToScan: scan.id,
                                  isSampleScan: scan.is_sample || false
                                }
                              });
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
          </div>
        </div>
      )}
    </>
  );
}
