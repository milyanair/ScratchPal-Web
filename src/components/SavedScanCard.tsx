import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Game } from '@/types';
import { X, Trash2 } from 'lucide-react';
import { haptics } from '@/lib/haptics';
import { toast } from 'sonner';

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
  onDelete?: () => void;
  showAdminActions?: boolean;
  onClose?: () => void;
}

export function SavedScanCard({ scan, autoOpen = false, onDelete, showAdminActions = false, onClose }: SavedScanCardProps) {
  const navigate = useNavigate();
  const [showOverlay, setShowOverlay] = useState(autoOpen);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Auto-open if autoOpen prop is true
  useEffect(() => {
    if (autoOpen) {
      setShowOverlay(true);
    }
  }, [autoOpen]);

  // Fetch game data for matched tickets
  const { data: games = [] } = useQuery({
    queryKey: ['scanGames', scan.id],
    queryFn: async () => {
      const gameIds = scan.ticket_matches.map(m => m.game_id);
      console.log('Fetching games for scan:', scan.id, 'Game IDs:', gameIds);
      
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .in('id', gameIds);
      
      if (error) {
        console.error('Error fetching games:', error);
        throw error;
      }
      
      console.log('Fetched games:', data?.length || 0, 'games');
      console.log('Ticket matches:', scan.ticket_matches.length, 'matches');
      return data as Game[];
    },
  });

  // Debug: Log when dots should be rendered
  useEffect(() => {
    if (showOverlay && scan.ticket_matches.length > 0) {
      console.log('=== SavedScanCard Overlay Debug ===');
      console.log('Scan ID:', scan.id);
      console.log('Ticket matches count:', scan.ticket_matches.length);
      console.log('Games loaded count:', games.length);
      console.log('Matches:', scan.ticket_matches);
      
      // Check if positions are valid
      scan.ticket_matches.forEach((match, idx) => {
        const game = games.find(g => g.id === match.game_id);
        console.log(`Match ${idx}:`, {
          game_id: match.game_id,
          game_found: !!game,
          game_name: game?.game_name,
          position: match.position,
          confidence: match.confidence,
        });
      });
    }
  }, [showOverlay, scan.ticket_matches, games]);

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
    try {
      const { error } = await supabase
        .from('scanned_images')
        .delete()
        .eq('id', scan.id);

      if (error) throw error;

      toast.success('Scan deleted');
      setShowDeleteConfirm(false);
      setShowOverlay(false);
      if (onDelete) onDelete();
    } catch (error: any) {
      console.error('Error deleting scan:', error);
      toast.error('Failed to delete scan');
    }
  };

  return (
    <>
      {/* Card Preview */}
      <div
        onClick={() => setShowOverlay(true)}
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
              {new Date(scan.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} • {scan.state}
            </p>
            {!scan.is_sample && !showAdminActions && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
                className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                title="Delete scan"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            )}
            {showAdminActions && (
              <div className="flex items-center gap-1">
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (confirm(`Mark this scan as ${scan.is_sample ? 'private' : 'sample'}?`)) {
                      try {
                        const { error } = await supabase
                          .from('scanned_images')
                          .update({ is_sample: !scan.is_sample })
                          .eq('id', scan.id);
                        
                        if (error) throw error;
                        toast.success(`Scan marked as ${!scan.is_sample ? 'sample' : 'private'}`);
                        if (onDelete) onDelete(); // Refresh the list
                      } catch (error: any) {
                        console.error('Update error:', error);
                        toast.error('Failed to update scan');
                      }
                    }
                  }}
                  className="p-1.5 hover:bg-purple-100 rounded-lg transition-colors"
                  title={scan.is_sample ? 'Mark as private' : 'Mark as sample'}
                >
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                  title="Delete scan"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full Screen Overlay */}
      {showOverlay && (
        <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto">
          <div className="min-h-screen flex items-start justify-center p-4 pt-8">
          <div className="relative max-w-6xl w-full">
            {/* Header with proper spacing (20px buffer) */}
            <div className="mb-4 flex items-start justify-between">
              {/* Scan Info */}
              <div className="text-white">
                <h2 className="text-xl font-bold">{scan.scan_name}</h2>
                <p className="text-sm opacity-80">
                  {new Date(scan.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} • {scan.state}
                </p>
              </div>

              {/* Close Button with white circle outline */}
              <button
                onClick={() => {
                  setShowOverlay(false);
                  if (onClose) onClose();
                }}
                className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Legend - Top */}
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

            {/* Image with Overlay */}
            <div className="relative bg-white rounded-lg overflow-hidden">
              <img
                src={scan.image_url}
                alt={scan.scan_name}
                className="w-full h-auto"
              />

              {/* Interactive Ticket Dots */}
              {scan.ticket_matches.map((match, index) => {
                const game = games.find(g => g.id === match.game_id);
                if (!game) return null;

                return (
                  <div
                    key={index}
                    className={`absolute w-11 h-11 md:w-[76px] md:h-[76px] rounded-full ${getDotColor(game.rank)} opacity-80 flex flex-col items-center justify-center font-bold shadow-lg cursor-pointer hover:scale-110 transition-transform`}
                    style={{
                      left: `${match.position.x}%`,
                      top: `${match.position.y}%`,
                      transform: 'translate(-50%, -50%)',
                      border: '3px solid white',
                    }}
                    onClick={() => {
                      haptics.medium();
                      setShowOverlay(false);
                      navigate(`/games/${game.id}`, { 
                        state: { 
                          returnToScan: scan.id,
                          isSampleScan: scan.is_sample || false
                        } 
                      });
                    }}
                    title={`${game.game_name} - Click to view details`}
                  >
                    {/* Mobile: Just rank in white */}
                    <div className="md:hidden text-white text-lg font-extrabold">
                      {game.rank}
                    </div>
                    
                    {/* Desktop: Grey circle with rank + prize ratio */}
                    <div className="hidden md:flex md:flex-col md:items-center">
                      <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-white text-lg font-extrabold mb-1">
                        {game.rank}
                      </div>
                      <div className="text-white text-xs font-bold">
                        {game.top_prizes_remaining}/{game.total_top_prizes}🎁
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detected Tickets List - Sorted by Rank */}
            <div className="mt-6 bg-white rounded-lg p-4 mb-8">
              <h3 className="font-bold mb-3">Detected Tickets ({scan.ticket_matches.length})</h3>
              <div className="space-y-2">
                {games
                  .sort((a, b) => b.rank - a.rank)
                  .map((game) => {
                    const ratio = game.total_top_prizes > 0
                      ? (game.top_prizes_remaining / game.total_top_prizes * 100).toFixed(0)
                      : 0;
                    
                    return (
                      <div
                        key={game.id}
                        className="flex rounded-lg overflow-hidden hover:shadow-md cursor-pointer transition-all"
                        onClick={() => {
                          haptics.light();
                          setShowOverlay(false);
                          navigate(`/games/${game.id}`, { 
                            state: { 
                              returnToScan: scan.id,
                              isSampleScan: scan.is_sample || false
                            } 
                          });
                        }}
                      >
                        {/* Color Bar */}
                        <div className={`w-[6px] ${getDotColor(game.rank)}`} />
                        
                        {/* Content */}
                        <div className="flex-1 flex items-center justify-between p-3 bg-gray-50">
                          <div className="flex items-center gap-3">
                            <div>
                              <div className="font-semibold text-sm">{game.game_name}</div>
                              <div className="text-xs text-gray-600">
                                #{game.game_number} • ${game.price}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-sm">Rank #{game.rank}</div>
                            <div className="text-xs text-gray-600">
                              {game.top_prizes_remaining}/{game.total_top_prizes} 🏆 ({ratio}%)
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg max-w-sm w-full p-6">
            <h3 className="text-lg font-bold mb-2">Delete Scan?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{scan.scan_name}"? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border rounded-lg font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
