import React, { useState } from 'react';
import { GameState, LobbyRules, ChatMessage, BotPersonality } from '../../../shared/src/types';
import { ChatPanel } from './ChatPanel';
import {
  Copy,
  Check,
  Play,
  Users,
  Bot,
  Settings2,
  Trash2,
  Flame,
  CheckCircle2,
  Share2,
  LogOut,
  Zap,
  Compass,
  ChevronDown,
  Clock,
  Skull,
  UserPlus,
  Radio,
} from 'lucide-react';

interface LobbyRoomProps {
  gameState: GameState;
  currentUserId: string;
  onUpdateRules: (rules: Partial<LobbyRules>) => void;
  onAddBot: (personality?: BotPersonality) => void;
  onRemovePlayer: (playerId: string) => void;
  onToggleReady: () => void;
  onStartGame: () => void;
  onSendMessage: (text: string) => void;
  chatMessages: ChatMessage[];
  onOpenRulesModal: () => void;
  onLeaveLobby?: () => void;
  onCancelLobby?: () => void;
}

export const LobbyRoom: React.FC<LobbyRoomProps> = ({
  gameState,
  currentUserId,
  onUpdateRules,
  onAddBot,
  onRemovePlayer,
  onToggleReady,
  onStartGame,
  onSendMessage,
  chatMessages,
  onOpenRulesModal,
  onLeaveLobby,
  onCancelLobby,
}) => {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showBotMenu, setShowBotMenu] = useState(false);
  const isHost = gameState.hostId === currentUserId;
  const me = gameState.players.find((p) => p.id === currentUserId);
  const rules = gameState.rules;

  const copyRoomCode = () => {
    navigator.clipboard.writeText(gameState.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLobbyLink = async () => {
    const shareUrl = `${window.location.origin}/?room=${encodeURIComponent(gameState.roomId)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join UNO No Mercy: ${gameState.roomName}`,
          text: `Join my UNO No Mercy arena ${gameState.roomId} and battle with ruthless rules!`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard copy
      }
    }
    navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2200);
  };

  const allPlayersReady =
    gameState.players.length >= 2 &&
    gameState.players.every((p) => p.isReady || p.isHost || p.isBot);

  // Maximum 8 player slots for visualization
  const totalSlots = 8;
  const emptySlotsCount = Math.max(0, totalSlots - gameState.players.length);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6 animate-fadeIn">
      {/* Top Arena Banner */}
      <section className="clip-chamfer-lg bg-[#0d0c10] border-2 border-neutral-800 p-5 sm:p-7 shadow-[6px_6px_0px_#000000] relative overflow-hidden">
        {/* Repeating Subtle Fracture Texture Overlay */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'%3E%3Cpath d='M10,0 L30,40 L15,80 L55,100 L35,150 L90,170 L100,220 M55,100 L110,90 L150,130 L130,190 L180,220 M110,90 L160,60 L210,70 L220,50' fill='none' stroke='%23ff2600' stroke-width='0.65' stroke-opacity='0.25'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
          }}
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 bg-red-950 border border-red-600 text-red-400 font-mono-hud text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-red-500 animate-pulse" />
                <span>PRE-COMBAT STAGING</span>
              </span>
              <span className="px-2.5 py-0.5 bg-neutral-900 border border-neutral-700 text-neutral-300 font-mono-hud text-[10px] font-bold uppercase">
                MATTEL HVW18
              </span>
            </div>

            <h1 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl uppercase tracking-wider leading-none text-white">
              {gameState.roomName}
            </h1>

            <p className="text-xs text-neutral-400 font-sans max-w-xl">
              Assemble your contenders. Share the encrypted room code with rivals or deploy ruthless AI bots to fill the combat arena.
            </p>
          </div>

          {/* Quick Action Control Bar */}
          <div className="flex flex-wrap items-center gap-2.5 font-mono-hud text-xs">
            {/* Direct Share Link */}
            <button
              type="button"
              onClick={shareLobbyLink}
              className="btn-stamp-secondary clip-chamfer-btn flex items-center space-x-2 px-3.5 py-2.5 bg-[#17151e] hover:bg-[#221f2d] border border-amber-500/50 text-amber-300 font-bold transition-all cursor-pointer"
              title="Copy shareable link for friends to join immediately"
            >
              {linkCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">LINK COPIED!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-amber-400" />
                  <span>SHARE LINK</span>
                </>
              )}
            </button>

            {/* Room Code Quick Copy */}
            <button
              type="button"
              onClick={copyRoomCode}
              className="btn-stamp-secondary clip-chamfer-btn flex items-center space-x-2 px-3.5 py-2.5 bg-[#17151e] hover:bg-[#221f2d] border border-neutral-700 text-white font-bold transition-all cursor-pointer"
              title="Copy Room Code"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300 font-mono-hud">COPIED</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-red-400" />
                  <span>
                    ROOM CODE: <strong className="text-amber-300 font-black">{gameState.roomId}</strong>
                  </span>
                </>
              )}
            </button>

            {/* Host Cancel or Player Leave */}
            {isHost ? (
              <button
                type="button"
                onClick={onCancelLobby || onLeaveLobby}
                className="btn-stamp-secondary clip-chamfer-btn flex items-center space-x-1.5 px-3.5 py-2.5 bg-red-950/70 hover:bg-red-900 border border-red-800 hover:border-red-600 font-bold text-red-300 hover:text-white transition-all cursor-pointer"
                title="Cancel and close lobby for everyone"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                <span>DISBAND ARENA</span>
              </button>
            ) : (
              onLeaveLobby && (
                <button
                  type="button"
                  onClick={onLeaveLobby}
                  className="btn-stamp-secondary clip-chamfer-btn flex items-center space-x-1.5 px-3 py-2.5 bg-neutral-900 hover:bg-red-950 border border-neutral-700 hover:border-red-700 font-bold text-neutral-400 hover:text-red-300 transition-all cursor-pointer"
                  title="Leave Lobby"
                >
                  <LogOut className="w-4 h-4" />
                  <span>RETREAT</span>
                </button>
              )
            )}
          </div>
        </div>
      </section>

      {/* Main Grid: Left Side (Roster & Rules) / Right Side (Tactical Chat & Combat Log) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Roster & Rules */}
        <div className="lg:col-span-8 space-y-6">
          {/* Fighters Roster Section */}
          <section className="clip-chamfer-lg bg-[#0e0d12] border-2 border-neutral-800 p-5 sm:p-6 shadow-[4px_4px_0px_#000] space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <Users className="w-5 h-5 text-red-500" />
                <h2 className="font-display font-black text-xl uppercase tracking-wider text-white">
                  Contenders Roster
                </h2>
                <span className="font-mono-hud text-xs font-bold px-2 py-0.5 bg-neutral-900 border border-neutral-800 text-neutral-300">
                  {gameState.players.length}/{totalSlots} SLOTS
                </span>
              </div>

              {/* Add AI Bot Dropdown */}
              {isHost && gameState.players.length < 8 && (
                <div className="relative font-mono-hud text-xs">
                  <button
                    type="button"
                    onClick={() => setShowBotMenu(!showBotMenu)}
                    className="btn-stamp-secondary clip-chamfer-btn flex items-center space-x-1.5 px-3.5 py-1.5 bg-purple-950/80 hover:bg-purple-900 border border-purple-700 text-purple-200 font-bold transition-colors cursor-pointer uppercase"
                  >
                    <Bot className="w-3.5 h-3.5 text-purple-300" />
                    <span>+ Deploy Bot</span>
                    <ChevronDown className="w-3 h-3 text-purple-400" />
                  </button>

                  {showBotMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowBotMenu(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 w-64 p-2 clip-chamfer-lg bg-[#0f0d15] border-2 border-purple-700 shadow-[6px_6px_0px_#000] z-50 space-y-1.5 backdrop-blur-md">
                        <div className="text-[10px] font-mono-hud font-black uppercase tracking-wider text-purple-300 px-2 py-1 border-b border-purple-900/60">
                          Select AI Combat Profile
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onAddBot('aggressive');
                            setShowBotMenu(false);
                          }}
                          className="w-full text-left p-2.5 clip-chamfer-btn bg-[#181424] hover:bg-red-950/70 border border-neutral-800 hover:border-red-700 transition-colors flex items-center space-x-2.5 cursor-pointer"
                        >
                          <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          <div>
                            <div className="font-display font-black text-sm uppercase text-white">
                              ⚡ Aggressive
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono-hud">
                              Ruthless penalty stacks & attacks
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onAddBot('chaos');
                            setShowBotMenu(false);
                          }}
                          className="w-full text-left p-2.5 clip-chamfer-btn bg-[#181424] hover:bg-purple-950/70 border border-neutral-800 hover:border-purple-700 transition-colors flex items-center space-x-2.5 cursor-pointer"
                        >
                          <Compass className="w-4 h-4 text-fuchsia-400 flex-shrink-0" />
                          <div>
                            <div className="font-display font-black text-sm uppercase text-white">
                              🌪️ Chaos
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono-hud">
                              7s/0s hand swaps & wild roulette
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onAddBot('casual');
                            setShowBotMenu(false);
                          }}
                          className="w-full text-left p-2.5 clip-chamfer-btn bg-[#181424] hover:bg-cyan-950/70 border border-neutral-800 hover:border-cyan-700 transition-colors flex items-center space-x-2.5 cursor-pointer"
                        >
                          <Bot className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                          <div>
                            <div className="font-display font-black text-sm uppercase text-white">
                              🤖 Standard
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono-hud">
                              Balanced tactical card play
                            </div>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Fighter Slot Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              {gameState.players.map((p, idx) => {
                const isCurrentUser = p.id === currentUserId;
                const isReady = p.isReady || p.isHost || p.isBot;
                return (
                  <div
                    key={p.id}
                    className={`clip-chamfer p-3.5 border-2 flex flex-col justify-between transition-all min-h-[140px] shadow-[3px_3px_0px_#000] ${
                      isCurrentUser
                        ? 'bg-[#181216] border-red-600 ring-1 ring-red-500/40'
                        : isReady
                        ? 'bg-[#101512] border-emerald-800/80'
                        : 'bg-[#121117] border-neutral-800'
                    }`}
                  >
                    {/* Top Row: Avatar & Remove */}
                    <div className="flex items-start justify-between">
                      <div className="relative w-11 h-11 bg-[#1c1924] border-2 border-neutral-700 flex items-center justify-center text-2xl clip-chamfer-btn shadow-inner flex-shrink-0">
                        <span>{p.avatar}</span>
                        <div
                          className={`absolute -bottom-1 -right-1 w-3 h-3 border border-black ${
                            isReady ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="font-mono-hud text-[10px] font-bold text-neutral-500">
                          P{idx + 1}
                        </span>
                        {isHost && !p.isHost && (
                          <button
                            type="button"
                            onClick={() => onRemovePlayer(p.id)}
                            className="p-1 clip-chamfer-btn text-neutral-500 hover:text-red-400 hover:bg-red-950/60 transition-colors cursor-pointer"
                            title="Eject Contender"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bottom Info */}
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-display font-black text-base uppercase text-white truncate">
                          {p.name}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1 font-mono-hud text-[10px]">
                        {p.isHost ? (
                          <span className="px-1.5 py-0.5 bg-amber-400 text-black font-black uppercase">
                            HOST
                          </span>
                        ) : p.isBot ? (
                          <span
                            className={`px-1.5 py-0.5 font-bold uppercase ${
                              p.botPersonality === 'aggressive'
                                ? 'bg-red-950 text-red-300 border border-red-700'
                                : p.botPersonality === 'chaos'
                                ? 'bg-purple-950 text-purple-300 border border-purple-700'
                                : 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                            }`}
                          >
                            {p.botPersonality || 'BOT'}
                          </span>
                        ) : (
                          <span className="text-neutral-500 font-bold uppercase">
                            {isCurrentUser ? 'YOU' : 'CHALLENGER'}
                          </span>
                        )}

                        {p.isHost ? (
                          <span className="text-amber-400 font-bold">READY</span>
                        ) : isReady ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" /> READY
                          </span>
                        ) : (
                          <span className="text-amber-400 font-bold">WAITING</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Empty Fighter Slots */}
              {Array.from({ length: emptySlotsCount }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="clip-chamfer p-3.5 border-2 border-dashed border-neutral-800 bg-[#0a090e]/60 flex flex-col items-center justify-center min-h-[140px] text-center space-y-2 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <div className="w-10 h-10 clip-chamfer-btn bg-[#14121a] border border-neutral-800 flex items-center justify-center text-neutral-600">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div className="font-mono-hud text-[10px] text-neutral-500 uppercase font-bold">
                    Open Slot
                  </div>
                </div>
              ))}
            </div>

            {/* Launch & Ready Command Strip */}
            <div className="pt-3 border-t-2 border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs font-mono-hud text-neutral-400 flex items-center gap-2">
                <Flame className="w-4 h-4 text-red-500" />
                <span>
                  {gameState.players.length < 2
                    ? 'Requires minimum 2 combatants to commence.'
                    : allPlayersReady
                    ? 'All contenders armed and ready.'
                    : 'Awaiting contenders confirmation.'}
                </span>
              </div>

              <div className="flex items-center space-x-3 w-full sm:w-auto">
                {!isHost && (
                  <button
                    type="button"
                    onClick={onToggleReady}
                    className={`btn-stamp-slam clip-chamfer-btn w-full sm:w-auto px-8 py-3 font-display font-black text-base uppercase tracking-wider transition-all cursor-pointer ${
                      me?.isReady
                        ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white border-2 border-emerald-400'
                    }`}
                  >
                    {me?.isReady ? 'Cancel Ready' : 'Ready For Combat!'}
                  </button>
                )}

                {isHost && (
                  <button
                    type="button"
                    onClick={onStartGame}
                    disabled={!allPlayersReady}
                    className="btn-stamp-slam clip-chamfer-btn w-full sm:w-auto flex items-center justify-center space-x-2 px-9 py-3.5 bg-gradient-to-r from-red-600 via-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 disabled:opacity-40 disabled:pointer-events-none font-display font-black text-lg uppercase tracking-wider text-white border-2 border-amber-400 shadow-[4px_4px_0px_#000] transition-all cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-white stroke-[2.5]" />
                    <span>Commence Match</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Custom House Rules Configuration Section */}
          <section className="clip-chamfer-lg bg-[#0e0d12] border-2 border-neutral-800 p-5 sm:p-6 shadow-[4px_4px_0px_#000] space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <Settings2 className="w-5 h-5 text-amber-400" />
                <h2 className="font-display font-black text-xl uppercase tracking-wider text-white">
                  Combat Ruleset Configuration
                </h2>
              </div>
              <button
                type="button"
                onClick={onOpenRulesModal}
                className="btn-stamp-secondary clip-chamfer-btn px-3 py-1.5 bg-neutral-900 border border-neutral-700 text-xs font-mono-hud font-bold text-red-400 hover:text-white transition-colors cursor-pointer"
              >
                Mattel Codex &rarr;
              </button>
            </div>

            {/* Core Sliders / Limit Pickers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono-hud text-xs">
              {/* Mercy Limit Selector */}
              <div className="clip-chamfer p-4 bg-[#141219] border border-neutral-800 space-y-2.5 shadow-[2px_2px_0px_#000]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5 uppercase">
                    <Skull className="w-4 h-4 text-red-500" /> Mercy Knockout Threshold
                  </span>
                  <span className="font-black text-red-400 bg-red-950 px-2 py-0.5 border border-red-800">
                    {rules.mercyLimit === 0 ? 'OFF' : `${rules.mercyLimit} CARDS`}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-normal font-sans">
                  Instant elimination when a player accumulates this many cards in hand.
                </p>
                {isHost && (
                  <div className="flex gap-1.5 pt-1">
                    {[15, 20, 25, 30, 0].map((limit) => (
                      <button
                        key={limit}
                        type="button"
                        onClick={() => onUpdateRules({ mercyLimit: limit })}
                        className={`btn-stamp-secondary clip-chamfer-btn flex-1 py-1 font-black text-xs transition-colors cursor-pointer ${
                          rules.mercyLimit === limit
                            ? 'bg-red-600 text-white border-red-500'
                            : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border-neutral-700'
                        }`}
                      >
                        {limit === 0 ? 'OFF' : `${limit}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Turn Timer Selector */}
              <div className="clip-chamfer p-4 bg-[#141219] border border-neutral-800 space-y-2.5 shadow-[2px_2px_0px_#000]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5 uppercase">
                    <Clock className="w-4 h-4 text-amber-400" /> Turn Timer
                  </span>
                  <span className="font-black text-amber-400 bg-amber-950/80 px-2 py-0.5 border border-amber-800">
                    {rules.turnTimerSeconds === 0 ? 'INFINITE' : `${rules.turnTimerSeconds}S`}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-normal font-sans">
                  Time allocated per turn before the combat engine automatically draws a card.
                </p>
                {isHost && (
                  <div className="flex gap-1.5 pt-1">
                    {[15, 30, 45, 60, 0].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => onUpdateRules({ turnTimerSeconds: t })}
                        className={`btn-stamp-secondary clip-chamfer-btn flex-1 py-1 font-black text-xs transition-colors cursor-pointer ${
                          rules.turnTimerSeconds === t
                            ? 'bg-amber-500 text-black border-amber-400'
                            : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border-neutral-700'
                        }`}
                      >
                        {t === 0 ? 'OFF' : `${t}s`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tactical Rule Switches */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono-hud text-xs">
              {[
                {
                  key: 'allowStacking',
                  label: 'Equal or Higher Draw Stacking',
                  desc: 'Pass accumulated penalties (+2, +4, +6, +10) forward',
                },
                {
                  key: 'allow7Swap',
                  label: '7s Mandatory Hand Swap',
                  desc: 'ON: Swap is mandatory. OFF: Swapping is optional (can keep hand)',
                },
                {
                  key: 'allow0PassAll',
                  label: '0s Pass All Hands',
                  desc: 'All contenders rotate entire hands in play direction',
                },
                {
                  key: 'allowJumpIn',
                  label: 'Jump-In Rule',
                  desc: 'Play exact matching color & symbol instantly out of turn',
                },
                {
                  key: 'drawUntilPlayable',
                  label: 'Draw Until Playable',
                  desc: 'Continuously draw until finding a valid card (OFF by default for 1-draw)',
                },
                {
                  key: 'allowDiscardAll',
                  label: 'Discard All Cards',
                  desc: 'Enables Discard All cards to dump all matching colors',
                },
                {
                  key: 'allowSkipEveryone',
                  label: 'Skip Everyone Card',
                  desc: 'Skips all opponents and immediately gives another turn',
                },
                {
                  key: 'allowColorRoulette',
                  label: 'Wild Color Roulette',
                  desc: 'Victim draws until revealing the designated color',
                },
              ].map((ruleItem) => {
                const val = !!rules[ruleItem.key as keyof LobbyRules];
                return (
                  <div
                    key={ruleItem.key}
                    className="clip-chamfer p-3.5 bg-[#141219] border border-neutral-800 flex items-center justify-between gap-3 shadow-[2px_2px_0px_#000]"
                  >
                    <div className="space-y-0.5">
                      <span className="font-bold text-white block uppercase text-[11px]">
                        {ruleItem.label}
                      </span>
                      <span className="text-[10px] text-neutral-400 block leading-tight font-sans">
                        {ruleItem.desc}
                      </span>
                    </div>

                    {isHost ? (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateRules({ [ruleItem.key]: !val } as Partial<LobbyRules>)
                        }
                        className={`w-12 h-6 clip-chamfer-btn transition-colors relative flex-shrink-0 cursor-pointer ${
                          val ? 'bg-red-600 border border-red-400' : 'bg-neutral-800 border border-neutral-700'
                        }`}
                      >
                        <span
                          className={`block w-4 h-4 bg-white transition-transform ${
                            val ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    ) : (
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 clip-chamfer-btn ${
                          val
                            ? 'bg-red-950 text-red-300 border border-red-800'
                            : 'bg-neutral-900 text-neutral-500 border border-neutral-800'
                        }`}
                      >
                        {val ? 'ON' : 'OFF'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column (4 cols): Chat & Tactical Feed */}
        <div className="lg:col-span-4 h-[580px] lg:h-[720px] flex flex-col">
          <ChatPanel
            messages={chatMessages}
            onSendMessage={onSendMessage}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    </div>
  );
};
