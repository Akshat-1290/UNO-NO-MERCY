import { CardColor, GameState, Player, BotPersonality } from '@uno/shared/types';
import { isValidPlay, isWildCard, getPenaltyAmount } from '@uno/shared/unoDeck';
import {
  countConnectedHumanPlayers,
  broadcastLog,
  sendFullSync,
  triggerTableTaunt,
  roomMatchStats,
} from './state';
import {
  drawCardFromPile,
  checkMercyRule,
  executePlayCard,
  executeDrawPenalty,
  executePlayerDraw,
} from './gameEngine';

export function getRandomColor(): CardColor {
  const colors: CardColor[] = ['red', 'yellow', 'green', 'blue'];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function getBotDominantColor(bot: Player): CardColor {
  const counts: Record<CardColor, number> = { red: 0, yellow: 0, green: 0, blue: 0, wild: 0 };
  bot.cards.forEach((c) => {
    if (c.color !== 'wild') counts[c.color]++;
  });
  let maxColor: CardColor = 'red';
  let maxCount = -1;
  (['red', 'yellow', 'green', 'blue'] as CardColor[]).forEach((col) => {
    if (counts[col] > maxCount) {
      maxCount = counts[col];
      maxColor = col;
    }
  });
  return maxColor;
}

const roomBotTimers = new Map<string, NodeJS.Timeout>();
const roomBotExecuting = new Map<string, boolean>();

export function clearBotTimer(roomId: string) {
  const timer = roomBotTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    roomBotTimers.delete(roomId);
  }
  roomBotExecuting.delete(roomId);
}

export function checkAndTriggerBotTurn(game: GameState) {
  if (!game || game.status !== 'playing') {
    clearBotTimer(game?.roomId || '');
    return;
  }

  // Clear any existing timer for this room to avoid duplicate/stacked turn triggers
  clearBotTimer(game.roomId);

  if (countConnectedHumanPlayers(game) === 0) {
    game.status = 'paused';
    game.pauseReason = 'Match paused: All players have left the table. Bots will not fight alone.';
    broadcastLog(game, '⏸️ Match paused', 'play');
    sendFullSync(game);
    return;
  }

  const currentPlayer = game.players[game.currentTurnIndex];
  if (!currentPlayer || !currentPlayer.isBot || currentPlayer.isEliminated) return;

  const isOpeningDeal = Boolean(game.startedAt && Date.now() - game.startedAt < 2500);
  const recentRoulette =
    game.lastRouletteDraw && Date.now() - game.lastRouletteDraw.timestamp < 4500
      ? Math.min(game.lastRouletteDraw.cards.length, 12) * 360 + 600
      : 0;
  const delay =
    (isOpeningDeal ? 2200 : 1150) + recentRoulette + Math.floor(Math.random() * 650);

  const timer = setTimeout(() => {
    roomBotTimers.delete(game.roomId);
    if (roomBotExecuting.get(game.roomId)) return;

    try {
      roomBotExecuting.set(game.roomId, true);

      if (game.status !== 'playing') return;
      if (countConnectedHumanPlayers(game) === 0) return;

      const player = game.players[game.currentTurnIndex];
      if (!player || player.id !== currentPlayer.id || !player.isBot || player.isEliminated) return;

      handleBotPlay(game, player);
    } catch (error) {
      console.error(`[BotEngine Error Boundary] Handled bot turn error in room "${game.roomId}":`, error);
      // Failsafe recovery: execute a standard draw so turn timer doesn't get stuck
      try {
        const player = game.players[game.currentTurnIndex];
        if (player && player.isBot && !player.isEliminated && game.status === 'playing') {
          if (game.activePenalty > 0) {
            executeDrawPenalty(game, player);
          } else {
            executePlayerDraw(game, player);
          }
          sendFullSync(game);
        }
      } catch (recoveryError) {
        console.error(`[BotEngine Recovery Failed] in room "${game.roomId}":`, recoveryError);
      }
    } finally {
      roomBotExecuting.set(game.roomId, false);
    }
  }, delay);

  roomBotTimers.set(game.roomId, timer);
}

