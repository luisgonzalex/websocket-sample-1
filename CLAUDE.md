# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A real-time WebSocket message board with two distinct client views:
- **Screen view** (`/screen.html`): Large display optimized for laptops/monitors - shows all messages
- **Controller view** (`/controller.html`): Mobile-optimized input interface for sending messages

The server broadcasts all messages to all connected clients in real-time.

## Running the Application

```bash
# Install dependencies
npm install

# Start server (binds to 0.0.0.0:3000 for LAN access)
npm start
```

**Access points:**
- Local: `http://localhost:3000`
- LAN: `http://<laptop-ip>:3000` (find IP with `ifconfig` on macOS/Linux or `ipconfig` on Windows)
- Index: `/` or `/index.html` (links to both views)
- Screen: `/screen.html` (display view)
- Controller: `/controller.html` (input view)

## Architecture

### Server Architecture (server.js)

**Stack:** Node.js + Express + ws library (not Socket.IO)

**Core components:**
- Express serves static files from `/public`
- WebSocket server attached to HTTP server
- `clients` Set tracks all active connections
- `broadcast()` function sends messages to all connected clients

**Message flow:**
1. Client sends JSON message over WebSocket
2. Server receives, optionally adds timestamp
3. Server broadcasts to all clients (including sender)

### Client Architecture

Both views share the same core WebSocket client pattern but have different UIs.

**Common patterns:**
- Each browser tab gets a unique `clientId` (stored in `sessionStorage`)
- WebSocket URL constructed via `window.location.host` (works on localhost and LAN)
- Auto-reconnect after 3 seconds on disconnect
- Cleanup on `beforeunload` to prevent ghost connections

**Controller-specific:**
- Username management with edit/display toggle
- Username persists in `localStorage` (key: `messageboardUsername`)
- Messages preview shows last 20 messages
- Sends messages with Enter key or Send button

**Screen-specific:**
- Read-only display, no input
- Auto-scrolls to newest messages
- Large text optimized for distance viewing

### Message Protocol

**Client → Server:**
```json
{
  "type": "message",
  "text": "Hello world",
  "username": "Alice",
  "clientId": "client_1234567890_abc123def",
  "timestamp": 1234567890123
}
```

**Server → Clients:**
- Broadcasts received message to all clients
- May add `timestamp` if not present
- System messages use `type: "system"` (e.g., connection welcome)

**Client-side identification:**
- Messages display `username (you)` when `message.clientId === clientId`
- All usernames shown in single purple color (`#667eea`)
- "(you)" indicator persists even if user changes their name

## Key Design Decisions

**WebSocket cleanup:** Existing connections are cleaned up before creating new ones to prevent memory leaks and connection conflicts on page refresh. Event handlers are nullified before closing to prevent reconnect loops.

**Session vs Local Storage:**
- `clientId`: sessionStorage (unique per tab, clears on tab close)
- `username`: localStorage (persists across sessions)

**Single color scheme:** All usernames use the same purple color for a cleaner, more professional look suitable for a display board context. The "(you)" indicator provides sufficient self-identification.

**LAN access:** Server binds to `0.0.0.0` instead of `localhost` to allow connections from other devices on the same network.
