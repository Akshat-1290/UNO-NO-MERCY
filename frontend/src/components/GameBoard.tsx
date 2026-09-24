import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardColor, GameState, Player, ChatMessage } from '../../../shared/src/types';
import { UnoCard } from './UnoCard';
import { HandCardItem } from './HandCardItem';
import { CardDealFlight, DrawFlightData } from './CardDealFlight';
import { timerSync } from '../utils/timerSync';
import { ChatPanel } from './ChatPanel';
import { MercyDangerMeter } from './MercyDangerMeter';
import { QuickEmoteWheel } from './QuickEmoteWheel';
import { TableTauntFloating } from './TableTauntFloating';
import { SpectatorBooth } from './SpectatorBooth';
import { KillcamHighlight } from './KillcamHighlight';
import { MatchAwardsPodium } from './MatchAwardsPodium';
import { LandscapeArena } from './LandscapeArena';
import {
  isExactMatchForJumpIn,
  isValidPlay,
  isWildCard,
  getPenaltyAmount,
} from '@uno/shared/unoDeck';
import { playSound } from '../utils/sound';
import { triggerHaptic } from '../utils/haptics';
import confetti from 'canvas-confetti';
import { motion } from 'motion/react';
import {
  RotateCcw,
  Flame,
  Clock,
  Volume2,
  VolumeX,
  Bot,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Skull,
  Layers,
  Shuffle,
  Trophy,
  Zap,
  LogOut,
  Share2,
  Check,
  AlertTriangle,
  BookOpen,
  MessageSquare,
  X,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Radio,
} from 'lucide-react';

interface GameBoardProps {
  gameState: GameState;
  currentUserId: string;
  onPlayCard: (card: Card, chosenColor?: CardColor, targetPlayerId?: string) => void;
  onDrawCard: () => void;
  onCallUno: () => void;
  onCatchUno?: (targetPlayerId: string) => void;
  onSendMessage: (text: string) => void;
  onSendTaunt?: (emote: string) => void;
  chatMessages: ChatMessage[];
  onOpenRules: () => void;
  onOpenReferee: () => void;
  onRestartGame: () => void;
  onLeaveGame: () => void;
  onReturnToLobby?: () => void;
  onResumeControl?: () => void;
}

interface TurnTimerBadgeProps {
  isMyTurn: boolean;
  currentPlayerName?: string;
  turnTimeRemaining: number;
  turnTimerSeconds: number;
  currentTurnIndex: number;
  status: string;
}

