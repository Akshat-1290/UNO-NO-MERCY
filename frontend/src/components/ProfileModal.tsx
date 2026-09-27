import React, { useState, useEffect } from 'react';
import { UserProfile, MatchRecord } from '@uno/shared/types';
import { X, User, Trophy, Skull, Flame, Shield, History, Check, Swords } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
}

const AVATAR_OPTIONS = ['🔥', '⚡', '💀', '👑', '🃏', '🎯', '🐉', '🌪️', '🦊', '🐺', '⚔️', '🩸', '🚀', '🥊'];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdateProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'history'>('profile');
  const [name, setName] = useState(profile.name);
  const [selectedAvatar, setSelectedAvatar] = useState(profile.avatar);
  const [history, setHistory] = useState<MatchRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(profile.name);
      setSelectedAvatar(profile.avatar);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === 'history') {
      setLoadingHistory(true);
      fetch(`${API_BASE_URL}/api/history/${profile.id}`)
        .then((res) => res.json())
        .then((data) => {
          setHistory(data);
          setLoadingHistory(false);
        })
        .catch(() => setLoadingHistory(false));
    }
  }, [isOpen, activeTab, profile.id]);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateProfile({ name: name.trim() || 'Player', avatar: selectedAvatar });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const winRate = profile.gamesPlayed > 0 ? Math.round((profile.wins / profile.gamesPlayed) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/85 animate-fadeIn">
      <div className="clip-chamfer-lg bg-[#0e0d12] border-2 border-neutral-700 w-full max-w-2xl max-h-[88vh] flex flex-col shadow-[8px_8px_0px_#000] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-neutral-800 bg-[#121017]">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 bg-[#18161f] border-2 border-neutral-700 flex items-center justify-center text-2xl clip-chamfer-btn flex-shrink-0">
              {profile.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-black text-2xl uppercase tracking-wider text-white">
                  {profile.name}
                </h2>
                <span className="font-mono-hud text-[10px] font-bold px-2 py-0.5 bg-red-950 text-red-300 border border-red-800 uppercase tracking-wide">
                  {profile.title || 'MERCY CONTENDER'}
                </span>
              </div>
              <p className="font-mono-hud text-[11px] text-neutral-400">COMBATANT DOSSIER & MATCH LOGS</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-stamp-secondary clip-chamfer-btn p-2 text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800 px-6 bg-[#0a090e] font-mono-hud text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-3 font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer uppercase ${
              activeTab === 'profile'
                ? 'border-red-500 text-red-400 bg-red-950/20'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <User className="w-3.5 h-3.5" /> Identity & Combat Stats
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 px-3 font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer uppercase ${
              activeTab === 'history'
                ? 'border-red-500 text-red-400 bg-red-950/20'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Match History ({history.length})
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs font-mono-hud">
          {activeTab === 'profile' ? (
            <>
              {/* Profile Editor */}
              <div className="p-5 bg-[#14121a] border border-neutral-800 clip-chamfer space-y-4">
                <h3 className="font-display font-black text-white text-base tracking-wider uppercase flex items-center gap-2">
                  <Swords className="w-4 h-4 text-red-500" /> Modify Combat Identity
                </h3>
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1 font-bold uppercase">Combatant Nickname</label>
                    <input
                      type="text"
                      value={name}
                      maxLength={18}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#1b1822] border border-neutral-700 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-red-500 clip-chamfer-btn font-bold tracking-wider"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-2 font-bold uppercase">Choose Battle Crest</label>
                    <div className="flex flex-wrap gap-2">
                      {AVATAR_OPTIONS.map((av) => (
                        <button
                          key={av}
                          type="button"
                          onClick={() => setSelectedAvatar(av)}
                          className={`w-10 h-10 clip-chamfer-btn flex items-center justify-center text-lg transition-transform cursor-pointer ${
                            selectedAvatar === av
                              ? 'bg-red-600 border-2 border-amber-300 scale-105 shadow-[2px_2px_0px_#000]'
                              : 'bg-neutral-900 border border-neutral-700 hover:border-neutral-500 text-neutral-300'
                          }`}
                        >
                          {av}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      className="btn-stamp-slam clip-chamfer-btn px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-display font-black text-sm uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                    >
                      {saveSuccess ? (
                        <>
                          <Check className="w-4 h-4" /> Identity Verified!
                        </>
                      ) : (
                        'Save Identity'
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats Bento Grid */}
              <div>
                <h3 className="font-display font-black text-white text-base tracking-wider uppercase mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" /> Lifetime Battle Record
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono-hud">
                  <div className="p-3.5 bg-[#14121a] border border-neutral-800 clip-chamfer flex flex-col justify-between">
                    <div className="flex items-center justify-between text-neutral-400 mb-2">
                      <span className="text-[10px] uppercase font-bold">Total Matches</span>
                      <Shield className="w-3.5 h-3.5 text-sky-400" />
                    </div>
                    <span className="text-2xl font-black text-white">{profile.gamesPlayed}</span>
                  </div>

                  <div className="p-3.5 bg-[#14121a] border border-neutral-800 clip-chamfer flex flex-col justify-between">
                    <div className="flex items-center justify-between text-neutral-400 mb-2">
                      <span className="text-[10px] uppercase font-bold">Victories</span>
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-amber-400">{profile.wins}</span>
                      <span className="text-[10px] text-neutral-500 font-bold">({winRate}%)</span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-[#1c1214] border border-red-900/60 clip-chamfer flex flex-col justify-between">
                    <div className="flex items-center justify-between text-red-400 mb-2">
                      <span className="text-[10px] uppercase font-bold">Mercy Dealt</span>
                      <Skull className="w-3.5 h-3.5 text-red-500" />
                    </div>
                    <span className="text-2xl font-black text-red-400">{profile.mercyEliminationsDealt || 0}</span>
                  </div>

                  <div className="p-3.5 bg-[#14121a] border border-neutral-800 clip-chamfer flex flex-col justify-between">
                    <div className="flex items-center justify-between text-neutral-400 mb-2">
                      <span className="text-[10px] uppercase font-bold">Mercy Suffered</span>
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                    </div>
                    <span className="text-2xl font-black text-neutral-300">
                      {profile.mercyEliminationsSuffered || 0}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* History Tab */
            <div className="space-y-3 font-mono-hud">
              {loadingHistory ? (
                <div className="py-12 text-center text-neutral-500 uppercase tracking-widest text-xs">Loading combat logs...</div>
              ) : history.length === 0 ? (
                <div className="py-12 text-center text-neutral-500 space-y-2 clip-chamfer bg-[#14121a] border border-neutral-800 p-8">
                  <History className="w-8 h-8 mx-auto text-neutral-600" />
                  <p className="font-display font-black text-lg text-white uppercase">No Match Records Found</p>
                  <p className="text-xs text-neutral-400">Complete matches in arenas to log combat data!</p>
                </div>
              ) : (
                history.map((record) => (
                  <div
                    key={record.id}
                    className="p-4 bg-[#14121a] border border-neutral-800 clip-chamfer flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-neutral-700 transition-colors shadow-[2px_2px_0px_#000]"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 clip-chamfer-btn ${
                            record.userResult === 'won'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : record.userResult === 'eliminated'
                              ? 'bg-red-950 text-red-400 border border-red-800'
                              : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                          }`}
                        >
                          {record.userResult === 'won'
                            ? 'VICTORY'
                            : record.userResult === 'eliminated'
                            ? 'MERCY KNOCKOUT'
                            : 'DEFEAT'}
                        </span>
                        <span className="font-display font-black text-white text-sm uppercase">{record.roomName}</span>
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        Winner: <span className="text-neutral-200 font-bold">{record.winnerName}</span> (
                        {record.winReason}) &bull; {record.playersCount} players &bull; {record.durationSeconds}s
                      </p>
                      <p className="text-[10px] text-neutral-500 font-mono-hud">{record.rulesSummary}</p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-[10px] text-neutral-500 block">
                        {new Date(record.date).toLocaleDateString()} {new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[11px] text-neutral-400 font-medium">
                        Cards Left: <strong className="text-white">{record.finalCardCount}</strong>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t-2 border-neutral-800 bg-[#121017] flex justify-end font-mono-hud">
          <button
            type="button"
            onClick={onClose}
            className="btn-stamp-secondary clip-chamfer-btn px-6 py-2 bg-neutral-900 border border-neutral-700 font-bold text-xs uppercase text-white hover:text-red-400 transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
