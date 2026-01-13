import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { usePoints } from '@/hooks/usePoints';
import { Confetti } from '@/components/Confetti';
import { PointsBadge } from '@/components/PointsBadge';
import { Loading } from '@/components/Loading';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { isWebView } from '@/lib/utils';

// **CRITICAL: Define global functions for WebView OAuth integration**
// These functions enable HYBRID AUTHENTICATION:
//   - Mobile App: Injects tokens directly via window.mobileAppTokens
//   - Browser: Uses OAuth callback flow
//
// MOBILE APP AUTHENTICATION FLOW:
// 1. User logs in natively in React Native app (Supabase auth)
// 2. Mobile app gets access_token and refresh_token
// 3. Mobile app injects tokens into WebView:
//    webView.injectJavaScript(`
//      window.mobileAppTokens = {
//        access_token: '${session.access_token}',
//        refresh_token: '${session.refresh_token}'
//      };
//    `);
// 4. Web app detects tokens on initialization (useAuth hook)
// 5. Web app sets session with tokens and user is authenticated
//
// BROWSER OAUTH FLOW (FALLBACK):
// 1. User clicks "Sign in with Google" button
// 2. Browser redirects to Google OAuth
// 3. Google redirects to /oauth/callback?code=XXX
// 4. Code stored in localStorage
// 5. WebView retrieves code via window.getStoredOAuthCode()
// 6. WebView exchanges code for tokens using PKCE verifier
// 7. WebView calls window.handleOAuthTokens(access, refresh)
// 8. Web app sets session and user is authenticated
//
if (typeof window !== 'undefined') {
  // Function 1: Retrieve stored OAuth code from localStorage
  (window as any).getStoredOAuthCode = function() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 WEBVIEW CALLING getStoredOAuthCode()');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const stored = localStorage.getItem('oauth_code');

    if (!stored) {
      console.log('❌ No code found in localStorage');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return null;
    }

    try {
      const data = JSON.parse(stored);
      const age = Date.now() - parseInt(data.timestamp);

      console.log(`✅ Found stored code!`);
      console.log(`   Code: ${data.code.substring(0, 20)}...`);
      console.log(`   Age: ${Math.floor(age / 1000)} seconds`);

      // Code expires after 60 seconds
      if (age > 60000) {
        console.log('❌ Code expired (>60 seconds)');
        localStorage.removeItem('oauth_code');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return null;
      }

      // Clear code after retrieval (one-time use)
      console.log('🗑️  Clearing from storage (one-time use)...');
      localStorage.removeItem('oauth_code');

      console.log('✅ Returning code to WebView');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      return data;
    } catch (error) {
      console.error('❌ Error parsing stored code:', error);
      localStorage.removeItem('oauth_code');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return null;
    }
  };

  // Function 2: Handle OAuth tokens from WebView
  (window as any).handleOAuthTokens = async function(access_token: string, refresh_token: string) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 WEBVIEW CALLING handleOAuthTokens()');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Access Token:', access_token?.substring(0, 20) + '...');
    console.log('   Refresh Token:', refresh_token?.substring(0, 20) + '...');

    try {
      // Set the session with provided tokens
      const { data, error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) {
        console.error('❌ Session set failed:', error.message);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        throw error;
      }

      if (data.session) {
        console.log('✅ Session set successfully!');
        console.log(`   User: ${data.session.user.email}`);
        console.log('🔄 Reloading to update auth state...');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Reload to trigger auth state update
        window.location.href = '/';
      }
    } catch (error: any) {
      console.error('❌ Token handling error:', error?.message || error);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      throw error;
    }
  };

  console.log('✅ WebView OAuth functions registered globally');
  console.log('   - window.getStoredOAuthCode() - Retrieve OAuth code from browser');
  console.log('   - window.handleOAuthTokens(access, refresh) - Set session from mobile tokens');
  console.log('');
  console.log('🔐 HYBRID AUTH ENABLED:');
  console.log('   - Mobile App: Inject tokens via window.mobileAppTokens');
  console.log('   - Browser: Use OAuth callback flow');
}