const TurnTimerBadge: React.FC<TurnTimerBadgeProps> = React.memo(({
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
      <div className="flex items-center space-x-1.5 px-3 py-1 clip-chamfer-btn bg-red-600 text-white font-mono-hud font-black text-xs shadow-[2px_2px_0px_#000] border border-red-400">
        <Radio className="w-3.5 h-3.5 text-white animate-pulse" />
        <span className="tracking-wider uppercase">YOUR TURN</span>
        {turnTimerSeconds > 0 && (
          <span className="bg-black/60 px-1.5 py-0.2 clip-chamfer-btn text-[10px] text-amber-300 font-mono">
            {displaySeconds}S
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 px-2.5 py-1 clip-chamfer-btn bg-[#141219] border border-neutral-700 text-neutral-300 text-xs font-mono-hud font-bold">
      <span className="w-2 h-2 bg-amber-400 shrink-0" />
      <span className="truncate max-w-[90px] sm:max-w-[150px] uppercase">
        {currentPlayerName ? `${currentPlayerName}` : 'WAITING'}
      </span>
      {turnTimerSeconds > 0 && (
        <span className="text-[10px] text-amber-400 font-mono font-bold">({displaySeconds}S)</span>
      )}
    </div>
  );
});

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  currentUserId,
  onPlayCard,
  onDrawCard,
  onCallUno,
  onCatchUno,
  onSendMessage,
  onSendTaunt,
  chatMessages,
  onOpenRules,
  onOpenReferee,
  onRestartGame,
  onLeaveGame,
  onReturnToLobby,
  onResumeControl,
}) => {
  const [selectedWildCard, setSelectedWildCard] = useState<Card | null>(null);
  const [selected7Card, setSelected7Card] = useState<Card | null>(null);
  const [dismissedKillcamId, setDismissedKillcamId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [slamEffect, setSlamEffect] = useState(false);
  const [flipEffect, setFlipEffect] = useState(false);
  const [showDrawFly, setShowDrawFly] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [cardHint, setCardHint] = useState<string | null>(null);
  const cardHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(false);
  const [isShortHeight, setIsShortHeight] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Horizontal Hand Scroller position indicators and controls
  const handScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkHandScroll = () => {
    const el = handScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
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
  }, [gameState.players]);

  // Fullscreen state listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
  };

  // Screen orientation and resize tracking
  useEffect(() => {
    const checkOrientation = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isMobile = w < 1024;
      const isPortrait = h > w;
      const isLandscape = isMobile && !isPortrait && h < 550;
      setIsPortraitMobile(isMobile && isPortrait);
      setIsLandscapeMobile(isLandscape);
      setIsShortHeight(h < 600);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Track unread chat messages
  const userChatMessages = chatMessages.filter((m) => !m.isSystem && !m.isAction);
  const lastReadChatCountRef = useRef(userChatMessages.length);

  useEffect(() => {
    if (showChatDrawer) {
      lastReadChatCountRef.current = userChatMessages.length;
      setUnreadChatCount(0);
    } else {
      const unread = Math.max(0, userChatMessages.length - lastReadChatCountRef.current);
      setUnreadChatCount(unread);
    }
  }, [userChatMessages.length, showChatDrawer]);

  const showToastHint = (msg: string) => {
    if (cardHintTimeoutRef.current) clearTimeout(cardHintTimeoutRef.current);
    setCardHint(msg);
    cardHintTimeoutRef.current = setTimeout(() => setCardHint(null), 3500);
  };

  const me = gameState.players.find((p) => p.id === currentUserId);
  const myCards = me?.cards || [];

  // Card Draw Tracking
  const prevMyCardsRef = useRef<Card[]>(myCards);
  const [newlyDrawnCardIds, setNewlyDrawnCardIds] = useState<Set<string>>(new Set());
  const [activeDrawFlight, setActiveDrawFlight] = useState<DrawFlightData | null>(null);

  // Opponent card draw tracking
  const prevOpponentCardsRef = useRef<Map<string, number>>(new Map());
  const [opponentDrawFlight, setOpponentDrawFlight] = useState<DrawFlightData | null>(null);

  useEffect(() => {
    if (gameState.status !== 'playing') {
      prevMyCardsRef.current = myCards;
      return;
    }

    const prevCards = prevMyCardsRef.current;
    if (prevCards.length === 0) {
      prevMyCardsRef.current = myCards;
      return;
    }

    const prevIds = new Set(prevCards.map((c) => c.id));
    const newCards = myCards.filter((c) => !prevIds.has(c.id));

    if (newCards.length > 0) {
      const newIds = new Set(newCards.map((c) => c.id));
      setNewlyDrawnCardIds(newIds);

      const lastLog = gameState.logs?.[gameState.logs.length - 1];
      let reason: 'normal' | 'penalty' | 'roulette' | 'draw_until' = 'normal';
      let label = `+${newCards.length} ${newCards.length > 1 ? 'Cards' : 'Card'}`;

      if (lastLog?.text.toLowerCase().includes('roulette') || lastLog?.text.includes('🎰')) {
        reason = 'roulette';
        label = `ROULETTE (+${newCards.length})`;
      } else if (newCards.length >= 2 || lastLog?.text.toLowerCase().includes('penalty') || lastLog?.text.includes('💥')) {
        reason = 'penalty';
        label = `+${newCards.length} PENALTY`;
      }

      if (soundEnabled) {
        playSound('draw');
      }
      triggerHaptic(reason === 'penalty' ? 'penalty' : 'draw');

      setActiveDrawFlight({
        id: `draw_${Date.now()}`,
        count: newCards.length,
        reason,
        label,
        target: 'me',
      });

      const flightTimer = setTimeout(() => {
        setActiveDrawFlight(null);
      }, 700);

      const highlightTimer = setTimeout(() => {
        setNewlyDrawnCardIds(new Set());
      }, 2500);

      prevMyCardsRef.current = myCards;
      return () => {
        clearTimeout(flightTimer);
        clearTimeout(highlightTimer);
      };
    }

    prevMyCardsRef.current = myCards;
  }, [myCards, gameState.status, gameState.logs, soundEnabled]);

  // Track opponent draws
  useEffect(() => {
    if (gameState.status !== 'playing') return;
    const prevMap = prevOpponentCardsRef.current;
    const currentMap = new Map<string, number>();

    gameState.players.forEach((p) => {
      if (p.id !== currentUserId) {
        currentMap.set(p.id, p.cards.length);
        const prevCount = prevMap.get(p.id);
        if (prevCount !== undefined && p.cards.length > prevCount) {
          const diff = p.cards.length - prevCount;
          const lastLog = gameState.logs?.[gameState.logs.length - 1];
          const isRoulette = lastLog?.text.toLowerCase().includes('roulette') || lastLog?.text.includes('🎰');
          setOpponentDrawFlight({
            id: `opp_${p.id}_${Date.now()}`,
            count: diff,
            target: 'opponent',
            opponentName: p.name,
            reason: isRoulette ? 'roulette' : diff > 1 ? 'penalty' : 'normal',
            label: isRoulette ? `ROULETTE (+${diff})` : diff > 1 ? `+${diff} PENALTY` : undefined,
          });
          if (soundEnabled) playSound('swoosh');
          setTimeout(() => setOpponentDrawFlight(null), 600);
        }
      }
    });

    prevOpponentCardsRef.current = currentMap;
  }, [gameState.players, gameState.status, currentUserId, soundEnabled, gameState.logs]);

  const topCard = gameState.discardPile[gameState.discardPile.length - 1] || {
    id: 'empty',
    color: 'red',
    value: '5',
  };

  const currentPlayer = gameState.players[gameState.currentTurnIndex];
  const isMyTurn =
    gameState.status === 'playing' &&
    currentPlayer?.id === currentUserId &&
    !me?.isEliminated;

  const opponents = gameState.players.filter((p) => p.id !== currentUserId);

  // Stack Slam & Flip Animation Listeners
  const prevTopCardIdRef = useRef<string>(topCard.id);
  const prevPenaltyRef = useRef<number>(gameState.activePenalty);

  useEffect(() => {
    if (topCard.id !== prevTopCardIdRef.current) {
      prevTopCardIdRef.current = topCard.id;
      const penalty = getPenaltyAmount(topCard.value);
      if (
        penalty > 0 ||
        ['skip_everyone', 'wild_draw10', 'wild_draw6', 'draw4', 'draw2', 'wild_reverse_draw4'].includes(
          topCard.value
        )
      ) {
        setSlamEffect(true);
        if (soundEnabled) playSound('slam');
        triggerHaptic('stack');
        const timer = setTimeout(() => setSlamEffect(false), 600);
        return () => clearTimeout(timer);
      }
      if (
        (topCard.value === '7' && gameState.rules.allow7Swap) ||
        (topCard.value === '0' && gameState.rules.allow0PassAll)
      ) {
        setFlipEffect(true);
        if (soundEnabled) playSound('flip');
        triggerHaptic('medium');
        const timer = setTimeout(() => setFlipEffect(false), 700);
        return () => clearTimeout(timer);
      }
    }
  }, [topCard.id, topCard.value, soundEnabled, gameState.rules.allow7Swap, gameState.rules.allow0PassAll]);

  useEffect(() => {
    if (gameState.activePenalty > prevPenaltyRef.current) {
      setSlamEffect(true);
      if (soundEnabled) playSound('slam');
      triggerHaptic('stack');
      const timer = setTimeout(() => setSlamEffect(false), 600);
      return () => clearTimeout(timer);
    }
    prevPenaltyRef.current = gameState.activePenalty;
  }, [gameState.activePenalty, soundEnabled]);

  // Victory Confetti
  useEffect(() => {
    if (gameState.status === 'ended') {
      if (soundEnabled) playSound('win');
      triggerHaptic('win');
      confetti({
        particleCount: 140,
        spread: 90,
        origin: { y: 0.6 },
      });
    }
  }, [gameState.status, soundEnabled]);

  // Audio cue when UNO or Mercy log events occur
  const prevLogIdRef = useRef<string | null>(null);
  const latestGameLog = gameState.logs?.[gameState.logs.length - 1];
  useEffect(() => {
    if (!latestGameLog) return;
    if (latestGameLog.id && latestGameLog.id !== prevLogIdRef.current) {
      prevLogIdRef.current = latestGameLog.id;
      if (latestGameLog.type === 'uno') {
        if (soundEnabled) playSound('uno');
        triggerHaptic('uno');
      } else if (latestGameLog.type === 'mercy') {
        if (soundEnabled) playSound('mercy');
        triggerHaptic('mercy');
      }
    }
  }, [latestGameLog, soundEnabled]);

  // Handle card click from player's hand
  const handleCardClick = (card: Card) => {
    if (!isMyTurn) {
      // Check if eligible for jump-in
      if (
        gameState.rules.allowJumpIn &&
        gameState.activePenalty === 0 &&
        isExactMatchForJumpIn(card, topCard)
      ) {
        if (soundEnabled) playSound('jumpin');
        triggerHaptic('jumpin');
        onPlayCard(card);
        return;
      }
      showToastHint("⏳ Wait for your turn! (Or Jump-In with an identical card)");
      if (soundEnabled) playSound('alert');
      triggerHaptic('alert');
      return;
    }

    // Check penalty stacking rule
    if (gameState.activePenalty > 0) {
      const isStackable = isValidPlay(
        card,
        topCard,
        gameState.currentColor,
        gameState.activePenalty,
        gameState.lastPenaltyCard,
        gameState.rules.allowStacking
      );
      if (!isStackable) {
        showToastHint(
          `💥 Penalty active (+${gameState.activePenalty})! Stack a Draw card (+2, +4, +6, +10) or click 'Take Penalty'.`
        );
        if (soundEnabled) playSound('alert');
        triggerHaptic('alert');
        return;
      }
    }

    // Check validity
    const valid = isValidPlay(
      card,
      topCard,
      gameState.currentColor,
      gameState.activePenalty,
      gameState.lastPenaltyCard,
      gameState.rules.allowStacking
    );

    if (!valid) {
      showToastHint(
        `⛔ Can't play this card! Must match active color (${gameState.currentColor.toUpperCase()}), symbol, or play Wild.`
      );
      if (soundEnabled) playSound('alert');
      triggerHaptic('alert');
      return;
    }

    // Check if card is Wild (requires color choice)
    if (card.color === 'wild' || isWildCard(card.value)) {
      triggerHaptic('light');
      setSelectedWildCard(card);
      return;
    }

    // Check if card is '7'
    if (card.value === '7') {
      const activeOpps = opponents.filter((p) => !p.isEliminated);
      if (gameState.rules.allow7Swap && activeOpps.length === 1) {
        // Only 1 opponent with mandatory rule: auto-swap directly
        if (soundEnabled) playSound('play');
        triggerHaptic('play');
        onPlayCard(card, undefined, activeOpps[0].id);
        return;
      }
      if (activeOpps.length > 0) {
        triggerHaptic('light');
        setSelected7Card(card);
        return;
      }
    }

    if (soundEnabled) playSound('play');
    triggerHaptic('play');
    onPlayCard(card);
  };

  // Draw card with deal animation
  const handleDrawCard = () => {
    if (!isMyTurn) return;
    if (soundEnabled) playSound('swoosh');
    triggerHaptic('draw');
    setShowDrawFly(true);
    setTimeout(() => setShowDrawFly(false), 500);
    onDrawCard();
  };

  const handleChooseColor = (color: CardColor) => {
    if (!selectedWildCard) return;
    if (soundEnabled) playSound('play');
    triggerHaptic('play');
    onPlayCard(selectedWildCard, color);
    setSelectedWildCard(null);
  };

  const handleChooseSwapTarget = (targetPlayerId: string) => {
    if (!selected7Card) return;
    if (soundEnabled) playSound('play');
    triggerHaptic('play');
    onPlayCard(selected7Card, undefined, targetPlayerId);
    setSelected7Card(null);
  };

  const handlePlay7WithoutSwap = () => {
    if (!selected7Card) return;
    if (soundEnabled) playSound('play');
    triggerHaptic('play');
    onPlayCard(selected7Card, undefined, undefined);
    setSelected7Card(null);
  };

  // Sort player cards
  const sortedCards = React.useMemo(() => {
    return [...myCards].sort((a, b) => {
      if (a.color !== b.color) return a.color.localeCompare(b.color);
      return a.value.localeCompare(b.value);
    });
  }, [myCards]);

  // Fast O(1) playability lookup set
  const playableCardIdSet = React.useMemo(() => {
    const set = new Set<string>();
    if (!isMyTurn) return set;
    for (const card of myCards) {
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
    myCards,
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
    for (const card of myCards) {
      if (isExactMatchForJumpIn(card, topCard)) {
        set.add(card.id);
      }
    }
    return set;
  }, [isMyTurn, myCards, topCard, gameState.rules.allowJumpIn, gameState.activePenalty]);

  const canPlayAnyCard = playableCardIdSet.size > 0;

  // Dynamic fan overlap when holding multiple cards
  const cardSpacingClass = React.useMemo(() => {
    const count = sortedCards.length;
    if (count <= 7) return 'space-x-1 sm:space-x-1.5';
    if (count <= 11) return '-space-x-2 sm:-space-x-2.5';
    if (count <= 16) return '-space-x-3.5 sm:-space-x-4';
    return '-space-x-5 sm:-space-x-6';
  }, [sortedCards.length]);

  return (
    <div className="h-[100dvh] w-full max-w-full overflow-hidden p-1 sm:p-2 bg-[#08080c] select-none relative box-border flex flex-col justify-between">
      {/* Top Combat Command Header Bar */}
      <header className="clip-chamfer-lg bg-[#0e0d12] border-2 border-neutral-800 z-20 px-2.5 sm:px-3.5 py-1.5 shrink-0 shadow-[4px_4px_0px_#000] flex items-center justify-between gap-2 w-full">
        {/* Left: Arena Identity & Play Direction */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 bg-red-600 border border-red-400 shrink-0 animate-pulse" />
            <span className="font-display font-black text-sm uppercase tracking-wider text-white truncate max-w-[90px] xs:max-w-[130px] sm:max-w-[200px]">
              {gameState.roomName}
            </span>
          </div>

          <div
            className="hidden xs:flex items-center space-x-1 px-2 py-0.5 clip-chamfer-btn bg-[#141219] border border-neutral-700 text-[10px] font-mono-hud text-neutral-300 font-bold shrink-0"
            title={`Direction: ${gameState.direction === 1 ? 'Clockwise' : 'Counter-Clockwise'}`}
          >
            <RotateCcw
              className={`w-3 h-3 text-red-400 ${gameState.direction === -1 ? '-scale-x-100' : ''}`}
            />
            <span className="hidden sm:inline uppercase">{gameState.direction === 1 ? 'CW' : 'CCW'}</span>
          </div>

          {gameState.rules.mercyLimit > 0 && (
            <span
              className="font-mono-hud text-[10px] font-black px-2 py-0.5 clip-chamfer-btn bg-red-950/80 text-red-300 border border-red-800 hidden md:inline-block uppercase tracking-wider"
              title="Players holding 25+ cards are instantly knocked out"
            >
              MERCY: {gameState.rules.mercyLimit}
            </span>
          )}
        </div>

        {/* Center: Turn Status & Isolated Smooth Timer */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <TurnTimerBadge
            isMyTurn={isMyTurn}
            currentPlayerName={currentPlayer?.name}
            turnTimeRemaining={gameState.turnTimeRemaining}
            turnTimerSeconds={gameState.rules.turnTimerSeconds}
            currentTurnIndex={gameState.currentTurnIndex}
            status={gameState.status}
          />
        </div>

        {/* Right: Actions, Fullscreen, Sound & Chat Drawer */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0 font-mono-hud text-xs">
          {/* Share Room Button */}
          <button
            type="button"
            onClick={async () => {
              const shareUrl = `${window.location.origin}/?room=${encodeURIComponent(gameState.roomId)}`;
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: `Join UNO No Mercy: ${gameState.roomName}`,
                    text: `Play UNO No Mercy with me in room ${gameState.roomId}!`,
                    url: shareUrl,
                  });
                  return;
                } catch {
                  // Fallback
                }
              }
              navigator.clipboard.writeText(shareUrl);
              setLinkCopied(true);
              setTimeout(() => setLinkCopied(false), 2000);
            }}
            className="btn-stamp-secondary clip-chamfer-btn p-1.5 bg-[#141219] hover:bg-[#1f1b26] border border-neutral-700 text-neutral-300 transition-colors cursor-pointer hidden md:block"
            title="Share Lobby Link"
          >
            {linkCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-amber-400" />}
          </button>

          {/* Handbook Guide */}
          <button
            type="button"
            onClick={onOpenReferee}
            className="btn-stamp-secondary clip-chamfer-btn hidden lg:flex items-center space-x-1 px-2.5 py-1 bg-[#141219] hover:bg-[#1f1b26] border border-neutral-700 text-amber-300 font-bold transition-all cursor-pointer uppercase"
            title="Combat Handbook"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Handbook</span>
          </button>

          {/* Rules */}
          <button
            type="button"
            onClick={onOpenRules}
            className="btn-stamp-secondary clip-chamfer-btn p-1.5 bg-[#141219] hover:bg-[#1f1b26] border border-neutral-700 text-neutral-300 transition-colors cursor-pointer hidden md:block"
            title="Official Rulebook"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`btn-stamp-secondary clip-chamfer-btn p-1.5 transition-all cursor-pointer flex items-center gap-1 ${
              !isFullscreen
                ? 'bg-[#1a1524] text-amber-300 border border-amber-500/60'
                : 'bg-[#141219] text-amber-400 border border-neutral-700'
            }`}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5 text-amber-300" />}
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="btn-stamp-secondary clip-chamfer-btn p-1.5 bg-[#141219] hover:bg-[#1f1b26] border border-neutral-700 text-neutral-300 transition-colors cursor-pointer"
            title={soundEnabled ? 'Mute' : 'Unmute'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-neutral-300" /> : <VolumeX className="w-3.5 h-3.5 text-neutral-500" />}
          </button>

          {/* Chat Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowChatDrawer(!showChatDrawer)}
            className={`btn-stamp-secondary clip-chamfer-btn relative flex items-center space-x-1.5 px-2.5 py-1 font-bold uppercase transition-all cursor-pointer ${
              showChatDrawer
                ? 'bg-red-600 text-white border-red-500 shadow-[2px_2px_0px_#000]'
                : 'bg-[#141219] hover:bg-[#1f1b26] text-neutral-200 border border-neutral-700'
            }`}
            title="Toggle In-Game Chat"
          >
            <MessageSquare className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden sm:inline">Feed</span>
            {unreadChatCount > 0 && !showChatDrawer && (
              <span className="px-1.5 py-0.2 bg-red-500 text-white clip-chamfer-btn text-[9px] font-black font-mono">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* Exit Match */}
          <button
            type="button"
            onClick={() => setShowLeaveConfirm(true)}
            className="btn-stamp-secondary clip-chamfer-btn p-1.5 bg-red-950/70 hover:bg-red-900 border border-red-800 text-red-400 hover:text-white transition-colors cursor-pointer"
            title="Exit Match"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Arena: Mobile Landscape vs Desktop/Portrait Arena */}
      {isLandscapeMobile ? (
        <LandscapeArena
          gameState={gameState}
          currentUserId={currentUserId}
          topCard={topCard}
          myCards={myCards}
          sortedCards={sortedCards}
          isMyTurn={isMyTurn}
          canPlayAnyCard={canPlayAnyCard}
          handleDrawCard={handleDrawCard}
          handleCardClick={handleCardClick}
          slamEffect={slamEffect}
          flipEffect={flipEffect}
          activeDrawFlight={activeDrawFlight}
          newlyDrawnCardIds={newlyDrawnCardIds}
          onCallUno={onCallUno}
          onCatchUno={onCatchUno}
          onSendTaunt={onSendTaunt}
          onSendMessage={onSendMessage}
          onResumeControl={onResumeControl}
        />
      ) : (
        /* Main Single-Screen Arena (Desktop & Portrait) */
        <main className="flex-1 flex flex-col justify-between relative clip-chamfer-lg bg-[#0e0d12] border-2 border-neutral-800 p-2 sm:p-3 my-1.5 shadow-[4px_4px_0px_#000] min-h-0 overflow-hidden w-full">
          {/* Opponents Area (Top arc strip) */}
          <div
            onWheel={(e) => {
              if (e.deltaY) e.currentTarget.scrollLeft += e.deltaY;
            }}
            className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto overflow-y-hidden scrollbar-minimal py-1 px-1 shrink-0 z-10 w-full"
          >
            {opponents.map((opp) => {
              const isOppTurn = gameState.players[gameState.currentTurnIndex]?.id === opp.id;
              const isDanger = opp.cards.length >= (gameState.rules.mercyLimit || 25) - 3;
              const oppTaunts = (gameState.activeTaunts || []).filter((t) => t.playerId === opp.id);

              return (
                <div
                  key={opp.id}
                  className={`relative px-2.5 py-1.5 h-11 sm:h-12 clip-chamfer border transition-all flex items-center space-x-2 shrink-0 shadow-[2px_2px_0px_#000] ${
                    opp.isEliminated
                      ? 'bg-[#0a0a0d] border-neutral-800 opacity-40 grayscale'
                      : isOppTurn
                      ? 'bg-red-950/80 border-red-500 ring-1 ring-red-500/60'
                      : 'bg-[#141219] border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <TableTauntFloating taunts={oppTaunts} placement="overlay" />

                  <MercyDangerMeter
                    player={opp}
                    mercyLimit={gameState.rules.mercyLimit}
                    isCurrentTurn={isOppTurn}
                    size="sm"
                  />

                  <div className="text-left font-mono-hud">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-display font-black text-xs text-white uppercase truncate max-w-[80px] sm:max-w-[110px]">
                        {opp.name}
                      </span>
                      {opp.cards.length === 1 && !opp.isEliminated && (
                        opp.hasCalledUno ? (
                          <span className="text-[8px] font-black uppercase px-1 py-0.2 clip-chamfer-btn bg-emerald-950 text-emerald-400 border border-emerald-600">
                            UNO ✓
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCatchUno?.(opp.id);
                            }}
                            className="btn-stamp-slam text-[8px] font-black uppercase px-1.5 py-0.5 clip-chamfer-btn bg-red-600 hover:bg-red-500 text-white border border-amber-300 shadow-md cursor-pointer flex items-center gap-0.5"
                            title={`Catch ${opp.name} for not calling UNO! (+2 penalty cards)`}
                          >
                            🚨 CATCH!
                          </button>
                        )
                      )}
                    </div>

                    <div className="flex items-center space-x-1 text-[10px] font-bold">
                      {opp.isEliminated ? (
                        <span className="text-red-500 font-black uppercase">MERCY KO</span>
                      ) : (
                        <span
                          className={`flex items-center gap-0.5 ${
                            isDanger ? 'text-red-400 font-black animate-pulse' : 'text-neutral-400'
                          }`}
                        >
                          <Layers className="w-2.5 h-2.5" />
                          <span>{opp.cards.length}/{gameState.rules.mercyLimit || 25}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Center Table Arena (Discard Pile, Draw Deck, Active Stacking Alarm) */}
          <div className="flex-1 flex flex-col items-center justify-center relative z-10 py-1 min-h-[190px] sm:min-h-[230px] my-auto">
            {/* Active Stacking Penalty Alarm Banner */}
            {gameState.activePenalty > 0 && (
              <div className="mb-3 px-3.5 py-1 clip-chamfer bg-gradient-to-r from-red-600 to-amber-600 text-white font-mono-hud font-black text-xs tracking-wider uppercase flex items-center space-x-1.5 shadow-[4px_4px_0px_#000] border-2 border-amber-300 animate-pulse shrink-0">
                <Flame className="w-4 h-4 text-amber-300" />
                <span>+{gameState.activePenalty} PENALTY STACK ACTIVE</span>
              </div>
            )}

            {/* 7-Swap or 0-Pass Event Flash Banner */}
            {flipEffect && (
              <div className="mb-2 px-3 py-1 clip-chamfer bg-amber-400 text-black font-display font-black text-xs uppercase tracking-wider flex items-center space-x-2 shadow-[3px_3px_0px_#000] border-2 border-white shrink-0 animate-bounce">
                <Sparkles className="w-4 h-4 text-black" />
                <span>{topCard.value === '7' ? '🔄 7s MANDATORY HAND SWAP!' : '🔁 0s PASS ALL HANDS!'}</span>
              </div>
            )}

            {/* Central Piles: Draw Deck & Discard Pile */}
            <div className="flex items-center justify-center gap-6 sm:gap-12 relative">
              {/* Draw Pile */}
              <div className="flex flex-col items-center relative">
                <motion.button
                  id="uno-draw-deck"
                  type="button"
                  onClick={handleDrawCard}
                  disabled={!isMyTurn}
                  whileHover={isMyTurn ? { scale: 1.04 } : undefined}
                  whileTap={isMyTurn ? { scale: 0.96 } : undefined}
                  style={{ transform: 'translate3d(0, 0, 0)' }}
                  className={`group relative clip-chamfer-btn transition-all duration-150 ${
                    isMyTurn
                      ? 'cursor-pointer border-2 border-red-500 ring-2 ring-red-500/70 shadow-[4px_4px_0px_#000]'
                      : 'border border-neutral-700 opacity-90'
                  }`}
                  title={isMyTurn ? 'Your Turn: Click to draw a card' : 'Draw Pile'}
                >
                  <UnoCard
                    card={{ id: 'back', color: 'wild', value: 'wild' }}
                    showBack
                    size={isShortHeight ? 'md' : 'lg'}
                  />
                  <div className="absolute -bottom-2 inset-x-0 flex justify-center">
                    <span className={`px-2.5 py-0.5 clip-chamfer-btn border font-mono-hud text-[10px] font-black uppercase shadow-md transition-colors ${
                      isMyTurn
                        ? 'bg-red-950 border-red-500 text-red-300'
                        : 'bg-neutral-900 border-neutral-700 text-amber-300'
                    }`}>
                      {gameState.drawPileCount} DECK
                    </span>
                  </div>
                </motion.button>

                <span className="mt-2.5 font-mono-hud text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  Draw Pile
                </span>
              </div>

              {/* Discard Pile */}
              <div className="flex flex-col items-center relative">
                <motion.div
                  animate={
                    slamEffect
                      ? { scale: [1, 1.25, 0.95, 1], rotate: [0, -8, 6, 0] }
                      : flipEffect
                      ? { rotateY: [0, 180, 360] }
                      : {}
                  }
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="relative"
                >
                  <UnoCard card={topCard} size={isShortHeight ? 'md' : 'lg'} disabled />

                  {/* Active Color Ring */}
                  <div
                    className={`absolute -inset-1.5 clip-chamfer -z-10 border-2 transition-all duration-300 blur-[2px] ${
                      gameState.currentColor === 'red'
                        ? 'border-red-500 shadow-[0_0_20px_#ff1f35]'
                        : gameState.currentColor === 'blue'
                        ? 'border-blue-500 shadow-[0_0_20px_#0088ff]'
                        : gameState.currentColor === 'green'
                        ? 'border-emerald-500 shadow-[0_0_20px_#00d655]'
                        : 'border-amber-400 shadow-[0_0_20px_#ffcc00]'
                    }`}
                  />
                </motion.div>

                <div className="mt-2.5 flex items-center space-x-1 font-mono-hud text-[10px] font-bold">
                  <span className="text-neutral-400 uppercase">COLOR:</span>
                  <span
                    className={`uppercase font-black ${
                      gameState.currentColor === 'red'
                        ? 'text-red-400'
                        : gameState.currentColor === 'blue'
                        ? 'text-sky-400'
                        : gameState.currentColor === 'green'
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {gameState.currentColor}
                  </span>
                </div>
              </div>
            </div>

            {/* Card Hint Toast Notification */}
            {cardHint && (
              <div className="absolute top-2 inset-x-0 flex justify-center z-40 px-4 pointer-events-none animate-fadeIn font-mono-hud">
                <div className="bg-[#181216] border-2 border-red-600 text-red-200 px-3.5 py-1.5 clip-chamfer shadow-[4px_4px_0px_#000] text-xs font-bold flex items-center space-x-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  <span>{cardHint}</span>
                </div>
              </div>
            )}
          </div>

          {/* Player's Hand Area (Bottom - Compact Height without Dead Space) */}
          <div className="relative pt-1.5 border-t-2 border-neutral-800 z-30 shrink-0 overflow-visible">
            {me?.isEliminated ? (
              <SpectatorBooth
                gameState={gameState}
                currentUserId={currentUserId}
                onSendTaunt={onSendTaunt || (() => {})}
                onSendMessage={onSendMessage}
                onResumeControl={onResumeControl}
              />
            ) : (
              <>
                {/* AFK Bot Takeover Alert */}
                {(me?.isAfk || me?.isBot) && (
                  <div className="mb-1.5 px-3 py-1.5 clip-chamfer bg-amber-950/90 border border-amber-500 text-amber-200 flex items-center justify-between gap-2 shadow-[2px_2px_0px_#000]">
                    <div className="flex items-center gap-2 text-xs font-mono-hud font-bold truncate">
                      <Bot className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="truncate uppercase">Bot Autopilot is executing your turns</span>
                    </div>
                    <button
                      type="button"
                      onClick={onResumeControl}
                      className="btn-stamp-slam clip-chamfer-btn px-3 py-1 bg-amber-400 text-black text-xs font-display font-black uppercase cursor-pointer"
                    >
                      Resume Control
                    </button>
                  </div>
                )}

                {/* Control Bar: Hand count, Mercy Meter, Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1 font-mono-hud">
                  {/* Left: Hand Count & Mercy Status */}
                  <div className="flex items-center space-x-2">
                    {me && (
                      <div className="relative">
                        <TableTauntFloating
                          taunts={(gameState.activeTaunts || []).filter((t) => t.playerId === me.id)}
                        />
                        <MercyDangerMeter
                          player={me}
                          mercyLimit={gameState.rules.mercyLimit}
                          isCurrentTurn={isMyTurn}
                          size="sm"
                        />
                      </div>
                    )}

                    <div className="flex items-center space-x-1.5">
                      <span className="font-display font-black text-sm text-white uppercase tracking-wide">
                        Your Hand ({myCards.length})
                      </span>
                      {canScrollRight && (
                        <button
                          type="button"
                          onClick={() => handScrollRef.current?.scrollBy({ left: 240, behavior: 'smooth' })}
                          className="btn-stamp-secondary clip-chamfer-btn flex items-center gap-0.5 px-2 py-0.5 bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-bold cursor-pointer"
                        >
                          <span>MORE</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                      {gameState.rules.mercyLimit > 0 && (
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 clip-chamfer-btn border ${
                            myCards.length >= gameState.rules.mercyLimit - 4
                              ? 'bg-red-950 text-red-300 border-red-600 animate-pulse'
                              : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                          }`}
                        >
                          MERCY: {myCards.length}/{gameState.rules.mercyLimit}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Action Buttons (Catch UNO, Draw, Shout UNO, Emote Wheel) */}
                  <div className="flex items-center space-x-1.5 font-mono-hud">
                    {/* Bot Takeover Resume Control */}
                    {(me?.isAfk || me?.isBot) && (
                      <button
                        type="button"
                        onClick={onResumeControl}
                        className="btn-stamp-slam clip-chamfer-btn px-3 py-1 bg-amber-400 text-black font-display font-black text-xs uppercase cursor-pointer"
                      >
                        Resume Play
                      </button>
                    )}

                    {/* Catch uncalled opponents */}
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
                          className="btn-stamp-slam clip-chamfer-btn px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-display font-black text-xs uppercase border border-amber-300 shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1"
                        >
                          🚨 CATCH {target.name.split(' ')[0]}!
                        </button>
                      ))}

                    {/* Draw / Take Penalty Action Button */}
                    {isMyTurn && !canPlayAnyCard && (
                      <button
                        type="button"
                        onClick={handleDrawCard}
                        className="btn-stamp-slam clip-chamfer-btn px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-display font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_#000] cursor-pointer"
                      >
                        {gameState.activePenalty > 0 ? `Take Penalty (+${gameState.activePenalty})` : 'Draw Card'}
                      </button>
                    )}

                    {/* UNO Button */}
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
                            className="btn-stamp-slam clip-chamfer-btn px-3 py-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-black font-display font-black text-xs uppercase tracking-wider border-2 border-white shadow-[2px_2px_0px_#000] cursor-pointer animate-pulse"
                          >
                            📢 SHOUT UNO!
                          </button>
                        );
                      }
                      if (hasCalledUnoSafe) {
                        return (
                          <div
                            className="flex items-center gap-1 px-2.5 py-1 clip-chamfer-btn bg-emerald-950 border border-emerald-500 text-emerald-400 text-[10px] font-black uppercase"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>UNO SAFE</span>
                          </div>
                        );
                      }
                      return (
                        <button
                          type="button"
                          disabled
                          className="clip-chamfer-btn px-2.5 py-1 bg-neutral-900 border border-neutral-800 text-neutral-600 font-bold text-[10px] uppercase cursor-not-allowed opacity-50"
                        >
                          UNO (OFF)
                        </button>
                      );
                    })()}

                    {/* Quick Emote Taunt Wheel */}
                    {onSendTaunt && <QuickEmoteWheel onSendEmote={onSendTaunt} />}
                  </div>
                </div>

                {/* Hand Cards Horizontal Scroller - Tightened Top Clearance */}
                <div className="relative group">
                  {canScrollLeft && (
                    <>
                      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-neutral-950 to-transparent z-20" />
                      <button
                        type="button"
                        onClick={() => handScrollRef.current?.scrollBy({ left: -220, behavior: 'smooth' })}
                        className="btn-stamp-secondary clip-chamfer-btn absolute left-1 top-1/2 -translate-y-1/2 z-30 p-1 bg-neutral-900 border border-neutral-700 text-white shadow-xl hover:bg-red-600 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
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
                    className={`flex items-end ${cardSpacingClass} overflow-x-auto pt-4 sm:pt-5 pb-1 px-2 min-h-[6.5rem] sm:min-h-[7.4rem] scrollbar-minimal overflow-y-visible`}
                  >
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
                          isNewlyDrawn={newlyDrawnCardIds.has(card.id)}
                          size={isShortHeight ? 'sm' : 'md'}
                          onCardClick={handleCardClick}
                        />
                      );
                    })}
                  </div>

                  {canScrollRight && (
                    <>
                      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-neutral-950 to-transparent z-20" />
                      <button
                        type="button"
                        onClick={() => handScrollRef.current?.scrollBy({ left: 220, behavior: 'smooth' })}
                        className="btn-stamp-secondary clip-chamfer-btn absolute right-1 top-1/2 -translate-y-1/2 z-30 flex items-center gap-0.5 p-1 bg-neutral-900 border border-neutral-700 text-white shadow-xl hover:bg-red-600 cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      )}

      {/* Floating In-Game Chat Drawer Modal */}
      {showChatDrawer && (
        <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-50 w-80 sm:w-96 max-w-[92vw] h-[70vh] sm:h-[75vh] flex flex-col clip-chamfer-lg bg-[#0e0d12] border-2 border-neutral-700 shadow-[6px_6px_0px_#000] overflow-hidden animate-fadeIn">
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#141219] border-b-2 border-neutral-800 font-mono-hud">
            <div className="flex items-center space-x-2 text-xs font-bold text-white">
              <MessageSquare className="w-4 h-4 text-red-500" />
              <span className="uppercase">Combat Transmissions</span>
            </div>
            <button
              type="button"
              onClick={() => setShowChatDrawer(false)}
              className="btn-stamp-secondary clip-chamfer-btn p-1 text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden p-2">
            <ChatPanel
              messages={chatMessages}
              onSendMessage={onSendMessage}
              currentUserId={currentUserId}
              isGameActive
            />
          </div>
        </div>
      )}

      {/* Wild Color Selection Modal */}
      {selectedWildCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="clip-chamfer-lg bg-[#0e0d12] border-2 border-neutral-700 p-5 sm:p-6 w-full max-w-sm text-center shadow-[8px_8px_0px_#000] space-y-4">
            <div className="space-y-1">
              <h3 className="font-display font-black text-xl uppercase tracking-wider text-white">
                Choose Wild Color
              </h3>
              <p className="font-mono-hud text-[11px] text-neutral-400">
                Designate the active combat color to continue play:
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1 font-mono-hud">
              {[
                { color: 'red', label: 'Red', bg: 'bg-red-600 hover:bg-red-500 text-white border-red-400' },
                { color: 'blue', label: 'Blue', bg: 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400' },
                { color: 'green', label: 'Green', bg: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400' },
                { color: 'yellow', label: 'Yellow', bg: 'bg-amber-400 hover:bg-amber-300 text-black border-yellow-200' },
              ].map((c) => (
                <button
                  key={c.color}
                  type="button"
                  onClick={() => handleChooseColor(c.color as CardColor)}
                  className={`btn-stamp-slam clip-chamfer-btn p-3 font-display font-black text-sm uppercase tracking-wider border shadow-[3px_3px_0px_#000] cursor-pointer ${c.bg}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSelectedWildCard(null)}
              className="btn-stamp-secondary clip-chamfer-btn w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white font-mono-hud font-bold text-xs border border-neutral-700 transition-colors cursor-pointer uppercase"
            >
              Cancel (Pick a Different Card)
            </button>
          </div>
        </div>
      )}

      {/* 7s Hand Swap Modal (Mandatory or Optional based on Lobby Rules) */}
      {selected7Card && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="clip-chamfer-lg bg-[#0e0d12] border-2 border-amber-500/80 p-5 sm:p-6 w-full max-w-md text-center shadow-[8px_8px_0px_#000] space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-1.5">
                <span
                  className={`font-mono-hud text-[10px] font-black px-2.5 py-0.5 border uppercase tracking-wider ${
                    gameState.rules.allow7Swap
                      ? 'bg-amber-950 text-amber-300 border-amber-700'
                      : 'bg-neutral-900 text-neutral-300 border-neutral-700'
                  }`}
                >
                  {gameState.rules.allow7Swap
                    ? 'MATTEL HVW18 MANDATORY RULE'
                    : 'CUSTOM RULE: OPTIONAL SWAP'}
                </span>
              </div>
              <h3 className="font-display font-black text-2xl uppercase tracking-wider text-amber-400 flex items-center justify-center gap-2">
                <Shuffle className="w-5 h-5" />{' '}
                {gameState.rules.allow7Swap ? '7s Mandatory Hand Swap' : '7s Hand Swap (Optional)'}
              </h3>
              <p className="font-mono-hud text-xs text-neutral-300 leading-normal">
                {gameState.rules.allow7Swap
                  ? 'Playing a 7 forces you to exchange your entire hand with a chosen contender:'
                  : 'Choose a contender to swap hands with, or play without swapping and keep your hand:'}
              </p>
            </div>

            <div className="space-y-2 pt-1 max-h-60 overflow-y-auto font-mono-hud">
              {opponents
                .filter((p) => !p.isEliminated)
                .map((target) => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => handleChooseSwapTarget(target.id)}
                    className="btn-stamp-secondary clip-chamfer-btn w-full p-3 bg-[#141219] hover:bg-amber-950/60 border border-neutral-800 hover:border-amber-500 flex items-center justify-between text-xs font-bold text-white transition-all cursor-pointer shadow-[2px_2px_0px_#000]"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="text-xl">{target.avatar}</span>
                      <span className="font-display font-black text-sm uppercase">{target.name}</span>
                    </div>
                    <span className="text-amber-400 font-black px-2 py-0.5 bg-black/50 border border-amber-500/40">
                      SWAP HAND ({target.cards.length} CARDS)
                    </span>
                  </button>
                ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-neutral-800">
              {/* If 7-Swap rule is OFF in lobby, provide the option to play without swapping */}
              {!gameState.rules.allow7Swap && (
                <button
                  type="button"
                  onClick={handlePlay7WithoutSwap}
                  className="btn-stamp-slam clip-chamfer-btn w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-display font-black text-sm uppercase tracking-wider border-2 border-emerald-400 shadow-[3px_3px_0px_#000] cursor-pointer transition-all"
                >
                  🃏 Play Without Swapping (Keep Hand)
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelected7Card(null)}
                className="btn-stamp-secondary clip-chamfer-btn w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white font-mono-hud font-bold text-xs border border-neutral-700 transition-colors cursor-pointer uppercase"
              >
                Cancel (Pick a Different Card)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Elimination Highlight / Killcam Banner */}
      {gameState.lastElimination && gameState.lastElimination.victimId === currentUserId && (
        <KillcamHighlight
          highlight={gameState.lastElimination?.id === dismissedKillcamId ? undefined : gameState.lastElimination}
          onDismiss={() => {
            if (gameState.lastElimination?.id) {
              setDismissedKillcamId(gameState.lastElimination.id);
            }
          }}
        />
      )}

      {/* Non-intrusive Toast for other active players when someone is knocked out */}
      {gameState.lastElimination && gameState.lastElimination.victimId !== currentUserId && gameState.lastElimination.id !== dismissedKillcamId && (
        <div className="fixed top-3 inset-x-0 z-40 flex justify-center pointer-events-none px-4 animate-fadeIn font-mono-hud">
          <div className="bg-red-950/95 border-2 border-red-600 text-white px-4 py-1.5 clip-chamfer shadow-[4px_4px_0px_#000] text-xs font-black flex items-center space-x-2">
            <span>💀</span>
            <span className="uppercase">{gameState.lastElimination.victimName} knocked out by Mercy limit!</span>
            <span className="text-[10px] text-red-300 font-normal">({gameState.lastElimination.cardCount} cards)</span>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameState.status === 'ended' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-fadeIn font-mono-hud">
          <div className="clip-chamfer-lg bg-[#0e0d12] border-2 border-amber-500 p-6 sm:p-8 w-full max-w-lg text-center shadow-[10px_10px_0px_#000] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="w-16 h-16 clip-chamfer-btn bg-amber-500/20 border-2 border-amber-400 text-amber-400 flex items-center justify-center mx-auto text-3xl shadow-[3px_3px_0px_#000]">
              <Trophy className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-wider">
                {gameState.winnerId === currentUserId ? 'VICTORY SECURED!' : 'MATCH CONCLUDED'}
              </h2>
              <p className="text-xs text-neutral-400 font-sans">
                {gameState.winnerReason === 'mercy_eliminations'
                  ? 'Last survivor standing through brutal 25-Card Mercy eliminations!'
                  : 'Successfully cleared all cards from hand!'}
              </p>
            </div>

            <div className="p-4 clip-chamfer bg-[#141219] border border-neutral-800 flex items-center justify-between text-left shadow-[2px_2px_0px_#000]">
              <div>
                <span className="text-[10px] text-amber-400 uppercase font-black tracking-widest block">
                  ARENA CHAMPION
                </span>
                <span className="font-display font-black text-xl text-white uppercase">
                  {gameState.players.find((p) => p.id === gameState.winnerId)?.name}
                </span>
              </div>
              <span className="text-3xl">
                {gameState.players.find((p) => p.id === gameState.winnerId)?.avatar}
              </span>
            </div>

            {/* Match Highlights & Awards Podium */}
            <MatchAwardsPodium awards={gameState.awards} />

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              {onReturnToLobby && (
                <button
                  type="button"
                  onClick={onReturnToLobby}
                  className="btn-stamp-secondary clip-chamfer-btn w-full sm:flex-1 py-3 px-3 bg-amber-400 hover:bg-amber-300 text-black font-display font-black text-sm uppercase tracking-wider cursor-pointer"
                >
                  Return to Lobby
                </button>
              )}
              <button
                type="button"
                onClick={onRestartGame}
                className="btn-stamp-slam clip-chamfer-btn w-full sm:flex-1 py-3 px-3 bg-red-600 hover:bg-red-500 text-white font-display font-black text-sm uppercase tracking-wider cursor-pointer"
              >
                Instant Rematch
              </button>
              <button
                type="button"
                onClick={onLeaveGame}
                className="btn-stamp-secondary clip-chamfer-btn w-full sm:w-auto py-3 px-4 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white font-mono-hud font-bold text-xs border border-neutral-700 cursor-pointer uppercase"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Match Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn font-mono-hud">
          <div className="w-full max-w-sm clip-chamfer-lg bg-[#0e0d12] border-2 border-red-600 p-5 sm:p-6 shadow-[8px_8px_0px_#000] flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 clip-chamfer-btn bg-red-950 border border-red-600 flex items-center justify-center">
              <LogOut className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="font-display font-black text-2xl uppercase tracking-wide text-white">
              Retreat from Arena?
            </h3>
            <p className="text-xs text-neutral-400 font-sans leading-relaxed">
              Are you sure you want to retreat? A bot will take over your cards so other contenders can continue the battle smoothly.
            </p>
            <div className="flex items-center space-x-2.5 w-full pt-2">
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="btn-stamp-secondary clip-chamfer-btn flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-bold border border-neutral-700 transition-colors cursor-pointer uppercase"
              >
                Stay & Fight
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLeaveConfirm(false);
                  onLeaveGame();
                }}
                className="btn-stamp-slam clip-chamfer-btn flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-display font-black uppercase tracking-wider cursor-pointer"
              >
                Retreat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Card Deal Flight Overlay */}
      <CardDealFlight flight={activeDrawFlight || opponentDrawFlight} isLandscape={isLandscapeMobile} />
    </div>
  );
};
