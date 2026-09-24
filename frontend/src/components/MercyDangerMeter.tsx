import React from 'react';
import { Player, BotPersonality } from '../../../shared/src/types';
import { Skull, AlertTriangle, Flame, ShieldAlert, Zap, Compass, Bot } from 'lucide-react';

interface MercyDangerMeterProps {
  player: Player;
  mercyLimit: number;
  isCurrentTurn: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const MercyDangerMeter: React.FC<MercyDangerMeterProps> = ({
  player,
  mercyLimit,
  isCurrentTurn,
  size = 'md',
}) => {
  const cardCount = player.cards.length;
  const ratio = Math.min(1, cardCount / (mercyLimit || 25));
  const cardsRemaining = Math.max(0, (mercyLimit || 25) - cardCount);

  // Danger tiers
  // Green: < 60% of mercy limit (e.g. < 15 cards)
  // Yellow/Amber: 60% - 79% (e.g. 15-19 cards)
  // Red/Critical: >= 80% (e.g. 20+ cards)
  const isSafe = ratio < 0.6;
  const isWarning = ratio >= 0.6 && ratio < 0.8;
  const isCritical = ratio >= 0.8 && !player.isEliminated;

  // SVG dimensions
  const dimensions = size === 'sm' ? 44 : size === 'lg' ? 68 : 54;
  const strokeWidth = size === 'sm' ? 3 : size === 'lg' ? 4.5 : 3.5;
  const radius = (dimensions - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - ratio * circumference;

  let strokeColor = '#22c55e'; // green
  let glowColor = 'rgba(34, 197, 94, 0.4)';
  if (isWarning) {
    strokeColor = '#eab308'; // yellow/amber
    glowColor = 'rgba(234, 179, 8, 0.5)';
  } else if (isCritical) {
    strokeColor = '#ef4444'; // red
    glowColor = 'rgba(239, 68, 68, 0.8)';
  }

  // Personality badge icon
  const getPersonalityIcon = (personality?: BotPersonality) => {
    switch (personality) {
      case 'aggressive':
        return <Zap className="w-2.5 h-2.5 text-amber-300" />;
      case 'chaos':
        return <Compass className="w-2.5 h-2.5 text-fuchsia-300" />;
      case 'casual':
      default:
        return <Bot className="w-2.5 h-2.5 text-cyan-300" />;
    }
  };

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Critical Danger Aura */}
      {isCritical && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: glowColor,
            opacity: 0.25,
            transform: 'scale(1.15)',
          }}
        />
      )}

      {/* Circular Progress Gauge */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: dimensions, height: dimensions }}
      >
        <svg
          className="w-full h-full -rotate-90 transform"
          viewBox={`0 0 ${dimensions} ${dimensions}`}
        >
          {/* Background track */}
          <circle
            cx={dimensions / 2}
            cy={dimensions / 2}
            r={radius}
            stroke="#262626"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Active Mercy fill */}
          {!player.isEliminated && (
            <circle
              cx={dimensions / 2}
              cy={dimensions / 2}
              r={radius}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-500 ease-out"
              style={{
                filter: isCritical ? `drop-shadow(0 0 6px ${strokeColor})` : undefined,
              }}
            />
          )}
        </svg>

        {/* Center Avatar Container */}
        <div
          className={`absolute rounded-full flex items-center justify-center overflow-hidden transition-transform ${
            isCurrentTurn ? 'scale-105' : ''
          } ${
            player.isEliminated
              ? 'bg-neutral-900 grayscale opacity-40'
              : isCritical
              ? 'bg-gradient-to-b from-rose-950 to-neutral-900'
              : isWarning
              ? 'bg-gradient-to-b from-amber-950/60 to-neutral-900'
              : 'bg-neutral-900'
          }`}
          style={{
            width: dimensions - strokeWidth * 3,
            height: dimensions - strokeWidth * 3,
          }}
        >
          <span
            className={
              size === 'sm'
                ? 'text-base'
                : size === 'lg'
                ? 'text-2xl'
                : 'text-xl'
            }
          >
            {player.avatar}
          </span>

          {/* Elimination Skull Marker */}
          {player.isEliminated && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-red-500">
              <Skull className="w-5 h-5 text-red-500" />
            </div>
          )}
        </div>

        {/* Bot Personality Badge on Avatar corner */}
        {player.isBot && !player.isEliminated && (
          <div
            className={`absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full border shadow-sm ${
              player.botPersonality === 'aggressive'
                ? 'bg-rose-950 border-rose-500'
                : player.botPersonality === 'chaos'
                ? 'bg-purple-950 border-purple-500'
                : 'bg-cyan-950 border-cyan-500'
            }`}
            title={`Bot AI: ${player.botPersonality || 'aggressive'}`}
          >
            {getPersonalityIcon(player.botPersonality)}
          </div>
        )}
      </div>

      {/* Critical KO Danger Label */}
      {isCritical && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-red-600 border border-red-400 text-white font-black text-[9px] uppercase tracking-wider flex items-center gap-0.5 shadow-md shadow-red-950/80 whitespace-nowrap z-20">
          <AlertTriangle className="w-2.5 h-2.5 text-amber-300" />
          <span>{cardsRemaining <= 2 ? '1 HIT KO!' : `DANGER ${cardCount}/${mercyLimit}`}</span>
        </div>
      )}

      {/* Warning Alert Label */}
      {isWarning && !isCritical && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full bg-amber-500/90 border border-amber-400 text-neutral-950 font-black text-[8px] uppercase tracking-wider whitespace-nowrap z-20">
          <span>{cardCount}/{mercyLimit}</span>
        </div>
      )}
    </div>
  );
};
