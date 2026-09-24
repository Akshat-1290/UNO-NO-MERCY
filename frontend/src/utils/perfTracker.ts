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

class PerformanceEngine {
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

  private wsSendCallback: ((msg: any) => void) | null = null;
  private listeners = new Set<(metrics: PerfMetrics) => void>();

  constructor() {
    this.fpsSamples = Array(15).fill(60);
    this.pingSamples = Array(15).fill(0);

    if (typeof window !== 'undefined') {
      (window as any).__GET_PERF_STATS = () => this.getMetrics();
      (window as any).__PERF = this;

      document.addEventListener('visibilitychange', () => {
        this.isTabVisible = document.visibilityState === 'visible';
        this.lastFrameTime = performance.now();
        this.lastFpsUpdateTime = performance.now();
      });
    }

    // Auto-start lightweight engine
    this.start();
  }

  public setInGame(inGame: boolean) {
    this.isInGame = inGame;
    if (inGame) {
      this.resetStats();
    }
  }

  public setWsSender(sender: ((msg: any) => void) | null) {
    this.wsSendCallback = sender;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.lastFpsUpdateTime = performance.now();
    this.frameCount = 0;

    // Zero-overhead RAF loop: ONLY tracks frame counts and detects stalls. Zero allocations!
    const loop = (now: number) => {
      if (!this.isRunning) return;

      if (!this.isTabVisible || (typeof document !== 'undefined' && document.hidden)) {
        this.lastFrameTime = now;
        this.animFrameId = requestAnimationFrame(loop);
        return;
      }

      const delta = now - this.lastFrameTime;
      this.lastFrameTime = now;

      // Detect genuine frame stalls (>80ms or >2.5x the running frame time)
      if (delta < 500) {
        // Average frame delta over past frames (~16.6ms at 60fps, ~33.3ms at 30fps)
        const expectedDelta = this.currentFps > 0 ? (1000 / this.currentFps) : 16.6;
        const isTrueStall = delta > Math.max(75, expectedDelta * 2.2);

        if (this.isInGame && isTrueStall) {
          this.frameDrops++;
        }
        this.frameCount++;
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);

    // Periodic Telemetry Update: Runs once every 1,200ms out-of-band (Zero impact on game loop)
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

      // Notify registered direct-DOM UI subscribers
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

    // Periodic Ping (every 3.5 seconds)
    this.pingIntervalId = window.setInterval(() => {
      if (this.isTabVisible && this.wsSendCallback) {
        this.sendPing();
      }
    }, 3500);

    this.sendPing();
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.tickIntervalId) {
      clearInterval(this.tickIntervalId);
      this.tickIntervalId = null;
    }
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
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
