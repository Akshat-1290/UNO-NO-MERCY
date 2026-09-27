/**
 * Performance & Telemetry Engine for UNO Show 'Em No Mercy
 * Ultra-Lightweight Profiler: Zero UI overhead, zero React re-renders, zero DOM thrashing.
 * Provides instant metrics for both console and direct-DOM minimal HUD.
 */

export interface PerfMetrics {
  fps: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
  frameDrops: number;
  ping: number;
  avgPing: number;
  jitter: number;
  jsHeapSizeMb: number | null;
  history: {
    fps: number[];
    ping: number[];
  };
}

export const IS_PERF_TRACKER_ENABLED: boolean =
  String((import.meta as any).env?.VITE_ENABLE_PERF_TRACKER ?? 'false')
    .trim()
    .toLowerCase() === 'true';

class PerformanceEngine {
  public readonly isEnabled = IS_PERF_TRACKER_ENABLED;
  private isRunning = false;
  private animFrameId: number | null = null;
  private pingIntervalId: number | null = null;
  private tickIntervalId: number | null = null;

  private lastFrameTime = performance.now();
  private frameCount = 0;
  private lastFpsUpdateTime = performance.now();
  private currentFps = 60;
  private fpsSamples: number[] = [];
  private pingSamples: number[] = [];

  private frameDrops = 0;
  private currentPing = 0;
  private currentJitter = 0;
  private isTabVisible = true;
  private isInGame = false;
  private isHudVisible = true;
  private isHudExpanded = false;

  private wsSendCallback: ((msg: any) => void) | null = null;
  private listeners = new Set<(metrics: PerfMetrics) => void>();

  constructor() {
    if (!this.isEnabled) return;

    this.fpsSamples = Array(15).fill(60);
    this.pingSamples = Array(15).fill(0);

    if (typeof window !== 'undefined') {
      (window as any).__GET_PERF_STATS = () => this.getMetrics();
      (window as any).__PERF = this;

      document.addEventListener('visibilitychange', () => {
        this.isTabVisible = document.visibilityState === 'visible';
        this.lastFrameTime = performance.now();
        this.lastFpsUpdateTime = performance.now();
        this.syncEngineState();
      });
    }

    this.syncEngineState();
  }

  public setInGame(inGame: boolean) {
    if (!this.isEnabled) return;
    if (this.isInGame === inGame) return;
    this.isInGame = inGame;
    if (inGame) {
      this.resetStats();
      this.sendPing();
    }
    this.syncEngineState();
  }

  public setHudState(visible: boolean, expanded: boolean = false) {
    if (!this.isEnabled) return;
    const changed = this.isHudVisible !== visible || this.isHudExpanded !== expanded;
    this.isHudVisible = visible;
    this.isHudExpanded = expanded;
    if (changed) {
      this.syncEngineState();
      if (visible && expanded) {
        this.sendPing();
      }
    }
  }

  public setWsSender(sender: ((msg: any) => void) | null) {
    if (!this.isEnabled) return;
    this.wsSendCallback = sender;
    if (sender && this.isTabVisible) {
      // Measure initial connection latency once without starting continuous home-screen ping spam
      this.sendPing();
    }
    this.syncEngineState();
  }

  private syncEngineState() {
    if (!this.isEnabled) return;
    const shouldRunFpsLoop = this.isTabVisible && (this.isInGame || this.isHudVisible);
    const shouldRunContinuousPing =
      this.isTabVisible && Boolean(this.wsSendCallback) && (this.isInGame || (this.isHudVisible && this.isHudExpanded));

    if (shouldRunFpsLoop) {
      this.start();
    } else {
      this.stopFpsLoop();
    }

    if (shouldRunContinuousPing) {
      this.startPingLoop();
    } else {
      this.stopPingLoop();
    }
  }

