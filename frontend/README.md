
# UNO Show 'Em No Mercy

A browser-based, multiplayer UNO variant built with React on the frontend and a WebSocket-powered Node server on the backend. The project adds chaotic house rules, live match flow, bot fill, match awards, chat, taunts, and a Mercy-rule knockout system designed to keep every round tense and unpredictable.

## Overview

UNO Show 'Em No Mercy is designed as a competitive, rule-heavy UNO experience inspired by the spirit of the official No Mercy house rules. It adds a custom rule set that turns a normal card game into a pressure cooker:

- Mercy elimination at 25 cards
- Stacking and escalation for draw penalties
- Swap-heavy 7 and rotate-all 0 actions
- Wild Draw 6 and Wild Draw 10 cards
- Skip Everyone and Discard All abilities
- Jump-in exact-match play
- public/private room creation, reconnecting, and bot fill
- live in-game communication through chat and table taunts
- match history and per-player profile stats

This app is built as a multiplayer local web app prototype and is ideal for casual play sessions, local LAN testing, or demoing rule-heavy UNO mechanics in a polished UI.

## Core Features

### Multiplayer lobbies

- Create public or private rooms
- Join by room code
- Host controls for lobby setup
- Live player list with ready states
- Reconnect session support to return to an active match

### Custom no-mercy rules

The game includes configurable rules such as:

- Mercy limit (default: 25 cards)
- Stacking enabled/disabled
- 7-hand swap toggles
- 0-pass-all hand rotation
- Jump-in exact match rule
- Draw-until-playable option
- Skip Everyone and Discard All cards
- Wild Draw 6 / Wild Draw 10 support
- Wild Color Roulette support
- turn timer configuration
- bot fill and aggression settings

### Live gameplay

- Fast turn progression with WebSocket synchronization
- Card validation for legal plays
- Draw penalty stacking and turn skipping
- Wild color assignment and current color tracking
- Match completion and winner determination
- automatic bot takeover when players disconnect

### Social layer

- live text chat
- system action logs
- table taunts/emotes
- match awards and elimination highlights
- spectator-friendly match summaries

### Player progression

- persistent player profile data in memory
- match history
- wins, losses, UNO calls, mercy eliminations, and peak card counts
- stat tracking for aggressive or survival-oriented play

## Game Rules and Mechanics

The app implements a custom rule-heavy interpretation of UNO. These are the most important mechanics represented in the codebase:

### Mercy rule

If a player reaches or exceeds the configured mercy limit (default 25 cards), they are instantly eliminated. Their cards are discarded, the match continues, and the last remaining player or last surviving human player wins.

### Stacking

When an active penalty exists, players may only play a draw card that matches or exceeds the current penalty value. This creates punishing stacks such as:

- +2 can be played on +2
- +4 can be played on +4 or +2 if allowed by the stack logic
- Wild Draw 6 and Wild Draw 10 can escalate the penalty significantly

The stacking rule is enforced by the deck validation functions in the frontend and the game engine on the backend.

### 7 swap and 0 pass-all

- A 7 triggers a hand swap with the selected target player.
- A 0 rotates every active player's hand in the current turn direction.

### Jump-in

If a player holds an exact color-and-value match to the current discard card, they can play it out of turn.

### Wild and special actions

The deck includes:

- Wild
- Wild Reverse +4
- Wild Draw 6
- Wild Draw 10
- Wild Color Roulette
- Skip Everyone
- Discard All

### Match flow

- Match starts with 7 cards per player
- First non-wild top card is selected
- Turns continue according to current direction
- Game ends when a player empties their hand or when the Mercy rule leaves the field with one survivor

## Tech Stack

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Lucide icons
- Motion and canvas-confetti for visual effects

### Backend

- Node.js
- Express
- WebSocket server (ws)
- TypeScript
- Vite middleware used in development to serve the frontend from the backend app

## Repository Structure

```text
UNO NO MERCY/
├── backend/
│   ├── package.json
│   ├── server.ts
│   ├── tsconfig.json
│   └── server/
│       ├── botEngine.ts
│       ├── gameEngine.ts
│       ├── routes.ts
│       ├── state.ts
│       ├── types.ts
│       └── wsServer.ts
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── metadata.json
│   ├── public/
│   │   └── cards/
│   └── src/
│       ├── App.tsx
│       ├── index.css
│       ├── main.tsx
│       ├── types.ts
│       ├── components/
│       ├── utils/
│       └── ...
├── scripts/
│   └── slice-cards.cjs
├── package.json
└── README.md
```

