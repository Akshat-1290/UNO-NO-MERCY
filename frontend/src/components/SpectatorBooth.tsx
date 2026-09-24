import React, { useState } from 'react';
import { GameState } from '../../../shared/src/types';
import { Video, Award, Sparkles } from 'lucide-react';

interface SpectatorBoothProps {
  gameState: GameState;
  currentUserId: string;
  onSendTaunt: (emote: string) => void;
  onSendMessage: (text: string) => void;
  onResumeControl?: () => void;
}

export const SpectatorBooth: React.FC<SpectatorBoothProps> = ({
  gameState,
  currentUserId,
  onSendTaunt,
}) => {
  const [predictedWinnerId, setPredictedWinnerId] = useState<string | null>(null);

  const activePlayers = gameState.players.filter((p) => !p.isEliminated);

  const handlePredict = (playerId: string) => {
    setPredictedWinnerId(playerId);
    const target = gameState.players.find((p) => p.id === playerId);
    if (target) {
      onSendTaunt(`👑 Rooting for ${target.name}!`);
    }
  };

  const handleCheer = (emoji: string, text: string) => {
    onSendTaunt(`${emoji} ${text}`);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-neutral-950/95 border border-neutral-800 shadow-2xl backdrop-blur-xl my-1 space-y-2 shrink-0">
      {/* Broadcast Header */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-neutral-800/80 pb-1.5">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400 text-[11px] font-black uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <Video className="w-3 h-3" />
            <span>Spectating</span>
          </div>
          <span className="text-[11px] text-neutral-400 font-medium">
            Eliminated by {gameState.rules.mercyLimit}-card Mercy Rule!
          </span>
        </div>

        <div className="text-[11px] text-neutral-400 font-mono">
          Alive: <span className="text-rose-400 font-bold">{activePlayers.length}</span>/{gameState.players.length}
        </div>
      </div>

      {/* Prediction & Audience Cheering Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Audience Prediction Poll */}
        <div className="p-2 rounded-xl bg-neutral-900/70 border border-neutral-800/90 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-neutral-300 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              Who will survive?
            </span>
            {predictedWinnerId && (
              <span className="text-[9px] text-amber-400 font-bold uppercase">
                Prediction Placed
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-minimal">
            {activePlayers.map((p) => {
              const isSelected = predictedWinnerId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePredict(p.id)}
                  className={`flex items-center space-x-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-sm ring-1 ring-amber-400/50 scale-105'
                      : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
                  }`}
                >
                  <span className="text-xs">{p.avatar}</span>
                  <span className="truncate max-w-[70px]">{p.name}</span>
                  <span className="text-[9px] opacity-75">({p.cards.length}c)</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Audience Cheering & Reactions */}
        <div className="p-2 rounded-xl bg-neutral-900/70 border border-neutral-800/90 space-y-1.5">
          <span className="text-[11px] font-bold text-neutral-300 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            Sideline Cheers
          </span>

          <div className="flex flex-wrap items-center gap-1 max-h-24 overflow-y-auto scrollbar-minimal">
            {[
              { emoji: '🍿', text: 'Popcorn' },
              { emoji: '🔥', text: 'Fire!' },
              { emoji: '💀', text: 'Brutal!' },
              { emoji: '🙏', text: 'Mercy!' },
              { emoji: '📣', text: 'UNO!' },
              { emoji: '😈', text: 'Wrecked!' },
            ].map((btn) => (
              <button
                key={btn.emoji}
                type="button"
                onClick={() => handleCheer(btn.emoji, btn.text)}
                className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-rose-500/60 text-neutral-300 text-[11px] font-bold transition-all cursor-pointer active:scale-95"
              >
                <span>{btn.emoji}</span>
                <span className="text-[10px]">{btn.text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpectatorBooth;
