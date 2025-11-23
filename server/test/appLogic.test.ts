import test from 'node:test';
import assert from 'node:assert/strict';
import { chatAppLogic } from '../src/appLogic.js';
import type { ChatMessage, MessageHelpers } from '../src/types.js';

// NOTE: These tests are illustrative for the demo chat logic. Replace
// them with app-specific tests when you swap in your own logic.

function createHelperSpies() {
  const sentTo: { clientId: string; message: any }[] = [];
  const broadcasts: any[] = [];
  const broadcastExcept: { excludeClientId: string; message: any }[] = [];

  const helpers: MessageHelpers = {
    sendTo: (clientId, message) => {
      sentTo.push({ clientId, message });
    },
    broadcastAll: (message) => {
      broadcasts.push(message);
    },
    broadcastExcept: (excludeClientId, message) => {
      broadcastExcept.push({ excludeClientId, message });
    },
  };

  return { helpers, sentTo, broadcasts, broadcastExcept };
}

test('createInitialState returns empty state', () => {
  const state = chatAppLogic.createInitialState();
  assert.equal(state.users.size, 0);
  assert.deepEqual(state.messageHistory, []);
});

test('handleConnect adds user and sends welcome', () => {
  const state = chatAppLogic.createInitialState();
  const { helpers, sentTo } = createHelperSpies();

  chatAppLogic.handleConnect(state, 'client-1', helpers);

  assert.equal(state.users.size, 1);
  assert.equal(sentTo.length, 1);
  assert.equal(sentTo[0].clientId, 'client-1');
  assert.equal(sentTo[0].message.type, 'welcome');
  assert.equal(sentTo[0].message.payload.clientId, 'client-1');
});

test('handleMessage can set username and broadcast chat message', () => {
  const state = chatAppLogic.createInitialState();
  const { helpers, broadcasts } = createHelperSpies();

  // Connect a client first
  chatAppLogic.handleConnect(state, 'client-1', helpers);

  // Set username from default Anonymous -> Alice
  chatAppLogic.handleMessage(state, {
    clientId: 'client-1',
    message: { type: 'setUsername', payload: { username: 'Alice' } },
    helpers,
  });

  // Send a chat message
  chatAppLogic.handleMessage(state, {
    clientId: 'client-1',
    message: { type: 'sendMessage', payload: { text: 'Hello world' } },
    helpers,
  });

  // First broadcast should be userJoined, second should be chatMessage
  assert.equal(broadcasts.length, 2);
  assert.equal(broadcasts[0].type, 'userJoined');
  assert.equal(broadcasts[0].payload.username, 'Alice');

  assert.equal(broadcasts[1].type, 'chatMessage');
  const chatPayload = broadcasts[1].payload as ChatMessage;
  assert.equal(chatPayload.username, 'Alice');
  assert.equal(chatPayload.text, 'Hello world');
  assert.equal(chatPayload.clientId, 'client-1');

  // Message history should contain the sent message
  assert.equal(state.messageHistory.length, 1);
  assert.equal(state.messageHistory[0].text, 'Hello world');
});
