import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { StateConfig } from '@/types';
import { Pencil, Trash2, Plus, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export function AdminStates() {
  const [editingState, setEditingState] = useState<StateConfig | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewState, setIsNewState] = useState(false);

  const { data: stateConfigs = [], refetch: refetchStates } = useQuery({
    queryKey: ['adminStateConfigs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('state_config')
        .select('*')
        .order('display_order');
      
      if (error) throw error;
      return data as StateConfig[];
    },
  });

  const { data: gameCountByState = [] } = useQuery({
    queryKey: ['gameCountByState'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('games')
        .select('state');
      
      if (error) throw error;

      const counts: Record<string, number> = {};
      data.forEach(game => {
        counts[game.state] = (counts[game.state] || 0) + 1;
      });

      return Object.entries(counts).map(([state, count]) => ({ state, count }));
    },
  });

  const getGameCount = (stateCode: string) => {
    return gameCountByState.find(s => s.state === stateCode)?.count || 0;
  };

  const handleOpenNew = () => {
    setEditingState({
      state_code: '',
      state_name: '',
      emoji: '',
      country: 'US',
      display_order: stateConfigs.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setIsNewState(true);
    setIsModalOpen(true);
  };

  const handleEdit = (state: StateConfig) => {
    setEditingState(state);
    setIsNewState(false);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingState) return;

    if (!editingState.state_code || !editingState.state_name || !editingState.emoji || !editingState.country) {
      toast.error('Please fill in all fields');
      return;
    }

    if (editingState.state_code.length !== 2) {
      toast.error('State code must be exactly 2 characters');
      return;
    }

    try {
      if (isNewState) {
        const { error } = await supabase
          .from('state_config')
          .insert({
            state_code: editingState.state_code.toUpperCase(),
            state_name: editingState.state_name,
            emoji: editingState.emoji,
            country: editingState.country,
            display_order: editingState.display_order,
          });

        if (error) throw error;
        toast.success('State added successfully!');
      } else {
        const { error } = await supabase
          .from('state_config')
          .update({
            state_name: editingState.state_name,
            emoji: editingState.emoji,
            country: editingState.country,
            display_order: editingState.display_order,
            updated_at: new Date().toISOString(),
          })
          .eq('state_code', editingState.state_code);

        if (error) throw error;
        toast.success('State updated successfully!');
      }

      setIsModalOpen(false);
      setEditingState(null);
      refetchStates();
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(error.message || 'Failed to save state');
    }
  };

  const handleDelete = async (stateCode: string) => {
    const gameCount = getGameCount(stateCode);
    
    if (gameCount > 0) {
      toast.error(`Cannot delete ${stateCode}: ${gameCount} games still exist in this state`);
      return;
    }

    if (!confirm(`Delete state ${stateCode}? This cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('state_config')
        .delete()
        .eq('state_code', stateCode);

      if (error) throw error;
      toast.success('State deleted');
      refetchStates();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || 'Failed to delete state');
    }
  };

  return (
    <div>
      <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-bold mb-2">State Configuration</h2>
        <p className="opacity-90 mb-4">
          Configure which states appear on the Select State page. States automatically show/hide based on whether games exist in the database.
        </p>
        <div className="bg-white/10 rounded-lg p-4">
          <h3 className="font-bold mb-2">How It Works:</h3>
          <ul className="space-y-1 text-sm opacity-90">
            <li>• Configure state icons and names here</li>
            <li>• States only appear on Select State page if games exist in the games table</li>
            <li>• When game data is added for a new state, it will automatically appear</li>
            <li>• When all games are removed from a state, it will automatically hide</li>
          </ul>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Configured States</h3>
        <button
          onClick={handleOpenNew}
          className="gradient-teal text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add State
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Display Order</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">State Code</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">State Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Country</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Icon</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Games</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Visible</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {stateConfigs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No states configured yet
                </td>
              </tr>
            ) : (
              stateConfigs.map((state) => {
                const gameCount = getGameCount(state.state_code);
                const isVisible = gameCount > 0;

                return (
                  <tr key={state.state_code} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{state.display_order}</td>
                    <td className="px-4 py-3 text-sm font-bold">{state.state_code}</td>
                    <td className="px-4 py-3 text-sm">{state.state_name}</td>
                    <td className="px-4 py-3 text-sm">{state.country}</td>
                    <td className="px-4 py-3 text-2xl">{state.emoji}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        gameCount > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {gameCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isVisible ? (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                          Yes
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(state)}
                          className="p-1 hover:bg-gray-200 rounded"
                          title="Edit state"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(state.state_code)}
                          className="p-1 hover:bg-red-100 rounded text-red-600"
                          title={gameCount > 0 ? `Cannot delete: ${gameCount} games exist` : 'Delete state'}
                          disabled={gameCount > 0}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
        <h3 className="font-bold mb-2 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          Popular State Emojis
        </h3>
        <p className="text-sm text-gray-700 mb-3">
          Common emojis used for US states (copy and paste):
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
          <div><span className="text-xl mr-2">🍑</span> Georgia (Peach)</div>
          <div><span className="text-xl mr-2">⛈️</span> Arkansas (Storm)</div>
          <div><span className="text-xl mr-2">🤠</span> Texas (Cowboy)</div>
          <div><span className="text-xl mr-2">🌵</span> Arizona (Cactus)</div>
          <div><span className="text-xl mr-2">🌴</span> Florida (Palm)</div>
          <div><span className="text-xl mr-2">☀️</span> California (Sun)</div>
          <div><span className="text-xl mr-2">🍎</span> New York (Apple)</div>
          <div><span className="text-xl mr-2">🌲</span> Oregon (Tree)</div>
          <div><span className="text-xl mr-2">🏔️</span> Colorado (Mountain)</div>
          <div><span className="text-xl mr-2">🌾</span> Kansas (Wheat)</div>
          <div><span className="text-xl mr-2">🦞</span> Maine (Lobster)</div>
          <div><span className="text-xl mr-2">🎸</span> Tennessee (Music)</div>
        </div>
      </div>

      {/* Edit/New Modal */}
      {isModalOpen && editingState && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-6">
              {isNewState ? 'Add New State' : 'Edit State'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">State Code (2 letters)</label>
                <input
                  type="text"
                  value={editingState.state_code}
                  onChange={(e) =>
                    setEditingState({
                      ...editingState,
                      state_code: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full border rounded-lg px-4 py-2 uppercase"
                  maxLength={2}
                  placeholder="e.g., TX"
                  disabled={!isNewState}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">State Name</label>
                <input
                  type="text"
                  value={editingState.state_name}
                  onChange={(e) =>
                    setEditingState({ ...editingState, state_name: e.target.value })
                  }
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="e.g., Texas"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Emoji Icon</label>
                <input
                  type="text"
                  value={editingState.emoji}
                  onChange={(e) =>
                    setEditingState({ ...editingState, emoji: e.target.value })
                  }
                  className="w-full border rounded-lg px-4 py-2 text-2xl"
                  placeholder="🤠"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Copy an emoji from the table above or use any emoji
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Country</label>
                <input
                  type="text"
                  value={editingState.country}
                  onChange={(e) =>
                    setEditingState({ ...editingState, country: e.target.value.toUpperCase() })
                  }
                  className="w-full border rounded-lg px-4 py-2 uppercase"
                  placeholder="e.g., US"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Display Order</label>
                <input
                  type="number"
                  value={editingState.display_order}
                  onChange={(e) =>
                    setEditingState({
                      ...editingState,
                      display_order: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full border rounded-lg px-4 py-2"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lower numbers appear first
                </p>
              </div>
            </div>

            <div className="flex gap-4 mt-6 border-t pt-4">
              <button
                onClick={handleSave}
                className="flex-1 gradient-teal text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90"
              >
                {isNewState ? 'Add State' : 'Save Changes'}
              </button>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingState(null);
                }}
                className="flex-1 border border-gray-300 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
