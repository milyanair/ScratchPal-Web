import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { haptics } from '@/lib/haptics';

interface BuyTicketPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
  gameName: string;
}

const RANDOM_MESSAGES = [
  'Did you 🛒 any 🎫s?',
  'Oracle says you 🛒 a 🎫.',
  '🛒 a 🎫?',
  'Bought a ticket?',
  'Ticket🧚says you 🛒 🎫s.',
];

export function BuyTicketPopup({ isOpen, onClose, onConfirm, gameName }: BuyTicketPopupProps) {
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [customQuantity, setCustomQuantity] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  // Select random message on mount
  useEffect(() => {
    if (isOpen) {
      const randomMessage = RANDOM_MESSAGES[Math.floor(Math.random() * RANDOM_MESSAGES.length)];
      setMessage(randomMessage);
      setSelectedQuantity(1);
      setCustomQuantity('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
      onConfirm(quantity);
    }
  };

  const handleCancel = () => {
    haptics.light();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      {/* Popup Card */}
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full animate-scale-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white p-6 rounded-t-2xl relative">
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-center pr-8">{message}</h2>
          <p className="text-sm text-center mt-2 opacity-90 truncate">{gameName}</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Quick Select Buttons */}
          <div>
            <p className="text-sm text-gray-600 mb-3 text-center">🎫s</p>
            <div className="grid grid-cols-4 gap-3 mb-3">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  onClick={() => handleQuickSelect(num)}
                  className={`py-3 rounded-lg font-bold text-lg transition-all ${
                    selectedQuantity === num && !customQuantity
                      ? 'bg-teal-500 text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={customQuantity}
                onChange={(e) => handleCustomChange(e.target.value)}
                placeholder="Other amount..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-center font-semibold text-lg focus:border-teal-500 focus:outline-none"
                maxLength={3}
              />
              {customQuantity && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-500 font-bold">
                  ✓
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              No
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedQuantity === 0 || (!customQuantity && selectedQuantity < 1)}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg font-semibold hover:from-teal-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            >
              Yes
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
    </div>
  );
}
