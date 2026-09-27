import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Card } from '@uno/shared/types';
import { getCardImagePath } from '@uno/shared/unoDeck';
import { playSound, stopCardAnimationSounds } from '../utils/sound';
import { Flame, Sparkles, Layers } from 'lucide-react';
import {
  FlightDescriptor,
  create3DCardNode,
  cleanupFlightNodes,
  scheduleCardFlight,
} from './flight/flightDomCard';

export interface DrawFlightData {
  id: string;
  count: number;
  cards?: Card[];
  reason?: 'normal' | 'penalty' | 'roulette' | 'draw_until';
  targetColor?: string;
  label?: string;
  target?: 'me' | 'opponent';
  opponentId?: string;
  opponentName?: string;
  soundEnabled?: boolean;
}

export interface InitialDealConfig {
  id: string;
  myCards: Card[];
  opponentIds: string[];
  starterCard: Card;
  soundEnabled?: boolean;
}

export interface PlayedCardFlightData {
  id: string;
  card: Card;
  source: 'me' | 'opponent';
  opponentId?: string;
  startRect?: { left: number; top: number; width: number; height: number };
  isSlam?: boolean;
  isSpecial?: boolean;
  soundEnabled?: boolean;
}

interface CardDealFlightProps {
  flight: DrawFlightData | null;
  opponentFlight?: DrawFlightData | null;
  initialDeal?: InitialDealConfig | null;
  playedFlight?: PlayedCardFlightData | null;
  isLandscape?: boolean;
  timeScale?: number;
  onCardLanded?: (cardId: string) => void;
  onOpponentCardLanded?: (opponentId: string, remainingHidden: number) => void;
  onInitialDealComplete?: () => void;
  onRevealDiscardCard?: (card: Card) => void;
  onPlayedCardLanded?: (cardId: string) => void;
  onFlightComplete?: () => void;
  onOpponentFlightComplete?: () => void;
}

