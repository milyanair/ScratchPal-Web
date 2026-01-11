import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';
import { isWebView, logWebViewInfo } from './utils';

/**
 * Handle OAuth callback from deep link (for WebView apps)
 * Call this when your app receives a scratchpal://oauth/callback URL
 * 
 * @example
 * // In your WebView deep link handler:
 * if (url.startsWith('scratchpal://oauth/callback')) {
 *   await handleOAuthCallback(url);
 * }
 */
export const handleOAuthCallback = async (callbackUrl: string): Promise<void> => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔗 OAUTH CALLBACK RECEIVED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Callback URL:', callbackUrl);
  
  try {
    // Extract tokens from URL hash
    const url = new URL(callbackUrl);
    const hash = url.hash.substring(1); // Remove leading #
    const params = new URLSearchParams(hash);
    
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    const expires_in = params.get('expires_in');
    const token_type = params.get('token_type');
    
    console.log('📦 Extracted Tokens:');
    console.log('  Access Token:', access_token ? `${access_token.substring(0, 20)}...` : 'MISSING');
    console.log('  Refresh Token:', refresh_token ? `${refresh_token.substring(0, 20)}...` : 'MISSING');
    console.log('  Expires In:', expires_in || 'MISSING');
    console.log('  Token Type:', token_type || 'MISSING');
    
    if (!access_token || !refresh_token) {
      throw new Error('Missing tokens in OAuth callback URL');
    }
    
    console.log('✅ Setting Supabase session...');
    
    // Set the session with the tokens
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    
    if (error) {
      console.error('❌ Failed to set session:', error.message);
      throw error;
    }
    
    console.log('✅ Session set successfully!');
    console.log('User:', data.user?.email || 'N/A');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ OAUTH CALLBACK FAILED');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Error:', error.message);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    throw error;
  }
};

export const signInWithGoogle = async () => {
  // Log webview detection info for debugging
  logWebViewInfo();
  
  const inWebView = isWebView();
  
  // Store current path for redirect after OAuth (browser only)
  // WebView will navigate directly to app, not back to web
  if (!inWebView) {
    localStorage.setItem('oauth_return_path', window.location.pathname);
    console.log('💾 Stored return path:', window.location.pathname);
    // DO NOT set WebView signal for browser - let Supabase auto-handle callback
    localStorage.removeItem('oauth_from_webview');
  }
  
  // Set WebView signal flag for callback page (only for WebView)
  if (inWebView) {
    localStorage.setItem('oauth_from_webview', 'true');
    console.log('🏷️ Set WebView signal flag');
  }
  
  // Determine the correct redirect URL based on environment
  // For WebView: Use deep link (scratchpal://) to return to app
  // For Web: Use /oauth/callback to handle the callback
  const redirectTo = inWebView 
    ? 'scratchpal://oauth/callback'
    : `${window.location.origin}/oauth/callback`;
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 GOOGLE OAUTH FLOW STARTING');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Environment:', inWebView ? 'WebView' : 'Standard Browser');
  console.log('Redirect URL:', redirectTo);
  console.log('Current URL:', window.location.href);
  
  if (inWebView) {
    console.log('');
    console.log('📱 WEBVIEW MODE - EXPECTED FLOW:');
    console.log('  1️⃣ OAuth opens in system browser');
    console.log('  2️⃣ User signs in with Google');
    console.log('  3️⃣ Google redirects to: scratchpal://oauth/callback#access_token=...');
    console.log('  4️⃣ WebView app MUST intercept this deep link');
    console.log('  5️⃣ Extract tokens from URL hash');
    console.log('  6️⃣ Call supabase.auth.setSession() with tokens');
    console.log('');
    console.log('⚠️ CRITICAL CONFIGURATION REQUIRED:');
    console.log('  ✓ Deep link registered: scratchpal://');
    console.log('  ✓ Redirect URL in Auth Settings: scratchpal://oauth/callback');
    console.log('  ✓ WebView configured to intercept scratchpal:// URLs');
    console.log('');
  } else {
    console.log('');
    console.log('🌐 BROWSER MODE - EXPECTED FLOW:');
    console.log('  1️⃣ OAuth redirects to Google');
    console.log('  2️⃣ User signs in');
    console.log('  3️⃣ Google redirects to: /oauth/callback?code=XXX');
    console.log('  4️⃣ Supabase auto-detects callback and exchanges code');
    console.log('  5️⃣ onAuthStateChange fires with new session');
    console.log('  6️⃣ User is redirected to original page');
    console.log('');
  }
  
  console.log('🚀 Initiating OAuth redirect...');
  
  if (!inWebView) {
    console.log('🔄 After OAuth completes, will redirect to:', localStorage.getItem('oauth_return_path') || '/');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { 
        access_type: 'offline', 
        prompt: 'consent' 
      },
      // Always use redirect-based OAuth (skipBrowserRedirect: false)
      // This forces OAuth to open in system browser on webviews
      skipBrowserRedirect: false,
    }
  });
  
  if (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ GOOGLE LOGIN FAILED');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Error:', error.message);
    console.error('Code:', error.code || 'N/A');
    
    if (inWebView) {
      console.error('');
      console.error('⚠️ WebView Troubleshooting:');
      console.error('  1. Verify deep link is registered in app manifest');
      console.error('  2. Check OnSpace Cloud Auth Settings has redirect URL');
      console.error('  3. Ensure WebView can open external URLs');
      console.error('  4. Confirm deep link handler is implemented');
    }
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    throw error;
  }
};

export const signOut = async () => {
  console.log('👋 Signing out...');
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('❌ Sign out failed:', error.message);
    throw error;
  }
  console.log('✅ Signed out successfully');
};

// Email Authentication Functions
export const sendOtp = async (email: string): Promise<void> => {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
};

export const verifyOtpAndSetPassword = async (
  email: string,
  token: string,
  password: string,
  username?: string
): Promise<User> => {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) throw error;

  const usernameToSet = username || email.split('@')[0];
  const { data: updateData, error: updateError } = await supabase.auth.updateUser({
    password,
    data: { username: usernameToSet },
  });
  if (updateError) throw updateError;

  if (!updateData.user) throw new Error('User update failed');
  return updateData.user;
};

export const signInWithPassword = async (
  email: string,
  password: string
): Promise<User> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  if (!data.user) throw new Error('Login failed');
  return data.user;
};
