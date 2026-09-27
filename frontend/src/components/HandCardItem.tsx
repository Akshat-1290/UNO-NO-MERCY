import React, { useCallback } from 'react';
import { Card } from '@uno/shared/types';
import { UnoCard } from './UnoCard';

interface HandCardItemProps {
  card: Card;
  index?: number;
  isPlayable: boolean;
  isJumpInPlayable: boolean;
  isNewlyDrawn?: boolean;
  isDealingHidden?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onCardClick: (card: Card) => void;
}

export const HandCardItem: React.FC<HandCardItemProps> = React.memo(({
  card,
  index = 0,
  isPlayable,
  isJumpInPlayable,
  isNewlyDrawn = false,
  isDealingHidden = false,
  size = 'md',
  onCardClick,
}) => {
  const handleClick = useCallback(() => {
    onCardClick(card);
  }, [card, onCardClick]);

  const isPopped = isPlayable || isJumpInPlayable;
  // Natural left-to-right stacking order: card i+1 overlays card i.
  // When popped, they sit in a higher tier (+40), still preserving left-to-right order so the previous card border never cuts across.
  const baseZ = isPopped ? 40 + index : index;

  return (
    <div
      data-hand-card-id={card.id}
      className={`flex-shrink-0 relative ${
        isDealingHidden
          ? 'opacity-0 pointer-events-none transition-none'
          : 'opacity-100 transition-transform duration-150 ease-out'
      } ${
        isPopped ? '-translate-y-2.5 sm:-translate-y-3.5 scale-[1.03]' : ''
      } hover:!z-[999] focus-within:!z-[999] hover:-translate-y-3.5 sm:hover:-translate-y-4 hover:scale-[1.06]`}
      style={{
        zIndex: baseZ,
        willChange: 'transform, opacity',
      }}
    >
      <UnoCard
        card={card}
        isPlayable={isPlayable}
        isJumpInPlayable={isJumpInPlayable}
        isNewlyDrawn={isNewlyDrawn}
        onClick={handleClick}
        size={size}
      />
    </div>
  );
});

HandCardItem.displayName = 'HandCardItem';
