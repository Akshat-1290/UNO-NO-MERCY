/**
 * Tactile Haptic Vibration Engine for UNO Show 'Em No Mercy
 * Controlled single-purpose vibration: ONLY triggers when the player's turn arrives.
 * All other non-turn vibration factors are completely suppressed.
 */

let lastTurnVibrateTime = 0;

export const triggerHaptic = (
  type:
    | 'turn'
    | 'light'
    | 'medium'
    | 'heavy'
    | 'play'
    | 'draw'
    | 'stack'
    | 'penalty'
    | 'mercy'
    | 'uno'
    | 'jumpin'
    | 'win'
    | 'timer_warning'
    | 'alert' = 'turn'
) => {
  // Vibration is strictly and exclusively reserved ONLY for when the user's turn arrives
  if (type !== 'turn') return;
  if (typeof window === 'undefined') return;
  if (!('navigator' in window) || typeof window.navigator.vibrate !== 'function') return;

  const now = Date.now();
  if (now - lastTurnVibrateTime < 800) return; // Debounce turn vibration
  lastTurnVibrateTime = now;

  try {
    // Distinct, crisp double-pulse haptic cue for turn alert
    window.navigator.vibrate([35, 45, 35]);
  } catch {
    // Ignore any device-level vibration prevention or permissions
  }
};
