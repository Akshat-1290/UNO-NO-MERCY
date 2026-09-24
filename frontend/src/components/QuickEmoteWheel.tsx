import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Smile, X } from 'lucide-react';

interface QuickEmoteWheelProps {
  onSendEmote: (emote: string) => void;
  disabled?: boolean;
}

const TAUNT_OPTIONS = [
  { id: 'nomercy', label: 'No Mercy!', emoji: '💀', color: 'hover:bg-rose-950/80 hover:border-rose-500 text-rose-300' },
  { id: 'havemercy', label: 'Have Mercy!', emoji: '🙏', color: 'hover:bg-amber-950/80 hover:border-amber-500 text-amber-300' },
  { id: 'draw10', label: '+10 Incoming!', emoji: '🔥', color: 'hover:bg-orange-950/80 hover:border-orange-500 text-orange-300' },
  { id: 'uno', label: 'UNO!', emoji: '📢', color: 'hover:bg-yellow-950/80 hover:border-yellow-500 text-yellow-300' },
  { id: 'sweating', label: 'Sweating...', emoji: '😰', color: 'hover:bg-blue-950/80 hover:border-blue-500 text-blue-300' },
  { id: 'popcorn', label: 'Popcorn', emoji: '🍿', color: 'hover:bg-purple-950/80 hover:border-purple-500 text-purple-300' },
  { id: 'tears', label: 'Salty Tears', emoji: '😭', color: 'hover:bg-cyan-950/80 hover:border-cyan-500 text-cyan-300' },
  { id: 'crymore', label: 'Cry More!', emoji: '😈', color: 'hover:bg-red-950/80 hover:border-red-500 text-red-300' },
  { id: 'wrecked', label: 'GET WRECKED', emoji: '💥', color: 'hover:bg-rose-900/80 hover:border-rose-400 text-rose-200' },
  { id: 'gg', label: 'Well Played', emoji: '👏', color: 'hover:bg-emerald-950/80 hover:border-emerald-500 text-emerald-300' },
];

export const QuickEmoteWheel: React.FC<QuickEmoteWheelProps> = ({ onSendEmote, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [activeClickId, setActiveClickId] = useState<string | null>(null);

  const handleSelect = (id: string, emoji: string, label: string) => {
    const fullText = `${emoji} ${label}`;
    onSendEmote(fullText);
    setLastSent(emoji);
    setActiveClickId(id);
    setTimeout(() => setActiveClickId(null), 300);
    setTimeout(() => setLastSent(null), 1500);
  };

  return (
    <div className="relative">
      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border font-bold text-xs shadow-lg transition-all cursor-pointer ${
          isOpen
            ? 'bg-rose-600 border-rose-400 text-white ring-2 ring-rose-500/50'
            : 'bg-neutral-900/90 hover:bg-neutral-800 border-neutral-700 hover:border-rose-500 text-neutral-200 hover:text-white backdrop-blur-md'
        }`}
        title="Send Table Taunt / Emote"
      >
        <span className="text-base">{lastSent || '💬'}</span>
        <span className="hidden sm:inline">Taunts</span>
      </button>

      {/* Radial / Popover Emote Tray - Portaled directly into body to stay on top of all cards & modals */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3 pointer-events-auto">
            {/* Backdrop dismiss */}
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
              onClick={() => setIsOpen(false)}
            />

            {/* Viewport-Clamped Panel Card */}
            <div className="relative z-10 w-full max-w-[min(340px,calc(100vw-24px))] max-h-[min(420px,calc(100dvh-32px))] flex flex-col p-3.5 rounded-3xl bg-neutral-950 border-2 border-rose-500/80 shadow-[0_0_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl overflow-hidden animate-scaleUp">
              {/* Header - Pinned */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800 shrink-0">
                <span className="text-xs font-black uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                  <Smile className="w-4 h-4 text-rose-400" />
                  Table Taunts & Reactions
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Taunt Grid */}
              <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1 min-h-0 pr-1 scrollbar-minimal">
                {TAUNT_OPTIONS.map((item) => {
                  const isClicked = activeClickId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.id, item.emoji, item.label)}
                      className={`flex items-center space-x-2 px-2.5 py-2 rounded-xl bg-neutral-900/90 border border-neutral-800 transition-all text-left group cursor-pointer active:scale-95 ${
                        isClicked ? 'ring-2 ring-rose-500 bg-rose-950/50 scale-95' : ''
                      } ${item.color}`}
                    >
                      <span className="text-lg group-hover:scale-125 transition-transform shrink-0">
                        {item.emoji}
                      </span>
                      <span className="text-xs font-bold truncate">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Footer - Pinned */}
              <div className="pt-2 mt-2 border-t border-neutral-800/70 flex items-center justify-between text-[11px] text-neutral-400 shrink-0">
                <span className="truncate mr-2">Tap to emote over avatar</span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs cursor-pointer shadow transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default QuickEmoteWheel;
