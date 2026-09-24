import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { Player, GameState, ChatMessage, BotPersonality } from '@uno/shared/types';
import { isExactMatchForJumpIn, isValidPlay } from '@uno/shared/unoDeck';
import {
  games,
  userProfiles,
  roomMatchStats,
  roomDrawPiles,
  clientSockets,
  socketClients,
  roomSockets,
  defaultRules,
  BOT_NAMES,
  AVATARS,
  associateSocketWithRoom,
  disassociateSocketFromRoom,
  findGameByCode,
  broadcastToRoom,
  broadcastLog,
  getSanitizedGameState,
  sendFullSync,
  triggerTableTaunt,
  countConnectedHumanPlayers,
} from './state';
import {
  startGame,
  executePlayCard,
  executePlayerDraw,
  executeDrawPenalty,
  drawCardFromPile,
  checkMercyRule,
  advanceTurn,
} from './gameEngine';
import { checkAndTriggerBotTurn } from './botEngine';

export function setupWebSocketServer(server: http.Server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    const origin = req.headers.origin;

    if (process.env.NODE_ENV === 'production') {
      const allowedOrigin = process.env.FRONTEND_URL;

      if (origin !== allowedOrigin) {
        console.log(`Rejected WebSocket connection from origin: ${origin}`);

        ws.close(1008, 'Origin not allowed');
        return;
      }
    }

    let currentRoomId = '';
    let currentPlayerId = '';

    socketClients.set(ws, {
      ws,
      playerId: '',
      roomId: '',
      isAlive: true,
    });


    ws.on('pong', () => {
      const client = socketClients.get(ws);
      if (client) client.isAlive = true;
    });

    const handlePlayerLeave = (roomId: string, playerId: string) => {
      if (!roomId || !playerId) return;
      const game = games.get(roomId);
      if (!game) return;

      const leavingPlayer = game.players.find((p) => p.id === playerId);
      if (!leavingPlayer) return;

      const client = clientSockets.get(playerId);
      if (client) {
        client.roomId = '';
      }
      disassociateSocketFromRoom(ws, roomId);

      if (game.status === 'waiting') {
        if (game.hostId === playerId) {
          setTimeout(() => {
            const currentG = games.get(roomId);
            if (!currentG || currentG.status !== 'waiting') return;

            let hostConnected = false;
            socketClients.forEach((c) => {
              if (c.playerId === playerId && c.roomId === roomId && c.ws.readyState === WebSocket.OPEN) {
                hostConnected = true;
              }
            });

            if (hostConnected) return;

            broadcastToRoom(roomId, {
              type: 'LOBBY_CANCELLED',
              message: 'The host has cancelled and closed the lobby.',
            });
            currentG.players.forEach((p) => {
              const c = clientSockets.get(p.id);
              if (c && c.roomId === roomId) c.roomId = '';
            });
            const set = roomSockets.get(roomId);
            if (set) {
              set.forEach((s) => disassociateSocketFromRoom(s, roomId));
              roomSockets.delete(roomId);
            }
            games.delete(roomId);
          }, 3500);
          return;
        }

        game.players = game.players.filter((p) => p.id !== playerId);
        if (game.players.length === 0) {
          games.delete(roomId);
          return;
        }
        broadcastLog(game, `🚪 ${leavingPlayer.originalName || leavingPlayer.name} left the lobby.`, 'play');
        sendFullSync(game);
        return;
      } else if (game.status === 'playing') {
        const otherHumans = game.players.filter((p) => !p.isBot && !p.isAfk && p.id !== playerId);
        if (otherHumans.length === 0) {
          games.delete(roomId);
          const rSockets = roomSockets.get(roomId);
          if (rSockets) {
            rSockets.forEach((s) => disassociateSocketFromRoom(s, roomId));
            roomSockets.delete(roomId);
          }
          return;
        }

        leavingPlayer.isAfk = true;
        leavingPlayer.isBot = true;
        if (!leavingPlayer.originalName) leavingPlayer.originalName = leavingPlayer.name;
        leavingPlayer.name = `${leavingPlayer.originalName} (Bot)`;

        broadcastLog(
          game,
          `🤖 ${leavingPlayer.originalName || leavingPlayer.name} disconnected. Bot autopilot took over.`,
          'system'
        );

        if (game.players[game.currentTurnIndex]?.id === playerId) {
          checkAndTriggerBotTurn(game);
        }
      }
      sendFullSync(game);
    };

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'PING') {
          ws.send(
            JSON.stringify({
              type: 'PONG',
              clientTimestamp: data.timestamp,
              serverTimestamp: Date.now(),
            })
          );
          return;
        }

        if (data.userId && !currentPlayerId) {
          currentPlayerId = data.userId;
        }

        const isLeavingMsg = data.type === 'LEAVE_ROOM' || data.type === 'ABANDON_MATCH' || data.type === 'CANCEL_LOBBY';
        if (!isLeavingMsg && data.roomId && !currentRoomId) {
          currentRoomId = data.roomId;
        }

        if (currentPlayerId && !isLeavingMsg) {
          const roomToAssociate = currentRoomId || data.roomId || '';
          clientSockets.set(currentPlayerId, { ws, playerId: currentPlayerId, roomId: roomToAssociate });
          associateSocketWithRoom(ws, roomToAssociate, currentPlayerId);
        }

        switch (data.type) {
          case 'PING': {
            ws.send(
              JSON.stringify({
                type: 'PONG',
                clientTimestamp: data.timestamp,
                serverTimestamp: Date.now(),
              })
            );
            break;
          }

          case 'RECONNECT_SESSION': {
            const reqUserId = data.userId || currentPlayerId;
            const reqRoomId = data.roomId;
            if (!reqUserId || !reqRoomId) break;

            currentPlayerId = reqUserId;
            const game = findGameByCode(reqRoomId);

            if (game) {
              currentRoomId = game.roomId;
              clientSockets.set(reqUserId, { ws, playerId: reqUserId, roomId: game.roomId });
              associateSocketWithRoom(ws, game.roomId, reqUserId);

              const player = game.players.find((p) => p.id === reqUserId);
              if (player) {
                player.isAfk = false;
                player.isBot = false;
                player.missedTurns = 0;
                if (player.originalName) player.name = player.originalName;
                if (data.playerName && !player.originalName) player.name = data.playerName;

                if (game.status === 'paused') {
                  game.status = 'playing';
                  game.pauseReason = undefined;
                  broadcastLog(game, `▶️ Match resumed! ${player.name} reconnected!`, 'play');
                  checkAndTriggerBotTurn(game);
                } else {
                  broadcastLog(game, `🔌 ${player.name} reconnected to the table!`, 'play');
                }
              }
              ws.send(
                JSON.stringify({
                  type: 'GAME_SYNC',
                  gameState: getSanitizedGameState(game, reqUserId),
                })
              );
              sendFullSync(game);
            }
            break;
          }

          case 'CREATE_LOBBY': {
            let { roomId, roomName, playerName, avatar, rules, isPrivate, userId } = data;
            currentPlayerId = userId || `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

            if (!roomId || games.has(roomId)) {
              roomId = `MERCY-${Math.floor(1000 + Math.random() * 9000)}`;
              while (games.has(roomId)) {
                roomId = `MERCY-${Math.floor(1000 + Math.random() * 9000)}`;
              }
            }
            currentRoomId = roomId;

            const hostPlayer: Player = {
              id: currentPlayerId,
              name: playerName || 'Host',
              avatar: avatar || '🔥',
              isHost: true,
              isBot: false,
              isReady: true,
              cards: [],
              hasCalledUno: false,
              isEliminated: false,
            };

            const newGame: GameState = {
              roomId,
              roomName: roomName || `${playerName}'s Mercy Arena`,
              isPrivate: !!isPrivate,
              status: 'waiting',
              rules: { ...defaultRules, ...rules },
              players: [hostPlayer],
              hostId: currentPlayerId,
              currentTurnIndex: 0,
              direction: 1,
              drawPileCount: 100,
              discardPile: [],
              activePenalty: 0,
              currentColor: 'red',
              turnTimeRemaining: rules?.turnTimerSeconds || 30,
              logs: [],
            };

            games.set(roomId, newGame);
            clientSockets.set(currentPlayerId, { ws, playerId: currentPlayerId, roomId });
            associateSocketWithRoom(ws, roomId, currentPlayerId);

            ws.send(
              JSON.stringify({
                type: 'LOBBY_JOINED',
                playerId: currentPlayerId,
                gameState: getSanitizedGameState(newGame, currentPlayerId),
              })
            );
            break;
          }

          case 'JOIN_LOBBY': {
            const { roomId, playerName, avatar, userId } = data;
            const game = findGameByCode(roomId);
            if (!game) {
              ws.send(
                JSON.stringify({
                  type: 'ERROR',
                  message: `Room "${roomId}" was not found. Please verify the 4-digit code or room ID.`,
                })
              );
              return;
            }

            currentPlayerId = userId || `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            currentRoomId = game.roomId;

            const existingPlayer = game.players.find((p) => p.id === currentPlayerId);
            if (existingPlayer) {
              existingPlayer.isAfk = false;
              existingPlayer.isBot = false;
              if (playerName && !existingPlayer.originalName) existingPlayer.name = playerName;
              if (avatar) existingPlayer.avatar = avatar;

              clientSockets.set(currentPlayerId, { ws, playerId: currentPlayerId, roomId: game.roomId });
              associateSocketWithRoom(ws, game.roomId, currentPlayerId);

              if (game.status === 'paused') {
                game.status = 'playing';
                game.pauseReason = undefined;
                broadcastLog(game, `▶️ Match resumed! ${existingPlayer.name} rejoined!`, 'play');
                checkAndTriggerBotTurn(game);
              } else {
                broadcastLog(game, `🔌 ${existingPlayer.name} rejoined the room!`, 'play');
              }

              ws.send(
                JSON.stringify({
                  type: 'LOBBY_JOINED',
                  playerId: currentPlayerId,
                  gameState: getSanitizedGameState(game, currentPlayerId),
                })
              );
              sendFullSync(game);
              break;
            }

            if (game.status !== 'waiting') {
              ws.send(
                JSON.stringify({
                  type: 'ERROR',
                  message: `Match "${game.roomName}" is already in progress and the lobby is closed.`,
                })
              );
              return;
            }

            if (game.players.length >= 8) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Lobby is full (maximum 8 players).' }));
              return;
            }

            const newPlayer: Player = {
              id: currentPlayerId,
              name: playerName || `Player ${game.players.length + 1}`,
              avatar: avatar || AVATARS[game.players.length % AVATARS.length],
              isHost: false,
              isBot: false,
              isReady: false,
              cards: [],
              hasCalledUno: false,
              isEliminated: false,
            };

            game.players.push(newPlayer);
            clientSockets.set(currentPlayerId, { ws, playerId: currentPlayerId, roomId: game.roomId });
            associateSocketWithRoom(ws, game.roomId, currentPlayerId);

            broadcastLog(game, `👋 ${newPlayer.name} joined the lobby!`, 'play');
            ws.send(
              JSON.stringify({
                type: 'LOBBY_JOINED',
                playerId: currentPlayerId,
                gameState: getSanitizedGameState(game, currentPlayerId),
              })
            );
            sendFullSync(game);
            break;
          }

          case 'UPDATE_RULES': {
            const game = games.get(currentRoomId);
            if (!game || game.hostId !== currentPlayerId) return;
            game.rules = { ...game.rules, ...data.rules };
            sendFullSync(game);
            break;
          }

          case 'ADD_BOT': {
            const game = games.get(currentRoomId);
            if (!game || game.hostId !== currentPlayerId || game.players.length >= 8) return;
            const botIdx = game.players.filter((p) => p.isBot).length;
            const personality: BotPersonality =
              data.personality || (['aggressive', 'chaos', 'casual'][botIdx % 3] as BotPersonality);
            const avatarMap: Record<BotPersonality, string> = {
              aggressive: '⚡',
              chaos: '🌪️',
              casual: '🤖',
            };
            const labelMap: Record<BotPersonality, string> = {
              aggressive: 'Aggressive',
              chaos: 'Chaos',
              casual: 'Casual',
            };
            const botPlayer: Player = {
              id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
              name: `${BOT_NAMES[botIdx % BOT_NAMES.length]} [${labelMap[personality]}]`,
              avatar: avatarMap[personality] || '🤖',
              isHost: false,
              isBot: true,
              botPersonality: personality,
              isReady: true,
              cards: [],
              hasCalledUno: false,
              isEliminated: false,
            };
            game.players.push(botPlayer);
            broadcastLog(game, `🤖 Added AI Bot ${botPlayer.name} [${personality.toUpperCase()} AI]`, 'play');
            sendFullSync(game);
            break;
          }

          case 'REMOVE_PLAYER': {
            const game = games.get(currentRoomId);
            if (!game || game.hostId !== currentPlayerId) return;
            const targetId = data.targetPlayerId;
            const target = game.players.find((p) => p.id === targetId);
            if (target && !target.isHost) {
              game.players = game.players.filter((p) => p.id !== targetId);
              broadcastLog(game, `🚪 ${target.name} was removed from the lobby.`, 'play');
              sendFullSync(game);
            }
            break;
          }

          case 'TOGGLE_READY': {
            const game = games.get(currentRoomId);
            if (!game) return;
            const player = game.players.find((p) => p.id === currentPlayerId);
            if (player) {
              player.isReady = !player.isReady;
              sendFullSync(game);
            }
            break;
          }

          case 'START_GAME': {
            const game = games.get(currentRoomId);
            if (!game || game.hostId !== currentPlayerId) return;
            if (game.players.length < 2) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Need at least 2 players to start.' }));
              return;
            }
            startGame(game);
            break;
          }

          case 'PLAY_CARD': {
            const targetRoomId = data.roomId || currentRoomId;
            const targetUserId = data.userId || currentPlayerId;
            const game = games.get(targetRoomId);
            if (!game) return;

            if (game.status === 'paused') {
              game.status = 'playing';
              game.pauseReason = undefined;
            }
            if (game.status !== 'playing') return;

            const player = game.players.find((p) => p.id === targetUserId);
            if (!player || player.isEliminated) return;

            currentPlayerId = targetUserId;
            currentRoomId = targetRoomId;
            clientSockets.set(currentPlayerId, { ws, playerId: currentPlayerId, roomId: currentRoomId });

            if (player.isAfk || player.isBot) {
              player.isAfk = false;
              player.isBot = false;
              player.missedTurns = 0;
              if (player.originalName) player.name = player.originalName;
              broadcastLog(game, `🎮 ${player.name} resumed manual play!`, 'play');
            }

            const isCurrentTurn = game.players[game.currentTurnIndex]?.id === player.id;
            const { card, chosenColor, targetPlayerId } = data;
            const topCard = game.discardPile[game.discardPile.length - 1];

            if (!isCurrentTurn) {
              if (game.rules.allowJumpIn && isExactMatchForJumpIn(card, topCard) && game.activePenalty === 0) {
                broadcastLog(game, `⚡ Jump-in! ${player.name}: ${card.color} ${card.value}`, 'play');
                game.currentTurnIndex = game.players.findIndex((p) => p.id === player.id);
                executePlayCard(game, player, card, chosenColor, targetPlayerId);
                sendFullSync(game);
                return;
              } else {
                ws.send(JSON.stringify({ type: 'ERROR', message: "It's not your turn!" }));
                return;
              }
            }

            if (!isValidPlay(card, topCard, game.currentColor, game.activePenalty, game.lastPenaltyCard, game.rules.allowStacking)) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid card play.' }));
              return;
            }

            executePlayCard(game, player, card, chosenColor, targetPlayerId);
            sendFullSync(game);
            break;
          }

          case 'DRAW_CARD': {
            const targetRoomId = data.roomId || currentRoomId;
            const targetUserId = data.userId || currentPlayerId;
            const game = games.get(targetRoomId);
            if (!game) return;

            if (game.status === 'paused') {
              game.status = 'playing';
              game.pauseReason = undefined;
            }
            if (game.status !== 'playing') return;

            const player = game.players[game.currentTurnIndex];
            if (!player || player.id !== targetUserId || player.isEliminated) return;

            currentPlayerId = targetUserId;
            currentRoomId = targetRoomId;
            clientSockets.set(currentPlayerId, { ws, playerId: currentPlayerId, roomId: currentRoomId });

            if (player.isAfk || player.isBot) {
              player.isAfk = false;
              player.isBot = false;
              player.missedTurns = 0;
              if (player.originalName) player.name = player.originalName;
              broadcastLog(game, `🎮 ${player.name} resumed manual play!`, 'play');
            }

            if (game.activePenalty > 0) {
              executeDrawPenalty(game, player);
            } else {
              executePlayerDraw(game, player);
            }
            sendFullSync(game);
            break;
          }

          case 'CALL_UNO': {
            const game = games.get(currentRoomId);
            if (!game || game.status !== 'playing') return;
            const player = game.players.find((p) => p.id === currentPlayerId);
            if (player && player.cards.length <= 2) {
              if (player.isAfk || player.isBot) {
                player.isAfk = false;
                player.isBot = false;
                player.missedTurns = 0;
                if (player.originalName) player.name = player.originalName;
              }
              player.hasCalledUno = true;
              const profile = userProfiles.get(player.id);
              if (profile) {
                profile.unoCalls = (profile.unoCalls || 0) + 1;
              }
              broadcastLog(game, `📢 ${player.name} called UNO!`, 'uno');
              sendFullSync(game);
            }
            break;
          }

          case 'CATCH_UNO': {
            const game = games.get(currentRoomId);
            if (!game || game.status !== 'playing') return;
            const caller = game.players.find((p) => p.id === currentPlayerId);
            const target = game.players.find((p) => p.id === data.targetPlayerId);
            if (!caller || !target || caller.isEliminated || target.isEliminated || target.id === caller.id) return;

            if (target.cards.length === 1 && !target.hasCalledUno) {
              const penaltyCards = 2;
              for (let i = 0; i < penaltyCards; i++) {
                const card = drawCardFromPile(game);
                if (card) target.cards.push(card);
              }
              target.hasCalledUno = false;

              const stats = roomMatchStats.get(game.roomId);
              if (stats) {
                stats.peakCards.set(target.id, Math.max(stats.peakCards.get(target.id) || 0, target.cards.length));
              }

              broadcastLog(
                game,
                `🚨 ${caller.name} caught ${target.name}! (+2 cards)`,
                'uno'
              );

              checkMercyRule(game);
              sendFullSync(game);
            }
            break;
          }

          case 'CHAT_MESSAGE': {
            const game = games.get(currentRoomId);
            if (!game) return;
            const player = game.players.find((p) => p.id === currentPlayerId);
            const chatMsg: ChatMessage = {
              id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
              senderId: currentPlayerId,
              senderName: player?.name || 'Spectator',
              senderAvatar: player?.avatar || '💬',
              text: data.text,
              timestamp: Date.now(),
            };
            broadcastToRoom(currentRoomId, { type: 'CHAT_MESSAGE', message: chatMsg });
            break;
          }

          case 'SEND_TAUNT': {
            const targetRoomId = data.roomId || currentRoomId;
            const targetUserId = data.userId || currentPlayerId;
            const game = games.get(targetRoomId);
            if (!game) return;
            const player = game.players.find((p) => p.id === targetUserId);
            if (!player) return;

            triggerTableTaunt(game, player, data.emote);
            break;
          }

          case 'LEAVE_ROOM': {
            handlePlayerLeave(currentRoomId, currentPlayerId);
            disassociateSocketFromRoom(ws);
            const client = clientSockets.get(currentPlayerId);
            if (client) {
              client.roomId = '';
            }
            currentRoomId = '';
            ws.send(JSON.stringify({ type: 'LEFT_ROOM_CONFIRMED' }));
            break;
          }

          case 'REJOIN_MATCH':
          case 'REJOIN_ROOM': {
            const targetRoomId = data.roomId || currentRoomId;
            const game = games.get(targetRoomId);
            if (!game) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Match has concluded or room no longer exists.' }));
              return;
            }
            const targetUserId = data.userId || currentPlayerId;
            const player = game.players.find((p) => p.id === targetUserId);
            if (!player) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'You were not a player in this match.' }));
              return;
            }

            currentPlayerId = player.id;
            currentRoomId = targetRoomId;
            clientSockets.set(currentPlayerId, { ws, playerId: currentPlayerId, roomId: targetRoomId });
            associateSocketWithRoom(ws, targetRoomId, currentPlayerId);

            player.isBot = false;
            player.isAfk = false;
            player.missedTurns = 0;
            if (player.originalName) {
              player.name = player.originalName;
            }

            if (game.status === 'paused') {
              game.status = 'playing';
              game.pauseReason = undefined;
              game.turnTimeRemaining = game.rules.turnTimerSeconds || 30;
              broadcastLog(game, `▶️ Match resumed! ${player.name} rejoined the arena!`, 'play');
              checkAndTriggerBotTurn(game);
            } else {
              broadcastLog(game, `🎮 ${player.name} rejoined and reclaimed their hand!`, 'play');
            }

            ws.send(
              JSON.stringify({
                type: 'REJOIN_SUCCESS',
                playerId: currentPlayerId,
                gameState: getSanitizedGameState(game, currentPlayerId),
              })
            );
            sendFullSync(game);
            break;
          }

          case 'RESUME_CONTROL': {
            const game = games.get(currentRoomId);
            if (!game) return;
            const player = game.players.find((p) => p.id === currentPlayerId);
            if (player && !player.isEliminated) {
              player.isBot = false;
              player.isAfk = false;
              player.missedTurns = 0;
              if (player.originalName) {
                player.name = player.originalName;
              }
              broadcastLog(game, `🎮 ${player.name} took back control from bot autopilot!`, 'play');
              sendFullSync(game);
            }
            break;
          }

          case 'CANCEL_LOBBY': {
            const targetRoomId = data.roomId || currentRoomId;
            const game = games.get(targetRoomId);
            if (!game) return;

            const requestingId = data.userId || currentPlayerId;
            if (game.hostId === requestingId) {
              broadcastToRoom(targetRoomId, {
                type: 'LOBBY_CANCELLED',
                message: 'The host has cancelled and closed the lobby.',
              });
              game.players.forEach((p) => {
                const c = clientSockets.get(p.id);
                if (c && c.roomId === targetRoomId) {
                  c.roomId = '';
                }
              });
              const set = roomSockets.get(targetRoomId);
              if (set) {
                set.forEach((s) => disassociateSocketFromRoom(s, targetRoomId));
                roomSockets.delete(targetRoomId);
              }
              games.delete(targetRoomId);
              currentRoomId = '';
            }
            break;
          }

          case 'RETURN_TO_LOBBY': {
            const targetRoomId = data.roomId || currentRoomId;
            const game = games.get(targetRoomId);
            if (!game) return;

            game.status = 'waiting';
            game.endedAt = undefined;
            game.winnerId = undefined;
            game.winnerReason = undefined;
            game.activePenalty = 0;
            game.lastPenaltyCard = undefined;
            game.discardPile = [];
            game.drawPileCount = 100;
            roomDrawPiles.delete(game.roomId);
            game.turnTimeRemaining = game.rules.turnTimerSeconds || 30;

            game.players.forEach((p) => {
              p.cards = [];
              p.isEliminated = false;
              p.eliminationReason = undefined;
              p.hasCalledUno = false;
              p.missedTurns = 0;
              p.isAfk = false;
              if (p.originalName) {
                p.name = p.originalName;
                p.originalName = undefined;
                p.isBot = false;
              }
              p.isReady = p.isHost || p.isBot;
            });

            broadcastLog(
              game,
              '🏠 Returned to the lobby! Adjust rules or click Ready for the next round!',
              'play'
            );
            sendFullSync(game);
            break;
          }

          case 'ABANDON_MATCH': {
            const targetRoomId = data.roomId || currentRoomId;
            const targetUserId = data.userId || currentPlayerId;
            const game = games.get(targetRoomId);

            const client = clientSockets.get(targetUserId);
            if (client) {
              client.roomId = '';
            }
            disassociateSocketFromRoom(ws, targetRoomId);
            if (currentRoomId === targetRoomId) {
              currentRoomId = '';
            }

            ws.send(JSON.stringify({ type: 'MATCH_ABANDONED', roomId: targetRoomId }));

            if (game) {
              const player = game.players.find((p) => p.id === targetUserId);
              if (player) {
                player.isEliminated = true;
                player.eliminationReason = 'Forfeited / Abandoned Match';
                broadcastLog(game, `🏳️ ${player.originalName || player.name} abandoned the match.`, 'mercy');
              }

              const remainingHumans = game.players.filter(
                (p) => !p.isBot && p.id !== targetUserId && !p.isEliminated
              );

              if (remainingHumans.length === 0 || game.hostId === targetUserId) {
                broadcastToRoom(targetRoomId, {
                  type: 'LOBBY_CANCELLED',
                  message: 'The match was abandoned and closed.',
                });
                game.players.forEach((p) => {
                  const c = clientSockets.get(p.id);
                  if (c && c.roomId === targetRoomId) {
                    c.roomId = '';
                  }
                });
                const set = roomSockets.get(targetRoomId);
                if (set) {
                  set.forEach((s) => disassociateSocketFromRoom(s, targetRoomId));
                  roomSockets.delete(targetRoomId);
                }
                games.delete(targetRoomId);
              } else {
                checkMercyRule(game);
                sendFullSync(game);
              }
            }
            break;
          }

          case 'RESTART_GAME': {
            const targetRoomId = data.roomId || currentRoomId;
            const game = games.get(targetRoomId);
            if (!game) return;
            game.players.forEach((p) => {
              if (p.originalName) {
                p.name = p.originalName;
                p.originalName = undefined;
                p.isBot = false;
              }
            });
            startGame(game);
            sendFullSync(game);
            break;
          }
        }
      } catch (err) {
        console.error('WS Error:', err);
      }
    });

    ws.on('close', () => {
      disassociateSocketFromRoom(ws);
      socketClients.delete(ws);
      if (currentPlayerId) {
        const client = clientSockets.get(currentPlayerId);
        if (client && client.ws === ws) {
          clientSockets.delete(currentPlayerId);
        }
      }
      if (currentRoomId && currentPlayerId) {
        handlePlayerLeave(currentRoomId, currentPlayerId);
      }
    });
  });

  // Keep-alive heartbeat: ping connections every 25 seconds
  setInterval(() => {
    socketClients.forEach((client, ws) => {
      if (ws.readyState !== WebSocket.OPEN) {
        socketClients.delete(ws);
        return;
      }
      if (!client.isAlive) {
        ws.terminate();
        socketClients.delete(ws);
        return;
      }
      client.isAlive = false;
      ws.ping();
    });
  }, 25000);

  // Inactive room cleanup: clear abandoned/finished rooms with 0 players older than 30 minutes
  setInterval(() => {
    games.forEach((game, rId) => {
      const activeConnections = Array.from(socketClients.values()).filter(
        (c) => c.roomId === rId && c.ws.readyState === WebSocket.OPEN
      );
      if (activeConnections.length === 0) {
        if (game.status === 'ended' || game.status === 'paused') {
          games.delete(rId);
          roomDrawPiles.delete(rId);
          roomMatchStats.delete(rId);
        } else if (game.status === 'waiting') {
          games.delete(rId);
          roomDrawPiles.delete(rId);
          roomMatchStats.delete(rId);
        }
      }
    });
  }, 60000);

  // Turn timer ticker (runs every second)
  setInterval(() => {
    games.forEach((game) => {
      if (game.activeTaunts && game.activeTaunts.length > 0) {
        const now = Date.now();
        const fresh = game.activeTaunts.filter((t) => now - t.timestamp < 4500);
        if (fresh.length !== game.activeTaunts.length) {
          game.activeTaunts = fresh;
        }
      }

      if (game.status === 'playing') {
        if (countConnectedHumanPlayers(game) === 0) {
          game.status = 'paused';
          game.pauseReason = 'Match paused: All real players have left. Bots will not fight alone.';
          broadcastLog(game, '⏸️ Match paused: All human players have left. Bots will not fight alone.', 'play');
          sendFullSync(game);
          return;
        }

        if (game.rules.turnTimerSeconds > 0) {
          game.turnTimeRemaining -= 1;

          broadcastToRoom(game.roomId, {
            type: 'TIMER_TICK',
            turnTimeRemaining: Math.max(0, game.turnTimeRemaining),
            currentTurnIndex: game.currentTurnIndex,
          });

          if (game.turnTimeRemaining <= 0) {
            const player = game.players[game.currentTurnIndex];
            if (player && !player.isEliminated) {
              if (!player.isBot) {
                player.missedTurns = (player.missedTurns || 0) + 1;
                if (player.missedTurns >= 2) {
                  player.isAfk = true;
                  player.isBot = true;
                  if (!player.originalName) player.originalName = player.name;
                  player.name = `${player.originalName} (Bot)`;
                  broadcastLog(
                    game,
                    `🤖 ${player.originalName} missed 2 consecutive turns! Bot autopilot has taken over.`,
                    'play'
                  );
                } else {
                  broadcastLog(
                    game,
                    `⏰ Turn timeout for ${player.name} (Missed turn 1/2)! Auto-drawing...`,
                    'draw'
                  );
                }
              } else {
                broadcastLog(game, `⏰ Turn timeout for ${player.name}! Auto-drawing...`, 'draw');
              }

              if (game.activePenalty > 0) {
                executeDrawPenalty(game, player);
              } else {
                executePlayerDraw(game, player);
              }
              sendFullSync(game);
            } else {
              advanceTurn(game, 1);
              sendFullSync(game);
            }
          }
        }
      }
    });
  }, 1000);

  return wss;
}
