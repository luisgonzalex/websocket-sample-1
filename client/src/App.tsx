/**
 * Demo Chat Application UI
 *
 * 🎮 This file is REPLACEABLE - customize it for your specific app.
 *
 * This demo shows how to use the WebSocket client wrapper to build
 * a simple chat interface with username management and message display.
 *
 * To create a different app:
 * - Replace this component with your own UI
 * - Use the WSClient class to send/receive messages
 * - Update message types in types.ts to match your needs
 */

import { useState, useEffect, useRef } from 'react';
import { WSClient } from './wsClient';
import type { ChatMessage, ServerMessage } from './types';
import './App.css';

// Initialize WebSocket client
const wsClient = new WSClient();

export default function App() {
  // Connection state
  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState<string>('');

  // User state
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem('chatUsername') || '';
  });
  const [isEditingUsername, setIsEditingUsername] = useState(!username);
  const [usernameInput, setUsernameInput] = useState(username);

  // Messages state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [systemMessages, setSystemMessages] = useState<string[]>([]);
  const [messageInput, setMessageInput] = useState('');

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Setup WebSocket connection
  useEffect(() => {
    wsClient.on('open', () => {
      console.log('[App] Connected to server');
      setConnected(true);

      // Send username if we have one
      if (username) {
        wsClient.send({
          type: 'setUsername',
          payload: { username },
        });
      }
    });

    wsClient.on('close', () => {
      console.log('[App] Disconnected from server');
      setConnected(false);
    });

    wsClient.on('error', (error) => {
      console.error('[App] WebSocket error:', error);
    });

    wsClient.on('message', handleMessage);

    wsClient.connect();

    return () => {
      wsClient.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update username on server when changed
  useEffect(() => {
    if (connected && username) {
      wsClient.send({
        type: 'setUsername',
        payload: { username },
      });
    }
  }, [username, connected]);

  // Handle incoming messages
  const handleMessage = (message: ServerMessage) => {
    console.log('[App] Received message:', message);

    switch (message.type) {
      case 'welcome':
        setClientId(message.payload.clientId);
        addSystemMessage(`Connected with ID: ${message.payload.clientId}`);
        break;

      case 'userJoined':
        addSystemMessage(`${message.payload.username} joined`);
        break;

      case 'userLeft':
        addSystemMessage(`${message.payload.username} left`);
        break;

      case 'chatMessage':
        setMessages((prev) => [...prev, message.payload]);
        break;

      case 'systemMessage':
        addSystemMessage(message.payload.text);
        break;

      case 'error':
        addSystemMessage(`Error: ${message.payload.message}`);
        break;
    }
  };

  const addSystemMessage = (text: string) => {
    setSystemMessages((prev) => [...prev, text]);
    setTimeout(() => {
      setSystemMessages((prev) => prev.slice(1));
    }, 5000);
  };

  const handleSaveUsername = () => {
    const trimmed = usernameInput.trim();
    if (trimmed) {
      setUsername(trimmed);
      localStorage.setItem('chatUsername', trimmed);
      setIsEditingUsername(false);
    }
  };

  const handleSendMessage = () => {
    const text = messageInput.trim();
    if (!text) return;

    wsClient.send({
      type: 'sendMessage',
      payload: { text },
    });

    setMessageInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>WebSocket Chat</h1>
        <div className={`status ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </header>

      <main className="main">
        {/* System Messages */}
        {systemMessages.length > 0 && (
          <div className="system-messages">
            {systemMessages.map((msg, i) => (
              <div key={i} className="system-message">
                {msg}
              </div>
            ))}
          </div>
        )}

        {/* Username Section */}
        <div className="username-section">
          {isEditingUsername ? (
            <div className="username-edit">
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleSaveUsername)}
                placeholder="Enter your name..."
                className="username-input"
                autoFocus
              />
              <button onClick={handleSaveUsername} className="btn-primary">
                Save
              </button>
            </div>
          ) : (
            <div className="username-display">
              <span className="username-label">Messaging as:</span>
              <span className="username-value">{username}</span>
              <button
                onClick={() => setIsEditingUsername(true)}
                className="btn-secondary"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="no-messages">No messages yet. Start the conversation!</div>
          ) : (
            <div className="messages">
              {messages.map((msg, i) => (
                <div key={i} className="message">
                  <div className="message-header">
                    <span className="message-username">
                      {msg.username}
                      {msg.clientId === clientId && (
                        <span className="you-indicator"> (you)</span>
                      )}
                    </span>
                    <span className="message-time">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="message-text">{msg.text}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="input-section">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={(e) => handleKeyPress(e, handleSendMessage)}
            placeholder="Type a message..."
            className="message-input"
            disabled={!connected || !username}
          />
          <button
            onClick={handleSendMessage}
            className="btn-primary"
            disabled={!connected || !username || !messageInput.trim()}
          >
            Send
          </button>
        </div>
      </main>
    </div>
  );
}
