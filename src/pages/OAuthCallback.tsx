import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

/**
 * OAuth Callback Handler Page
 * 
 * This page handles OAuth callbacks from deep links.
 * The WebView app should navigate here after receiving a deep link.
 * 
 * Example flow:
 * 1. OAuth completes in browser
 * 2. Google redirects to: scratchpal://oauth/callback#access_token=XXX&refresh_token=YYY
 * 3. WebView app intercepts this URL
 * 4. WebView app navigates to: /oauth/callback?access_token=XXX&refresh_token=YYY
 *    (or uses the global window.handleOAuthTokens function)
 * 5. This page extracts tokens and sets the session
 */
export function OAuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔗 OAUTH CALLBACK PAGE LOADED');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Current URL:', window.location.href);
      console.log('Hash:', window.location.hash);
      console.log('Search:', window.location.search);

      try {
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');
        const isWebView = !!(window as any).ReactNativeWebView;
        const hasWebViewSignal = localStorage.getItem('oauth_from_webview') === 'true';

        console.log('📍 Environment:');
        console.log('  Is WebView:', isWebView);
        console.log('  Has WebView Signal:', hasWebViewSignal);
        console.log('  OAuth Code:', code ? `${code.substring(0, 20)}...` : 'MISSING');

        // **CASE 1: Authorization Code from WebView flow**
        // Browser opened from WebView - store code and show "Return to App" message
        // WebView will retrieve code and exchange it with PKCE verifier
        if (code && hasWebViewSignal) {
          console.log('🔄 AUTHORIZATION CODE DETECTED FROM WEBVIEW FLOW');
          console.log('   Storing code in localStorage for WebView retrieval...');
          console.log('   Code:', code.substring(0, 20) + '...');

          // **CRITICAL: Store as JSON object with timestamp**
          // WebView expects { code: string, timestamp: number }
          localStorage.setItem('oauth_code', JSON.stringify({
            code: code,
            timestamp: Date.now()
          }));
          
          console.log('✅ Code stored in localStorage');
          console.log('   Format: JSON { code, timestamp }');
          console.log('   Timestamp:', new Date().toISOString());
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📱 RETURN TO THE APP NOW');
          console.log('   WebView will detect the code and complete authentication');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          
          // Clear the signal
          localStorage.removeItem('oauth_from_webview');
          
          setStatus('success');
          return; // Show "Return to App" UI
        }

        // **CASE 2: Authorization Code from native browser OAuth**
        // User initiated OAuth from regular browser - let Supabase auto-detect and handle it
        // DO NOT manually exchange code here, as PKCE verifier may be in different storage context
        if (code && !hasWebViewSignal) {
          console.log('🌐 AUTHORIZATION CODE DETECTED FROM BROWSER OAUTH');
          console.log('   Letting Supabase auto-detect session (detectSessionInUrl: true)...');
          console.log('   Code:', code.substring(0, 20) + '...');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📋 Supabase will automatically:');
          console.log('   1. Detect OAuth callback URL');
          console.log('   2. Exchange code with PKCE verifier from storage');
          console.log('   3. Trigger onAuthStateChange event');
          console.log('   4. Auth state will update automatically');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

          // Show loading state while Supabase processes
          setStatus('processing');
          
          // Wait for auth state to update
          // The onAuthStateChange listener in useAuth hook will handle the session
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Get redirect destination
          const returnPath = localStorage.getItem('oauth_return_path') || '/';
          localStorage.removeItem('oauth_return_path');

          console.log('🔄 Redirecting to:', returnPath);

          // Redirect to original page
          // Auth state will be updated by onAuthStateChange
          navigate(returnPath, { replace: true });
          return;
        }

        // **CASE 3: Token Flow (Direct tokens from WebView or hash)**
        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        // Check hash fragment first (standard OAuth)
        if (window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          accessToken = hashParams.get('access_token');
          refreshToken = hashParams.get('refresh_token');
          
          console.log('📦 Tokens from hash:');
          console.log('  Access Token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'MISSING');
          console.log('  Refresh Token:', refreshToken ? `${refreshToken.substring(0, 20)}...` : 'MISSING');
        }

        // Check query params as fallback (if WebView passed them this way)
        if (!accessToken || !refreshToken) {
          accessToken = searchParams.get('access_token');
          refreshToken = searchParams.get('refresh_token');
          
          console.log('📦 Tokens from query params:');
          console.log('  Access Token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'MISSING');
          console.log('  Refresh Token:', refreshToken ? `${refreshToken.substring(0, 20)}...` : 'MISSING');
        }

        if (!accessToken || !refreshToken) {
          throw new Error('Missing authentication tokens in callback URL');
        }

        console.log('✅ Tokens found! Setting Supabase session...');

        // Set the session with the tokens
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          console.error('❌ Failed to set session:', sessionError.message);
          throw sessionError;
        }

        if (!data.user) {
          throw new Error('No user data returned from session');
        }

        console.log('✅ Session set successfully!');
        console.log('User:', data.user.email);

        // Update auth store
        const authUser = {
          id: data.user.id,
          email: data.user.email!,
          username: data.user.user_metadata?.username || data.user.email!.split('@')[0],
          avatar: data.user.user_metadata?.avatar_url,
        };

        login(authUser);

        console.log('✅ Auth store updated!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        setStatus('success');
        toast.success('Successfully signed in!');

        // Redirect to home after a short delay
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1500);

      } catch (err: any) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ OAUTH CALLBACK FAILED');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('Error:', err.message);
        console.error('Stack:', err.stack);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        setStatus('error');
        setError(err.message);
        toast.error('Authentication failed');

        // Redirect to profile/login after error
        setTimeout(() => {
          navigate('/profile', { replace: true });
        }, 3000);
      }
    };

    handleCallback();
  }, [navigate, login]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full text-center">
        {status === 'processing' && (
          <>
            <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Completing Sign In...</h2>
            <p className="text-gray-600">Processing your authentication</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Login Successful!</h2>
            <p className="text-gray-600 mb-6">Please return to the Scratchpal app to complete sign in</p>
            
            <div className="bg-teal-50 border-2 border-teal-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-teal-800 font-medium mb-2">📱 Next Steps:</p>
              <ol className="text-xs text-teal-700 text-left space-y-1 ml-4 list-decimal">
                <li>Switch back to the Scratchpal app</li>
                <li>The app will automatically detect and complete your login</li>
                <li>You'll be signed in within a few seconds</li>
              </ol>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => {
                  // Try to close the browser window/tab
                  window.close();
                  // Show instruction since close might not work in mobile browsers
                  setTimeout(() => {
                    toast.info('Please switch to the Scratchpal app from your recent apps', {
                      duration: 5000,
                    });
                  }, 100);
                }}
                className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
              >
                ✓ Got It - Close This Page
              </button>
              
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800 font-semibold mb-1">⚠️ Important:</p>
                <p className="text-xs text-yellow-700">
                  Use your device's app switcher (Recent Apps) to return to Scratchpal. 
                  The app will automatically detect your login.
                </p>
              </div>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Authentication Failed</h2>
            <p className="text-gray-600 text-sm mb-4">{error || 'An error occurred during sign in'}</p>
            <p className="text-gray-500 text-xs">Redirecting to login page...</p>
          </>
        )}

        <div className="mt-6 pt-6 border-t">
          <p className="text-xs text-gray-400">
            Check browser console for detailed logs
          </p>
        </div>
      </div>
    </div>
  );
}
