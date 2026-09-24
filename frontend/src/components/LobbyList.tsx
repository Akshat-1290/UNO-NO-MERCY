import React, { useState, useEffect } from 'react';
import {
  Plus,
  Bot,
  Flame,
  Layers,
  ArrowRight,
  BookOpen,
  User,
  Sparkles,
  Zap,
  RotateCcw,
  Copy,
  Check,
  Swords,
  RefreshCw,
  Skull,
  Radio,
} from 'lucide-react';
import { LobbyRules, UserProfile } from '../../../shared/src/types';
import { API_BASE_URL } from '../config/api';

interface LobbySummary {
  roomId: string;
  roomName: string;
  playerCount: number;
  maxPlayers: number;
  rules: LobbyRules;
}

interface LobbyListProps {
  profile: UserProfile;
  onCreateLobby: (roomName: string, isPrivate: boolean) => void;
  onJoinLobby: (roomId: string) => void;
  onQuickPlayBots: () => void;
  onOpenProfile: () => void;
  onOpenRules: () => void;
  onOpenReferee: () => void;
  activeMatch?: {
    active: boolean;
    roomId?: string;
    roomName?: string;
    status?: string;
    pauseReason?: string;
  } | null;
  onRejoinMatch?: (roomId: string) => void;
  onAbandonMatch?: (roomId: string) => void;
}

