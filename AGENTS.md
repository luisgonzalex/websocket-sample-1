# AGENTS.md

This file provides guidance to AI coding assistants (e.g., ChatGPT, Claude, Copilot, Gemini, etc.) when working with code in this repository.

## Project Overview

**WebSocket Template** - A production-ready template for building real-time WebSocket applications with clear separation between reusable plumbing and pluggable application logic.

**Current Demo:** Simple chat application showing username management and real-time messaging.

**Tech Stack:**
- **Backend:** Fastify + TypeScript + ws library
- **Frontend:** Vite + React + TypeScript
- **Architecture:** Monorepo with npm workspaces

## Running the Application

```bash
# Install all dependencies (root + server + client)
npm install

# Development (need 2 terminals)
npm run dev:server    # Terminal 1: Fastify server on http://0.0.0.0:3000
npm run dev:client    # Terminal 2: Vite dev server on http://0.0.0.0:5173 (LAN-ready)

# Production
npm run build         # Build both server and client
npm start             # Run production server (serves client + WebSocket)

# Type checking
npm run typecheck     # Type-check both packages
```

**Access Points:**
- **Development:**
  - Client: `http://localhost:5173` (Vite dev server; also reachable via LAN IP)
  - Server: `http://localhost:3000` (Fastify + WebSocket)
  - Health check: `http://localhost:3000/health`
- **LAN (phone access):**
  - Find IP: `ifconfig` (Mac/Linux) or `ipconfig` (Windows)
  - Access: `http://<your-ip>:5173` (dev) or `http://<your-ip>:3000` (prod)
  - For dev CORS, set `CLIENT_URL=http://<your-ip>:5173` in `server/.env`

## Architecture

### Design Philosophy: Separation of Concerns

```
┌───────────────────────────────────────────────┐
│         REUSABLE PLUMBING (Don't Touch)       │
│  - WebSocket connection management            │
│  - Message routing & broadcasting             │
│  - Auto-reconnect & cleanup                   │
└───────────────────────────────────────────────┘
                      ↕️
┌───────────────────────────────────────────────┐
│      PLUGGABLE APP LOGIC (Customize Here)     │
│  - Chat, games, collaborative tools, etc.     │
│  - State management                           │
│  - Business rules                             │
└───────────────────────────────────────────────┘
```

### Project Structure

```
websocket-template/
├── server/                      # Fastify + TypeScript backend
│   ├── src/
│   │   ├── index.ts            # 🔧 Fastify server bootstrap (REUSABLE)
│   │   ├── wsServer.ts         # 🔧 WebSocket plumbing (REUSABLE)
│   │   ├── appLogic.ts         # 🎮 Demo chat logic (REPLACE THIS)
│   │   └── types.ts            # 📦 Message types (update per app)
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── client/                      # Vite + React + TypeScript
│   ├── src/
│   │   ├── wsClient.ts         # 🔧 WebSocket client wrapper (REUSABLE)
│   │   ├── App.tsx             # 🎮 Demo chat UI (REPLACE THIS)
│   │   ├── App.css             # 🎮 Demo styles (REPLACE THIS)
│   │   ├── types.ts            # 📦 Message types (update per app)
│   │   └── main.tsx            # React entry point
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── package.json                 # Root workspace config
├── .gitignore
├── README.md                    # User documentation
└── CLAUDE.md                    # This file
```

**Legend:**
- 🔧 **Reusable plumbing** - Generic, framework-like code. Keep for all apps.
- 🎮 **Pluggable logic** - App-specific code. Replace with your game/app.
- 📦 **Shared types** - Update to match your message protocol.

### Server Architecture

#### `server/src/wsServer.ts` - Generic WebSocket Plumbing (REUSABLE)

**Responsibilities:**
- Accept WebSocket connections
- Assign unique `clientId` to each connection
- Track connected clients in `Map<clientId, WebSocket>`
- Parse incoming JSON messages: `{ type: string, payload?: any }`
- Route messages to app logic
- Provide helper functions to app logic

**Helper Functions Provided:**
```typescript
interface MessageHelpers {
  broadcastAll: (message: ServerMessage) => void;
  sendTo: (clientId: string, message: ServerMessage) => void;
  broadcastExcept: (excludeClientId: string, message: ServerMessage) => void;
}
```

**This file should NOT be modified** for different apps. It's generic plumbing.

#### `server/src/appLogic.ts` - App-Specific Logic (REPLACEABLE)

**Interface to Implement:**
```typescript
interface AppLogic<State = any> {
  createInitialState: () => State;
  handleConnect: (state: State, clientId: string, helpers: MessageHelpers) => void;
  handleDisconnect: (state: State, clientId: string, helpers: MessageHelpers) => void;
  handleMessage: (state: State, context: MessageContext) => void;
}
```

**Current Demo:** Simple chat application with:
- User management (username setting)
- Message broadcasting
- Join/leave notifications
- Message validation (length, empty check)

**To Create a Different App:**
1. Define your state structure (e.g., game board, players, etc.)
2. Implement the 4 required methods
3. Update `server/src/types.ts` with your message types
4. Export your logic and import it in `server/src/index.ts`

