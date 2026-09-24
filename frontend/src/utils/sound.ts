/**
 * Web Audio sound effects and Haptic feedback for UNO Show 'Em No Mercy
 * Completely self-contained synthesis for zero latency and zero external assets
 * Optimized with singleton master gain, node pooling, and memory leak prevention
 */

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.85, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// User-gesture pre-warming to unlock Web Audio on mobile browsers
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio, { passive: true, once: true });
  window.addEventListener('keydown', unlockAudio, { passive: true, once: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true, once: true });
}

/**
 * Mobile Haptic Feedback (Vibration API)
 * Triggers responsive physical sensations on supported devices with smart throttling
 */
let lastHapticTime = 0;
export const triggerHaptic = (pattern: number | number[] = 20) => {
  const now = Date.now();
  if (now - lastHapticTime < 60) return; // Prevent hardware vibration stuttering
  lastHapticTime = now;
  if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors on unsupported or permission-restricted devices
    }
  }
};

const lastSoundPlayTime: Partial<Record<string, number>> = {};

export const playSound = (
  type:
    | 'play'
    | 'draw'
    | 'stack'
    | 'mercy'
    | 'uno'
    | 'win'
    | 'jumpin'
    | 'alert'
    | 'slam'
    | 'flick'
    | 'swoosh'
    | 'flip'
    | 'timer_warning'
) => {
  try {
    const nowTime = performance.now();
    // Coalesce rapid audio triggers of the same type within 45ms (e.g. rapid +10 draw bursts)
    if (lastSoundPlayTime[type] && nowTime - (lastSoundPlayTime[type] || 0) < 45) {
      return;
    }
    lastSoundPlayTime[type] = nowTime;

    const ctx = getAudioContext();
    const mg = masterGain;
    if (!ctx || !mg) return;

    const now = ctx.currentTime;

    switch (type) {
      case 'timer_warning': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.1);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.connect(gain);
        gain.connect(mg);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case 'slam': {
        // Heavy bass impact with snappy transient
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.connect(gain);
        gain.connect(mg);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(now);
        osc.stop(now + 0.25);
        break;
      }
      case 'flick': {
        // Fast high-pitch card release flick
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.05);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.connect(gain);
        gain.connect(mg);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }
      case 'swoosh': {
        // Soft airy sweep for deal and hand movements
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(620, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.connect(gain);
        gain.connect(mg);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case 'flip': {
        // Double flutter tick for card flip / swap
        [400, 700].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.04);
          gain.gain.setValueAtTime(0.15, now + idx * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.04 + 0.06);
          osc.connect(gain);
          gain.connect(mg);
          osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
          };
          osc.start(now + idx * 0.04);
          osc.stop(now + idx * 0.04 + 0.06);
        });
        break;
      }
      case 'play': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.connect(gain);
        gain.connect(mg);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }
      case 'draw': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.12);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.connect(gain);
        gain.connect(mg);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }
      case 'stack': {
        // Dramatic ascending chord
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + i * 0.06);
          gain.gain.setValueAtTime(0.2, now + i * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.06 + 0.25);
          osc.connect(gain);
          gain.connect(mg);
          osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
          };
          osc.start(now + i * 0.06);
          osc.stop(now + i * 0.06 + 0.25);
        });
        break;
      }
      case 'mercy': {
        // Heavy low boom / elimination gong
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.8);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        osc.connect(gain);
        gain.connect(mg);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(now);
        osc.stop(now + 0.8);
        break;
      }
      case 'uno': {
        // High energetic alert
        [587.33, 880, 1174.66].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.25, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.2);
          osc.connect(gain);
          gain.connect(mg);
          osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
          };
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.2);
        });
        break;
      }
      case 'jumpin': {
        // Rapid double beep
        [600, 900].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, now + idx * 0.05);
          gain.gain.setValueAtTime(0.12, now + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.05 + 0.07);
          osc.connect(gain);
          gain.connect(mg);
          osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
          };
          osc.start(now + idx * 0.05);
          osc.stop(now + idx * 0.05 + 0.07);
        });
        break;
      }
      case 'win': {
        // Victory fanfare
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          gain.gain.setValueAtTime(0.25, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.12 + 0.4);
          osc.connect(gain);
          gain.connect(mg);
          osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
          };
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.4);
        });
        break;
      }
      case 'alert': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.connect(gain);
        gain.connect(mg);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
    }
  } catch {
    // Ignore audio failures if user hasn't interacted yet
  }
};
