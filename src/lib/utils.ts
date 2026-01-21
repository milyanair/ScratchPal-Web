/**
 * Generate URL-friendly slug from text
 * Converts text to lowercase, replaces spaces/special chars with hyphens
 * @param text - Text to slugify
 * @param maxLength - Maximum length (default: 50)
 * @returns URL-friendly slug
 */
export const slugify = (text: string, maxLength: number = 50): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '')   // Remove leading/trailing hyphens
    .substring(0, maxLength);   // Limit length
};

/**
 * Slugify category name for URLs
 * @param category - Category name (e.g., "Q&A", "Game Talk")
 * @returns URL-friendly category slug (e.g., "qa", "game-talk")
 */
export const slugifyCategory = (category: string): string => {
  return slugify(category);
};

/**
 * Generate unique slug for a title within a category
 * @param title - Topic title
 * @param category - Topic category
 * @param existingSlugs - Array of existing slugs in the same category (optional)
 * @returns Unique slug
 */
export const generateUniqueSlug = (
  title: string,
  category: string,
  existingSlugs: string[] = []
): string => {
  let baseSlug = slugify(title);
  let finalSlug = baseSlug;
  let counter = 2;

  // If slug already exists, append number
  while (existingSlugs.includes(finalSlug)) {
    finalSlug = `${baseSlug}-${counter}`;
    counter++;
  }

  return finalSlug;
};

/**
 * Detect if the app is running in a webview (embedded browser)
 * Focuses on Android webview detection
 */
export const isWebView = (): boolean => {
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Detect Android WebView
  if (userAgent.includes('wv')) {
    console.log('✓ Android WebView detected (wv flag)');
    return true;
  }
  
  // Detect generic webview indicators
  if (userAgent.includes('webview')) {
    console.log('✓ WebView detected (webview flag)');
    return true;
  }
  
  // Detect iOS WebView (iPhone/iPad without Safari)
  if (
    (userAgent.includes('iphone') || userAgent.includes('ipad')) &&
    !userAgent.includes('safari')
  ) {
    console.log('✓ iOS WebView detected');
    return true;
  }
  
  // Additional Android WebView detection patterns
  if (userAgent.includes('android') && !userAgent.includes('chrome')) {
    console.log('✓ Android WebView detected (no Chrome)');
    return true;
  }
  
  console.log('✗ Not a WebView - running in standard browser');
  return false;
};

/**
 * Get user-friendly webview type description
 */
export const getWebViewType = (): string => {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (userAgent.includes('wv')) return 'Android WebView';
  if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'iOS WebView';
  if (userAgent.includes('android')) return 'Android Browser';
  
  return 'Standard Browser';
};

/**
 * Log webview detection info for debugging
 */
export const logWebViewInfo = (): void => {
  const isWv = isWebView();
  const type = getWebViewType();
  const ua = navigator.userAgent;
  
  console.log('=== WebView Detection Info ===');
  console.log('Is WebView:', isWv);
  console.log('Type:', type);
  console.log('User Agent:', ua);
  console.log('============================');
};

/**
 * Send a message to the native WebView (Android/iOS app)
 * This allows the web app to communicate with the native app wrapper
 */
export function sendMessageToWebView(message: { type: string; data?: any }) {
  console.log('📱 Sending message to WebView:', message);
  
  // React Native WebView
  if ((window as any).ReactNativeWebView) {
    (window as any).ReactNativeWebView.postMessage(JSON.stringify(message));
    console.log('✅ Message sent via ReactNativeWebView.postMessage');
    return true;
  }
  
  // Android WebView (native)
  if ((window as any).Android && typeof (window as any).Android.postMessage === 'function') {
    (window as any).Android.postMessage(JSON.stringify(message));
    console.log('✅ Message sent via Android.postMessage');
    return true;
  }
  
  // iOS WebView (WKWebView)
  if ((window as any).webkit?.messageHandlers?.nativeApp) {
    (window as any).webkit.messageHandlers.nativeApp.postMessage(message);
    console.log('✅ Message sent via webkit.messageHandlers.nativeApp');
    return true;
  }
  
  console.log('⚠️ No WebView interface found, message not sent');
  return false;
}

/**
 * Generate unique slug for a game within a state
 * @param gameName - Game name
 * @param state - State code
 * @param existingSlugs - Array of existing slugs in the same state
 * @returns Unique slug
 */
export const generateUniqueGameSlug = (
  gameName: string,
  state: string,
  existingSlugs: string[] = []
): string => {
  let baseSlug = slugify(gameName, 100); // Longer max length for game names
  let finalSlug = baseSlug;
  let counter = 2;

  // If slug already exists in this state, append number
  while (existingSlugs.includes(finalSlug)) {
    finalSlug = `${baseSlug}-${counter}`;
    counter++;
  }

  return finalSlug;
};
