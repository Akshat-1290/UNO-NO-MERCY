import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardColor, GameState, Player, ChatMessage } from '@uno/shared/types';
import { UnoCard } from './UnoCard';
import { HandCardItem } from './HandCardItem';
import {
  CardDealFlight,
  DrawFlightData,
  InitialDealConfig,
  PlayedCardFlightData,
} from './CardDealFlight';
import { MercyDangerMeter } from './MercyDangerMeter';
import { QuickEmoteWheel } from './QuickEmoteWheel';
import { TableTauntFloating } from './TableTauntFloating';
import { SpectatorBooth } from './SpectatorBooth';
import { LandscapeArena } from './LandscapeArena';
import { TurnTimerBadge } from './board/TurnTimerBadge';
import { GameBoardModals } from './board/GameBoardModals';
import {
  isExactMatchForJumpIn,
  isValidPlay,
  isWildCard,
  getPenaltyAmount,
  preloadAllCardImages,
} from '@uno/shared/unoDeck';
import { playSound, stopCardAnimationSounds } from '../utils/sound';
import { useSequentialGameQueue } from '../utils/gameEventQueue';
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
  Zap,
  LogOut,
  Share2,
  Check,
  AlertTriangle,
  BookOpen,
  MessageSquare,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
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

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState: incomingGameState,
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
  const lastLocalPlayedCardIdRef = useRef<string | null>(null);
  const {
    displayedGameState: gameState,
    playbackSpeed,
    tabResumeCount,
    lockAnimation,
    unlockAnimation,
  } = useSequentialGameQueue(incomingGameState, lastLocalPlayedCardIdRef);

  const [selectedWildCard, setSelectedWildCard] = useState<Card | null>(null);
  const [selected7Card, setSelected7Card] = useState<Card | null>(null);
  const [dismissedKillcamId, setDismissedKillcamId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [slamEffect, setSlamEffect] = useState(false);
  const [flipEffect, setFlipEffect] = useState(false);
  const [swapBannerText, setSwapBannerText] = useState<string>('🔁 0s PASS ALL HANDS!');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [cardHint, setCardHint] = useState<string | null>(null);
  const cardHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swapEffectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slamEffectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elimToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playedFlightSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedLogIdsRef = useRef<Set<string>>(new Set());
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(false);
  const [isShortHeight, setIsShortHeight] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Preload all 85 card textures into browser memory cache on mount for zero-flicker transitions
  useEffect(() => {
    preloadAllCardImages();
  }, []);

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
  const opponents = gameState.players.filter((p) => p.id !== currentUserId);
  const topCard = gameState.discardPile[gameState.discardPile.length - 1] || {
    id: 'empty',
    color: 'red',
    value: '5',
  };
  const topCardRef = useRef<Card>(topCard);
  topCardRef.current = topCard;

  // settledDiscardCard holds the card currently resting on #uno-discard-pile.
  // It only updates to topCard once a flying card lands, preventing 1-frame flashes before/after flight.
  const [settledDiscardCard, setSettledDiscardCard] = useState<Card>(topCard);

  // Card Draw & Dealer Flight Tracking
  const prevMyCardsRef = useRef<Card[]>(myCards);
  const [newlyDrawnCardIds, setNewlyDrawnCardIds] = useState<Set<string>>(new Set());
  const [dealingHiddenCardIds, setDealingHiddenCardIds] = useState<Set<string>>(new Set());
  const [activeDrawFlight, setActiveDrawFlight] = useState<DrawFlightData | null>(null);
  const [initialDeal, setInitialDeal] = useState<InitialDealConfig | null>(null);
  const [playedFlight, setPlayedFlight] = useState<PlayedCardFlightData | null>(null);
  const [inFlightDiscardCardId, setInFlightDiscardCardId] = useState<string | null>(null);
  const lastDealtMatchKeyRef = useRef<string>('');
  const initialDealSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawFlightSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const oppFlightSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPlayStartRectRef = useRef<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  // Synchronously detect if a fresh match or rematch is starting on Frame 0 before useEffects run
  const currentMatchKey = `${gameState.roomId}_${gameState.startedAt || 'match'}`;
  const isPendingInitialDeal =
    gameState.status === 'playing' &&
    lastDealtMatchKeyRef.current !== currentMatchKey &&
    gameState.discardPile.length <= 2 &&
    myCards.length > 0;
  const isInitialDealing = Boolean(initialDeal) || isPendingInitialDeal;

  const triggerSlamPulse = useCallback(() => {
    setSlamEffect(true);
    if (slamEffectTimerRef.current) {
      clearTimeout(slamEffectTimerRef.current);
    }
    slamEffectTimerRef.current = setTimeout(() => {
      slamEffectTimerRef.current = null;
      setSlamEffect(false);
    }, 600);
  }, []);

  const triggerSwapBanner = useCallback(
    (bannerLabel: string) => {
      setSwapBannerText(bannerLabel);
      setFlipEffect(true);
      lockAnimation('hand_swap', 850);
      if (swapEffectTimerRef.current) {
        clearTimeout(swapEffectTimerRef.current);
      }
      swapEffectTimerRef.current = setTimeout(() => {
        swapEffectTimerRef.current = null;
        setFlipEffect(false);
        unlockAnimation('hand_swap');
      }, 900);
    },
    [lockAnimation, unlockAnimation]
  );

  // Clean up all transient timers on unmount
  useEffect(() => {
    return () => {
      if (cardHintTimeoutRef.current) clearTimeout(cardHintTimeoutRef.current);
      if (swapEffectTimerRef.current) clearTimeout(swapEffectTimerRef.current);
      if (slamEffectTimerRef.current) clearTimeout(slamEffectTimerRef.current);
      if (elimToastTimerRef.current) clearTimeout(elimToastTimerRef.current);
      if (playedFlightSafetyTimerRef.current) clearTimeout(playedFlightSafetyTimerRef.current);
      if (initialDealSafetyTimerRef.current) clearTimeout(initialDealSafetyTimerRef.current);
      if (drawFlightSafetyTimerRef.current) clearTimeout(drawFlightSafetyTimerRef.current);
      if (oppFlightSafetyTimerRef.current) clearTimeout(oppFlightSafetyTimerRef.current);
      if (highlightSafetyTimerRef.current) clearTimeout(highlightSafetyTimerRef.current);
    };
  }, []);

  // Auto-dismiss non-victim Mercy KO toast after 3.8 seconds so it never lingers
  useEffect(() => {
    const elim = gameState.lastElimination;
    if (!elim || elim.victimId === currentUserId || elim.id === dismissedKillcamId) {
      return;
    }
    if (elimToastTimerRef.current) {
      clearTimeout(elimToastTimerRef.current);
    }
    const targetId = elim.id;
    elimToastTimerRef.current = setTimeout(() => {
      elimToastTimerRef.current = null;
      setDismissedKillcamId(targetId);
    }, 3800);
  }, [gameState.lastElimination, currentUserId, dismissedKillcamId]);

  const handleCardLanded = useCallback((cardId: string) => {
    setDealingHiddenCardIds((prev) => {
      if (!prev.has(cardId)) return prev;
      const next = new Set(prev);
      next.delete(cardId);
      return next;
    });
  }, []);

  const handleRevealDiscardCard = useCallback((card: Card) => {
    setSettledDiscardCard(card);
  }, []);

  const handleInitialDealComplete = useCallback(() => {
    if (initialDealSafetyTimerRef.current) {
      clearTimeout(initialDealSafetyTimerRef.current);
      initialDealSafetyTimerRef.current = null;
    }
    setSettledDiscardCard(topCardRef.current);
    setDealingHiddenCardIds(new Set());
    setInitialDeal(null);
    unlockAnimation('initial_deal');
  }, [unlockAnimation]);

  const handlePlayedCardLanded = useCallback(
    (cardId: string) => {
      if (playedFlightSafetyTimerRef.current) {
        clearTimeout(playedFlightSafetyTimerRef.current);
        playedFlightSafetyTimerRef.current = null;
      }
      setSettledDiscardCard(topCardRef.current);
      setInFlightDiscardCardId((prev) => (prev === cardId ? null : prev));
      setPlayedFlight((prev) => (prev?.card.id === cardId ? null : prev));
      unlockAnimation('played_flight');
    },
    [unlockAnimation]
  );

  const handleFlightComplete = useCallback(() => {
    if (drawFlightSafetyTimerRef.current) {
      clearTimeout(drawFlightSafetyTimerRef.current);
      drawFlightSafetyTimerRef.current = null;
    }
    setActiveDrawFlight(null);
    setDealingHiddenCardIds(new Set());
    unlockAnimation('player_draw');
  }, [unlockAnimation]);

  const handleOpponentFlightComplete = useCallback(() => {
    if (oppFlightSafetyTimerRef.current) {
      clearTimeout(oppFlightSafetyTimerRef.current);
      oppFlightSafetyTimerRef.current = null;
    }
    setOpponentDrawFlight(null);
    setOppHiddenDrawCounts({});
    unlockAnimation('opponent_draw');
  }, [unlockAnimation]);

  const handleOpponentCardLanded = useCallback(
    (opponentId: string, remainingHidden: number) => {
      setOppHiddenDrawCounts((prev) => {
        if ((prev[opponentId] || 0) === remainingHidden) return prev;
        return {
          ...prev,
          [opponentId]: remainingHidden,
        };
      });
    },
    []
  );

  // Opponent card draw tracking
  const prevOpponentCardsRef = useRef<Map<string, number>>(new Map());
  const lastProcessedRouletteIdRef = useRef<string>('');
  const [opponentDrawFlight, setOpponentDrawFlight] = useState<DrawFlightData | null>(null);
  const [oppHiddenDrawCounts, setOppHiddenDrawCounts] = useState<Record<string, number>>({});

  // Trigger Opening Match Dealer Sequence when a fresh match begins (Works in Bot & Human lobbies)
  useEffect(() => {
    if (gameState.status !== 'playing') {
      if (initialDealSafetyTimerRef.current) {
        clearTimeout(initialDealSafetyTimerRef.current);
        initialDealSafetyTimerRef.current = null;
      }
      if (swapEffectTimerRef.current) {
        clearTimeout(swapEffectTimerRef.current);
        swapEffectTimerRef.current = null;
      }
      stopCardAnimationSounds(0.02);
      setFlipEffect(false);
      setSlamEffect(false);
      setDealingHiddenCardIds(new Set());
      setInitialDeal(null);
      setActiveDrawFlight(null);
      setOpponentDrawFlight(null);
      setOppHiddenDrawCounts({});
      setPlayedFlight(null);
      setInFlightDiscardCardId(null);
      setSettledDiscardCard(topCard);
      prevMyCardsRef.current = [];
      prevOpponentCardsRef.current = new Map();
      return;
    }

    const matchKey = `${gameState.roomId}_${gameState.startedAt || 'match'}`;
    if (lastDealtMatchKeyRef.current !== matchKey && myCards.length > 0) {
      lastDealtMatchKeyRef.current = matchKey;

      // Reset transient banners & refs from any previous match
      if (swapEffectTimerRef.current) {
        clearTimeout(swapEffectTimerRef.current);
        swapEffectTimerRef.current = null;
      }
      if (playedFlightSafetyTimerRef.current) {
        clearTimeout(playedFlightSafetyTimerRef.current);
        playedFlightSafetyTimerRef.current = null;
      }
      setFlipEffect(false);
      setSlamEffect(false);
      setPlayedFlight(null);
      setInFlightDiscardCardId(null);
      setSettledDiscardCard(topCard);
      prevTopCardIdRef.current = topCard.id;
      lastLocalPlayedCardIdRef.current = null;
      processedLogIdsRef.current = new Set((gameState.logs || []).map((l) => l.id));

      const isFreshStart = gameState.discardPile.length <= 2;

      if (isFreshStart) {
        const startHiddenIds = new Set(myCards.map((c) => c.id));
        setDealingHiddenCardIds(startHiddenIds);
        setActiveDrawFlight(null);
        setOpponentDrawFlight(null);
        setOppHiddenDrawCounts({});
        lastProcessedRouletteIdRef.current = gameState.lastRouletteDraw?.id || '';
        prevMyCardsRef.current = myCards;
        const initOppMap = new Map<string, number>();
        gameState.players.forEach((p) => {
          if (p.id !== currentUserId) initOppMap.set(p.id, p.cards.length);
        });
        prevOpponentCardsRef.current = initOppMap;

        lockAnimation('initial_deal', 2100);
        setInitialDeal({
          id: matchKey,
          myCards: [...myCards],
          opponentIds: gameState.players
            .filter((p) => p.id !== currentUserId && !p.isEliminated)
            .map((p) => p.id),
          starterCard: topCard,
          soundEnabled,
        });

        if (initialDealSafetyTimerRef.current) {
          clearTimeout(initialDealSafetyTimerRef.current);
        }
        initialDealSafetyTimerRef.current = setTimeout(() => {
          setSettledDiscardCard(topCardRef.current);
          setDealingHiddenCardIds(new Set());
          setInitialDeal(null);
          unlockAnimation('initial_deal');
        }, 2400);
      }
    }
  }, [
    gameState.status,
    gameState.roomId,
    gameState.startedAt,
    gameState.discardPile.length,
    gameState.logs,
    currentUserId,
    myCards,
    topCard,
    soundEnabled,
    lockAnimation,
    unlockAnimation,
  ]);

  // Process newly arrived game logs (Swap banners, UNO shouts, Mercy KOs) idempotently by log.id
  const hasNewSwapInLogs = React.useMemo(() => {
    const logs = gameState.logs || [];
    for (let i = Math.max(0, logs.length - 4); i < logs.length; i++) {
      const l = logs[i];
      if (l?.type === 'swap' && l.id && !processedLogIdsRef.current.has(l.id)) {
        return true;
      }
    }
    return false;
  }, [gameState.logs]);

  // Synchronously detect newly drawn cards on Frame 0 (before useEffect runs) so they never flash in hand before flight
  const effectiveDealingHiddenCardIds = React.useMemo(() => {
    const lastLog = gameState.logs?.[gameState.logs.length - 1];
    if (
      gameState.status !== 'playing' ||
      isInitialDealing ||
      hasNewSwapInLogs ||
      lastLog?.type === 'swap' ||
      prevMyCardsRef.current.length === 0
    ) {
      return dealingHiddenCardIds;
    }
    const prevIds = new Set(prevMyCardsRef.current.map((c) => c.id));
    let hasPendingNew = false;
    for (const c of myCards) {
      if (!prevIds.has(c.id) && !dealingHiddenCardIds.has(c.id)) {
        hasPendingNew = true;
        break;
      }
    }
    if (!hasPendingNew) return dealingHiddenCardIds;
    const next = new Set(dealingHiddenCardIds);
    for (const c of myCards) {
      if (!prevIds.has(c.id)) {
        next.add(c.id);
      }
    }
    return next;
  }, [
    myCards,
    dealingHiddenCardIds,
    gameState.status,
    gameState.logs,
    isInitialDealing,
    hasNewSwapInLogs,
  ]);

  // Synchronously compute opponent hidden in-flight draw counts on Frame 0 so opponent card counts increment 1-by-1 as cards land
  const effectiveOppHiddenDrawCounts = React.useMemo(() => {
    const lastLog = gameState.logs?.[gameState.logs.length - 1];
    if (
      gameState.status !== 'playing' ||
      isInitialDealing ||
      hasNewSwapInLogs ||
      lastLog?.type === 'swap' ||
      prevOpponentCardsRef.current.size === 0
    ) {
      return oppHiddenDrawCounts;
    }
    let next: Record<string, number> | null = null;
    for (const p of gameState.players) {
      if (p.id !== currentUserId) {
        const prevCount = prevOpponentCardsRef.current.get(p.id);
        if (
          prevCount !== undefined &&
          p.cards.length > prevCount &&
          oppHiddenDrawCounts[p.id] === undefined
        ) {
          if (!next) next = { ...oppHiddenDrawCounts };
          next[p.id] = p.cards.length - prevCount;
        }
      }
    }
    return next || oppHiddenDrawCounts;
  }, [
    gameState.players,
    gameState.status,
    gameState.logs,
    currentUserId,
    isInitialDealing,
    hasNewSwapInLogs,
    oppHiddenDrawCounts,
  ]);

  const displayedMyCardCount = isInitialDealing
    ? myCards.length
    : Math.max(0, myCards.length - effectiveDealingHiddenCardIds.size);

  useEffect(() => {
    const logs = gameState.logs || [];
    if (logs.length === 0) return;

    const startIdx = Math.max(0, logs.length - 5);
    for (let i = startIdx; i < logs.length; i++) {
      const log = logs[i];
      if (!log?.id || processedLogIdsRef.current.has(log.id)) continue;
      processedLogIdsRef.current.add(log.id);

      if (log.type === 'swap') {
        const isPassAll =
          log.text.toLowerCase().includes('all hands') ||
          log.text.includes('🌪️') ||
          topCardRef.current.value === '0';
        triggerSwapBanner(
          isPassAll ? '🔁 0s PASS ALL HANDS!' : '🔄 7s HAND SWAP!'
        );
      } else if (log.type === 'uno') {
        if (soundEnabled) playSound('uno');
      } else if (log.type === 'mercy') {
        if (soundEnabled) playSound('mercy');
      }
    }
  }, [gameState.logs, soundEnabled, triggerSwapBanner]);

  useEffect(() => {
    if (gameState.status !== 'playing') {
      prevMyCardsRef.current = [];
      return;
    }

    // If a fresh match or initial deal is starting, sync hand ref without triggering a mid-game draw flight
    if (isInitialDealing) {
      prevMyCardsRef.current = myCards;
      return;
    }

    const prevCards = prevMyCardsRef.current;
    if (prevCards.length === 0) {
      prevMyCardsRef.current = myCards;
      return;
    }

    const lastLog = gameState.logs?.[gameState.logs.length - 1];
    // Hand Swap ('7' or '0' Pass All): sync hand without triggering a deck draw flight
    if (hasNewSwapInLogs || lastLog?.type === 'swap') {
      prevMyCardsRef.current = myCards;
      return;
    }

    const prevIds = new Set(prevCards.map((c) => c.id));
    const newCards = myCards.filter((c) => !prevIds.has(c.id));

    if (newCards.length > 0) {
      const newIds = new Set(newCards.map((c) => c.id));
      setNewlyDrawnCardIds(newIds);
      // Keep newly drawn cards hidden in the hand until their 3D flying card touches down
      setDealingHiddenCardIds((prev) => {
        const next = new Set(prev);
        newCards.forEach((c) => next.add(c.id));
        return next;
      });

      let reason: 'normal' | 'penalty' | 'roulette' | 'draw_until' = 'normal';
      let label = `+${newCards.length} ${newCards.length > 1 ? 'CARDS' : 'CARD'}`;
      const isMeRoulette =
        (gameState.lastRouletteDraw?.victimId === currentUserId &&
          gameState.lastRouletteDraw?.id !== lastProcessedRouletteIdRef.current) ||
        lastLog?.text.toLowerCase().includes('roulette') ||
        lastLog?.text.includes('🎰');

      if (isMeRoulette) {
        reason = 'roulette';
        label = `ROULETTE (+${newCards.length})`;
        if (gameState.lastRouletteDraw?.id) {
          lastProcessedRouletteIdRef.current = gameState.lastRouletteDraw.id;
        }
      } else if (
        newCards.length >= 2 ||
        lastLog?.text.toLowerCase().includes('penalty') ||
        lastLog?.text.includes('💥')
      ) {
        reason = 'penalty';
        label = `+${newCards.length} PENALTY`;
      }

      // Note: CardDealFlight plays 'card_pick' directly in sync with each card's launch from the deck
      const visualMeCount = Math.min(newCards.length, reason === 'roulette' ? 12 : 8);
      const stepMs =
        reason === 'roulette' ? (visualMeCount > 7 ? 300 : 360) : 115;
      const drawDurationMs = visualMeCount * stepMs + 680;
      lockAnimation('player_draw', drawDurationMs);
      setActiveDrawFlight({
        id: `draw_${Date.now()}`,
        count: newCards.length,
        cards: newCards,
        reason,
        targetColor:
          reason === 'roulette'
            ? (gameState.lastRouletteDraw?.targetColor || gameState.currentColor).toUpperCase()
            : undefined,
        label,
        target: 'me',
        soundEnabled,
      });

      if (drawFlightSafetyTimerRef.current) {
        clearTimeout(drawFlightSafetyTimerRef.current);
      }
      drawFlightSafetyTimerRef.current = setTimeout(() => {
        setActiveDrawFlight(null);
        setDealingHiddenCardIds((prev) => {
          if (prev.size === 0) return prev;
          const next = new Set(prev);
          newCards.forEach((c) => next.delete(c.id));
          return next;
        });
        unlockAnimation('player_draw');
      }, visualMeCount * stepMs + 760);

      if (highlightSafetyTimerRef.current) {
        clearTimeout(highlightSafetyTimerRef.current);
      }
      highlightSafetyTimerRef.current = setTimeout(() => {
        setNewlyDrawnCardIds(new Set());
      }, 2500);
    }

    prevMyCardsRef.current = myCards;
  }, [
    myCards,
    gameState.status,
    gameState.logs,
    isInitialDealing,
    hasNewSwapInLogs,
    soundEnabled,
    lockAnimation,
    unlockAnimation,
  ]);

  // Track opponent draws & plays
  useEffect(() => {
    if (gameState.status !== 'playing') return;
    const lastLog = gameState.logs?.[gameState.logs.length - 1];
    const isSwapOrInitial =
      isInitialDealing ||
      hasNewSwapInLogs ||
      lastLog?.type === 'swap';

    const prevMap = prevOpponentCardsRef.current;
    const currentMap = new Map<string, number>();

    gameState.players.forEach((p) => {
      if (p.id !== currentUserId) {
        currentMap.set(p.id, p.cards.length);
        const prevCount = prevMap.get(p.id);
        const isOppRouletteEvent =
          Boolean(gameState.lastRouletteDraw?.id) &&
          gameState.lastRouletteDraw?.victimId === p.id &&
          gameState.lastRouletteDraw?.id !== lastProcessedRouletteIdRef.current;

        if (
          !isSwapOrInitial &&
          ((prevCount !== undefined && p.cards.length > prevCount) || isOppRouletteEvent)
        ) {
          const rawDiff = prevCount !== undefined ? p.cards.length - prevCount : 0;
          const rouletteCards = isOppRouletteEvent
            ? gameState.lastRouletteDraw?.cards
            : undefined;
          const diff =
            rawDiff > 0 ? rawDiff : rouletteCards?.length || 1;
          const isRoulette =
            isOppRouletteEvent ||
            lastLog?.text.toLowerCase().includes('roulette') ||
            lastLog?.text.includes('🎰');

          if (isOppRouletteEvent && gameState.lastRouletteDraw?.id) {
            lastProcessedRouletteIdRef.current = gameState.lastRouletteDraw.id;
          }

          const visualOppCount = Math.min(diff, isRoulette ? 12 : 6);
          const oppStepMs =
            isRoulette ? (visualOppCount > 7 ? 300 : 360) : 115;
          const oppDurationMs = visualOppCount * oppStepMs + 660;

          if (rawDiff > 0) {
            setOppHiddenDrawCounts((prev) => ({
              ...prev,
              [p.id]: rawDiff,
            }));
          }

          lockAnimation('opponent_draw', oppDurationMs);
          setOpponentDrawFlight({
            id: `opp_${p.id}_${Date.now()}`,
            count: diff,
            cards: isRoulette ? gameState.lastRouletteDraw?.cards : undefined,
            target: 'opponent',
            opponentId: p.id,
            opponentName: p.name,
            reason: isRoulette ? 'roulette' : diff > 1 ? 'penalty' : 'normal',
            targetColor: isRoulette
              ? (gameState.lastRouletteDraw?.targetColor || gameState.currentColor).toUpperCase()
              : undefined,
            label: isRoulette
              ? `ROULETTE (+${diff})`
              : diff > 1
              ? `+${diff} PENALTY`
              : undefined,
            soundEnabled,
          });
          if (oppFlightSafetyTimerRef.current) {
            clearTimeout(oppFlightSafetyTimerRef.current);
          }
          oppFlightSafetyTimerRef.current = setTimeout(() => {
            setOpponentDrawFlight(null);
            setOppHiddenDrawCounts({});
            unlockAnimation('opponent_draw');
          }, visualOppCount * oppStepMs + 750);
        }
      }
    });

    prevOpponentCardsRef.current = currentMap;
  }, [
    gameState.players,
    gameState.status,
    currentUserId,
    soundEnabled,
    gameState.logs,
    isInitialDealing,
    hasNewSwapInLogs,
    lockAnimation,
    unlockAnimation,
  ]);

  const currentPlayer = gameState.players[gameState.currentTurnIndex];
  const isMyTurn =
    gameState.status === 'playing' &&
    currentPlayer?.id === currentUserId &&
    !me?.isEliminated;

  // Turn Arrival Notification: vibration is strictly and exclusively triggered when the user's turn arrives
  const prevIsMyTurnRef = useRef<boolean>(false);
  useEffect(() => {
    if (gameState.status === 'playing') {
      if (isMyTurn && !prevIsMyTurnRef.current) {
        triggerHaptic('turn');
        if (soundEnabled) {
          playSound('turn');
        }
      }
    }
    prevIsMyTurnRef.current = isMyTurn;
  }, [isMyTurn, gameState.status, soundEnabled]);

  // Stack Slam & Opponent Play Flight Listeners
  const prevTopCardIdRef = useRef<string>(topCard.id);
  const prevPenaltyRef = useRef<number>(gameState.activePenalty);

  // Sync settledDiscardCard if chosenColor updates on the same topCard or if no flight is active
  useEffect(() => {
    if (
      topCard.id === settledDiscardCard.id &&
      topCard.chosenColor !== settledDiscardCard.chosenColor
    ) {
      setSettledDiscardCard(topCard);
    }
  }, [topCard, settledDiscardCard.id, settledDiscardCard.chosenColor]);

  // Fast-forward and clear any frozen in-flight overlays when returning from a backgrounded mobile tab
  useEffect(() => {
    if (tabResumeCount === 0) return;
    if (initialDealSafetyTimerRef.current) {
      clearTimeout(initialDealSafetyTimerRef.current);
      initialDealSafetyTimerRef.current = null;
    }
    if (drawFlightSafetyTimerRef.current) {
      clearTimeout(drawFlightSafetyTimerRef.current);
      drawFlightSafetyTimerRef.current = null;
    }
    if (oppFlightSafetyTimerRef.current) {
      clearTimeout(oppFlightSafetyTimerRef.current);
      oppFlightSafetyTimerRef.current = null;
    }
    if (playedFlightSafetyTimerRef.current) {
      clearTimeout(playedFlightSafetyTimerRef.current);
      playedFlightSafetyTimerRef.current = null;
    }
    setActiveDrawFlight(null);
    setOpponentDrawFlight(null);
    setPlayedFlight(null);
    setInitialDeal(null);
    setInFlightDiscardCardId(null);
    setDealingHiddenCardIds(new Set());
    setOppHiddenDrawCounts({});
    setSettledDiscardCard(topCardRef.current);
    prevTopCardIdRef.current = topCardRef.current.id;
    prevMyCardsRef.current = myCards;
    const currentOppMap = new Map<string, number>();
    gameState.players.forEach((p) => {
      if (p.id !== currentUserId) {
        currentOppMap.set(p.id, p.cards.length);
      }
    });
    prevOpponentCardsRef.current = currentOppMap;
  }, [tabResumeCount]);

  useEffect(() => {
    if (topCard.id !== prevTopCardIdRef.current) {
      const prevId = prevTopCardIdRef.current;
      prevTopCardIdRef.current = topCard.id;

      if (isInitialDealing || prevId === 'empty') {
        setSettledDiscardCard(topCard);
        return;
      }

      const penalty = getPenaltyAmount(topCard.value);
      const isHeavySlam =
        penalty > 0 ||
        [
          'skip_everyone',
          'wild_draw10',
          'wild_draw6',
          'draw4',
          'draw2',
          'wild_reverse_draw4',
        ].includes(topCard.value);

      const isSpecialCard =
        isHeavySlam ||
        topCard.color === 'wild' ||
        isNaN(Number(topCard.value)) ||
        (topCard.value === '7' && gameState.rules.allow7Swap) ||
        (topCard.value === '0' && gameState.rules.allow0PassAll);

      // If this card was played by an opponent (not the local player and not the initial deal), fly it from their seat
      if (topCard.id !== lastLocalPlayedCardIdRef.current) {
        const lastLog = gameState.logs?.[gameState.logs.length - 1];
        const actorOpp = opponents.find((o) => lastLog?.text.includes(o.name)) || opponents[0];
        if (actorOpp) {
          lockAnimation('played_flight', 580);
          setInFlightDiscardCardId(topCard.id);
          setPlayedFlight({
            id: `opp_play_${topCard.id}_${Date.now()}`,
            card: topCard,
            source: 'opponent',
            opponentId: actorOpp.id,
            isSlam: isHeavySlam,
            isSpecial: isSpecialCard,
            soundEnabled,
          });
          if (playedFlightSafetyTimerRef.current) {
            clearTimeout(playedFlightSafetyTimerRef.current);
          }
          playedFlightSafetyTimerRef.current = setTimeout(() => {
            playedFlightSafetyTimerRef.current = null;
            setSettledDiscardCard(topCardRef.current);
            setInFlightDiscardCardId((cur) => (cur === topCard.id ? null : cur));
            setPlayedFlight((prev) => (prev?.card.id === topCard.id ? null : prev));
            unlockAnimation('played_flight');
          }, 620);
        } else {
          setSettledDiscardCard(topCard);
        }
      }

      if (isHeavySlam) {
        triggerSlamPulse();
      }
    }
  }, [
    topCard,
    soundEnabled,
    gameState.rules.allow7Swap,
    gameState.rules.allow0PassAll,
    gameState.logs,
    opponents,
    isInitialDealing,
    lockAnimation,
    unlockAnimation,
    triggerSlamPulse,
  ]);

  useEffect(() => {
    if (gameState.activePenalty > prevPenaltyRef.current) {
      triggerSlamPulse();
    }
    prevPenaltyRef.current = gameState.activePenalty;
  }, [gameState.activePenalty, triggerSlamPulse]);

  // Victory Confetti
  useEffect(() => {
    if (gameState.status === 'ended') {
      if (soundEnabled) playSound('win');
      confetti({
        particleCount: 140,
        spread: 90,
        origin: { y: 0.6 },
      });
    }
  }, [gameState.status, soundEnabled]);

  // Execute play card with 3D flight from player's hand to discard pile
  const executePlayCard = (card: Card, chosenColor?: CardColor, targetPlayerId?: string) => {
    // If initial deal is still running and player acts fast, complete it immediately
    if (initialDeal) {
      setSettledDiscardCard(topCardRef.current);
      setDealingHiddenCardIds(new Set());
      setInitialDeal(null);
      unlockAnimation('initial_deal');
    }

    const slotEl = document.querySelector(`[data-hand-card-id="${card.id}"]`);
    const rectObj = slotEl
      ? slotEl.getBoundingClientRect()
      : pendingPlayStartRectRef.current || undefined;
    pendingPlayStartRectRef.current = null;

    const isHeavySlam =
      getPenaltyAmount(card.value) > 0 ||
      [
        'skip_everyone',
        'wild_draw10',
        'wild_draw6',
        'draw4',
        'draw2',
        'wild_reverse_draw4',
      ].includes(card.value);

    const isSpecialCard =
      isHeavySlam ||
      card.color === 'wild' ||
      isNaN(Number(card.value)) ||
      (card.value === '7' && Boolean(targetPlayerId || gameState.rules.allow7Swap)) ||
      (card.value === '0' && gameState.rules.allow0PassAll);

    const finalPlayedCard: Card = {
      ...card,
      chosenColor: chosenColor || card.chosenColor,
    };

    lastLocalPlayedCardIdRef.current = card.id;
    lockAnimation('played_flight', 580);
    setInFlightDiscardCardId(card.id);
    setPlayedFlight({
      id: `me_play_${card.id}_${Date.now()}`,
      card: finalPlayedCard,
      source: 'me',
      startRect: rectObj
        ? {
            left: rectObj.left,
            top: rectObj.top,
            width: rectObj.width,
            height: rectObj.height,
          }
        : undefined,
      isSlam: isHeavySlam,
      isSpecial: isSpecialCard,
      soundEnabled,
    });
    if (playedFlightSafetyTimerRef.current) {
      clearTimeout(playedFlightSafetyTimerRef.current);
    }
    playedFlightSafetyTimerRef.current = setTimeout(() => {
      playedFlightSafetyTimerRef.current = null;
      setSettledDiscardCard(topCardRef.current);
      setInFlightDiscardCardId((cur) => (cur === card.id ? null : cur));
      setPlayedFlight((prev) => (prev?.card.id === card.id ? null : prev));
      unlockAnimation('played_flight');
    }, 620);

    onPlayCard(card, chosenColor, targetPlayerId);
  };

  // Handle card click from player's hand
  const handleCardClick = (card: Card) => {
    const slotEl = document.querySelector(`[data-hand-card-id="${card.id}"]`);
    if (slotEl) {
      const r = slotEl.getBoundingClientRect();
      pendingPlayStartRectRef.current = {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      };
    }

    if (!isMyTurn) {
      // Check if eligible for jump-in
      if (
        gameState.rules.allowJumpIn &&
        gameState.activePenalty === 0 &&
        isExactMatchForJumpIn(card, topCard)
      ) {
        if (soundEnabled) playSound('jumpin');
        executePlayCard(card);
        return;
      }
      showToastHint("⏳ Wait for your turn! (Or Jump-In with an identical card)");
      if (soundEnabled) playSound('alert');
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
      return;
    }

    // Check if card is Wild (requires color choice)
    if (card.color === 'wild' || isWildCard(card.value)) {
      setSelectedWildCard(card);
      return;
    }

    // Check if card is '7'
    if (card.value === '7') {
      const activeOpps = opponents.filter((p) => !p.isEliminated);
      if (gameState.rules.allow7Swap && activeOpps.length === 1) {
        // Only 1 opponent with mandatory rule: auto-swap directly
        executePlayCard(card, undefined, activeOpps[0].id);
        return;
      }
      if (activeOpps.length > 0) {
        setSelected7Card(card);
        return;
      }
    }

    executePlayCard(card);
  };

  // Draw card with deal animation
  const handleDrawCard = () => {
    if (!isMyTurn) return;
    onDrawCard();
  };

  const handleChooseColor = (color: CardColor) => {
    if (!selectedWildCard) return;
    executePlayCard(selectedWildCard, color);
    setSelectedWildCard(null);
  };

  const handleChooseSwapTarget = (targetPlayerId: string) => {
    if (!selected7Card) return;
    executePlayCard(selected7Card, undefined, targetPlayerId);
    setSelected7Card(null);
  };

  const handlePlay7WithoutSwap = () => {
    if (!selected7Card) return;
    executePlayCard(selected7Card, undefined, undefined);
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
      <header className="clip-chamfer-lg bg-[#0e0d12] border-2 border-neutral-800 z-20 px-2 sm:px-3.5 py-1.5 shrink-0 shadow-[4px_4px_0px_#000] flex items-center justify-between gap-1.5 sm:gap-2 w-full">
        {/* Left: Play Direction & Arena Identity (Room Name hidden on mobile vertical to prevent cutoff) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
          <div
            className={`${
              isLandscapeMobile ? 'flex' : 'hidden sm:flex'
            } items-center gap-1.5 min-w-0`}
          >
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-600 border border-red-400 shrink-0 animate-pulse" />
            <span className="font-display font-black text-xs sm:text-sm uppercase tracking-wider text-white truncate max-w-[130px] md:max-w-[200px] leading-none">
              {gameState.roomName}
            </span>
          </div>

          <div
            className="inline-flex items-center justify-center gap-1 h-7 px-2 clip-chamfer-btn bg-[#141219] border border-neutral-700 text-[10px] font-mono-hud text-neutral-300 font-bold shrink-0 leading-none"
            title={`Direction: ${gameState.direction === 1 ? 'Clockwise' : 'Counter-Clockwise'}`}
          >
            <RotateCcw
              className={`w-3.5 h-3.5 text-red-400 shrink-0 ${gameState.direction === -1 ? '-scale-x-100' : ''}`}
            />
            <span className="uppercase">{gameState.direction === 1 ? 'CW' : 'CCW'}</span>
          </div>

          {gameState.rules.mercyLimit > 0 && (
            <span
              className="font-mono-hud text-[10px] font-black h-7 px-2 clip-chamfer-btn bg-red-950/80 text-red-300 border border-red-800 hidden md:inline-flex items-center justify-center uppercase tracking-wider leading-none shrink-0"
              title="Players holding 25+ cards are instantly knocked out"
            >
              MERCY: {gameState.rules.mercyLimit}
            </span>
          )}
        </div>

        {/* Center: Turn Status & Isolated Smooth Timer */}
        <div className="flex items-center justify-center shrink-0 min-w-0">
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
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 font-mono-hud text-xs">
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
            className="btn-stamp-secondary clip-chamfer-btn w-7 h-7 bg-[#141219] hover:bg-[#1f1b26] border border-neutral-700 text-neutral-300 transition-colors cursor-pointer hidden md:inline-flex items-center justify-center"
            title="Share Lobby Link"
          >
            {linkCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-amber-400" />}
          </button>

          {/* Handbook Guide */}
          <button
            type="button"
            onClick={onOpenReferee}
            className="btn-stamp-secondary clip-chamfer-btn hidden lg:inline-flex items-center justify-center gap-1.5 h-7 px-2.5 bg-[#141219] hover:bg-[#1f1b26] border border-neutral-700 text-amber-300 font-bold transition-all cursor-pointer uppercase leading-none"
            title="Combat Handbook"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Handbook</span>
          </button>

          {/* Rules */}
          <button
            type="button"
            onClick={onOpenRules}
            className="btn-stamp-secondary clip-chamfer-btn w-7 h-7 bg-[#141219] hover:bg-[#1f1b26] border border-neutral-700 text-neutral-300 transition-colors cursor-pointer hidden md:inline-flex items-center justify-center"
            title="Official Rulebook"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`btn-stamp-secondary clip-chamfer-btn w-7 h-7 transition-all cursor-pointer inline-flex items-center justify-center ${
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
            onClick={() => {
              const next = !soundEnabled;
              if (!next) stopCardAnimationSounds(0.015);
              setSoundEnabled(next);
            }}
            className="btn-stamp-secondary clip-chamfer-btn w-7 h-7 bg-[#141219] hover:bg-[#1f1b26] border border-neutral-700 text-neutral-300 transition-colors cursor-pointer inline-flex items-center justify-center"
            title={soundEnabled ? 'Mute' : 'Unmute'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-neutral-300" /> : <VolumeX className="w-3.5 h-3.5 text-neutral-500" />}
          </button>

          {/* Chat Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowChatDrawer(!showChatDrawer)}
            className={`btn-stamp-secondary clip-chamfer-btn relative inline-flex items-center justify-center gap-1.5 h-7 px-2 sm:px-2.5 font-bold uppercase transition-all cursor-pointer leading-none ${
              showChatDrawer
                ? 'bg-red-600 text-white border-red-500 shadow-[2px_2px_0px_#000]'
                : 'bg-[#141219] hover:bg-[#1f1b26] text-neutral-200 border border-neutral-700'
            }`}
            title="Toggle In-Game Chat"
          >
            <MessageSquare className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="hidden sm:inline">Feed</span>
            {unreadChatCount > 0 && !showChatDrawer && (
              <span className="px-1 py-0.5 bg-red-500 text-white clip-chamfer-btn text-[9px] font-black font-mono leading-none">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* Exit Match */}
          <button
            type="button"
            onClick={() => setShowLeaveConfirm(true)}
            className="btn-stamp-secondary clip-chamfer-btn w-7 h-7 bg-red-950/70 hover:bg-red-900 border border-red-800 text-red-400 hover:text-white transition-colors cursor-pointer inline-flex items-center justify-center"
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
          settledDiscardCard={settledDiscardCard}
          myCards={myCards}
          sortedCards={sortedCards}
          isMyTurn={isMyTurn}
          canPlayAnyCard={canPlayAnyCard}
          handleDrawCard={handleDrawCard}
          handleCardClick={handleCardClick}
          slamEffect={slamEffect}
          flipEffect={flipEffect}
          swapBannerText={swapBannerText}
          activeDrawFlight={activeDrawFlight}
          newlyDrawnCardIds={newlyDrawnCardIds}
          dealingHiddenCardIds={effectiveDealingHiddenCardIds}
          oppHiddenDrawCounts={effectiveOppHiddenDrawCounts}
          inFlightDiscardCardId={inFlightDiscardCardId}
          isInitialDealing={isInitialDealing}
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
              const mercyLimit = gameState.rules.mercyLimit || 25;
              const hiddenOppDraws = effectiveOppHiddenDrawCounts[opp.id] || 0;
              const displayedOppCards = Math.max(0, opp.cards.length - hiddenOppDraws);
              const mercyRatio = displayedOppCards / mercyLimit;
              const isDanger = !opp.isEliminated && (mercyRatio >= 0.8 || displayedOppCards >= mercyLimit - 4);
              const isWarning = !opp.isEliminated && !isDanger && mercyRatio >= 0.6;
              const oppTaunts = (gameState.activeTaunts || []).filter((t) => t.playerId === opp.id);

              return (
                <div
                  key={opp.id}
                  data-opponent-id={opp.id}
                  className={`relative px-2.5 py-1.5 h-11 sm:h-12 clip-chamfer border transition-colors flex items-center space-x-2 shrink-0 shadow-[2px_2px_0px_#000] ${
                    opp.isEliminated
                      ? 'bg-[#0a0a0d] border-neutral-800 opacity-40 grayscale'
                      : isOppTurn && isDanger
                      ? 'bg-red-950/90 border-2 border-red-500 ring-2 ring-amber-400/80'
                      : isOppTurn
                      ? 'bg-red-950/80 border-red-500 ring-1 ring-red-500/60'
                      : isDanger
                      ? 'bg-red-950/45 border-2 border-red-500 ring-1 ring-red-500/50'
                      : isWarning
                      ? 'bg-amber-950/30 border border-amber-500/80'
                      : 'bg-[#141219] border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <TableTauntFloating taunts={oppTaunts} placement="bottom" />

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
                            isDanger
                              ? 'px-1.5 py-0.2 rounded bg-red-950/90 border border-red-500 text-red-300 font-black animate-pulse'
                              : isWarning
                              ? 'px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-500/80 text-amber-300 font-black'
                              : 'text-neutral-400'
                          }`}
                        >
                          <Layers className="w-2.5 h-2.5" />
                          <span>{displayedOppCards}/{mercyLimit}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Center Table Arena (Discard Pile, Draw Deck, Fixed Event Banner below) */}
          <div className="flex-1 flex flex-col items-center justify-center relative z-10 py-1 min-h-[190px] sm:min-h-[230px] my-auto">
            {/* Central Piles: Draw Deck & Discard Pile (Anchored Position, Zero Layout Shifts) */}
            <div className="flex items-center justify-center gap-6 sm:gap-12 relative">
              {/* Draw Pile (3D Physical Dealer Stack) */}
              <div className="flex flex-col items-center relative">
                <div className="relative">
                  {/* 3D Stack Depth Layers beneath top card */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 translate-x-[6px] translate-y-[6px] rounded-2xl bg-[#060609] border border-neutral-800 shadow-[4px_4px_0px_#000] pointer-events-none"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 translate-x-[4px] translate-y-[4px] rounded-2xl bg-[#0a0a0f] border border-neutral-700/80 pointer-events-none"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 translate-x-[2px] translate-y-[2px] rounded-2xl bg-[#0e0e15] border border-neutral-700 pointer-events-none"
                  />

                  <motion.button
                    id="uno-draw-deck"
                    type="button"
                    onClick={handleDrawCard}
                    disabled={!isMyTurn}
                    whileHover={isMyTurn ? { scale: 1.04 } : undefined}
                    whileTap={isMyTurn ? { scale: 0.96 } : undefined}
                    style={{ transform: 'translate3d(0, 0, 0)' }}
                    className={`group relative clip-chamfer-btn transition-colors duration-150 ${
                      isMyTurn
                        ? 'cursor-pointer border-2 border-red-500 ring-2 ring-red-500/70 shadow-[4px_4px_0px_#000]'
                        : 'border border-neutral-700 opacity-95'
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
                </div>

                <span className="mt-2.5 font-mono-hud text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  Draw Pile
                </span>
              </div>

              {/* Discard Pile (Clean Solid Single Card) */}
              <div className="flex flex-col items-center relative">
                <div id="uno-discard-pile" className="relative">
                  <div className={isInitialDealing ? 'invisible' : 'visible'}>
                    <UnoCard
                      card={settledDiscardCard}
                      size={isShortHeight ? 'md' : 'lg'}
                      disabled
                    />
                  </div>

                  {/* Active Color Ring */}
                  <div
                    className={`absolute -inset-1.5 clip-chamfer -z-10 border-2 transition-colors duration-300 blur-[2px] ${
                      gameState.currentColor === 'red'
                        ? 'border-red-500 shadow-[0_0_20px_#ff1f35]'
                        : gameState.currentColor === 'blue'
                        ? 'border-blue-500 shadow-[0_0_20px_#0088ff]'
                        : gameState.currentColor === 'green'
                        ? 'border-emerald-500 shadow-[0_0_20px_#00d655]'
                        : 'border-amber-400 shadow-[0_0_20px_#ffcc00]'
                    }`}
                  />
                </div>

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

            {/* Dedicated Fixed Layout Event Strip (Zero Layout Shifts) */}
            <div className="h-8 min-h-[2rem] w-full max-w-sm flex items-center justify-center mt-2.5 px-2">
              {isInitialDealing ? (
                <div className="px-3.5 py-0.5 clip-chamfer bg-[#141219] text-amber-300 font-mono-hud font-black text-xs tracking-wider uppercase flex items-center space-x-1.5 shadow-[3px_3px_0px_#000] border border-amber-400">
                  <Layers className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span>DEALING STARTING HANDS</span>
                </div>
              ) : gameState.activePenalty > 0 ? (
                <div className="px-3.5 py-0.5 clip-chamfer bg-gradient-to-r from-red-600 to-amber-600 text-white font-mono-hud font-black text-xs tracking-wider uppercase flex items-center space-x-1.5 shadow-[3px_3px_0px_#000] border-2 border-amber-300 animate-pulse">
                  <Flame className="w-3.5 h-3.5 text-amber-300" />
                  <span>+{gameState.activePenalty} PENALTY STACK ACTIVE</span>
                </div>
              ) : flipEffect ? (
                <div className="px-3 py-0.5 clip-chamfer bg-amber-400 text-black font-display font-black text-xs uppercase tracking-wider flex items-center space-x-2 shadow-[2px_2px_0px_#000] border-2 border-white animate-bounce">
                  <Sparkles className="w-3.5 h-3.5 text-black" />
                  <span>{swapBannerText}</span>
                </div>
              ) : null}
            </div>

            {/* Card Hint Toast Notification (Absolute Overlay, Zero Reflow) */}
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
                        Your Hand ({displayedMyCardCount})
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
                            displayedMyCardCount >= gameState.rules.mercyLimit - 4
                              ? 'bg-red-950 text-red-300 border-red-600 animate-pulse'
                              : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                          }`}
                        >
                          MERCY: {displayedMyCardCount}/{gameState.rules.mercyLimit}
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
                          onClick={() => onCatchUno?.(target.id)}
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
                            onClick={onCallUno}
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
                          isDealingHidden={
                            isPendingInitialDeal || effectiveDealingHiddenCardIds.has(card.id)
                          }
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

      {/* Modular In-Game Modals, Killcam, & Match Summary Overlay */}
      <GameBoardModals
        gameState={gameState}
        currentUserId={currentUserId}
        opponents={opponents}
        showChatDrawer={showChatDrawer}
        setShowChatDrawer={setShowChatDrawer}
        chatMessages={chatMessages}
        onSendMessage={onSendMessage}
        selectedWildCard={selectedWildCard}
        setSelectedWildCard={setSelectedWildCard}
        onChooseColor={handleChooseColor}
        selected7Card={selected7Card}
        setSelected7Card={setSelected7Card}
        onChooseSwapTarget={handleChooseSwapTarget}
        onPlay7WithoutSwap={handlePlay7WithoutSwap}
        dismissedKillcamId={dismissedKillcamId}
        setDismissedKillcamId={setDismissedKillcamId}
        showLeaveConfirm={showLeaveConfirm}
        setShowLeaveConfirm={setShowLeaveConfirm}
        onReturnToLobby={onReturnToLobby}
        onRestartGame={onRestartGame}
        onLeaveGame={onLeaveGame}
      />

      {/* Global GSAP 3D Card Deal & Play Flight Overlay */}
      <CardDealFlight
        flight={activeDrawFlight}
        opponentFlight={opponentDrawFlight}
        initialDeal={initialDeal}
        playedFlight={playedFlight}
        isLandscape={isLandscapeMobile}
        timeScale={playbackSpeed}
        onCardLanded={handleCardLanded}
        onOpponentCardLanded={handleOpponentCardLanded}
        onInitialDealComplete={handleInitialDealComplete}
        onRevealDiscardCard={handleRevealDiscardCard}
        onPlayedCardLanded={handlePlayedCardLanded}
        onFlightComplete={handleFlightComplete}
        onOpponentFlightComplete={handleOpponentFlightComplete}
      />
    </div>
  );
};
