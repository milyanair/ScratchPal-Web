import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { haptics } from '@/lib/haptics';
import { Game } from '@/types';

interface BuyTicketPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (quantity: number, purchaseDate?: Date) => void;
  game: Game;
}

const RANDOM_MESSAGES = [
  'Did you 🛒 any 🎫s?',
  'Oracle says you 🛒 a 🎫.',
  '🛒 a 🎫?',
  'Bought a ticket?',
  'Ticket🧚says you 🛒 🎫s.',
];

export function BuyTicketPopup({ isOpen, onClose, onConfirm, game }: BuyTicketPopupProps) {
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [customQuantity, setCustomQuantity] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [purchaseDateTime, setPurchaseDateTime] = useState<string>('');

  // Select random message on mount
  useEffect(() => {
    if (isOpen) {
      const randomMessage = RANDOM_MESSAGES[Math.floor(Math.random() * RANDOM_MESSAGES.length)];
      setMessage(randomMessage);
      setSelectedQuantity(1);
      setCustomQuantity('');
      
      // Set current date/time in datetime-local format
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setPurchaseDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
    }
  }, [isOpen]);

  const handleQuickSelect = (quantity: number) => {
    haptics.light();
    setSelectedQuantity(quantity);
    setCustomQuantity(''); // Clear custom field
  };

  const handleCustomChange = (value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    setCustomQuantity(numericValue);
    if (numericValue) {
      setSelectedQuantity(parseInt(numericValue, 10));
    }
  };

  const handleConfirm = () => {
    haptics.medium();
    const quantity = customQuantity ? parseInt(customQuantity, 10) : selectedQuantity;
    if (quantity > 0) {
      const selectedDate = purchaseDateTime ? new Date(purchaseDateTime) : new Date();
      onConfirm(quantity, selectedDate);
    }
  };

  const handleCancel = () => {
    haptics.light();
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* Popup Card */}
      <div className="bg-white/20 backdrop-blur-xl rounded-2xl shadow-2xl max-w-sm w-full animate-scale-up border border-white/30">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-500/90 to-teal-600/90 backdrop-blur-md text-white p-6 rounded-t-2xl relative border-b border-white/20">
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-center pr-8">{message}</h2>
          <p className="text-sm text-center mt-2 opacity-90 truncate">
            {game.state}-${game.price}-{game.game_number}-{game.game_name}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 bg-white/10 backdrop-blur-lg rounded-b-2xl">
          {/* Quick Select Buttons */}
          <div>
            <p className="text-sm text-white font-medium mb-3 text-center">How many tickets did you buy?</p>
            <div className="grid grid-cols-4 gap-3 mb-3">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  onClick={() => handleQuickSelect(num)}
                  className={`py-3 rounded-lg font-bold text-lg transition-all backdrop-blur-md border ${
                    selectedQuantity === num && !customQuantity
                      ? 'bg-teal-500/90 text-white shadow-lg scale-105 border-teal-400/50'
                      : 'bg-white/30 text-gray-800 hover:bg-white/40 border-white/30'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* Custom Input and Date/Time Selector Row */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={customQuantity}
                  onChange={(e) => handleCustomChange(e.target.value)}
                  placeholder="Other amount..."
                  className="w-full px-4 py-3 bg-white/30 backdrop-blur-md border-2 border-white/30 rounded-lg text-center font-semibold text-lg text-gray-800 placeholder:text-gray-600 focus:border-teal-400 focus:bg-white/40 focus:outline-none transition-all"
                  maxLength={3}
                />
                {customQuantity && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-500 font-bold">
                    ✓
                  </div>
                )}
              </div>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={purchaseDateTime}
                  onChange={(e) => setPurchaseDateTime(e.target.value)}
                  className="w-36 px-3 py-3 bg-white/30 backdrop-blur-md border-2 border-white/30 rounded-lg font-semibold text-sm text-gray-800 focus:border-teal-400 focus:bg-white/40 focus:outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={selectedQuantity === 0 || (!customQuantity && selectedQuantity < 1)}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500/90 to-teal-600/90 backdrop-blur-md text-white rounded-lg font-semibold hover:from-teal-600/90 hover:to-teal-700/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg border border-white/20"
            >
              Yes
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 px-6 py-3 bg-white/30 backdrop-blur-md border-2 border-white/30 text-gray-800 rounded-lg font-semibold hover:bg-white/40 transition-all"
            >
              No
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
