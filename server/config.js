// App settings (can be changed with environment variables).
module.exports = {
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017',
  dbName: process.env.DB_NAME || 'fabulari',
  // Dev-only secrets.
  sessionSecret: process.env.SESSION_SECRET || 'fabulari-dev-secret',
  messageSecret: process.env.MESSAGE_SECRET || 'fabulari-dev-message-secret',
  // Anti-spam: max messages per user in a time window.
  messageRateLimit: {
    max: Number(process.env.MSG_RATE_MAX || 5),
    windowMs: Number(process.env.MSG_RATE_WINDOW_MS || 3000),
  },
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:4200',
};