export const LobbyList: React.FC<LobbyListProps> = ({
  profile,
  onCreateLobby,
  onJoinLobby,
  onQuickPlayBots,
  onOpenProfile,
  onOpenRules,
  onOpenReferee,
  activeMatch,
  onRejoinMatch,
  onAbandonMatch,
}) => {
  const [lobbies, setLobbies] = useState<LobbySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState(`${profile.name}'s Mercy Arena`);
  const [isPrivate, setIsPrivate] = useState(false);

  const copyRoomId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedRoomId(id);
    setTimeout(() => setCopiedRoomId(null), 2000);
  };

  const fetchLobbies = () => {
    setIsRefreshing(true);
    fetch(`${API_BASE_URL}/api/lobbies`)
      .then((res) => res.json())
      .then((data) => {
        setLobbies(data);
        setLoading(false);
        setIsRefreshing(false);
      })
      .catch(() => {
        setLoading(false);
        setIsRefreshing(false);
      });
  };

  useEffect(() => {
    fetchLobbies();
    const interval = setInterval(fetchLobbies, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateLobby(newRoomName.trim() || `${profile.name}'s Mercy Arena`, isPrivate);
    setCreateModalOpen(false);
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    onJoinLobby(joinCode.trim().toUpperCase());
  };

  const winRate = profile.gamesPlayed > 0
    ? Math.round((profile.wins / profile.gamesPlayed) * 100)
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Active Match In Progress Rejoin Banner */}
      {activeMatch?.active && activeMatch.roomId && (
        <div className="clip-chamfer p-4 sm:p-5 bg-[#120e0a] border-2 border-amber-500 shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-amber-500/10 border border-amber-500/60 flex items-center justify-center text-amber-400 flex-shrink-0 clip-chamfer-btn">
              <RotateCcw className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-base sm:text-lg tracking-wide uppercase text-white">
                  Combat In Progress
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono-hud font-black bg-amber-500 text-black uppercase tracking-wider">
                  {activeMatch.status === 'paused' ? 'PAUSED' : 'LIVE'}
                </span>
              </div>
              <p className="text-xs text-neutral-300 mt-0.5">
                Arena: <span className="font-mono-hud font-bold text-amber-300">{activeMatch.roomName}</span> (
                <span className="font-mono-hud text-amber-400">{activeMatch.roomId}</span>)
                {activeMatch.pauseReason
                  ? ` — ${activeMatch.pauseReason}`
                  : ' — AI autopilot holds your position until your return.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onRejoinMatch?.(activeMatch.roomId!)}
              className="btn-stamp-slam clip-chamfer-btn flex-1 sm:flex-initial px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-display font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 stroke-[2.5]" />
              <span>Rejoin Combat</span>
            </button>
            <button
              type="button"
              onClick={() => onAbandonMatch?.(activeMatch.roomId!)}
              className="btn-stamp-secondary clip-chamfer-btn px-4 py-2.5 bg-neutral-900 border border-neutral-700 text-neutral-400 hover:text-rose-400 font-mono-hud font-bold text-xs uppercase transition-colors cursor-pointer"
            >
              Forfeit
            </button>
          </div>
        </div>
      )}

      {/* Hero Battle Arena Stage: Diagonal "VS" Screen Layout */}
      <section className="relative clip-chamfer-lg border-2 border-neutral-800 bg-[#0d0c10] shadow-[6px_6px_0px_#000000] overflow-hidden">
        {/* Repeating Subtle Fracture Texture Overlay */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'%3E%3Cpath d='M10,0 L30,40 L15,80 L55,100 L35,150 L90,170 L100,220 M55,100 L110,90 L150,130 L130,190 L180,220 M110,90 L160,60 L210,70 L220,50' fill='none' stroke='%23ff2600' stroke-width='0.65' stroke-opacity='0.25'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
          }}
        />

        {/* Diagonal Split Container */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 min-h-[380px]">
          {/* Left Hero Side: Battle Manifesto & Primary Stamped CTA */}
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              {/* Stamped HVW18 Combat Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-950/80 border border-red-600 text-red-400 font-mono-hud text-[11px] font-bold tracking-widest uppercase">
                <Flame className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                <span>OFFICIAL MATTEL HVW18 RULESET</span>
              </div>

              {/* Main Headline: Heavy Condensed Display Font with Distressed/Stamped Feel */}
              <h1 className="font-display font-black text-4xl sm:text-6xl lg:text-7xl uppercase tracking-wider leading-[0.88] text-white">
                UNO SHOW 'EM <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-rose-500 to-amber-400 drop-shadow-[0_2px_12px_rgba(255,38,0,0.45)]">
                  NO MERCY
                </span>
              </h1>

              {/* Tagline / Subtitle */}
              <p className="text-xs sm:text-sm text-neutral-300 max-w-lg leading-relaxed font-sans">
                The most ruthless card game on earth. Stack lethal <strong className="text-white">+10 and +6 penalties</strong>,
                knock rivals out with the <strong className="text-red-400">25-Card Mercy Rule</strong>, swap entire hands on 7s,
                and survive pure chaos.
              </p>
            </div>

            {/* CTA Command Strip: Branded Stamped Button with Slam-Down Press */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="btn-stamp-slam clip-chamfer-btn relative inline-flex items-center justify-center gap-2.5 px-7 py-3.5 bg-gradient-to-r from-red-600 via-red-600 to-rose-700 text-white font-display font-black text-lg sm:text-xl tracking-wider uppercase border-2 border-amber-400 cursor-pointer select-none"
              >
                <Plus className="w-5 h-5 text-amber-300 stroke-[3]" />
                <span>Create Custom Lobby</span>
                <span className="absolute -top-2.5 -right-2 bg-amber-400 text-black font-mono-hud font-black text-[9px] px-1.5 py-0.5 tracking-tighter uppercase shadow">
                  HOST
                </span>
              </button>

              <button
                type="button"
                onClick={onQuickPlayBots}
                className="btn-stamp-secondary clip-chamfer-btn inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-neutral-900 border border-neutral-700 hover:border-purple-500 text-neutral-200 font-display font-black text-base uppercase tracking-wider transition-colors cursor-pointer select-none"
              >
                <Bot className="w-4 h-4 text-purple-400" />
                <span>Vs AI Bots</span>
              </button>
            </div>

            {/* Quick Rules Stamped Checklist */}
            <div className="pt-2 flex flex-wrap gap-2 text-[10px] font-mono-hud text-neutral-400 uppercase">
              <span className="flex items-center gap-1 text-red-400 font-bold">
                <Skull className="w-3 h-3 text-red-500" /> 25-Card KO
              </span>
              <span className="text-neutral-600">/</span>
              <span>+10 Stacking</span>
              <span className="text-neutral-600">/</span>
              <span>7 Hand Swap</span>
              <span className="text-neutral-600">/</span>
              <span>0 Pass All</span>
              <span className="text-neutral-600">/</span>
              <span>Color Roulette</span>
            </div>
          </div>

          {/* Right Combatant Side: Fighting Game Fighter HUD Plate */}
          <div className="lg:col-span-5 p-6 sm:p-8 bg-[#111015] border-t lg:border-t-0 lg:border-l-2 border-neutral-800 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              {/* Header with Title & Profile Edit */}
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-rose-500" />
                  <span className="font-display font-black text-sm tracking-wider uppercase text-neutral-300">
                    Combatant Dossier
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="btn-stamp-secondary clip-chamfer-btn px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-[11px] font-mono-hud font-bold text-neutral-300 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <User className="w-3 h-3 text-rose-400" />
                  <span>Edit</span>
                </button>
              </div>

              {/* Combatant Avatar & Identity */}
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 sm:w-18 sm:h-18 bg-[#18161e] border-2 border-neutral-700 flex items-center justify-center text-3xl sm:text-4xl shadow-inner clip-chamfer flex-shrink-0">
                  <span>{profile.avatar}</span>
                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border border-black" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-black text-xl sm:text-2xl tracking-wide uppercase text-white truncate">
                    {profile.name}
                  </div>
                  <div className="font-mono-hud text-[11px] font-bold text-red-400 uppercase tracking-wide">
                    {profile.title}
                  </div>
                  <div className="font-mono-hud text-[10px] text-neutral-500 mt-0.5">
                    ID: {profile.id.slice(0, 12)}
                  </div>
                </div>
              </div>

              {/* Monospace HUD Combat Statistics */}
              <div className="grid grid-cols-3 gap-2 pt-1 font-mono-hud">
                <div className="p-2.5 bg-[#17151c] border border-neutral-800/90 clip-chamfer">
                  <span className="text-[10px] text-neutral-500 uppercase block">Matches</span>
                  <span className="font-black text-base sm:text-lg text-white block">
                    {profile.gamesPlayed}
                  </span>
                </div>
                <div className="p-2.5 bg-[#17151c] border border-neutral-800/90 clip-chamfer">
                  <span className="text-[10px] text-neutral-500 uppercase block">Victories</span>
                  <span className="font-black text-base sm:text-lg text-amber-400 block">
                    {profile.wins}
                  </span>
                </div>
                <div className="p-2.5 bg-[#17151c] border border-neutral-800/90 clip-chamfer">
                  <span className="text-[10px] text-neutral-500 uppercase block">Win Rate</span>
                  <span className="font-black text-base sm:text-lg text-rose-400 block">
                    {winRate}%
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action Navigation Strip */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800 font-mono-hud text-xs">
              <button
                type="button"
                onClick={onOpenRules}
                className="btn-stamp-secondary clip-chamfer-btn py-2 px-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-rose-400" />
                <span>Mattel Rules</span>
              </button>

              <button
                type="button"
                onClick={onOpenReferee}
                className="btn-stamp-secondary clip-chamfer-btn py-2 px-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-amber-300 font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Handbook AI</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Join Room by Code HUD Bar */}
      <section className="clip-chamfer p-4 sm:p-5 bg-[#0e0d11] border-l-4 border-l-amber-500 border-y border-r border-neutral-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-[4px_4px_0px_#000]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/40 flex items-center justify-center shrink-0 clip-chamfer-btn">
            <Zap className="w-4 h-4 text-amber-400 stroke-[2.5]" />
          </div>
          <div>
            <div className="font-display font-black text-base tracking-wider uppercase text-white">
              Direct Code Infiltration
            </div>
            <div className="text-[11px] font-mono-hud text-neutral-400">
              Enter room code (e.g. <span className="text-amber-300 font-bold">MERCY-9821</span>) or 4 digits (<span className="text-amber-300 font-bold">9821</span>)
            </div>
          </div>
        </div>

        <form onSubmit={handleJoinByCode} className="flex items-center gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="MERCY-9821"
            className="flex-1 sm:w-48 bg-[#16141a] border border-neutral-700 px-3.5 py-2.5 text-xs font-mono-hud font-bold text-white uppercase placeholder-neutral-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all clip-chamfer-btn tracking-wider"
          />
          <button
            type="submit"
            disabled={!joinCode.trim()}
            className="btn-stamp-slam clip-chamfer-btn px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:pointer-events-none font-display font-black text-sm uppercase tracking-wider text-white transition-all cursor-pointer"
          >
            Deploy
          </button>
        </form>
      </section>

      {/* Active Public Lobbies Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
          <div className="flex items-center gap-2.5">
            <Radio className="w-4 h-4 text-red-500 animate-pulse" />
            <h2 className="font-display font-black text-xl uppercase tracking-wider text-white">
              Active Battle Arenas
            </h2>
            <span className="font-mono-hud text-xs text-neutral-500 font-bold">
              ({lobbies.length})
            </span>
          </div>

          <button
            type="button"
            onClick={fetchLobbies}
            className="btn-stamp-secondary clip-chamfer-btn px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-mono-hud font-bold text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Scan</span>
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-neutral-500 font-mono-hud text-xs tracking-wider">
            SCANNING LOBBY CHANNELS...
          </div>
        ) : lobbies.length === 0 ? (
          <div className="clip-chamfer p-8 sm:p-12 bg-[#0e0d11] border border-neutral-800 text-center space-y-4 shadow-[4px_4px_0px_#000]">
            <Layers className="w-10 h-10 mx-auto text-neutral-600" />
            <div className="space-y-1">
              <h3 className="font-display font-black text-xl uppercase tracking-wider text-white">
                No Combat Arenas Detected
              </h3>
              <p className="text-xs text-neutral-400 font-sans max-w-md mx-auto">
                No open lobbies available right now. Launch your own arena and send the room code to friends or battle ruthless AI bots!
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="btn-stamp-slam clip-chamfer-btn px-6 py-2.5 bg-red-600 hover:bg-red-500 font-display font-black text-base uppercase tracking-wider text-white cursor-pointer"
            >
              Establish Arena
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lobbies.map((lobby) => (
              <div
                key={lobby.roomId}
                className="clip-chamfer p-5 bg-[#0f0e13] border border-neutral-800 hover:border-red-600/70 transition-colors flex flex-col justify-between space-y-4 shadow-[4px_4px_0px_#000]"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={(e) => copyRoomId(e, lobby.roomId)}
                      className="flex items-center gap-1.5 px-2 py-0.5 bg-[#18161f] hover:bg-[#201e29] border border-neutral-700 font-mono-hud text-[11px] text-amber-300 font-bold transition-all cursor-pointer clip-chamfer-btn"
                      title="Click to copy room code"
                    >
                      {copiedRoomId === lobby.roomId ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-300">COPIED</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-neutral-400" />
                          <span>{lobby.roomId}</span>
                        </>
                      )}
                    </button>
                    <span className="font-mono-hud text-[11px] font-bold px-2 py-0.5 bg-neutral-900 text-neutral-300 border border-neutral-800">
                      {lobby.playerCount}/{lobby.maxPlayers} PLAYERS
                    </span>
                  </div>

                  <h3 className="font-display font-black text-lg tracking-wide uppercase text-white truncate">
                    {lobby.roomName}
                  </h3>

                  <div className="flex flex-wrap gap-1 font-mono-hud text-[10px]">
                    <span className="px-1.5 py-0.5 bg-red-950 text-red-300 border border-red-800 font-bold">
                      KO: {lobby.rules.mercyLimit || 'OFF'}
                    </span>
                    <span className="px-1.5 py-0.5 bg-neutral-900 text-neutral-300 border border-neutral-800">
                      {lobby.rules.allowStacking ? 'STACK ON' : 'NO STACK'}
                    </span>
                    {lobby.rules.allow7Swap && (
                      <span className="px-1.5 py-0.5 bg-neutral-900 text-neutral-300 border border-neutral-800">
                        7 SWAP
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onJoinLobby(lobby.roomId)}
                  className="btn-stamp-slam clip-chamfer-btn w-full py-2.5 bg-neutral-900 hover:bg-red-600 text-white font-display font-black text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Enter Arena</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create Custom Lobby Modal: Jagged Chamfered Fighting-Game Dialog */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 animate-fadeIn">
          <div className="clip-chamfer-lg bg-[#0e0d12] border-2 border-neutral-700 p-6 sm:p-7 w-full max-w-md shadow-[8px_8px_0px_#000] space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="font-display font-black text-2xl uppercase tracking-wider text-white">
                Deploy Custom Arena
              </h3>
              <span className="font-mono-hud text-[10px] text-red-400 font-bold">
                MATTEL HVW18
              </span>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block font-mono-hud text-[11px] text-neutral-400 font-bold uppercase mb-1">
                  Arena Codename
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  maxLength={30}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full bg-[#16141a] border border-neutral-700 px-3.5 py-2.5 text-xs font-mono-hud text-white focus:outline-none focus:border-red-500 clip-chamfer-btn"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-[#141218] border border-neutral-800 clip-chamfer">
                <div>
                  <span className="font-display font-black text-base uppercase tracking-wide text-white block">
                    Private Combat
                  </span>
                  <span className="text-[10px] font-mono-hud text-neutral-400 block">
                    Access restricted to room code holders
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrivate(!isPrivate)}
                  className={`w-11 h-6 clip-chamfer-btn transition-colors relative flex-shrink-0 cursor-pointer ${
                    isPrivate ? 'bg-red-600' : 'bg-neutral-800'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 bg-white transition-transform ${
                      isPrivate ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="btn-stamp-secondary clip-chamfer-btn px-4 py-2 bg-neutral-900 border border-neutral-700 text-neutral-300 font-mono-hud font-bold text-xs uppercase"
                >
                  Abort
                </button>
                <button
                  type="submit"
                  className="btn-stamp-slam clip-chamfer-btn px-6 py-2 bg-red-600 hover:bg-red-500 font-display font-black text-base uppercase tracking-wider text-white"
                >
                  Launch Arena
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
