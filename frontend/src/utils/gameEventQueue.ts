import { useState, useRef, useCallback, useEffect } from 'react';
import { GameState } from '@uno/shared/types';
import { soundManager, stopCardAnimationSounds } from './sound';

export type AnimationLockKey =
  | 'initial_deal'
  | 'played_flight'
  | 'player_draw'
  | 'opponent_draw'
  | 'hand_swap';

/**
 * Classifies how an incoming GameState relates to the reference GameState
 * (either the tail of the queue or the currently displayed state).
 */
function analyzeTransition(prev: GameState, next: GameState) {
  // 1. Hard reset: room change, rematch start, or returning to waiting lobby
  if (
    prev.roomId !== next.roomId ||
    prev.startedAt !== next.startedAt ||
    next.status === 'waiting' ||
    prev.status === 'waiting'
  ) {
    return { kind: 'RESET' as const };
  }

  const prevTop = prev.discardPile[prev.discardPile.length - 1];
  const nextTop = next.discardPile[next.discardPile.length - 1];
  const topCardChanged = prevTop?.id !== nextTop?.id;

  const prevLogIds = new Set((prev.logs || []).map((l) => l.id));
  const newLogs = (next.logs || []).filter((l) => l.id && !prevLogIds.has(l.id));
  const isNewSwapLog = newLogs.some((l) => l.type === 'swap');

  let anyCardsIncreased = false;
  let anyCardsChanged = false;

  for (let i = 0; i < next.players.length; i++) {
    const np = next.players[i];
    const pp = prev.players.find((p) => p.id === np.id);
    if (!pp) {
      anyCardsChanged = true;
      continue;
    }
    if (np.cards.length > pp.cards.length) {
      anyCardsIncreased = true;
      anyCardsChanged = true;
    } else if (np.cards.length !== pp.cards.length) {
      anyCardsChanged = true;
    } else {
      // Check if card IDs changed (e.g., 7/0 hand swap between players with equal hand sizes)
      for (let c = 0; c < np.cards.length; c++) {
        if (np.cards[c]?.id !== pp.cards[c]?.id) {
          anyCardsChanged = true;
          break;
        }
      }
    }
  }

  const statusEnded = prev.status !== 'ended' && next.status === 'ended';
  const eliminationChanged =
    Boolean(next.lastElimination?.id) &&
    prev.lastElimination?.id !== next.lastElimination?.id;
  const rouletteChanged =
    Boolean(next.lastRouletteDraw?.id) &&
    prev.lastRouletteDraw?.id !== next.lastRouletteDraw?.id;

  if (
    !topCardChanged &&
    !anyCardsChanged &&
    !isNewSwapLog &&
    !statusEnded &&
    !eliminationChanged &&
    !rouletteChanged
  ) {
    return { kind: 'METADATA_ONLY' as const };
  }

  return {
    kind: 'ACTION' as const,
    topCardChanged,
    anyCardsIncreased,
    anyCardsChanged,
    isNewSwapLog,
    statusEnded,
    rouletteChanged,
  };
}

/**
 * Decomposes compound server state transitions into sequential atomic visual steps:
 * 1. If a single state snapshot both plays a card onto the discard pile AND draws cards
 *    (e.g., Wild Color Roulette or Bot UNO Catch + Play), split into [PlayStep, DrawStep].
 * 2. If a final card play or penalty draw transitions status directly to 'ended',
 *    insert a 'playing' animation step first so the final card flight & audio finish
 *    before the Game Over modal appears.
 */
