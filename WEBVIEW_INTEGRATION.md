# WebView Integration Guide

This guide explains how to integrate the ScratchPal web app with native Android and iOS apps using WebView.

## Overview

The web app can now communicate with native mobile apps when running inside a WebView. This allows actions performed in the web app (like logout) to trigger corresponding actions in the native app.

## Features

### 1. **WebView Detection**
The app automatically detects if it's running inside a WebView and adjusts behavior accordingly.

**Detection Methods:**
- React Native WebView: `window.ReactNativeWebView`
- Android WebView: User agent contains 'wv' or 'webview'
- iOS WebView: iPhone/iPad without Safari
- Generic WebView detection

### 2. **Logout Synchronization**
When a user signs out from the web app, a message is sent to the native app to clear the session.

**Message Format:**
```javascript
{
  type: 'LOGOUT',
  data: {
    timestamp: '2026-01-21T...',
    message: 'User signed out from web app'
  }
}
```

## Implementation for Mobile Apps

### React Native WebView

**1. Setup WebView:**
```javascript
import { WebView } from 'react-native-webview';

<WebView
  source={{ uri: 'https://play.scratchpal.com' }}
  onMessage={handleWebViewMessage}
  javaScriptEnabled={true}
/>
```

**2. Handle Messages:**
```javascript
const handleWebViewMessage = (event) => {
  try {
    const message = JSON.parse(event.nativeEvent.data);
    
    if (message.type === 'LOGOUT') {
      console.log('User logged out from web app');
      
      // Clear your app's auth state
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userSession');
      
      // Navigate to login screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  } catch (error) {
    console.error('Error handling WebView message:', error);
  }
};
```

### Native Android (Kotlin/Java)

**1. Setup WebView:**
```kotlin
// MainActivity.kt or WebViewActivity.kt
import android.webkit.WebView
import android.webkit.JavascriptInterface

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        webView = findViewById(R.id.webview)
        webView.settings.javaScriptEnabled = true
        
        // Add JavaScript interface
        webView.addJavascriptInterface(WebAppInterface(this), "Android")
        
        webView.loadUrl("https://play.scratchpal.com")
    }
}

// WebAppInterface.kt
class WebAppInterface(private val context: Context) {
    @JavascriptInterface
    fun postMessage(json: String) {
        try {
            val message = JSONObject(json)
            val type = message.getString("type")
            
            if (type == "LOGOUT") {
                // Clear session
                val prefs = context.getSharedPreferences("auth", Context.MODE_PRIVATE)
                prefs.edit().clear().apply()
                
                // Navigate to login
                val intent = Intent(context, LoginActivity::class.java)
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                context.startActivity(intent)
            }
        } catch (e: Exception) {
            Log.e("WebAppInterface", "Error handling message", e)
        }
    }
}
```

### Native iOS (Swift)

**1. Setup WKWebView:**
```swift
import WebKit

class WebViewController: UIViewController, WKScriptMessageHandler {
    var webView: WKWebView!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        let config = WKWebViewConfiguration()
        let userController = WKUserContentController()
        
        // Add message handler
        userController.add(self, name: "nativeApp")
        config.userContentController = userController
        
        webView = WKWebView(frame: .zero, configuration: config)
        webView.load(URLRequest(url: URL(string: "https://play.scratchpal.com")!))
    }
    
    func userContentController(_ userContentController: WKUserContentController, 
                              didReceive message: WKScriptMessage) {
        guard let dict = message.body as? [String: Any],
              let type = dict["type"] as? String else { return }
        
        if type == "LOGOUT" {
            // Clear session
            UserDefaults.standard.removeObject(forKey: "authToken")
            UserDefaults.standard.removeObject(forKey: "userSession")
            
            // Navigate to login
            let loginVC = LoginViewController()
            let navController = UINavigationController(rootViewController: loginVC)
            navController.modalPresentationStyle = .fullScreen
            self.present(navController, animated: true)
        }
    }
}
```

## Message Types

### Current Messages

| Type | Description | Data |
|------|-------------|------|
| `LOGOUT` | User signed out | `{ timestamp, message }` |

### Future Messages (Planned)

You can extend the system to handle additional events:

| Type | Description | Data |
|------|-------------|------|
| `LOGIN` | User logged in | `{ userId, email, timestamp }` |
| `STATE_CHANGED` | User changed state | `{ state, timestamp }` |
| `GAME_FAVORITED` | User favorited a game | `{ gameId, timestamp }` |
| `SCAN_COMPLETED` | User completed a ticket scan | `{ scanId, matches, timestamp }` |

## Testing

### Test WebView Detection

The app includes a debug panel (🐝 button at bottom of login/profile pages) that shows:
- WebView detection status
- WebView type
- User agent string
- Deep link test button

### Test Logout Flow

1. **Run your native app with WebView**
2. **Load the web app** (https://play.scratchpal.com)
3. **Sign in** to the web app
4. **Check console logs** in your native app debugger
5. **Click "Sign Out"** on the profile page
6. **Verify** your native app receives the LOGOUT message
7. **Verify** user is redirected to login screen

### Console Logs

The web app logs all WebView communication:
```
📱 Sending message to WebView: { type: 'LOGOUT', data: {...} }
✅ Message sent via ReactNativeWebView.postMessage
```

## Security Considerations

1. **Validate Messages**: Always validate and sanitize messages received from WebView
2. **HTTPS Only**: Only load the web app over HTTPS
3. **Session Management**: Clear all auth tokens and sessions on logout
4. **Error Handling**: Implement proper error handling for message passing failures

## Troubleshooting

### Message Not Received

**Check:**
- JavaScript is enabled in WebView
- Message handler is properly registered
- Console shows message was sent
- Native app is listening for messages

### WebView Not Detected

**Check:**
- User agent is being modified correctly
- WebView interface is properly exposed
- Console shows detection status

### Logout Not Working

**Check:**
- Message handler is processing LOGOUT type
- Auth state is being cleared
- Navigation to login screen is triggered
- No errors in native app logs

## Support

For issues or questions:
- Check console logs in web app (🐝 debug panel)
- Check native app debugger logs
- Review this documentation
- Contact development team
