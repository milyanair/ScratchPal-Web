import { ReactNode } from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  enabled?: boolean;
}

export function PullToRefresh({ onRefresh, children, enabled = true }: PullToRefreshProps) {
  const { isPulling, pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh,
    enabled,
    threshold: 80,
    maxPullDistance: 120,
    resistance: 0.5,
  });

  const indicatorHeight = isRefreshing ? 60 : pullDistance;
  const rotation = isRefreshing ? 0 : (pullDistance / 120) * 360;
  const opacity = Math.min(pullDistance / 80, 1);

  return (
    <div className="relative min-h-0">
      {/* Pull-to-Refresh Indicator */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{
          height: `${indicatorHeight}px`,
          opacity: isPulling || isRefreshing ? opacity : 0,
        }}
      >
        <div className="bg-gradient-to-b from-teal/10 to-transparent w-full h-full absolute top-0" />
        
        <div className="relative flex flex-col items-center justify-center gap-1">
          <RefreshCw
            className={`w-6 h-6 text-teal transition-transform ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            style={{
              transform: isRefreshing ? 'rotate(0deg)' : `rotate(${rotation}deg)`,
            }}
          />
          <div className="text-xs font-medium text-teal">
            {isRefreshing
              ? 'Refreshing...'
              : pullDistance >= 80
              ? 'Release to refresh'
              : 'Pull down to refresh'}
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        className="transition-transform duration-200 will-change-transform"
        style={{
          transform: `translateY(${isPulling || isRefreshing ? Math.min(pullDistance, 60) : 0}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
