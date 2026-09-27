/**
 * Centralized Sound Manager Utility & Haptic Engine for UNO Show 'Em No Mercy
 * Manages a shared Web Audio API AudioContext, a bounded VoiceChannelPool,
 * pre-fetched/decoded AudioBuffers for the 5 real card audio assets in /public/audio/,
 * action-keyed + asset-level debouncing, and animation-completion synchronization.
 */

export type CardAudioAssetKey =
  | 'card-land'
  | 'card-pick'
  | 'card-shuffle'
  | 'card-throw'
  | 'special-card';

const CARD_AUDIO_URLS: Record<CardAudioAssetKey, string> = {
  'card-land': '/audio/card-land.ogg',
  'card-pick': '/audio/card-pick.ogg',
  'card-shuffle': '/audio/card-shuffle.ogg',
  'card-throw': '/audio/card-throw.ogg',
  'special-card': '/audio/special-card.ogg',
};

/**
 * Exact 10ms-calibrated trim profiles measured from the 5 .ogg waveforms:
 * - card-pick.ogg (616ms): 45ms leading silence, crisp pick transient at 45..170ms, unwanted 2nd click at 550ms (trimmed out!)
 * - card-land.ogg (709ms): 120ms leading silence, crisp land impact at 120..235ms
 * - card-throw.ogg (767ms): 105ms leading silence, throw whoosh at 105..385ms, unwanted trailing noise at 680..760ms (trimmed out!)
 * - card-shuffle.ogg (3078ms): 120ms leading silence, 4 riffle bursts from 120..1370ms (trimmed to match 7-card deal animation!)
 * - special-card.ogg (265ms): 72ms leading silence, punchy transient at 72..225ms
 */
const CARD_AUDIO_TRIM: Record<
  CardAudioAssetKey,
  { offset: number; duration: number; monophonic: boolean; minGapMs: number }
> = {
  'card-pick': { offset: 0.045, duration: 0.125, monophonic: true, minGapMs: 70 },
  'card-land': { offset: 0.12, duration: 0.115, monophonic: true, minGapMs: 55 },
  'card-throw': { offset: 0.105, duration: 0.28, monophonic: true, minGapMs: 55 },
  'card-shuffle': { offset: 0.12, duration: 1.25, monophonic: true, minGapMs: 250 },
  'special-card': { offset: 0.072, duration: 0.155, monophonic: false, minGapMs: 55 },
};

export interface ActiveCardVoice {
  id: number;
  key: CardAudioAssetKey;
  startedAt: number;
  expectedEndAt: number;
  stop: (fadeSec?: number) => void;
}

export interface SynchronizedSoundOptions {
  /** Unique action/animation key to guarantee idempotent single-trigger per visual event */
  actionKey?: string;
  /** Playback speed multiplier from the sequential event queue (e.g. 1.0, 1.25, 1.5) */
  timeScale?: number;
  /** Optional hard cap on duration in seconds so audio never trails past animation end */
  maxDurationSec?: number;
  /** Callback fired when this audio voice finishes or is stopped */
  onEnded?: () => void;
}

interface PooledVoiceChannel {
  gainNode: GainNode;
  busy: boolean;
  activeVoice: ActiveCardVoice | null;
}

const MAX_VOICE_CHANNELS = 6;
const MAX_PROCESSED_ACTION_KEYS = 160;

class CentralizedSoundManager {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private dealNoiseBuffer: AudioBuffer | null = null;
  private voiceChannelPool: PooledVoiceChannel[] = [];
  private activeCardVoices: Set<ActiveCardVoice> = new Set();
  private settleListeners: Set<() => void> = new Set();
  private lastAssetPlayTime: Partial<Record<CardAudioAssetKey, number>> = {};
  private lastSoundPlayTime: Partial<Record<string, number>> = {};
  private processedActionKeys: Set<string> = new Set();
  private processedActionQueue: string[] = [];
  private rawAudioDataCache: Partial<Record<CardAudioAssetKey, ArrayBuffer>> = {};
  private decodedAudioBuffers: Partial<Record<CardAudioAssetKey, AudioBuffer>> = {};
  private decodingInProgress: Partial<Record<CardAudioAssetKey, boolean>> = {};
  private htmlAudioPools: Partial<Record<CardAudioAssetKey, HTMLAudioElement[]>> = {};
  private htmlPoolCursor: Record<CardAudioAssetKey, number> = {
    'card-land': 0,
    'card-pick': 0,
    'card-shuffle': 0,
    'card-throw': 0,
    'special-card': 0,
  };
  private nextVoiceId = 1;

