import { WebSocket } from 'ws';
import {
  Card,
  GameState,
  LobbyRules,
  MatchRecord,
  Player,
  UserProfile,
  GameEventLog,
  TableTaunt,
  MatchAward,
} from '../../frontend/src/types';
import { LiveMatchStats, ClientSocketInfo } from './types';

// In-Memory Storage for Lobbies, Profiles, and Match History
export const games = new Map<string, GameState>();
export const userProfiles = new Map<string, UserProfile>();
export const matchHistories = new Map<string, MatchRecord[]>();
export const roomMatchStats = new Map<string, LiveMatchStats>();
export const roomDrawPiles = new Map<string, Card[]>();
export const clientSockets = new Map<string, ClientSocketInfo>();
export const socketClients = new Map<WebSocket, { ws: WebSocket; playerId: string; roomId: string; isAlive: boolean }>();
export const roomSockets = new Map<string, Set<WebSocket>>();

export const defaultRules: LobbyRules = {
  mercyLimit: 25,
  allowStacking: true,
  allow7Swap: true,
  allow0PassAll: true,
  allowJumpIn: true,
  drawUntilPlayable: false,
  allowSkipEveryone: true,
  allowDiscardAll: true,
  allowWildDraw10And6: true,
  allowColorRoulette: true,
  turnTimerSeconds: 30,
  botFill: false,
  botAggression: 'merciless',
};

export const BOT_NAMES = ['ViperBot', 'MercilessMax', 'CardCrusher', 'NoMercyNina', 'BlitzBot'];
export const AVATARS = ['🔥', '⚡', '💀', '👑', '🃏', '🎯', '🐉', '🌪️', '🦊', '🐺'];

export function associateSocketWithRoom(ws: WebSocket, roomId: string, playerId?: string) {
  const current = socketClients.get(ws);
  if (current) {
    if (current.roomId && current.roomId !== roomId) {
      const oldSet = roomSockets.get(current.roomId);
      if (oldSet) {
        oldSet.delete(ws);
        if (oldSet.size === 0) roomSockets.delete(current.roomId);
      }
    }
    current.roomId = roomId;
    if (playerId) current.playerId = playerId;
    current.isAlive = true;
  }
  if (roomId) {
    let set = roomSockets.get(roomId);
    if (!set) {
      set = new Set<WebSocket>();
      roomSockets.set(roomId, set);
    }
    set.add(ws);
  }
}

export function disassociateSocketFromRoom(ws: WebSocket, targetRoomId?: string) {
  const current = socketClients.get(ws);
  const roomId = targetRoomId || current?.roomId;
  if (roomId) {
    const set = roomSockets.get(roomId);
    if (set) {
      set.delete(ws);
      if (set.size === 0) roomSockets.delete(roomId);
    }
  }
  if (current) {
    current.roomId = '';
  }
}

// Flexible Room Code Resolver: handles exact match, case-insensitivity, stripped dashes/spaces, and suffix matching (e.g. "4892" -> "MERCY-4892")
export function findGameByCode(rawCode: string): GameState | undefined {
  if (!rawCode) return undefined;
  const trimmed = rawCode.trim();

  // 1. Direct key match
  if (games.has(trimmed)) return games.get(trimmed);

  // 2. Uppercase match
  const upper = trimmed.toUpperCase();
  if (games.has(upper)) return games.get(upper);

  // 3. Clean alphanumeric match (strips dashes, spaces, hashes)
  const clean = upper.replace(/[^A-Z0-9]/g, '');
  if (!clean) return undefined;

  for (const [id, game] of games.entries()) {
    const cleanId = id.replace(/[^A-Z0-9]/g, '').toUpperCase();
    if (cleanId === clean) return game;
    // Suffix match: e.g. typing "4892" or "892" for "MERCY-4892"
    if (clean.length >= 3 && cleanId.endsWith(clean)) return game;
  }

  // 4. Substring / search match
  for (const [id, game] of games.entries()) {
    if (id.toUpperCase().includes(upper)) return game;
  }

  return undefined;
}