**Example: Tic-Tac-Toe**
```typescript
interface GameState {
  board: number[];
  players: Map<string, { symbol: 'X' | 'O' }>;
  currentPlayer: string;
}

export const ticTacToeLogic: AppLogic<GameState> = {
  createInitialState: () => ({ board: Array(9).fill(0), ... }),
  handleConnect: (state, clientId, helpers) => { /* add player */ },
  handleMessage: (state, { clientId, message, helpers }) => {
    if (message.type === 'makeMove') { /* handle move */ }
  },
  handleDisconnect: (state, clientId, helpers) => { /* remove player */ }
};
```

#### `server/src/index.ts` - Fastify Server (REUSABLE)

**Responsibilities:**
- Initialize Fastify with logging and CORS
- Attach WebSocket server with app logic
- Serve static client files in production
- Health check endpoint (`/health`)
- Graceful shutdown handling

**Environment Variables:**
- `PORT` (default: 3000)
- `HOST` (default: 0.0.0.0)
- `NODE_ENV` (development | production)
- `CLIENT_URL` (default: http://localhost:5173)

**This file rarely needs modification** unless adding HTTP routes or middleware.

### Client Architecture

#### `client/src/wsClient.ts` - WebSocket Client Wrapper (REUSABLE)

**Responsibilities:**
- Connect to WebSocket server
- Auto-detect protocol (`ws://` vs `wss://`) from `window.location.protocol`
- Auto-detect host from `window.location.host`
- Automatic reconnection with exponential backoff (3s → 6s → 12s → max 30s)
- Queue messages sent before connection is ready
- Type-safe message sending/receiving
- Cleanup on `beforeunload`

**API:**
```typescript
const wsClient = new WSClient({
  url?: string,                    // Optional: defaults to current host
  initialReconnectDelay?: number,  // Default: 3000ms
  maxReconnectDelay?: number,      // Default: 30000ms
  maxReconnectAttempts?: number,   // Default: Infinity
});

wsClient.connect();
wsClient.send(message: ClientMessage);
wsClient.on('open', () => { ... });
wsClient.on('close', () => { ... });
wsClient.on('message', (msg: ServerMessage) => { ... });
wsClient.on('error', (error) => { ... });
wsClient.isConnected(): boolean;
wsClient.disconnect();
```

**This file should NOT be modified** for different apps. It's generic plumbing.

#### `client/src/App.tsx` - React UI (REPLACEABLE)

**Current Demo:** Chat application with:
- Connection status indicator
- Username management (localStorage persistence, edit/display toggle)
- Message list with auto-scroll
- "(you)" indicator for own messages
- System message notifications

**To Create a Different App:**
1. Replace this component with your UI
2. Use `WSClient` to send/receive messages
3. Update `client/src/types.ts` with your message types
4. Keep the WebSocket connection lifecycle pattern

**Key Patterns:**
```typescript
// Initialize client (outside component to persist across re-renders)
const wsClient = new WSClient();

function App() {
  // Setup connection in useEffect
  useEffect(() => {
    wsClient.on('message', handleMessage);
    wsClient.connect();
    return () => wsClient.disconnect();
  }, []);

  // Send messages
  const sendMove = () => {
    wsClient.send({ type: 'makeMove', payload: { position: 4 } });
  };

  // Handle messages
  const handleMessage = (message: ServerMessage) => {
    if (message.type === 'gameState') {
      setGameState(message.payload);
    }
  };
}
```

### Message Protocol

**Type-safe communication** between client and server using discriminated unions.

**Client → Server:**
```typescript
type ClientMessage =
  | { type: 'setUsername'; payload: { username: string } }
  | { type: 'sendMessage'; payload: { text: string } };
```

**Server → Client:**
```typescript
type ServerMessage =
  | { type: 'welcome'; payload: { clientId: string } }
  | { type: 'userJoined'; payload: { username: string } }
  | { type: 'userLeft'; payload: { username: string } }
  | { type: 'chatMessage'; payload: ChatMessage }
  | { type: 'systemMessage'; payload: { text: string } }
  | { type: 'error'; payload: { message: string } };
```

**Important:** Keep `server/src/types.ts` and `client/src/types.ts` in sync!

## Customization Guide

### Creating a New App (e.g., Multiplayer Game)

**Step 1: Define Message Types**

Edit **both** `server/src/types.ts` and `client/src/types.ts`:
```typescript
export type ClientMessage =
  | { type: 'joinGame'; payload: { playerName: string } }
  | { type: 'makeMove'; payload: { row: number; col: number } }
  | { type: 'leaveGame'; payload: {} };

export type ServerMessage =
  | { type: 'gameState'; payload: GameState }
  | { type: 'playerJoined'; payload: { playerName: string } }
  | { type: 'moveMade'; payload: { player: string; row: number; col: number } }
  | { type: 'gameOver'; payload: { winner: string } };
```

**Step 2: Implement Server Logic**

Edit `server/src/appLogic.ts`:
```typescript
interface GameState {
  board: string[][];
  players: Map<string, { name: string; symbol: string }>;
  currentTurn: string;
}

export const myGameLogic: AppLogic<GameState> = {
  createInitialState: () => ({
    board: Array(3).fill(null).map(() => Array(3).fill('')),
    players: new Map(),
    currentTurn: '',
  }),

  handleConnect: (state, clientId, helpers) => {
    // Add player to game
    state.players.set(clientId, { name: 'Player', symbol: 'X' });
    helpers.sendTo(clientId, { type: 'welcome', payload: { clientId } });
  },

  handleMessage: (state, { clientId, message, helpers }) => {
    switch (message.type) {
      case 'makeMove':
        // Validate and apply move
        // Update board
        // Broadcast new state
        helpers.broadcastAll({ type: 'gameState', payload: state });
        break;
    }
  },

  handleDisconnect: (state, clientId, helpers) => {
    state.players.delete(clientId);
  },
};
```

Then update `server/src/index.ts`:
```typescript
import { myGameLogic } from './appLogic.js';
// ...
wsServer = new WSServer(fastify.server, myGameLogic);
```

**Step 3: Build UI**

Replace `client/src/App.tsx` with your game UI:
```typescript
export default function GameApp() {
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    wsClient.on('message', (message) => {
      if (message.type === 'gameState') {
        setGameState(message.payload);
      }
    });
    wsClient.connect();
    return () => wsClient.disconnect();
  }, []);

  const makeMove = (row: number, col: number) => {
    wsClient.send({ type: 'makeMove', payload: { row, col } });
  };

  return <div>{/* Your game UI */}</div>;
}
```

**Step 4: Test**
```bash
npm run typecheck    # Check types are consistent
npm run dev:server   # Start server
npm run dev:client   # Start client
```

## Key Design Patterns

### 1. Client Identification
- Each browser tab gets unique `clientId` from server
- Stored in component state (not localStorage, to support multiple tabs)
- Used for "(you)" indicators and ownership checks

### 2. Message Routing
- Server receives `ClientMessage`, routes to `handleMessage`
- App logic decides how to respond and what to broadcast
- Type-safe discriminated unions prevent invalid message shapes

### 3. State Management
- Server manages authoritative state
- App logic is pure function: `(state, event) => mutations + broadcasts`
- Clients receive state updates via broadcasts

### 4. Connection Resilience
- Auto-reconnect on disconnect (client-side)
- Connection cleanup on page unload
- Message queueing when disconnected

### 5. Type Safety
- Shared types between client and server
- Compile-time checks for message structure
- Runtime parsing with error handling

## Common Modifications

### Adding a New Message Type

1. Add to `ClientMessage` or `ServerMessage` in **both** type files
2. Handle in `appLogic.ts` `handleMessage` switch statement
3. Send from `App.tsx` via `wsClient.send()`
4. Run `npm run typecheck` to verify

### Adding HTTP Endpoints

Edit `server/src/index.ts`:
```typescript
fastify.get('/api/stats', async () => {
  return { players: wsServer.getClientCount() };
});
```

### Adding Persistence

Install database client (e.g., `better-sqlite3`):
```typescript
// In appLogic.ts
import Database from 'better-sqlite3';
const db = new Database('game.db');

handleMessage: (state, context) => {
  // Save move to database
  db.prepare('INSERT INTO moves ...').run(...);
}
```

### Using Rooms/Channels

Modify `wsServer.ts` to track rooms:
```typescript
private rooms: Map<string, Set<string>> = new Map();

// Add methods:
broadcastToRoom(roomId: string, message: ServerMessage) { ... }
```

## Production Considerations

**Security:**
- Add authentication (JWT, session cookies)
- Validate all incoming messages
- Rate limit connections and messages
- Sanitize user input

**Performance:**
- Consider Redis for multi-server deployments
- Add message compression for large payloads
- Implement pagination for message history

**Monitoring:**
- Add structured logging (pino)
- Track metrics (active connections, messages/sec)
- Error reporting (Sentry)

**Deployment:**
- Use `NODE_ENV=production`
- Reverse proxy (nginx) for SSL/TLS
- Process manager (PM2, systemd)
- Health checks and graceful shutdown

## Troubleshooting

**Types out of sync:**
- Update **both** `server/src/types.ts` and `client/src/types.ts`
- Run `npm run typecheck` to catch mismatches

**WebSocket connection fails:**
- Check server is running: `curl http://localhost:3000/health`
- Verify WebSocket URL in browser console
- Check for CORS issues (dev only)

**Auto-reconnect not working:**
- Check `beforeunload` cleanup isn't interfering
- Verify `maxReconnectAttempts` not exceeded
- Check browser console for errors

**Messages not received:**
- Verify message type is in `ServerMessage` union
- Check `handleMessage` has case for message type
- Confirm `broadcastAll` or `sendTo` is called

## Further Reading

- **Fastify Docs:** https://www.fastify.io/docs/latest/
- **Vite Docs:** https://vitejs.dev/guide/
- **React Docs:** https://react.dev/learn
- **WebSocket MDN:** https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/handbook/intro.html