  constructor() {
    if (typeof window !== 'undefined') {
      this.preloadCardAssets();
      this.setupGestureUnlock();
    }
  }

  private preloadCardAssets() {
    (Object.entries(CARD_AUDIO_URLS) as [CardAudioAssetKey, string][]).forEach(([key, url]) => {
      fetch(url)
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject()))
        .then((buf) => {
          this.rawAudioDataCache[key] = buf;
          if (this.audioCtx) {
            this.decodeCachedArrayBuffers(this.audioCtx);
          }
        })
        .catch(() => {});

      try {
        const pool: HTMLAudioElement[] = [];
        const poolSize = key === 'card-pick' || key === 'card-land' ? 4 : 2;
        for (let i = 0; i < poolSize; i++) {
          const el = new Audio(url);
          el.preload = 'auto';
          pool.push(el);
        }
        this.htmlAudioPools[key] = pool;
      } catch {
        // Ignore if Audio constructor unavailable
      }
    });
  }

  private setupGestureUnlock() {
    const unlockAudio = () => {
      const ctx = this.getAudioContext();
      if (ctx) {
        this.decodeCachedArrayBuffers(ctx);
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      }
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true, once: true });
    window.addEventListener('keydown', unlockAudio, { passive: true, once: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true, once: true });
  }

  private decodeCachedArrayBuffers(ctx: AudioContext) {
    (Object.keys(CARD_AUDIO_URLS) as CardAudioAssetKey[]).forEach((key) => {
      const raw = this.rawAudioDataCache[key];
      if (raw && !this.decodedAudioBuffers[key] && !this.decodingInProgress[key]) {
        this.decodingInProgress[key] = true;
        const bufferCopy = raw.slice(0);
        ctx
          .decodeAudioData(bufferCopy)
          .then((decoded) => {
            this.decodedAudioBuffers[key] = decoded;
          })
          .catch(() => {})
          .finally(() => {
            this.decodingInProgress[key] = false;
          });
      }
    });
  }

  public getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(0.88, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);

        // Initialize pooled voice channels connected to masterGain
        this.voiceChannelPool = [];
        for (let i = 0; i < MAX_VOICE_CHANNELS; i++) {
          const chGain = this.audioCtx.createGain();
          chGain.gain.setValueAtTime(1, this.audioCtx.currentTime);
          chGain.connect(this.masterGain);
          this.voiceChannelPool.push({
            gainNode: chGain,
            busy: false,
            activeVoice: null,
          });
        }

        this.decodeCachedArrayBuffers(this.audioCtx);

        const sampleRate = this.audioCtx.sampleRate;
        const frameCount = Math.floor(sampleRate * 0.045);
        this.dealNoiseBuffer = this.audioCtx.createBuffer(1, frameCount, sampleRate);
        const data = this.dealNoiseBuffer.getChannelData(0);
        for (let i = 0; i < frameCount; i++) {
          const env = Math.sin((i / frameCount) * Math.PI);
          data[i] = (Math.random() * 2 - 1) * env;
        }
      }
    } else {
      this.decodeCachedArrayBuffers(this.audioCtx);
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public getMasterGain(): GainNode | null {
    this.getAudioContext();
    return this.masterGain;
  }

  public getDealNoiseBuffer(): AudioBuffer | null {
    this.getAudioContext();
    return this.dealNoiseBuffer;
  }

  /**
   * Acquires a reusable GainNode channel from the AudioContext pool.
   * If all 6 channels are busy, steals the oldest active channel cleanly.
   */
  private acquireVoiceChannel(): PooledVoiceChannel | null {
    if (!this.audioCtx || this.voiceChannelPool.length === 0) return null;
    const free = this.voiceChannelPool.find((ch) => !ch.busy);
    if (free) {
      free.busy = true;
      return free;
    }
    // Steal oldest channel if pool is saturated
    let oldestChannel = this.voiceChannelPool[0];
    for (let i = 1; i < this.voiceChannelPool.length; i++) {
      const ch = this.voiceChannelPool[i];
      if (
        (ch.activeVoice?.startedAt || 0) < (oldestChannel.activeVoice?.startedAt || 0)
      ) {
        oldestChannel = ch;
      }
    }
    oldestChannel.activeVoice?.stop(0.01);
    oldestChannel.busy = true;
    return oldestChannel;
  }

  /**
   * Returns true if an actionKey was already triggered recently (prevents duplicate sound triggers).
   */
  public consumeActionKey(actionKey?: string): boolean {
    if (!actionKey) return true;
    if (this.processedActionKeys.has(actionKey)) {
      return false;
    }
    this.processedActionKeys.add(actionKey);
    this.processedActionQueue.push(actionKey);
    if (this.processedActionQueue.length > MAX_PROCESSED_ACTION_KEYS) {
      const oldest = this.processedActionQueue.shift();
      if (oldest) this.processedActionKeys.delete(oldest);
    }
    return true;
  }

  public checkTypeDebounce(type: string, minIntervalMs: number): boolean {
    const nowTime = performance.now();
    const prev = this.lastSoundPlayTime[type] || 0;
    if (prev > 0 && nowTime - prev < minIntervalMs) {
      return false;
    }
    this.lastSoundPlayTime[type] = nowTime;
    return true;
  }

  private notifyIfVoicesSettled() {
    if (this.activeCardVoices.size === 0 && this.settleListeners.size > 0) {
      const listeners = Array.from(this.settleListeners);
      this.settleListeners.clear();
      listeners.forEach((cb) => cb());
    }
  }

  public hasActiveCardVoices(): boolean {
    return this.activeCardVoices.size > 0;
  }

  /**
   * Waits until all currently playing card animation audio voices finish (or up to maxWaitMs)
   * before invoking callback. Used by the Sequential Event Queue to guarantee audio-visual lockstep.
   */
  public waitForCardVoicesToSettle(maxWaitMs = 60, callback: () => void): () => void {
    if (this.activeCardVoices.size === 0) {
      callback();
      return () => {};
    }
    let fired = false;
    const finish = () => {
      if (fired) return;
      fired = true;
      clearTimeout(timer);
      this.settleListeners.delete(finish);
      callback();
    };
    const timer = setTimeout(finish, maxWaitMs);
    this.settleListeners.add(finish);
    return () => {
      fired = true;
      clearTimeout(timer);
      this.settleListeners.delete(finish);
    };
  }

  public stopCardAnimationSounds(fadeSec = 0.025, onlyKey?: CardAudioAssetKey) {
    this.activeCardVoices.forEach((voice) => {
      if (!onlyKey || voice.key === onlyKey) {
        voice.stop(fadeSec);
        this.activeCardVoices.delete(voice);
      }
    });
    this.notifyIfVoicesSettled();
  }

  public playCardAudioSample(
    key: CardAudioAssetKey,
    volume = 0.9,
    pitchVariance = 0,
    options?: SynchronizedSoundOptions
  ): boolean {
    if (!this.consumeActionKey(options?.actionKey)) {
      return true;
    }

    const nowPerf = performance.now();
    const trim = CARD_AUDIO_TRIM[key];
    const timeScale = Math.max(0.75, Math.min(2.0, options?.timeScale || 1));
    const effectiveMinGap = Math.max(28, Math.round(trim.minGapMs / timeScale));

    if (
      this.lastAssetPlayTime[key] &&
      nowPerf - (this.lastAssetPlayTime[key] || 0) < effectiveMinGap
    ) {
      return true;
    }
    this.lastAssetPlayTime[key] = nowPerf;

    const ctx = this.getAudioContext();
    const mg = this.masterGain;
    const baseRate =
      pitchVariance > 0 ? 1 + (Math.random() * 2 - 1) * pitchVariance : 1;
    // Scale playback rate subtly when queue is catching up so sound stays crisp and tight
    const rate = baseRate * (1 + (timeScale - 1) * 0.55);

    if (trim.monophonic) {
      this.stopCardAnimationSounds(0.016, key);
    }

    const decoded = this.decodedAudioBuffers[key];
    if (ctx && mg && decoded) {
      const channel = this.acquireVoiceChannel();
      const gain = channel ? channel.gainNode : ctx.createGain();
      if (!channel) {
        gain.connect(mg);
      }

      const startTime = ctx.currentTime;
      const offset = Math.min(trim.offset, Math.max(0, decoded.duration - 0.04));
      const maxAvail = Math.max(0.04, decoded.duration - offset);
      const scaledTrimDur = trim.duration / Math.sqrt(timeScale);
      const targetDur = options?.maxDurationSec
        ? Math.min(options.maxDurationSec, scaledTrimDur, maxAvail)
        : Math.min(scaledTrimDur, maxAvail);
      const fadeWindow = Math.min(0.024, targetDur * 0.25);

      const src = ctx.createBufferSource();
      src.buffer = decoded;
      if (rate !== 1) {
        src.playbackRate.setValueAtTime(rate, startTime);
      }

      gain.gain.cancelScheduledValues(startTime);
      gain.gain.setValueAtTime(volume, startTime);
      gain.gain.setValueAtTime(volume, startTime + Math.max(0, targetDur - fadeWindow));
      gain.gain.linearRampToValueAtTime(0.0001, startTime + targetDur);

      src.connect(gain);

      let stopped = false;
      const voiceId = this.nextVoiceId++;
      const voice: ActiveCardVoice = {
        id: voiceId,
        key,
        startedAt: nowPerf,
        expectedEndAt: nowPerf + targetDur * 1000,
        stop: (fadeSec = 0.02) => {
          if (stopped) return;
          stopped = true;
          try {
            const t = ctx.currentTime;
            gain.gain.cancelScheduledValues(t);
            gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
            gain.gain.linearRampToValueAtTime(0.0001, t + fadeSec);
            src.stop(t + fadeSec + 0.005);
          } catch {
            // Ignore if already stopped
          }
        },
      };

      if (channel) {
        channel.activeVoice = voice;
      }
      this.activeCardVoices.add(voice);

      src.onended = () => {
        stopped = true;
        this.activeCardVoices.delete(voice);
        src.disconnect();
        if (channel) {
          channel.busy = false;
          if (channel.activeVoice?.id === voiceId) {
            channel.activeVoice = null;
          }
        } else {
          gain.disconnect();
        }
        options?.onEnded?.();
        this.notifyIfVoicesSettled();
      };

      src.start(startTime, offset, targetDur);
      return true;
    }

    // Secondary Path: Preloaded HTMLAudioElement voice pool while decoding finishes
    const pool = this.htmlAudioPools[key];
    if (pool && pool.length > 0) {
      const idx = this.htmlPoolCursor[key] % pool.length;
      this.htmlPoolCursor[key] = idx + 1;
      const audioEl = pool[idx];
      try {
        const scaledDur = trim.duration / Math.sqrt(timeScale);
        const playDurMs = Math.round(
          (options?.maxDurationSec ? Math.min(options.maxDurationSec, scaledDur) : scaledDur) * 1000
        );
        audioEl.currentTime = trim.offset;
        audioEl.volume = Math.min(1, Math.max(0, volume));
        audioEl.playbackRate = rate;

        let stopped = false;
        const voiceId = this.nextVoiceId++;
        const stopTimer = setTimeout(() => {
          if (!stopped) {
            stopped = true;
            audioEl.pause();
            this.activeCardVoices.delete(voice);
            options?.onEnded?.();
            this.notifyIfVoicesSettled();
          }
        }, playDurMs);

        const voice: ActiveCardVoice = {
          id: voiceId,
          key,
          startedAt: nowPerf,
          expectedEndAt: nowPerf + playDurMs,
          stop: () => {
            if (stopped) return;
            stopped = true;
            clearTimeout(stopTimer);
            audioEl.pause();
            options?.onEnded?.();
          },
        };
        this.activeCardVoices.add(voice);

        const playPromise = audioEl.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            clearTimeout(stopTimer);
            this.activeCardVoices.delete(voice);
            this.notifyIfVoicesSettled();
          });
        }
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }
}

