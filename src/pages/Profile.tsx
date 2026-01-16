import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { signInWithGoogle, signOut, sendOtp, verifyOtpAndSetPassword, signInWithPassword } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { StateConfig } from '@/types';
import { useState, useEffect } from 'react';
import { Share2, Copy, Users, Bell, BellOff, Palette, Code, ChevronDown, ChevronUp, Key } from 'lucide-react';
import { isWebView, getWebViewType } from '@/lib/utils';

type AuthMode = 'login' | 'signup' | 'verify';

export function Profile() {
  const { user, login: setAuthUser } = useAuth();
  const navigate = useNavigate();
  const [showStateSelector, setShowStateSelector] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstallPWA, setCanInstallPWA] = useState(false);

  // WebView detection info
  const webViewDetected = isWebView();
  const webViewType = getWebViewType();
  const userAgent = navigator.userAgent;

  // Predefined color palette
  const colorOptions = [
    { name: 'Teal', value: '#14b8a6' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Cyan', value: '#06b6d4' },
    { name: 'Lime', value: '#84cc16' },
    { name: 'Rose', value: '#f43f5e' },
  ];

  // Auth form state
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Get notification preferences
  const { data: notificationPrefs, refetch: refetchPrefs } = useQuery({
    queryKey: ['notificationPreferences', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleUpdateNotificationPref = async (field: string, value: boolean) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert(
          {
            user_id: user.id,
            [field]: value,
          },
          {
            onConflict: 'user_id'
          }
        );

      if (error) throw error;

      toast.success('Notification preferences updated');
      refetchPrefs();
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      toast.error('Failed to update preferences');
    }
  };

  const { data: userPref, refetch } = useQuery({
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

  // Get user profile color
  const { data: userProfileData, refetch: refetchProfile } = useQuery({
    queryKey: ['userProfileColor', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_profiles')
        .select('profile_color')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const profileColor = userProfileData?.profile_color || '#14b8a6';

  // Fetch states that have games and their icons from state_config
  const { data: availableStates = [] } = useQuery({
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

  // Get user's referral code
  const { data: referralCode } = useQuery({
    queryKey: ['referralCode', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.rpc('generate_referral_code', {
        p_user_id: user.id,
      });
      if (error) throw error;
      return data as string;
    },
    enabled: !!user,
  });

  // Listen for PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstallPWA(true);
      console.log('PWA install prompt captured');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Get referral stats
  const { data: referralStats } = useQuery({
    queryKey: ['referralStats', user?.id],
    queryFn: async () => {
      if (!user) return { visits: 0, signups: 0 };
      const { data, error } = await supabase
        .from('referrals')
        .select('is_signup')
        .eq('referrer_id', user.id);
      
      if (error) throw error;
      
      const visits = data.filter(r => !r.is_signup).length;
      const signups = data.filter(r => r.is_signup).length;
      
      return { visits, signups };
    },
    enabled: !!user,
  });

  const handleAddToHomeScreen = async () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    if (isIOS) {
      // iOS requires manual steps - show instructions
      toast.info('Tap the Share button, then "Add to Home Screen"', { duration: 5000 });
    } else if (canInstallPWA && deferredPrompt) {
      // Android/Desktop PWA install
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          toast.success('App installed successfully!');
        }
        
        setDeferredPrompt(null);
        setCanInstallPWA(false);
      } catch (error) {
        console.error('Install error:', error);
        toast.error('Installation cancelled or failed');
      }
    } else {
      // Fallback - open web app in new tab
      toast.info('Opening web app...', { duration: 2000 });
      window.open('https://play.scratchpal.com', '_blank');
    }
  };

  const handleGoogleLogin = async () => {
    // If WebView is detected and user is not logged in, show "Coming Soon" modal
    if (webViewDetected && !user) {
      setShowComingSoonModal(true);
      return;
    }
    
    try {
      await signInWithGoogle();
    } catch (error: any) {
      toast.error('Login failed');
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      const user = await signInWithPassword(email, password);
      const authUser = {
        id: user.id,
        email: user.email!,
        username: user.user_metadata?.username || user.email!.split('@')[0],
        avatar: user.user_metadata?.avatar_url,
      };
      setAuthUser(authUser);
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
      setIsLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    setIsLoading(true);
    try {
      await sendOtp(email);
      toast.success('Verification code sent to your email!');
      setAuthMode('verify');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndRegister = async () => {
    if (!email || !otp || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const user = await verifyOtpAndSetPassword(email, otp, password, username || undefined);
      const authUser = {
        id: user.id,
        email: user.email!,
        username: user.user_metadata?.username || user.email!.split('@')[0],
        avatar: user.user_metadata?.avatar_url,
      };
      setAuthUser(authUser);
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Registration failed');
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out');
      navigate('/');
    } catch (error) {
      toast.error('Sign out failed');
    }
  };

  const handleStateChange = async (stateCode: string) => {
    if (!user) return;

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
        console.error('Error changing state:', error);
        throw error;
      }

      toast.success(`State changed to ${stateCode}`);
      setShowStateSelector(false);
      refetch();
    } catch (error: any) {
      console.error('Error changing state:', error);
      toast.error(error.message || 'Failed to change state');
    }
  };

  const handleColorChange = async (color: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ profile_color: color })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Profile color updated!');
      setShowColorPicker(false);
      refetchProfile();
    } catch (error: any) {
      console.error('Error changing color:', error);
      toast.error(error.message || 'Failed to change color');
    }
  };

  const handleCopyCode = () => {
    if (!referralCode) return;
    
    const referralUrl = `${window.location.origin}?ref=${referralCode}`;
    navigator.clipboard.writeText(referralUrl);
    setCopiedCode(true);
    toast.success('Referral link copied!');
    
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShare = (platform: 'whatsapp' | 'sms' | 'email') => {
    if (!referralCode) return;
    
    const referralUrl = `${window.location.origin}?ref=${referralCode}`;
    const message = `Join me on ScratchPal - the ultimate scratch-off lottery community! Use my link: ${referralUrl}`;
    
    let shareUrl = '';
    
    if (platform === 'whatsapp') {
      shareUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    } else if (platform === 'sms') {
      shareUrl = `sms:?body=${encodeURIComponent(message)}`;
    } else if (platform === 'email') {
      shareUrl = `mailto:?subject=${encodeURIComponent('Join ScratchPal!')}&body=${encodeURIComponent(message)}`;
    }
    
    window.open(shareUrl, '_blank');
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-6">My Profile</h1>

        {!user ? (
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-2xl font-bold mb-6 text-center">
              {authMode === 'login' ? 'Sign In' : authMode === 'signup' ? 'Create Account' : 'Verify Email'}
            </h2>

            {/* Login Mode */}
            {authMode === 'login' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full border rounded-lg px-4 py-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border rounded-lg px-4 py-3"
                  />
                </div>
                <button
                  onClick={handleEmailLogin}
                  disabled={isLoading}
                  className="w-full gradient-teal text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or continue with</span>
                  </div>
                </div>

                <button
                  onClick={handleGoogleLogin}
                  className="w-full bg-white border-2 border-gray-300 rounded-lg px-6 py-3 flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span className="font-semibold">Sign in with Google</span>
                </button>

                <div className="text-center mt-4">
                  <button
                    onClick={() => {
                      setAuthMode('signup');
                      setPassword('');
                      setOtp('');
                    }}
                    className="text-teal hover:underline font-medium"
                  >
                    Don't have an account? Sign up
                  </button>
                </div>

                {/* 🐝 Debug Toggle - Bottom of Login */}
                <div className="mt-8 pt-6 border-t">
                  <div className="flex justify-center">
                    <button
                      onClick={() => setShowDebugPanel(!showDebugPanel)}
                      className="text-2xl hover:scale-110 transition-transform"
                      title="Toggle Debug Info"
                    >
                      🐝
                    </button>
                  </div>

                  {showDebugPanel && (
                    <div className="bg-gray-50 rounded-lg border mt-4 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Code className="w-5 h-5 text-gray-600" />
                        <span className="font-semibold text-sm">WebView Debug Info</span>
                        {webViewDetected && (
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
                            WebView
                          </span>
                        )}
                      </div>
                      <div className="space-y-3 text-sm">
                        {/* Original Google Sign-In Button for Testing */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <h4 className="font-semibold text-blue-800 text-xs mb-2">🧪 Test OAuth Login</h4>
                          <button
                            onClick={async () => {
                              try {
                                await signInWithGoogle();
                              } catch (error: any) {
                                console.error('OAuth test failed:', error);
                                toast.error('OAuth test failed');
                              }
                            }}
                            className="w-full bg-white border-2 border-gray-300 rounded-lg px-3 py-2 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                              <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              />
                              <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              />
                              <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                              />
                              <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                              />
                            </svg>
                            <span className="font-semibold text-sm">Sign in with Google</span>
                          </button>
                          <p className="text-[10px] text-blue-600 mt-2 text-center">
                            Test original OAuth functionality
                          </p>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Status</div>
                          <div className={webViewDetected ? 'text-orange-600' : 'text-green-600'}>
                            {webViewDetected ? '✓ WebView Detected' : '✓ Standard Browser'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Type</div>
                          <div className="font-mono text-xs bg-white px-2 py-1 rounded border">
                            {webViewType}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-600 uppercase mb-1">User Agent</div>
                          <div className="font-mono text-[10px] bg-white px-2 py-1 rounded border break-all">
                            {userAgent}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Signup Mode - Step 1: Send OTP */}
            {authMode === 'signup' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full border rounded-lg px-4 py-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Username (Optional)</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username"
                    className="w-full border rounded-lg px-4 py-3"
                  />
                </div>
                <button
                  onClick={handleSendOtp}
                  disabled={isLoading}
                  className="w-full gradient-teal text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {isLoading ? 'Sending...' : 'Send Verification Code'}
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or continue with</span>
                  </div>
                </div>

                <button
                  onClick={handleGoogleLogin}
                  className="w-full bg-white border-2 border-gray-300 rounded-lg px-6 py-3 flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span className="font-semibold">Sign up with Google</span>
                </button>

                <div className="text-center mt-4">
                  <button
                    onClick={() => {
                      setAuthMode('login');
                      setPassword('');
                      setOtp('');
                    }}
                    className="text-teal hover:underline font-medium"
                  >
                    Already have an account? Sign in
                  </button>
                </div>

                {/* 🐝 Debug Toggle - Bottom of Signup */}
                <div className="mt-8 pt-6 border-t">
                  <div className="flex justify-center">
                    <button
                      onClick={() => setShowDebugPanel(!showDebugPanel)}
                      className="text-2xl hover:scale-110 transition-transform"
                      title="Toggle Debug Info"
                    >
                      🐝
                    </button>
                  </div>

                  {showDebugPanel && (
                    <div className="bg-gray-50 rounded-lg border mt-4 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Code className="w-5 h-5 text-gray-600" />
                        <span className="font-semibold text-sm">WebView Debug Info</span>
                        {webViewDetected && (
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
                            WebView
                          </span>
                        )}
                      </div>
                      <div className="space-y-3 text-sm">
                        {/* Original Google Sign-In Button for Testing */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <h4 className="font-semibold text-blue-800 text-xs mb-2">🧪 Test OAuth Login</h4>
                          <button
                            onClick={async () => {
                              try {
                                await signInWithGoogle();
                              } catch (error: any) {
                                console.error('OAuth test failed:', error);
                                toast.error('OAuth test failed');
                              }
                            }}
                            className="w-full bg-white border-2 border-gray-300 rounded-lg px-3 py-2 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                              <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              />
                              <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              />
                              <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                              />
                              <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                              />
                            </svg>
                            <span className="font-semibold text-sm">Sign in with Google</span>
                          </button>
                          <p className="text-[10px] text-blue-600 mt-2 text-center">
                            Test original OAuth functionality
                          </p>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Status</div>
                          <div className={webViewDetected ? 'text-orange-600' : 'text-green-600'}>
                            {webViewDetected ? '✓ WebView Detected' : '✓ Standard Browser'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Type</div>
                          <div className="font-mono text-xs bg-white px-2 py-1 rounded border">
                            {webViewType}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-600 uppercase mb-1">User Agent</div>
                          <div className="font-mono text-[10px] bg-white px-2 py-1 rounded border break-all">
                            {userAgent}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Verify Mode - Step 2: Verify OTP & Set Password */}
            {authMode === 'verify' && (
              <div className="space-y-4">
                <div className="bg-teal/10 border border-teal rounded-lg p-4 mb-4">
                  <p className="text-sm text-teal-800">
                    We sent a verification code to <strong>{email}</strong>
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Verification Code</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter 4-digit code"
                    maxLength={4}
                    className="w-full border rounded-lg px-4 py-3 text-center text-2xl tracking-widest"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Create Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose a password (min 6 characters)"
                    className="w-full border rounded-lg px-4 py-3"
                  />
                </div>
                <button
                  onClick={handleVerifyAndRegister}
                  disabled={isLoading}
                  className="w-full gradient-teal text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {isLoading ? 'Verifying...' : 'Complete Registration'}
                </button>

                <div className="text-center mt-4">
                  <button
                    onClick={() => {
                      setAuthMode('signup');
                      setOtp('');
                      setPassword('');
                    }}
                    className="text-teal hover:underline font-medium text-sm"
                  >
                    ← Back to signup
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* User Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-4 mb-4">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className="w-16 h-16 rounded-full"
                  />
                ) : (
                  <div 
                    className="w-16 h-16 rounded-full text-white flex items-center justify-center text-2xl font-bold"
                    style={{ backgroundColor: profileColor }}
                  >
                    {user.username.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{user.username}</h2>
                  <p className="text-gray-600">{user.email}</p>
                </div>
                <button
                  onClick={() => setShowColorPicker(true)}
                  className="flex items-center gap-2 px-4 py-2 border-2 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Change profile color"
                >
                  <Palette className="w-5 h-5" style={{ color: profileColor }} />
                  <span className="text-sm font-medium">Color</span>
                </button>
              </div>
            </div>

            {/* Selected State */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold">Selected State</h3>
                  <p className="text-2xl font-bold text-teal mt-2">
                    {userPref?.selected_state || 'Not selected'}
                  </p>
                </div>
                <button
                  onClick={() => setShowStateSelector(true)}
                  className="gradient-teal text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90"
                >
                  Change State
                </button>
              </div>
            </div>

            {/* Refer a Friend */}
            <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-6 h-6" />
                <h3 className="text-xl font-bold">Refer a Friend</h3>
              </div>
              <p className="mb-4 opacity-90 text-sm">
                Share your referral link and earn points when friends join!
              </p>
              
              {referralCode && (
                <>
                  {/* Referral Code Display */}
                  <div className="bg-white/20 backdrop-blur rounded-lg p-4 mb-4">
                    <div className="text-xs opacity-80 mb-1">Your Referral Code</div>
                    <div className="font-mono font-bold text-lg mb-3">{referralCode}</div>
                    
                    <button
                      onClick={handleCopyCode}
                      className="w-full bg-white text-yellow-600 px-4 py-2 rounded-lg font-semibold hover:bg-yellow-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {copiedCode ? (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-5 h-5" />
                          Copy Referral Link
                        </>
                      )}
                    </button>
                  </div>

                  {/* Share Buttons */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <button
                      onClick={() => handleShare('whatsapp')}
                      className="bg-white/20 backdrop-blur hover:bg-white/30 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                    >
                      WhatsApp
                    </button>
                    <button
                      onClick={() => handleShare('sms')}
                      className="bg-white/20 backdrop-blur hover:bg-white/30 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                    >
                      SMS
                    </button>
                    <button
                      onClick={() => handleShare('email')}
                      className="bg-white/20 backdrop-blur hover:bg-white/30 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                    >
                      Email
                    </button>
                  </div>

                  {/* Referral Stats */}
                  {referralStats && (
                    <div className="bg-white/20 backdrop-blur rounded-lg p-3">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold">{referralStats.visits}</div>
                          <div className="text-xs opacity-80">Visits</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{referralStats.signups}</div>
                          <div className="text-xs opacity-80">Friends Joined</div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Support Message */}
            <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg shadow p-6 border-2 border-teal-100">
              <div className="text-center">
                <p className="text-gray-700 leading-relaxed mb-3">
                  We hope you're having fun and winning big! If you'd like to help us keep the lights on and the new features coming, you can support us on our{' '}
                  <button
                    onClick={() => navigate('/donate')}
                    className="text-teal font-bold hover:underline"
                  >
                    Donate page
                  </button>
                </p>
                <button
                  onClick={() => navigate('/donate')}
                  className="inline-block gradient-teal text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
                >
                  💖 Support ScratchPal
                </button>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-3 mb-4">
                <Bell className="w-6 h-6 text-teal" />
                <h3 className="text-lg font-bold">Notification Preferences</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Manage how you receive notifications from ScratchPal
              </p>

              <div className="space-y-4">
                {/* Announcements */}
                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <div className="font-medium">Announcements</div>
                    <div className="text-sm text-gray-500">Important updates from ScratchPal</div>
                  </div>
                  <button
                    onClick={() => handleUpdateNotificationPref('announcements_enabled', !(notificationPrefs?.announcements_enabled ?? true))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      (notificationPrefs?.announcements_enabled ?? true) ? 'bg-teal' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        (notificationPrefs?.announcements_enabled ?? true) ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Topic Replies */}
                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <div className="font-medium">Topic Replies</div>
                    <div className="text-sm text-gray-500">When someone replies to your topics</div>
                  </div>
                  <button
                    onClick={() => handleUpdateNotificationPref('topic_replies_enabled', !(notificationPrefs?.topic_replies_enabled ?? true))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      (notificationPrefs?.topic_replies_enabled ?? true) ? 'bg-teal' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        (notificationPrefs?.topic_replies_enabled ?? true) ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Favorite Replies */}
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">Favorite Topic Replies</div>
                    <div className="text-sm text-gray-500">When someone replies to topics you favorited</div>
                  </div>
                  <button
                    onClick={() => handleUpdateNotificationPref('favorite_replies_enabled', !(notificationPrefs?.favorite_replies_enabled ?? true))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      (notificationPrefs?.favorite_replies_enabled ?? true) ? 'bg-teal' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        (notificationPrefs?.favorite_replies_enabled ?? true) ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="w-full bg-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-600 transition-colors"
            >
              Sign Out
            </button>

            {/* 🐝 Debug Toggle - Bottom of Logged-in Profile */}
            <div className="mt-8 pt-6 border-t">
              <div className="flex justify-center">
                <button
                  onClick={() => setShowDebugPanel(!showDebugPanel)}
                  className="text-2xl hover:scale-110 transition-transform"
                  title="Toggle Debug Info"
                >
                  🐝
                </button>
              </div>

              {showDebugPanel && (
                <div className="bg-gray-50 rounded-lg border mt-4 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Code className="w-5 h-5 text-gray-600" />
                    <span className="font-semibold text-sm">WebView Debug Info</span>
                    {webViewDetected && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
                        WebView
                      </span>
                    )}
                  </div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Status</div>
                      <div className={webViewDetected ? 'text-orange-600' : 'text-green-600'}>
                        {webViewDetected ? '✓ WebView Detected - Google OAuth will open in system browser' : '✓ Standard Browser - Google OAuth works normally'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Type</div>
                      <div className="font-mono text-xs bg-white px-2 py-1 rounded border">
                        {webViewType}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-600 uppercase mb-1">User Agent</div>
                      <div className="font-mono text-[10px] bg-white px-2 py-1 rounded border break-all">
                        {userAgent}
                      </div>
                    </div>
                    
                    {/* Test Deep Link Button */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mt-3">
                      <h4 className="font-semibold text-purple-800 text-xs mb-2 flex items-center gap-2">
                        <Key className="w-3 h-3" />
                        Deep Link Test
                      </h4>
                      <p className="text-[10px] text-purple-700 mb-2">
                        Test if your app can handle the OAuth deep link:
                      </p>
                      <button
                        onClick={() => {
                          console.log('🔑 Testing deep link redirect to: scratchpal://');
                          console.log('📱 If configured correctly, this should open the app');
                          window.location.href = 'scratchpal://';
                        }}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                      >
                        <Key className="w-3 h-3" />
                        Test Deep Link
                      </button>
                      <p className="text-[10px] text-purple-600 mt-1 text-center">
                        ✅ App opens = configured<br/>
                        ❌ Nothing = missing setup
                      </p>
                    </div>

                    {webViewDetected && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <h4 className="font-semibold text-orange-800 text-xs mb-2">⚠️ WebView OAuth Flow</h4>
                        <ul className="text-[10px] text-orange-700 space-y-1">
                          <li>✓ Google OAuth opens in system browser</li>
                          <li>✓ Redirects to: <code className="bg-orange-100 px-1 rounded">scratchpal://oauth/callback</code></li>
                          <li>✓ App must intercept deep link</li>
                          <li>✓ Extract tokens and set session</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* State Selector Modal */}
        {showStateSelector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6">
              <h2 className="text-2xl font-bold mb-6">Select State</h2>
              {availableStates.length === 0 ? (
                <div className="text-center py-12 mb-6">
                  <p className="text-gray-500">No states available yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  {availableStates.map((state) => (
                    <button
                      key={state.state_code}
                      onClick={() => handleStateChange(state.state_code)}
                      className={`p-6 rounded-lg border-2 transition-colors ${
                        userPref?.selected_state === state.state_code
                          ? 'border-teal bg-teal/5'
                          : 'border-gray-200 hover:border-teal'
                      }`}
                    >
                      <div className="text-4xl mb-2">{state.emoji}</div>
                      <div className="font-bold">{state.state_code}</div>
                      <div className="text-sm text-gray-600">{state.state_name}</div>
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowStateSelector(false)}
                className="w-full px-6 py-3 border rounded-lg font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Color Picker Modal */}
        {showColorPicker && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-4">Select Profile Color</h2>
              <p className="text-sm text-gray-600 mb-6">
                Choose a color for your anonymous identifier circle
              </p>
              <div className="grid grid-cols-4 gap-3 mb-6">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => handleColorChange(color.value)}
                    className={`relative p-4 rounded-lg border-2 transition-all hover:scale-105 ${
                      profileColor === color.value
                        ? 'border-gray-800 ring-2 ring-offset-2 ring-gray-800'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  >
                    {profileColor === color.value && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowColorPicker(false)}
                className="w-full px-6 py-3 border rounded-lg font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Coming Soon Modal for WebView Google OAuth */}
        {showComingSoonModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              {/* Header with Coin Icon and Title */}
              <div className="flex items-center gap-4 mb-4">
                <img 
                  src="https://cdn-ai.onspace.ai/onspace/files/8iZMsD2CHxsGawePToLNxE/scratchpalcoin100.png" 
                  alt="ScratchPal Coin" 
                  className="w-16 h-16 flex-shrink-0"
                />
                <h2 className="text-2xl font-bold text-teal">Coming Soon</h2>
              </div>
              
              <p className="text-gray-700 mb-6 leading-relaxed">
                We are working diligently to bring secure authentication with Google to our Android and iOS app. In the interim you can enjoy Sign-In with Google via our web app at{' '}
                <a href="https://play.scratchpal.com" className="text-teal font-semibold hover:underline" target="_blank" rel="noopener noreferrer">
                  https://play.scratchpal.com
                </a>
              </p>

              <p className="font-semibold text-gray-800 mb-4">Please choose one of the following options:</p>

              {/* Option 1: Open Web App */}
              <div className="bg-teal/5 border-2 border-teal rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl font-bold text-teal">1)</div>
                  <div className="flex-1">
                    <button
                      onClick={() => {
                        handleAddToHomeScreen();
                        setShowComingSoonModal(false);
                      }}
                      className="text-teal font-bold hover:underline text-left"
                    >
                      Click to open the Web App, then click Install when prompted to save it as a button.
                    </button>
                  </div>
                </div>
              </div>

              {/* OR Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500 font-semibold">OR</span>
                </div>
              </div>

              {/* Option 2: Register via Email */}
              <div className="bg-purple-50 border-2 border-purple-400 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="text-2xl font-bold text-purple-600">2)</div>
                  <div className="flex-1">
                    <p className="text-gray-700">
                      <button
                        onClick={() => {
                          setShowComingSoonModal(false);
                          setAuthMode('signup');
                        }}
                        className="text-purple-600 font-bold hover:underline"
                      >
                        Click here
                      </button>{' '}
                      to Register and Login to the app via traditional email.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <p className="text-center text-gray-600 mb-4">
                Thank you for your patience. ✨
              </p>

              {/* Close Button */}
              <button
                onClick={() => setShowComingSoonModal(false)}
                className="w-full px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
