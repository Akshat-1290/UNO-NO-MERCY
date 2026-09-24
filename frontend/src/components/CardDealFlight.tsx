import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UnoCard } from './UnoCard';

export interface DrawFlightData {
  id: string;
  count: number;
  reason?: 'normal' | 'penalty' | 'roulette' | 'draw_until';
  label?: string;
  target?: 'me' | 'opponent';
  opponentName?: string;
}

interface CardDealFlightProps {
  flight: DrawFlightData | null;
  isLandscape?: boolean;
}

export const CardDealFlight: React.FC<CardDealFlightProps> = ({ flight, isLandscape = false }) => {
  const [coords, setCoords] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

  useEffect(() => {
    if (!flight) {
      setCoords(null);
      return;
    }

    const deckEl = document.getElementById('uno-draw-deck');
    const handEl = document.getElementById('uno-player-hand');

    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let sX = winW * 0.44;
    let sY = winH * 0.45;
    let eX = winW * 0.5;
    let eY = winH * 0.88;

    if (deckEl) {
      const rect = deckEl.getBoundingClientRect();
      sX = rect.left + rect.width / 2;
      sY = rect.top + rect.height / 2;
    }

    if (flight.target === 'opponent') {
      eX = winW * 0.5;
      eY = Math.max(30, winH * 0.1);
    } else if (handEl) {
      const rect = handEl.getBoundingClientRect();
      eX = rect.left + rect.width / 2;
      eY = rect.top + rect.height * 0.45;
    }

    setCoords({ startX: sX, startY: sY, endX: eX, endY: eY });
  }, [flight, isLandscape]);

  if (!flight || !coords) return null;

  const count = Math.max(1, flight.count);
  // Visually deal up to 4 cards in rapid succession for optimal responsiveness
  const visualCount = Math.min(count, 4);
  const isOpponent = flight.target === 'opponent';

  // Responsive card size for flight
  const cardW = isLandscape ? 52 : 62;
  const cardH = isLandscape ? 74 : 88;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 pointer-events-none z-[999] overflow-hidden">
        {/* Deal Cards: Direct travel from Deck to Player's Hand */}
        {Array.from({ length: visualCount }).map((_, idx) => {
          const spreadOffset = visualCount > 1 ? (idx - (visualCount - 1) / 2) * 20 : 0;
          const rotateOffset = visualCount > 1 ? (idx - (visualCount - 1) / 2) * 10 : (idx % 2 === 0 ? 6 : -6);
          const delay = idx * 0.08;

          return (
            <motion.div
              key={`${flight.id}_card_${idx}`}
              initial={{
                opacity: 1,
                x: coords.startX - cardW / 2,
                y: coords.startY - cardH / 2,
                scale: 0.95,
                rotate: 0,
              }}
              animate={{
                opacity: [1, 1, 1, 0],
                x: [
                  coords.startX - cardW / 2,
                  coords.startX - cardW / 2 + (coords.endX - coords.startX) * 0.45 + spreadOffset,
                  coords.endX - cardW / 2 + spreadOffset,
                  coords.endX - cardW / 2 + spreadOffset,
                ],
                y: [
                  coords.startY - cardH / 2,
                  coords.startY - cardH / 2 + (coords.endY - coords.startY) * 0.48,
                  coords.endY - cardH / 2,
                  coords.endY - cardH / 2,
                ],
                scale: [0.95, 1.08, 1, 0.95],
                rotate: [0, rotateOffset * 0.8, rotateOffset, 0],
              }}
              transition={{
                duration: 0.46,
                delay,
                times: [0, 0.45, 0.92, 1],
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                width: cardW,
                height: cardH,
                willChange: 'transform, opacity',
                transform: 'translateZ(0)',
              }}
              className="absolute pointer-events-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)] flex items-center justify-center"
            >
              <UnoCard
                card={{ id: `fly_${idx}`, color: 'wild', value: 'wild' }}
                showBack
                size={isLandscape ? 'sm' : 'md'}
                disabled
              />
            </motion.div>
          );
        })}

        {/* Informative Deal Badge - Clear and prominent at draw deck */}
        <motion.div
          initial={{
            opacity: 0,
            x: coords.startX,
            y: coords.startY - 30,
            scale: 0.8,
          }}
          animate={{
            opacity: [0, 1, 1, 0],
            x: coords.startX,
            y: isOpponent ? coords.startY - 48 : coords.startY - 38,
            scale: [0.8, 1.05, 1, 0.9],
          }}
          transition={{
            duration: 0.75,
            times: [0, 0.2, 0.8, 1],
            ease: 'easeOut',
          }}
          className="absolute -translate-x-1/2 pointer-events-none z-[1000] whitespace-nowrap"
        >
          {flight.reason === 'roulette' ? (
            <div className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white font-black text-xs sm:text-sm shadow-2xl border-2 border-white/60 flex items-center gap-1.5 backdrop-blur-md">
              <span className="text-sm">🎰</span>
              <span>{flight.label || `ROULETTE (+${count})`}</span>
            </div>
          ) : flight.reason === 'penalty' || count > 1 ? (
            <div className="px-3 py-1 rounded-full bg-gradient-to-r from-rose-600 to-amber-600 text-white font-black text-xs sm:text-sm shadow-2xl border-2 border-white/60 flex items-center gap-1.5">
              <span>💥</span>
              <span>{flight.label || `+${count} CARDS`}</span>
            </div>
          ) : isOpponent ? (
            <div className="px-2.5 py-0.5 rounded-full bg-neutral-900/95 border border-neutral-700 text-neutral-200 font-bold text-[10px] sm:text-xs shadow-xl">
              <span>📥 {flight.opponentName || 'Opponent'} drew card</span>
            </div>
          ) : (
            <div className="px-3 py-1 rounded-full bg-neutral-900/95 border border-amber-400 text-amber-300 font-black text-[11px] sm:text-xs shadow-2xl">
              <span>📥 +1 Card</span>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
