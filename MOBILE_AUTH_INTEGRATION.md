# Mobile App Authentication Integration Guide

## Overview

The Scratchpal web app now supports **hybrid authentication** that works seamlessly with both:
- ✅ **Mobile WebView** - Direct token injection (recommended)
- ✅ **Regular Browsers** - OAuth callback flow (fallback)

Both flows use the **same OnSpace Cloud/Supabase backend**, so authentication is automatically synchronized.

---

## Architecture

### Shared Backend
- **Same user table** (`user_profiles`)
- **Same RLS policies** (row-level security)
- **Same permissions** automatically applied
- **No sync needed** - it's the same data!

### Authentication Priority
1. **First**: Check for injected tokens from mobile app (`window.mobileAppTokens`)
2. **Fallback**: Check for existing session (OAuth or previous login)

---

## Mobile App Implementation (React Native)

### Prerequisites
1. Install Supabase client in your React Native app:
   ```bash
   npm install @supabase/supabase-js
   ```

2. Initialize Supabase with the same credentials:
   ```typescript
   import { createClient } from '@supabase/supabase-js';

   const supabase = createClient(
     'https://wfnkgagyuwknhsajwfnk.backend.onspace.ai',
     'YOUR_ANON_KEY_HERE'
   );
   ```

### Step 1: Implement Native Authentication

```typescript
// Example: Email/Password Login
const handleNativeLogin = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Login failed:', error.message);
    return;
  }

  if (data.session) {
    // Login successful! Now inject tokens into WebView
    injectTokensIntoWebView(data.session);
  }
};

// Example: Google OAuth (Native)
const handleGoogleLogin = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
  });

  // Handle OAuth flow natively...
  // When complete, inject tokens into WebView
};
```

### Step 2: Inject Tokens into WebView

After successful native authentication, inject the tokens:

