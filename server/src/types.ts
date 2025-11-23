/**
 * Shared TypeScript types for WebSocket messages
 *
 * These types define the contract between client and server.
 * Keep these in sync with client/src/types.ts
 */

// ============================================================================
// CLIENT → SERVER MESSAGES
// ============================================================================

export type ClientMessage =
  | { type: 'setUsername'; payload: { username: string } }
  | { type: 'sendMessage'; payload: { text: string } };

// ============================================================================
// SERVER → CLIENT MESSAGES
// ============================================================================

export type ServerMessage =
  | { type: 'welcome'; payload: { clientId: string } }
  | { type: 'userJoined'; payload: { username: string } }
  | { type: 'userLeft'; payload: { username: string } }
  | { type: 'chatMessage'; payload: ChatMessage }
  | { type: 'systemMessage'; payload: { text: string } }
  | { type: 'error'; payload: { message: string } };

// ============================================================================
// DATA STRUCTURES
// ============================================================================

export interface ChatMessage {
  username: string;
  text: string;
  timestamp: number;
  clientId: string;
}

export interface User {
  clientId: string;
  username: string;
  connectedAt: number;
}

// ============================================================================
// APP LOGIC INTERFACE
// ============================================================================

/**
 * Helper functions provided to app logic for sending messages
 */
export interface MessageHelpers {
  /** Send a message to all connected clients */
  broadcastAll: (message: ServerMessage) => void;

  /** Send a message to a specific client */
  sendTo: (clientId: string, message: ServerMessage) => void;

  /** Broadcast to all clients except one */
  broadcastExcept: (excludeClientId: string, message: ServerMessage) => void;
}

/**
 * Context passed to message handler
 */
export interface MessageContext {
  clientId: string;
  message: ClientMessage;
  helpers: MessageHelpers;
}

/**
 * Interface that app logic must implement
 *
 * 🎮 CUSTOMIZATION POINT: Implement this interface in appLogic.ts
 */
export interface AppLogic<State = any> {
  /** Create the initial state for your app */
  createInitialState: () => State;

  /** Called when a client connects */
  handleConnect: (state: State, clientId: string, helpers: MessageHelpers) => void;

  /** Called when a client disconnects */
  handleDisconnect: (state: State, clientId: string, helpers: MessageHelpers) => void;

  /** Called when a client sends a message */
  handleMessage: (state: State, context: MessageContext) => void;
}
