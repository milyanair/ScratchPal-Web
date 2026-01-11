/**
 * Haptic feedback utility for mobile devices
 * Uses the Vibration API (supported on Android, limited on iOS)
 */

export const haptics = {
  /**
   * Check if vibration is supported
   */
  isSupported(): boolean {
    return 'vibrate' in navigator;
  },

  /**
   * Light tap feedback (20ms)
   * Use for: button taps, selections, toggles
   */
  light(): void {
    if (this.isSupported()) {
      navigator.vibrate(20);
    }
  },

  /**
   * Medium tap feedback (40ms)
   * Use for: navigation changes, important actions
   */
  medium(): void {
    if (this.isSupported()) {
      navigator.vibrate(40);
    }
  },

  /**
   * Heavy tap feedback (60ms)
   * Use for: confirmations, success actions
   */
  heavy(): void {
    if (this.isSupported()) {
      navigator.vibrate(60);
    }
  },

  /**
   * Double tap pattern
   * Use for: favorites, special interactions
   */
  doubleTap(): void {
    if (this.isSupported()) {
      navigator.vibrate([30, 50, 30]);
    }
  },

  /**
   * Success pattern
   * Use for: successful submissions, wins
   */
  success(): void {
    if (this.isSupported()) {
      navigator.vibrate([20, 50, 20, 50, 40]);
    }
  },

  /**
   * Error pattern
   * Use for: errors, failed actions
   */
  error(): void {
    if (this.isSupported()) {
      navigator.vibrate([100, 50, 100]);
    }
  },
};
