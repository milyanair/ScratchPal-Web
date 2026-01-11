import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from './useAuth';
import { supabase } from '@/lib/supabase';

/**
 * Hook to handle state selection from URL parameter
 * Allows deep linking with ?state=XX parameter
 * 
 * Usage: const stateFromUrl = useStateFromUrl();
 * Returns the state code if set from URL, null otherwise
 */
export function useStateFromUrl() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [stateFromUrl, setStateFromUrl] = useState<string | null>(null);

  useEffect(() => {
    const stateParam = searchParams.get('state');
    
    // Skip if no state param, already processing, or already processed
    if (!stateParam || isProcessing || hasProcessed) return;

    const processStateParam = async () => {
      setIsProcessing(true);

      try {
        const stateCode = stateParam.toUpperCase();

        if (user) {
          // For logged-in users: update user_preferences
          const { data: existing } = await supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (existing) {
            // Update existing preference
            await supabase
              .from('user_preferences')
              .update({ selected_state: stateCode })
              .eq('user_id', user.id);
          } else {
            // Create new preference
            await supabase
              .from('user_preferences')
              .insert({
                user_id: user.id,
                selected_state: stateCode,
              });
          }
        } else {
          // For anonymous users: update localStorage
          localStorage.setItem('selected_state', stateCode);
          
          // Trigger storage event for header state circle update
          window.dispatchEvent(new Event('storage'));
        }

        console.log(`✅ State set from URL parameter: ${stateCode}`);
        setStateFromUrl(stateCode);
        setHasProcessed(true);

        // Remove state parameter from URL (clean up URL)
        searchParams.delete('state');
        setSearchParams(searchParams, { replace: true });

      } catch (error) {
        console.error('Error setting state from URL:', error);
      } finally {
        setIsProcessing(false);
      }
    };

    processStateParam();
  }, [searchParams, setSearchParams, user, isProcessing, hasProcessed]);

  return stateFromUrl;
}
