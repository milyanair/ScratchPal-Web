import { Layout } from '@/components/layout/Layout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ForumTopic, Game } from '@/types';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Search, Pin, Heart, ThumbsUp, Megaphone, Image as ImageIcon, X, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { usePoints } from '@/hooks/usePoints';
import { useUserColors } from '@/hooks/useUserColor';
import { slugifyCategory, generateUniqueSlug } from '@/lib/utils';

const CATEGORIES = ['All', 'General', 'Game Talk', 'Tips & Tricks', 'Q&A', 'Ask Us', 'Report a Problem'];

export function HotTopics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { awardPoints } = usePoints();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewTopicModal, setShowNewTopicModal] = useState(false);
  const [newTopicCategory, setNewTopicCategory] = useState('General');
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicContent, setNewTopicContent] = useState('');
  const [newTopicGameId, setNewTopicGameId] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicTitle, setEditTopicTitle] = useState('');
  const [editTopicContent, setEditTopicContent] = useState('');
  const [editTopicCategory, setEditTopicCategory] = useState('');
  const [editTopicGameId, setEditTopicGameId] = useState<string | null>(null);
  const [editUploadedImages, setEditUploadedImages] = useState<string[]>([]);

  // Get user's selected state for game selection
  const { data: userPref } = useQuery({
    queryKey: ['userPreference', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
  });

  const [anonymousState] = useState<string>(() => {
    return localStorage.getItem('selected_state') || '';
  });

  const selectedState = user ? userPref?.selected_state : anonymousState;

  // Get user role
  const { data: userProfile } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const isAdmin = userProfile?.role === 'admin';

  const { data: games = [] } = useQuery({
    queryKey: ['games', selectedState],
    queryFn: async () => {
      if (!selectedState) return [];
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('state', selectedState)
        .order('game_name');
      
      if (error) throw error;
      return data as Game[];
    },
    enabled: !!selectedState,
  });

  const { data: topics = [], refetch: refetchTopics } = useQuery({
    queryKey: ['forumTopics', selectedCategory],
    queryFn: async () => {
      let query = supabase
        .from('forum_topics')
        .select('*, game:games(*)');

      if (selectedCategory !== 'All') {
        query = query.eq('category', selectedCategory);
      }

      query = query.order('is_pinned', { ascending: false })
                   .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data as ForumTopic[];
    },
  });

  // Get user's favorites
  const { data: favorites = [], refetch: refetchFavorites } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', user.id)
        .eq('favorite_type', 'topic');
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const filteredTopics = topics.filter((topic) =>
    topic.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    topic.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get all unique user IDs from topics
  const allUserIds = topics.map(t => t.user_id);
  const { data: userColors = {} } = useUserColors(allUserIds);

  const isFavorited = (topicId: string) => {
    return favorites.some(f => f.reference_id === topicId);
  };

  const handleToggleFavorite = async (topicId: string) => {
    if (!user) {
      toast.error('Please sign in to favorite topics', {
        action: {
          label: 'Sign In',
          onClick: () => navigate('/profile'),
        },
      });
      return;
    }

    const favorited = isFavorited(topicId);

    try {
      if (favorited) {
        // Remove favorite
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('reference_id', topicId)
          .eq('favorite_type', 'topic');
        
        toast.success('Removed from favorites');
      } else {
        // Add favorite
        await supabase
          .from('favorites')
          .insert({
            user_id: user.id,
            favorite_type: 'topic',
            reference_id: topicId,
          });
        
        toast.success('Added to favorites');
      }

      refetchFavorites();
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
    }
  };

  const getUserInitials = (userId: string) => {
    return userId.substring(0, 2).toUpperCase();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!user) {
      toast.error('Please sign in to upload images');
      return;
    }

    setIsUploading(true);

    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Check file size (max 10MB)
        if (file.size > 10485760) {
          toast.error(`${file.name} is too large. Max size is 10MB.`);
          continue;
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}_${Date.now()}_${i}.${fileExt}`;
        const filePath = `${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('forum-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('forum-images')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      // Award points for adding attachments
      if (uploadedUrls.length > 0) {
        await awardPoints('add_attachment', `Added ${uploadedUrls.length} image(s) to edit`);
      }

      // Award points for adding attachments
      if (uploadedUrls.length > 0) {
        await awardPoints('add_attachment', `Added ${uploadedUrls.length} image(s)`);
      }

      setUploadedImages([...uploadedImages, ...uploadedUrls]);
      toast.success(`${uploadedUrls.length} image(s) uploaded`);
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error('Failed to upload images');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (url: string) => {
    setUploadedImages(uploadedImages.filter(img => img !== url));
  };

  const handleCreateTopic = async () => {
    if (!user) {
      toast.error('Please sign in to create topics');
      return;
    }

    if (!newTopicTitle.trim() || !newTopicContent.trim()) {
      toast.error('Please enter title and content');
      return;
    }

    try {
      // Generate unique slug from title
      const { data: existingTopics } = await supabase
        .from('forum_topics')
        .select('slug')
        .eq('category', newTopicCategory);
      
      const existingSlugs = existingTopics?.map(t => t.slug).filter(Boolean) || [];
      const slug = generateUniqueSlug(newTopicTitle, newTopicCategory, existingSlugs);

      await supabase.from('forum_topics').insert({
        user_id: user.id,
        game_id: newTopicGameId,
        category: newTopicCategory,
        title: newTopicTitle,
        content: newTopicContent,
        image_urls: uploadedImages.length > 0 ? uploadedImages : null,
        slug: slug,
      });

      toast.success('Topic created!');
      setShowNewTopicModal(false);
      setNewTopicTitle('');
      setNewTopicContent('');
      setNewTopicGameId(null);
      setUploadedImages([]);
      setNewTopicCategory('General');
      refetchTopics();
    } catch (error) {
      console.error('Error creating topic:', error);
      toast.error('Failed to create topic');
    }
  };

  const handleEditTopic = (topic: ForumTopic) => {
    setEditingTopicId(topic.id);
    setEditTopicTitle(topic.title);
    setEditTopicContent(topic.content);
    setEditTopicCategory(topic.category);
    setEditTopicGameId(topic.game_id || null);
    setEditUploadedImages(topic.image_urls || []);
  };

  const handleUpdateTopic = async () => {
    if (!editTopicTitle.trim() || !editTopicContent.trim()) {
      toast.error('Please enter title and content');
      return;
    }

    try {
      await supabase
        .from('forum_topics')
        .update({
          title: editTopicTitle,
          content: editTopicContent,
          category: editTopicCategory,
          game_id: editTopicGameId,
          image_urls: editUploadedImages.length > 0 ? editUploadedImages : null,
        })
        .eq('id', editingTopicId!);

      toast.success('Topic updated!');
      setEditingTopicId(null);
      refetchTopics();
    } catch (error) {
      console.error('Error updating topic:', error);
      toast.error('Failed to update topic');
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!confirm('Are you sure you want to delete this topic? This will also delete all replies.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('forum_topics')
        .delete()
        .eq('id', topicId);

      if (error) throw error;
      toast.success('Topic deleted');
      refetchTopics();
    } catch (error) {
      console.error('Error deleting topic:', error);
      toast.error('Failed to delete topic');
    }
  };

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (file.size > 10485760) {
          toast.error(`${file.name} is too large. Max size is 10MB.`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${user!.id}_${Date.now()}_${i}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('forum-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('forum-images')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      // Award points for adding attachments
      if (uploadedUrls.length > 0) {
        await awardPoints('add_attachment', `Added ${uploadedUrls.length} image(s) to edit`);
      }

      // Award points for adding attachments
      if (uploadedUrls.length > 0) {
        await awardPoints('add_attachment', `Added ${uploadedUrls.length} image(s)`);
      }

      setEditUploadedImages([...editUploadedImages, ...uploadedUrls]);
      toast.success(`${uploadedUrls.length} image(s) uploaded`);
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error('Failed to upload images');
    } finally {
      setIsUploading(false);
    }
  };

  const removeEditImage = (url: string) => {
    setEditUploadedImages(editUploadedImages.filter(img => img !== url));
  };

  return (
    <Layout>
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Megaphone className="w-8 h-8 text-hot" />
            <h1 className="text-3xl font-bold">Hot Topics</h1>
          </div>
          <p className="text-gray-600">
            Join the conversation about your favorite scratch-off games
          </p>
        </div>

        {/* Search & New Topic */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search topics..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
          <button
            onClick={() => {
              if (!user) {
                toast.error('Please sign in to create topics', {
                  action: {
                    label: 'Sign In',
                    onClick: () => navigate('/profile'),
                  },
                });
                return;
              }
              setShowNewTopicModal(true);
            }}
            className="gradient-hot text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90"
          >
            New Topic
          </button>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'gradient-teal text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Divider */}
        <hr className="border-t border-gray-300 mb-6" />

        {/* Topics List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTopics.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-white rounded-lg">
              <p className="text-gray-500">No topics found</p>
            </div>
          ) : (
            filteredTopics.map((topic, index) => {
              // Alternating theme colors (light versions)
              const colorClasses = [
                'bg-green-50 hover:bg-green-100', // Games green
                'bg-orange-50 hover:bg-orange-100', // Hot burnt orange
                'bg-purple-50 hover:bg-purple-100', // Favs mauve/purple
                'bg-violet-50 hover:bg-violet-100', // Wins purple
              ];
              const colorClass = colorClasses[index % 4];
              
              return (
              <div
                key={topic.id}
                className={`${colorClass} rounded-xl shadow-md transition-all duration-300 hover:shadow-lg overflow-hidden`}
              >
                {/* Desktop Layout */}
                <div className="hidden md:block">
                  {/* Card Content */}
                  <div 
                    className="p-4 cursor-pointer relative"
                    onClick={() => {
                      if (topic.slug) {
                        navigate(`/topic/${slugifyCategory(topic.category)}/${topic.slug}`);
                      } else {
                        navigate(`/topic/${topic.id}`);
                      }
                    }}
                  >
                    {/* Favorite Button - Upper Right */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(topic.id);
                      }}
                      className="absolute top-3 right-3 bg-white/80 hover:bg-white backdrop-blur p-2 rounded-full shadow-md transition-all z-10"
                      title={isFavorited(topic.id) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Heart
                        className={`w-5 h-5 ${
                          isFavorited(topic.id) ? 'fill-red-500 text-red-500' : 'text-gray-600'
                        }`}
                      />
                    </button>

                    <div className="flex items-center gap-3 mb-3">
                      {/* User Avatar */}
                      <div 
                        className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: userColors[topic.user_id] || '#14b8a6' }}
                      >
                        {getUserInitials(topic.user_id)}
                      </div>

                      {/* Metadata */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {topic.is_pinned && (
                            <Pin className="w-3 h-3 text-teal fill-teal" />
                          )}
                          {/* Category Badge */}
                          <span className="bg-white/60 backdrop-blur text-gray-800 px-2 py-1 rounded-full text-xs font-semibold shadow-sm">
                            {topic.category}
                          </span>
                          {/* Upvotes */}
                          <span className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                            <ThumbsUp className="w-3 h-3" />
                            {topic.upvotes}
                          </span>
                        </div>
                        {/* Date */}
                        <span className="text-xs text-gray-600 mt-1 block">
                          {new Date(topic.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Game Badge */}
                    {topic.game && (
                      <div className="mb-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/games/${topic.game_id}`);
                          }}
                          className="bg-white/60 backdrop-blur text-teal px-2 py-1 rounded-full text-xs font-semibold hover:bg-white/80 transition-colors shadow-sm"
                        >
                          {topic.game.state} - {topic.game.game_name}
                        </button>
                      </div>
                    )}

                    {/* Topic Title */}
                    <h3 className="font-bold text-base text-gray-900 line-clamp-2 mb-2">
                      {topic.title}
                    </h3>

                    {/* Content Preview */}
                    <div className="bg-white/40 backdrop-blur rounded-lg p-3 mb-3">
                      <p className="text-sm text-gray-800 line-clamp-3 whitespace-pre-wrap">
                        {topic.content}
                      </p>
                    </div>
                  </div>

                  {/* Admin Actions - Bottom Bar */}
                  {isAdmin && (
                    <div className="px-4 pb-4 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTopic(topic);
                        }}
                        className="flex-1 bg-white/60 hover:bg-white/80 backdrop-blur p-2 rounded-lg transition-colors shadow-sm"
                        title="Edit topic"
                      >
                        <Pencil className="w-4 h-4 text-gray-700" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTopic(topic.id);
                        }}
                        className="flex-1 bg-red-100/60 hover:bg-red-100/80 backdrop-blur p-2 rounded-lg transition-colors shadow-sm"
                        title="Delete topic"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile Layout */}
                <div className="md:hidden p-4 relative">
                  {/* Favorite Button - Upper Right */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite(topic.id);
                    }}
                    className="absolute top-3 right-3 bg-white/80 hover:bg-white backdrop-blur p-2 rounded-full shadow-md transition-all z-10"
                    title={isFavorited(topic.id) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        isFavorited(topic.id) ? 'fill-red-500 text-red-500' : 'text-gray-600'
                      }`}
                    />
                  </button>

                  {/* User Avatar + Metadata Row */}
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: userColors[topic.user_id] || '#14b8a6' }}
                    >
                      {getUserInitials(topic.user_id)}
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {topic.is_pinned && (
                          <Pin className="w-3 h-3 text-teal fill-teal" />
                        )}
                        {/* Category Badge */}
                        <span className="bg-white/60 backdrop-blur text-gray-800 px-2 py-1 rounded-full text-xs font-semibold shadow-sm">
                          {topic.category}
                        </span>
                        {/* Upvotes */}
                        <span className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                          <ThumbsUp className="w-3 h-3" />
                          {topic.upvotes}
                        </span>
                      </div>
                      {/* Date */}
                      <span className="text-xs text-gray-600 mt-1 block">
                        {new Date(topic.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Game Badge (if applicable) */}
                  {topic.game && (
                    <div className="mb-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/games/${topic.game_id}`);
                        }}
                        className="bg-white/60 backdrop-blur text-teal px-2 py-1 rounded-full text-xs font-semibold hover:bg-white/80 transition-colors shadow-sm"
                      >
                        {topic.game.state} - {topic.game.game_name}
                      </button>
                    </div>
                  )}

                  {/* Topic Title */}
                  <h3 
                    className="font-bold text-base text-gray-900 line-clamp-2 mb-2 cursor-pointer"
                    onClick={() => {
                      if (topic.slug) {
                        navigate(`/topic/${slugifyCategory(topic.category)}/${topic.slug}`);
                      } else {
                        navigate(`/topic/${topic.id}`);
                      }
                    }}
                  >
                    {topic.title}
                  </h3>

                  {/* Content Preview */}
                  <div 
                    className="bg-white/40 backdrop-blur rounded-lg p-3 mb-3 cursor-pointer"
                    onClick={() => {
                      if (topic.slug) {
                        navigate(`/topic/${slugifyCategory(topic.category)}/${topic.slug}`);
                      } else {
                        navigate(`/topic/${topic.id}`);
                      }
                    }}
                  >
                    <p className="text-sm text-gray-800 line-clamp-3 whitespace-pre-wrap">
                      {topic.content}
                    </p>
                  </div>

                  {/* Admin Actions */}
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTopic(topic);
                        }}
                        className="flex-1 bg-white/60 hover:bg-white/80 backdrop-blur p-2 rounded-lg transition-colors shadow-sm"
                        title="Edit topic"
                      >
                        <Pencil className="w-4 h-4 text-gray-700" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTopic(topic.id);
                        }}
                        className="flex-1 bg-red-100/60 hover:bg-red-100/80 backdrop-blur p-2 rounded-lg transition-colors shadow-sm"
                        title="Delete topic"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
            })
          )}
        </div>
      </div>

      {/* New Topic Modal */}
      {showNewTopicModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8">
            <h2 className="text-2xl font-bold mb-4">Create New Topic</h2>
            
            {/* Category Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Category</label>
              <select
                value={newTopicCategory}
                onChange={(e) => setNewTopicCategory(e.target.value)}
                className="w-full border rounded-lg p-2"
              >
                {CATEGORIES.filter(cat => cat !== 'All').map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Game Selection (Optional) */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Related Game (Optional)</label>
              <select
                value={newTopicGameId || ''}
                onChange={(e) => setNewTopicGameId(e.target.value || null)}
                className="w-full border rounded-lg p-2"
              >
                <option value="">None</option>
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.game_name} - ${game.price}
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder="Enter topic title..."
                className="w-full border rounded-lg p-2"
              />
            </div>

            {/* Content */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Content</label>
              <textarea
                value={newTopicContent}
                onChange={(e) => setNewTopicContent(e.target.value)}
                placeholder="Share your thoughts..."
                className="w-full border rounded-lg p-3 min-h-[150px]"
              />
            </div>

            {/* Image Upload */}
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-teal">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploading}
                />
                <ImageIcon className="w-5 h-5" />
                <span>{isUploading ? 'Uploading...' : 'Add Images'}</span>
              </label>

              {/* Image Previews */}
              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {uploadedImages.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={url}
                        alt={`Upload ${idx + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removeImage(url)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNewTopicModal(false);
                  setNewTopicTitle('');
                  setNewTopicContent('');
                  setNewTopicGameId(null);
                  setUploadedImages([]);
                  setNewTopicCategory('General');
                }}
                className="flex-1 border rounded-lg py-2 font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTopic}
                className="flex-1 gradient-teal text-white py-2 rounded-lg font-semibold hover:opacity-90"
              >
                Create Topic
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Topic Modal */}
      {editingTopicId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8">
            <h2 className="text-2xl font-bold mb-4">Edit Topic</h2>
            
            {/* Category Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Category</label>
              <select
                value={editTopicCategory}
                onChange={(e) => setEditTopicCategory(e.target.value)}
                className="w-full border rounded-lg p-2"
              >
                {CATEGORIES.filter(cat => cat !== 'All').map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Game Selection (Optional) */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Related Game (Optional)</label>
              <select
                value={editTopicGameId || ''}
                onChange={(e) => setEditTopicGameId(e.target.value || null)}
                className="w-full border rounded-lg p-2"
              >
                <option value="">None</option>
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.game_name} - ${game.price}
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={editTopicTitle}
                onChange={(e) => setEditTopicTitle(e.target.value)}
                placeholder="Enter topic title..."
                className="w-full border rounded-lg p-2"
              />
            </div>

            {/* Content */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Content</label>
              <textarea
                value={editTopicContent}
                onChange={(e) => setEditTopicContent(e.target.value)}
                placeholder="Share your thoughts..."
                className="w-full border rounded-lg p-3 min-h-[150px]"
              />
            </div>

            {/* Image Upload */}
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-teal">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleEditImageUpload}
                  className="hidden"
                  disabled={isUploading}
                />
                <ImageIcon className="w-5 h-5" />
                <span>{isUploading ? 'Uploading...' : 'Add Images'}</span>
              </label>

              {/* Image Previews */}
              {editUploadedImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {editUploadedImages.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={url}
                        alt={`Upload ${idx + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removeEditImage(url)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setEditingTopicId(null)}
                className="flex-1 border rounded-lg py-2 font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateTopic}
                className="flex-1 gradient-teal text-white py-2 rounded-lg font-semibold hover:opacity-90"
              >
                Update Topic
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
