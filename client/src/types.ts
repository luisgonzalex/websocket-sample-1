/**
 * Shared TypeScript types for WebSocket messages
 *
 * These types mirror server/src/types.ts
 * Keep these in sync with the server types!
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

// ============================================================================
// UI STATE
// ============================================================================

export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error: string | null;
}