// Pages
import { StateSelection } from '@/pages/StateSelection';
import { Games } from '@/pages/Games';
import { GameDetail } from '@/pages/GameDetail';
import { HotTopics } from '@/pages/HotTopics';
import { TopicDetail } from '@/pages/TopicDetail';
import { Favorites } from '@/pages/Favorites';
import { ReportWins } from '@/pages/ReportWins';
import { Profile } from '@/pages/Profile';
import { Admin } from '@/pages/Admin';
import { ScanTickets } from '@/pages/ScanTickets';
import { Donate } from '@/pages/Donate';
import { OAuthCallback } from '@/pages/OAuthCallback';
import { Sitemap } from '@/pages/Sitemap';
import { PrivacyPolicy } from '@/pages/PrivacyPolicy';
import { TermsOfService } from '@/pages/TermsOfService';
import { DeleteAccount } from '@/pages/DeleteAccount';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { showConfetti, clearConfetti, pointsBadge, clearBadge, awardPoints, pendingFanfare } = usePoints();
  const [showingFanfare, setShowingFanfare] = useState(false);
  const [fanfareQueue, setFanfareQueue] = useState<Array<{ points: number; displayName: string }>>([]);
  const [currentFanfareIndex, setCurrentFanfareIndex] = useState(0);
  const [hasTrackedLogin, setHasTrackedLogin] = useState(false);
  const [hasProcessedReferral, setHasProcessedReferral] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Track navigation state for loading animation
  useEffect(() => {
    setIsNavigating(true);
    const timer = setTimeout(() => {
      setIsNavigating(false);
    }, 300); // Short delay to show loading for quick navigations
    
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // **CRITICAL: Detect OAuth code parameter and redirect to callback page**
  // This handles the case where Supabase redirects to root domain with ?code=...
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const code = urlParams.get('code');
    
    // If we have a code parameter but we're NOT on the callback page
    if (code && location.pathname !== '/oauth/callback') {
      console.log('🔄 OAuth code detected on non-callback page, redirecting...');
      console.log('   Current path:', location.pathname);
      console.log('   Code:', code.substring(0, 20) + '...');
      
      // Redirect to the callback page with the code
      window.location.href = `/oauth/callback${location.search}`;
    }
  }, [location]);

  // Handle referral code from URL
  useEffect(() => {
    if (hasProcessedReferral) return;

    const urlParams = new URLSearchParams(location.search);
    const refCode = urlParams.get('ref');
    
    if (refCode) {
      localStorage.setItem('referral_code', refCode);
      setHasProcessedReferral(true);

      // Track referral visit (anonymous)
      if (!user) {
        supabase.rpc('track_referral_visit', { p_referral_code: refCode }).catch(console.error);
      }
    }
  }, [location.search, user, hasProcessedReferral]);

  // Handle login points and pending fanfare
  useEffect(() => {
    if (!user || hasTrackedLogin) return;

    const trackLoginAndFanfare = async () => {
      try {
        // Award login points (function handles daily limit)
        await awardPoints('login', 'Daily login');

        // Check for referral signup (only once per user)
        const refCode = localStorage.getItem('referral_code');
        if (refCode) {
          const { data: existingReferral } = await supabase
            .from('referrals')
            .select('id')
            .eq('referred_user_id', user.id)
            .eq('is_signup', true)
            .maybeSingle();

          if (!existingReferral) {
            // Track signup referral
            await supabase.rpc('track_referral_signup', {
              p_referred_user_id: user.id,
              p_referral_code: refCode,
            });
            localStorage.removeItem('referral_code');
          }
        }

        // Show pending fanfare
        if (pendingFanfare && pendingFanfare.length > 0) {
          setFanfareQueue(pendingFanfare.map(f => ({ points: f.points_earned, displayName: f.display_name })));
          setShowingFanfare(true);
        }

        setHasTrackedLogin(true);
      } catch (error) {
        console.error('Error tracking login:', error);
      }
    };

    trackLoginAndFanfare();
  }, [user, hasTrackedLogin, awardPoints, pendingFanfare]);

  // Show fanfare queue
  useEffect(() => {
    if (!showingFanfare || fanfareQueue.length === 0) return;

    if (currentFanfareIndex >= fanfareQueue.length) {
      setShowingFanfare(false);
      setCurrentFanfareIndex(0);
      setFanfareQueue([]);
      return;
    }

    const timer = setTimeout(() => {
      setCurrentFanfareIndex(prev => prev + 1);
    }, 3500); // Show each badge for 3.5s

    return () => clearTimeout(timer);
  }, [showingFanfare, fanfareQueue, currentFanfareIndex]);

  // Show loading for initial auth check
  if (loading) {
    return <Loading />;
  }

  return (
    <>
      {/* Show loading animation during navigation */}
      {isNavigating && <Loading />}
      
      <Routes>
        <Route path="/select-state" element={<StateSelection />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="/" element={<Games />} />
        <Route path="/games/:state/:price/:slug" element={<GameDetail />} />
        <Route path="/games/:id" element={<GameDetail />} /> {/* Backwards compatibility */}
        <Route path="/hot-topics" element={<HotTopics />} />
        <Route path="/topic/:category/:slug" element={<TopicDetail />} />
        <Route path="/topic/:category" element={<TopicDetail />} /> {/* Backwards compatibility */}
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/report-wins" element={<ReportWins />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/scan-tickets" element={<ScanTickets />} />
        <Route path="/donate" element={<Donate />} />
        <Route path="/sitemap" element={<Sitemap />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/delete-account" element={<DeleteAccount />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global Points Effects */}
      <Confetti trigger={showConfetti} onComplete={clearConfetti} intensity="high" />
      {pointsBadge && (
        <PointsBadge
          points={pointsBadge.points}
          displayName={pointsBadge.displayName}
          onComplete={clearBadge}
        />
      )}
      {/* Pending Fanfare Queue */}
      {showingFanfare && fanfareQueue[currentFanfareIndex] && (
        <PointsBadge
          points={fanfareQueue[currentFanfareIndex].points}
          displayName={fanfareQueue[currentFanfareIndex].displayName}
          onComplete={() => {}}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