export const soundManager = new CentralizedSoundManager();

/**
 * Immediately fades out and stops any active card animation audio voices
 * so sound never trails past the end of a card deal or draw animation.
 */
export const stopCardAnimationSounds = (
  fadeSec = 0.025,
  onlyKey?: CardAudioAssetKey
) => {
  soundManager.stopCardAnimationSounds(fadeSec, onlyKey);
};


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

export type SoundEffectType =
  | 'turn'
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
  | 'deal_tick'
  | 'shuffle'
  | 'card_pick'
  | 'card_land'
  | 'card_throw'
  | 'special_card'
  | 'timer_warning';

export const playSound = (
  type: SoundEffectType,
  options?: SynchronizedSoundOptions
) => {
  try {
    // Per-type coalesce lock prevents identical sound spam on the same millisecond
    // while allowing distinct sounds (e.g. card-pick + card-land, or card-throw + special-card) to overlap naturally.
    const timeScale = Math.max(0.75, Math.min(2.0, options?.timeScale || 1));
    const minInterval = type === 'shuffle' ? 120 : Math.max(22, Math.round(32 / timeScale));
    if (!soundManager.checkTypeDebounce(type, minInterval)) {
      return;
    }

    const ctx = soundManager.getAudioContext();
    const mg = soundManager.getMasterGain();
    if (!ctx || !mg) return;

    const now = ctx.currentTime;

    switch (type) {
      case 'shuffle': {
        if (soundManager.playCardAudioSample('card-shuffle', 0.92, 0, options)) break;
        break;
      }
      case 'deal_tick':
      case 'card_pick':
      case 'draw':
      case 'flick':
      case 'swoosh': {
        // Real card-pick.ogg with subtle pitch variation (0.97x - 1.03x) for natural dealing cadence
        if (soundManager.playCardAudioSample('card-pick', 0.88, 0.03, options)) break;
        // Fallback synth if audio buffer not yet ready
        const dealNoiseBuffer = soundManager.getDealNoiseBuffer();
        if (dealNoiseBuffer) {
          const src = ctx.createBufferSource();
          src.buffer = dealNoiseBuffer;
          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(2400 + Math.random() * 450, now);
          filter.Q.setValueAtTime(1.8, now);
          const nGain = ctx.createGain();
          nGain.gain.setValueAtTime(0.24, now);
          nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.042);
          src.connect(filter);
          filter.connect(nGain);
          nGain.connect(mg);
          src.onended = () => {
            src.disconnect();
            filter.disconnect();
            nGain.disconnect();
            options?.onEnded?.();
          };
          src.start(now);
        }
        break;
      }
      case 'card_land':
      case 'flip': {
        // Real card-land.ogg when a card lands in hand or settles on the table
        if (soundManager.playCardAudioSample('card-land', 0.86, 0.025, options)) break;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.04);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
        osc.connect(gain);
        gain.connect(mg);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
          options?.onEnded?.();
        };
        osc.start(now);
        osc.stop(now + 0.04);
        break;
      }
      case 'card_throw':
      case 'play': {
        // Real card-throw.ogg when throwing/playing a card onto the discard pile
        if (soundManager.playCardAudioSample('card-throw', 0.92, 0.025, options)) break;
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
          options?.onEnded?.();
        };
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }
      case 'special_card':
      case 'slam':
      case 'stack': {
        // Real special-card.ogg for special/action/wild/penalty cards
        if (soundManager.playCardAudioSample('special-card', 0.95, 0, options)) break;
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
          options?.onEnded?.();
        };
        osc.start(now);
        osc.stop(now + 0.25);
        break;
      }
      case 'turn': {
        // Melodic attention chime when user turn arrives
        [587.33, 880].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.05);
          gain.gain.setValueAtTime(0.18, now + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.05 + 0.09);
          osc.connect(gain);
          gain.connect(mg);
          osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
          };
          osc.start(now + idx * 0.05);
          osc.stop(now + idx * 0.05 + 0.09);
        });
        break;
      }
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
