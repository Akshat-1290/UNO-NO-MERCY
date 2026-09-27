import { Card, CardColor, CardValue, LobbyRules } from '@uno/shared/types';

export function getPenaltyAmount(value: CardValue): number {
  switch (value) {
    case 'draw2':
      return 2;
    case 'draw4':
      return 4;
    case 'wild_reverse_draw4':
      return 4;
    case 'wild_draw6':
      return 6;
    case 'wild_draw10':
      return 10;
    default:
      return 0;
  }
}

export function isDrawCard(value: CardValue): boolean {
  return getPenaltyAmount(value) > 0;
}

export function isWildCard(value: CardValue): boolean {
  return (
    value === 'wild' ||
    value === 'wild_reverse_draw4' ||
    value === 'wild_draw6' ||
    value === 'wild_draw10' ||
    value === 'wild_color_roulette'
  );
}

export function isValidPlay(
  card: Card,
  topCard: Card,
  currentColor: CardColor,
  activePenalty: number,
  lastPenaltyCard?: Card,
  allowStacking: boolean = true
): boolean {
  // If there is an active penalty, you can only play a valid stacking card!
  if (activePenalty > 0) {
    if (!allowStacking) return false;
    const cardPenalty = getPenaltyAmount(card.value);
    if (cardPenalty === 0) return false;
    const requiredPenalty = lastPenaltyCard ? getPenaltyAmount(lastPenaltyCard.value) : 2;
    return cardPenalty >= requiredPenalty;
  }

  // If no active penalty:
  // 1. Wild cards can be played on anything
  if (card.color === 'wild' || isWildCard(card.value)) {
    return true;
  }

  // 2. Color match (against currentColor, which accounts for previous wild selection)
  if (card.color === currentColor) {
    return true;
  }

  // 3. Value match (e.g. '5' on '5', 'skip' on 'skip')
  if (card.value === topCard.value) {
    return true;
  }

  return false;
}

export function isExactMatchForJumpIn(card: Card, topCard: Card): boolean {
  // Mattel No Mercy rules: Jump-in requires EXACT same color and same number/action.
  // Wilds are excluded from jump-in to avoid ambiguous color race conditions.
  if (card.color === 'wild' || topCard.color === 'wild') return false;
  return card.color === topCard.color && card.value === topCard.value;
}

let nextCardId = 1;

