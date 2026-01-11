import { Layout } from '@/components/layout/Layout';
import { useParams, useNavigate } from 'react-router-dom';
import { slugifyCategory } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ForumTopic, ForumPost } from '@/types';
import { ArrowLeft, Pin, ThumbsUp, Send, Image as ImageIcon, X, Pencil, Trash2, Heart } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePoints } from '@/hooks/usePoints';
import { useUserColor, useUserColors } from '@/hooks/useUserColor';

export function TopicDetail() {
  const { category, slug } = useParams<{ category: string; slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { awardPoints } = usePoints();
  const queryClient = useQueryClient();
  const [replyContent, setReplyContent] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostContent, setEditPostContent] = useState('');
  const [editPostImages, setEditPostImages] = useState<string[]>([]);

  const { data: topic, refetch: refetchTopic } = useQuery({
    queryKey: ['forumTopic', category, slug],
    queryFn: async () => {
      // First try to find by slug (new format)
      if (category && slug) {
        const { data, error } = await supabase
          .from('forum_topics')
          .select('*, game:games(*)')
          .eq('category', category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
          .eq('slug', slug)
          .maybeSingle();
        
        if (!error && data) return data as ForumTopic;
      }
      
      // Fallback: try as ID (old format for backwards compatibility)
      const possibleId = category; // In old URLs, category param contains the ID
      const { data, error } = await supabase
        .from('forum_topics')
        .select('*, game:games(*)')
        .eq('id', possibleId)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) throw new Error('Topic not found');
      return data as ForumTopic;
    },
  });

  const { data: posts = [], refetch: refetchPosts } = useQuery({
    queryKey: ['forumPosts', topic?.id],
    queryFn: async () => {
      if (!topic) return [];
      const { data, error } = await supabase
        .from('forum_posts')
        .select('*')
        .eq('topic_id', topic.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as ForumPost[];
    },
    enabled: !!topic,
  });

  // Get all unique user IDs from topic and posts
  const allUserIds = topic ? [topic.user_id, ...posts.map(p => p.user_id)] : [];
  const { data: userColors = {} } = useUserColors(allUserIds);

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

  // Check if user has upvoted
  const { data: hasUpvoted = false } = useQuery({
    queryKey: ['hasUpvoted', topic?.id, user?.id],
    queryFn: async () => {
      if (!user || !topic) return false;
      const { data, error } = await supabase
        .from('topic_upvotes')
        .select('id')
        .eq('topic_id', topic.id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return !!data;
    },
    enabled: !!user && !!topic,
  });
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

  const isFavorited = topic ? favorites.some(f => f.reference_id === topic.id) : false;

  const handleToggleFavorite = async () => {
    if (!user) {
      toast.error('Please sign in to favorite topics', {
        action: {
          label: 'Sign In',
          onClick: () => navigate('/profile'),
        },
      });
      return;
    }

    try {
      if (isFavorited) {
        // Remove favorite
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('reference_id', topic!.id)
          .eq('favorite_type', 'topic');
        
        toast.success('Removed from favorites');
      } else {
        // Add favorite
        await supabase
          .from('favorites')
          .insert({
            user_id: user.id,
            favorite_type: 'topic',
            reference_id: topic!.id,
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
        const { error: uploadError, data } = await supabase.storage
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

  const handleSubmitReply = async () => {
    if (!user) {
      toast.error('Please sign in to reply', {
        action: {
          label: 'Sign In',
          onClick: () => navigate('/profile'),
        },
      });
      return;
    }

    if (!replyContent.trim() && uploadedImages.length === 0) {
      toast.error('Please enter a message or upload an image');
      return;
    }

    try {
      await supabase.from('forum_posts').insert({
        topic_id: topic!.id,
        user_id: user.id,
        content: replyContent,
        image_urls: uploadedImages.length > 0 ? uploadedImages : null,
      });

      setReplyContent('');
      setUploadedImages([]);
      refetchPosts();
      toast.success('Reply posted!');
    } catch (error) {
      console.error('Error posting reply:', error);
      toast.error('Failed to post reply');
    }
  };

  const handleUpvote = async () => {
    if (!user) {
      toast.error('Please sign in to upvote', {
        action: {
          label: 'Sign In',
          onClick: () => navigate('/profile'),
        },
      });
      return;
    }

    if (!topic) return;

    try {
      const { data, error } = await supabase.rpc('handle_topic_upvote', {
        p_topic_id: topic!.id,
        p_user_id: user.id,
      });

      if (error) throw error;

      if (data.action === 'added') {
        toast.success('Upvoted!');
      } else {
        toast.success('Upvote removed');
      }

      refetchTopic();
      queryClient.invalidateQueries({ queryKey: ['hasUpvoted', topic!.id, user.id] });
    } catch (error) {
      console.error('Error upvoting:', error);
      toast.error('Failed to upvote');
    }
  };

  const handleEditPost = (post: ForumPost) => {
    setEditingPostId(post.id);
    setEditPostContent(post.content);
    setEditPostImages(post.image_urls || []);
  };

  const handleUpdatePost = async () => {
    if (!editPostContent.trim() && editPostImages.length === 0) {
      toast.error('Please enter content or add an image');
      return;
    }

    try {
      await supabase
        .from('forum_posts')
        .update({
          content: editPostContent,
          image_urls: editPostImages.length > 0 ? editPostImages : null,
        })
        .eq('id', editingPostId!);

      toast.success('Post updated!');
      setEditingPostId(null);
      refetchPosts();
    } catch (error) {
      console.error('Error updating post:', error);
      toast.error('Failed to update post');
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('forum_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;
      toast.success('Post deleted');
      refetchPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    }
  };

  const handleEditPostImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        await awardPoints('add_attachment', `Added ${uploadedUrls.length} image(s)`);
      }

      setEditPostImages([...editPostImages, ...uploadedUrls]);
      toast.success(`${uploadedUrls.length} image(s) uploaded`);
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error('Failed to upload images');
    } finally {
      setIsUploading(false);
    }
  };

  const removeEditPostImage = (url: string) => {
    setEditPostImages(editPostImages.filter(img => img !== url));
  };

  if (!topic) {
    return (
      <Layout>
        <div className="p-6 text-center">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Back Button */}
        <button
          onClick={() => navigate('/hot-topics')}
          className="flex items-center gap-2 mb-6 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Topics</span>
        </button>

        {/* Topic Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center gap-2 mb-2">
            {topic.is_pinned && (
              <Pin className="w-4 h-4 text-teal fill-teal" />
            )}
            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
              {topic.category}
            </span>
            {topic.game && (
              <button
                onClick={() => navigate(`/games/${topic.game_id}`)}
                className="text-xs bg-teal/10 text-teal px-2 py-1 rounded hover:bg-teal/20"
              >
                {topic.game.state} - {topic.game.game_name}
              </button>
            )}
          </div>

          <h1 className="text-2xl font-bold mb-3">{topic.title}</h1>
          <p className="text-gray-700 mb-4 whitespace-pre-line">{topic.content}</p>

          {/* Topic Images */}
          {topic.image_urls && topic.image_urls.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
              {topic.image_urls.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Attachment ${idx + 1}`}
                  className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90"
                  onClick={() => window.open(url, '_blank')}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <button
                onClick={handleUpvote}
                className={`flex items-center gap-1 transition-colors ${
                  hasUpvoted ? 'text-teal font-semibold' : 'hover:text-teal'
                }`}
              >
                <ThumbsUp className={`w-4 h-4 ${hasUpvoted ? 'fill-teal' : ''}`} />
                <span>{topic.upvotes || 0}</span>
              </button>
              <span>{new Date(topic.created_at).toLocaleString()}</span>
              <div 
                className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold flex-shrink-0 text-xs"
                style={{ backgroundColor: userColors[topic.user_id] || '#14b8a6' }}
              >
                {getUserInitials(topic.user_id)}
              </div>
            </div>
            
            {/* Favorite Button */}
            <button
              onClick={handleToggleFavorite}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all hover:bg-gray-50"
              title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart
                className={`w-5 h-5 ${
                  isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-400'
                }`}
              />
              <span className="text-sm font-medium">
                {isFavorited ? 'Favorited' : 'Favorite'}
              </span>
            </button>
          </div>
        </div>

        {/* Posts */}
        <div className="space-y-4 mb-6">
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-lg shadow p-6">
              {editingPostId === post.id ? (
                /* Edit Mode */
                <div>
                  <textarea
                    value={editPostContent}
                    onChange={(e) => setEditPostContent(e.target.value)}
                    className="w-full border rounded-lg p-3 mb-3 min-h-[100px]"
                  />

                  {/* Image Upload */}
                  <div className="mb-4">
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-teal">
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        onChange={handleEditPostImageUpload}
                        className="hidden"
                        disabled={isUploading}
                      />
                      <ImageIcon className="w-5 h-5" />
                      <span>{isUploading ? 'Uploading...' : 'Add Images'}</span>
                    </label>

                    {/* Image Previews */}
                    {editPostImages.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {editPostImages.map((url, idx) => (
                          <div key={idx} className="relative group">
                            <img
                              src={url}
                              alt={`Upload ${idx + 1}`}
                              className="w-full h-24 object-cover rounded-lg"
                            />
                            <button
                              onClick={() => removeEditPostImage(url)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingPostId(null)}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdatePost}
                      className="px-4 py-2 gradient-teal text-white rounded-lg"
                    >
                      Update
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="flex-1">
                  {/* Header Row: User Circle + Date + Admin Actions */}
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold flex-shrink-0 text-xs"
                      style={{ backgroundColor: userColors[post.user_id] || '#14b8a6' }}
                    >
                      {getUserInitials(post.user_id)}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(post.created_at).toLocaleString()}
                    </span>
                    
                    {/* Edit/Delete Actions - Show for admins or post owner */}
                    {(isAdmin || post.user_id === user?.id) && (
                      <div className="flex gap-2 ml-auto flex-shrink-0">
                        <button
                          onClick={() => handleEditPost(post)}
                          className="p-2 hover:bg-gray-100 rounded"
                          title="Edit post"
                        >
                          <Pencil className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="p-2 hover:bg-red-100 rounded"
                          title="Delete post"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <p className="text-gray-700 mb-3 whitespace-pre-line">{post.content}</p>

                  {/* Post Images */}
                  {post.image_urls && post.image_urls.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                      {post.image_urls.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt={`Attachment ${idx + 1}`}
                          className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90"
                          onClick={() => window.open(url, '_blank')}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Reply Box */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-bold mb-4">Add a Reply</h3>
          
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Share your thoughts..."
            className="w-full border rounded-lg p-3 mb-3 min-h-[100px]"
          />

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

          <button
            onClick={handleSubmitReply}
            className="w-full gradient-teal text-white py-3 rounded-lg font-semibold hover:opacity-90 flex items-center justify-center gap-2"
          >
            <Send className="w-5 h-5" />
            Post Reply
          </button>
        </div>
      </div>
    </Layout>
  );
}
