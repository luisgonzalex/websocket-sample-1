/**
 * Fastify Server Entry Point
 *
 * Initializes the HTTP server, WebSocket server, and app logic.
 * Handles configuration, static file serving, and graceful shutdown.
 */

import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import { WSServer } from './wsServer.js';
import { chatAppLogic } from './appLogic.js';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ============================================================================
// FASTIFY SETUP
// ============================================================================

const fastify = Fastify({
  logger: {
    level: IS_PRODUCTION ? 'info' : 'debug',
  },
});

// CORS for development
fastify.register(fastifyCors, {
  origin: IS_PRODUCTION ? false : CLIENT_URL,
  credentials: true,
});

// Serve static files in production (Vite build output)
if (IS_PRODUCTION) {
  const clientDistPath = join(__dirname, '../../client/dist');
  fastify.register(fastifyStatic, {
    root: clientDistPath,
    prefix: '/',
  });
  fastify.log.info(`Serving static files from: ${clientDistPath}`);
}

// ============================================================================
// ROUTES
// ============================================================================

// Health check endpoint
fastify.get('/health', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    clients: wsServer?.getClientCount() || 0,
  };
});

// Root endpoint (for production, serves index.html)
if (!IS_PRODUCTION) {
  fastify.get('/', async () => {
    return {
      message: 'WebSocket Template Server',
      status: 'running',
      endpoints: {
        health: '/health',
        websocket: `ws://${HOST}:${PORT}`,
        client: CLIENT_URL,
      },
    };
  });
}

// ============================================================================
// WEBSOCKET SERVER
// ============================================================================

let wsServer: WSServer | null = null;

// Start server
async function start() {
  try {
    // Start HTTP server
    await fastify.listen({ port: PORT, host: HOST });

    // Initialize WebSocket server with app logic
    wsServer = new WSServer(fastify.server, chatAppLogic);

    fastify.log.info('\n' + '='.repeat(60));
    fastify.log.info('🚀 WebSocket Template Server');
    fastify.log.info('='.repeat(60));
    fastify.log.info(`📡 HTTP Server: http://${HOST}:${PORT}`);
    fastify.log.info(`🔌 WebSocket: ws://${HOST}:${PORT}`);
    if (!IS_PRODUCTION) {
      fastify.log.info(`🖥️  Client Dev: ${CLIENT_URL}`);
    }
    fastify.log.info(`🌍 LAN Access: ws://<your-ip>:${PORT}`);
    fastify.log.info(`🏥 Health Check: http://${HOST}:${PORT}/health`);
    fastify.log.info('='.repeat(60) + '\n');

    if (HOST === '0.0.0.0') {
      fastify.log.info('💡 Server bound to 0.0.0.0 - accessible from LAN');
      fastify.log.info('   Find your IP with: ifconfig (Mac/Linux) or ipconfig (Windows)\n');
    }
  } catch (err) {
    fastify.log.error(err, '❌ Failed to start server');
    process.exit(1);
  }
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

async function closeGracefully(signal: string) {
  fastify.log.info(`\n🛑 Received ${signal}, closing gracefully...`);

  // Close WebSocket server
  if (wsServer) {
    wsServer.close();
  }

  // Close Fastify server
  await fastify.close();

  fastify.log.info('✅ Server closed successfully');
  process.exit(0);
}

process.on('SIGINT', () => closeGracefully('SIGINT'));
process.on('SIGTERM', () => closeGracefully('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  fastify.log.error(error, '💥 Uncaught Exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  fastify.log.error(reason, '💥 Unhandled Rejection');
  process.exit(1);
});

// ============================================================================
// START SERVER
// ============================================================================

start();
