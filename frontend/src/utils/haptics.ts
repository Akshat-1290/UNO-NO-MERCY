/**
 * Tactile Haptic Vibration Engine for UNO Show 'Em No Mercy
 * Provides seamless physical feedback on mobile / supported devices
 * Fully safeguarded for browsers or OS platforms where navigator.vibrate is unavailable
 */

export const triggerHaptic = (
  type:
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
    | 'alert'
) => {
  if (typeof window === 'undefined') return;
  if (!('navigator' in window) || typeof window.navigator.vibrate !== 'function') return;

  try {
    switch (type) {
      case 'light':
        window.navigator.vibrate(12);
        break;
      case 'medium':
        window.navigator.vibrate(25);
        break;
      case 'heavy':
        window.navigator.vibrate(60);
        break;
      case 'play':
        // Crisp snappy tap
        window.navigator.vibrate([18]);
        break;
      case 'draw':
        // Slight swipe vibration
        window.navigator.vibrate([28]);
        break;
      case 'stack':
        // Ascending power rumble
        window.navigator.vibrate([40, 30, 65]);
        break;
      case 'penalty':
        // Heavy impact shock
        window.navigator.vibrate([80, 40, 110]);
        break;
      case 'mercy':
        // Elimination knockout pulse
        window.navigator.vibrate([100, 50, 160]);
        break;
      case 'uno':
        // Alert rhythm
        window.navigator.vibrate([35, 30, 35, 30, 70]);
        break;
      case 'jumpin':
        // Fast double tap
        window.navigator.vibrate([20, 30, 20]);
        break;
      case 'win':
        // Celebratory rhythm fanfare
        window.navigator.vibrate([40, 40, 40, 40, 80, 50, 120]);
        break;
      case 'timer_warning':
        // Urgent warning pulse
        window.navigator.vibrate([25, 45, 25]);
        break;
      case 'alert':
        window.navigator.vibrate([40, 30, 40]);
        break;
      default:
        window.navigator.vibrate(20);
    }
  } catch {
    // Ignore any device-level vibration prevention
  }
};