export function broadcastToRoom(roomId: string, message: unknown) {
  if (!roomId) return;
  const set = roomSockets.get(roomId);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify(message);
  set.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

export function broadcastLog(game: GameState, text: string, type: GameEventLog['type']) {
  const logEntry: GameEventLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    text,
    type,
    timestamp: Date.now(),
  };
  game.logs.push(logEntry);
  if (game.logs.length > 50) game.logs.shift();
  broadcastToRoom(game.roomId, { type: 'GAME_LOG', log: logEntry });
}

export function getSanitizedGameState(game: GameState, forPlayerId?: string): GameState {
  return {
    ...game,
    discardPile: game.discardPile.length > 5 ? game.discardPile.slice(-5) : game.discardPile,
    logs: game.logs.length > 15 ? game.logs.slice(-15) : game.logs,
    players: game.players.map((p) => ({
      ...p,
      cards:
        p.id === forPlayerId
          ? p.cards
          : p.cards.map((c) => ({
              id: c.id,
              color: 'wild',
              value: 'wild',
            })),
    })),
  };
}

export function sendFullSync(game: GameState) {
  if (!game || !game.roomId) return;
  const set = roomSockets.get(game.roomId);
  if (!set || set.size === 0) return;
  set.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      const sock = socketClients.get(ws);
      if (sock) {
        ws.send(
          JSON.stringify({
            type: 'GAME_SYNC',
            gameState: getSanitizedGameState(game, sock.playerId),
          })
        );
      }
    }
  });
}

