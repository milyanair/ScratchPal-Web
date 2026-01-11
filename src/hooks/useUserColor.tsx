import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useUserColor(userId: string | undefined) {
  return useQuery({
    queryKey: ['userColor', userId],
    queryFn: async () => {
      if (!userId) return '#14b8a6'; // Default teal
      const { data, error } = await supabase
        .from('user_profiles')
        .select('profile_color')
        .eq('id', userId)
        .single();
      
      if (error) return '#14b8a6'; // Default teal on error
      return data?.profile_color || '#14b8a6';
    },
    enabled: !!userId,
    staleTime: 60000, // Cache for 1 minute
  });
}

// Hook to get multiple user colors at once
export function useUserColors(userIds: string[]) {
  return useQuery({
    queryKey: ['userColors', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, profile_color')
        .in('id', userIds);
      
      if (error) return {};
      
      // Convert to map for easy lookup
      const colorMap: Record<string, string> = {};
      data?.forEach((profile) => {
        colorMap[profile.id] = profile.profile_color || '#14b8a6';
      });
      return colorMap;
    },
    enabled: userIds.length > 0,
    staleTime: 60000, // Cache for 1 minute
  });
}