export function handleBotPlay(game: GameState, bot: Player) {
  const topCard = game.discardPile[game.discardPile.length - 1];
  const personality: BotPersonality = bot.botPersonality || 'aggressive';

  // Check if any opponent currently has 1 card without having called UNO!
  const now = Date.now();
  const uncalledOpponent = game.players.find((p) => {
    if (p.id === bot.id || p.isEliminated || p.cards.length !== 1 || p.hasCalledUno) return false;
    const reachedAt = (p as any).reachedOneCardAt || 0;
    if (!p.isBot && now - reachedAt < 2200) return false;
    return true;
  });
  if (uncalledOpponent) {
    const catchChance = personality === 'aggressive' ? 0.85 : personality === 'chaos' ? 0.65 : 0.45;
    if (Math.random() < catchChance) {
      for (let i = 0; i < 2; i++) {
        const c = drawCardFromPile(game);
        if (c) uncalledOpponent.cards.push(c);
      }
      uncalledOpponent.hasCalledUno = false;
      const stats = roomMatchStats.get(game.roomId);
      if (stats) {
        stats.peakCards.set(uncalledOpponent.id, Math.max(stats.peakCards.get(uncalledOpponent.id) || 0, uncalledOpponent.cards.length));
      }
      broadcastLog(
        game,
        `🚨 ${bot.name} caught ${uncalledOpponent.name}! (+2 cards)`,
        'uno'
      );
      checkMercyRule(game);
      if (game.status !== 'playing') {
        sendFullSync(game);
        return;
      }
    }
  }

  // Occasional bot taunt (14% chance)
  if (Math.random() < 0.14) {
    if (personality === 'aggressive') {
      const aggressiveTaunts = ['💀 No Mercy!', '🔥 +10 incoming!', '😈 Cry more!', '💥 GET WRECKED'];
      triggerTableTaunt(game, bot, aggressiveTaunts[Math.floor(Math.random() * aggressiveTaunts.length)]);
    } else if (personality === 'chaos') {
      const chaosTaunts = ['🍿 Eating popcorn', '🃏 Swap with me!', '🌪️ Pure Chaos!'];
      triggerTableTaunt(game, bot, chaosTaunts[Math.floor(Math.random() * chaosTaunts.length)]);
    } else {
      const casualTaunts = ['😰 Sweating...', '👏 GG!', '😭 Have Mercy!'];
      triggerTableTaunt(game, bot, casualTaunts[Math.floor(Math.random() * casualTaunts.length)]);
    }
  }

  // 1. If active penalty > 0, bot MUST stack if possible, otherwise draw
  if (game.activePenalty > 0) {
    const validStackCards = bot.cards.filter((c) =>
      isValidPlay(c, topCard, game.currentColor, game.activePenalty, game.lastPenaltyCard, game.rules.allowStacking)
    );

    if (validStackCards.length > 0) {
      let chosenStack = validStackCards[0];
      if (personality === 'aggressive') {
        validStackCards.sort((a, b) => getPenaltyAmount(b.value) - getPenaltyAmount(a.value));
        chosenStack = validStackCards[0];
      } else if (personality === 'casual') {
        validStackCards.sort((a, b) => getPenaltyAmount(a.value) - getPenaltyAmount(b.value));
        chosenStack = validStackCards[0];
      }
      const chosenCol = personality === 'chaos' ? getRandomColor() : getBotDominantColor(bot);
      executePlayCard(game, bot, chosenStack, chosenCol);
      sendFullSync(game);
      return;
    } else {
      executeDrawPenalty(game, bot);
      sendFullSync(game);
      return;
    }
  }

  // 2. Normal play: Find playable cards
  const playableCards = bot.cards.filter((c) =>
    isValidPlay(c, topCard, game.currentColor, 0, undefined, game.rules.allowStacking)
  );

  if (playableCards.length > 0) {
    let chosenCard = playableCards[0];

    if (personality === 'aggressive') {
      const discardAll = playableCards.find((c) => c.value === 'discard_all');
      const bigPenalty = playableCards.find((c) =>
        ['wild_draw10', 'wild_draw6', 'draw4', 'wild_reverse_draw4', 'skip_everyone'].includes(c.value)
      );
      if (discardAll && bot.cards.length > 3) {
        chosenCard = discardAll;
      } else if (bigPenalty) {
        chosenCard = bigPenalty;
      } else {
        chosenCard = playableCards[0];
      }
    } else if (personality === 'chaos') {
      const chaosCard = playableCards.find((c) =>
        ['7', '0', 'skip_everyone', 'wild_color_roulette', 'reverse', 'wild_reverse_draw4'].includes(c.value)
      );
      if (chaosCard) {
        chosenCard = chaosCard;
      } else {
        chosenCard = playableCards[Math.floor(Math.random() * playableCards.length)];
      }
    } else {
      const normalCard = playableCards.find((c) => !isWildCard(c.value) && getPenaltyAmount(c.value) === 0);
      if (normalCard) {
        chosenCard = normalCard;
      } else {
        chosenCard = playableCards[0];
      }
    }

    // Auto call UNO if playing second-to-last card
    if (bot.cards.length === 2) {
      const willCallUno = personality === 'aggressive' ? Math.random() < 0.98 : personality === 'chaos' ? Math.random() < 0.85 : Math.random() < 0.75;
      if (willCallUno) {
        bot.hasCalledUno = true;
        broadcastLog(game, `📢 ${bot.name} called "UNO!"`, 'uno');
      }
    }

    // Choose color
    const chosenColor = personality === 'chaos' ? getRandomColor() : getBotDominantColor(bot);
    let targetPlayerId: string | undefined;

    // If card is 7, choose opponent based on rules and personality
    if (chosenCard.value === '7') {
      const opponents = game.players.filter((p) => p.id !== bot.id && !p.isEliminated);
      if (opponents.length > 0) {
        if (game.rules.allow7Swap) {
          // Mandatory swap mode
          if (personality === 'aggressive') {
            opponents.sort((a, b) => a.cards.length - b.cards.length);
            targetPlayerId = opponents[0].id;
          } else if (personality === 'chaos') {
            targetPlayerId = opponents[Math.floor(Math.random() * opponents.length)].id;
          } else {
            opponents.sort((a, b) => a.cards.length - b.cards.length);
            targetPlayerId = opponents[0].id;
          }
        } else {
          // Optional swap mode: bot only swaps if opponent has fewer cards or chaos bot feels like it
          opponents.sort((a, b) => a.cards.length - b.cards.length);
          if (personality === 'chaos' && Math.random() < 0.6) {
            targetPlayerId = opponents[Math.floor(Math.random() * opponents.length)].id;
          } else if (opponents[0].cards.length < bot.cards.length) {
            targetPlayerId = opponents[0].id;
          }
        }
      }
    }

    executePlayCard(game, bot, chosenCard, chosenColor, targetPlayerId);
    sendFullSync(game);
  } else {
    executePlayerDraw(game, bot);
    sendFullSync(game);
  }
}