```typescript
const injectTokensIntoWebView = (session: Session) => {
  const { access_token, refresh_token } = session;

  console.log('📱 Injecting tokens into WebView...');
  console.log('   Access Token:', access_token.substring(0, 20) + '...');
  console.log('   Refresh Token:', refresh_token.substring(0, 20) + '...');

  // Inject tokens into WebView
  webViewRef.current?.injectJavaScript(`
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 MOBILE APP INJECTING TOKENS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    window.mobileAppTokens = {
      access_token: '${access_token}',
      refresh_token: '${refresh_token}'
    };
    
    console.log('✅ Tokens set in window.mobileAppTokens');
    console.log('   Reloading page to process tokens...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Reload to trigger auth initialization
    window.location.reload();
    
    true; // Required for iOS
  `);

  console.log('✅ Tokens injected, WebView reloading...');
};
```

### Step 3: Handle Token Refresh

```typescript
// Listen for token refresh events
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' && session) {
    // Re-inject refreshed tokens
    injectTokensIntoWebView(session);
  }
  
  if (event === 'SIGNED_OUT') {
    // Clear WebView session
    webViewRef.current?.injectJavaScript(`
      localStorage.clear();
      window.location.href = '/profile';
    `);
  }
});
```

### Complete Example

```typescript
import React, { useRef, useEffect } from 'react';
import { WebView } from 'react-native-webview';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wfnkgagyuwknhsajwfnk.backend.onspace.ai',
  'YOUR_ANON_KEY_HERE'
);

export function ScratchpalWebView() {
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        injectTokensIntoWebView(session);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          injectTokensIntoWebView(session);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          injectTokensIntoWebView(session);
        } else if (event === 'SIGNED_OUT') {
          webViewRef.current?.injectJavaScript(`
            localStorage.clear();
            window.location.href = '/profile';
          `);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const injectTokensIntoWebView = (session: any) => {
    console.log('📱 Injecting tokens from auth state change...');
    
    webViewRef.current?.injectJavaScript(`
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📱 MOBILE APP INJECTING TOKENS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      window.mobileAppTokens = {
        access_token: '${session.access_token}',
        refresh_token: '${session.refresh_token}'
      };
      
      console.log('✅ Tokens set in window.mobileAppTokens');
      console.log('   Reloading page to process tokens...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      window.location.reload();
      
      true; // Required for iOS
    `);
  };

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: 'https://play.scratchpal.com' }}
      // ... other WebView props
    />
  );
}
```

---

## Web App Behavior

### Initialization Flow

When the web app loads, it follows this sequence:

1. **Check for Mobile Tokens**
   ```javascript
   const mobileTokens = window.mobileAppTokens;
   if (mobileTokens?.access_token && mobileTokens?.refresh_token) {
     // Use tokens to set session
     await supabase.auth.setSession(mobileTokens);
     delete window.mobileAppTokens; // Clear after use
   }
   ```

2. **Fallback to Existing Session**
   ```javascript
   // If no mobile tokens, check for existing session
   const { data: { session } } = await supabase.auth.getSession();
   if (session?.user) {
     // User already authenticated via OAuth or previous login
   }
   ```

### Console Logging

The web app logs detailed authentication information in the browser console:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 INITIALIZING AUTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ MOBILE APP TOKENS DETECTED
   Access Token: eyJhbGciOiJIUzI1NiIs...
   Setting session with injected tokens...
✅ Session set from mobile app tokens!
   User: user@example.com
🗑️  Cleared mobile app tokens from window
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Benefits Over OAuth Callback Flow

| OAuth Callback | Token Injection |
|----------------|----------------|
| 🔴 Browser redirects | ✅ Direct injection |
| 🔴 Deep link complexity | ✅ Simple JavaScript call |
| 🔴 Multi-step process | ✅ Instant authentication |
| 🔴 Storage coordination | ✅ No storage needed |
| 🔴 Debugging challenges | ✅ Clear console logs |
| 🔴 User confusion | ✅ Seamless UX |

---

## Testing

### 1. Test Mobile Flow
- Launch React Native app
- Trigger native login
- Check browser console for "MOBILE APP TOKENS DETECTED"
- Verify user is authenticated in web app

### 2. Test Browser Fallback
- Open web app in regular browser (not WebView)
- Click "Sign in with Google"
- Complete OAuth flow
- Verify authentication works as before

### 3. Test Token Refresh
- Wait for token to expire (1 hour)
- Native app should refresh automatically
- WebView should receive new tokens
- User stays logged in

---

## Troubleshooting

### Issue: Tokens Not Detected

**Check:**
1. Token injection happens **before** WebView loads URL
2. `window.mobileAppTokens` is set correctly
3. Browser console shows detection logs

**Solution:**
```typescript
// METHOD 1: Inject BEFORE loading URL (Recommended)
const [isReady, setIsReady] = useState(false);

useEffect(() => {
  // Get session first
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      // Set tokens BEFORE WebView loads
      webViewRef.current?.injectJavaScript(`
        window.mobileAppTokens = {
          access_token: '${session.access_token}',
          refresh_token: '${session.refresh_token}'
        };
        true;
      `);
    }
    setIsReady(true);
  });
}, []);

// Load WebView only after tokens are injected
{isReady && <WebView ... />}

// METHOD 2: Inject AFTER load and reload
const onWebViewLoad = () => {
  if (session) {
    webViewRef.current?.injectJavaScript(`
      window.mobileAppTokens = { ... };
      window.location.reload();
      true;
    `);
  }
};

<WebView onLoad={onWebViewLoad} ... />
```

### Issue: User Not Logged In

**Check:**
1. Tokens are valid (not expired)
2. Access token and refresh token are both present
3. Supabase client is initialized with correct URL/key

**Solution:**
```typescript
// Verify tokens before injection
console.log('Injecting tokens:', {
  access: session.access_token.substring(0, 20) + '...',
  refresh: session.refresh_token.substring(0, 20) + '...',
});
```

### Issue: Session Lost on Navigation

**Check:**
1. WebView persists localStorage
2. Token refresh is working
3. Auth state listener is active

**Solution:**
```typescript
// Enable storage in WebView
<WebView
  sharedCookiesEnabled={true}
  thirdPartyCookiesEnabled={true}
  // ... other props
/>
```

---

## API Reference

### Web App Global Functions

#### `window.mobileAppTokens`
**Type:** `{ access_token: string; refresh_token: string } | undefined`

**Description:** Tokens injected by mobile app for authentication.

**Usage:**
```typescript
// Mobile app sets this
window.mobileAppTokens = {
  access_token: 'eyJhbGci...',
  refresh_token: 'eyJhbGci...'
};

// Web app consumes and clears automatically
```

#### `window.handleOAuthTokens(access_token, refresh_token)`
**Type:** `(access_token: string, refresh_token: string) => Promise<void>`

**Description:** Legacy function for OAuth callback flow (still supported).

**Usage:**
```typescript
// Mobile app can also use this approach
await window.handleOAuthTokens(
  session.access_token,
  session.refresh_token
);
```

#### `window.getStoredOAuthCode()`
**Type:** `() => { code: string; timestamp: number } | null`

**Description:** Retrieve OAuth code from browser storage (OAuth fallback).

---

## Next Steps

1. ✅ Implement native Supabase auth in mobile app
2. ✅ Inject tokens into WebView after successful login
3. ✅ Test authentication flow end-to-end
4. ✅ Handle token refresh automatically
5. ✅ Remove complex OAuth callback logic from mobile app

---

## Support

For questions or issues:
- Email: contact@onspace.ai
- Web app logs: Check browser console
- Mobile app logs: Check React Native debugger
