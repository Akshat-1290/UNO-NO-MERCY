import React, { useState, useEffect, useRef } from 'react';
import { Radio } from 'lucide-react';
import { timerSync } from '../../utils/timerSync';

export interface TurnTimerBadgeProps {
  isMyTurn: boolean;
  currentPlayerName?: string;
  turnTimeRemaining: number;
  turnTimerSeconds: number;
  currentTurnIndex: number;
  status: string;
}

export const TurnTimerBadge: React.FC<TurnTimerBadgeProps> = React.memo(({
  isMyTurn,
  currentPlayerName,
  turnTimeRemaining,
  turnTimerSeconds,
  currentTurnIndex,
  status,
}) => {
  const [smoothSeconds, setSmoothSeconds] = useState<number>(turnTimeRemaining);
  const syncRef = useRef<{ remaining: number; timestamp: number }>({
    remaining: turnTimeRemaining,
    timestamp: Date.now(),
  });

  useEffect(() => {
    const unsubscribe = timerSync.subscribe((seconds) => {
      syncRef.current = {
        remaining: seconds,
        timestamp: Date.now(),
      };
      setSmoothSeconds(seconds);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    syncRef.current = {
      remaining: turnTimeRemaining,
      timestamp: Date.now(),
    };
    setSmoothSeconds(turnTimeRemaining);
  }, [turnTimeRemaining, currentTurnIndex]);

  useEffect(() => {
    if (status !== 'playing' || !turnTimerSeconds) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - syncRef.current.timestamp) / 1000;
      const current = Math.max(0, syncRef.current.remaining - elapsed);
      setSmoothSeconds(Math.ceil(current));
    }, 1000);

    return () => clearInterval(interval);
  }, [status, turnTimerSeconds, currentTurnIndex]);

  const displaySeconds = Math.ceil(smoothSeconds);

  if (isMyTurn) {
    return (
      <div className="inline-flex items-center justify-center gap-1.5 h-7 px-2.5 sm:px-3 clip-chamfer-btn bg-red-600 text-white font-mono-hud font-black text-[11px] sm:text-xs shadow-[2px_2px_0px_#000] border border-red-400 leading-none">
        <Radio className="w-3.5 h-3.5 text-white animate-pulse shrink-0" />
        <span className="tracking-wider uppercase">YOUR TURN</span>
        {turnTimerSeconds > 0 && (
          <span className="bg-black/60 px-1.5 py-0.5 clip-chamfer-btn text-[10px] text-amber-300 font-mono leading-none">
            {displaySeconds}S
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center justify-center gap-1.5 sm:gap-2 h-7 px-2.5 clip-chamfer-btn bg-[#141219] border border-neutral-700 text-neutral-300 text-[11px] sm:text-xs font-mono-hud font-bold leading-none">
      <span className="w-2 h-2 bg-amber-400 shrink-0" />
      <span className="truncate max-w-[85px] sm:max-w-[150px] uppercase">
        {currentPlayerName ? `${currentPlayerName}` : 'WAITING'}
      </span>
      {turnTimerSeconds > 0 && (
        <span className="text-[10px] text-amber-400 font-mono font-bold shrink-0">({displaySeconds}S)</span>
      )}
    </div>
  );
});
