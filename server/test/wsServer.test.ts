import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { WSServer } from '../src/wsServer.js';
import type {
  AppLogic,
  ClientMessage,
  MessageContext,
  MessageHelpers,
  ServerMessage,
} from '../src/types.js';

interface TestState {
  connections: string[];
}

// Minimal app logic for exercising WSServer plumbing
const testAppLogic: AppLogic<TestState> = {
  createInitialState: () => ({ connections: [] }),

  handleConnect: (state, clientId, helpers) => {
    state.connections.push(clientId);
    helpers.sendTo(clientId, { type: 'welcome', payload: { clientId } });
  },

  handleDisconnect: (state, clientId) => {
    state.connections = state.connections.filter((id) => id !== clientId);
  },

  handleMessage: (_state, context: MessageContext) => {
    const { message, helpers, clientId } = context;
    if (message.type === 'sendMessage') {
      helpers.broadcastAll({
        type: 'systemMessage',
        payload: { text: `echo:${message.payload.text}` },
      });
    } else {
      helpers.sendTo(clientId, {
        type: 'error',
        payload: { message: 'Unknown message type' },
      });
    }
  },
};

async function startTestServer() {
  const httpServer = createServer();
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));

  const wsServer = new WSServer<TestState>(httpServer, testAppLogic);
  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to acquire server address');
  }

  const port = address.port;

  const close = async () => {
    wsServer.close();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });
  };

  return { port, close };
}

type ClientHandle = {
  ws: WebSocket;
  nextMessage: (timeoutMs?: number) => Promise<ServerMessage>;
  close: () => Promise<void>;
};

async function connectClient(port: number): Promise<ClientHandle> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);

  // Queue messages immediately to avoid missing early frames
  const queue: ServerMessage[] = [];
  ws.on('message', (data) => {
    try {
      queue.push(JSON.parse(data.toString()) as ServerMessage);
    } catch (err) {
      // ignore parse errors in test harness
    }
  });
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', (err) => reject(err));
  });

  const nextMessage = (timeoutMs = 2000) =>
    new Promise<ServerMessage>((resolve, reject) => {
      if (queue.length > 0) {
        return resolve(queue.shift() as ServerMessage);
      }

      const timeout = setTimeout(() => reject(new Error('Timed out waiting for message')), timeoutMs);

      const handleMessage = (data: any) => {
        clearTimeout(timeout);
        try {
          resolve(JSON.parse(data.toString()) as ServerMessage);
        } catch (err) {
          reject(err);
        }
      };

      ws.once('message', handleMessage);
      ws.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

  const close = async () =>
    new Promise<void>((resolve) => {
      ws.once('close', () => resolve());
      ws.close();
    });

  return { ws, nextMessage, close };
}

test('assigns unique client IDs and sends welcome', async (t) => {
  const { port, close } = await startTestServer();
  const client1 = await connectClient(port);
  const client2 = await connectClient(port);

  t.after(async () => {
    await client1.close();
    await client2.close();
    await close();
  });

  const welcome1 = await client1.nextMessage();
  const welcome2 = await client2.nextMessage();

  assert.equal(welcome1.type, 'welcome');
  assert.equal(welcome2.type, 'welcome');
  assert.ok(welcome1.payload.clientId);
  assert.ok(welcome2.payload.clientId);
  assert.notEqual(welcome1.payload.clientId, welcome2.payload.clientId);
});

test('broadcastAll reaches all connected clients', async (t) => {
  const { port, close } = await startTestServer();
  const client1 = await connectClient(port);
  const client2 = await connectClient(port);

  t.after(async () => {
    await client1.close();
    await client2.close();
    await close();
  });

  // Consume welcome messages
  await client1.nextMessage();
  await client2.nextMessage();

  // Send a chat message from client1 to trigger broadcastAll
  const chat: ClientMessage = { type: 'sendMessage', payload: { text: 'hi' } };
  client1.ws.send(JSON.stringify(chat));

  const msg1 = await client1.nextMessage();
  const msg2 = await client2.nextMessage();

  assert.equal(msg1.type, 'systemMessage');
  assert.equal(msg2.type, 'systemMessage');
  assert.equal(msg1.payload.text, 'echo:hi');
  assert.equal(msg2.payload.text, 'echo:hi');
});
