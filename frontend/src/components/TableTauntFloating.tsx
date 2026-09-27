import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TableTaunt } from '@uno/shared/types';

interface TableTauntFloatingProps {
  taunt?: TableTaunt;
  taunts?: TableTaunt[];
  placement?: 'top' | 'bottom' | 'overlay';
}

export const TableTauntFloating: React.FC<TableTauntFloatingProps> = ({
  taunt,
  taunts,
  placement = 'top',
}) => {
  const rawList = taunts && taunts.length > 0 ? taunts : taunt ? [taunt] : [];
  const [, setTick] = useState(0);
  const localReceiptMap = useRef<Map<string, number>>(new Map());
  const anchorRef = useRef<HTMLSpanElement>(null);

  // Record client-local receipt timestamp for any new taunt to eliminate clock skew bugs
  useEffect(() => {
    const now = Date.now();
    rawList.forEach((t) => {
      if (!localReceiptMap.current.has(t.id)) {
        // If server timestamp is within reasonable range (<= 4s old), use it, otherwise initialize with local now
        const age = now - t.timestamp;
        if (age >= 0 && age < 4000) {
          localReceiptMap.current.set(t.id, t.timestamp);
        } else {
          localReceiptMap.current.set(t.id, now);
        }
      }
    });

    // Clean up stale IDs in map older than 10 seconds
    if (localReceiptMap.current.size > 20) {
      localReceiptMap.current.forEach((val, id) => {
        if (now - val > 10000) localReceiptMap.current.delete(id);
      });
    }
  }, [rawList]);

  // Fast 100ms ticker for smooth fade-out and instant disappearance
  useEffect(() => {
    if (rawList.length === 0) return;
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 100);
    return () => clearInterval(timer);
  }, [rawList.length > 0]);

  const now = Date.now();
  const isBottom = placement === 'bottom';

  // Filter active taunts within a crisp 3.6-second duration
  const filteredList = rawList
    .filter((t) => {
      const start = localReceiptMap.current.get(t.id) || t.timestamp;
      return now - start < 3600;
    })
    .slice(0, 3); // maximum 3 stacked taunts to keep layout pristine

  // For 'bottom' placement (below opponent name), keep newest first (idx 0) closest to the top pointer.
  // For 'top' placement (above local player avatar), reverse so newest is last (closest to bottom pointer).
  const activeList = isBottom ? filteredList : [...filteredList].reverse();

  if (activeList.length === 0) {
    return <span ref={anchorRef} className="hidden" aria-hidden="true" />;
  }

  if (placement === 'overlay') {
    const latestItem = filteredList[0];
    if (!latestItem) return null;
    const start = localReceiptMap.current.get(latestItem.id) || latestItem.timestamp;
    const elapsed = now - start;
    const isFading = elapsed > 2800;

    return (
      <div
        className={`absolute inset-0 z-30 rounded-xl bg-neutral-950/95 border-2 border-rose-500 shadow-xl shadow-rose-950/80 text-rose-100 flex items-center justify-center px-2 py-0.5 pointer-events-none transition-all duration-200 ${
          isFading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}
      >
        <span className="font-black text-xs truncate max-w-full text-center">
          💬 {latestItem.emote}
        </span>
      </div>
    );
  }

  const parentEl = anchorRef.current?.parentElement;
  const rect = parentEl?.getBoundingClientRect();

  const bubbleStack = (
    <div
      style={
        rect
          ? {
              position: 'fixed',
              left: `${Math.max(84, Math.min(window.innerWidth - 84, rect.left + rect.width / 2))}px`,
              top: isBottom ? `${rect.bottom + 8}px` : `${rect.top - 8}px`,
              transform: isBottom ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            }
          : undefined
      }
      className={`${
        rect
          ? 'z-40'
          : `absolute ${isBottom ? 'top-full mt-2' : 'bottom-full mb-2'} left-1/2 -translate-x-1/2 z-40`
      } pointer-events-none flex flex-col items-center gap-1 transition-all max-w-[min(200px,80vw)] w-max font-mono-hud`}
    >
      {activeList.map((item, idx) => {
        const start = localReceiptMap.current.get(item.id) || item.timestamp;
        const elapsed = now - start;
        const isFading = elapsed > 2800; // Start fade-out during the final 800ms
        const isLatest = isBottom ? idx === 0 : idx === activeList.length - 1;

        return (
          <div
            key={item.id}
            className={`relative px-2.5 py-1 rounded-2xl bg-neutral-950/95 border-2 ${
              isLatest
                ? 'border-rose-500 shadow-xl shadow-rose-950/80 text-rose-100 ring-2 ring-rose-500/40 scale-100 sm:scale-105'
                : 'border-neutral-700/80 shadow-md shadow-black/90 text-neutral-300 scale-95 opacity-85'
            } font-black text-[11px] sm:text-xs flex items-center gap-1.5 transition-all duration-200 transform ${
              isFading
                ? `opacity-0 ${isBottom ? 'translate-y-1.5' : '-translate-y-1.5'} scale-90 duration-500`
                : 'opacity-100 translate-y-0 duration-200'
            }`}
          >
            <span className="truncate max-w-[150px] sm:max-w-[180px]">{item.emote}</span>

            {/* Speech bubble pointer arrow */}
            {isLatest && (
              isBottom ? (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-rose-500" />
              ) : (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-rose-500" />
              )
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <span ref={anchorRef} className="hidden" aria-hidden="true" />
      {rect && typeof document !== 'undefined' ? createPortal(bubbleStack, document.body) : bubbleStack}
    </>
  );
};
