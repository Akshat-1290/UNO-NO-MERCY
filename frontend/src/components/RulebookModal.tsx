import React, { useState } from 'react';
import { X, BookOpen, Skull, Layers, Shuffle, Zap, AlertOctagon, Flame } from 'lucide-react';

interface RulebookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulebookModal: React.FC<RulebookModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'mercy' | 'cards' | 'stacking'>('overview');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/85 animate-fadeIn">
      <div className="clip-chamfer-lg bg-[#0e0d12] border-2 border-neutral-700 w-full max-w-2xl max-h-[88vh] flex flex-col shadow-[8px_8px_0px_#000] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-neutral-800 bg-[#121017]">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 bg-red-950 border border-red-700 text-red-400 clip-chamfer-btn flex-shrink-0">
              <BookOpen className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-black text-2xl uppercase tracking-wider text-white">
                  UNO Show 'Em No Mercy
                </h2>
                <span className="font-mono-hud text-[10px] font-black px-2 py-0.5 bg-red-950 text-red-300 border border-red-800 uppercase tracking-widest">
                  MATTEL HVW18
                </span>
              </div>
              <p className="font-mono-hud text-[11px] text-neutral-400">OFFICIAL CODEX & TACTICAL RULEBOOK</p>
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

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-800 px-6 bg-[#0a090e] gap-2 overflow-x-auto font-mono-hud text-xs">
          {[
            { id: 'overview', label: 'Victory & Draw Rule' },
            { id: 'mercy', label: '25-Card Mercy & Stacking' },
            { id: 'cards', label: 'Lethal Action Cards' },
            { id: 'stacking', label: '7s, 0s & Jump-In' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`py-3 px-3 font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap uppercase ${
                activeTab === tab.id
                  ? 'border-red-500 text-red-400 bg-red-950/20'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs leading-relaxed text-neutral-300 font-sans">
          {activeTab === 'overview' && (
            <div className="space-y-4 font-sans">
              <div className="p-4 bg-[#14121a] border border-neutral-800 clip-chamfer">
                <h3 className="font-display font-black text-base text-red-400 mb-1 flex items-center gap-2 uppercase tracking-wide">
                  <Skull className="w-4 h-4 text-red-500" /> Two Paths to Victory
                </h3>
                <p className="mb-2">
                  1. <strong className="text-white">Hand Depletion:</strong> Be the first player to discard all of your cards.
                </p>
                <p>
                  2. <strong className="text-white">Mercy Elimination:</strong> Knock every opponent out of the match via 25-card overflow until you stand alone!
                </p>
              </div>

              <div className="p-4 bg-[#14121a] border border-neutral-800 clip-chamfer space-y-2">
                <h4 className="font-display font-black text-white text-sm uppercase tracking-wide">
                  Draw Rule: Draw Until You Can Play
                </h4>
                <p>
                  Unlike classic UNO, in UNO No Mercy if you don't hold a playable card, you don't just take one! You must{' '}
                  <strong className="text-amber-300">keep drawing cards from the draw pile one by one until you get a playable card</strong> (or until you cross the 25-card Mercy limit and get eliminated!).
                </p>
              </div>

              <div className="p-4 bg-[#14121a] border border-neutral-800 clip-chamfer space-y-2">
                <h4 className="font-display font-black text-white text-sm uppercase tracking-wide">
                  Shouting "UNO!"
                </h4>
                <p>
                  When you play your second-to-last card and hold only 1 card, you must call <strong className="text-red-400">"UNO!"</strong>. If an opponent catches you before your next play, you must draw a penalty of 2 cards!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'mercy' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#1c1214] border border-red-800/80 clip-chamfer space-y-2">
                <h3 className="font-display font-black text-base text-red-300 flex items-center gap-2 uppercase tracking-wide">
                  <AlertOctagon className="w-4 h-4 text-red-400" /> The 25-Card Mercy Rule
                </h3>
                <p className="text-red-100">
                  If at <em>any point</em> a player ends up with <strong className="text-white">25 or more cards</strong> in their hand, they are shown NO MERCY and are immediately <strong className="text-red-400">eliminated from the game</strong>!
                </p>
                <p className="text-red-300/80 text-[11px] font-mono-hud">
                  Their cards are discarded, and surviving combatants battle to the death.
                </p>
              </div>

              <div className="p-4 bg-[#14121a] border border-neutral-800 clip-chamfer space-y-2">
                <h3 className="font-display font-black text-base text-amber-400 flex items-center gap-2 uppercase tracking-wide">
                  <Layers className="w-4 h-4" /> Penalty Stacking Rules
                </h3>
                <p>
                  Whenever someone plays a Draw penalty card (+2, +4, Wild Rev +4, Wild +6, Wild +10), the next player can <strong className="text-white">pass the pain</strong> by playing an <strong className="text-amber-300">equal or higher</strong> Draw card:
                </p>
                <div className="p-3 bg-[#0d0c11] border border-neutral-700 font-mono-hud text-[11px] text-amber-300 font-bold clip-chamfer-btn">
                  Draw 2 &le; Draw 4 / Rev +4 &le; Wild Draw 6 &le; Wild Draw 10
                </div>
                <p>
                  The penalty accumulates (e.g. +2 &rarr; +4 &rarr; +6 &rarr; +10 = <strong className="text-red-400 font-mono-hud font-bold">22 cards!</strong>). The player who cannot match or exceed must draw the full accumulated sum!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 bg-[#14121a] border border-neutral-800 clip-chamfer">
                <span className="font-display font-black text-red-400 text-sm flex items-center gap-1.5 mb-1 uppercase tracking-wide">
                  <Flame className="w-3.5 h-3.5 text-red-500" /> Wild Draw 10 & Wild Draw 6
                </span>
                <p className="text-[11px] text-neutral-300">
                  Forces the next player to draw 10 or 6 cards and lose their turn, unless they can stack an equal or higher draw card!
                </p>
              </div>

              <div className="p-3.5 bg-[#14121a] border border-neutral-800 clip-chamfer">
                <span className="font-display font-black text-purple-400 text-sm flex items-center gap-1.5 mb-1 uppercase tracking-wide">
                  ⤺ Wild Reverse Draw 4
                </span>
                <p className="text-[11px] text-neutral-300">
                  Instantly reverses the direction of play AND hits the previous player with a +4 penalty (which can be stacked!).
                </p>
              </div>

              <div className="p-3.5 bg-[#14121a] border border-neutral-800 clip-chamfer">
                <span className="font-display font-black text-amber-400 text-sm flex items-center gap-1.5 mb-1 uppercase tracking-wide">
                  ⛔ Skip Everyone
                </span>
                <p className="text-[11px] text-neutral-300">
                  Skips every single other player at the table! The user immediately takes another turn right away!
                </p>
              </div>

              <div className="p-3.5 bg-[#14121a] border border-neutral-800 clip-chamfer">
                <span className="font-display font-black text-cyan-400 text-sm flex items-center gap-1.5 mb-1 uppercase tracking-wide">
                  ▼▼ Discard All
                </span>
                <p className="text-[11px] text-neutral-300">
                  Play this card and discard <strong className="text-white">every card in your hand of the matching color</strong> onto the pile in a single turn!
                </p>
              </div>

              <div className="p-3.5 bg-[#14121a] border border-neutral-800 clip-chamfer md:col-span-2">
                <span className="font-display font-black text-emerald-400 text-sm flex items-center gap-1.5 mb-1 uppercase tracking-wide">
                  🎰 Wild Color Roulette
                </span>
                <p className="text-[11px] text-neutral-300">
                  Choose a designated color. The next victim must draw cards one by one until they draw a card matching that color or a Wild card, plus lose their turn!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'stacking' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#14121a] border border-neutral-800 clip-chamfer space-y-2">
                <h3 className="font-display font-black text-base text-amber-400 flex items-center gap-2 uppercase tracking-wide">
                  <Shuffle className="w-4 h-4" /> 7s Swap & 0s Pass
                </h3>
                <p>
                  <strong className="text-white">Playing a 7:</strong> You MUST choose any opponent at the table and swap your entire hand with theirs! (Mandatory, cannot be blocked).
                </p>
                <p>
                  <strong className="text-white">Playing a 0:</strong> ALL players must simultaneously pass their hands to the next player in the current play direction!
                </p>
              </div>

              <div className="p-4 bg-[#14121a] border border-neutral-800 clip-chamfer space-y-2">
                <h3 className="font-display font-black text-base text-sky-400 flex items-center gap-2 uppercase tracking-wide">
                  <Zap className="w-4 h-4" /> The Jump-In Rule
                </h3>
                <p>
                  If you hold a card that is the <strong className="text-white">EXACT same color and same number/action</strong> as the top discard card, you can play it immediately out of turn! Play continues from you.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t-2 border-neutral-800 bg-[#121017] flex justify-end font-mono-hud">
          <button
            type="button"
            onClick={onClose}
            className="btn-stamp-slam clip-chamfer-btn px-6 py-2.5 bg-red-600 hover:bg-red-500 font-display font-black text-sm uppercase tracking-wider text-white cursor-pointer"
          >
            Show No Mercy!
          </button>
        </div>
      </div>
    </div>
  );
};
