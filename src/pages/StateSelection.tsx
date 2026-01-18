import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { StateConfig } from '@/types';

import { Layout } from '@/components/layout/Layout';
import { haptics } from '@/lib/haptics';

export function StateSelection() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch states that have games and their icons from state_config
  const { data: availableStates = [], isLoading } = useQuery({
    queryKey: ['availableStates'],
    queryFn: async () => {
      // Get distinct states from games table
      const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('state')
        .order('state');
      
      if (gamesError) throw gamesError;

      // Get unique states
      const uniqueStates = Array.from(new Set(games.map(g => g.state)));

      // Fetch state configs for these states
      const { data: stateConfigs, error: configError } = await supabase
        .from('state_config')
        .select('*')
        .in('state_code', uniqueStates)
        .order('display_order');
      
      if (configError) throw configError;

      return stateConfigs as StateConfig[];
    },
  });

  const handleStateSelect = async (stateCode: string) => {
    haptics.medium(); // Haptic feedback for state selection
    
    if (!user) {
      // For anonymous users, save to localStorage
      localStorage.setItem('selected_state', stateCode);
      toast.success(`${stateCode} selected!`);
      navigate('/');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          {
            user_id: user.id,
            selected_state: stateCode,
          },
          {
            onConflict: 'user_id'
          }
        );

      if (error) {
        console.error('Error saving state:', error);
        throw error;
      }

      toast.success(`${stateCode} selected!`);
      navigate('/');
    } catch (error: any) {
      console.error('Error saving state:', error);
      toast.error(error.message || 'Failed to save state selection');
    }
  };



  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-6 py-8">
          <div className="text-center py-12">
            <p className="text-gray-500">Loading available states...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src="https://cdn-ai.onspace.ai/onspace/files/LWw94XGQuTANDUw5vLoJHH/scratchpallogonew2-300.png"
              alt="ScratchPal"
              className="h-16 object-contain"
            />
          </div>
          <p className="text-gray-600 text-lg">
            Your Scratch-off companion and community.
          </p>
        </div>

        <div className="space-y-6">
          {!user && (
            <div className="bg-teal/10 border border-teal/20 rounded-lg p-4 text-center">
              <p className="text-gray-700 mb-3">
                Want to save favorites and join discussions?
              </p>
              <button
                onClick={() => navigate('/profile')}
                className="bg-gradient-to-r from-teal-light to-teal-dark text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition-all"
              >
                Sign in or Register
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Select Your State</h2>
            {availableStates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No states available yet. Please check back later.</p>
                <p className="text-sm text-gray-400">States will appear automatically when game data is added.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {availableStates.map((state) => (
                  <button
                    key={state.state_code}
                    onClick={() => handleStateSelect(state.state_code)}
                    className="bg-gradient-to-br from-teal-light to-teal-dark hover:from-teal-dark hover:to-teal text-white rounded-xl p-6 flex flex-col items-center gap-3 transition-all hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    <span className="text-4xl">{state.emoji}</span>
                    <div className="text-center">
                      <div className="font-bold text-xl">{state.state_code}</div>
                      <div className="text-sm opacity-90">{state.state_name}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {/* Feedback Link */}
            <div className="mt-6 text-center text-sm text-gray-600">
              Don't see your state or game,{' '}
              <a
                href="https://play.scratchpal.com/topic/qa/where-is-my-state"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal hover:underline font-semibold"
              >
                let us know
              </a>
              .
            </div>
            
            {/* Bottom Links */}
            <div className="mt-6 flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-sm">
              <button
                onClick={() => navigate('/privacy-policy')}
                className="text-teal hover:underline"
              >
                Privacy Policy
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => navigate('/terms-of-service')}
                className="text-teal hover:underline"
              >
                Terms of Service
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => navigate('/sitemap')}
                className="text-teal hover:underline"
              >
                Sitemap
              </button>
              <span className="text-gray-300">|</span>
              <a
                href="https://play.scratchpal.com/hot-topics"
                className="text-teal hover:underline"
              >
                Ask Us
              </a>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => navigate('/donate')}
                className="text-teal hover:underline"
              >
                Donate
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
