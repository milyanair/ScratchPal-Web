import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { haptics } from '@/lib/haptics';

interface WinLossPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onWin: (winAmount: number) => void;
  onLoss: () => void;
  purchase: any;
}

export function WinLossPopup({ isOpen, onClose, onWin, onLoss, purchase }: WinLossPopupProps) {
  const [winAmount, setWinAmount] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setWinAmount('');
    }
  }, [isOpen]);

  const handleWinConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    haptics.medium();
    const amount = parseFloat(winAmount);
    if (amount > 0) {
      onWin(amount);
    }
  };

  const handleLossConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    haptics.medium();
    onLoss();
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    haptics.light();
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Popup Card */}
      <div 
        className="bg-white/20 backdrop-blur-xl rounded-2xl shadow-2xl max-w-sm w-full animate-scale-up border border-white/30"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500/90 to-purple-600/90 backdrop-blur-md text-white p-6 rounded-t-2xl relative border-b border-white/20">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCancel(e);
            }}
            className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-center pr-8">Winning Ticket?</h2>
          
          {/* Ticket Details */}
          <div className="mt-4 space-y-2 text-sm opacity-90">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Game:</span>
              <span className="truncate ml-2">#{purchase.games?.game_number} {purchase.games?.game_name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold">Ticket Price:</span>
              <span className="font-bold">${purchase.games?.price}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold">Date/Time:</span>
              <span>
                {new Date(purchase.created_at).toLocaleDateString()} {new Date(purchase.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 bg-white/10 backdrop-blur-lg rounded-b-2xl">
          {/* Question */}
          <p className="text-xl text-white font-bold text-center">Winning Ticket?</p>

          {/* Win Amount Input */}
          <div>
            <input
              type="number"
              inputMode="decimal"
              value={winAmount}
              onChange={(e) => setWinAmount(e.target.value)}
              placeholder="Win Amount"
              className="w-full px-4 py-3 bg-white/30 backdrop-blur-md border-2 border-white/30 rounded-lg text-center font-semibold text-lg text-gray-800 placeholder:text-gray-600 focus:border-purple-400 focus:bg-white/40 focus:outline-none transition-all"
              step="0.01"
              min="0"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleWinConfirm(e);
              }}
              disabled={!winAmount || parseFloat(winAmount) <= 0}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500/90 to-purple-600/90 backdrop-blur-md text-white rounded-lg font-semibold hover:from-purple-600/90 hover:to-purple-700/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg border border-white/20"
            >
              Yes
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleLossConfirm(e);
              }}
              className="flex-1 px-6 py-3 bg-white/30 backdrop-blur-md border-2 border-white/30 text-gray-800 rounded-lg font-semibold hover:bg-white/40 transition-all"
            >
              No
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCancel(e);
              }}
              className="px-6 py-3 bg-white/30 backdrop-blur-md border-2 border-white/30 text-gray-800 rounded-lg font-semibold hover:bg-white/40 transition-all"
            >
              X
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes scale-up {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        
        .animate-scale-up {
          animation: scale-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </div>,
    document.body
  );
}
