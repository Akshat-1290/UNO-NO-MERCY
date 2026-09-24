import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, GameEventLog } from '../../../shared/src/types';
import {
  Send,
  MessageSquare,
  Flame,
  ScrollText,
  Activity,
  Layers,
  RotateCcw,
  Skull,
  Zap,
} from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  currentUserId: string;
  isGameActive?: boolean;
  gameLogs?: GameEventLog[];
}

const QUICK_SHOUTS = [
  'SHOW NO MERCY! 💀',
  'STACK IT! 🔥',
  'DON’T DARE! 😱',
  'UNO! 📢',
  'SWAP HANDS! 🔄',
  'NICE TRY! 😈',
  'GG! 👑',
];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  currentUserId,
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'logs'>('chat');
  const [inputText, setInputText] = useState('');
  const [showQuickShouts, setShowQuickShouts] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'penalties' | 'plays'>('all');

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const logsScrollRef = useRef<HTMLDivElement>(null);

  // Split messages into real user chat vs system/action live logs
  const userChatMessages = messages.filter((m) => !m.isSystem && !m.isAction);
  const liveLogs = messages.filter((m) => m.isSystem || m.isAction);

  const scrollToChatBottom = () => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  };

  const scrollToLogsBottom = () => {
    if (logsScrollRef.current) {
      logsScrollRef.current.scrollTop = logsScrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToChatBottom();
    }
  }, [userChatMessages.length, activeTab]);

  useEffect(() => {
    if (activeTab === 'logs') {
      scrollToLogsBottom();
    }
  }, [liveLogs.length, activeTab]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleQuickShout = (shout: string) => {
    onSendMessage(shout);
    setShowQuickShouts(false);
  };

  // Filtered live logs based on selected filter pill
  const filteredLogs = liveLogs.filter((log) => {
    if (logFilter === 'all') return true;
    const textLower = log.text.toLowerCase();
    if (logFilter === 'penalties') {
      return (
        textLower.includes('stack') ||
        textLower.includes('penalty') ||
        textLower.includes('+') ||
        textLower.includes('mercy') ||
        textLower.includes('eliminated') ||
        textLower.includes('draw')
      );
    }
    if (logFilter === 'plays') {
      return (
        textLower.includes('played') ||
        textLower.includes('swapped') ||
        textLower.includes('passed') ||
        textLower.includes('uno')
      );
    }
    return true;
  });

  const getLogIcon = (text: string) => {
    const textLower = text.toLowerCase();
    if (
      textLower.includes('mercy') ||
      textLower.includes('eliminated') ||
      textLower.includes('knocked out')
    ) {
      return <Skull className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />;
    }
    if (
      textLower.includes('stack') ||
      textLower.includes('+10') ||
      textLower.includes('+6') ||
      textLower.includes('+4') ||
      textLower.includes('+2')
    ) {
      return <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />;
    }
    if (textLower.includes('swap') || textLower.includes('pass')) {
      return <RotateCcw className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />;
    }
    if (textLower.includes('uno')) {
      return <Zap className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />;
    }
    return <Layers className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />;
  };

  return (
    <div className="flex flex-col h-full bg-[#0e0d12] border-2 border-neutral-800 clip-chamfer-lg shadow-[4px_4px_0px_#000] overflow-hidden">
      {/* Header with Navigation Tabs */}
      <div className="px-3 py-2 border-b-2 border-neutral-800 bg-[#121017] flex items-center justify-between gap-2 font-mono-hud">
        {/* Fight Game Tab Switcher */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`btn-stamp-secondary clip-chamfer-btn flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold transition-all cursor-pointer uppercase ${
              activeTab === 'chat'
                ? 'bg-red-600 text-white border-red-500 shadow-[2px_2px_0px_#000]'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border-neutral-700'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
            {userChatMessages.length > 0 && (
              <span
                className={`text-[9px] px-1 py-0.2 font-black ${
                  activeTab === 'chat' ? 'bg-black/40 text-white' : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                {userChatMessages.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`btn-stamp-secondary clip-chamfer-btn flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold transition-all cursor-pointer uppercase ${
              activeTab === 'logs'
                ? 'bg-red-600 text-white border-red-500 shadow-[2px_2px_0px_#000]'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border-neutral-700'
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" />
            <span>Combat Feed</span>
            {liveLogs.length > 0 && (
              <span
                className={`text-[9px] px-1 py-0.2 font-black ${
                  activeTab === 'logs' ? 'bg-black/40 text-white' : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                {liveLogs.length}
              </span>
            )}
          </button>
        </div>

        {/* Quick Shouts Action (Only in Chat tab) */}
        {activeTab === 'chat' && (
          <button
            type="button"
            onClick={() => setShowQuickShouts(!showQuickShouts)}
            className="btn-stamp-secondary clip-chamfer-btn text-[10px] flex items-center space-x-1 px-2.5 py-1.5 bg-[#1a1722] hover:bg-[#252230] text-amber-300 border border-amber-500/40 font-bold transition-colors cursor-pointer uppercase"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Shouts</span>
          </button>
        )}

        {/* Filter Chips (Only in Logs tab) */}
        {activeTab === 'logs' && (
          <div className="flex items-center space-x-1 text-[10px]">
            <button
              type="button"
              onClick={() => setLogFilter('all')}
              className={`px-2 py-1 clip-chamfer-btn font-bold transition-colors cursor-pointer uppercase ${
                logFilter === 'all'
                  ? 'bg-neutral-700 text-white'
                  : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setLogFilter('penalties')}
              className={`px-2 py-1 clip-chamfer-btn font-bold transition-colors cursor-pointer uppercase ${
                logFilter === 'penalties'
                  ? 'bg-red-950 text-red-300 border border-red-700'
                  : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Penalties
            </button>
            <button
              type="button"
              onClick={() => setLogFilter('plays')}
              className={`px-2 py-1 clip-chamfer-btn font-bold transition-colors cursor-pointer uppercase ${
                logFilter === 'plays'
                  ? 'bg-sky-950 text-sky-300 border border-sky-700'
                  : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Plays
            </button>
          </div>
        )}
      </div>

      {/* Quick shouts popover */}
      {activeTab === 'chat' && showQuickShouts && (
        <div className="p-2 border-b border-neutral-800 bg-[#14121a] flex flex-wrap gap-1.5 animate-fadeIn font-mono-hud">
          {QUICK_SHOUTS.map((shout) => (
            <button
              key={shout}
              type="button"
              onClick={() => handleQuickShout(shout)}
              className="btn-stamp-secondary clip-chamfer-btn text-[10px] font-bold px-2.5 py-1 bg-[#1a1724] hover:bg-red-950 hover:border-red-500 border border-neutral-700 text-neutral-200 transition-colors cursor-pointer"
            >
              {shout}
            </button>
          ))}
        </div>
      )}

      {/* TAB 1: Chat Messages Tab */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col min-h-0 font-mono-hud">
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
            {userChatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-500 text-center px-4 py-8 space-y-2">
                <div className="w-10 h-10 clip-chamfer-btn bg-[#18161f] border border-neutral-700 flex items-center justify-center text-red-400">
                  <MessageSquare className="w-5 h-5 stroke-[2]" />
                </div>
                <p className="font-display font-black text-sm uppercase text-white tracking-wider">
                  No Table Transmissions
                </p>
                <p className="text-[10px] text-neutral-400 font-sans max-w-[200px]">
                  Send a battle taunt or fire off a quick shout to intimidate your rivals!
                </p>
              </div>
            ) : (
              userChatMessages.map((msg) => {
                const isMe = msg.senderId === currentUserId;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1 text-[10px]">
                      <span>{msg.senderAvatar || '👤'}</span>
                      <span className="font-bold text-neutral-400 uppercase">
                        {isMe ? 'YOU' : msg.senderName}
                      </span>
                      <span className="text-[9px] text-neutral-600">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div
                      className={`px-3.5 py-2 clip-chamfer max-w-[85%] break-words font-sans text-xs leading-relaxed shadow-[2px_2px_0px_#000] ${
                        isMe
                          ? 'bg-red-600 text-white font-medium border border-red-500'
                          : 'bg-[#181622] text-neutral-100 border border-neutral-700'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Input Area */}
          <form
            onSubmit={handleSubmit}
            className="p-2.5 border-t-2 border-neutral-800 bg-[#121017]"
          >
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Transmit battle message..."
                maxLength={180}
                className="flex-1 bg-[#1a1724] border border-neutral-700 px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 clip-chamfer-btn font-mono-hud"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="btn-stamp-slam clip-chamfer-btn p-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white transition-all cursor-pointer"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: Live Turn & Game Event Logs Tab */}
      {activeTab === 'logs' && (
        <div className="flex-1 flex flex-col min-h-0 font-mono-hud">
          <div ref={logsScrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
            {filteredLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-500 text-center px-4 py-8 space-y-2">
                <div className="w-10 h-10 clip-chamfer-btn bg-[#18161f] border border-neutral-700 flex items-center justify-center text-amber-400">
                  <Activity className="w-5 h-5 stroke-[2]" />
                </div>
                <p className="font-display font-black text-sm uppercase text-white tracking-wider">
                  Feed Idle
                </p>
                <p className="text-[10px] text-neutral-400 font-sans max-w-[220px]">
                  Turn actions, penalty stacks, swaps, and 25-card eliminations will log live here.
                </p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isMercy =
                  log.text.toLowerCase().includes('mercy') ||
                  log.text.toLowerCase().includes('eliminated');
                const isStack =
                  log.text.toLowerCase().includes('stack') ||
                  log.text.toLowerCase().includes('penalty');

                return (
                  <div
                    key={log.id}
                    className={`p-2.5 clip-chamfer border flex items-start space-x-2 transition-colors ${
                      isMercy
                        ? 'bg-red-950/70 border-red-700 text-red-200'
                        : isStack
                        ? 'bg-amber-950/60 border-amber-700 text-amber-200'
                        : 'bg-[#141219] border-neutral-800 text-neutral-300'
                    }`}
                  >
                    {getLogIcon(log.text)}
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] leading-snug font-medium break-words">
                        {log.text}
                      </div>
                      <div className="text-[9px] text-neutral-500 mt-0.5 font-mono-hud">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-3 py-1.5 border-t border-neutral-800 bg-[#121017] flex items-center justify-between text-[10px] text-neutral-500 font-mono-hud">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 animate-pulse" />
              <span>LIVE COMBAT STREAM</span>
            </span>
            <span>{filteredLogs.length} LOGS</span>
          </div>
        </div>
      )}
    </div>
  );
};
