import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SliderMessage } from '@/types';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';

export function MessageSlider() {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Get selected state from localStorage for anonymous users
  const [anonymousState, setAnonymousState] = useState<string>(() => {
    return localStorage.getItem('selected_state') || '';
  });

  // Listen for localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      setAnonymousState(localStorage.getItem('selected_state') || '');
    };
    window.addEventListener('storage', handleStorageChange);
    // Also check on interval in case same-window updates don't trigger storage event
    const interval = setInterval(handleStorageChange, 1000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

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

  // Determine selected state (logged in user's pref or anonymous localStorage)
  const selectedState = user ? userPrefs?.selected_state : anonymousState;

  // Fetch state configuration for selected state
  const { data: stateConfig } = useQuery({
    queryKey: ['stateConfig', selectedState],
    queryFn: async () => {
      if (!selectedState) return null;
      const { data, error } = await supabase
        .from('state_config')
        .select('*')
        .eq('state_code', selectedState)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedState,
  });

  // Fetch game count for selected state
  const { data: gameCount } = useQuery({
    queryKey: ['gameCount', selectedState],
    queryFn: async () => {
      if (!selectedState) return 0;
      const { count, error } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('state', selectedState);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!selectedState,
  });

  // Fetch first game source for selected state
  const { data: gameSource } = useQuery({
    queryKey: ['gameSource', selectedState],
    queryFn: async () => {
      if (!selectedState) return null;
      const { data, error } = await supabase
        .from('games')
        .select('source, source_url')
        .eq('state', selectedState)
        .not('source', 'is', null)
        .limit(1)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!selectedState,
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

    // State-specific tokens (works for both logged in users and anonymous users with selected state)
    if (selectedState && stateConfig) {
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
  }, [messages, currentIndex, selectedState, stateConfig, gameCount, gameSource, globalStats]);

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
