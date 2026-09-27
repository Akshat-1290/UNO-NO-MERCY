import React, { useState, useRef, useEffect } from 'react';
import { GameState, Card } from '@uno/shared/types';
import {
  X,
  ShieldCheck,
  Flame,
  RotateCcw,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  Search,
  Sparkles,
} from 'lucide-react';

interface HandbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState?: GameState | null;
  myCards?: Card[];
}

export type GeminiRefereeModalProps = HandbookModalProps;

interface ChatHistoryItem {
  sender: 'user' | 'model';
  text: string;
  category?: string;
}

// Official Mattel HVW18 Handbook Q&A repository
interface HandbookRule {
  keywords: string[];
  question: string;
  shortRuling: string;
  fullRule: string;
  category: string;
}

const OFFICIAL_HANDBOOK_ENTRIES: HandbookRule[] = [
  {
    keywords: ['downgrade', 'lower', '2 on', '+2 on', '+4', 'stack +2'],
    question: 'Can I stack a +2 on an active +4 stack to downgrade it?',
    shortRuling: 'NO. Downgrading is strictly illegal.',
    fullRule:
      "📖 NO MERCY HANDBOOK (§ Stacking Rules):\nNO, you CANNOT downgrade a stack! Under official Show 'Em No Mercy rules, you may ONLY play a card of EQUAL OR HIGHER penalty value (+2 ≤ +4 ≤ Wild Reverse +4 ≤ Wild +6 ≤ Wild +10). A +2 cannot be played on top of a +4, +6, or +10. If you cannot match or exceed the penalty, you must draw the full accumulated sum!",
    category: 'Stacking Rules',
  },
  {
    keywords: ['stack', '+6', 'wild 6', '+4', 'counter', 'accumulate'],
    question: 'Can I stack a Wild Draw 6 on a regular Draw 4?',
    shortRuling: 'YES. Higher penalty passes total to the next player.',
    fullRule:
      "📖 NO MERCY HANDBOOK (§ Stacking Rules):\nYES, absolutely! A Wild Draw 6 is higher than a Draw 4, making it a legal stack. The penalty accumulates: 4 + 6 = 10 cards! The next player in turn order must either play another +6 or a +10, or draw all 10 cards!",
    category: 'Stacking Rules',
  },
  {
    keywords: ['mercy', '25', 'eliminate', 'eliminated', 'knockout', 'knock out', 'too many cards'],
    question: 'What is the 25-card Mercy Rule and when does it trigger?',
    shortRuling: 'Instant knockout at 25 or more cards in hand.',
    fullRule:
      "📖 NO MERCY HANDBOOK (§ Mercy Rule):\nIf at ANY point during the game a player holds 25 OR MORE cards in their hand, they are INSTANTLY ELIMINATED from the game! Their entire hand is discarded into the discard pile, and surviving players continue battling. A game is won either by emptying your hand or being the last survivor standing!",
    category: 'Mercy Rule',
  },
  {
    keywords: ['7', 'swap', 'trade', 'refuse', 'decline', 'block swap'],
    question: 'What happens when a 7 is played? Can the opponent refuse to swap?',
    shortRuling: 'MANDATORY swap. Opponents cannot refuse.',
    fullRule:
      "📖 NO MERCY HANDBOOK (§ 7s Swap):\nWhen a '7' card is played, that player MUST swap their entire hand with another player of their choice. The swap is MANDATORY — the targeted opponent CANNOT refuse, block, or reverse the swap! This is one of the deadliest tactics to offload a huge hand near the 25-card limit.",
    category: 'Special Cards',
  },
  {
    keywords: ['0', 'pass', 'direction', 'rotate hand', 'pass hands'],
    question: 'How does the 0 card work when played?',
    shortRuling: 'Everyone passes their hand in the current direction of play.',
    fullRule:
      "📖 NO MERCY HANDBOOK (§ 0s Pass):\nWhen a '0' card is played, ALL players must pass their entire hand to the next player in the current direction of play (clockwise or counter-clockwise if reversed). Hands shift simultaneously!",
    category: 'Special Cards',
  },
  {
    keywords: ['jump', 'jump in', 'out of turn', 'interrupt'],
    question: 'How does Jump-In work in No Mercy?',
    shortRuling: 'Exact match (same color AND same symbol/number) can jump in.',
    fullRule:
      "📖 NO MERCY HANDBOOK (§ Jump-In Rule):\nIf you have a card that is an EXACT MATCH (identical color AND identical number/action) to the top discard card, you can play it immediately out of turn! Play then resumes from you, skipping anyone in between.",
    category: 'Turn Rules',
  },
  {
    keywords: ['wild reverse +4', 'reverse draw 4', 'direction change'],
    question: 'What does Wild Reverse Draw 4 do?',
    shortRuling: 'Reverses direction AND adds +4 penalty.',
    fullRule:
      "📖 NO MERCY HANDBOOK (§ Wild Reverse Draw 4):\nThis card reverses the current direction of play AND adds 4 cards to the penalty stack! The player who just took their turn before you is now on the hook to match or stack the penalty.",
    category: 'Special Cards',
  },
  {
    keywords: ['skip everyone', 'skip all', 'extra turn'],
    question: 'What does Skip Everyone do?',
    shortRuling: 'Skips all other players, giving you an immediate extra turn.',
    fullRule:
      "📖 NO MERCY HANDBOOK (§ Skip Everyone):\nPlaying 'Skip Everyone' immediately skips all other players at the table. Play returns directly back to you for another turn!",
    category: 'Special Cards',
  },
  {
    keywords: ['color roulette', 'roulette', 'wild color roulette'],
    question: 'How does Wild Color Roulette work?',
    shortRuling: 'Next player reveals cards until matching chosen color.',
    fullRule:
      "📖 NO MERCY HANDBOOK (§ Wild Color Roulette):\nThe player who plays this chooses a color. The next player must continuously draw from the draw pile until they reveal a card of that chosen color, adding ALL drawn cards to their hand!",
    category: 'Special Cards',
  },
  {
    keywords: ['uno', 'call uno', 'shout', 'forget uno', 'one card'],
    question: 'When do I have to call UNO, and what is the penalty?',
    shortRuling: 'Call UNO with 1 card left. Penalty is drawing 2 cards.',
    fullRule:
      "📖 NO MERCY HANDBOOK (§ Calling UNO):\nWhen playing your second-to-last card so you only have 1 card remaining, you must immediately call 'UNO!' before the next player begins their turn. If caught by another player failing to call UNO, you must draw 2 penalty cards.",
    category: 'Turn Flow',
  },
  {
    keywords: ['tactics', 'strategy', 'analyze', 'advice', 'hand', 'play', 'merciless'],
    question: 'Analyze my current hand and give me the most merciless play!',
    shortRuling: 'Save 7s to dump large hands; stack +6/+10 to knock opponents out.',
    fullRule:
      "🔥 OFFICIAL TACTICAL HANDBOOK GUIDELINES:\n1. Target High Hands: Watch opponents with 15+ cards. A +6 or +10 stack will force them past the 25-card Mercy limit for an instant knockout.\n2. Save Your 7s: If you hold 15-20 cards, hold onto a 7! Playing it allows you to swap your hand with the player with the lowest cards.\n3. Stack Counter Defense: Never waste your highest draw cards early; keep at least one +4 or +6 to defend against incoming penalty stacks.\n4. Discard All Timing: Accumulate cards of one color, then play Discard All to empty your hand in a single move.",
    category: 'Battle Tactics',
  },
];

