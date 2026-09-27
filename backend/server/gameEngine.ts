import { Card, CardColor, GameState, Player, EliminationHighlight } from '@uno/shared/types';
import { generateDeck, getPenaltyAmount, isWildCard, shuffleDeck, isValidPlay } from '@uno/shared/unoDeck';
import {
  games,
  roomDrawPiles,
  roomMatchStats,
  userProfiles,
  broadcastLog,
  broadcastToRoom,
  sendFullSync,
  recordMatchFinish,
  broadcastLobbyListUpdate,
  sendActiveMatchStatus,
} from './state';
import { checkAndTriggerBotTurn } from './botEngine';
import { LiveMatchStats } from './types';

// Check and eliminate any player who reached or exceeded the Mercy Limit
export function checkMercyRule(game: GameState): boolean {
  if (game.rules.mercyLimit <= 0) return false;

  let anyEliminated = false;
  game.players.forEach((player) => {
    if (!player.isEliminated && player.cards.length >= game.rules.mercyLimit) {
      player.isEliminated = true;
      player.eliminationReason = `Accumulated ${player.cards.length} cards (Mercy limit: ${game.rules.mercyLimit})`;
      player.eliminatedAt = Date.now();
      anyEliminated = true;

      const stats = roomMatchStats.get(game.roomId);
      const killer = stats?.lastAttacker;

      const eliminationHighlight: EliminationHighlight = {
        id: `elim_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        victimId: player.id,
        victimName: player.name,
        victimAvatar: player.avatar,
        killerId: killer?.id,
        killerName: killer?.name,
        killerAvatar: killer?.avatar,
        cardCount: player.cards.length,
        fatalReason: killer
          ? `Knocked out by +${killer.penalty || 10} stack (${killer.card}) from ${killer.name}`
          : `Reached ${player.cards.length} cards (Mercy KO limit)`,
        timestamp: Date.now(),
      };

      game.lastElimination = eliminationHighlight;
      broadcastToRoom(game.roomId, {
        type: 'ELIMINATION_HIGHLIGHT',
        highlight: eliminationHighlight,
      });

      setTimeout(() => {
        if (game.lastElimination?.id === eliminationHighlight.id) {
          game.lastElimination = undefined;
          sendFullSync(game);
        }
      }, 5000);

      const recycledHand = player.cards.map((c) => ({
        ...c,
        chosenColor: undefined,
      }));
      game.discardPile.unshift(...recycledHand);
      player.cards = [];

      broadcastLog(
        game,
        `💀 ${player.name} knocked out! (Mercy rule)`,
        'mercy'
      );

      const profile = userProfiles.get(player.id);
      if (profile) {
        profile.mercyEliminationsSuffered = (profile.mercyEliminationsSuffered || 0) + 1;
      }
      sendActiveMatchStatus(player.id);
    }
  });

  const activePlayers = game.players.filter((p) => !p.isEliminated);
  const totalHumans = game.players.filter((p) => !p.isBot);
  const activeHumans = activePlayers.filter((p) => !p.isBot);

  // If match had human players and all human players are eliminated, finish immediately
  if (totalHumans.length > 0 && activeHumans.length === 0) {
    const winner = activePlayers[0] || game.players[0];
    game.status = 'ended';
    game.winnerId = winner?.id;
    game.winnerReason = 'mercy_eliminations';
    game.endedAt = Date.now();
    broadcastLog(
      game,
      `🏁 Match concluded: All human players eliminated!`,
      'win'
    );
    if (winner) recordMatchFinish(game, winner);
    sendFullSync(game);
    return true;
  }

  if (activePlayers.length <= 1) {
    const winner = activePlayers[0] || game.players[0];
    game.status = 'ended';
    game.winnerId = winner.id;
    game.winnerReason = 'mercy_eliminations';
    game.endedAt = Date.now();
    broadcastLog(
      game,
      `👑 ${winner.name} won the match!`,
      'win'
    );
    recordMatchFinish(game, winner);
    sendFullSync(game);
    return true;
  }

  if (totalHumans.length > 1 && activeHumans.length === 1 && activePlayers.length <= 2) {
    const winner = activeHumans[0];
    game.status = 'ended';
    game.winnerId = winner.id;
    game.winnerReason = 'mercy_eliminations';
    game.endedAt = Date.now();
    broadcastLog(
      game,
      `👑 ${winner.name} won the match!`,
      'win'
    );
    recordMatchFinish(game, winner);
    sendFullSync(game);
    return true;
  }

  if (anyEliminated) {
    if (game.status === 'playing' && game.players[game.currentTurnIndex]?.isEliminated) {
      advanceTurn(game, 1);
    }
    sendFullSync(game);
  }

  return anyEliminated;
}

export function advanceTurn(game: GameState, skipCount = 1) {
  if (game.status !== 'playing') return;
  const activePlayers = game.players.filter((p) => !p.isEliminated);
  if (activePlayers.length <= 1) {
    if (activePlayers.length === 1) {
      checkMercyRule(game);
      sendFullSync(game);
    }
    return;
  }

  let steps = skipCount;
  let loopGuard = 0;
  while (steps > 0 && loopGuard < game.players.length * 3) {
    loopGuard++;
    game.currentTurnIndex = (game.currentTurnIndex + game.direction + game.players.length) % game.players.length;
    if (!game.players[game.currentTurnIndex].isEliminated) {
      steps--;
    }
  }
  game.turnTimeRemaining = game.rules.turnTimerSeconds || 30;
  (game as any).turnGraceStartedAt = undefined;

  checkAndTriggerBotTurn(game);
}

export function drawCardFromPile(game: GameState): Card | null {
  let deck = roomDrawPiles.get(game.roomId);
  if (!deck || deck.length === 0) {
    replenishDrawPile(game);
    deck = roomDrawPiles.get(game.roomId);
  }

  if (!deck || deck.length === 0) {
    const backup = generateDeck(game.rules);
    roomDrawPiles.set(game.roomId, backup);
    deck = backup;
  }

  const card = deck.pop() || null;
  game.drawPileCount = deck.length;
  return card;
}

export function replenishDrawPile(game: GameState) {
  let deck = roomDrawPiles.get(game.roomId);
  if (!deck) {
    deck = [];
    roomDrawPiles.set(game.roomId, deck);
  }

  if (game.discardPile.length > 1) {
    const topCard = game.discardPile[game.discardPile.length - 1];
    const cardsToRecycle = game.discardPile.slice(0, -1).map((c) => ({
      ...c,
      chosenColor: undefined,
    }));
    game.discardPile = [topCard];
    deck.push(...shuffleDeck(cardsToRecycle));
  }

  if (deck.length < 15) {
    const freshCards = generateDeck(game.rules);
    deck.push(...freshCards);
  }

  game.drawPileCount = deck.length;
  broadcastLog(game, `♻️ Deck reshuffled`, 'play');
}

export function executePlayCard(
  game: GameState,
  player: Player,
  card: Card,
  chosenColor?: CardColor,
  targetPlayerId?: string
) {
  let cardIndex = player.cards.findIndex((c) => c.id === card.id);
  if (cardIndex === -1) {
    cardIndex = player.cards.findIndex((c) => c.color === card.color && c.value === card.value);
  }
  if (cardIndex === -1) return;
  player.cards.splice(cardIndex, 1);
  if (player.cards.length > 1) {
    player.hasCalledUno = false;
  } else if (player.cards.length === 1) {
    (player as any).reachedOneCardAt = Date.now();
  }

  if (isWildCard(card.value) || card.color === 'wild') {
    card.chosenColor = chosenColor || 'red';
    game.currentColor = card.chosenColor;
  } else {
    game.currentColor = card.color;
  }

  // Handle Discard All: place matching color cards underneath the played Discard All card so topCard stays consistent
  let discardedMatchingCount = 0;
  if (card.value === 'discard_all' && game.rules.allowDiscardAll) {
    const discardMatching = player.cards.filter((c) => c.color === card.color);
    if (discardMatching.length > 0) {
      discardedMatchingCount = discardMatching.length;
      player.cards = player.cards.filter((c) => c.color !== card.color);
      game.discardPile.push(...discardMatching);
    }
  }

  game.discardPile.push(card);

  const penalty = getPenaltyAmount(card.value);
  if (penalty > 0) {
    game.activePenalty += penalty;
    game.lastPenaltyCard = card;
    const stats = roomMatchStats.get(game.roomId);
    if (stats) {
      stats.penaltiesInflicted.set(player.id, (stats.penaltiesInflicted.get(player.id) || 0) + penalty);
      stats.lastAttacker = {
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        card: card.value,
        penalty: game.activePenalty,
      };
    }
    broadcastLog(
      game,
      `🔥 ${player.name}: +${penalty} (Stack +${game.activePenalty})`,
      'stack'
    );
  } else {
    broadcastLog(game, `🃏 ${player.name}: ${card.color} ${card.value}`, 'play');
  }

  if (discardedMatchingCount > 0) {
    broadcastLog(
      game,
      `💥 ${player.name}: Discard All ${card.color} (-${discardedMatchingCount})`,
      'play'
    );
  }

  // Check Win condition (0 cards)
  if (player.cards.length === 0 && !player.isEliminated) {
    game.status = 'ended';
    game.winnerId = player.id;
    game.winnerReason = 'cleared_hand';
    game.endedAt = Date.now();
    broadcastLog(game, `🏆 ${player.name} won the game!`, 'win');
    recordMatchFinish(game, player);
    sendFullSync(game);
    return;
  }

  // Special Actions
  // 1. '7' Hand Swap (Mandatory if allow7Swap is true, Optional if allow7Swap is false)
  if (card.value === '7') {
    let resolvedTargetId = targetPlayerId;
    if (!resolvedTargetId && game.rules.allow7Swap) {
      // Mandatory mode: if target wasn't passed (e.g. 2-player direct), resolve to opponent
      const activeOpps = game.players.filter((p) => p.id !== player.id && !p.isEliminated);
      if (activeOpps.length > 0) {
        resolvedTargetId = activeOpps[0].id;
      }
    }

    if (resolvedTargetId) {
      const targetPlayer = game.players.find((p) => p.id === resolvedTargetId && !p.isEliminated);
      if (targetPlayer && targetPlayer.id !== player.id) {
        const tempCards = player.cards;
        player.cards = targetPlayer.cards;
        targetPlayer.cards = tempCards;
        player.hasCalledUno = false;
        targetPlayer.hasCalledUno = false;
        const stats = roomMatchStats.get(game.roomId);
        if (stats) {
          stats.handSwaps.set(player.id, (stats.handSwaps.get(player.id) || 0) + 1);
          stats.peakCards.set(player.id, Math.max(stats.peakCards.get(player.id) || 0, player.cards.length));
          stats.peakCards.set(targetPlayer.id, Math.max(stats.peakCards.get(targetPlayer.id) || 0, targetPlayer.cards.length));
          stats.lastAttacker = {
            id: player.id,
            name: player.name,
            avatar: player.avatar,
            card: '7 Hand Swap',
            penalty: targetPlayer.cards.length,
          };
        }
        broadcastLog(
          game,
          `🔄 ${player.name} swapped hand with ${targetPlayer.name}`,
          'swap'
        );
        checkMercyRule(game);
      }
    }
  }

  // 2. '0' Rotate All Hands
  if (card.value === '0' && game.rules.allow0PassAll) {
    const activePlayers = game.players.filter((p) => !p.isEliminated);
    if (activePlayers.length > 1) {
      // Capture each active player's hand immutably before rotation
      const hands = activePlayers.map((p) => [...p.cards]);
      const n = activePlayers.length;

      // In play direction:
      // When direction == 1 (clockwise, turn goes i -> (i+1)%n),
      // each player passes their hand to the player in front of them:
      // Player i receives the hand from player (i - 1 + n) % n.
      // When direction == -1 (counter-clockwise, turn goes i -> (i-1)%n),
      // Player i receives the hand from player (i + 1) % n.
      for (let i = 0; i < n; i++) {
        const fromIndex = game.direction === 1 ? (i - 1 + n) % n : (i + 1) % n;
        activePlayers[i].cards = [...hands[fromIndex]];
      }

      activePlayers.forEach((p) => {
        p.hasCalledUno = false;
      });

      const stats = roomMatchStats.get(game.roomId);
      if (stats) {
        stats.handSwaps.set(player.id, (stats.handSwaps.get(player.id) || 0) + 1);
        activePlayers.forEach((p) => {
          stats.peakCards.set(p.id, Math.max(stats.peakCards.get(p.id) || 0, p.cards.length));
        });
      }

      broadcastLog(
        game,
        `🌪️ All hands passed ${game.direction === 1 ? 'clockwise' : 'counter-clockwise'}!`,
        'swap'
      );

      // Check if any player now has 0 cards after the pass
      const zeroCardsPlayer = activePlayers.find((p) => p.cards.length === 0);
      if (zeroCardsPlayer) {
        game.status = 'ended';
        game.winnerId = zeroCardsPlayer.id;
        game.winnerReason = 'cleared_hand';
        game.endedAt = Date.now();
        broadcastLog(game, `🏆 ${zeroCardsPlayer.name} received an empty hand and won the game!`, 'win');
        recordMatchFinish(game, zeroCardsPlayer);
        sendFullSync(game);
        return;
      }

      checkMercyRule(game);
    }
  }

  // 3. Reverse / Wild Reverse Draw 4
  if (card.value === 'reverse' || card.value === 'wild_reverse_draw4') {
    game.direction = (game.direction * -1) as 1 | -1;
    broadcastLog(
      game,
      `⤺ Reverse (${game.direction === 1 ? 'CW' : 'CCW'})`,
      'play'
    );
  }

  // 4. Skip Everyone
  if (card.value === 'skip_everyone' && game.rules.allowSkipEveryone) {
    broadcastLog(game, `⛔ ${player.name}: Skip Everyone`, 'skip');
    game.turnTimeRemaining = game.rules.turnTimerSeconds || 30;
    checkAndTriggerBotTurn(game);
    return;
  }

  // 5. Skip single player
  if (card.value === 'skip') {
    broadcastLog(game, `🚫 Skip next turn`, 'skip');
    advanceTurn(game, 2);
    return;
  }

  // 6. Wild Color Roulette
  if (card.value === 'wild_color_roulette' && game.rules.allowColorRoulette) {
    advanceTurn(game, 1);
    const victim = game.players[game.currentTurnIndex];
    if (victim && !victim.isEliminated) {
      executeColorRouletteDraw(game, victim, game.currentColor);
    }
    return;
  }

  advanceTurn(game, 1);
}

export function executeColorRouletteDraw(game: GameState, victim: Player, targetColor: CardColor) {
  let drawnCount = 0;
  const drawnCards: Card[] = [];
  const maxSafety = game.rules.mercyLimit > 0
    ? Math.max(1, game.rules.mercyLimit - victim.cards.length + 1)
    : 25;

  while (drawnCount < maxSafety) {
    const drawn = drawCardFromPile(game);
    if (!drawn) break;
    victim.cards.push(drawn);
    drawnCards.push({ ...drawn });
    drawnCount++;

    if (drawn.color === targetColor || drawn.color === 'wild') {
      break;
    }

    if (game.rules.mercyLimit > 0 && victim.cards.length >= game.rules.mercyLimit) {
      break;
    }
  }

  game.lastRouletteDraw = {
    id: `roulette_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    victimId: victim.id,
    victimName: victim.name,
    targetColor,
    cards: drawnCards,
    timestamp: Date.now(),
  };

  const stats = roomMatchStats.get(game.roomId);
  if (stats) {
    stats.peakCards.set(victim.id, Math.max(stats.peakCards.get(victim.id) || 0, victim.cards.length));
  }

  if (victim.cards.length > 1) {
    victim.hasCalledUno = false;
  }

  broadcastLog(
    game,
    `🎰 ${victim.name} drew ${drawnCount} cards (${targetColor})`,
    'draw'
  );

  checkMercyRule(game);
  if (game.status === 'playing') {
    advanceTurn(game, 1);
  }
}

export function executeDrawPenalty(game: GameState, player: Player) {
  const penalty = game.activePenalty;
  game.activePenalty = 0;
  game.lastPenaltyCard = undefined;

  for (let i = 0; i < penalty; i++) {
    const card = drawCardFromPile(game);
    if (card) player.cards.push(card);
    if (game.rules.mercyLimit > 0 && player.cards.length >= game.rules.mercyLimit + 2) {
      break;
    }
  }

  if (player.cards.length > 1) {
    player.hasCalledUno = false;
  }

  const stats = roomMatchStats.get(game.roomId);
  if (stats) {
    stats.peakCards.set(player.id, Math.max(stats.peakCards.get(player.id) || 0, player.cards.length));
    if (player.cards.length < game.rules.mercyLimit) {
      stats.stacksSurvived.set(player.id, Math.max(stats.stacksSurvived.get(player.id) || 0, penalty));
    }
  }

  broadcastLog(
    game,
    `💥 ${player.name} absorbed +${penalty} cards`,
    'draw'
  );

  checkMercyRule(game);
  if (game.status === 'playing') {
    advanceTurn(game, 1);
  }
}

export function executePlayerDraw(game: GameState, player: Player) {
  const topCard = game.discardPile[game.discardPile.length - 1];

  if (game.rules.drawUntilPlayable) {
    let drawnCardsCount = 0;
    const maxDraws = game.rules.mercyLimit > 0
      ? Math.max(1, game.rules.mercyLimit - player.cards.length + 1)
      : 20;

    while (drawnCardsCount < maxDraws) {
      const card = drawCardFromPile(game);
      if (!card) break;
      player.cards.push(card);
      drawnCardsCount++;

      if (isValidPlay(card, topCard, game.currentColor, 0, undefined, game.rules.allowStacking)) {
        break;
      }

      if (game.rules.mercyLimit > 0 && player.cards.length >= game.rules.mercyLimit) {
        break;
      }
    }

    if (player.cards.length > 1) {
      player.hasCalledUno = false;
    }

    broadcastLog(
      game,
      `📥 ${player.name} drew ${drawnCardsCount} card${drawnCardsCount > 1 ? 's' : ''}`,
      'draw'
    );
  } else {
    const card = drawCardFromPile(game);
    if (card) player.cards.push(card);
    if (player.cards.length > 1) {
      player.hasCalledUno = false;
    }
    broadcastLog(game, `📥 ${player.name} drew 1 card`, 'draw');
  }

  checkMercyRule(game);
  if (game.status === 'playing') {
    advanceTurn(game, 1);
  }
}

export function startGame(game: GameState) {
  if (game.players.length < 2) return;

  game.status = 'playing';
  game.startedAt = Date.now();
  game.currentTurnIndex = 0;
  game.direction = 1;
  game.activePenalty = 0;
  game.lastPenaltyCard = undefined;
  game.lastElimination = undefined;
  game.lastRouletteDraw = undefined;
  game.awards = undefined;
  game.activeTaunts = [];
  game.logs = [];
  game.turnTimeRemaining = game.rules.turnTimerSeconds || 30;
  (game as any).turnGraceStartedAt = undefined;

  let initialDeck: Card[] = [];
  if (game.players.length > 4) {
    initialDeck = shuffleDeck([...generateDeck(game.rules), ...generateDeck(game.rules)]);
  } else {
    initialDeck = generateDeck(game.rules);
  }

  game.players.forEach((p) => {
    p.cards = initialDeck.splice(0, 7);
    p.isEliminated = false;
    p.hasCalledUno = false;
  });

  const stats: LiveMatchStats = {
    penaltiesInflicted: new Map(),
    stacksSurvived: new Map(),
    handSwaps: new Map(),
    peakCards: new Map(),
  };
  game.players.forEach((p) => {
    stats.peakCards.set(p.id, p.cards.length);
  });
  roomMatchStats.set(game.roomId, stats);

  let startingCard = initialDeck.pop() || { id: 'c_start', color: 'red', value: '5' };
  while (isWildCard(startingCard.value) || startingCard.color === 'wild') {
    initialDeck.unshift(startingCard);
    startingCard = initialDeck.pop() || { id: 'c_start', color: 'blue', value: '7' };
  }

  game.discardPile = [startingCard];
  game.currentColor = startingCard.color;

  roomDrawPiles.set(game.roomId, initialDeck);
  game.drawPileCount = initialDeck.length;

  broadcastLog(
    game,
    `🎮 Game started!`,
    'play'
  );

  sendFullSync(game);
  broadcastLobbyListUpdate();
  checkAndTriggerBotTurn(game);
}