## Local Development Setup

### Prerequisites

- Node.js 18+
- npm

### Install dependencies

```bash
cd frontend
npm install

cd ../backend
npm install
```

### Run the app in development

Option 1: Start the frontend and backend separately

```bash
cd frontend
npm run dev
```

```bash
cd backend
npm run dev
```

- Frontend usually runs at http://localhost:5173
- Backend API and WebSocket server run at http://localhost:3000

Option 2: Run the backend only

```bash
cd backend
npm run dev
```

This backend starts an Express server and also mounts the frontend Vite middleware in development mode, allowing the UI to be served from the backend during a single-process local run.

## Production Build

### Frontend build

```bash
cd frontend
npm run build
```

### Backend build

```bash
cd backend
npm run build
```

### Start the backend in production

```bash
cd backend
npm run start
```

The backend is configured to serve static assets from its dist folder when NODE_ENV is set to production.

## Environment Variables

The backend reads optional environment variables from a .env file. The important one is:

```env
PORT=3000
```

If you do not provide `PORT`, the server defaults to 3000.

## API Overview

The backend exposes a small set of REST endpoints:

- `GET /api/lobbies` — list public waiting rooms
- `GET /api/active-match/:id` — determine if a user is in an active match
- `GET /api/profile/:id` — fetch profile data
- `POST /api/profile/:id` — save profile data
- `GET /api/history/:id` — fetch match history
- `POST /api/gemini/referee` — rulebook/referee endpoint for game rulings

The real-time game state is synchronized through WebSockets using game events, sync messages, chat logs, taunts, room broadcasts, and turn updates.

## Key Game State Concepts

These are the main state objects driving the app:

- `Card` — a card with color, value, and optional chosen wild color
- `Player` — contains cards, name, avatar, readiness, elimination status, and bot metadata
- `LobbyRules` — configurable rule set for a room
- `GameState` — room, players, discard pile, current color, timer, logs, and turn data
- `ChatMessage` — chat payload sent through the live room
- `TableTaunt` — in-match emote/taunt event

## Notable Files

### Frontend

- `frontend/src/App.tsx` — root app state, websocket connection, profile sync, and screen management
- `frontend/src/components/GameBoard.tsx` — interactive board and hand gameplay UI
- `frontend/src/components/LobbyList.tsx` — room list and lobby creation flow
- `frontend/src/components/LobbyRoom.tsx` — lobby room and player management
- `frontend/src/components/RulebookModal.tsx` — rules and match guidance UI
- `frontend/src/utils/unoDeck.ts` — card generation, validation, and rule helpers

### Backend

- `backend/server.ts` — Express app startup and WebSocket bootstrapping
- `backend/server/wsServer.ts` — live socket event handling, room joins, reconnects, and dispatching actions
- `backend/server/gameEngine.ts` — rules engine, turn advancement, penalties, wins, and elimination logic
- `backend/server/state.ts` — in-memory game, profile, and socket state management
- `backend/server/routes.ts` — REST API endpoints and referee-driven rule responses

## Development Notes

- The app stores most state in memory, so restarts clear room and profile state.
- Match and profile data are not persisted to a database by default.
- The backend uses in-memory maps for games, sockets, and match histories.
- Bot takeover logic is included for disconnect recovery and empty-slot fill behavior.

## Suggested Improvements

If you want to extend the project further, good next steps are:

- add a real database and persistent match history
- implement a proper authentication flow
- add mobile-first polish and responsive multiplayer tuning
- add sound and animation configuration settings
- add a complete tournament or ranking system
- add gameplay replays and analytics

## License

This project is intended for local development and game prototype use. If you plan to publish or redistribute it, add a formal license file before sharing it externally.

## Summary

UNO Show 'Em No Mercy is a fast, chaotic, multiplayer UNO web app with custom rule-heavy gameplay, strong visual feedback, live room management, and a backend designed for real-time turn-based play. It is a great fit for local multiplayer demos, rule experimentation, and casino-like competitive table play in a browser.
