const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store all connected clients
const clients = new Set();

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New client connected');
  clients.add(ws);

  // Send a welcome message
  ws.send(JSON.stringify({
    type: 'system',
    text: 'Connected to message board',
    timestamp: Date.now()
  }));

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log('Received message:', message);

      // Add server timestamp if not present
      if (!message.timestamp) {
        message.timestamp = Date.now();
      }

      // Broadcast to all connected clients
      broadcast(message);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Broadcast helper function
function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Start the server on 0.0.0.0 to allow LAN access
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`LAN access: http://<your-laptop-ip>:${PORT}`);
  console.log('\nTo find your laptop IP:');
  console.log('  - macOS/Linux: Run "ifconfig" or "ip addr"');
  console.log('  - Windows: Run "ipconfig"');
  console.log('  - Look for your local IP (usually 192.168.x.x or 10.x.x.x)');
});
