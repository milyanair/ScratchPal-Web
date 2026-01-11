import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { AuthUser } from '@/types';
import type { User } from '@supabase/supabase-js';

function mapSupabaseUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email!,
    username: user.user_metadata?.username || user.user_metadata?.full_name || user.email!.split('@')[0],
    avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture,
  };
}

export function useAuth() {
  const { user, loading, login, logout, setLoading } = useAuthStore();

  useEffect(() => {
    let mounted = true;
    let tokenCheckInterval: NodeJS.Timeout | null = null;

    const processMobileTokens = async () => {
      const mobileTokens = (window as any).mobileAppTokens;
      
      if (mobileTokens?.access_token && mobileTokens?.refresh_token) {
        console.log('✅ MOBILE APP TOKENS DETECTED');
        console.log('   Access Token:', mobileTokens.access_token.substring(0, 20) + '...');
        console.log('   Refresh Token:', mobileTokens.refresh_token.substring(0, 20) + '...');
        console.log('   Setting session with injected tokens...');
        
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: mobileTokens.access_token,
            refresh_token: mobileTokens.refresh_token,
          });

          if (error) {
            console.error('❌ Failed to set session from mobile tokens:', error.message);
            return false;
          } else if (data.session?.user) {
            console.log('✅ Session set from mobile app tokens!');
            console.log('   User:', data.session.user.email);
            console.log('   User ID:', data.session.user.id);
            if (mounted) login(mapSupabaseUser(data.session.user));
            
            // Clear the tokens after use (one-time consumption)
            delete (window as any).mobileAppTokens;
            console.log('🗑️  Cleared mobile app tokens from window');
            return true;
          }
        } catch (error: any) {
          console.error('❌ Error setting session from mobile tokens:', error);
          return false;
        }
      }
      return false;
    };

    const initializeAuth = async () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔐 INITIALIZING AUTH');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Current URL:', window.location.href);
      console.log('Is WebView:', !!(window as any).ReactNativeWebView);

      // **HYBRID AUTH: Check for injected tokens from mobile app FIRST**
      const tokensProcessed = await processMobileTokens();
      
      if (tokensProcessed) {
        if (mounted) setLoading(false);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return;
      }

      // **POLLING: Check for late token injection (mobile app may inject after page load)**
      if ((window as any).ReactNativeWebView) {
        console.log('🔄 WebView detected - Starting token polling (5s max)...');
        console.log('   Checking for late token injection from mobile app...');
        
        let pollCount = 0;
        const maxPolls = 10; // 10 checks over 5 seconds
        
        tokenCheckInterval = setInterval(async () => {
          pollCount++;
          console.log(`   Poll attempt ${pollCount}/${maxPolls}...`);
          
          const foundTokens = await processMobileTokens();
          
          if (foundTokens) {
            console.log('✅ Tokens found via polling!');
            if (tokenCheckInterval) clearInterval(tokenCheckInterval);
            if (mounted) setLoading(false);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            return;
          }
          
          if (pollCount >= maxPolls) {
            console.log('⏱️  Polling timeout - no tokens injected');
            console.log('   Mobile app may not have authenticated yet');
            if (tokenCheckInterval) clearInterval(tokenCheckInterval);
            // Continue to fallback auth check
          }
        }, 500); // Check every 500ms
        
        // Wait a bit before falling back to session check
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // **FALLBACK: Check for existing session (OAuth flow or previous login)**
      console.log('📋 No mobile tokens found, checking for existing session...');
      
      // Supabase's detectSessionInUrl will automatically process OAuth callback URLs
      // This handles the PKCE code exchange automatically if we're on a callback URL
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('❌ Error getting session:', sessionError.message);
        if (mounted) setLoading(false);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return;
      }
      
      if (session?.user) {
        console.log('✅ Existing session found');
        console.log('   User:', session.user.email);
        console.log('   User ID:', session.user.id);
        if (mounted) login(mapSupabaseUser(session.user));
      } else {
        console.log('ℹ️  No existing session found');
        console.log('');
        console.log('⚠️  Authentication Required');
        if ((window as any).ReactNativeWebView) {
          console.log('');
          console.log('📱 IN WEBVIEW MODE - MOBILE APP INSTRUCTIONS:');
          console.log('   1. Authenticate user in React Native app');
          console.log('   2. Get session tokens from Supabase');
          console.log('   3. Inject into WebView:');
          console.log('      webView.injectJavaScript(`');
          console.log('        window.mobileAppTokens = {');
          console.log('          access_token: "YOUR_ACCESS_TOKEN",');
          console.log('          refresh_token: "YOUR_REFRESH_TOKEN"');
          console.log('        };');
          console.log('        window.location.reload();');
          console.log('      `);');
          console.log('');
          console.log('   See MOBILE_AUTH_INTEGRATION.md for full guide');
        }
      }
      
      if (mounted) setLoading(false);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        console.log('🔄 Auth state changed:', event);
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('   User signed in:', session.user.email);
          login(mapSupabaseUser(session.user));
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          console.log('   User signed out');
          logout();
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('   Token refreshed for:', session.user.email);
          login(mapSupabaseUser(session.user));
        }
      }
    );

    return () => {
      mounted = false;
      if (tokenCheckInterval) clearInterval(tokenCheckInterval);
      subscription.unsubscribe();
    };
  }, [login, logout, setLoading]);

  return { user, loading, login, logout };
}
