import { useState, useEffect, useCallback, RefObject } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number; // Distance to pull before triggering refresh
  maxPullDistance?: number; // Maximum pull distance for visual effect
  resistance?: number; // Resistance factor (0-1, lower = more resistance)
  enabled?: boolean;
}

interface UsePullToRefreshReturn {
  isPulling: boolean;
  pullDistance: number;
  isRefreshing: boolean;
  containerRef: RefObject<HTMLDivElement>;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPullDistance = 120,
  resistance = 0.5,
  enabled = true,
}: UsePullToRefreshOptions) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || isRefreshing) return;
    
    const touch = e.touches[0];
    const scrollableElement = document.documentElement || document.body;
    const currentScrollTop = scrollableElement.scrollTop || window.pageYOffset;
    
    setTouchStartY(touch.clientY);
    setScrollTop(currentScrollTop);
  }, [enabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || isRefreshing || touchStartY === 0) return;
    
    const touch = e.touches[0];
    const scrollableElement = document.documentElement || document.body;
    const currentScrollTop = scrollableElement.scrollTop || window.pageYOffset;
    
    // Only allow pull-to-refresh when at the top of the page
    if (currentScrollTop > 5) {
      setIsPulling(false);
      setPullDistance(0);
      return;
    }
    
    const deltaY = touch.clientY - touchStartY;
    
    // Only trigger on pull down (positive delta) from top
    if (deltaY > 0 && scrollTop <= 5) {
      // Prevent default scroll behavior when pulling
      if (deltaY > 10) {
        e.preventDefault();
      }
      
      setIsPulling(true);
      
      // Apply resistance and cap at maxPullDistance
      const resistedDistance = Math.min(
        deltaY * resistance,
        maxPullDistance
      );
      
      setPullDistance(resistedDistance);
    } else {
      setIsPulling(false);
      setPullDistance(0);
    }
  }, [enabled, isRefreshing, touchStartY, scrollTop, threshold, maxPullDistance, resistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!enabled || isRefreshing) return;
    
    setTouchStartY(0);
    
    // Trigger refresh if pulled past threshold
    if (isPulling && pullDistance >= threshold) {
      setIsRefreshing(true);
      setIsPulling(false);
      
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        // Smooth reset animation
        setTimeout(() => {
          setPullDistance(0);
          setIsRefreshing(false);
        }, 300);
      }
    } else {
      // Reset without refresh
      setIsPulling(false);
      setPullDistance(0);
    }
  }, [enabled, isRefreshing, isPulling, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    if (!enabled) return;
    
    // Use passive: false to allow preventDefault
    const options: AddEventListenerOptions = { passive: false };
    
    document.addEventListener('touchstart', handleTouchStart, options);
    document.addEventListener('touchmove', handleTouchMove, options);
    document.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    isPulling,
    pullDistance,
    isRefreshing,
  };
}
