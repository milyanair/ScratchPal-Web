import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';

interface PointsBadgeProps {
  points: number;
  displayName: string;
  onComplete?: () => void;
}

export function PointsBadge({ points, displayName, onComplete }: PointsBadgeProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onComplete?.();
      }, 300); // Wait for fade out
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
        <Trophy className="w-5 h-5" />
        <div>
          <div className="font-bold text-lg">+{points} Points</div>
          <div className="text-xs opacity-90">{displayName}</div>
        </div>
      </div>
    </div>
  );
}
