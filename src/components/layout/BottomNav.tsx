import { Link, useLocation } from 'react-router-dom';
import { Zap, Megaphone, Heart, Trophy } from 'lucide-react';
import { useState } from 'react';
import { haptics } from '@/lib/haptics';

const navItems = [
  { path: '/', label: 'Games', icon: Zap, gradient: 'gradient-games' },
  { path: '/hot-topics', label: 'Hot', icon: Megaphone, gradient: 'gradient-hot' },
  { path: '/favorites', label: 'Favs', icon: Heart, gradient: 'gradient-favs' },
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
    <nav className="fixed bottom-0 left-0 right-0 h-[60px] bg-white/80 backdrop-blur-md z-40 overflow-visible" style={{ boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)', clipPath: 'ellipse(100% 100% at 50% 100%)' }}>
      <div className="max-w-screen-xl mx-auto flex justify-center items-center gap-8 px-4 h-full">
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
                  className={`w-[52px] h-[52px] rounded-full flex items-center justify-center text-white transition-all duration-300 ${
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