export function triggerTableTaunt(game: GameState, player: Player, emote: string) {
  const taunt: TableTaunt = {
    id: `taunt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
    playerId: player.id,
    playerName: player.name,
    emote,
    timestamp: Date.now(),
  };

  const now = Date.now();
  if (!game.activeTaunts) game.activeTaunts = [];
  const fresh = game.activeTaunts.filter((t) => now - t.timestamp < 4500);
  game.activeTaunts = [taunt, ...fresh.slice(0, 8)];

  broadcastToRoom(game.roomId, {
    type: 'TABLE_TAUNT',
    taunt,
    activeTaunts: game.activeTaunts,
  });
}

export function computeMatchAwards(game: GameState): MatchAward[] {
  const stats = roomMatchStats.get(game.roomId);
  const awards: MatchAward[] = [];
  if (!stats) return awards;

  // 1. The Executioner
  let topInflicter: { id: string; count: number } | null = null;
  stats.penaltiesInflicted.forEach((count, id) => {
    if (!topInflicter || count > topInflicter.count) {
      topInflicter = { id, count };
    }
  });
  if (topInflicter && (topInflicter as { id: string; count: number }).count > 0) {
    const p = game.players.find((pl) => pl.id === topInflicter?.id);
    if (p) {
      awards.push({
        title: 'The Executioner',
        badge: '💀',
        playerName: p.name,
        playerAvatar: p.avatar,
        statDescription: `+${(topInflicter as { id: string; count: number }).count} Penalty Cards Dealt`,
        subtitle: 'Inflicted the most draw damage onto rivals',
      });
    }
  }

  // 2. The Ultimate Survivor
  let topSurvivor: { id: string; count: number } | null = null;
  stats.stacksSurvived.forEach((count, id) => {
    if (!topSurvivor || count > topSurvivor.count) {
      topSurvivor = { id, count };
    }
  });
  if (topSurvivor && (topSurvivor as { id: string; count: number }).count > 0) {
    const p = game.players.find((pl) => pl.id === topSurvivor?.id);
    if (p) {
      awards.push({
        title: 'The Ultimate Survivor',
        badge: '🛡️',
        playerName: p.name,
        playerAvatar: p.avatar,
        statDescription: `Survived +${(topSurvivor as { id: string; count: number }).count} Stack`,
        subtitle: 'Absorbed massive penalty without elimination',
      });
    }
  }

  // 3. Master Hand Swapper
  let topSwapper: { id: string; count: number } | null = null;
  stats.handSwaps.forEach((count, id) => {
    if (!topSwapper || count > topSwapper.count) {
      topSwapper = { id, count };
    }
  });
  if (topSwapper && (topSwapper as { id: string; count: number }).count > 0) {
    const p = game.players.find((pl) => pl.id === topSwapper?.id);
    if (p) {
      awards.push({
        title: 'Master Hand Swapper',
        badge: '🔄',
        playerName: p.name,
        playerAvatar: p.avatar,
        statDescription: `${(topSwapper as { id: string; count: number }).count} Hand Swaps`,
        subtitle: 'Turned the table upside down with 7s & 0s',
      });
    }
  }

  // 4. Hardest Hit
  let highestPeak: { id: string; count: number } | null = null;
  stats.peakCards.forEach((count, id) => {
    if (!highestPeak || count > highestPeak.count) {
      highestPeak = { id, count };
    }
  });
  if (highestPeak && (highestPeak as { id: string; count: number }).count >= 10) {
    const p = game.players.find((pl) => pl.id === highestPeak?.id);
    if (p) {
      awards.push({
        title: 'Hardest Hit',
        badge: '💥',
        playerName: p.name,
        playerAvatar: p.avatar,
        statDescription: `Peak: ${(highestPeak as { id: string; count: number }).count} Cards Held`,
        subtitle: 'Carried a massive deck and survived the danger zone',
      });
    }
  }

  // Champion Award if winner
  if (game.winnerId) {
    const winner = game.players.find((p) => p.id === game.winnerId);
    if (winner && !awards.some((a) => a.playerName === winner.name && a.title === 'The Executioner')) {
      awards.unshift({
        title: 'Merciless Champion',
        badge: '👑',
        playerName: winner.name,
        playerAvatar: winner.avatar,
        statDescription: game.winnerReason === 'mercy_eliminations' ? 'Survivor of Elimination' : 'Hand Cleared',
        subtitle: 'Conquered the Show Em No Mercy arena',
      });
    }
  }

  return awards;
}

export function recordMatchFinish(game: GameState, winner: Player) {
  game.awards = computeMatchAwards(game);
  const duration = Math.round(((game.endedAt || Date.now()) - (game.startedAt || Date.now())) / 1000);
  const rulesSummary = `Mercy: ${game.rules.mercyLimit}, Stacking: ${game.rules.allowStacking ? 'On' : 'Off'}, 7/0: ${game.rules.allow7Swap ? 'On' : 'Off'}`;

  game.players.forEach((p) => {
    if (!p.isBot) {
      const isWinner = p.id === winner.id;
      const profile = userProfiles.get(p.id) || {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        title: 'Mercy Contender',
        gamesPlayed: 0,
        wins: 0,
        mercyEliminationsDealt: 0,
        mercyEliminationsSuffered: 0,
        unoCalls: 0,
        highestCardCount: 0,
        highestStackSurvived: 0,
      };

      profile.gamesPlayed += 1;
      if (isWinner) profile.wins += 1;

      if (profile.wins >= 10) profile.title = 'Merciless Overlord';
      else if (profile.wins >= 5) profile.title = 'Deck Executioner';
      else if (profile.wins >= 1) profile.title = 'Wildcard Slayer';

      userProfiles.set(p.id, profile);

      const client = clientSockets.get(p.id);
      if (client && client.ws && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({ type: 'PROFILE_UPDATED', profile }));
      }

      const record: MatchRecord = {
        id: `match_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        roomId: game.roomId,
        roomName: game.roomName,
        date: Date.now(),
        durationSeconds: duration,
        playersCount: game.players.length,
        winnerName: winner.name,
        winnerAvatar: winner.avatar,
        winReason: game.winnerReason === 'mercy_eliminations' ? 'Mercy Elimination Survivor' : 'Emptied Entire Hand',
        userResult: isWinner ? 'won' : p.isEliminated ? 'eliminated' : 'lost',
        finalCardCount: p.cards.length,
        rulesSummary,
      };

      const history = matchHistories.get(p.id) || [];
      history.unshift(record);
      if (history.length > 50) history.pop();
      matchHistories.set(p.id, history);
    }
  });
}

export function countConnectedHumanPlayers(game: GameState): number {
  let count = 0;
  game.players.forEach((p) => {
    if (p.isBot && !p.originalName) return;
    const client = clientSockets.get(p.id);
    if (client && client.roomId === game.roomId && client.ws.readyState === WebSocket.OPEN) {
      count++;
    }
  });
  return count;
}
