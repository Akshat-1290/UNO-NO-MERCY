import React, { useState } from 'react';
import { Card, CardColor } from '@uno/shared/types';
import { getCardTitle, isWildCard, getCardImagePath } from '@uno/shared/unoDeck';
import { motion } from 'motion/react';

export interface UnoCardProps {
  card: Card;
  isPlayable?: boolean;
  isJumpInPlayable?: boolean;
  isSelected?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  showBack?: boolean;
  disabled?: boolean;
  countBadge?: number;
  rotation?: number;
  isFlipping?: boolean;
  isNewlyDrawn?: boolean;
  className?: string;
}

const colorGlows: Record<CardColor, string> = {
  red: 'rgba(239, 68, 68, 0.85)',
  yellow: 'rgba(245, 158, 11, 0.9)',
  green: 'rgba(34, 197, 94, 0.85)',
  blue: 'rgba(59, 130, 246, 0.85)',
  wild: 'rgba(245, 184, 0, 0.9)',
};

const sizeDimensions = {
  sm: 'w-[3.25rem] h-[4.75rem] sm:w-[3.6rem] sm:h-[5.2rem] rounded-xl text-xs',
  md: 'w-[4.35rem] h-[6.5rem] sm:w-[5.1rem] sm:h-[7.6rem] md:w-[5.6rem] md:h-[8.3rem] rounded-2xl text-sm',
  lg: 'w-[5.8rem] h-[8.6rem] sm:w-[6.8rem] sm:h-[10rem] rounded-2xl text-base',
  xl: 'w-[7.5rem] h-[11rem] sm:w-[8.5rem] sm:h-[12.5rem] rounded-2xl text-xl',
};

export const UnoCard: React.FC<UnoCardProps> = React.memo(({
  card,
  isPlayable = false,
  isJumpInPlayable = false,
  isSelected = false,
  size = 'md',
  onClick,
  showBack = false,
  disabled = false,
  countBadge,
  rotation = 0,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const isWild = isWildCard(card.value);
  const colorKey: CardColor = isWild ? (card.chosenColor || 'wild') : card.color;
  const glow = colorGlows[colorKey] || colorGlows.wild;
  const sizeClass = sizeDimensions[size];
  const title = getCardTitle(card);
  const imageSrc = getCardImagePath(card, showBack);

  React.useEffect(() => {
    setImgError(false);
  }, [imageSrc]);

  // Authentic UNO SHOW 'EM NO MERCY Card Back
  if (showBack) {
    return (
      <div
        style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
        className={`${sizeClass} relative bg-[#0a0a0f] p-[1.5px] rounded-xl border-2 border-black/90 shadow-[0_8px_20px_rgba(0,0,0,0.85)] overflow-hidden flex items-center justify-center select-none flex-shrink-0 ${className}`}
      >
        <img
          src="/cards/card_back.webp"
          alt="UNO Show 'Em No Mercy Card Back"
          loading="eager"
          decoding="sync"
          className="w-full h-full object-cover rounded-[9px] sm:rounded-[11px] select-none pointer-events-none"
        />
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      whileHover={
        !disabled
          ? {
              scale: 1.02,
              transition: { duration: 0.12, ease: 'easeOut' },
            }
          : undefined
      }
      whileTap={!disabled ? { scale: 0.96 } : undefined}
      animate={{
        rotate: rotation || 0,
      }}
      transition={{ duration: 0.12 }}
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      style={{
        boxShadow: isPlayable
          ? `0 8px 20px -2px rgba(0, 0, 0, 0.8), 0 0 12px 1px ${glow}`
          : isJumpInPlayable
          ? `0 8px 20px -2px rgba(0, 0, 0, 0.8), 0 0 12px 2px rgba(255, 204, 0, 0.8)`
          : `0 2px 6px -1px rgba(0, 0, 0, 0.55)`,
      }}
      className={`
        ${sizeClass}
        relative bg-[#0a0a0f] p-[1.5px] sm:p-[2px] border-2 border-black/90 overflow-hidden
        flex flex-col justify-between select-none flex-shrink-0 transition-shadow duration-150
        ${isPlayable ? 'cursor-pointer ring-2 sm:ring-[2.5px] ring-white/95 brightness-110' : ''}
        ${isJumpInPlayable ? 'cursor-pointer ring-2 sm:ring-[2.5px] ring-amber-400 brightness-110' : ''}
        ${isSelected ? 'ring-2 sm:ring-[2.5px] ring-cyan-400' : ''}
        ${!isPlayable && !isJumpInPlayable && !disabled ? 'brightness-90 hover:brightness-100' : ''}
        ${disabled ? 'cursor-default' : ''}
        ${className}
      `}
      title={title}
      aria-label={title}
      tabIndex={isPlayable || isJumpInPlayable ? 0 : -1}
    >
      {/* Authentic High-Fidelity Card Art Image */}
      <div className="w-full h-full rounded-[9px] sm:rounded-[11px] relative overflow-hidden bg-[#050508] flex items-center justify-center shadow-inner">
        {!imgError ? (
          <img
            src={imageSrc}
            alt={title}
            loading="eager"
            decoding="sync"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover select-none pointer-events-none rounded-[8px] sm:rounded-[10px]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white font-bold p-1">
            <span className="text-xs uppercase">{card.color}</span>
            <span className="text-sm font-black">{card.value}</span>
          </div>
        )}

        {/* Glossy subtle sheen reflection */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/15 via-transparent to-black/10 pointer-events-none rounded-[8px] sm:rounded-[10px]" />

        {/* Jump-in Badge Overlay */}
        {isJumpInPlayable && (
          <div className="absolute top-0.5 right-0.5 z-20">
            <span className="text-[5.5px] sm:text-[6.5px] bg-amber-400 text-black px-1 py-0.2 rounded font-black tracking-tighter shadow-md border border-black font-sans uppercase">
              JUMP!
            </span>
          </div>
        )}

        {/* Stack Count Badge */}
        {countBadge && countBadge > 1 && (
          <div className="absolute top-0.5 right-0.5 z-20 bg-black text-[#ffcc00] text-[9px] font-black w-4.5 h-4.5 rounded-full border border-[#ffcc00] flex items-center justify-center shadow-lg">
            ×{countBadge}
          </div>
        )}
      </div>
    </motion.button>
  );
});