  public start() {
    if (!this.isEnabled || this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.lastFpsUpdateTime = performance.now();
    this.frameCount = 0;

    // Zero-overhead RAF loop: ONLY tracks frame counts and detects stalls when active
    const loop = (now: number) => {
      if (!this.isRunning) return;

      if (!this.isTabVisible || (typeof document !== 'undefined' && document.hidden)) {
        this.lastFrameTime = now;
        return;
      }

      const delta = now - this.lastFrameTime;
      this.lastFrameTime = now;

      // Detect genuine frame stalls (>80ms or >2.5x the running frame time)
      if (delta < 500) {
        const expectedDelta = this.currentFps > 0 ? 1000 / this.currentFps : 16.6;
        const isTrueStall = delta > Math.max(75, expectedDelta * 2.2);

        if (this.isInGame && isTrueStall) {
          this.frameDrops++;
        }
        this.frameCount++;
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);

    // Periodic Telemetry Update: Runs once every 1,200ms out-of-band
    if (!this.tickIntervalId) {
      this.tickIntervalId = window.setInterval(() => {
        if (!this.isRunning || !this.isTabVisible) return;
        const now = performance.now();
        const elapsedSec = (now - this.lastFpsUpdateTime) / 1000;
        if (elapsedSec > 0 && this.frameCount > 0) {
          this.currentFps = Math.min(144, Math.max(1, Math.round(this.frameCount / elapsedSec)));
          this.fpsSamples.push(this.currentFps);
          if (this.fpsSamples.length > 20) this.fpsSamples.shift();
        }

        this.frameCount = 0;
        this.lastFpsUpdateTime = now;

        const metrics = this.getMetrics();

        if (this.listeners.size > 0) {
          this.listeners.forEach((fn) => {
            try {
              fn(metrics);
            } catch (err) {
              console.error('Error in perf listener:', err);
            }
          });
        }
      }, 1200);
    }
  }

  private startPingLoop() {
    if (this.pingIntervalId) return;
    this.pingIntervalId = window.setInterval(() => {
      if (this.isTabVisible && this.wsSendCallback) {
        this.sendPing();
      }
    }, 3500);
  }

  private stopPingLoop() {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  private stopFpsLoop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.tickIntervalId) {
      clearInterval(this.tickIntervalId);
      this.tickIntervalId = null;
    }
  }

  public stop() {
    this.stopFpsLoop();
    this.stopPingLoop();
  }

  public resetStats() {
    this.frameDrops = 0;
    this.fpsSamples = Array(15).fill(60);
    this.lastFrameTime = performance.now();
    this.lastFpsUpdateTime = performance.now();
    this.frameCount = 0;
    const m = this.getMetrics();
    this.listeners.forEach((fn) => {
      try { fn(m); } catch {}
    });
  }

  public sendPing() {
    if (!this.wsSendCallback) return;
    try {
      this.wsSendCallback({
        type: 'PING',
        timestamp: performance.now(),
      });
    } catch {
      // Ignored if socket not ready
    }
  }

  public handlePong(clientTimestamp: number) {
    if (!clientTimestamp) return;
    const now = performance.now();
    const rtt = Math.max(1, Math.round(now - clientTimestamp));

    if (this.currentPing > 0) {
      this.currentJitter = Math.round(Math.abs(rtt - this.currentPing));
    }
    this.currentPing = rtt;
    this.pingSamples.push(rtt);
    if (this.pingSamples.length > 20) this.pingSamples.shift();

    // Immediate ping push to listeners without waiting for 1.2s tick
    if (this.listeners.size > 0) {
      const m = this.getMetrics();
      this.listeners.forEach((fn) => {
        try { fn(m); } catch {}
      });
    }
  }

  public getMetrics(): PerfMetrics {
    const sumFps = this.fpsSamples.reduce((a, b) => a + b, 0);
    const avgFps = this.fpsSamples.length ? Math.round(sumFps / this.fpsSamples.length) : 60;
    const minFps = this.fpsSamples.length ? Math.min(...this.fpsSamples) : 60;
    const maxFps = this.fpsSamples.length ? Math.max(...this.fpsSamples) : 60;

    const validPings = this.pingSamples.filter((p) => p > 0);
    const sumPing = validPings.reduce((a, b) => a + b, 0);
    const avgPing = validPings.length ? Math.round(sumPing / validPings.length) : this.currentPing;

    let jsHeapSizeMb: number | null = null;
    if (typeof window !== 'undefined' && (performance as any).memory?.usedJSHeapSize) {
      jsHeapSizeMb = Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024));
    }

    return {
      fps: this.currentFps,
      avgFps,
      minFps,
      maxFps,
      frameDrops: this.frameDrops,
      ping: this.currentPing,
      avgPing,
      jitter: this.currentJitter,
      jsHeapSizeMb,
      history: {
        fps: [...this.fpsSamples],
        ping: [...this.pingSamples],
      },
    };
  }

  public subscribe(listener: (metrics: PerfMetrics) => void): () => void {
    this.listeners.add(listener);
    // Send immediate snapshot upon subscription
    try {
      listener(this.getMetrics());
    } catch {}

    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const perfEngine = new PerformanceEngine();
