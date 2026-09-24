import { WebSocket } from 'ws';

export interface LiveMatchStats {
  penaltiesInflicted: Map<string, number>;
  stacksSurvived: Map<string, number>;
  handSwaps: Map<string, number>;
  peakCards: Map<string, number>;
  lastAttacker?: { id: string; name: string; avatar: string; card: string; penalty: number };
}

export interface ClientSocketInfo {
  ws: WebSocket;
  playerId: string;
  roomId: string;
  isAlive?: boolean;
}
