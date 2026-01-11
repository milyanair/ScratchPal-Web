import { Layout } from '@/components/layout/Layout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Game, ForumTopic, StateConfig } from '@/types';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { slugifyCategory } from '@/lib/utils';

export function Sitemap() {
  const navigate = useNavigate();

  // Fetch all states
  const { data: states = [] } = useQuery({
    queryKey: ['states'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('state_config')
        .select('*')
        .order('display_order');
      
      if (error) throw error;
      return data as StateConfig[];
    },
  });

  // Fetch all games (for sitemap overview)
  const { data: allGames = [] } = useQuery({
    queryKey: ['allGames'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('games')
        .select('id, game_name, state, price, slug')
        .order('state')
        .order('game_name');
      
      if (error) throw error;
      return data as Game[];
    },
  });

  // Fetch all forum topics
  const { data: allTopics = [] } = useQuery({
    queryKey: ['allTopics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_topics')
        .select('id, title, category, slug, created_at')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ForumTopic[];
    },
  });

  // Group games by state
  const gamesByState = allGames.reduce((acc, game) => {
    if (!acc[game.state]) {
      acc[game.state] = [];
    }
    acc[game.state].push(game);
    return acc;
  }, {} as Record<string, Game[]>);

  // Group topics by category
  const topicsByCategory = allTopics.reduce((acc, topic) => {
    if (!acc[topic.category]) {
      acc[topic.category] = [];
    }
    acc[topic.category].push(topic);
    return acc;
  }, {} as Record<string, ForumTopic[]>);

  const navigateToGame = (game: Game) => {
    if (game.slug) {
      navigate(`/games/${game.state.toLowerCase()}/${game.price}/${game.slug}`);
    } else {
      navigate(`/games/${game.id}`);
    }
  };

  const navigateToTopic = (topic: ForumTopic) => {
    if (topic.slug) {
      navigate(`/topic/${slugifyCategory(topic.category)}/${topic.slug}`);
    } else {
      navigate(`/topic/${topic.id}`);
    }
  };

  return (
    <Layout>
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-2">Site Index</h1>
        <p className="text-gray-600 mb-8">Browse all pages and content on Scratchpal</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Main Pages Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4 text-teal">Main Pages</h2>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center gap-2 text-teal hover:underline"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>Home / Games</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/hot-topics')}
                  className="flex items-center gap-2 text-teal hover:underline"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>Hot Topics (Forum)</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/favorites')}
                  className="flex items-center gap-2 text-teal hover:underline"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>My Favorites</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/report-wins')}
                  className="flex items-center gap-2 text-teal hover:underline"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>Report Wins</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/scan-tickets')}
                  className="flex items-center gap-2 text-teal hover:underline"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>Scan Tickets</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/profile')}
                  className="flex items-center gap-2 text-teal hover:underline"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>My Profile</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/donate')}
                  className="flex items-center gap-2 text-teal hover:underline"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>Donate</span>
                </button>
              </li>
            </ul>
          </div>

          {/* States Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4 text-teal">Browse by State</h2>
            <ul className="space-y-2">
              {states.map(state => (
                <li key={state.state_code}>
                  <button
                    onClick={() => navigate(`/games?state=${state.state_code}`)}
                    className="flex items-center gap-2 text-teal hover:underline"
                  >
                    <span className="text-xl">{state.emoji}</span>
                    <span>{state.state_name}</span>
                    <span className="text-gray-500 text-sm">
                      ({gamesByState[state.state_code]?.length || 0} games)
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Games by State Section */}
          <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
            <h2 className="text-2xl font-bold mb-4 text-teal">All Games by State</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {states.map(state => {
                const games = gamesByState[state.state_code] || [];
                if (games.length === 0) return null;

                return (
                  <div key={state.state_code}>
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                      <span className="text-xl">{state.emoji}</span>
                      <span>{state.state_name}</span>
                      <span className="text-sm text-gray-500">({games.length})</span>
                    </h3>
                    <ul className="space-y-1 text-sm max-h-96 overflow-y-auto">
                      {games.map(game => (
                        <li key={game.id}>
                          <button
                            onClick={() => navigateToGame(game)}
                            className="text-teal hover:underline text-left"
                          >
                            ${game.price} - {game.game_name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Forum Topics Section */}
          <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
            <h2 className="text-2xl font-bold mb-4 text-teal">Forum Topics by Category</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(topicsByCategory).map(([category, topics]) => (
                <div key={category}>
                  <h3 className="font-bold text-lg mb-2">{category}</h3>
                  <ul className="space-y-1 text-sm max-h-96 overflow-y-auto">
                    {topics.slice(0, 20).map(topic => (
                      <li key={topic.id}>
                        <button
                          onClick={() => navigateToTopic(topic)}
                          className="text-teal hover:underline text-left line-clamp-2"
                        >
                          {topic.title}
                        </button>
                      </li>
                    ))}
                    {topics.length > 20 && (
                      <li className="text-gray-500 text-xs">
                        + {topics.length - 20} more topics
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* XML Sitemap Link */}
        <div className="mt-8 text-center">
          <p className="text-gray-600 text-sm">
            For search engines:{' '}
            <a
              href="/sitemap.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal hover:underline"
            >
              XML Sitemap
            </a>
          </p>
        </div>
      </div>
    </Layout>
  );
}
