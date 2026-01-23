import { Link, useLocation } from 'react-router-dom';
import { Zap, Megaphone, ScanLine, Trophy } from 'lucide-react';
import { useState } from 'react';
import { haptics } from '@/lib/haptics';

const navItems = [
  { path: '/', label: 'Games', icon: Zap, gradient: 'gradient-games' },
  { path: '/hot-topics', label: 'Hot', icon: Megaphone, gradient: 'gradient-hot' },
  { path: '/scan-tickets', label: 'Scan', icon: ScanLine, gradient: 'gradient-favs' },
  { path: '/report-wins', label: 'Wins', icon: Trophy, gradient: 'gradient-wins' },
];

export function BottomNav() {
  const location = useLocation();
  const [activeAnim, setActiveAnim] = useState<string | null>(null);

  const handleClick = (path: string) => {
    haptics.medium(); // Vibrate on navigation tap
    setActiveAnim(path);
    setTimeout(() => setActiveAnim(null), 500);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[60px] z-50">
      {/* Smile Curve Background - Lower in center, higher on sides */}
      <div 
        className="absolute inset-0 bg-white/80 backdrop-blur-md border-t border-gray-200"
        style={{
          clipPath: 'polygon(0 30%, 10% 20%, 20% 15%, 30% 12%, 40% 10%, 50% 10%, 60% 10%, 70% 12%, 80% 15%, 90% 20%, 100% 30%, 100% 100%, 0 100%)',
          filter: 'drop-shadow(0 -4px 6px rgba(0, 0, 0, 0.1)) drop-shadow(0 -2px 4px rgba(0, 0, 0, 0.06))'
        }}
      />
      <div className="relative max-w-screen-xl mx-auto flex justify-center items-center gap-8 px-4 h-full z-10">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          const isAnimating = activeAnim === item.path;

          return (
            <div key={item.path} className="relative flex items-center gap-8">
              {index > 0 && (
                <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-px h-12 bg-gray-300" />
              )}
              <Link
                to={item.path}
                onClick={() => handleClick(item.path)}
                className="flex flex-col items-center justify-center gap-1"
              >
                <div
                  className={`w-[52px] h-[52px] rounded-full flex items-center justify-center text-white transition-all duration-300 relative z-20 ${
                    item.gradient
                  } ${
                    isActive || isAnimating
                      ? 'shadow-nav-circle-active -translate-y-5 scale-[1.077]'
                      : 'shadow-nav-circle hover:animate-bounce'
                  } ${isAnimating ? 'animate-bounce-grow' : ''} active:animate-bounce`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <span
                  className={`text-xs font-medium transition-opacity ${
                    isActive || isAnimating ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{ marginTop: '-20px' }}
                >
                  {item.label}
                </span>
              </Link>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