function decomposeActionSteps(prev: GameState, next: GameState): GameState[] {
  const analysis = analyzeTransition(prev, next);
  if (analysis.kind !== 'ACTION') return [next];

  const steps: GameState[] = [];

  // Compound Case A: Card played AND a player's hand count increased (or Roulette triggered) in the same snapshot
  if (
    analysis.topCardChanged &&
    (analysis.anyCardsIncreased || analysis.rouletteChanged) &&
    !analysis.isNewSwapLog &&
    prev.discardPile.length > 0
  ) {
    const intermediatePlayers = next.players.map((np) => {
      const pp = prev.players.find((p) => p.id === np.id);
      if (
        pp &&
        (np.cards.length > pp.cards.length ||
          (analysis.rouletteChanged && next.lastRouletteDraw?.victimId === np.id))
      ) {
        return {
          ...np,
          cards: pp.cards,
          isEliminated: pp.isEliminated,
        };
      }
      return np;
    });

    const playStep: GameState = {
      ...next,
      status: 'playing',
      players: intermediatePlayers,
      drawPileCount: prev.drawPileCount,
      lastElimination: prev.lastElimination,
      lastRouletteDraw: prev.lastRouletteDraw,
    };
    steps.push(playStep);
  }

  // Compound Case B: Action ends the match ('ended') while also playing or drawing a card
  if (
    analysis.statusEnded &&
    (analysis.topCardChanged || analysis.anyCardsChanged)
  ) {
    const preEndStep: GameState = {
      ...next,
      status: 'playing',
    };
    steps.push(preEndStep);
  }

  steps.push(next);
  return steps;
}

/**
 * Sequential Event Queue Hook for Game Actions.
 * Forces card animations (dealing, drawing, playing, stacking, hand swaps) and their
 * synchronized audio to complete before processing the next game state update.
 */
