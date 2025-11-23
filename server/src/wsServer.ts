/**
 * WebSocket Server - Reusable Plumbing
 *
 * 🔧 This file is REUSABLE across different apps.
 * It handles WebSocket connection management, message routing, and provides
 * helper functions to app logic without coupling to specific business logic.
 *
 * DO NOT modify this file for app-specific logic.
 * Instead, implement your logic in appLogic.ts
 */

import { WebSocket, WebSocketServer } from 'ws';
import type { Server as HTTPServer } from 'http';
import type {
  ClientMessage,
  ServerMessage,
  AppLogic,
  MessageHelpers,
  MessageContext,
} from './types.js';

/**
 * Generate a unique client ID
 */
function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * WebSocket Server Manager
 *
 * Manages WebSocket connections and routes messages to app logic
 */
export class WSServer<State = any> {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocket> = new Map();
  private appLogic: AppLogic<State>;
  private state: State;

  constructor(httpServer: HTTPServer, appLogic: AppLogic<State>) {
    this.wss = new WebSocketServer({ server: httpServer });
    this.appLogic = appLogic;
    this.state = appLogic.createInitialState();

    this.setupWebSocketServer();
  }

  /**
   * Setup WebSocket server event handlers
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = generateClientId();
      this.clients.set(clientId, ws);

      console.log(`[WSServer] Client connected: ${clientId} (total: ${this.clients.size})`);

      // Setup client-specific event handlers
      this.setupClientHandlers(ws, clientId);

      // Notify app logic of new connection
      this.appLogic.handleConnect(this.state, clientId, this.createHelpers());
    });

    this.wss.on('error', (error) => {
      console.error('[WSServer] WebSocket server error:', error);
    });
  }

  /**
   * Setup event handlers for a specific client connection
   */
  private setupClientHandlers(ws: WebSocket, clientId: string): void {
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as ClientMessage;
        console.log(`[WSServer] Message from ${clientId}:`, message);

        // Route to app logic
        const context: MessageContext = {
          clientId,
          message,
          helpers: this.createHelpers(),
        };
        this.appLogic.handleMessage(this.state, context);
      } catch (error) {
        console.error(`[WSServer] Error parsing message from ${clientId}:`, error);
        this.sendTo(clientId, {
          type: 'error',
          payload: { message: 'Invalid message format' },
        });
      }
    });

    ws.on('close', () => {
      console.log(`[WSServer] Client disconnected: ${clientId} (remaining: ${this.clients.size - 1})`);
      this.clients.delete(clientId);

      // Notify app logic of disconnection
      this.appLogic.handleDisconnect(this.state, clientId, this.createHelpers());
    });

    ws.on('error', (error) => {
      console.error(`[WSServer] Client ${clientId} error:`, error);
    });
  }

  /**
   * Create helper functions for app logic to send messages
   */
  private createHelpers(): MessageHelpers {
    return {
      broadcastAll: (message: ServerMessage) => this.broadcastAll(message),
      sendTo: (clientId: string, message: ServerMessage) => this.sendTo(clientId, message),
      broadcastExcept: (excludeClientId: string, message: ServerMessage) =>
        this.broadcastExcept(excludeClientId, message),
    };
  }

  /**
   * Send a message to all connected clients
   */
  private broadcastAll(message: ServerMessage): void {
    const data = JSON.stringify(message);
    this.clients.forEach((ws, clientId) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      } else {
        console.warn(`[WSServer] Client ${clientId} not ready, skipping broadcast`);
      }
    });
  }

  /**
   * Send a message to a specific client
   */
  private sendTo(clientId: string, message: ServerMessage): void {
    const ws = this.clients.get(clientId);
    if (!ws) {
      console.warn(`[WSServer] Client ${clientId} not found`);
      return;
    }

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn(`[WSServer] Client ${clientId} not ready`);
    }
  }

  /**
   * Broadcast a message to all clients except one
   */
  private broadcastExcept(excludeClientId: string, message: ServerMessage): void {
    const data = JSON.stringify(message);
    this.clients.forEach((ws, clientId) => {
      if (clientId !== excludeClientId && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  }

  /**
   * Get the current number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Close all connections and cleanup
   */
  close(): void {
    console.log('[WSServer] Closing WebSocket server...');
    this.clients.forEach((ws) => ws.close());
    this.wss.close();
  }
}
