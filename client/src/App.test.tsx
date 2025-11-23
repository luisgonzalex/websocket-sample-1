import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Mock WSClient to avoid real sockets in tests
type CallbackMap = {
  open?: () => void;
  close?: () => void;
  error?: (error: Event) => void;
  message?: (message: any) => void;
};

vi.mock('./wsClient', () => {
  const state = { instance: null as any };

  class WSClientMock {
    callbacks: CallbackMap = {};
    sent: any[] = [];
    connected = false;
    disconnected = false;

    constructor() {
      state.instance = this;
    }

    on(event: 'open' | 'close' | 'error' | 'message', cb: any) {
      this.callbacks[event] = cb;
    }

    connect() {
      this.connected = true;
    }

    disconnect() {
      this.disconnected = true;
    }

    send(message: any) {
      this.sent.push(message);
    }

    isConnected() {
      return this.connected;
    }

    trigger(event: keyof CallbackMap, payload?: any) {
      const cb = this.callbacks[event];
      if (cb) cb(payload);
    }
  }

  (globalThis as any).__wsClientMockState = state;

  return { WSClient: WSClientMock };
});

function getClientMock() {
  const state = (globalThis as any).__wsClientMockState as { instance: any };
  if (!state?.instance) throw new Error('Mock WSClient not initialized');
  return state.instance as { callbacks: CallbackMap; sent: any[]; trigger: Function };
}

function createMockLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  } as Storage;
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMockLocalStorage());
  });

  it('shows disconnected status by default', async () => {
    render(<App />);
    await act(async () => {});
    expect(screen.getByText(/WebSocket Chat/i)).toBeInTheDocument();
    expect(screen.getByText(/Disconnected/i)).toBeInTheDocument();
  });

  it('sends username on open when stored', async () => {
    localStorage.setItem('chatUsername', 'Alice');
    render(<App />);
    await act(async () => {});

    const client = getClientMock();
    await act(async () => {
      client.trigger('open');
    });

    expect(client.sent).toContainEqual({
      type: 'setUsername',
      payload: { username: 'Alice' },
    });
    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
  });

  it('lets user enter and send a message', async () => {
    const user = userEvent.setup();
    render(<App />);
    await act(async () => {});

    const client = getClientMock();
    await act(async () => {
      client.trigger('open');
    });

    // set username
    await user.type(screen.getByPlaceholderText(/Enter your name/i), 'Bob');
    await user.click(screen.getByText(/Save/i));

    // type and send message
    await user.type(screen.getByPlaceholderText(/Type a message/i), 'Hello');
    await user.click(screen.getByText(/Send/i));

    expect(client.sent).toContainEqual({
      type: 'sendMessage',
      payload: { text: 'Hello' },
    });
  });
});
