import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { PointsConfig } from '@/types';
import { useState } from 'react';
import { toast } from 'sonner';
import { Save, Check, X } from 'lucide-react';

export function AdminRewards() {
  const queryClient = useQueryClient();
  const [editingActivity, setEditingActivity] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<PointsConfig>>({});

  const { data: pointsConfig = [] } = useQuery({
    queryKey: ['adminPointsConfig'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('points_config')
        .select('*')
        .order('display_name');
      
      if (error) throw error;
      return data as PointsConfig[];
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (config: PointsConfig) => {
      const { error } = await supabase
        .from('points_config')
        .update({
          points_awarded: config.points_awarded,
          instant_fanfare: config.instant_fanfare,
          is_active: config.is_active,
          daily_limit: config.daily_limit,
          weekly_limit: config.weekly_limit,
        })
        .eq('activity_name', config.activity_name);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPointsConfig'] });
      toast.success('Configuration updated');
      setEditingActivity(null);
      setEditValues({});
    },
    onError: (error) => {
      console.error('Error updating config:', error);
      toast.error('Failed to update configuration');
    },
  });

  const handleStartEdit = (config: PointsConfig) => {
    setEditingActivity(config.activity_name);
    setEditValues({
      points_awarded: config.points_awarded,
      instant_fanfare: config.instant_fanfare,
      is_active: config.is_active,
      daily_limit: config.daily_limit,
      weekly_limit: config.weekly_limit,
    });
  };

  const handleSaveEdit = (config: PointsConfig) => {
    updateConfigMutation.mutate({
      ...config,
      ...editValues,
    });
  };

  const handleCancelEdit = () => {
    setEditingActivity(null);
    setEditValues({});
  };

  return (
    <div>
      <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-bold mb-2">Rewards Configuration</h2>
        <p className="opacity-90">
          Configure point values and fanfare settings for user activities. Changes apply immediately.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Activity</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Points</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Daily Limit</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Weekly Limit</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Instant Confetti</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Active</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pointsConfig.map((config) => {
              const isEditing = editingActivity === config.activity_name;
              
              return (
                <tr key={config.activity_name} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">
                    {config.display_name}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editValues.points_awarded}
                        onChange={(e) => setEditValues({ ...editValues, points_awarded: parseInt(e.target.value) || 0 })}
                        className="w-20 px-2 py-1 border rounded text-center"
                        min="0"
                      />
                    ) : (
                      <span className="text-sm font-bold text-teal">{config.points_awarded}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editValues.daily_limit ?? ''}
                        onChange={(e) => setEditValues({ ...editValues, daily_limit: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="None"
                        className="w-20 px-2 py-1 border rounded text-center"
                        min="0"
                      />
                    ) : (
                      <span className="text-sm">{config.daily_limit ?? 'None'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editValues.weekly_limit ?? ''}
                        onChange={(e) => setEditValues({ ...editValues, weekly_limit: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="None"
                        className="w-20 px-2 py-1 border rounded text-center"
                        min="0"
                      />
                    ) : (
                      <span className="text-sm">{config.weekly_limit ?? 'None'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={editValues.instant_fanfare}
                        onChange={(e) => setEditValues({ ...editValues, instant_fanfare: e.target.checked })}
                        className="w-4 h-4"
                      />
                    ) : (
                      config.instant_fanfare ? (
                        <span className="text-yellow-500">✨</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={editValues.is_active}
                        onChange={(e) => setEditValues({ ...editValues, is_active: e.target.checked })}
                        className="w-4 h-4"
                      />
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        config.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {config.is_active ? 'Yes' : 'No'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isEditing ? (
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleSaveEdit(config)}
                          className="p-1 hover:bg-green-100 rounded text-green-600"
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1 hover:bg-red-100 rounded text-red-600"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(config)}
                        className="px-3 py-1 bg-teal text-white rounded hover:opacity-90 text-xs font-semibold"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-bold text-blue-900 mb-2">📝 Notes:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Points</strong>: Amount awarded for this activity</li>
          <li>• <strong>Daily/Weekly Limits</strong>: Maximum times this activity can earn points per day/week (blank = no limit)</li>
          <li>• <strong>Instant Confetti</strong>: Show confetti animation immediately (✨) vs on next login</li>
          <li>• <strong>Active</strong>: Whether this activity currently awards points</li>
        </ul>
      </div>
    </div>
  );
}
