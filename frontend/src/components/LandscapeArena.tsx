import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Layers, ChevronLeft, ChevronRight, Bot, Zap, Flame } from 'lucide-react';
import { Card, GameState } from '../../../shared/src/types';
import { UnoCard } from './UnoCard';
import { HandCardItem } from './HandCardItem';
import { DrawFlightData } from './CardDealFlight';
import { MercyDangerMeter } from './MercyDangerMeter';
import { SpectatorBooth } from './SpectatorBooth';
import { QuickEmoteWheel } from './QuickEmoteWheel';
import { TableTauntFloating } from './TableTauntFloating';
import { isValidPlay, isExactMatchForJumpIn } from '@uno/shared/unoDeck';
import { triggerHaptic } from '../utils/haptics';

interface LandscapeArenaProps {
  gameState: GameState;
  currentUserId: string;
  topCard: Card;
  myCards: Card[];
  sortedCards: Card[];
  isMyTurn: boolean;
  canPlayAnyCard: boolean;
  handleDrawCard: () => void;
  handleCardClick: (card: Card) => void;
  slamEffect: boolean;
  flipEffect: boolean;
  latestLogMessage?: { text: string };
  activeDrawFlight?: DrawFlightData | null;
  newlyDrawnCardIds?: Set<string>;
  onCallUno: () => void;
  onCatchUno?: (targetPlayerId: string) => void;
  onSendTaunt?: (text: string) => void;
  onSendMessage?: (text: string) => void;
  onResumeControl?: () => void;
}