export const HandbookModal: React.FC<HandbookModalProps> = ({
  isOpen,
  onClose,
  gameState,
  myCards,
}) => {
  const [messages, setMessages] = useState<ChatHistoryItem[]>([
    {
      sender: 'model',
      text: "👋 Welcome! I am your Official No Mercy Handbook Answerer.\n\n📖 Fast Rule Lookup & Conflict Resolver\nI answer questions about stacking penalties (+2, +4, +6, +10), 25-card Mercy eliminations, 7/0 hand trades, and jump-ins straight from the official Mattel Show 'Em No Mercy rulebook.\n\nTap any quick question below or type your question:",
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [role, setRole] = useState<'handbook' | 'tactics'>('handbook');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!isOpen) return null;

  const resolveHandbookAnswer = (query: string): string => {
    const q = query.toLowerCase().trim();

    // Specific match from curated entries
    for (const entry of OFFICIAL_HANDBOOK_ENTRIES) {
      if (entry.keywords.some((k) => q.includes(k))) {
        return entry.fullRule;
      }
    }

    // Role-based answer if no direct keyword match
    if (role === 'tactics') {
      return (
        "🔥 NO MERCY HANDBOOK STRATEGY GUIDE:\n" +
        "1. Never downgrade (+2 cannot counter a +4, +6, or +10).\n" +
        "2. If an opponent holds 15+ cards, stack +6 or +10 to push them past 25 for an instant Mercy knockout!\n" +
        "3. Hold your '7' cards as an escape hatch to offload big hands to an opponent."
      );
    }

    return (
      "📖 NO MERCY HANDBOOK SUMMARY:\n" +
      "• Stacking: Equal or higher penalty draw cards (+2 ≤ +4 ≤ +6 ≤ +10) pass the accumulated sum forward.\n" +
      "• Mercy Rule: 25 cards in hand triggers immediate knockout.\n" +
      "• 7s Swap: Mandatory hand swap with any chosen player.\n" +
      "• 0s Pass: All players pass hands in current play direction.\n" +
      "• Jump-In: Exact match in color AND number/symbol can be played out of turn."
    );
  };

  const handleSend = (questionText?: string) => {
    const textToSend = (questionText || inputText).trim();
    if (!textToSend) return;

    const ruling = resolveHandbookAnswer(textToSend);

    setMessages((prev) => [
      ...prev,
      { sender: 'user', text: textToSend },
      { sender: 'model', text: ruling },
    ]);
    setInputText('');
  };

  const clearChat = () => {
    setMessages([
      {
        sender: 'model',
        text: 'Handbook guide reset. Select a question below or search any rule!',
      },
    ]);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/85 animate-fadeIn">
      <div className="clip-chamfer-lg bg-[#0e0d12] border-2 border-neutral-700 w-full max-w-2xl h-[88vh] flex flex-col shadow-[8px_8px_0px_#000] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-neutral-800 bg-[#121017]">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 text-white clip-chamfer-btn flex-shrink-0 shadow-[2px_2px_0px_#000]">
              <Sparkles className="w-5 h-5 text-amber-200 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-black text-2xl uppercase tracking-wider text-white">
                  Handbook AI Referee
                </h2>
                <span className="font-mono-hud text-[10px] font-black px-2 py-0.5 bg-neutral-900 text-amber-300 border border-neutral-700 flex items-center gap-1 clip-chamfer-btn">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                  MATTEL HVW18
                </span>
              </div>
              <p className="font-mono-hud text-[11px] text-neutral-400">
                OFFICIAL RULE CLARIFICATIONS & ARBITRATION
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 font-mono-hud">
            <button
              type="button"
              onClick={clearChat}
              title="Reset Conversation"
              className="btn-stamp-secondary clip-chamfer-btn p-2 text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-stamp-secondary clip-chamfer-btn p-2 text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-2.5 bg-[#0a090e] border-b border-neutral-800 font-mono-hud text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRole('handbook')}
              className={`btn-stamp-secondary clip-chamfer-btn px-3 py-1.5 font-bold transition-all flex items-center gap-1.5 cursor-pointer uppercase ${
                role === 'handbook'
                  ? 'bg-red-600 text-white border-red-500'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border-neutral-700'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Rule Handbook
            </button>
            <button
              type="button"
              onClick={() => setRole('tactics')}
              className={`btn-stamp-secondary clip-chamfer-btn px-3 py-1.5 font-bold transition-all flex items-center gap-1.5 cursor-pointer uppercase ${
                role === 'tactics'
                  ? 'bg-amber-600 text-white border-amber-500'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border-neutral-700'
              }`}
            >
              <Flame className="w-3.5 h-3.5" /> Strategy Tips
            </button>
          </div>

          <div className="text-[10px] text-neutral-400 font-mono-hud flex items-center gap-1 uppercase">
            <HelpCircle className="w-3 h-3 text-amber-400" />
            <span>Show 'Em No Mercy Codex</span>
          </div>
        </div>

        {/* Scrollable Conversation Thread */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-mono-hud leading-relaxed">
          {messages.map((item, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${item.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {item.sender === 'model' && (
                <div className="w-8 h-8 clip-chamfer-btn bg-[#18161f] border border-neutral-700 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <BookOpen className="w-4 h-4" />
                </div>
              )}

              <div
                className={`p-4 clip-chamfer max-w-[85%] whitespace-pre-wrap leading-relaxed shadow-[2px_2px_0px_#000] ${
                  item.sender === 'user'
                    ? 'bg-red-600 text-white border border-red-500'
                    : 'bg-[#14121a] border border-neutral-800 text-neutral-200'
                }`}
              >
                {item.text}
                {item.sender === 'model' && idx > 0 && (
                  <div className="mt-2 pt-2 border-t border-neutral-800 flex items-center gap-1.5 text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Official Rule Reference</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Preset Handbook Question Chips */}
        <div className="px-6 py-2.5 bg-[#0d0c11] border-t border-neutral-800 flex gap-2 overflow-x-auto scrollbar-minimal font-mono-hud">
          {OFFICIAL_HANDBOOK_ENTRIES.map((entry, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSend(entry.question)}
              className="btn-stamp-secondary clip-chamfer-btn text-[10px] font-bold px-3 py-1.5 bg-[#17151e] hover:bg-[#201e29] text-neutral-300 hover:text-white whitespace-nowrap border border-neutral-700 transition-colors flex-shrink-0 flex items-center gap-1.5 cursor-pointer uppercase"
            >
              <span className="w-1.5 h-1.5 bg-amber-400 flex-shrink-0" />
              <span>{entry.question}</span>
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-4 border-t-2 border-neutral-800 bg-[#121017] font-mono-hud"
        >
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Search rules (e.g. 'Can I stack +2 on +4?', '25 mercy rule', '7 swap', '0 pass')..."
              className="flex-1 bg-[#1b1822] border border-neutral-700 px-4 py-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 transition-all clip-chamfer-btn font-mono-hud"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="btn-stamp-slam clip-chamfer-btn px-5 py-2.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 disabled:opacity-40 text-white font-display font-black text-sm uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Query</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const GeminiRefereeModal = HandbookModal;