export function generateDeck(rules: LobbyRules): Card[] {
  const cards: Card[] = [];
  const colors: ('red' | 'yellow' | 'green' | 'blue')[] = ['red', 'yellow', 'green', 'blue'];

  // Add colored cards
  for (const color of colors) {
    // Number cards 0-9 (two copies of 1-9, one copy of 0)
    cards.push({ id: `card_${nextCardId++}`, color, value: '0' });
    for (let num = 1; num <= 9; num++) {
      const val = num.toString() as CardValue;
      cards.push({ id: `card_${nextCardId++}`, color, value: val });
      cards.push({ id: `card_${nextCardId++}`, color, value: val });
    }

    // Action cards per color
    // Draw 2 (two copies)
    cards.push({ id: `card_${nextCardId++}`, color, value: 'draw2' });
    cards.push({ id: `card_${nextCardId++}`, color, value: 'draw2' });

    // Draw 4 (two copies in No Mercy!)
    cards.push({ id: `card_${nextCardId++}`, color, value: 'draw4' });
    cards.push({ id: `card_${nextCardId++}`, color, value: 'draw4' });

    // Reverse (two copies)
    cards.push({ id: `card_${nextCardId++}`, color, value: 'reverse' });
    cards.push({ id: `card_${nextCardId++}`, color, value: 'reverse' });

    // Skip (two copies)
    cards.push({ id: `card_${nextCardId++}`, color, value: 'skip' });
    cards.push({ id: `card_${nextCardId++}`, color, value: 'skip' });

    // Skip Everyone (if enabled)
    if (rules.allowSkipEveryone) {
      cards.push({ id: `card_${nextCardId++}`, color, value: 'skip_everyone' });
      cards.push({ id: `card_${nextCardId++}`, color, value: 'skip_everyone' });
    }

    // Discard All (if enabled)
    if (rules.allowDiscardAll) {
      cards.push({ id: `card_${nextCardId++}`, color, value: 'discard_all' });
      cards.push({ id: `card_${nextCardId++}`, color, value: 'discard_all' });
    }
  }

  // Wild Cards
  // Regular Wild (4 copies)
  for (let i = 0; i < 4; i++) {
    cards.push({ id: `card_${nextCardId++}`, color: 'wild', value: 'wild' });
  }

  // Wild Reverse Draw 4 (4 copies)
  for (let i = 0; i < 4; i++) {
    cards.push({ id: `card_${nextCardId++}`, color: 'wild', value: 'wild_reverse_draw4' });
  }

  // Wild Draw 6 & Wild Draw 10 (if enabled)
  if (rules.allowWildDraw10And6) {
    for (let i = 0; i < 4; i++) {
      cards.push({ id: `card_${nextCardId++}`, color: 'wild', value: 'wild_draw6' });
    }
    for (let i = 0; i < 4; i++) {
      cards.push({ id: `card_${nextCardId++}`, color: 'wild', value: 'wild_draw10' });
    }
  }

  // Wild Color Roulette (if enabled, 4 copies)
  if (rules.allowColorRoulette) {
    for (let i = 0; i < 4; i++) {
      cards.push({ id: `card_${nextCardId++}`, color: 'wild', value: 'wild_color_roulette' });
    }
  }

  return shuffleDeck(cards);
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getCardTitle(card: Card): string {
  switch (card.value) {
    case 'draw2':
      return '+2';
    case 'draw4':
      return '+4';
    case 'reverse':
      return 'Reverse';
    case 'skip':
      return 'Skip';
    case 'skip_everyone':
      return 'Skip All';
    case 'discard_all':
      return 'Discard All';
    case 'wild':
      return 'Wild';
    case 'wild_reverse_draw4':
      return 'Rev +4';
    case 'wild_draw6':
      return '+6';
    case 'wild_draw10':
      return '+10';
    case 'wild_color_roulette':
      return 'Roulette';
    default:
      return card.value;
  }
}

export function getCardBadge(value: CardValue): string {
  switch (value) {
    case 'draw2':
      return '+2';
    case 'draw4':
      return '+4';
    case 'reverse':
      return '⇄';
    case 'skip':
      return '⊘';
    case 'wild_reverse_draw4':
      return '⤺+4';
    case 'wild_draw6':
      return '+6';
    case 'wild_draw10':
      return '+10';
    case 'skip_everyone':
      return '⊘⊘';
    case 'discard_all':
      return '▼▼';
    case 'wild':
      return 'W';
    case 'wild_color_roulette':
      return '✦';
    default:
      return value;
  }
}

export function getCardImagePath(card: Card, showBack: boolean = false): string {
  if (showBack) return '/cards/card_back.webp';

  if (card.color === 'wild' || isWildCard(card.value)) {
    const baseValue = card.value === 'wild' ? 'wild_wild' : card.value;
    if (card.chosenColor && card.chosenColor !== 'wild' && card.value !== 'wild') {
      return `/cards/${card.value}_${card.chosenColor}.webp`;
    }
    return `/cards/${baseValue}.webp`;
  }

  return `/cards/${card.color}_${card.value}.webp`;
}

const preloadedCardImages = new Map<string, HTMLImageElement>();
let cardPreloadInitiated = false;

/**
 * Pre-fetches and keeps decoded HTMLImageElement instances in memory for all 85 card textures
 * so played/drawn cards and discard pile transitions render in 0ms without texture decode flicker.
 */
export function preloadAllCardImages(): void {
  if (typeof window === 'undefined' || cardPreloadInitiated) return;
  cardPreloadInitiated = true;

  const colors = ['red', 'yellow', 'green', 'blue'] as const;
  const colorValues = [
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    'draw2',
    'draw4',
    'reverse',
    'skip',
    'skip_everyone',
    'discard_all',
  ];
  const wildValues = [
    'wild_color_roulette',
    'wild_draw10',
    'wild_draw6',
    'wild_reverse_draw4',
  ];

  const paths: string[] = ['/cards/card_back.webp', '/cards/wild_wild.webp'];
  for (const c of colors) {
    for (const v of colorValues) {
      paths.push(`/cards/${c}_${v}.webp`);
    }
  }
  for (const w of wildValues) {
    paths.push(`/cards/${w}.webp`);
    for (const c of colors) {
      paths.push(`/cards/${w}_${c}.webp`);
    }
  }

  let index = 0;
  const loadBatch = () => {
    const batchEnd = Math.min(index + 12, paths.length);
    for (; index < batchEnd; index++) {
      const src = paths[index];
      if (!preloadedCardImages.has(src)) {
        const img = new Image();
        img.decoding = 'sync';
        img.src = src;
        preloadedCardImages.set(src, img);
      }
    }
    if (index < paths.length) {
      setTimeout(loadBatch, 25);
    }
  };

  loadBatch();
}

