import React from 'react';
import { Card, CardColor, ChatMessage, GameState, Player } from '@uno/shared/types';
import { ChatPanel } from '../ChatPanel';
import { KillcamHighlight } from '../KillcamHighlight';
import { MatchAwardsPodium } from '../MatchAwardsPodium';
import { LogOut, MessageSquare, Shuffle, Trophy, X } from 'lucide-react';

interface GameBoardModalsProps {
  gameState: GameState;
  currentUserId: string;
  opponents: Player[];
  showChatDrawer: boolean;
  setShowChatDrawer: (val: boolean) => void;
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
  selectedWildCard: Card | null;
  setSelectedWildCard: (card: Card | null) => void;
  onChooseColor: (color: CardColor) => void;
  selected7Card: Card | null;
  setSelected7Card: (card: Card | null) => void;
  onChooseSwapTarget: (targetId: string) => void;
  onPlay7WithoutSwap: () => void;
  dismissedKillcamId: string | null;
  setDismissedKillcamId: (id: string | null) => void;
  showLeaveConfirm: boolean;
  setShowLeaveConfirm: (val: boolean) => void;
  onReturnToLobby?: () => void;
  onRestartGame: () => void;
  onLeaveGame: () => void;
}

export const GameBoardModals: React.FC<GameBoardModalsProps> = ({
  gameState,
  currentUserId,
  opponents,
  showChatDrawer,
  setShowChatDrawer,
  chatMessages,
  onSendMessage,
  selectedWildCard,
  setSelectedWildCard,
  onChooseColor,
  selected7Card,
  setSelected7Card,
  onChooseSwapTarget,
  onPlay7WithoutSwap,
  dismissedKillcamId,
  setDismissedKillcamId,
  showLeaveConfirm,
  setShowLeaveConfirm,
  onReturnToLobby,
  onRestartGame,
  onLeaveGame,
}) => {
  return (
    <>
      {/* Floating In-Game Chat Drawer Modal */}
      {showChatDrawer && (
        <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-[200] w-80 sm:w-96 max-w-[92vw] h-[70vh] sm:h-[75vh] flex flex-col clip-chamfer-lg bg-[#0e0d12] border-2 border-neutral-700 shadow-[6px_6px_0px_#000] overflow-hidden animate-fadeIn">
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#141219] border-b-2 border-neutral-800 font-mono-hud">
            <div className="flex items-center space-x-2 text-xs font-bold text-white">
              <MessageSquare className="w-4 h-4 text-red-500" />
              <span className="uppercase">Combat Transmissions</span>
            </div>
            <button
              type="button"
              onClick={() => setShowChatDrawer(false)}
              className="btn-stamp-secondary clip-chamfer-btn p-1 text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden p-2">
            <ChatPanel
              messages={chatMessages}
              onSendMessage={onSendMessage}
              currentUserId={currentUserId}
              isGameActive
            />
          </div>
        </div>
      )}

      {/* Wild Color Selection Modal */}
      {selectedWildCard && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="clip-chamfer-lg bg-[#0e0d12] border-2 border-neutral-700 p-5 sm:p-6 w-full max-w-sm text-center shadow-[8px_8px_0px_#000] space-y-4">
            <div className="space-y-1">
              <h3 className="font-display font-black text-xl uppercase tracking-wider text-white">
                Choose Wild Color
              </h3>
              <p className="font-mono-hud text-[11px] text-neutral-400">
                Designate the active combat color to continue play:
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1 font-mono-hud">
              {[
                { color: 'red', label: 'Red', bg: 'bg-red-600 hover:bg-red-500 text-white border-red-400' },
                { color: 'blue', label: 'Blue', bg: 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400' },
                { color: 'green', label: 'Green', bg: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400' },
                { color: 'yellow', label: 'Yellow', bg: 'bg-amber-400 hover:bg-amber-300 text-black border-yellow-200' },
              ].map((c) => (
                <button
                  key={c.color}
                  type="button"
                  onClick={() => onChooseColor(c.color as CardColor)}
                  className={`btn-stamp-slam clip-chamfer-btn p-3 font-display font-black text-sm uppercase tracking-wider border shadow-[3px_3px_0px_#000] cursor-pointer ${c.bg}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSelectedWildCard(null)}
              className="btn-stamp-secondary clip-chamfer-btn w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white font-mono-hud font-bold text-xs border border-neutral-700 transition-colors cursor-pointer uppercase"
            >
              Cancel (Pick a Different Card)
            </button>
          </div>
        </div>
      )}

      {/* 7s Hand Swap Modal (Mandatory or Optional based on Lobby Rules) */}
      {selected7Card && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="clip-chamfer-lg bg-[#0e0d12] border-2 border-amber-500/80 p-5 sm:p-6 w-full max-w-md text-center shadow-[8px_8px_0px_#000] space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-1.5">
                <span
                  className={`font-mono-hud text-[10px] font-black px-2.5 py-0.5 border uppercase tracking-wider ${
                    gameState.rules.allow7Swap
                      ? 'bg-amber-950 text-amber-300 border-amber-700'
                      : 'bg-neutral-900 text-neutral-300 border-neutral-700'
                  }`}
                >
                  {gameState.rules.allow7Swap
                    ? 'MATTEL HVW18 MANDATORY RULE'
                    : 'CUSTOM RULE: OPTIONAL SWAP'}
                </span>
              </div>
              <h3 className="font-display font-black text-2xl uppercase tracking-wider text-amber-400 flex items-center justify-center gap-2">
                <Shuffle className="w-5 h-5" />{' '}
                {gameState.rules.allow7Swap ? '7s Mandatory Hand Swap' : '7s Hand Swap (Optional)'}
              </h3>
              <p className="font-mono-hud text-xs text-neutral-300 leading-normal">
                {gameState.rules.allow7Swap
                  ? 'Playing a 7 forces you to exchange your entire hand with a chosen contender:'
                  : 'Choose a contender to swap hands with, or play without swapping and keep your hand:'}
              </p>
            </div>

            <div className="space-y-2 pt-1 max-h-60 overflow-y-auto font-mono-hud">
              {opponents
                .filter((p) => !p.isEliminated)
                .map((target) => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => onChooseSwapTarget(target.id)}
                    className="btn-stamp-secondary clip-chamfer-btn w-full p-3 bg-[#141219] hover:bg-amber-950/60 border border-neutral-800 hover:border-amber-500 flex items-center justify-between text-xs font-bold text-white transition-all cursor-pointer shadow-[2px_2px_0px_#000]"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="text-xl">{target.avatar}</span>
                      <span className="font-display font-black text-sm uppercase">{target.name}</span>
                    </div>
                    <span className="text-amber-400 font-black px-2 py-0.5 bg-black/50 border border-amber-500/40">
                      SWAP HAND ({target.cards.length} CARDS)
                    </span>
                  </button>
                ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-neutral-800">
              {!gameState.rules.allow7Swap && (
                <button
                  type="button"
                  onClick={onPlay7WithoutSwap}
                  className="btn-stamp-slam clip-chamfer-btn w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-display font-black text-sm uppercase tracking-wider border-2 border-emerald-400 shadow-[3px_3px_0px_#000] cursor-pointer transition-all"
                >
                  🃏 Play Without Swapping (Keep Hand)
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelected7Card(null)}
                className="btn-stamp-secondary clip-chamfer-btn w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white font-mono-hud font-bold text-xs border border-neutral-700 transition-colors cursor-pointer uppercase"
              >
                Cancel (Pick a Different Card)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Elimination Highlight / Killcam Banner */}
      {gameState.lastElimination && gameState.lastElimination.victimId === currentUserId && (
        <KillcamHighlight
          highlight={
            gameState.lastElimination?.id === dismissedKillcamId
              ? undefined
              : gameState.lastElimination
          }
          onDismiss={() => {
            if (gameState.lastElimination?.id) {
              setDismissedKillcamId(gameState.lastElimination.id);
            }
          }}
        />
      )}

      {/* Non-intrusive Toast for other active players when someone is knocked out */}
      {gameState.lastElimination &&
        gameState.lastElimination.victimId !== currentUserId &&
        gameState.lastElimination.id !== dismissedKillcamId && (
          <div className="fixed top-3 inset-x-0 z-40 flex justify-center pointer-events-none px-4 animate-fadeIn font-mono-hud">
            <div className="bg-red-950/95 border-2 border-red-600 text-white px-4 py-1.5 clip-chamfer shadow-[4px_4px_0px_#000] text-xs font-black flex items-center space-x-2">
              <span>💀</span>
              <span className="uppercase">
                {gameState.lastElimination.victimName} knocked out by Mercy limit!
              </span>
              <span className="text-[10px] text-red-300 font-normal">
                ({gameState.lastElimination.cardCount} cards)
              </span>
            </div>
          </div>
        )}

      {/* Game Over Modal */}
      {gameState.status === 'ended' && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-fadeIn font-mono-hud">
          <div className="clip-chamfer-lg bg-[#0e0d12] border-2 border-amber-500 p-6 sm:p-8 w-full max-w-lg text-center shadow-[10px_10px_0px_#000] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="w-16 h-16 clip-chamfer-btn bg-amber-500/20 border-2 border-amber-400 text-amber-400 flex items-center justify-center mx-auto text-3xl shadow-[3px_3px_0px_#000]">
              <Trophy className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-wider">
                {gameState.winnerId === currentUserId ? 'VICTORY SECURED!' : 'MATCH CONCLUDED'}
              </h2>
              <p className="text-xs text-neutral-400 font-sans">
                {gameState.winnerReason === 'mercy_eliminations'
                  ? 'Last survivor standing through brutal 25-Card Mercy eliminations!'
                  : 'Successfully cleared all cards from hand!'}
              </p>
            </div>

            <div className="p-4 clip-chamfer bg-[#141219] border border-neutral-800 flex items-center justify-between text-left shadow-[2px_2px_0px_#000]">
              <div>
                <span className="text-[10px] text-amber-400 uppercase font-black tracking-widest block">
                  ARENA CHAMPION
                </span>
                <span className="font-display font-black text-xl text-white uppercase">
                  {gameState.players.find((p) => p.id === gameState.winnerId)?.name}
                </span>
              </div>
              <span className="text-3xl">
                {gameState.players.find((p) => p.id === gameState.winnerId)?.avatar}
              </span>
            </div>

            {/* Match Highlights & Awards Podium */}
            <MatchAwardsPodium awards={gameState.awards} />

            {/* Host Controls vs Contender Waiting Actions */}
            {gameState.hostId === currentUserId ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                {onReturnToLobby && (
                  <button
                    type="button"
                    onClick={onReturnToLobby}
                    className="btn-stamp-secondary clip-chamfer-btn w-full sm:flex-1 py-3 px-3 bg-amber-400 hover:bg-amber-300 text-black font-display font-black text-sm uppercase tracking-wider cursor-pointer"
                  >
                    Return to Lobby
                  </button>
                )}
                <button
                  type="button"
                  onClick={onRestartGame}
                  className="btn-stamp-slam clip-chamfer-btn w-full sm:flex-1 py-3 px-3 bg-red-600 hover:bg-red-500 text-white font-display font-black text-sm uppercase tracking-wider cursor-pointer"
                >
                  Instant Rematch
                </button>
                <button
                  type="button"
                  onClick={onLeaveGame}
                  className="btn-stamp-secondary clip-chamfer-btn w-full sm:w-auto py-3 px-4 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white font-mono-hud font-bold text-xs border border-neutral-700 cursor-pointer uppercase"
                >
                  Exit
                </button>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="p-3 clip-chamfer bg-[#16131c] border border-amber-500/40 text-center space-y-1">
                  <div className="flex items-center justify-center space-x-2 text-amber-400 font-bold text-xs uppercase font-mono-hud">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>Waiting for Host</span>
                  </div>
                  <p className="text-[11px] text-neutral-300 font-mono-hud">
                    Waiting for the host to launch a rematch or return the room to lobby...
                  </p>
                </div>
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={onLeaveGame}
                    className="btn-stamp-secondary clip-chamfer-btn w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white font-mono-hud font-bold text-xs border border-neutral-700 cursor-pointer uppercase"
                  >
                    Exit Arena
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leave Match Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn font-mono-hud">
          <div className="w-full max-w-sm clip-chamfer-lg bg-[#0e0d12] border-2 border-red-600 p-5 sm:p-6 shadow-[8px_8px_0px_#000] flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 clip-chamfer-btn bg-red-950 border border-red-600 flex items-center justify-center">
              <LogOut className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="font-display font-black text-2xl uppercase tracking-wide text-white">
              Retreat from Arena?
            </h3>
            <p className="text-xs text-neutral-400 font-sans leading-relaxed">
              Are you sure you want to retreat? A bot will take over your cards so other contenders
              can continue the battle smoothly.
            </p>
            <div className="flex items-center space-x-2.5 w-full pt-2">
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="btn-stamp-secondary clip-chamfer-btn flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-bold border border-neutral-700 transition-colors cursor-pointer uppercase"
              >
                Stay & Fight
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLeaveConfirm(false);
                  onLeaveGame();
                }}
                className="btn-stamp-slam clip-chamfer-btn flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-display font-black uppercase tracking-wider cursor-pointer"
              >
                Retreat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
