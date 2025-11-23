/**
 * WebSocket Client Wrapper
 *
 * 🔧 This file is REUSABLE across different apps.
 * It handles WebSocket connection management, auto-reconnect, and
 * provides a type-safe interface for sending/receiving messages.
 *
 * DO NOT modify this file for app-specific logic.
 */

import type { ClientMessage, ServerMessage } from './types';

/**
 * WebSocket connection configuration
 */
interface WSClientConfig {
  /** WebSocket URL (defaults to current host) */
  url?: string;

  /** Initial reconnect delay in ms (default: 3000) */
  initialReconnectDelay?: number;

  /** Maximum reconnect delay in ms (default: 30000) */
  maxReconnectDelay?: number;

  /** Maximum number of reconnect attempts (default: Infinity) */
  maxReconnectAttempts?: number;
}

/**
 * Event callbacks for WebSocket events
 */
interface WSClientCallbacks {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: ServerMessage) => void;
}

/**
 * WebSocket Client
 *
 * Manages WebSocket connection with automatic reconnection
 */
export class WSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private callbacks: WSClientCallbacks = {};
  private reconnectAttempts = 0;
  private reconnectDelay: number;
  private maxReconnectDelay: number;
  private maxReconnectAttempts: number;
  private reconnectTimeout: number | null = null;
  private isManualClose = false;
  private messageQueue: ClientMessage[] = [];

  constructor(config: WSClientConfig = {}) {
    // Determine WebSocket URL
    this.url = this.resolveWebSocketUrl(config.url);

    this.reconnectDelay = config.initialReconnectDelay || 3000;
    this.maxReconnectDelay = config.maxReconnectDelay || 30000;
    this.maxReconnectAttempts = config.maxReconnectAttempts || Infinity;

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      this.disconnect();
    });
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WSClient] Already connected');
      return;
    }

    if (this.ws?.readyState === WebSocket.CONNECTING) {
      console.log('[WSClient] Connection already in progress');
      return;
    }

    console.log(`[WSClient] Connecting to ${this.url}...`);
    this.isManualClose = false;

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('[WSClient] Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    console.log('[WSClient] Disconnecting...');
    this.isManualClose = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send a message to the server
   */
  send(message: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WSClient] Not connected, queuing message');
      this.messageQueue.push(message);
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('[WSClient] Failed to send message:', error);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Register event callbacks
   */
  on(event: 'open', callback: () => void): void;
  on(event: 'close', callback: () => void): void;
  on(event: 'error', callback: (error: Event) => void): void;
  on(event: 'message', callback: (message: ServerMessage) => void): void;
  on(event: keyof WSClientCallbacks, callback: any): void {
    switch (event) {
      case 'open':
        this.callbacks.onOpen = callback;
        break;
      case 'close':
        this.callbacks.onClose = callback;
        break;
      case 'error':
        this.callbacks.onError = callback;
        break;
      case 'message':
        this.callbacks.onMessage = callback;
        break;
    }
  }

  /**
   * Resolve the WebSocket URL based on explicit config, env, or sensible defaults.
   * - config.url takes precedence for full control
   * - VITE_WS_URL lets you set a custom endpoint without code changes
   * - In dev (Vite on 5173/4173), default to port 3000 where the Fastify server runs
   * - In prod, use the current host/port so the WS rides alongside the served client
   */
  private resolveWebSocketUrl(overrideUrl?: string): string {
    if (overrideUrl) return overrideUrl;

    // Allow override via Vite env var
    const envUrl = (import.meta as any)?.env?.VITE_WS_URL as string | undefined;
    if (envUrl) return envUrl;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const { hostname, port } = window.location;

    // When running the Vite dev server, the UI is on 5173/4173 but the WS server is on 3000.
    const isViteDevPort = port === '5173' || port === '4173';
    const wsPort = isViteDevPort ? '3000' : port;

    return `${protocol}//${hostname}${wsPort ? `:${wsPort}` : ''}`;
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('[WSClient] Connected');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 3000;

      // Send queued messages
      while (this.messageQueue.length > 0) {
        const msg = this.messageQueue.shift();
        if (msg) this.send(msg);
      }

      this.callbacks.onOpen?.();
    };

    this.ws.onclose = () => {
      console.log('[WSClient] Disconnected');
      this.callbacks.onClose?.();

      if (!this.isManualClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WSClient] WebSocket error:', error);
      this.callbacks.onError?.(error);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        this.callbacks.onMessage?.(message);
      } catch (error) {
        console.error('[WSClient] Failed to parse message:', error);
      }
    };
  }

  /**
   * Schedule reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WSClient] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay, this.maxReconnectDelay);

    console.log(
      `[WSClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`
    );

    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, delay);

    // Exponential backoff
    this.reconnectDelay *= 2;
  }
}
