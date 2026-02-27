
import { Layout } from '@/components/layout/Layout';
import { PullToRefresh } from '@/components/PullToRefresh';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ForumTopic } from '@/types';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Search, Plus, Pin, ThumbsUp, MessageSquare, Flag, Ban, X, Image as ImageIcon, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useUserColors } from '@/hooks/useUserColor';
import { slugifyCategory } from '@/lib/utils';
import { usePoints } from '@/hooks/usePoints';

const categories = [
  'All',
  'General',
  'Game Talk',
  'Tips & Tricks',
  'Q&A',
  'Ask Us',
  'Report a Problem',
];

export function HotTopics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTopicId, setReportTopicId] = useState<string>('');
  const [reportReason, setReportReason] = useState('');
  const [reportOtherReason, setReportOtherReason] = useState('');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockUserId, setBlockUserId] = useState<string>('');
  const [blockReason, setBlockReason] = useState('');
  
  // New Topic Modal states
  const [showNewTopicModal, setShowNewTopicModal] = useState(false);
  const [newTopicCategory, setNewTopicCategory] = useState('General');
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicContent, setNewTopicContent] = useState('');
  const [newTopicImages, setNewTopicImages] = useState<string[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isSubmittingTopic, setIsSubmittingTopic] = useState(false);
  const { awardPoints } = usePoints();

  // Fetch blocked users
  const { data: blockedUsers = [] } = useQuery({
    queryKey: ['blockedUsers', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id);
      
      if (error) throw error;
      return data.map(b => b.blocked_id);
    },
    enabled: !!user,
  });

  // Fetch user's reported content
  const { data: reportedContent = [] } = useQuery({
    queryKey: ['reportedContent', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('content_reports')
        .select('content_type, content_id')
        .eq('reporter_id', user.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: topics = [], refetch } = useQuery({
    queryKey: ['forumTopics', selectedCategory],
    queryFn: async () => {
      let query = supabase
        .from('forum_topics')
        .select('*, game:games(*)');

      if (selectedCategory !== 'All') {
        query = query.eq('category', selectedCategory);
      }

      query = query.order('is_pinned', { ascending: false });
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data as ForumTopic[];
    },
  });

  // Filter out blocked users' topics and reported topics
  const filteredTopics = topics.filter(topic => {
    const isBlocked = blockedUsers.includes(topic.user_id);
    const isReported = reportedContent.some(
      r => r.content_type === 'topic' && r.content_id === topic.id
    );
    const matchesSearch = searchTerm === '' || 
      topic.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      topic.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    return !isBlocked && !isReported && matchesSearch;
  });

  // Get all unique user IDs from topics
  const topicUserIds = topics.map(t => t.user_id);
  const { data: userColors = {} } = useUserColors(topicUserIds);

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    console.log('🔄 Pull to refresh triggered');
    await refetch();
  };

  const getUserInitials = (userId: string) => {
    return userId.substring(0, 2).toUpperCase();
  };

  // Report topic
  const handleOpenReportModal = (topicId: string) => {
    if (!user) {
      toast.error('Please sign in to report content');
      return;
    }
    setReportTopicId(topicId);
    setReportReason('');
    setReportOtherReason('');
    setShowReportModal(true);
  };

  const handleSubmitReport = async () => {
    if (!user) return;
    
    const finalReason = reportReason === 'other' ? reportOtherReason : reportReason;
    
    if (!finalReason) {
      toast.error('Please select or enter a reason');
      return;
    }

    try {
      await supabase.from('content_reports').insert({
        reporter_id: user.id,
        content_type: 'topic',
        content_id: reportTopicId,
        reason: finalReason,
      });

      toast.success('Content reported. Thank you for helping keep our community safe.');
      setShowReportModal(false);
      
      // Refetch to hide the content immediately
      queryClient.invalidateQueries({ queryKey: ['reportedContent', user.id] });
    } catch (error) {
      console.error('Error reporting content:', error);
      toast.error('Failed to report content');
    }
  };

  // Block user
  const handleOpenBlockModal = (userId: string) => {
    if (!user) {
      toast.error('Please sign in to block users');
      return;
    }
    setBlockUserId(userId);
    setBlockReason('');
    setShowBlockModal(true);
  };

  const handleBlockUser = async () => {
    if (!user) return;

    try {
      await supabase.from('blocked_users').insert({
        blocker_id: user.id,
        blocked_id: blockUserId,
        reason: blockReason || null,
      });

      toast.success('User blocked. Their content is now hidden from your view.');
      setShowBlockModal(false);
      
      // Refetch to hide blocked user's content
      queryClient.invalidateQueries({ queryKey: ['blockedUsers', user.id] });
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Failed to block user');
    }
  };

  const reportReasons = [
    'Hate Speech',
    'Harassment',
    'Spam',
    'Sexual Content',
    'Violence',
    'Illegal Content',
    'Misinformation',
    'Self-Harm',
    'Other'
  ];

  // Handle image upload for new topic
  const handleNewTopicImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!user) {
      toast.error('Please sign in to upload images');
      return;
    }

    setIsUploadingImages(true);

    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (file.size > 10485760) {
          toast.error(`${file.name} is too large. Max size is 10MB.`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}_${Date.now()}_${i}.${fileExt}`;
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

      if (uploadedUrls.length > 0) {
        await awardPoints('add_attachment', `Added ${uploadedUrls.length} image(s)`);
      }

      setNewTopicImages([...newTopicImages, ...uploadedUrls]);
      toast.success(`${uploadedUrls.length} image(s) uploaded`);
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error('Failed to upload images');
    } finally {
      setIsUploadingImages(false);
    }
  };

  const removeNewTopicImage = (url: string) => {
    setNewTopicImages(newTopicImages.filter(img => img !== url));
  };

  // Submit new topic
  const handleSubmitNewTopic = async () => {
    if (!user) {
      toast.error('Please sign in to create topics');
      return;
    }

    if (!newTopicTitle.trim() || !newTopicContent.trim()) {
      toast.error('Please fill in title and content');
      return;
    }

    setIsSubmittingTopic(true);
    try {
      const { error } = await supabase.from('forum_topics').insert({
        user_id: user.id,
        category: newTopicCategory,
        title: newTopicTitle,
        content: newTopicContent,
        image_urls: newTopicImages.length > 0 ? newTopicImages : null,
      });

      if (error) throw error;

      toast.success('Topic created!');
      
      // Reset form
      setShowNewTopicModal(false);
      setNewTopicCategory('General');
      setNewTopicTitle('');
      setNewTopicContent('');
      setNewTopicImages([]);
      
      // Refresh topics
      refetch();
    } catch (error) {
      console.error('Error creating topic:', error);
      toast.error('Failed to create topic');
    } finally {
      setIsSubmittingTopic(false);
    }
  };

  return (
    <Layout>
      {/* New Topic Modal - Rendered at top level */}
      {showNewTopicModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999] overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8 relative z-[10000]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Create New Topic</h2>
              <button
                onClick={() => setShowNewTopicModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category Selection */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Category</label>
              <select
                value={newTopicCategory}
                onChange={(e) => setNewTopicCategory(e.target.value)}
                className="w-full border rounded-lg p-3"
              >
                {categories.filter(c => c !== 'All').map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Title</label>
              <input
                type="text"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder="What's your topic about?"
                className="w-full border rounded-lg p-3"
                maxLength={200}
              />
            </div>

            {/* Content */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Content</label>
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
                  onChange={handleNewTopicImageUpload}
                  className="hidden"
                  disabled={isUploadingImages}
                />
                <ImageIcon className="w-5 h-5" />
                <span>{isUploadingImages ? 'Uploading...' : 'Add Images (Optional)'}</span>
              </label>

              {newTopicImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {newTopicImages.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={url}
                        alt={`Upload ${idx + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removeNewTopicImage(url)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewTopicModal(false)}
                className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50"
                disabled={isSubmittingTopic}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitNewTopic}
                className="flex-1 px-4 py-3 gradient-hot text-white rounded-lg hover:opacity-90 flex items-center justify-center gap-2"
                disabled={isSubmittingTopic || !newTopicTitle.trim() || !newTopicContent.trim()}
              >
                {isSubmittingTopic ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Posting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>Post Topic</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <PullToRefresh onRefresh={handleRefresh}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold">Hot Topics</h1>
                <p className="text-gray-600">
                  Join the conversation about your favorite scratch-off games
                </p>
              </div>
              {user && (
                <button
                  onClick={() => setShowNewTopicModal(true)}
                  className="gradient-hot text-white w-14 h-14 rounded-full font-semibold hover:opacity-90 flex items-center justify-center shadow-lg p-0 flex-shrink-0"
                  title="Create New Topic"
                >
                  <Plus className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search topics..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                    selectedCategory === category
                      ? 'gradient-hot text-white'
                      : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Topics List */}
          <div className="space-y-4">
            {filteredTopics.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg">
                <p className="text-gray-500 mb-4">
                  {searchTerm ? 'No topics found matching your search' : 'No topics yet in this category'}
                </p>
                {user && (
                  <button
                    onClick={() => navigate('/hot-topics/new')}
                    className="gradient-hot text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90"
                  >
                    Start a Conversation
                  </button>
                )}
              </div>
            ) : (
              filteredTopics.map((topic) => (
                <div
                  key={topic.id}
                  className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
                >
                  <div className="flex flex-col">
                    {/* User Circle, Date, and Action Buttons Row */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-12 h-12 rounded-full text-white flex items-center justify-center font-bold flex-shrink-0"
                          style={{ backgroundColor: userColors[topic.user_id] || '#14b8a6' }}
                        >
                          {getUserInitials(topic.user_id)}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(topic.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      {user && topic.user_id !== user.id && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenReportModal(topic.id);
                            }}
                            className="p-2 hover:bg-orange-100 rounded-lg transition-colors"
                            title="Report topic"
                          >
                            <Flag className="w-5 h-5 text-orange-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenBlockModal(topic.user_id);
                            }}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                            title="Block user"
                          >
                            <Ban className="w-5 h-5 text-red-600" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Content - starts from left under circle */}
                    <div 
                      onClick={() => {
                        if (topic.slug) {
                          navigate(`/topic/${slugifyCategory(topic.category)}/${topic.slug}`);
                        } else {
                          navigate(`/topic/${topic.id}`);
                        }
                      }}
                    >
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {topic.is_pinned && (
                          <Pin className="w-4 h-4 text-teal fill-teal" />
                        )}
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {topic.category}
                        </span>
                        {topic.game && (
                          <span className="text-xs bg-teal/10 text-teal px-2 py-1 rounded">
                            {topic.game.state} - {topic.game.game_name}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="text-lg font-bold mb-2 line-clamp-2">
                        {topic.title}
                      </h3>

                      {/* Content Preview */}
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                        {topic.content}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="w-4 h-4" />
                          {topic.upvotes || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-4 h-4" />
                          View Discussion
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Report Modal */}
        {showReportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-xl font-bold mb-4">Report Content</h2>
              <p className="text-sm text-gray-600 mb-4">
                Help us keep ScratchPal safe. Select the reason for reporting this topic.
              </p>
              
              <div className="space-y-2 mb-4">
                {reportReasons.map((reason) => (
                  <label key={reason} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="radio"
                      name="reportReason"
                      value={reason.toLowerCase().replace(' ', '_')}
                      checked={reportReason === reason.toLowerCase().replace(' ', '_')}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{reason}</span>
                  </label>
                ))}
              </div>

              {reportReason === 'other' && (
                <textarea
                  value={reportOtherReason}
                  onChange={(e) => setReportOtherReason(e.target.value)}
                  placeholder="Please describe the issue..."
                  className="w-full border rounded-lg p-3 mb-4 min-h-[80px] text-sm"
                />
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitReport}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Submit Report
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Block User Modal */}
        {showBlockModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-xl font-bold mb-4">Block User</h2>
              <p className="text-sm text-gray-600 mb-4">
                Blocking this user will hide all their content from your view and notify our moderators.
              </p>
              
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Reason for blocking (optional)..."
                className="w-full border rounded-lg p-3 mb-4 min-h-[80px] text-sm"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowBlockModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBlockUser}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Block User
                </button>
              </div>
            </div>
          </div>
        )}

      </PullToRefresh>
    </Layout>
  );
}
