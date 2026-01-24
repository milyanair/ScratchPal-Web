import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SliderMessage } from '@/types';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';

export function MessageSlider() {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: messages = [] } = useQuery({
    queryKey: ['sliderMessages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('slider_messages')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data as SliderMessage[];
    },
  });

  // Fetch user's selected state
  const { data: userPrefs } = useQuery({
    queryKey: ['userPreferences', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_preferences')
        .select('selected_state')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch state configuration for user's selected state
  const { data: stateConfig } = useQuery({
    queryKey: ['stateConfig', userPrefs?.selected_state],
    queryFn: async () => {
      if (!userPrefs?.selected_state) return null;
      const { data, error } = await supabase
        .from('state_config')
        .select('*')
        .eq('state_code', userPrefs.selected_state)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!userPrefs?.selected_state,
  });

  // Fetch game count for user's selected state
  const { data: gameCount } = useQuery({
    queryKey: ['gameCount', userPrefs?.selected_state],
    queryFn: async () => {
      if (!userPrefs?.selected_state) return 0;
      const { count, error } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('state', userPrefs.selected_state);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!userPrefs?.selected_state,
  });

  // Fetch first game source for user's selected state
  const { data: gameSource } = useQuery({
    queryKey: ['gameSource', userPrefs?.selected_state],
    queryFn: async () => {
      if (!userPrefs?.selected_state) return null;
      const { data, error } = await supabase
        .from('games')
        .select('source, source_url')
        .eq('state', userPrefs.selected_state)
        .not('source', 'is', null)
        .limit(1)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!userPrefs?.selected_state,
  });

  // Fetch global statistics
  const { data: globalStats } = useQuery({
    queryKey: ['globalStats'],
    queryFn: async () => {
      // Count active states (is_visible=true with games > 0)
      const { data: states, error: statesError } = await supabase
        .from('state_config')
        .select('state_code, is_visible')
        .eq('is_visible', true);
      
      if (statesError) throw statesError;

      // For each visible state, check if it has games
      const statesWithGames = await Promise.all(
        states.map(async (state) => {
          const { count } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true })
            .eq('state', state.state_code);
          return count && count > 0 ? 1 : 0;
        })
      );

      const activeStates = statesWithGames.reduce((sum, val) => sum + val, 0);

      // Count newly enabled states (updated_at within last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count: newlyEnabled, error: newError } = await supabase
        .from('state_config')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', sevenDaysAgo.toISOString());
      
      if (newError) throw newError;

      return {
        activeStates,
        newlyEnabled: newlyEnabled || 0,
      };
    },
  });

  // Replace tokens in message
  const processedMessage = useMemo(() => {
    if (messages.length === 0) return '';
    
    let message = messages[currentIndex]?.message || '';

    // User-specific tokens (only if user is logged in and has state selected)
    if (userPrefs?.selected_state && stateConfig) {
      message = message.replace(/\{scode\}/g, stateConfig.state_code || '');
      message = message.replace(/\{sname\}/g, stateConfig.state_name || '');
      message = message.replace(/\{icon\}/g, stateConfig.emoji || '');
      message = message.replace(/\{country\}/g, stateConfig.country || '');
      message = message.replace(/\{game-count\}/g, String(gameCount || 0));
      
      if (gameSource) {
        message = message.replace(/\{source\}/g, gameSource.source || '');
        message = message.replace(/\{surl\}/g, gameSource.source_url || '');
      }
    }

    // Global tokens (always available)
    if (globalStats) {
      message = message.replace(/\{activestates\}/g, String(globalStats.activeStates));
      message = message.replace(/\{newlyenabled\}/g, String(globalStats.newlyEnabled));
    }

    return message;
  }, [messages, currentIndex, userPrefs, stateConfig, gameCount, gameSource, globalStats]);

  useEffect(() => {
    if (messages.length === 0) return;

    const currentMessage = messages[currentIndex];
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length);
    }, currentMessage?.duration || 5000);

    return () => clearInterval(timer);
  }, [currentIndex, messages]);

  if (messages.length === 0) return null;

  const currentMessage = messages[currentIndex];

  return (
    <div className="bg-gray-200 rounded-xl mx-4 py-[18px] px-4 text-center overflow-hidden min-h-[100px] md:min-h-0 flex items-center justify-center">
      <div
        key={currentIndex}
        className={`animate-in ${
          currentMessage.transition_type === 'fade'
            ? 'fade-in'
            : currentMessage.transition_type === 'zoom'
            ? 'zoom-in'
            : currentMessage.transition_type === 'slide'
            ? 'slide-in-from-right'
            : 'flip-in'
        } duration-500`}
      >
        <p className="text-sm font-medium text-gray-800">{processedMessage}</p>
      </div>
    </div>
  );
}
