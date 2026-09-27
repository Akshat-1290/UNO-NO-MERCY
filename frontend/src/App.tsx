import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import {
  GameState,
  LobbyRules,
  UserProfile,
  Card,
  CardColor,
  ChatMessage,
  BotPersonality,
  TableTaunt,
} from '@uno/shared/types';
import { LobbyList, LobbySummary } from './components/LobbyList';
import { MinimalPerfMonitor } from './components/MinimalPerfMonitor';
import { ErrorBoundary } from './components/ErrorBoundary';
import { perfEngine, IS_PERF_TRACKER_ENABLED } from './utils/perfTracker';
import { timerSync } from './utils/timerSync';
import { WS_BASE_URL, API_BASE_URL } from './config/api';


const LobbyRoom = lazy(() =>
  import('./components/LobbyRoom').then((m) => ({ default: m.LobbyRoom }))
);
const GameBoard = lazy(() =>
  import('./components/GameBoard').then((m) => ({ default: m.GameBoard }))
);
const RulebookModal = lazy(() =>
  import('./components/RulebookModal').then((m) => ({ default: m.RulebookModal }))
);
const ProfileModal = lazy(() =>
  import('./components/ProfileModal').then((m) => ({ default: m.ProfileModal }))
);
const HandbookModal = lazy(() =>
  import('./components/HandbookModal').then((m) => ({ default: m.HandbookModal }))
);
import {
  Flame,
  BookOpen,
  User,
  Bot,
  LogOut,
  Sparkles,
  Wifi,
  WifiOff,
  AlertTriangle,
} from 'lucide-react';

const DEFAULT_PROFILE: UserProfile = {
  id: `user_${Math.random().toString(36).substring(2, 9)}`,
  name: 'MercyWarrior',
  avatar: '🔥',
  title: 'Mercy Contender',
  gamesPlayed: 0,
  wins: 0,
  mercyEliminationsDealt: 0,
  mercyEliminationsSuffered: 0,
  unoCalls: 0,
  highestCardCount: 0,
  highestStackSurvived: 0,
};

