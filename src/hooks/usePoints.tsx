import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { UserPoints, PointsHistory, LeaderboardEntry, PendingFanfare } from '@/types';
import { useState, useCallback } from 'react';

interface AwardPointsResult {
  success: boolean;
  points_earned: number;
  instant_fanfare: boolean;
  display_name: string;
  error?: string;
}

export function usePoints() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showConfetti, setShowConfetti] = useState(false);
  const [pointsBadge, setPointsBadge] = useState<{ points: number; displayName: string } | null>(null);

  // Get user's total points
  const { data: userPoints } = useQuery({
    queryKey: ['userPoints', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as UserPoints | null;
    },
    enabled: !!user,
  });

  // Get points history
  const { data: pointsHistory = [] } = useQuery({
    queryKey: ['pointsHistory', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('points_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as PointsHistory[];
    },
    enabled: !!user,
  });

  // Get leaderboard
  const { data: leaderboard = [] } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard', { p_limit: 100 });
      if (error) throw error;
      return data as LeaderboardEntry[];
    },
  });

  // Get pending fanfare
  const { data: pendingFanfare = [] } = useQuery({
    queryKey: ['pendingFanfare', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc('get_pending_fanfare', { p_user_id: user.id });
      if (error) throw error;
      return data as PendingFanfare[];
    },
    enabled: !!user,
    refetchOnMount: true,
  });

  // Award points mutation
  const awardPointsMutation = useMutation({
    mutationFn: async ({ activityName, description }: { activityName: string; description?: string }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase.rpc('award_points', {
        p_user_id: user.id,
        p_activity_name: activityName,
        p_description: description || null,
      });

      if (error) throw error;
      return data as AwardPointsResult;
    },
    onSuccess: (result) => {
      if (result.success) {
        // Refetch points data
        queryClient.invalidateQueries({ queryKey: ['userPoints', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['pointsHistory', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['leaderboard'] });

        // Show visual feedback
        if (result.instant_fanfare) {
          setShowConfetti(true);
          setPointsBadge({ points: result.points_earned, displayName: result.display_name });
        } else {
          setPointsBadge({ points: result.points_earned, displayName: result.display_name });
        }
      }
    },
  });

  const awardPoints = useCallback(
    (activityName: string, description?: string) => {
      return awardPointsMutation.mutateAsync({ activityName, description });
    },
    [awardPointsMutation]
  );

  const clearConfetti = useCallback(() => {
    setShowConfetti(false);
  }, []);

  const clearBadge = useCallback(() => {
    setPointsBadge(null);
  }, []);

  return {
    userPoints,
    pointsHistory,
    leaderboard,
    pendingFanfare,
    awardPoints,
    showConfetti,
    clearConfetti,
    pointsBadge,
    clearBadge,
    totalPoints: userPoints?.total_points || 0,
  };
}
