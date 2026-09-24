import React, { useEffect, useState, useRef } from 'react';
import { TableTaunt } from '../../../shared/src/types';

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

  // Filter active taunts within a crisp 3.6-second duration
  const activeList = rawList
    .filter((t) => {
      const start = localReceiptMap.current.get(t.id) || t.timestamp;
      return now - start < 3600;
    })
    .slice(0, 3) // maximum 3 stacked taunts to keep layout pristine
    .reverse(); // oldest on top/first, newest closest to avatar pointer

  if (activeList.length === 0) return null;

  if (placement === 'overlay') {
    const latestItem = activeList[0];
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

  const isBottom = placement === 'bottom';

  return (
    <div
      className={`absolute ${
        isBottom ? 'top-full mt-2' : 'bottom-full mb-2'
      } left-1/2 -translate-x-1/2 z-[999] pointer-events-none flex flex-col items-center gap-1 transition-all max-w-[min(200px,80vw)] w-max`}
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
                ? 'opacity-0 -translate-y-2 scale-90 duration-500'
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
};
