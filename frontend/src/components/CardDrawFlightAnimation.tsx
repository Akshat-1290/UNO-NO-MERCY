import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UnoCard } from './UnoCard';
import { Sparkles, Flame } from 'lucide-react';

interface CardDrawFlightAnimationProps {
  flight: {
    id: number;
    count: number;
    label?: string;
  } | null;
  onComplete?: () => void;
  isCompact?: boolean;
}

export const CardDrawFlightAnimation: React.FC<CardDrawFlightAnimationProps> = ({
  flight,
  onComplete,
  isCompact = false,
}) => {
  const [cards, setCards] = useState<Array<{ id: number; delay: number; offsetX: number; rotation: number }>>([]);

  useEffect(() => {
    if (!flight) {
      setCards([]);
      return;
    }

    const cardCount = Math.min(Math.max(flight.count, 1), 7);
    const newCards = Array.from({ length: cardCount }, (_, i) => ({
      id: i,
      delay: i * 0.055, // 55ms stagger
      offsetX: (i - (cardCount - 1) / 2) * (isCompact ? 12 : 18),
      rotation: (i - (cardCount - 1) / 2) * 5 + (Math.random() * 6 - 3),
    }));

    setCards(newCards);

    const totalDuration = (cardCount * 55 + 450);
    const timer = setTimeout(() => {
      onComplete?.();
    }, totalDuration);

    return () => clearTimeout(timer);
  }, [flight?.id, flight?.count, isCompact, onComplete]);

  if (!flight || cards.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden">
      {/* Floating Badge (e.g., +4 Cards Drawn, +10 WILD NO MERCY!) */}
      {flight.label && (
        <motion.div
          key={`badge-${flight.id}`}
          initial={{ opacity: 0, scale: 0.7, y: -20 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1.05, 1, 0.9], y: [0, -10, -15, -25] }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className="absolute top-[38%] z-50"
        >
          <div className="px-3 py-1 rounded-full bg-gradient-to-r from-rose-600 via-amber-600 to-yellow-500 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-2xl border border-white/80 flex items-center space-x-1.5 backdrop-blur-md">
            <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-300" />
            <span>{flight.label}</span>
          </div>
        </motion.div>
      )}

      {/* Cascading Flying Cards from Draw Deck down to Hand */}
      <AnimatePresence>
        {cards.map((card) => (
          <motion.div
            key={`draw-fly-${flight.id}-${card.id}`}
            initial={{
              opacity: 0.95,
              scale: isCompact ? 0.75 : 0.85,
              x: 0,
              y: isCompact ? -15 : -25,
              rotate: 0,
            }}
            animate={{
              opacity: [0.95, 1, 0.9, 0],
              scale: [isCompact ? 0.75 : 0.85, isCompact ? 0.85 : 0.95, isCompact ? 0.7 : 0.8],
              x: [0, card.offsetX * 0.4, card.offsetX],
              y: isCompact ? [0, 70, 130] : [0, 110, 190],
              rotate: [0, card.rotation * 0.6, card.rotation],
            }}
            transition={{
              duration: isCompact ? 0.38 : 0.42,
              delay: card.delay,
              ease: [0.22, 1, 0.36, 1], // snappy cubic-bezier for natural card dealing feel
            }}
            className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transform-gpu"
            style={{ willChange: 'transform, opacity' }}
          >
            <div className="relative shadow-2xl rounded-2xl">
              <UnoCard
                card={{ id: `fly-${card.id}`, color: 'wild', value: 'wild' }}
                showBack
                size={isCompact ? 'sm' : 'md'}
                disabled
              />
              {/* Subtle trailing motion glow */}
              <div className="absolute -inset-1 rounded-2xl bg-amber-500/20 blur-sm -z-10" />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