export const LandscapeArena: React.FC<LandscapeArenaProps> = ({
  gameState,
  currentUserId,
  topCard,
  myCards,
  sortedCards,
  isMyTurn,
  canPlayAnyCard,
  handleDrawCard,
  handleCardClick,
  slamEffect,
  flipEffect,
  newlyDrawnCardIds,
  onCallUno,
  onCatchUno,
  onSendTaunt,
  onSendMessage,
  onResumeControl,
}) => {
  const me = gameState.players.find((p) => p.id === currentUserId);
  const opponents = gameState.players.filter((p) => p.id !== currentUserId);

  const handScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Fast O(1) playability lookup set
  const playableCardIdSet = React.useMemo(() => {
    const set = new Set<string>();
    if (!isMyTurn) return set;
    for (const card of sortedCards) {
      if (
        isValidPlay(
          card,
          topCard,
          gameState.currentColor,
          gameState.activePenalty,
          gameState.lastPenaltyCard,
          gameState.rules.allowStacking
        )
      ) {
        set.add(card.id);
      }
    }
    return set;
  }, [
    isMyTurn,
    sortedCards,
    topCard,
    gameState.currentColor,
    gameState.activePenalty,
    gameState.lastPenaltyCard,
    gameState.rules.allowStacking,
  ]);

  // Fast O(1) Jump-in eligibility set
  const jumpInEligibleSet = React.useMemo(() => {
    const set = new Set<string>();
    if (isMyTurn || !gameState.rules.allowJumpIn || gameState.activePenalty > 0) return set;
    for (const card of sortedCards) {
      if (isExactMatchForJumpIn(card, topCard)) {
        set.add(card.id);
      }
    }
    return set;
  }, [isMyTurn, sortedCards, topCard, gameState.rules.allowJumpIn, gameState.activePenalty]);

  // Dynamic fan overlap
  const cardSpacingClass = React.useMemo(() => {
    const count = sortedCards.length;
    if (count <= 7) return 'space-x-1 sm:space-x-1.5';
    if (count <= 11) return '-space-x-2 sm:-space-x-2.5';
    if (count <= 16) return '-space-x-3 sm:-space-x-4';
    return '-space-x-4 sm:-space-x-5';
  }, [sortedCards.length]);

  const checkHandScroll = () => {
    const el = handScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  useEffect(() => {
    const el = handScrollRef.current;
    if (!el) return;
    checkHandScroll();
    const timer = setTimeout(checkHandScroll, 120);
    el.addEventListener('scroll', checkHandScroll, { passive: true });
    window.addEventListener('resize', checkHandScroll);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', checkHandScroll);
      window.removeEventListener('resize', checkHandScroll);
    };
  }, [sortedCards.length]);

  return (
    <div className="flex-1 flex flex-col justify-between clip-chamfer-lg bg-[#0e0d14] border-2 border-neutral-800 p-1.5 min-h-0 overflow-x-hidden overflow-y-auto scrollbar-minimal shadow-[4px_4px_0px_#000] relative my-0.5 font-mono-hud">
      {/* 1. TOP ZONE: Opponents Compact Strip */}
      <div
        onWheel={(e) => {
          if (e.deltaY) e.currentTarget.scrollLeft += e.deltaY;
        }}
        className="flex items-center justify-start sm:justify-center gap-1.5 overflow-x-auto scrollbar-minimal py-0.5 px-1 shrink-0 z-10 w-full"
      >
        {opponents.map((opp) => {
          const isOppTurn = gameState.players[gameState.currentTurnIndex]?.id === opp.id;
          const isDanger = opp.cards.length >= (gameState.rules.mercyLimit || 25) - 3;
          const oppTaunts = (gameState.activeTaunts || []).filter((t) => t.playerId === opp.id);

          return (
            <div
              key={opp.id}
              className={`relative px-2 py-0.5 clip-chamfer border transition-all flex items-center space-x-1.5 shrink-0 ${
                opp.isEliminated
                  ? 'bg-neutral-950 border-neutral-800 opacity-40 grayscale shadow-none'
                  : isOppTurn
                  ? 'bg-[#221016] border-red-500 shadow-[2px_2px_0px_#ff2600]'
                  : 'bg-[#14121a] border-neutral-800 shadow-[2px_2px_0px_#000]'
              }`}
            >
              <TableTauntFloating taunts={oppTaunts} placement="overlay" />
              <div className="relative">
                <span className="text-sm">{opp.avatar || '👤'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="font-display font-black text-[10px] text-white uppercase truncate max-w-[55px]">
                  {opp.name}
                </span>
                {opp.isEliminated ? (
                  <span className="text-[8px] font-black text-red-400 bg-red-950 px-1 py-0.2 clip-chamfer-btn border border-red-800">
                    KO
                  </span>
                ) : (
                  <span
                    className={`flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.2 clip-chamfer-btn ${
                      isDanger
                        ? 'bg-red-950 text-red-300 border border-red-600 font-black'
                        : 'bg-neutral-900 text-neutral-300'
                    }`}
                  >
                    <Layers className="w-2.5 h-2.5 opacity-70" />
                    <span>{opp.cards.length}</span>
                  </span>
                )}

                {opp.cards.length === 1 && !opp.isEliminated && (
                  opp.hasCalledUno ? (
                    <span className="text-[7px] font-black uppercase px-1 py-0.2 clip-chamfer-btn bg-emerald-950 text-emerald-400 border border-emerald-600">
                      UNO ✓
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCatchUno?.(opp.id);
                      }}
                      className="btn-stamp-slam clip-chamfer-btn text-[7px] font-black uppercase px-1.5 py-0.2 bg-red-600 hover:bg-red-500 text-white border border-amber-300 cursor-pointer"
                      title={`Catch ${opp.name} for not calling UNO!`}
                    >
                      🚨 CATCH!
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. MIDDLE ZONE */}
      <div className="flex-1 w-full min-h-[140px] relative my-0.5 flex items-center justify-between px-1">
        {/* LEFT: Player Info & Actions */}
        <div className="w-28 sm:w-32 flex flex-col justify-center gap-1 shrink-0 z-20">
          {me && (
            <div className="flex items-center gap-1.5">
              <TableTauntFloating
                taunts={(gameState.activeTaunts || []).filter((t) => t.playerId === me.id)}
              />
              <MercyDangerMeter
                player={me}
                mercyLimit={gameState.rules.mercyLimit}
                isCurrentTurn={isMyTurn}
                size="sm"
              />
              <div className="text-[10px] font-black text-white leading-tight">
                <div className="uppercase">Hand ({myCards.length})</div>
                <div className="text-[8px] text-neutral-400 font-bold uppercase">
                  Limit: {gameState.rules.mercyLimit || 25}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-1 mt-0.5">
            {(me?.isAfk || me?.isBot) && (
              <button
                type="button"
                onClick={onResumeControl}
                className="btn-stamp-slam clip-chamfer-btn w-full py-1 px-1 bg-amber-400 text-black font-black text-[9px] uppercase border border-white flex items-center justify-center gap-1 cursor-pointer"
              >
                <Bot className="w-3 h-3 text-black" />
                <span>Resume Play</span>
              </button>
            )}

            {isMyTurn && !canPlayAnyCard && (
              <button
                type="button"
                onClick={handleDrawCard}
                className="btn-stamp-slam clip-chamfer-btn w-full py-1 px-2 bg-red-600 hover:bg-red-500 text-white font-black text-[10px] uppercase border border-amber-400 cursor-pointer text-center"
              >
                {gameState.activePenalty > 0 ? `+${gameState.activePenalty} Penalty` : 'Draw Card'}
              </button>
            )}

            {(() => {
              const canCallUno = !me?.hasCalledUno && (myCards.length === 1 || (isMyTurn && myCards.length === 2));
              const hasCalledUnoSafe = Boolean(me?.hasCalledUno && myCards.length === 1);

              if (canCallUno) {
                return (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('uno');
                      onCallUno();
                    }}
                    className="btn-stamp-slam clip-chamfer-btn w-full py-1 px-2 bg-amber-400 hover:bg-amber-300 text-black font-black text-[10px] uppercase border border-white cursor-pointer text-center"
                  >
                    📢 UNO!
                  </button>
                );
              }
              if (hasCalledUnoSafe) {
                return (
                  <div className="w-full py-0.5 px-1.5 clip-chamfer-btn bg-emerald-950 border border-emerald-500 text-emerald-400 font-bold text-[9px] uppercase tracking-wide text-center">
                    UNO SAFE
                  </div>
                );
              }
              return null;
            })()}

            {gameState.players
              .filter((p) => p.id !== me?.id && !p.isEliminated && p.cards.length === 1 && !p.hasCalledUno)
              .map((target) => (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('penalty');
                    onCatchUno?.(target.id);
                  }}
                  className="btn-stamp-slam clip-chamfer-btn w-full py-0.5 px-1 bg-red-600 text-white font-black text-[8.5px] uppercase border border-amber-400 cursor-pointer"
                  title={`Catch ${target.name} for not calling UNO! (+2 penalty cards)`}
                >
                  🚨 CATCH {target.name.slice(0, 5)}!
                </button>
              ))}

            {onSendTaunt && (
              <div className="flex items-center">
                <QuickEmoteWheel onSendEmote={onSendTaunt} />
              </div>
            )}
          </div>
        </div>

        {/* CENTER TABLE */}
        <div className="absolute inset-0 flex flex-col items-center justify-center relative z-10 pointer-events-none min-h-0">
          {gameState.activePenalty > 0 && (
            <div className="mb-1.5 px-2 py-0.5 clip-chamfer-btn bg-red-600 text-white font-black text-[9px] tracking-wider uppercase flex items-center space-x-1 border border-amber-400 pointer-events-auto">
              <Flame className="w-3 h-3 text-amber-300" />
              <span>+{gameState.activePenalty} PENALTY</span>
            </div>
          )}

          {flipEffect && (
            <div className="mb-0.5 px-2 py-0.2 clip-chamfer-btn bg-amber-400 text-black font-black text-[9px] uppercase flex items-center space-x-1 pointer-events-auto">
              <Sparkles className="w-2.5 h-2.5 text-black" />
              <span>{topCard.value === '7' ? '7 SWAP' : '0 PASS'}</span>
            </div>
          )}

          {/* Draw & Discard */}
          <div className="flex items-center justify-center gap-3 sm:gap-5 relative pointer-events-auto">
            {/* Draw Pile */}
            <div className="flex flex-col items-center relative">
              <button
                id="uno-draw-deck"
                type="button"
                onClick={handleDrawCard}
                disabled={!isMyTurn}
                className={`group relative clip-chamfer transition-all ${
                  isMyTurn
                    ? 'cursor-pointer border-2 border-red-500 ring-2 ring-amber-400/70 shadow-[3px_3px_0px_#000]'
                    : 'border border-neutral-800 opacity-85'
                }`}
                title={isMyTurn ? 'Your Turn: Click to draw' : 'Draw Deck'}
              >
                <UnoCard
                  card={{ id: 'back', color: 'wild', value: 'wild' }}
                  showBack
                  size="sm"
                />
                <div className="absolute -bottom-1 inset-x-0 flex justify-center">
                  <span className={`px-1.5 py-0.2 clip-chamfer-btn text-[7.5px] font-black border ${
                    isMyTurn
                      ? 'bg-red-950 border-red-500 text-amber-300'
                      : 'bg-neutral-900 border-neutral-700 text-neutral-300'
                  }`}>
                    {gameState.drawPileCount} left
                  </span>
                </div>
              </button>
            </div>

            {/* Discard Pile */}
            <div className="flex flex-col items-center relative">
              <div className="relative">
                <UnoCard card={topCard} size="sm" disabled />
                <div
                  className={`absolute -inset-1 clip-chamfer -z-10 border transition-colors ${
                    gameState.currentColor === 'red'
                      ? 'border-red-500 bg-red-600/10'
                      : gameState.currentColor === 'blue'
                      ? 'border-blue-500 bg-blue-600/10'
                      : gameState.currentColor === 'green'
                      ? 'border-emerald-500 bg-emerald-600/10'
                      : 'border-amber-400 bg-amber-500/10'
                  }`}
                />
              </div>

              <div className="mt-0.5 flex items-center space-x-1 text-[8.5px] font-black uppercase">
                <span
                  className={
                    gameState.currentColor === 'red'
                      ? 'text-red-400'
                      : gameState.currentColor === 'blue'
                      ? 'text-blue-400'
                      : gameState.currentColor === 'green'
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }
                >
                  ● {gameState.currentColor}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Symmetry Spacer */}
        <div className="w-28 sm:w-32 shrink-0 z-20 pointer-events-none opacity-0" aria-hidden="true" />
      </div>

      {/* 3. BOTTOM ZONE: User Hand */}
      <div className="pt-0.5 border-t-2 border-neutral-800 shrink-0 z-30 relative overflow-visible">
        {me?.isEliminated ? (
          <SpectatorBooth
            gameState={gameState}
            currentUserId={currentUserId}
            onSendTaunt={onSendTaunt || (() => {})}
            onSendMessage={onSendMessage || (() => {})}
            onResumeControl={onResumeControl}
          />
        ) : (
          <div>
            <div className="relative group min-h-0 flex items-center">
              {canScrollLeft && (
                <>
                  <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#0e0d14] to-transparent z-20" />
                  <button
                    type="button"
                    onClick={() => handScrollRef.current?.scrollBy({ left: -180, behavior: 'smooth' })}
                    className="btn-stamp-secondary clip-chamfer-btn absolute left-0.5 top-1/2 -translate-y-1/2 z-30 p-1 bg-neutral-900 border border-neutral-700 text-white shadow-xl hover:bg-red-600 cursor-pointer"
                    title="Scroll cards left"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </>
              )}

              <div
                id="uno-player-hand"
                ref={handScrollRef}
                onWheel={(e) => {
                  if (e.deltaY) e.currentTarget.scrollLeft += e.deltaY;
                }}
                style={{
                  transform: 'translate3d(0, 0, 0)',
                  WebkitOverflowScrolling: 'touch',
                  touchAction: 'pan-x',
                }}
                className="w-full flex items-center overflow-x-auto pt-6 sm:pt-7 pb-2 px-2 scrollbar-minimal min-h-[6.2rem] overflow-y-visible"
              >
                <div className={`flex items-center ${cardSpacingClass} mx-auto`}>
                  {sortedCards.map((card, idx) => {
                    const playable = playableCardIdSet.has(card.id);
                    const jumpInEligible = jumpInEligibleSet.has(card.id);

                    return (
                      <HandCardItem
                        key={card.id}
                        card={card}
                        index={idx}
                        isPlayable={playable}
                        isJumpInPlayable={jumpInEligible}
                        isNewlyDrawn={newlyDrawnCardIds?.has(card.id)}
                        size="sm"
                        onCardClick={handleCardClick}
                      />
                    );
                  })}
                </div>
              </div>

              {canScrollRight && (
                <>
                  <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0e0d14] to-transparent z-20" />
                  <button
                    type="button"
                    onClick={() => handScrollRef.current?.scrollBy({ left: 180, behavior: 'smooth' })}
                    className="btn-stamp-secondary clip-chamfer-btn absolute right-0.5 top-1/2 -translate-y-1/2 z-30 p-1 bg-neutral-900 border border-neutral-700 text-white shadow-xl hover:bg-red-600 cursor-pointer"
                    title="Scroll right"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LandscapeArena;