export default function App() {
  // Tab-specific Player ID: allows opening multiple tabs/windows to play together or test rooms cleanly
  const [tabPlayerId] = useState<string>(() => {
    let id = sessionStorage.getItem('uno_tab_player_id');
    if (!id) {
      id = `user_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      sessionStorage.setItem('uno_tab_player_id', id);
    }
    return id;
  });

  // User Profile: preserves custom name, avatar, title and stats across sessions
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('uno_no_mercy_user');
    let userPref = DEFAULT_PROFILE;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          userPref = {
            ...DEFAULT_PROFILE,
            ...parsed,
            name: parsed.name && parsed.name !== 'Player' ? parsed.name : DEFAULT_PROFILE.name,
          };
        }
      } catch {
        userPref = DEFAULT_PROFILE;
      }
    }
    return {
      ...userPref,
      id: tabPlayerId,
    };
  });

  // Active Game State
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [activeMatch, setActiveMatch] = useState<{
    active: boolean;
    roomId?: string;
    roomName?: string;
    status?: string;
    playerCount?: number;
    pauseReason?: string;
  } | null>(null);
  const [publicLobbies, setPublicLobbies] = useState<LobbySummary[] | null>(null);

  // Modals
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isRefereeOpen, setIsRefereeOpen] = useState(false);

  // WebSocket Ref
  const wsRef = useRef<WebSocket | null>(null);
  const gameStateRef = useRef<GameState | null>(gameState);
  const isLeavingRef = useRef<boolean>(false);
  const profileRef = useRef<UserProfile>(profile);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    gameStateRef.current = gameState;
    if (gameState?.roomId) {
      isLeavingRef.current = false;
      localStorage.setItem('uno_current_room', gameState.roomId);
    } else if (!gameState) {
      localStorage.removeItem('uno_current_room');
    }
  }, [gameState]);

  const showToast = useCallback((text: string) => {
    setErrorToast(text);
    setTimeout(() => setErrorToast(null), 4000);
  }, []);

  const sendWs = useCallback((msg: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = typeof msg === 'object' && msg !== null
        ? {
            ...(msg as Record<string, unknown>),
            userId: (msg as Record<string, unknown>).userId || profileRef.current.id,
            roomId: (msg as Record<string, unknown>).roomId || gameStateRef.current?.roomId,
          }
        : msg;
      wsRef.current.send(JSON.stringify(payload));
    } else {
      showToast('Connection re-establishing, please try again.');
    }
  }, [showToast]);

  // Sync profile changes to localStorage & backend
  const updateProfile = useCallback((updated: Partial<UserProfile>) => {
    setProfile((prev) => {
      const newProfile = { ...prev, ...updated };
      localStorage.setItem('uno_no_mercy_user', JSON.stringify(newProfile));
      profileRef.current = newProfile;

      fetch(`${API_BASE_URL}/api/profile/${newProfile.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProfile),
      }).catch(() => {});

      sendWs({
        type: 'SYNC_PROFILE',
        profile: newProfile,
      });

      return newProfile;
    });

    // Update in-place in active game state if player is currently in a room
    setGameState((prev) => {
      if (!prev) return prev;
      const updatedPlayers = prev.players.map((p) =>
        p.id === profileRef.current.id
          ? { ...p, name: updated.name || p.name, avatar: updated.avatar || p.avatar }
          : p
      );
      return {
        ...prev,
        players: updatedPlayers,
      };
    });
  }, [sendWs]);

  const checkActiveMatch = useCallback(() => {
    const pId = profileRef.current.id;
    fetch(`/api/active-match/${pId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.active) {
          setActiveMatch(data);
        } else {
          setActiveMatch(null);
        }
      })
      .catch(() => {});
  }, []);

  const syncProfile = useCallback(() => {
    const curP = profileRef.current;
    fetch(`${API_BASE_URL}/api/profile/${curP.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.notFound) {
          // Server restarted or no in-memory record, push current local profile to server
          fetch(`${API_BASE_URL}/api/profile/${curP.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(curP),
          }).catch(() => {});
        } else if (data && data.id) {
          setProfile((prev) => {
            const safeName = prev.name && prev.name !== 'Player' ? prev.name : data.name || prev.name;
            const safeAvatar = prev.avatar || data.avatar || '🔥';
            const safeTitle = prev.title || data.title || 'Mercy Contender';

            if (
              prev.gamesPlayed === data.gamesPlayed &&
              prev.wins === data.wins &&
              prev.mercyEliminationsDealt === data.mercyEliminationsDealt &&
              prev.mercyEliminationsSuffered === data.mercyEliminationsSuffered &&
              prev.unoCalls === data.unoCalls &&
              prev.highestCardCount === data.highestCardCount &&
              prev.highestStackSurvived === data.highestStackSurvived &&
              prev.name === safeName &&
              prev.avatar === safeAvatar
            ) {
              return prev;
            }

            const merged: UserProfile = {
              ...prev,
              ...data,
              name: safeName,
              avatar: safeAvatar,
              title: safeTitle,
            };
            localStorage.setItem('uno_no_mercy_user', JSON.stringify(merged));
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    syncProfile();
  }, [syncProfile]);

  useEffect(() => {
    if (!gameState) {
      checkActiveMatch();

      const handleVisibility = () => {
        if (document.visibilityState === 'visible' && !gameStateRef.current) {
          checkActiveMatch();
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      return () => document.removeEventListener('visibilitychange', handleVisibility);
    }
  }, [gameState, checkActiveMatch]);

  // Gentle fallback check ONLY when an active match banner is currently displayed
  useEffect(() => {
    if (!gameState && activeMatch?.active) {
      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          checkActiveMatch();
        }
      }, 12000);
      return () => clearInterval(interval);
    }
  }, [gameState, activeMatch?.active, checkActiveMatch]);

  // Keep perfEngine informed of gameplay state to avoid measuring false drops when in lobby
  useEffect(() => {
    const isPlaying = gameState?.status === 'playing';
    perfEngine.setInGame(isPlaying);
  }, [gameState?.status]);

  // Connect WebSocket
  useEffect(() => {
    const wsUrl = WS_BASE_URL;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setConnected(true);
        perfEngine.setWsSender((msg) => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(msg));
          }
        });

        // Always sync user profile to backend upon connection
        socket.send(
          JSON.stringify({
            type: 'SYNC_PROFILE',
            profile,
          })
        );

        // Check if user opened a shared lobby link e.g. /?room=MERCY-1234
        const urlParams = new URLSearchParams(window.location.search);
        const sharedRoomId = urlParams.get('room');
        if (sharedRoomId) {
          isLeavingRef.current = false;
          socket.send(
            JSON.stringify({
              type: 'JOIN_LOBBY',
              roomId: sharedRoomId,
              playerName: profile.name,
              avatar: profile.avatar,
              userId: profile.id,
            })
          );
          // Clean URL without full reload
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          // If already in an active room and user did NOT explicitly leave, reconnect session immediately
          const activeRoom = !isLeavingRef.current
            ? (gameStateRef.current?.roomId || localStorage.getItem('uno_current_room'))
            : null;
          if (activeRoom) {
            socket.send(
              JSON.stringify({
                type: 'RECONNECT_SESSION',
                roomId: activeRoom,
                userId: profile.id,
                playerName: profile.name,
              })
            );
          }
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'LOBBY_JOINED':
              isLeavingRef.current = false;
              setGameState(data.gameState);
              gameStateRef.current = data.gameState;
              break;
            case 'GAME_SYNC':
              // Guard: Do not accept unsolicited GAME_SYNC if user has explicitly left or is on home screen
              if (isLeavingRef.current || !gameStateRef.current) {
                return;
              }
              setGameState(data.gameState);
              gameStateRef.current = data.gameState;
              if (data.gameState?.status === 'finished') {
                fetch(`${API_BASE_URL}/api/profile/${profile.id}`)
                  .then((r) => r.json())
                  .then((p) => {
                    if (p && p.id) {
                      setProfile(p);
                      localStorage.setItem('uno_no_mercy_user', JSON.stringify(p));
                    }
                  })
                  .catch(() => {});
              }
              break;
            case 'TIMER_TICK':
              if (isLeavingRef.current || !gameStateRef.current) {
                return;
              }
              timerSync.emit(data.turnTimeRemaining, data.currentTurnIndex ?? gameStateRef.current.currentTurnIndex);
              if (gameStateRef.current) {
                gameStateRef.current.turnTimeRemaining = data.turnTimeRemaining;
                // Only trigger top-level React reconciliation when the turn actually switches
                if (data.currentTurnIndex !== undefined && data.currentTurnIndex !== gameStateRef.current.currentTurnIndex) {
                  gameStateRef.current.currentTurnIndex = data.currentTurnIndex;
                  setGameState((prev) =>
                    prev
                      ? {
                          ...prev,
                          turnTimeRemaining: data.turnTimeRemaining,
                          currentTurnIndex: data.currentTurnIndex,
                        }
                      : null
                  );
                }
              }
              break;
            case 'REJOIN_SUCCESS':
              isLeavingRef.current = false;
              setGameState(data.gameState);
              gameStateRef.current = data.gameState;
              break;
            case 'TABLE_TAUNT': {
              const newTaunt = data.taunt as TableTaunt;
              if (newTaunt) {
                setGameState((prev) => {
                  if (!prev) return null;
                  const existing = prev.activeTaunts || [];
                  const now = Date.now();
                  const fresh = existing.filter((t) => now - t.timestamp < 4500 && t.id !== newTaunt.id);
                  return {
                    ...prev,
                    activeTaunts: [newTaunt, ...fresh.slice(0, 9)],
                  };
                });
              }
              break;
            }
            case 'MATCH_ABANDONED':
            case 'LEFT_ROOM_CONFIRMED':
              isLeavingRef.current = true;
              localStorage.removeItem('uno_current_room');
              gameStateRef.current = null;
              setGameState(null);
              setActiveMatch(null);
              setChatMessages([]);
              checkActiveMatch();
              break;
            case 'KICKED_FROM_ROOM':
              isLeavingRef.current = true;
              localStorage.removeItem('uno_current_room');
              gameStateRef.current = null;
              setGameState(null);
              setActiveMatch(null);
              setChatMessages([]);
              showToast(data.message || 'You have been removed from the lobby by the host.');
              checkActiveMatch();
              break;
            case 'LOBBY_CANCELLED':
              isLeavingRef.current = true;
              localStorage.removeItem('uno_current_room');
              gameStateRef.current = null;
              setGameState(null);
              setActiveMatch(null);
              setChatMessages([]);
              showToast(data.message || 'The host has closed the lobby.');
              checkActiveMatch();
              break;
            case 'CHAT_MESSAGE':
              setChatMessages((prev) => {
                const next = [...prev, data.message];
                return next.length > 50 ? next.slice(-50) : next;
              });
              break;
            case 'PONG':
              perfEngine.handlePong(data.clientTimestamp);
              break;
            case 'LOBBIES_UPDATED':
              if (Array.isArray(data.lobbies)) {
                setPublicLobbies(data.lobbies);
              }
              break;
            case 'ACTIVE_MATCH_STATUS':
              setActiveMatch(data.activeMatch || null);
              break;
            case 'PROFILE_UPDATED':
              if (data.profile) {
                setProfile(data.profile);
                localStorage.setItem('uno_no_mercy_user', JSON.stringify(data.profile));
              }
              break;
            case 'GAME_LOG':
              setChatMessages((prev) => {
                const next = [
                  ...prev,
                  {
                    id: data.log.id,
                    senderId: 'system',
                    senderName: 'System',
                    text: data.log.text,
                    timestamp: data.log.timestamp,
                    isSystem: true,
                    isAction: true,
                  },
                ];
                return next.length > 50 ? next.slice(-50) : next;
              });
              if (
                data.log?.text &&
                (data.log.text.includes('disconnected') ||
                  data.log.text.includes('reconnected') ||
                  data.log.text.includes('rejoined') ||
                  data.log.text.includes('Bot autopilot'))
              ) {
                showToast(data.log.text);
              }
              break;
            case 'ERROR':
              showToast(data.message);
              break;
          }
        } catch (e) {
          console.error('WS parse error', e);
        }
      };

      socket.onclose = () => {
        setConnected(false);
        perfEngine.setWsSender(null);
        reconnectTimeout = setTimeout(connect, 2000);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      wsRef.current?.close();
    };
  }, []);

  // Lobby & Game Actions
  const handleCreateLobby = useCallback((roomName: string, isPrivate: boolean, maxPlayers: number = 8) => {
    isLeavingRef.current = false;
    perfEngine.resetStats();
    const roomId = `MERCY-${Math.floor(1000 + Math.random() * 9000)}`;
    setChatMessages([]);
    sendWs({
      type: 'CREATE_LOBBY',
      roomId,
      roomName,
      playerName: profile.name,
      avatar: profile.avatar,
      userId: profile.id,
      isPrivate,
      maxPlayers,
    });
  }, [profile]);

  const handleJoinLobby = useCallback((roomId: string) => {
    const cleanRoomId = roomId ? roomId.trim() : '';
    if (!cleanRoomId) {
      showToast('Please enter a valid room code.');
      return;
    }
    isLeavingRef.current = false;
    perfEngine.resetStats();
    setChatMessages([]);
    sendWs({
      type: 'JOIN_LOBBY',
      roomId: cleanRoomId,
      playerName: profile.name,
      avatar: profile.avatar,
      userId: profile.id,
    });
  }, [profile]);

  const handleQuickPlayBots = useCallback(() => {
    isLeavingRef.current = false;
    perfEngine.resetStats();
    const roomId = `BOTS-${Math.floor(1000 + Math.random() * 9000)}`;
    setChatMessages([]);
    sendWs({
      type: 'CREATE_LOBBY',
      roomId,
      roomName: 'Solo AI Battle Arena',
      playerName: profile.name,
      avatar: profile.avatar,
      userId: profile.id,
      isPrivate: true,
      maxPlayers: 4,
      isBotOnly: true,
    });

    // Auto add 3 bots after room creation (default 4 slots: 1 player and 3 bots, no more)
    setTimeout(() => {
      sendWs({ type: 'ADD_BOT' });
      setTimeout(() => sendWs({ type: 'ADD_BOT' }), 100);
      setTimeout(() => sendWs({ type: 'ADD_BOT' }), 200);
    }, 400);
  }, [profile]);

  const handleUpdateRules = useCallback((rules: Partial<LobbyRules>) => {
    sendWs({ type: 'UPDATE_RULES', rules });
  }, []);

  const handleAddBot = useCallback((personality?: BotPersonality) => {
    sendWs({ type: 'ADD_BOT', personality });
  }, []);

  const handleSendTaunt = useCallback((emote: string) => {
    sendWs({ type: 'SEND_TAUNT', emote });
  }, []);

  const handleRemovePlayer = useCallback((targetPlayerId: string) => {
    sendWs({ type: 'REMOVE_PLAYER', targetPlayerId });
  }, []);

  const handleToggleReady = useCallback(() => {
    sendWs({ type: 'TOGGLE_READY' });
  }, []);

  const handleStartGame = useCallback(() => {
    perfEngine.resetStats();
    sendWs({ type: 'START_GAME' });
  }, []);

  const handlePlayCard = useCallback((card: Card, chosenColor?: CardColor, targetPlayerId?: string) => {
    // Optimistic instantaneous state update for zero-delay visual responsiveness
    setGameState((prev) => {
      if (!prev || prev.status !== 'playing') return prev;
      const meIdx = prev.players.findIndex((p) => p.id === profile.id);
      if (meIdx === -1) return prev;

      const player = prev.players[meIdx];
      const cardIdx = player.cards.findIndex((c) => c.id === card.id || (c.color === card.color && c.value === card.value));
      if (cardIdx === -1) return prev;

      const updatedCards = [...player.cards];
      const [playedCard] = updatedCards.splice(cardIdx, 1);
      const finalCard: Card = {
        ...playedCard,
        chosenColor: chosenColor || playedCard.chosenColor,
      };

      const updatedPlayers = [...prev.players];
      updatedPlayers[meIdx] = {
        ...player,
        cards: updatedCards,
      };

      const penaltyMap: Record<string, number> = {
        draw2: 2,
        draw4: 4,
        wild_reverse_draw4: 4,
        wild_draw6: 6,
        wild_draw10: 10,
      };
      const penalty = penaltyMap[finalCard.value] || 0;
      const newPenalty = penalty > 0 ? prev.activePenalty + penalty : prev.activePenalty;
      const isWild = finalCard.color === 'wild' || finalCard.value.startsWith('wild_');

      return {
        ...prev,
        discardPile: [...prev.discardPile, finalCard],
        currentColor: isWild && chosenColor ? chosenColor : finalCard.color !== 'wild' ? finalCard.color : prev.currentColor,
        activePenalty: newPenalty,
        lastPenaltyCard: penalty > 0 ? finalCard : prev.lastPenaltyCard,
        players: updatedPlayers,
      };
    });

    sendWs({ type: 'PLAY_CARD', card, chosenColor, targetPlayerId });
  }, [profile.id, sendWs]);

  const handleDrawCard = useCallback(() => {
    sendWs({ type: 'DRAW_CARD' });
  }, []);

  const handleCallUno = useCallback(() => {
    sendWs({ type: 'CALL_UNO' });
  }, []);

  const handleCatchUno = useCallback((targetPlayerId: string) => {
    sendWs({ type: 'CATCH_UNO', targetPlayerId });
  }, []);

  const handleSendMessage = useCallback((text: string) => {
    sendWs({ type: 'CHAT_MESSAGE', text });
  }, []);

  const handleRestartGame = useCallback(() => {
    perfEngine.resetStats();
    sendWs({ type: 'RESTART_GAME' });
  }, []);

  const handleReturnToLobby = useCallback(() => {
    sendWs({ type: 'RETURN_TO_LOBBY' });
  }, []);

  const handleCancelLobby = useCallback(() => {
    isLeavingRef.current = true;
    perfEngine.resetStats();
    const currentRoom = gameStateRef.current?.roomId || gameState?.roomId;
    sendWs({ type: 'CANCEL_LOBBY', roomId: currentRoom, userId: profile.id });
    localStorage.removeItem('uno_current_room');
    gameStateRef.current = null;
    setGameState(null);
    setActiveMatch(null);
    setChatMessages([]);
  }, [profile.id, gameState?.roomId]);

  const handleLeaveGame = useCallback(() => {
    isLeavingRef.current = true;
    perfEngine.resetStats();
    const currentRoom = gameStateRef.current?.roomId || gameState?.roomId;
    if (gameState?.status === 'waiting' && gameState.hostId === profile.id) {
      handleCancelLobby();
      return;
    }
    localStorage.removeItem('uno_current_room');
    sendWs({ type: 'LEAVE_ROOM', roomId: currentRoom, userId: profile.id });
    gameStateRef.current = null;
    setGameState(null);
    setActiveMatch(null);
    setChatMessages([]);
    setTimeout(() => {
      checkActiveMatch();
    }, 400);
  }, [profile.id, gameState?.status, gameState?.hostId, gameState?.roomId, handleCancelLobby]);

  const handleRejoinMatch = useCallback((roomId: string) => {
    isLeavingRef.current = false;
    perfEngine.resetStats();
    sendWs({
      type: 'REJOIN_MATCH',
      roomId,
      userId: profile.id,
    });
  }, [profile.id]);

  const handleAbandonMatch = useCallback((roomId: string) => {
    isLeavingRef.current = true;
    perfEngine.resetStats();
    localStorage.removeItem('uno_current_room');
    gameStateRef.current = null;
    setGameState(null);
    setActiveMatch(null);
    sendWs({
      type: 'ABANDON_MATCH',
      roomId,
      userId: profile.id,
    });
    setTimeout(checkActiveMatch, 400);
  }, [profile.id]);

  const handleResumeControl = useCallback(() => {
    sendWs({ type: 'RESUME_CONTROL' });
  }, []);

  const isInActiveGame = gameState && (gameState.status === 'playing' || gameState.status === 'ended');

  return (
    <ErrorBoundary>
      <div className={`${isInActiveGame ? 'h-screen max-h-screen overflow-hidden bg-neutral-950' : 'min-h-screen bg-ash-asphalt'} flex flex-col text-neutral-100 font-sans selection:bg-rose-500 selection:text-white`}>
      {/* Toast Alert */}
      {errorToast && (
        <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none animate-fadeIn">
          <div className="clip-chamfer bg-red-950 border-2 border-red-600 text-red-200 px-4 py-2.5 shadow-[4px_4px_0px_#000] flex items-center gap-2 text-xs font-mono-hud font-bold">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorToast}</span>
          </div>
        </div>
      )}

      {/* Global Top Navigation Bar (Shown on Landing & Pre-Game Lobby, hidden during full-screen match) */}
      {!isInActiveGame && (
        <header className="h-14 sm:h-16 border-b-2 border-neutral-800 bg-[#0a090d]/95 sticky top-0 z-40 px-3 sm:px-6 flex items-center justify-between gap-2 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          {/* Brand */}
          <div className="flex items-center space-x-3 shrink-0">
            <button
              type="button"
              onClick={handleLeaveGame}
              className="flex items-center space-x-2.5 text-left group cursor-pointer"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center text-white border border-amber-400/80 shadow-[2px_2px_0px_#000] clip-chamfer-btn group-hover:scale-105 transition-transform shrink-0">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 fill-white stroke-[2.5]" />
              </div>
              <div className="leading-none">
                <span className="font-display font-black text-lg sm:text-xl tracking-wider text-white block">
                  UNO NO MERCY
                </span>
                <span className="hidden sm:block font-mono-hud text-[9px] text-neutral-400 font-bold uppercase tracking-widest">
                  HVW18 COMBAT ARENA
                </span>
              </div>
            </button>

            {/* Connection Status Indicator */}
            <div className="hidden md:flex items-center space-x-1.5 px-2 py-0.5 bg-[#141219] border border-neutral-800 font-mono-hud text-[10px] text-neutral-400 clip-chamfer-btn">
              {connected ? (
                <>
                  <span className="w-1.5 h-1.5 bg-emerald-500" />
                  <span className="text-emerald-400 font-bold uppercase">Online</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 bg-red-500 animate-pulse" />
                  <span className="text-red-400 font-bold uppercase">Reconnecting</span>
                </>
              )}
            </div>
          </div>

          {/* Right Navigation Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 font-mono-hud text-xs">
            {/* Mattel Rulebook */}
            <button
              type="button"
              onClick={() => setIsRulesOpen(true)}
              className="btn-stamp-secondary clip-chamfer-btn inline-flex items-center justify-center gap-1.5 w-8 h-8 sm:w-auto sm:h-9 sm:px-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 transition-colors cursor-pointer leading-none"
              title="Official Rulebook"
            >
              <BookOpen className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-rose-400 shrink-0" />
              <span className="hidden sm:inline font-bold">Rules</span>
            </button>

            {/* Handbook Rule Answerer */}
            <button
              type="button"
              onClick={() => setIsRefereeOpen(true)}
              className="btn-stamp-secondary clip-chamfer-btn inline-flex items-center justify-center gap-1 sm:gap-1.5 h-8 px-2.5 sm:h-9 sm:px-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-amber-300 hover:text-amber-200 transition-all cursor-pointer leading-none"
              title="AI Referee & Handbook"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden sm:inline font-bold">Handbook</span>
              <span className="sm:hidden text-[10px] font-bold leading-none">AI</span>
            </button>

            {/* Profile & History */}
            <button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              className="btn-stamp-secondary clip-chamfer-btn inline-flex items-center justify-center gap-2 w-8 h-8 sm:w-auto sm:h-9 sm:px-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white transition-colors cursor-pointer leading-none"
              title="Player Profile"
            >
              <span className="text-sm leading-none flex items-center justify-center">{profile.avatar}</span>
              <span className="hidden sm:inline font-bold truncate max-w-[80px]">{profile.name}</span>
            </button>

            {/* Leave Game button if inside a room */}
            {gameState && (
              <button
                type="button"
                onClick={handleLeaveGame}
                className="btn-stamp-secondary clip-chamfer-btn inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 bg-neutral-900 hover:bg-red-950 border border-neutral-700 text-neutral-400 hover:text-red-300 transition-colors cursor-pointer leading-none"
                title="Leave Room"
              >
                <LogOut className="w-4 h-4 shrink-0" />
              </button>
            )}
          </div>
        </header>
      )}

      {/* Main App Stage */}
      <main className={isInActiveGame ? 'h-full flex-1 overflow-hidden' : 'flex-1'}>
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center h-[70vh] gap-3 font-mono-hud">
              <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                Loading Arena Module...
              </span>
            </div>
          }
        >
          {!gameState ? (
            /* Lobby Browser & Landing Screen */
            <LobbyList
              profile={profile}
              wsLobbies={publicLobbies}
              onCreateLobby={handleCreateLobby}
              onJoinLobby={handleJoinLobby}
              onQuickPlayBots={handleQuickPlayBots}
              onOpenProfile={() => setIsProfileOpen(true)}
              onOpenRules={() => setIsRulesOpen(true)}
              onOpenReferee={() => setIsRefereeOpen(true)}
              activeMatch={activeMatch}
              onRejoinMatch={handleRejoinMatch}
              onAbandonMatch={handleAbandonMatch}
            />
          ) : gameState.status === 'waiting' ? (
            /* Pre-Game Lobby Configuration Room */
            <LobbyRoom
              gameState={gameState}
              currentUserId={profile.id}
              onUpdateRules={handleUpdateRules}
              onAddBot={handleAddBot}
              onRemovePlayer={handleRemovePlayer}
              onToggleReady={handleToggleReady}
              onStartGame={handleStartGame}
              onSendMessage={handleSendMessage}
              chatMessages={chatMessages}
              onOpenRulesModal={() => setIsRulesOpen(true)}
              onLeaveLobby={handleLeaveGame}
              onCancelLobby={handleCancelLobby}
            />
          ) : (
            /* Active Playing Game Arena */
            <GameBoard
              gameState={gameState}
              currentUserId={profile.id}
              onPlayCard={handlePlayCard}
              onDrawCard={handleDrawCard}
              onCallUno={handleCallUno}
              onCatchUno={handleCatchUno}
              onSendMessage={handleSendMessage}
              onSendTaunt={handleSendTaunt}
              chatMessages={chatMessages}
              onOpenRules={() => setIsRulesOpen(true)}
              onOpenReferee={() => setIsRefereeOpen(true)}
              onRestartGame={handleRestartGame}
              onLeaveGame={handleLeaveGame}
              onReturnToLobby={handleReturnToLobby}
              onResumeControl={handleResumeControl}
            />
          )}
        </Suspense>
      </main>

      {/* Lazy-Loaded Modals */}
      <Suspense fallback={null}>
        {isRulesOpen && (
          <RulebookModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
        )}
        {isProfileOpen && (
          <ProfileModal
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            profile={profile}
            onUpdateProfile={updateProfile}
          />
        )}
        {isRefereeOpen && (
          <HandbookModal
            isOpen={isRefereeOpen}
            onClose={() => setIsRefereeOpen(false)}
            gameState={gameState}
            myCards={gameState?.players.find((p) => p.id === profile.id)?.cards}
          />
        )}
      </Suspense>

        {/* Lightweight Direct-DOM Telemetry HUD (Controlled via VITE_ENABLE_PERF_TRACKER env var) */}
        {IS_PERF_TRACKER_ENABLED && <MinimalPerfMonitor />}
      </div>
    </ErrorBoundary>
  );
}
