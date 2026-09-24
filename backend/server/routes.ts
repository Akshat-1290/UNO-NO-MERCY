import { Express, Request, Response } from 'express';
import { games, userProfiles, matchHistories } from './state';

export function registerRoutes(app: Express) {
  app.get('/api/lobbies', (req: Request, res: Response) => {
    const lobbyList = Array.from(games.values())
      .filter((g) => !g.isPrivate && g.status === 'waiting')
      .map((g) => ({
        roomId: g.roomId,
        roomName: g.roomName,
        playerCount: g.players.length,
        maxPlayers: 8,
        rules: g.rules,
      }));
    res.json(lobbyList);
  });

  app.get('/api/active-match/:id', (req: Request, res: Response) => {
    const userId = req.params.id;
    const match = Array.from(games.values()).find(
      (g) =>
        (g.status === 'playing' || g.status === 'paused') &&
        g.players.some((p) => p.id === userId && !p.isEliminated) &&
        g.players.some((p) => !p.isBot && p.id !== userId)
    );

    if (match) {
      res.json({
        active: true,
        roomId: match.roomId,
        roomName: match.roomName,
        status: match.status,
        playerCount: match.players.length,
        pauseReason: match.pauseReason,
      });
    } else {
      res.json({ active: false });
    }
  });

  app.get('/api/profile/:id', (req: Request, res: Response) => {
    const profile = userProfiles.get(req.params.id) || {
      id: req.params.id,
      name: 'Player',
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
    res.json(profile);
  });

  app.post('/api/profile/:id', (req: Request, res: Response) => {
    const existing = userProfiles.get(req.params.id) || {
      id: req.params.id,
      name: 'Player',
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
    const updated = { ...existing, ...req.body };
    userProfiles.set(req.params.id, updated);
    res.json(updated);
  });

  app.get('/api/history/:id', (req: Request, res: Response) => {
    const history = matchHistories.get(req.params.id) || [];
    res.json(history);
  });

  // Gemini Multi-Turn AI Referee & Tactical Advisor
  app.post('/api/gemini/referee', async (req: Request, res: Response) => {
    try {
      const { messages, role = 'referee' } = req.body;
      const latestUserMsg = (messages && messages.length > 0)
        ? messages[messages.length - 1].text.toLowerCase()
        : '';

      const getOfficialRulebookRuling = (query: string): string => {
        if (query.includes('stack') || query.includes('+6') || query.includes('+4') || query.includes('+10') || query.includes('+2')) {
          if (query.includes('2 on') || query.includes('downgrade') || query.includes('lower') || query.includes('less')) {
            return "⚖️ OFFICIAL REFEREE RULING (Mattel HVW18):\nNO, you cannot downgrade a stack! Stacking strictly requires playing an EQUAL or HIGHER penalty card (+2 ≤ +4 ≤ Wild Rev +4 ≤ Wild +6 ≤ Wild +10). A +2 CANNOT be stacked on top of a +4, +6, or +10. If you cannot match or exceed the penalty, you must draw the full accumulated sum!";
          }
          return "⚖️ OFFICIAL REFEREE RULING (Mattel HVW18):\nYES, Stacking is fully permitted with equal or higher cards! You can stack a Wild Draw 6 on a Draw 4, or a Wild Draw 10 on a Draw 6. The total penalty accumulates (e.g. +4 + +6 = +10 cards) and passes forward to the next victim!";
        }

        if (query.includes('7') || query.includes('swap') || query.includes('refuse')) {
          return "⚖️ OFFICIAL REFEREE RULING (Mattel HVW18):\nWhen a '7' card is played, the player MUST swap their entire hand with any chosen opponent. The swap is MANDATORY — an opponent cannot refuse or block the swap! This is one of the deadliest tactics to offload a huge hand near the 25-card Mercy limit.";
        }

        if (query.includes('0') || query.includes('pass all') || query.includes('rotate')) {
          return "⚖️ OFFICIAL REFEREE RULING (Mattel HVW18):\nWhen a '0' card is played, ALL players must simultaneously pass their entire hand to the next player in the current direction of play (clockwise or counter-clockwise). Everyone gets a completely new hand!";
        }

        if (query.includes('roulette') || query.includes('color roulette')) {
          return "⚖️ OFFICIAL REFEREE RULING (Mattel HVW18):\nWild Color Roulette: The person who plays it chooses a color (Red, Blue, Green, or Yellow). The NEXT player must draw cards from the draw pile one by one until they draw a card of that designated color or a Wild card. Every drawn card goes straight into their hand, often causing instant Mercy elimination!";
        }

        if (query.includes('jump') || query.includes('jump-in') || query.includes('out of turn')) {
          return "⚖️ OFFICIAL REFEREE RULING (Mattel HVW18):\nJump-In Rule: If you hold a card that is an EXACT MATCH in both COLOR and VALUE/ACTION to the current top discard card, you may immediately play it out of turn! Play immediately shifts to you, skipping any players between.";
        }

        if (query.includes('mercy') || query.includes('25') || query.includes('eliminate') || query.includes('knock out')) {
          return "⚖️ OFFICIAL REFEREE RULING (Mattel HVW18):\nThe Mercy Rule: If any player holds 25 OR MORE cards in their hand at any point in time, they are instantly ELIMINATED from the game! Their cards are discarded into the pile, and play continues with the survivors.";
        }

        if (query.includes('skip all') || query.includes('skip everyone')) {
          return "⚖️ OFFICIAL REFEREE RULING (Mattel HVW18):\nSkip Everyone: Skips every single other player at the table! The turn returns right back to you immediately, allowing you to play another card.";
        }

        if (query.includes('discard all')) {
          return "⚖️ OFFICIAL REFEREE RULING (Mattel HVW18):\nDiscard All: Discard every card in your hand that matches the color of the Discard All card! A powerful escape card when your hand is filling up.";
        }

        if (query.includes('uno') || query.includes('shout') || query.includes('one card')) {
          return "⚖️ OFFICIAL REFEREE RULING (Mattel HVW18):\nCalling UNO: When you play your second-to-last card leaving only 1 card in your hand, you must immediately shout 'UNO!' before the next player's turn begins. If caught failing to call UNO, you must draw 2 penalty cards.";
        }

        if (role === 'tactician') {
          return "🔥 MERCILESS TACTICAL ADVICE:\n1. Track opponents near 15+ cards: A stacked +6 or +10 will push them over the 25-card Mercy limit for an instant KO!\n2. Save your 7s: If you are forced to draw heavily, save a '7' to swap your swollen hand with the opponent with the fewest cards.\n3. Discard All timing: Hold Discard All until you've accumulated 4+ cards of that color to empty your hand in a single turn.";
        }

        return "⚖️ OFFICIAL REFEREE RULING (Mattel HVW18 UNO Show 'Em No Mercy):\n• Stacking: Equal or higher draw cards (+2, +4, +6, +10) pass the penalty forward.\n• Mercy Limit: 25 cards = instant elimination.\n• 7s Swap: Mandatory hand swap with any chosen player.\n• 0s Pass: All players pass hands in play direction.\n• Skip Everyone: Take another turn immediately.\n• Wild Color Roulette: Next player draws until designated color appears.";
      };

      return res.json({
        reply: getOfficialRulebookRuling(latestUserMsg),
        modelUsed: 'Official Rulebook Handbook (Mattel HVW18)',
      });
    } catch (error: unknown) {
      res.json({
        reply:
          "⚖️ OFFICIAL REFEREE RULING: Under Mattel HVW18 rules: Stacking requires equal or higher draw cards (+2 <= +4 <= +6 <= +10), 25 cards in hand triggers immediate Mercy elimination, 7s swap hands, and 0s rotate all hands!",
        modelUsed: 'Official Rulebook Handbook',
      });
    }
  });
}
