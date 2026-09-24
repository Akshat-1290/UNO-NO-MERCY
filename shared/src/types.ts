/**
 * Types for UNO Show 'Em No Mercy
 * Based on Mattel Instruction Sheet HVW18-Eng
 */

export type CardColor = 'red' | 'yellow' | 'green' | 'blue' | 'wild';

export type CardValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'draw2'
  | 'draw4'
  | 'reverse'
  | 'skip'
  | 'skip_everyone'
  | 'discard_all'
  | 'wild'
  | 'wild_reverse_draw4'
  | 'wild_draw6'
  | 'wild_draw10'
  | 'wild_color_roulette';

export interface Card {
  id: string;
  color: CardColor;
  value: CardValue;
  chosenColor?: CardColor; // Selected color when a wild is played
}

export interface LobbyRules {
  mercyLimit: number; // Default 25. 0 to disable
  allowStacking: boolean; // Equal or higher draw card stacking
  allow7Swap: boolean; // 7s swap hands with player of choice
  allow0PassAll: boolean; // 0s pass all hands in direction of play
  allowJumpIn: boolean; // Play exact matching card anytime
  drawUntilPlayable: boolean; // Draw until a playable card is found vs draw 1
  allowSkipEveryone: boolean; // Include skip everyone action
  allowDiscardAll: boolean; // Include discard all cards of that color
  allowWildDraw10And6: boolean; // Include +6 and +10 wild cards
  allowColorRoulette: boolean; // Include roulette card
  turnTimerSeconds: number; // 0 for infinite, or 15, 30, 45, 60
  botFill: boolean; // Auto fill empty slots with bots
  botAggression: 'merciless' | 'balanced' | 'chill';
}

export type BotPersonality = 'aggressive' | 'chaos' | 'casual';

export interface TableTaunt {
  id: string;
  playerId: string;
  playerName: string;
  emote: string;
  timestamp: number;
}

export interface EliminationHighlight {
  id: string;
  victimId: string;
  victimName: string;
  victimAvatar: string;
  killerId?: string;
  killerName?: string;
  killerAvatar?: string;
  cardCount: number;
  fatalReason?: string;
  timestamp: number;
}

export interface MatchAward {
  title: string;
  badge: string;
  playerName: string;
  playerAvatar: string;
  statDescription: string;
  subtitle: string;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isBot: boolean;
  botPersonality?: BotPersonality;
  isAfk?: boolean;
  missedTurns?: number;
  originalName?: string;
  isReady: boolean;
  cards: Card[];
  hasCalledUno: boolean;
  isEliminated: boolean;
  eliminationReason?: string;
  eliminatedAt?: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  isAction?: boolean;
}

export interface GameEventLog {
  id: string;
  text: string;
  type: 'play' | 'stack' | 'mercy' | 'swap' | 'draw' | 'uno' | 'win' | 'skip' | 'system';
  timestamp: number;
}

export interface GameState {
  roomId: string;
  roomName: string;
  isPrivate: boolean;
  status: 'waiting' | 'playing' | 'ended' | 'paused';
  pauseReason?: string;
  rules: LobbyRules;
  players: Player[];
  hostId: string;
  currentTurnIndex: number;
  direction: 1 | -1; // 1 = clockwise, -1 = counter-clockwise
  drawPileCount: number;
  discardPile: Card[];
  activePenalty: number; // Accumulated draw cards count (+2, +4, +6, +10...)
  lastPenaltyCard?: Card;
  currentColor: CardColor; // Current active color (important after wild)
  winnerId?: string;
  winnerReason?: 'cleared_hand' | 'mercy_eliminations';
  turnTimeRemaining: number;
  logs: GameEventLog[];
  startedAt?: number;
  endedAt?: number;
  lastElimination?: EliminationHighlight;
  awards?: MatchAward[];
  activeTaunts?: TableTaunt[];
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  title: string;
  gamesPlayed: number;
  wins: number;
  mercyEliminationsDealt: number;
  mercyEliminationsSuffered: number;
  unoCalls: number;
  highestCardCount: number;
  highestStackSurvived: number;
}

export interface MatchRecord {
  id: string;
  roomId: string;
  roomName: string;
  date: number;
  durationSeconds: number;
  playersCount: number;
  winnerName: string;
  winnerAvatar: string;
  winReason: string;
  userResult: 'won' | 'lost' | 'eliminated';
  finalCardCount: number;
  rulesSummary: string;
}
