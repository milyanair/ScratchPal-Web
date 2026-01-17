import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { UserPreference } from '@/types';
import { useState, useEffect } from 'react';
import { usePoints } from '@/hooks/usePoints';
import { Trophy, Bell, ScanLine, User } from 'lucide-react';
import { haptics } from '@/lib/haptics';

export function Header() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { totalPoints } = usePoints();
  const [anonymousState, setAnonymousState] = useState<string>(() => {
    return localStorage.getItem('selected_state') || '?';
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [showStateMenu, setShowStateMenu] = useState(false);

  // Get unread notifications count
  const { data: notifications = [], refetch: refetchNotifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: showNotifications ? 5000 : false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 30000,
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  // Listen for localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      setAnonymousState(localStorage.getItem('selected_state') || '?');
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

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
      return data as UserPreference | null;
    },
    enabled: !!user,
  });

  // Get user role from user_profiles
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

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
      refetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user!.id)
        .eq('read', false);
      refetchNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationClick = (notification: any) => {
    handleMarkAsRead(notification.id);
    setShowNotifications(false);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <header className="sticky top-0 z-50 h-[55px] gradient-teal shadow-header grid grid-cols-3 items-center px-4">
      {/* Left: Empty */}
      <div className="flex justify-start">
      </div>

      {/* Center: Coin Icon + Logo */}
      <div className="flex items-center justify-center">
        {isAdmin ? (
          <Link to="/admin" className="w-[56px] h-[56px] flex-shrink-0">
            <img
              src="https://cdn-ai.onspace.ai/onspace/files/YeHsi5H6A5dXrzEn4A8wxN/scratchpalcoin100.png"
              alt="Admin"
              className="w-full h-full object-contain"
            />
          </Link>
        ) : (
          <div className="w-[56px] h-[56px] flex-shrink-0">
            <img
              src="https://cdn-ai.onspace.ai/onspace/files/YeHsi5H6A5dXrzEn4A8wxN/scratchpalcoin100.png"
              alt="ScratchPal"
              className="w-full h-full object-contain"
            />
          </div>
        )}
        <Link to="/" onClick={() => haptics.light()} className="flex items-center">
          <img
            src="https://cdn-ai.onspace.ai/onspace/files/WAxFVTfN6nCgFibtQQ2pbW/scratchpaloldlogo.png"
            alt="ScratchPal"
            className="h-[56px] object-contain"
          />
        </Link>
      </div>

      {/* Right: Scan, Notifications, Points & State */}
      <div className="flex items-center justify-end gap-2">
        {/* Ticket Scanner - Available to All */}
        <Link
          to="/scan-tickets"
          onClick={() => haptics.light()}
          className="p-2 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 transition-all"
          title="Scan Tickets"
        >
          <ScanLine className="w-5 h-5 text-white" />
        </Link>
        {/* Notification Bell - Desktop Only */}
        {user && (
          <div className="relative hidden md:block">
            <button
              onClick={() => {
                haptics.light();
                setShowNotifications(!showNotifications);
              }}
              className="relative p-2 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 transition-all"
            >
              <Bell className="w-5 h-5 text-white" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-lg shadow-xl z-50">
                  <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
                    <h3 className="font-bold">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAllAsRead();
                        }}
                        className="text-xs text-teal hover:underline"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      No notifications yet
                    </div>
                  ) : (
                    <div className="divide-y">
                      {notifications.map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                            !notification.read ? 'bg-teal/5' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                !notification.read ? 'bg-teal' : 'bg-gray-300'
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm mb-1">
                                {notification.title}
                              </div>
                              <div className="text-xs text-gray-600 mb-1">
                                {notification.message}
                              </div>
                              <div className="text-xs text-gray-400">
                                {new Date(notification.created_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {/* Points Display - Desktop Only */}
        {user && totalPoints > 0 && (
          <button
            onClick={() => {
              haptics.light();
              navigate('/favorites');
            }}
            className="hidden md:flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 transition-all"
          >
            <Trophy className="w-4 h-4 text-yellow-300" />
            <span className="text-white font-bold text-sm">{totalPoints.toLocaleString()}</span>
          </button>
        )}

        {/* State Circle */}
        <div className="relative">
          <button
            onClick={() => {
              haptics.light();
              if (user) {
                // Mobile: Show dropdown menu
                if (window.innerWidth < 768) {
                  setShowStateMenu(!showStateMenu);
                } else {
                  // Desktop: Navigate to profile
                  navigate('/profile');
                }
              } else {
                navigate('/select-state');
              }
            }}
            className={`w-[38px] h-[38px] rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 transition-all ${
              user ? 'ring-2 ring-white' : ''
            }`}
            style={{ 
              background: 'radial-gradient(circle, rgba(77, 208, 225, 0.2) 0%, rgba(77, 208, 225, 0.2) 100%)',
              backdropFilter: 'blur(8px)'
            }}
          >
            {user ? (userPref?.selected_state || '?') : anonymousState}
          </button>

          {/* State Circle Menu - Mobile Only */}
          {user && showStateMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowStateMenu(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl z-50 overflow-hidden md:hidden">
                {/* Notifications */}
                <button
                  onClick={() => {
                    setShowStateMenu(false);
                    setShowNotifications(!showNotifications);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b relative"
                >
                  <Bell className="w-5 h-5 text-gray-700" />
                  <span className="font-semibold text-gray-800">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Points */}
                {totalPoints > 0 && (
                  <button
                    onClick={() => {
                      setShowStateMenu(false);
                      navigate('/favorites');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b"
                  >
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    <span className="font-semibold text-gray-800">Points</span>
                    <span className="ml-auto text-teal font-bold">{totalPoints.toLocaleString()}</span>
                  </button>
                )}

                {/* My Profile */}
                <button
                  onClick={() => {
                    setShowStateMenu(false);
                    navigate('/profile');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <User className="w-5 h-5 text-gray-700" />
                  <span className="font-semibold text-gray-800">My Profile</span>
                </button>
              </div>

              {/* Notification Dropdown - Mobile */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-lg shadow-xl z-50">
                  <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
                    <h3 className="font-bold">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAllAsRead();
                        }}
                        className="text-xs text-teal hover:underline"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      No notifications yet
                    </div>
                  ) : (
                    <div className="divide-y">
                      {notifications.map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => {
                            handleNotificationClick(notification);
                            setShowStateMenu(false);
                          }}
                          className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                            !notification.read ? 'bg-teal/5' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                !notification.read ? 'bg-teal' : 'bg-gray-300'
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm mb-1">
                                {notification.title}
                              </div>
                              <div className="text-xs text-gray-600 mb-1">
                                {notification.message}
                              </div>
                              <div className="text-xs text-gray-400">
                                {new Date(notification.created_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
