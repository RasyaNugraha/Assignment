// Server entry point: connect to MongoDB, set up Express + Socket.IO, then listen.

const http = require('http');
const { Server } = require('socket.io');

const config = require('./config');
const db = require('./services/dbService');
const { createApp, createSessionMiddleware } = require('./app');
const { registerChatHandlers } = require('./sockets/chat');
const { MongoStore } = require('connect-mongo');

// Keep login sessions in MongoDB so a server restart doesn't log everyone out.
function createSessionStore() {
  const client = db.getClient();
  if (!client) return undefined; // not connected (tests) = default memory store
  return MongoStore.create({ client, dbName: db.getDb().databaseName, collectionName: 'sessions' });
}

// Puts Express and Socket.IO on one HTTP server (tests reuse this, and can override the rate limit).
function createServer(options = {}) {
  // Same session for Express and Socket.IO, so sockets know who's logged in.
  const sessionMiddleware = createSessionMiddleware(createSessionStore());
  const app = createApp({ sessionMiddleware });
  const server = http.createServer(app);

  const io = new Server(server, {
    // Bigger limit so 2MB images (base64) can be sent.
    maxHttpBufferSize: 4e6,
    cors: { origin: config.clientOrigin, credentials: true },
  });
  io.engine.use(sessionMiddleware);
  registerChatHandlers(io, {
    messageSecret: config.messageSecret,
    messageRateLimit: options.messageRateLimit ?? config.messageRateLimit,
  });
  app.set('io', io); // lets REST routes notify sockets (e.g. room removed)

  return { app, server, io };
}

// Connect to MongoDB and start the server.
async function start() {
  await db.connect(config.mongoUri, config.dbName);
  console.log(`Connected to MongoDB: ${config.dbName}`);

  const { server, io } = createServer();
  server.listen(config.port, () => {
    console.log(`Fabulari server listening on http://localhost:${config.port}`);
  });

  const shutdown = async () => {
    io.close();
    server.close();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Only start when run with `node server.js`, not when a test imports this file.
if (require.main === module) {
  start().catch((err) => {
    console.error('Could not start the server — is MongoDB running (mongod)?');
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { createServer };
