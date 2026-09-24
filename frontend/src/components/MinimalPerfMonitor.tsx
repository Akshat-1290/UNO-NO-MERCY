import React, { useEffect, useRef, useState, useCallback } from 'react';
import { perfEngine, PerfMetrics } from '../utils/perfTracker';
import { Activity, ChevronUp, ChevronDown, X, RotateCcw } from 'lucide-react';

export const MinimalPerfMonitor: React.FC = () => {
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Direct DOM Refs for Zero React Re-render Telemetry
  const dotRef = useRef<HTMLSpanElement>(null);
  const compactFpsRef = useRef<HTMLSpanElement>(null);
  const compactPingRef = useRef<HTMLSpanElement>(null);
  const compactDropRef = useRef<HTMLSpanElement>(null);

  // Expanded Refs
  const expFpsRef = useRef<HTMLSpanElement>(null);
  const expAvgFpsRef = useRef<HTMLSpanElement>(null);
  const expMinFpsRef = useRef<HTMLSpanElement>(null);
  const expPingRef = useRef<HTMLSpanElement>(null);
  const expJitterRef = useRef<HTMLSpanElement>(null);
  const expDropRef = useRef<HTMLSpanElement>(null);
  const expMemRef = useRef<HTMLSpanElement>(null);

  const updateDom = useCallback((m: PerfMetrics) => {
    // 1. Status Dot
    if (dotRef.current) {
      const dotColor = m.fps >= 55 ? 'bg-emerald-400' : m.fps >= 30 ? 'bg-amber-400' : 'bg-rose-500';
      dotRef.current.className = `w-2 h-2 rounded-full shrink-0 ${dotColor}`;
    }

    // 2. Compact View Values
    if (compactFpsRef.current) {
      compactFpsRef.current.textContent = `${m.fps}`;
      compactFpsRef.current.className = m.fps >= 55 ? 'text-emerald-400 font-bold' : m.fps >= 30 ? 'text-amber-400 font-bold' : 'text-rose-400 font-bold';
    }
    if (compactPingRef.current) {
      compactPingRef.current.textContent = m.ping > 0 ? `${m.ping}ms` : '--';
      compactPingRef.current.className = m.ping > 0 && m.ping < 120 ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium';
    }
    if (compactDropRef.current) {
      compactDropRef.current.textContent = `${m.frameDrops}`;
      compactDropRef.current.className = m.frameDrops === 0 ? 'text-neutral-400' : 'text-rose-400 font-bold';
    }

    // 3. Expanded View Values (if mounted)
    if (expFpsRef.current) {
      expFpsRef.current.textContent = `${m.fps}`;
      expFpsRef.current.className = m.fps >= 55 ? 'text-emerald-400 font-bold' : m.fps >= 30 ? 'text-amber-400 font-bold' : 'text-rose-400 font-bold';
    }
    if (expAvgFpsRef.current) expAvgFpsRef.current.textContent = `${m.avgFps}`;
    if (expMinFpsRef.current) expMinFpsRef.current.textContent = `${m.minFps}`;
    if (expPingRef.current) {
      expPingRef.current.textContent = m.ping > 0 ? `${m.ping}ms` : '--';
      expPingRef.current.className = m.ping > 0 && m.ping < 120 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold';
    }
    if (expJitterRef.current) expJitterRef.current.textContent = `${m.jitter}ms`;
    if (expDropRef.current) {
      expDropRef.current.textContent = `${m.frameDrops}`;
      expDropRef.current.className = m.frameDrops === 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold';
    }
    if (expMemRef.current) {
      expMemRef.current.textContent = m.jsHeapSizeMb ? `${m.jsHeapSizeMb} MB` : 'N/A';
    }
  }, []);

  // Listen to keyboard shortcut (Shift + P) to toggle monitor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        setIsVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Subscribe to telemetry engine updates (runs out-of-band on 1.2s tick)
  useEffect(() => {
    if (!isVisible) return;
    const unsubscribe = perfEngine.subscribe(updateDom);
    updateDom(perfEngine.getMetrics());
    return unsubscribe;
  }, [isVisible, updateDom]);

  // When expanding or collapsing, re-populate immediate values
  useEffect(() => {
    if (isVisible) {
      updateDom(perfEngine.getMetrics());
    }
  }, [isExpanded, isVisible, updateDom]);

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    perfEngine.resetStats();
  };

  // If hidden, show tiny toggle pill
  if (!isVisible) {
    return (
      <button
        type="button"
        onClick={() => setIsVisible(true)}
        className="fixed bottom-2 right-2 z-50 px-2 py-1 rounded-lg bg-neutral-950/90 border border-neutral-800 text-neutral-400 hover:text-white text-[10px] font-mono shadow-lg cursor-pointer gpu-layer active:scale-95 transition-opacity opacity-75 hover:opacity-100"
        title="Show Performance Stats (Shift+P)"
        aria-label="Show Performance Stats"
      >
        FPS
      </button>
    );
  }

  return (
    <div
      style={{ transform: 'translate3d(0, 0, 0)', contain: 'content' }}
      className="fixed bottom-2 right-2 sm:bottom-3 sm:right-3 z-50 font-mono select-none text-xs text-neutral-300"
    >
      {!isExpanded ? (
        /* Minimal Compact Pill (Zero re-renders, 0.01ms update cost) */
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#0a0a0f] border border-neutral-800 shadow-xl shadow-black/80">
          <span ref={dotRef} className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          
          {/* FPS */}
          <div className="flex items-center gap-1">
            <span ref={compactFpsRef} className="text-emerald-400 font-bold">60</span>
            <span className="text-[10px] text-neutral-400 font-medium">FPS</span>
          </div>

          <span className="text-neutral-700">|</span>

          {/* Ping */}
          <div className="flex items-center gap-1">
            <span ref={compactPingRef} className="text-emerald-400 font-medium">--</span>
          </div>

          <span className="text-neutral-700">|</span>

          {/* Drops */}
          <div className="flex items-center gap-1" title="Hitch frame drops">
            <span ref={compactDropRef} className="text-neutral-400">0</span>
            <span className="text-[10px] text-neutral-500">hitches</span>
          </div>

          {/* Expand Details Button */}
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="p-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer ml-0.5"
            title="Show more details"
            aria-label="Expand stats"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {/* Close/Hide Button */}
          <button
            type="button"
            onClick={() => setIsVisible(false)}
            className="p-0.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
            title="Hide monitor (Shift+P)"
            aria-label="Hide monitor"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* Expanded Clean Stats Card (Minimal textual grid, zero graphs) */
        <div className="w-64 p-3 rounded-2xl bg-[#0a0a0f] border border-neutral-800 shadow-2xl shadow-black text-neutral-300 space-y-2.5">
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5" />
              <span>Performance</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleReset}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title="Reset stats"
                aria-label="Reset stats"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title="Minimize"
                aria-label="Minimize"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setIsVisible(false)}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title="Hide (Shift+P)"
                aria-label="Hide"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Metric Rows */}
          <div className="space-y-1.5 text-[11px]">
            {/* FPS */}
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Current Framerate:</span>
              <div className="flex items-center gap-1">
                <span ref={expFpsRef} className="text-emerald-400 font-bold">60</span>
                <span className="text-neutral-500">FPS</span>
              </div>
            </div>

            {/* Avg / Min FPS */}
            <div className="flex items-center justify-between text-[10px] text-neutral-400">
              <span>Avg / Min FPS:</span>
              <span>
                <span ref={expAvgFpsRef} className="text-neutral-200 font-bold">60</span>
                {' / '}
                <span ref={expMinFpsRef} className="text-neutral-200 font-bold">60</span>
              </span>
            </div>

            {/* Network Latency */}
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Network Ping:</span>
              <span ref={expPingRef} className="text-emerald-400 font-bold">--</span>
            </div>

            {/* Jitter */}
            <div className="flex items-center justify-between text-[10px] text-neutral-400">
              <span>Ping Jitter:</span>
              <span ref={expJitterRef} className="text-neutral-200">0ms</span>
            </div>

            {/* Frame Hitches */}
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Stall Hitches:</span>
              <span ref={expDropRef} className="text-emerald-400 font-bold">0</span>
            </div>

            {/* JS Heap */}
            <div className="flex items-center justify-between text-[10px] text-neutral-400">
              <span>JS Heap Size:</span>
              <span ref={expMemRef} className="text-neutral-300">--</span>
            </div>
          </div>

          <div className="pt-1 border-t border-neutral-800/60 text-[9px] text-neutral-500 text-center">
            Zero-overhead direct DOM profiler
          </div>
        </div>
      )}
    </div>
  );
};