export function useSequentialGameQueue(
  incomingGameState: GameState,
  localPlayedCardIdRef: React.MutableRefObject<string | null>
) {
  const [displayedGameState, setDisplayedGameState] = useState<GameState>(incomingGameState);
  const [queueLength, setQueueLength] = useState<number>(0);
  const [tabResumeCount, setTabResumeCount] = useState<number>(0);

  const displayedStateRef = useRef<GameState>(incomingGameState);
  const latestIncomingRef = useRef<GameState>(incomingGameState);
  latestIncomingRef.current = incomingGameState;
  const queueRef = useRef<GameState[]>([]);
  const activeLocksRef = useRef<Map<AnimationLockKey, ReturnType<typeof setTimeout>>>(new Map());
  const transitionGateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceSettleCleanupRef = useRef<(() => void) | null>(null);
  const isTransitionGatedRef = useRef<boolean>(false);

  const clearAllLocksAndTimers = useCallback(() => {
    activeLocksRef.current.forEach((timer) => clearTimeout(timer));
    activeLocksRef.current.clear();
    if (transitionGateTimerRef.current) {
      clearTimeout(transitionGateTimerRef.current);
      transitionGateTimerRef.current = null;
    }
    if (voiceSettleCleanupRef.current) {
      voiceSettleCleanupRef.current();
      voiceSettleCleanupRef.current = null;
    }
    isTransitionGatedRef.current = false;
  }, []);

  const advanceQueueRef = useRef<() => void>(() => {});

  const processNextInQueue = useCallback(() => {
    if (activeLocksRef.current.size > 0 || isTransitionGatedRef.current) {
      return;
    }
    if (queueRef.current.length === 0) {
      setQueueLength(0);
      return;
    }

    const nextState = queueRef.current.shift()!;
    setQueueLength(queueRef.current.length);

    // Gate for 45ms so GameBoard's useEffects on displayedGameState can acquire their animation locks
    isTransitionGatedRef.current = true;
    displayedStateRef.current = nextState;
    setDisplayedGameState(nextState);

    if (transitionGateTimerRef.current) {
      clearTimeout(transitionGateTimerRef.current);
    }
    transitionGateTimerRef.current = setTimeout(() => {
      transitionGateTimerRef.current = null;
      isTransitionGatedRef.current = false;
      // If this state step did not acquire any animation lock (e.g. turn-only or final 'ended' modal step),
      // continue draining the queue after audio settles.
      if (activeLocksRef.current.size === 0 && queueRef.current.length > 0) {
        advanceQueueRef.current();
      }
    }, 45);
  }, []);

  const scheduleAdvanceWhenReady = useCallback(() => {
    if (activeLocksRef.current.size > 0 || isTransitionGatedRef.current) {
      return;
    }
    if (queueRef.current.length === 0) {
      setQueueLength(0);
      return;
    }
    if (voiceSettleCleanupRef.current) {
      voiceSettleCleanupRef.current();
    }
    // Wait for any active card audio transient to finish (capped at 45ms) before advancing
    voiceSettleCleanupRef.current = soundManager.waitForCardVoicesToSettle(45, () => {
      voiceSettleCleanupRef.current = null;
      processNextInQueue();
    });
  }, [processNextInQueue]);

  useEffect(() => {
    advanceQueueRef.current = scheduleAdvanceWhenReady;
  }, [scheduleAdvanceWhenReady]);

  /**
   * Acquires an animation lock for a specific visual sequence.
   * Automatically releases after maxDurationMs as a failsafe against dropped frames.
   */
  const lockAnimation = useCallback(
    (key: AnimationLockKey, maxDurationMs = 1200) => {
      const existing = activeLocksRef.current.get(key);
      if (existing) {
        clearTimeout(existing);
      }
      // Speed up failsafe timeout proportionally when queue is catching up
      const qLen = queueRef.current.length;
      const speed = qLen >= 3 ? 1.45 : qLen === 2 ? 1.25 : 1;
      const scaledTimeout = Math.max(220, Math.round(maxDurationMs / speed));

      const safetyTimer = setTimeout(() => {
        activeLocksRef.current.delete(key);
        if (activeLocksRef.current.size === 0 && !isTransitionGatedRef.current) {
          advanceQueueRef.current();
        }
      }, scaledTimeout);

      activeLocksRef.current.set(key, safetyTimer);
    },
    []
  );

  /**
   * Releases an animation lock when its GSAP timeline completes.
   * Once all active locks are cleared and audio voices settle, advances the queue.
   */
  const unlockAnimation = useCallback((key: AnimationLockKey) => {
    const existing = activeLocksRef.current.get(key);
    if (existing) {
      clearTimeout(existing);
      activeLocksRef.current.delete(key);
    }
    if (activeLocksRef.current.size === 0 && !isTransitionGatedRef.current) {
      advanceQueueRef.current();
    }
  }, []);

  // Process incoming GameState updates
  useEffect(() => {
    const currentDisplayed = displayedStateRef.current;
    const referenceState =
      queueRef.current.length > 0
        ? queueRef.current[queueRef.current.length - 1]
        : currentDisplayed;

    if (incomingGameState === referenceState) {
      return;
    }

    // 0. Backgrounded Tab / Mobile App-Switch Bypass:
    // When tab is hidden, requestAnimationFrame is throttled by the browser.
    // Snap directly to the latest state without queueing stale animations.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      clearAllLocksAndTimers();
      stopCardAnimationSounds(0.01);
      queueRef.current = [];
      setQueueLength(0);
      displayedStateRef.current = incomingGameState;
      setDisplayedGameState(incomingGameState);
      return;
    }

    const analysis = analyzeTransition(referenceState, incomingGameState);

    // 1. Hard Reset (New match, rematch, or lobby transition): flush immediately
    if (analysis.kind === 'RESET') {
      clearAllLocksAndTimers();
      stopCardAnimationSounds(0.02);
      queueRef.current = [];
      setQueueLength(0);
      displayedStateRef.current = incomingGameState;
      setDisplayedGameState(incomingGameState);
      return;
    }

    // 2. Metadata / Server Reconciliation of Local Optimistic Play:
    // Merge live fields (turn index, timer, logs, taunts, UNO status) without stalling or re-queueing
    if (analysis.kind === 'METADATA_ONLY') {
      if (queueRef.current.length === 0) {
        displayedStateRef.current = incomingGameState;
        setDisplayedGameState(incomingGameState);
      } else {
        // Keep live timer and taunts responsive on screen while updating the queued tail state
        queueRef.current[queueRef.current.length - 1] = incomingGameState;
        const liveMerged: GameState = {
          ...displayedStateRef.current,
          turnTimeRemaining: incomingGameState.turnTimeRemaining,
          activeTaunts: incomingGameState.activeTaunts,
        };
        displayedStateRef.current = liveMerged;
        setDisplayedGameState(liveMerged);
      }
      return;
    }

    // 3. Check if this is the local player's own optimistic card play:
    // Apply immediately for zero-input-lag hand responsiveness
    const incomingTop =
      incomingGameState.discardPile[incomingGameState.discardPile.length - 1];
    const isLocalOptimisticPlay =
      analysis.topCardChanged &&
      Boolean(localPlayedCardIdRef.current) &&
      incomingTop?.id === localPlayedCardIdRef.current;

    if (isLocalOptimisticPlay && queueRef.current.length === 0) {
      isTransitionGatedRef.current = true;
      displayedStateRef.current = incomingGameState;
      setDisplayedGameState(incomingGameState);
      if (transitionGateTimerRef.current) {
        clearTimeout(transitionGateTimerRef.current);
      }
      transitionGateTimerRef.current = setTimeout(() => {
        transitionGateTimerRef.current = null;
        isTransitionGatedRef.current = false;
        if (activeLocksRef.current.size === 0 && queueRef.current.length > 0) {
          advanceQueueRef.current();
        }
      }, 45);
      return;
    }

    // 4. Decompose compound action transitions (e.g. Roulette Play + Draw, or Final Card + Match End)
    const steps = decomposeActionSteps(referenceState, incomingGameState);

    const isBusy =
      activeLocksRef.current.size > 0 ||
      isTransitionGatedRef.current ||
      queueRef.current.length > 0;

    if (!isBusy) {
      // Immediately apply the first step and queue any remaining decomposed steps
      const [firstStep, ...restSteps] = steps;
      if (restSteps.length > 0) {
        queueRef.current.push(...restSteps);
        setQueueLength(queueRef.current.length);
      }
      isTransitionGatedRef.current = true;
      displayedStateRef.current = firstStep;
      setDisplayedGameState(firstStep);

      if (transitionGateTimerRef.current) {
        clearTimeout(transitionGateTimerRef.current);
      }
      transitionGateTimerRef.current = setTimeout(() => {
        transitionGateTimerRef.current = null;
        isTransitionGatedRef.current = false;
        if (activeLocksRef.current.size === 0 && queueRef.current.length > 0) {
          advanceQueueRef.current();
        }
      }, 45);
    } else {
      // Enqueue all steps in FIFO order
      queueRef.current.push(...steps);
      setQueueLength(queueRef.current.length);
    }
  }, [incomingGameState, clearAllLocksAndTimers, localPlayedCardIdRef]);

  // Flush any queued animation backlog and snap to authoritative state when returning to a backgrounded tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const hasPendingWork =
          queueRef.current.length > 0 ||
          activeLocksRef.current.size > 0 ||
          isTransitionGatedRef.current ||
          displayedStateRef.current !== latestIncomingRef.current;

        if (hasPendingWork) {
          clearAllLocksAndTimers();
          stopCardAnimationSounds(0.015);
          queueRef.current = [];
          setQueueLength(0);
          displayedStateRef.current = latestIncomingRef.current;
          setDisplayedGameState(latestIncomingRef.current);
        }
        setTabResumeCount((c) => c + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearAllLocksAndTimers]);

  useEffect(() => {
    return () => {
      clearAllLocksAndTimers();
    };
  }, [clearAllLocksAndTimers]);

  // Dynamic catch-up speed scaling for high-speed play (stacking chains, fast bots, jump-ins)
  const playbackSpeed = queueLength >= 3 ? 1.45 : queueLength === 2 ? 1.25 : 1.0;

  return {
    displayedGameState,
    queueLength,
    playbackSpeed,
    tabResumeCount,
    lockAnimation,
    unlockAnimation,
  };
}
