import React, { useEffect, useState, useRef } from 'react';
import { EliminationHighlight } from '@uno/shared/types';
import { Skull, Flame, Swords, X, Video } from 'lucide-react';

interface KillcamHighlightProps {
  highlight?: EliminationHighlight;
  onDismiss?: () => void;
}

export const KillcamHighlight: React.FC<KillcamHighlightProps> = ({ highlight, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const dismissedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!highlight?.id) {
      setVisible(false);
      return;
    }

    // If this specific elimination event has already been dismissed, never show again
    if (dismissedIdsRef.current.has(highlight.id)) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = setTimeout(() => {
      dismissedIdsRef.current.add(highlight.id);
      setVisible(false);
      onDismiss?.();
    }, 4500);

    return () => clearTimeout(timer);
  }, [highlight?.id, onDismiss]);

  const handleDismiss = () => {
    if (highlight?.id) {
      dismissedIdsRef.current.add(highlight.id);
    }
    setVisible(false);
    onDismiss?.();
  };

  if (!visible || !highlight || (highlight.id && dismissedIdsRef.current.has(highlight.id))) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
      className="fixed inset-0 z-[350] pointer-events-auto flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
    >
      {/* Screen edge emergency vignette */}
      <div className="absolute inset-0 border-8 border-red-600/60 pointer-events-none" />

      <div className="relative w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-neutral-950 border-2 border-red-600 shadow-2xl shadow-red-950 text-center space-y-5 animate-scaleUp">
        {/* Dismiss Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer z-10"
          title="Dismiss Replay"
          aria-label="Dismiss Replay"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Killcam Tag */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-red-600/30 border border-red-500 text-red-400 text-xs font-black uppercase tracking-widest">
          <Video className="w-3.5 h-3.5" />
          <span>MERCY KNOCKOUT REPLAY</span>
        </div>

        {/* Big Impact Headline */}
        <div className="space-y-1">
          <h2 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-400 to-amber-400 tracking-tight uppercase">
            KO’D BY MERCY RULE!
          </h2>
          <p className="text-xs text-neutral-400 font-mono">
            {highlight.fatalReason}
          </p>
        </div>

        {/* Versus Battle Visuals */}
        <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-around">
          {/* Victim */}
          <div className="flex flex-col items-center space-y-1.5">
            <div className="relative w-16 h-16 rounded-2xl bg-neutral-950 border-2 border-red-600 flex items-center justify-center text-3xl shadow-lg">
              {highlight.victimAvatar}
              <div className="absolute -bottom-2 -right-2 p-1 rounded-full bg-red-600 text-white shadow-md">
                <Skull className="w-4 h-4" />
              </div>
            </div>
            <span className="text-xs font-black text-white">{highlight.victimName}</span>
            <span className="text-[10px] text-red-400 font-bold px-2 py-0.5 rounded-md bg-red-950/60 border border-red-900">
              {highlight.cardCount} Cards Held
            </span>
          </div>

          <div className="flex flex-col items-center text-rose-500">
            <Swords className="w-8 h-8" />
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 mt-1">
              ELIMINATED
            </span>
          </div>

          {/* Killer (if stacked or hit) */}
          <div className="flex flex-col items-center space-y-1.5">
            <div className="relative w-16 h-16 rounded-2xl bg-neutral-950 border-2 border-amber-500 flex items-center justify-center text-3xl shadow-lg">
              {highlight.killerAvatar || '⚡'}
              <div className="absolute -bottom-2 -right-2 p-1 rounded-full bg-amber-500 text-neutral-950 shadow-md">
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <span className="text-xs font-black text-white">
              {highlight.killerName || 'The Deck'}
            </span>
            <span className="text-[10px] text-amber-400 font-bold px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-900">
              Executioner
            </span>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-2 text-neutral-500 text-[11px] font-medium">
          Player is now moved to the Spectator sidelines.
        </div>
      </div>
    </div>
  );
};
