/**
 * App Logic - Demo Chat Application
 *
 * 🎮 This file is REPLACEABLE - customize it for your specific app.
 *
 * This demo implements a simple chat room where:
 * - Users can set their username
 * - Users can send messages that are broadcast to all
 * - System messages announce when users join/leave
 *
 * To create a different app (game, collaborative tool, etc.):
 * 1. Define your own State interface
 * 2. Implement createInitialState()
 * 3. Implement handleConnect(), handleDisconnect(), handleMessage()
 * 4. Update the message types in types.ts to match your needs
 */

import type {
  AppLogic,
  MessageHelpers,
  MessageContext,
  ClientMessage,
  User,
  ChatMessage,
} from './types.js';

// ============================================================================
// STATE DEFINITION
// ============================================================================

/**
 * Chat application state
 * 🎮 Replace this with your own state structure
 */
interface ChatState {
  users: Map<string, User>;
  messageHistory: ChatMessage[];
}

// ============================================================================
// APP LOGIC IMPLEMENTATION
// ============================================================================

/**
 * Create initial state for the chat app
 */
function createInitialState(): ChatState {
  return {
    users: new Map(),
    messageHistory: [],
  };
}

/**
 * Handle new client connection
 */
function handleConnect(
  state: ChatState,
  clientId: string,
  helpers: MessageHelpers
): void {
  // Create user with default username
  const user: User = {
    clientId,
    username: 'Anonymous',
    connectedAt: Date.now(),
  };

  state.users.set(clientId, user);

  // Send welcome message to the new client
  helpers.sendTo(clientId, {
    type: 'welcome',
    payload: { clientId },
  });

  console.log(`[AppLogic] User ${clientId} connected (${state.users.size} total users)`);
}

/**
 * Handle client disconnection
 */
function handleDisconnect(
  state: ChatState,
  clientId: string,
  helpers: MessageHelpers
): void {
  const user = state.users.get(clientId);

  if (user) {
    // Notify others that user left
    helpers.broadcastAll({
      type: 'userLeft',
      payload: { username: user.username },
    });

    state.users.delete(clientId);
    console.log(`[AppLogic] User ${user.username} (${clientId}) disconnected`);
  }
}

/**
 * Handle incoming messages from clients
 */
function handleMessage(state: ChatState, context: MessageContext): void {
  const { clientId, message, helpers } = context;
  const user = state.users.get(clientId);

  if (!user) {
    console.warn(`[AppLogic] Received message from unknown client: ${clientId}`);
    return;
  }

  // Route message based on type
  switch (message.type) {
    case 'setUsername':
      handleSetUsername(state, clientId, message, helpers);
      break;

    case 'sendMessage':
      handleSendMessage(state, clientId, message, helpers);
      break;

    default:
      console.warn(`[AppLogic] Unknown message type from ${clientId}:`, message);
      helpers.sendTo(clientId, {
        type: 'error',
        payload: { message: 'Unknown message type' },
      });
  }
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

/**
 * Handle username change
 */
function handleSetUsername(
  state: ChatState,
  clientId: string,
  message: Extract<ClientMessage, { type: 'setUsername' }>,
  helpers: MessageHelpers
): void {
  const user = state.users.get(clientId);
  if (!user) return;

  const newUsername = message.payload.username.trim() || 'Anonymous';
  const oldUsername = user.username;

  // Update username
  user.username = newUsername;

  console.log(`[AppLogic] User ${clientId} changed name: ${oldUsername} → ${newUsername}`);

  // Notify all clients that user joined (or changed name)
  if (oldUsername === 'Anonymous' && newUsername !== 'Anonymous') {
    helpers.broadcastAll({
      type: 'userJoined',
      payload: { username: newUsername },
    });
  }
}

/**
 * Handle chat message
 */
function handleSendMessage(
  state: ChatState,
  clientId: string,
  message: Extract<ClientMessage, { type: 'sendMessage' }>,
  helpers: MessageHelpers
): void {
  const user = state.users.get(clientId);
  if (!user) return;

  const text = message.payload.text.trim();

  // Validate message
  if (!text) {
    helpers.sendTo(clientId, {
      type: 'error',
      payload: { message: 'Message cannot be empty' },
    });
    return;
  }

  if (text.length > 500) {
    helpers.sendTo(clientId, {
      type: 'error',
      payload: { message: 'Message too long (max 500 characters)' },
    });
    return;
  }

  // Create chat message
  const chatMessage: ChatMessage = {
    username: user.username,
    text,
    timestamp: Date.now(),
    clientId,
  };

  // Add to history
  state.messageHistory.push(chatMessage);

  // Keep only last 100 messages
  if (state.messageHistory.length > 100) {
    state.messageHistory.shift();
  }

  console.log(`[AppLogic] ${user.username}: ${text}`);

  // Broadcast to all clients
  helpers.broadcastAll({
    type: 'chatMessage',
    payload: chatMessage,
  });
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Export the app logic implementation
 *
 * 🎮 Replace this entire export with your own game/app logic
 */
export const chatAppLogic: AppLogic<ChatState> = {
  createInitialState,
  handleConnect,
  handleDisconnect,
  handleMessage,
};
