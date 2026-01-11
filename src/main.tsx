import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { supabase } from './lib/supabase';
import { handleOAuthCallback } from './lib/auth';

/**
 * Global OAuth handler for WebView deep link integration
 * 
 * WebView apps should call this function when receiving OAuth callback deep links.
 * This allows the native app to pass tokens to the web app via JavaScript bridge.
 * 
 * @example WebView Integration:
 * ```kotlin
 * // Android WebView - Intercept deep link URLs
 * override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
 *   if (url.startsWith("scratchpal://oauth/callback")) {
 *     // Extract tokens from URL
 *     val uri = Uri.parse(url)
 *     val fragment = uri.fragment ?: ""
 *     val params = parseFragment(fragment)
 *     val accessToken = params["access_token"]
 *     val refreshToken = params["refresh_token"]
 *     
 *     // Call global handler
 *     view.evaluateJavascript(
 *       "window.handleOAuthTokens('$accessToken', '$refreshToken')",
 *       null
 *     )
 *     return true // Prevent navigation
 *   }
 *   return false
 * }
 * ```
 * 
 * @example Alternative: Navigate to callback page
 * ```kotlin
 * if (url.startsWith("scratchpal://oauth/callback")) {
 *   val uri = Uri.parse(url)
 *   val fragment = uri.fragment ?: ""
 *   // Navigate to web app's callback page with tokens in query params
 *   view.loadUrl("https://yourapp.com/oauth/callback?$fragment")
 *   return true
 * }
 * ```
 */
(window as any).handleOAuthTokens = async (accessToken: string, refreshToken: string) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 GLOBAL OAUTH HANDLER CALLED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Called from: WebView JavaScript Bridge');
  console.log('Access Token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'MISSING');
  console.log('Refresh Token:', refreshToken ? `${refreshToken.substring(0, 20)}...` : 'MISSING');

  try {
    if (!accessToken || !refreshToken) {
      throw new Error('Missing tokens');
    }

    console.log('✅ Setting Supabase session...');

    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error('❌ Failed to set session:', error.message);
      throw error;
    }

    console.log('✅ Session set successfully!');
    console.log('User:', data.user?.email || 'N/A');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Reload to update auth state
    window.location.href = '/';
  } catch (error: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ GLOBAL OAUTH HANDLER FAILED');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Error:', error.message);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    alert(`Authentication failed: ${error.message}`);
  }
};

/**
 * Get stored OAuth code from localStorage
 * 
 * WebView apps should call this when returning from browser OAuth:
 * 1. Browser stores code in localStorage
 * 2. WebView calls this function to retrieve the code
 * 3. WebView exchanges code for tokens using Supabase
 * 4. WebView calls handleOAuthTokens() with the tokens
 * 
 * @returns { code: string, timestamp: number } | null
 * @example
 * ```kotlin
 * // Android: Check for stored code when app regains focus
 * override fun onResume() {
 *   super.onResume()
 *   webView.evaluateJavascript(
 *     "window.getStoredOAuthCode()",
 *     { result ->
 *       if (result != "null") {
 *         val code = parseCodeFromJSON(result)
 *         exchangeCodeForTokens(code)
 *       }
 *     }
 *   )
 * }
 * ```
 */
(window as any).getStoredOAuthCode = () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 CHECKING FOR STORED OAUTH CODE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const code = localStorage.getItem('oauth_code');
  const timestamp = localStorage.getItem('oauth_code_timestamp');

  if (!code || !timestamp) {
    console.log('❌ No stored code found');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return null;
  }

  // Check if code is expired (older than 10 minutes)
  const age = Date.now() - parseInt(timestamp);
  const maxAge = 10 * 60 * 1000; // 10 minutes

  if (age > maxAge) {
    console.log('❌ Code expired (older than 10 minutes)');
    console.log('   Age:', Math.floor(age / 1000), 'seconds');
    localStorage.removeItem('oauth_code');
    localStorage.removeItem('oauth_code_timestamp');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return null;
  }

  console.log('✅ Found valid code!');
  console.log('   Code:', code.substring(0, 20) + '...');
  console.log('   Age:', Math.floor(age / 1000), 'seconds');
  console.log('   Clearing from storage...');

  // Clear the stored code (one-time use)
  localStorage.removeItem('oauth_code');
  localStorage.removeItem('oauth_code_timestamp');

  console.log('✅ Returning code to WebView');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return {
    code,
    timestamp: parseInt(timestamp),
  };
};

console.log('✅ Global OAuth handlers registered:');
console.log('   - window.handleOAuthTokens(accessToken, refreshToken)');
console.log('   - window.getStoredOAuthCode()');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

/**
 * WEBVIEW INTEGRATION GUIDE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * This app supports two methods for handling OAuth callbacks in WebView:
 * 
 * METHOD 1: JavaScript Bridge (Recommended)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * When your WebView receives a deep link like:
 *   scratchpal://oauth/callback#access_token=XXX&refresh_token=YYY
 * 
 * 1. Intercept the URL in your native code
 * 2. Extract the tokens from the URL fragment
 * 3. Call the global JavaScript function:
 *    ```
 *    webView.evaluateJavascript(
 *      "window.handleOAuthTokens('XXX', 'YYY')",
 *      null
 *    )
 *    ```
 * 
 * METHOD 2: Navigate to Callback Page
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * When your WebView receives the deep link:
 * 
 * 1. Extract the URL fragment
 * 2. Navigate to: /oauth/callback with the tokens:
 *    ```
 *    webView.loadUrl(
 *      "https://yourapp.com/oauth/callback?access_token=XXX&refresh_token=YYY"
 *    )
 *    ```
 *    OR preserve the hash:
 *    ```
 *    webView.loadUrl(
 *      "https://yourapp.com/oauth/callback#access_token=XXX&refresh_token=YYY"
 *    )
 *    ```
 * 
 * IMPORTANT CONFIGURATION
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 1. Register deep link in AndroidManifest.xml:
 *    ```xml
 *    <intent-filter>
 *      <action android:name="android.intent.action.VIEW" />
 *      <category android:name="android.intent.category.DEFAULT" />
 *      <category android:name="android.intent.category.BROWSABLE" />
 *      <data android:scheme="scratchpal" />
 *    </intent-filter>
 *    ```
 * 
 * 2. Add to OnSpace Cloud → Auth Settings → Redirect URLs:
 *    ```
 *    scratchpal://oauth/callback
 *    ```
 * 
 * 3. Intercept URLs in WebViewClient:
 *    ```kotlin
 *    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
 *      val url = request.url.toString()
 *      if (url.startsWith("scratchpal://oauth/callback")) {
 *        // Handle OAuth callback (see METHOD 1 or 2 above)
 *        return true
 *      }
 *      return false
 *    }
 *    ```
 * 
 * TESTING
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Test the global handler from browser console:
 * ```
 * window.handleOAuthTokens('test-access-token', 'test-refresh-token')
 * ```
 * 
 * This should trigger the authentication flow (will fail with invalid tokens,
 * but will confirm the handler is callable).
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