export const CardDealFlight: React.FC<CardDealFlightProps> = ({
  flight,
  opponentFlight,
  initialDeal,
  playedFlight,
  isLandscape = false,
  timeScale = 1,
  onCardLanded,
  onOpponentCardLanded,
  onInitialDealComplete,
  onRevealDiscardCard,
  onPlayedCardLanded,
  onFlightComplete,
  onOpponentFlightComplete,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const badgeCounterRef = useRef<HTMLSpanElement>(null);
  const timeScaleRef = useRef(timeScale);
  const onCardLandedRef = useRef(onCardLanded);
  const onOpponentCardLandedRef = useRef(onOpponentCardLanded);
  const onInitialDealCompleteRef = useRef(onInitialDealComplete);
  const onRevealDiscardCardRef = useRef(onRevealDiscardCard);
  const onPlayedCardLandedRef = useRef(onPlayedCardLanded);
  const onFlightCompleteRef = useRef(onFlightComplete);
  const onOpponentFlightCompleteRef = useRef(onOpponentFlightComplete);

  useEffect(() => {
    timeScaleRef.current = timeScale;
    onCardLandedRef.current = onCardLanded;
    onOpponentCardLandedRef.current = onOpponentCardLanded;
    onInitialDealCompleteRef.current = onInitialDealComplete;
    onRevealDiscardCardRef.current = onRevealDiscardCard;
    onPlayedCardLandedRef.current = onPlayedCardLanded;
    onFlightCompleteRef.current = onFlightComplete;
    onOpponentFlightCompleteRef.current = onOpponentFlightComplete;
  }, [
    timeScale,
    onCardLanded,
    onOpponentCardLanded,
    onInitialDealComplete,
    onRevealDiscardCard,
    onPlayedCardLanded,
    onFlightComplete,
    onOpponentFlightComplete,
  ]);

  // 1. Opening Match Dealer Sequence (7-Card Deal + Starter Discard Flip)
  useEffect(() => {
    if (!initialDeal || !stageRef.current) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      initialDeal.myCards.forEach((c) => onCardLandedRef.current?.(c.id));
      onInitialDealCompleteRef.current?.();
      return;
    }

    const stage = stageRef.current;
    const createdNodes: HTMLElement[] = [];
    const deckEl = document.getElementById('uno-draw-deck');
    const discardEl = document.getElementById('uno-discard-pile');
    const handEl = document.getElementById('uno-player-hand');

    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let deckX = winW * 0.44;
    let deckY = winH * 0.44;
    if (deckEl) {
      const r = deckEl.getBoundingClientRect();
      deckX = r.left + r.width / 2;
      deckY = r.top + r.height / 2;
    }

    let discardX = winW * 0.56;
    let discardY = winH * 0.44;
    let discardW = isLandscape ? 54 : winW < 640 ? 68 : 88;
    let discardH = isLandscape ? 78 : winW < 640 ? 100 : 128;
    if (discardEl) {
      const r = discardEl.getBoundingClientRect();
      discardX = r.left + r.width / 2;
      discardY = r.top + r.height / 2;
      if (r.width > 20 && r.height > 20) {
        discardW = r.width;
        discardH = r.height;
      }
    }

    const sampleSlot = handEl?.querySelector('[data-hand-card-id]') as HTMLElement | null;
    const sampleRect = sampleSlot?.getBoundingClientRect();
    const cardW =
      sampleRect && sampleRect.width > 20
        ? sampleRect.width
        : isLandscape
        ? 54
        : winW < 640
        ? 68
        : 82;
    const cardH =
      sampleRect && sampleRect.height > 20
        ? sampleRect.height
        : isLandscape
        ? 78
        : winW < 640
        ? 100
        : 120;

    const descriptors: FlightDescriptor[] = [];
    const myCards = initialDeal.myCards;
    const oppIds = initialDeal.opponentIds;

    // Measure opponent seat positions
    const oppCoords = new Map<string, { x: number; y: number }>();
    oppIds.forEach((id, i) => {
      const el = document.querySelector(`[data-opponent-id="${id}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        oppCoords.set(id, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      } else {
        const spread = ((i + 1) / (oppIds.length + 1)) * winW * 0.7 + winW * 0.15;
        oppCoords.set(id, { x: spread, y: Math.max(48, winH * 0.1) });
      }
    });

    // Measure player's hand card target slots
    const handRect = handEl?.getBoundingClientRect();
    const myCardTargets = myCards.map((c, idx) => {
      const slotEl = document.querySelector(`[data-hand-card-id="${c.id}"]`);
      if (slotEl) {
        const r = slotEl.getBoundingClientRect();
        const halfW = r.width / 2;
        const rawX = r.left + halfW;
        const clampedX = handRect
          ? Math.max(handRect.left + halfW, Math.min(handRect.right - halfW, rawX))
          : rawX;
        return { x: clampedX, y: r.top + r.height / 2 };
      }
      const baseX = handRect ? handRect.left + handRect.width / 2 : winW * 0.5;
      const baseY = handRect ? handRect.top + handRect.height * 0.55 : winH * 0.86;
      const offset = (idx - (myCards.length - 1) / 2) * (isLandscape ? 28 : 38);
      return { x: baseX + offset, y: baseY };
    });

    // Synchronized Casino Dealer Rhythm (~1.44s total sequence, matched 1:1 with card-shuffle.ogg + starter land):
    let currentTime = 0.04;
    const playerCardStagger = 0.12; // 120ms between each of your 7 cards

    for (let round = 0; round < myCards.length; round++) {
      // Interleave opponent flights on rounds 0 and 2 so table feels alive
      if (round === 0 || round === 2) {
        oppIds.forEach((oppId, oppIdx) => {
          const target = oppCoords.get(oppId)!;
          const dx = target.x - deckX;
          const dy = target.y - deckY;
          const sideSign = dx >= 0 ? 1 : -1;
          const ctrlX = deckX + dx * 0.45 + sideSign * 42;
          const ctrlY = deckY + dy * 0.4 - 32;

          descriptors.push({
            key: `init_opp_${oppId}_${round}`,
            frontSrc: '/cards/card_back.webp',
            revealFace: false,
            startX: deckX,
            startY: deckY,
            ctrlX,
            ctrlY,
            endX: target.x + (round === 0 ? -4 : 4),
            endY: target.y,
            startScale: 0.84,
            peakScale: 0.94,
            endScale: 0.4,
            startRotZ: -8,
            midRotZ: sideSign * (16 + oppIdx * 4),
            endRotZ: sideSign * 5,
            delay: currentTime + oppIdx * 0.04,
            duration: 0.46,
            targetOpponentId: oppId,
            playLaunchSound: false, // Synced to master card-shuffle.ogg riffle
            soundEnabled: initialDeal.soundEnabled,
          });
        });
      }

      // Local player's card for this round
      const card = myCards[round];
      const target = myCardTargets[round];
      const dx = target.x - deckX;
      const dy = target.y - deckY;
      const arcCurveX = (round - (myCards.length - 1) / 2) * 30;
      const ctrlX = deckX + dx * 0.48 + arcCurveX;
      const ctrlY = deckY + dy * 0.36 - (isLandscape ? 32 : 52);

      descriptors.push({
        key: `init_me_${card.id}`,
        frontSrc: getCardImagePath(card, false),
        revealFace: true,
        startX: deckX,
        startY: deckY,
        ctrlX,
        ctrlY,
        endX: target.x,
        endY: target.y,
        startScale: 0.84,
        peakScale: 1.08,
        endScale: 1.0,
        startRotZ: -6,
        midRotZ: (round - (myCards.length - 1) / 2) * 5,
        endRotZ: 0,
        delay: currentTime,
        duration: 0.48,
        handCardId: card.id,
        playLaunchSound: false, // Synced to master card-shuffle.ogg riffle
        soundEnabled: initialDeal.soundEnabled,
      });

      currentTime += playerCardStagger;
    }

    // Final step: Flip the starter discard card from Draw Deck onto Discard Pile
    const starterDelay = currentTime + 0.08;
    descriptors.push({
      key: `init_starter_${initialDeal.starterCard.id}`,
      frontSrc: getCardImagePath(initialDeal.starterCard, false),
      revealFace: true,
      startX: deckX,
      startY: deckY,
      ctrlX: (deckX + discardX) / 2,
      ctrlY: Math.min(deckY, discardY) - (isLandscape ? 54 : 82),
      endX: discardX,
      endY: discardY,
      startScale: 0.9,
      peakScale: 1.18,
      endScale: 1.0,
      startRotZ: -10,
      midRotZ: 8,
      endRotZ: 0,
      delay: starterDelay,
      duration: 0.48,
      isStarterDiscard: true,
      starterCard: initialDeal.starterCard,
      playLaunchSound: true,
      soundEnabled: initialDeal.soundEnabled,
    });

    const tl = gsap.timeline({
      onComplete: () => {
        stopCardAnimationSounds(0.02);
        onRevealDiscardCardRef.current?.(initialDeal.starterCard);
        myCards.forEach((c) => onCardLandedRef.current?.(c.id));
        onInitialDealCompleteRef.current?.();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            cleanupFlightNodes(createdNodes);
          });
        });
      },
    });

    if (initialDeal.soundEnabled !== false) {
      playSound('shuffle', {
        actionKey: `shuffle_${initialDeal.id}`,
        timeScale: 1,
      });
    }

    descriptors.forEach((desc, idx) => {
      const w = desc.isStarterDiscard ? discardW : cardW;
      const h = desc.isStarterDiscard ? discardH : cardH;
      scheduleCardFlight(
        tl,
        stage,
        desc,
        w,
        h,
        1000 + idx,
        createdNodes,
        (cid) => onCardLandedRef.current?.(cid),
        (sc) => onRevealDiscardCardRef.current?.(sc)
      );
    });

    return () => {
      stopCardAnimationSounds(0.02, 'card-shuffle');
      tl.kill();
      cleanupFlightNodes(createdNodes);
    };
  }, [initialDeal?.id, isLandscape]);

  // 2. Mid-Game Player Draw / Penalty / Roulette Flight
  useEffect(() => {
    if (!flight || !stageRef.current) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      flight.cards?.forEach((c) => onCardLandedRef.current?.(c.id));
      onFlightCompleteRef.current?.();
      return;
    }

    const stage = stageRef.current;
    const createdNodes: HTMLElement[] = [];
    const deckEl = document.getElementById('uno-draw-deck');
    const handEl = document.getElementById('uno-player-hand');

    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let sX = winW * 0.44;
    let sY = winH * 0.44;
    if (deckEl) {
      const r = deckEl.getBoundingClientRect();
      sX = r.left + r.width / 2;
      sY = r.top + r.height / 2;
    }

    const sampleSlot = handEl?.querySelector('[data-hand-card-id]') as HTMLElement | null;
    const sampleRect = sampleSlot?.getBoundingClientRect();
    const cardW =
      sampleRect && sampleRect.width > 20
        ? sampleRect.width
        : isLandscape
        ? 54
        : winW < 640
        ? 68
        : 82;
    const cardH =
      sampleRect && sampleRect.height > 20
        ? sampleRect.height
        : isLandscape
        ? 78
        : winW < 640
        ? 100
        : 120;

    const drawnCards = flight.cards || [];
    const isRoulette = flight.reason === 'roulette';
    const maxVisual = isRoulette ? 12 : 8;
    const visualCount = Math.min(Math.max(1, flight.count), maxVisual);
    const stagger = isRoulette ? (visualCount > 7 ? 0.3 : 0.36) : 0.105;
    const flightDuration = isRoulette ? 0.5 : 0.48;
    const handRect = handEl?.getBoundingClientRect();
    const totalFlightSpan = (visualCount - 1) * stagger + flightDuration;

    const speed = Math.max(1, timeScaleRef.current);
    const tl = gsap.timeline({
      onComplete: () => {
        if (badgeRef.current) {
          badgeRef.current.style.opacity = '0';
        }
        drawnCards.forEach((c) => onCardLandedRef.current?.(c.id));
        onFlightCompleteRef.current?.();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            cleanupFlightNodes(createdNodes);
          });
        });
      },
    });
    tl.timeScale(speed);

    // Tactical callout badge above draw deck — bound directly to tl so it disposes before tl finishes
    const badgeNode = badgeRef.current;
    if (badgeNode) {
      if (isRoulette && badgeCounterRef.current) {
        badgeCounterRef.current.textContent = `1/${flight.count}`;
      }
      gsap.killTweensOf(badgeNode);
      gsap.set(badgeNode, {
        opacity: 0,
        x: sX,
        y: sY - 18,
        scale: 0.82,
      });
      tl.to(
        badgeNode,
        {
          opacity: 1,
          x: sX,
          y: sY - (isLandscape ? 36 : 48),
          scale: 1,
          duration: 0.16,
          ease: 'back.out(2)',
        },
        0
      );
      tl.to(
        badgeNode,
        {
          opacity: 0,
          y: sY - (isLandscape ? 46 : 58),
          duration: 0.15,
          ease: 'power2.in',
        },
        Math.max(0.2, totalFlightSpan - 0.15)
      );
    }

    for (let i = 0; i < visualCount; i++) {
      const cardObj = drawnCards[i];
      let eX = handRect ? handRect.left + handRect.width / 2 : winW * 0.5;
      let eY = handRect ? handRect.top + handRect.height * 0.55 : winH * 0.86;

      if (cardObj) {
        const slotEl = document.querySelector(`[data-hand-card-id="${cardObj.id}"]`);
        if (slotEl) {
          const r = slotEl.getBoundingClientRect();
          const halfW = r.width / 2;
          const rawX = r.left + halfW;
          eX = handRect
            ? Math.max(handRect.left + halfW, Math.min(handRect.right - halfW, rawX))
            : rawX;
          eY = r.top + r.height / 2;
        } else {
          const spread = (i - (visualCount - 1) / 2) * (isLandscape ? 24 : 34);
          eX += spread;
        }
      } else {
        const spread = (i - (visualCount - 1) / 2) * (isLandscape ? 24 : 34);
        eX += spread;
      }

      const dx = eX - sX;
      const dy = eY - sY;
      const fanSign = i % 2 === 0 ? 1 : -1;
      const curveOffset =
        visualCount > 1 ? (i - (visualCount - 1) / 2) * 34 : 30 * fanSign;
      const displayIdx =
        i === visualCount - 1 ? flight.count : Math.min(flight.count, i + 1);

      const desc: FlightDescriptor = {
        key: `${flight.id}_me_${i}`,
        frontSrc: cardObj ? getCardImagePath(cardObj, false) : '/cards/card_back.webp',
        revealFace: Boolean(cardObj),
        startX: sX,
        startY: sY,
        ctrlX: sX + dx * 0.46 + curveOffset,
        ctrlY: sY + dy * 0.35 - (isLandscape ? 34 : 54),
        endX: eX,
        endY: eY,
        startScale: 0.86,
        peakScale: isRoulette ? 1.18 : 1.14,
        endScale: 1.0,
        startRotZ: -8,
        midRotZ: (i - (visualCount - 1) / 2) * 7 + fanSign * 5,
        endRotZ: 0,
        delay: i * stagger,
        duration: flightDuration,
        handCardId: cardObj?.id,
        playLaunchSound: true,
        playLandingSound: isRoulette && i === visualCount - 1,
        soundEnabled: flight.soundEnabled,
        timeScale: speed,
        onLaunch: isRoulette
          ? () => {
              if (badgeCounterRef.current) {
                badgeCounterRef.current.textContent = `${displayIdx}/${flight.count}`;
              }
            }
          : undefined,
      };

      scheduleCardFlight(
        tl,
        stage,
        desc,
        cardW,
        cardH,
        1050 + i,
        createdNodes,
        (cid) => {
          onCardLandedRef.current?.(cid);
          if (i === visualCount - 1 && drawnCards.length > visualCount) {
            for (let k = visualCount; k < drawnCards.length; k++) {
              onCardLandedRef.current?.(drawnCards[k].id);
            }
          }
        }
      );
    }

    return () => {
      if (badgeNode) {
        gsap.killTweensOf(badgeNode);
        badgeNode.style.opacity = '0';
      }
      tl.kill();
      cleanupFlightNodes(createdNodes);
    };
  }, [flight?.id, isLandscape]);

  // 3. Mid-Game Opponent Draw / Penalty / Roulette Flight
  useEffect(() => {
    if (!opponentFlight || !stageRef.current) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      onOpponentFlightCompleteRef.current?.();
      return;
    }

    const stage = stageRef.current;
    const createdNodes: HTMLElement[] = [];
    const deckEl = document.getElementById('uno-draw-deck');

    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let sX = winW * 0.44;
    let sY = winH * 0.44;
    if (deckEl) {
      const r = deckEl.getBoundingClientRect();
      sX = r.left + r.width / 2;
      sY = r.top + r.height / 2;
    }

    let eX = winW * 0.5;
    let eY = Math.max(42, winH * 0.09);
    if (opponentFlight.opponentId) {
      const oppEl = document.querySelector(
        `[data-opponent-id="${opponentFlight.opponentId}"]`
      );
      if (oppEl) {
        const r = oppEl.getBoundingClientRect();
        eX = r.left + r.width / 2;
        eY = r.top + r.height / 2;
      }
    }

    const oppCards = opponentFlight.cards || [];
    const isRoulette = opponentFlight.reason === 'roulette';
    const cardW = isRoulette ? (isLandscape ? 54 : 68) : isLandscape ? 50 : 62;
    const cardH = isRoulette ? (isLandscape ? 78 : 100) : isLandscape ? 72 : 90;
    const maxVisual = isRoulette ? 12 : 6;
    const visualCount = Math.min(Math.max(1, opponentFlight.count), maxVisual);
    const stagger = isRoulette ? (visualCount > 7 ? 0.3 : 0.36) : 0.105;
    const flightDuration = isRoulette ? 0.5 : 0.46;
    const totalFlightSpan = (visualCount - 1) * stagger + flightDuration;
    const dx = eX - sX;
    const dy = eY - sY;
    const sideSign = dx >= 0 ? 1 : -1;

    const speed = Math.max(1, timeScaleRef.current);
    const tl = gsap.timeline({
      onComplete: () => {
        if (badgeRef.current) {
          badgeRef.current.style.opacity = '0';
        }
        if (opponentFlight.opponentId) {
          onOpponentCardLandedRef.current?.(opponentFlight.opponentId, 0);
        }
        cleanupFlightNodes(createdNodes);
        onOpponentFlightCompleteRef.current?.();
      },
    });
    tl.timeScale(speed);

    // Show tactical callout badge for opponent draws too if local player isn't currently drawing
    const badgeNode = !flight ? badgeRef.current : null;
    if (badgeNode) {
      if (isRoulette && badgeCounterRef.current) {
        badgeCounterRef.current.textContent = `1/${opponentFlight.count}`;
      }
      gsap.killTweensOf(badgeNode);
      gsap.set(badgeNode, {
        opacity: 0,
        x: sX,
        y: sY - 18,
        scale: 0.82,
      });
      tl.to(
        badgeNode,
        {
          opacity: 1,
          x: sX,
          y: sY - (isLandscape ? 36 : 48),
          scale: 1,
          duration: 0.16,
          ease: 'back.out(2)',
        },
        0
      );
      tl.to(
        badgeNode,
        {
          opacity: 0,
          y: sY - (isLandscape ? 46 : 58),
          duration: 0.14,
          ease: 'power2.in',
        },
        Math.max(0.18, totalFlightSpan - 0.14)
      );
    }

    for (let i = 0; i < visualCount; i++) {
      const cardObj = oppCards[i];
      const revealCardFace = isRoulette && Boolean(cardObj);
      const spread = (i - (visualCount - 1) / 2) * (isRoulette ? 16 : 20);
      const displayIdx =
        i === visualCount - 1
          ? opponentFlight.count
          : Math.min(opponentFlight.count, i + 1);
      const remainingAfterLand = Math.max(
        0,
        opponentFlight.count - Math.round(((i + 1) / visualCount) * opponentFlight.count)
      );

      const desc: FlightDescriptor = {
        key: `${opponentFlight.id}_opp_${i}`,
        frontSrc:
          revealCardFace && cardObj
            ? getCardImagePath(cardObj, false)
            : '/cards/card_back.webp',
        revealFace: revealCardFace,
        startX: sX,
        startY: sY,
        ctrlX: sX + dx * 0.48 + sideSign * (isRoulette ? 34 : 42) + spread,
        ctrlY: sY + dy * 0.42 - (isRoulette ? 24 : 32),
        endX: eX + spread * 0.2,
        endY: eY,
        startScale: 0.88,
        peakScale: revealCardFace ? 1.08 : 0.98,
        endScale: 0.4,
        startRotZ: -6,
        midRotZ: revealCardFace ? sideSign * 6 : sideSign * 16 + i * 4,
        endRotZ: sideSign * 5,
        delay: i * stagger,
        duration: flightDuration,
        targetOpponentId: opponentFlight.opponentId,
        playLaunchSound: true,
        playLandingSound: isRoulette && i === visualCount - 1,
        soundEnabled: opponentFlight.soundEnabled,
        timeScale: speed,
        onLaunch:
          isRoulette && !flight
            ? () => {
                if (badgeCounterRef.current) {
                  badgeCounterRef.current.textContent = `${displayIdx}/${opponentFlight.count}`;
                }
              }
            : undefined,
        onLandedCallback: opponentFlight.opponentId
          ? () => {
              onOpponentCardLandedRef.current?.(
                opponentFlight.opponentId!,
                remainingAfterLand
              );
            }
          : undefined,
      };

      scheduleCardFlight(tl, stage, desc, cardW, cardH, 1020 + i, createdNodes);
    }

    return () => {
      if (badgeNode) {
        gsap.killTweensOf(badgeNode);
        badgeNode.style.opacity = '0';
      }
      tl.kill();
      cleanupFlightNodes(createdNodes);
    };
  }, [opponentFlight?.id, isLandscape]);

  // 4. Played Card Flight to Discard Pile (From Player Hand or Opponent Seat -> #uno-discard-pile)
  useEffect(() => {
    if (!playedFlight || !stageRef.current) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      onRevealDiscardCardRef.current?.(playedFlight.card);
      onPlayedCardLandedRef.current?.(playedFlight.card.id);
      return;
    }

    const stage = stageRef.current;
    const createdNodes: HTMLElement[] = [];
    const discardEl = document.getElementById('uno-discard-pile');
    if (!discardEl) {
      onRevealDiscardCardRef.current?.(playedFlight.card);
      onPlayedCardLandedRef.current?.(playedFlight.card.id);
      return;
    }

    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const discardRect = discardEl.getBoundingClientRect();
    const endX = discardRect.left + discardRect.width / 2;
    const endY = discardRect.top + discardRect.height / 2;
    const cardW = discardRect.width || (isLandscape ? 54 : 88);
    const cardH = discardRect.height || (isLandscape ? 78 : 128);

    let startX = winW * 0.5;
    let startY = playedFlight.source === 'me' ? winH * 0.84 : winH * 0.1;
    let startScale = playedFlight.source === 'me' ? 0.92 : 0.52;

    if (playedFlight.startRect) {
      startX = playedFlight.startRect.left + playedFlight.startRect.width / 2;
      startY = playedFlight.startRect.top + playedFlight.startRect.height / 2;
      startScale = Math.min(1.04, playedFlight.startRect.width / cardW);
    } else if (playedFlight.source === 'opponent' && playedFlight.opponentId) {
      const oppEl = document.querySelector(
        `[data-opponent-id="${playedFlight.opponentId}"]`
      );
      if (oppEl) {
        const r = oppEl.getBoundingClientRect();
        startX = r.left + r.width / 2;
        startY = r.top + r.height / 2;
      }
    }

    const { wrapper, inner, front, glint } = create3DCardNode(
      stage,
      cardW,
      cardH,
      getCardImagePath(playedFlight.card, false),
      1100,
      createdNodes
    );

    const dx = endX - startX;
    const dy = endY - startY;
    const ctrlX = startX + dx * 0.5 + (dx >= 0 ? 24 : -24);
    const ctrlY = Math.min(startY, endY) - (playedFlight.isSlam ? 54 : 36);
    const progressObj = { t: 0 };
    const startRotY = playedFlight.source === 'opponent' ? -160 : 0;
    const peakScale = playedFlight.isSlam ? 1.16 : 1.08;
    let impactSoundTriggered = false;
    let discardRevealedUnderneath = false;

    // 100% solid opaque from frame 0
    wrapper.style.opacity = '1';
    gsap.set(wrapper, {
      x: startX - cardW / 2,
      y: startY - cardH / 2,
      scale: startScale,
      opacity: 1,
      force3D: true,
    });

    const speed = Math.max(1, timeScaleRef.current);
    const tl = gsap.timeline({
      onComplete: () => {
        // Lock flying card at exact resting coordinates first
        wrapper.style.transform = `translate3d(${(endX - cardW / 2).toFixed(1)}px, ${(endY - cardH / 2).toFixed(1)}px, 0) scale(1)`;
        inner.style.transform = 'rotateY(0deg) rotateX(0deg) rotateZ(0deg)';
        front.style.boxShadow = '0 2px 6px -1px rgba(0, 0, 0, 0.55)';
        glint.style.opacity = '0';

        if (!discardRevealedUnderneath) {
          discardRevealedUnderneath = true;
          onRevealDiscardCardRef.current?.(playedFlight.card);
        }

        onPlayedCardLandedRef.current?.(playedFlight.card.id);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            cleanupFlightNodes(createdNodes);
          });
        });
      },
    });
    tl.timeScale(speed);

    if (playedFlight.soundEnabled !== false) {
      playSound('card_throw', {
        actionKey: `throw_${playedFlight.id}`,
        timeScale: speed,
      });
    }

    tl.to(progressObj, {
      t: 1,
      duration: playedFlight.isSlam ? 0.46 : 0.42,
      ease: 'power2.out',
      onUpdate: () => {
        const t = progressObj.t;
        const inv = 1 - t;
        const bx = inv * inv * startX + 2 * inv * t * ctrlX + t * t * endX;
        const by = inv * inv * startY + 2 * inv * t * ctrlY + t * t * endY;
        const scale =
          t < 0.45
            ? gsap.utils.interpolate(startScale, peakScale, t / 0.45)
            : gsap.utils.interpolate(peakScale, 1.0, (t - 0.45) / 0.55);
        const rotY = gsap.utils.interpolate(startRotY, 0, Math.min(1, t * 1.45));
        const rotX = t < 0.85 ? Math.sin((t / 0.85) * Math.PI) * 14 : 0;
        const rotZ = t < 0.85 ? Math.sin((t / 0.85) * Math.PI) * (dx >= 0 ? 8 : -8) : 0;

        // Subtle mid-air foil glint only between t=0.08..0.60 so the card face is 100% clean on landing
        if (t > 0.08 && t < 0.6) {
          const gp = (t - 0.08) / 0.52;
          glint.style.opacity = String(Math.sin(gp * Math.PI) * 0.7);
          glint.style.transform = `translateX(${-120 + gp * 240}%)`;
        } else {
          glint.style.opacity = '0';
        }

        // Smoothly settle elevation shadow down to UnoCard's resting shadow from t=0.68..1.0
        if (t >= 0.68) {
          const sp = (t - 0.68) / 0.32;
          const blur = gsap.utils.interpolate(24, 6, sp).toFixed(1);
          const yOff = gsap.utils.interpolate(12, 2, sp).toFixed(1);
          const alpha = gsap.utils.interpolate(0.8, 0.55, sp).toFixed(2);
          front.style.boxShadow = `0 ${yOff}px ${blur}px rgba(0,0,0,${alpha})`;
        }

        // Trigger impact sound at t=0.70 (~300ms) so the 115ms-155ms landing sound finishes right with the flight at t=1.0
        if (!impactSoundTriggered && t >= 0.7) {
          impactSoundTriggered = true;
          if (playedFlight.soundEnabled !== false) {
            playSound(
              playedFlight.isSpecial || playedFlight.isSlam ? 'special_card' : 'card_land',
              {
                actionKey: `impact_${playedFlight.id}`,
                timeScale: speed,
              }
            );
          }
        }

        wrapper.style.transform = `translate3d(${(bx - cardW / 2).toFixed(1)}px, ${(by - cardH / 2).toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
        inner.style.transform = `rotateY(${rotY.toFixed(1)}deg) rotateX(${rotX.toFixed(1)}deg) rotateZ(${rotZ.toFixed(1)}deg)`;
      },
    });

    return () => {
      tl.kill();
      cleanupFlightNodes(createdNodes);
    };
  }, [playedFlight?.id, isLandscape]);

  const activeBadgeFlight = flight || opponentFlight;

  return (
    <div
      ref={stageRef}
      className="fixed inset-0 pointer-events-none z-[60] overflow-hidden"
      aria-hidden="true"
    >
      {/* Tactical Chamfered Deal Callout above Draw Deck */}
      {activeBadgeFlight && (
        <div
          ref={badgeRef}
          style={{ opacity: 0 }}
          className="fixed top-0 left-0 -translate-x-1/2 pointer-events-none z-[65] whitespace-nowrap font-mono-hud"
        >
          {activeBadgeFlight.reason === 'roulette' ? (
            <div className="px-3 py-1 clip-chamfer-btn bg-[#140d1c] border-2 border-amber-400 text-amber-300 font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_#000] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                {activeBadgeFlight.targetColor
                  ? `ROULETTE (${activeBadgeFlight.targetColor})`
                  : activeBadgeFlight.label || 'ROULETTE'}
              </span>
              <span
                ref={badgeCounterRef}
                className="px-1.5 py-0.2 rounded bg-black/70 border border-amber-400/60 text-white text-[10px] font-mono"
              >
                1/{activeBadgeFlight.count}
              </span>
            </div>
          ) : activeBadgeFlight.reason === 'penalty' || activeBadgeFlight.count > 1 ? (
            <div className="px-3 py-1 clip-chamfer-btn bg-red-600 border-2 border-amber-300 text-white font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_#000] flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>{activeBadgeFlight.label || `+${activeBadgeFlight.count} PENALTY`}</span>
            </div>
          ) : activeBadgeFlight.target === 'opponent' ? (
            <div className="px-2.5 py-0.5 clip-chamfer-btn bg-[#141219] border border-neutral-600 text-neutral-200 font-bold text-[10px] uppercase tracking-wider shadow-[2px_2px_0px_#000] flex items-center gap-1">
              <Layers className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{activeBadgeFlight.opponentName || 'CONTENDER'} +1 CARD</span>
            </div>
          ) : (
            <div className="px-2.5 py-0.5 clip-chamfer-btn bg-[#141219] border border-amber-400 text-amber-300 font-black text-[11px] uppercase tracking-wider shadow-[2px_2px_0px_#000] flex items-center gap-1">
              <Layers className="w-3 h-3 text-amber-400 shrink-0" />
              <span>+1 CARD DEALT</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
