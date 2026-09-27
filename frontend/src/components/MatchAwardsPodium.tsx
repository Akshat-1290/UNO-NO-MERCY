import React from 'react';
import { MatchAward } from '@uno/shared/types';
import { Trophy, Award, Skull, Shield, RotateCw, Flame, Crown } from 'lucide-react';

interface MatchAwardsPodiumProps {
  awards?: MatchAward[];
}

export const MatchAwardsPodium: React.FC<MatchAwardsPodiumProps> = ({ awards }) => {
  if (!awards || awards.length === 0) return null;

  const getAwardIcon = (badge: string) => {
    switch (badge) {
      case '👑':
        return <Crown className="w-5 h-5 text-amber-400" />;
      case '💀':
        return <Skull className="w-5 h-5 text-red-400" />;
      case '🛡️':
        return <Shield className="w-5 h-5 text-emerald-400" />;
      case '🔄':
        return <RotateCw className="w-5 h-5 text-cyan-400" />;
      case '💥':
      default:
        return <Flame className="w-5 h-5 text-orange-400" />;
    }
  };

  return (
    <div className="space-y-3 text-left w-full my-3">
      <div className="flex items-center space-x-2 border-b border-neutral-800 pb-2">
        <Trophy className="w-4 h-4 text-amber-400" />
        <h4 className="text-xs font-black uppercase tracking-wider text-neutral-300">
          Match Awards & Highlights
        </h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
        {awards.map((award, idx) => (
          <div
            key={idx}
            className="p-3 rounded-2xl bg-neutral-950/80 border border-neutral-800/90 flex items-center space-x-3 hover:border-neutral-700 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xl shadow-inner flex-shrink-0">
              {award.badge || award.playerAvatar}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-amber-300 uppercase tracking-tight truncate">
                  {award.title}
                </span>
                <span className="text-[10px] text-neutral-500 font-mono font-bold">
                  {award.playerAvatar}
                </span>
              </div>

              <div className="text-xs font-bold text-white truncate">
                {award.playerName}
              </div>

              <div className="text-[10px] text-rose-400 font-bold font-mono truncate">
                {award.statDescription}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
