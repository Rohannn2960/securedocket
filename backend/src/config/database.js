const mongoose = require('mongoose');
const config = require('./env');
const logger = require('./logger');

let isConnected = false;

const mongooseOptions = {
  autoIndex: !config.isProduction, // Disable auto-index in production for performance
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  maxPoolSize: 20,
  minPoolSize: 5,
};

/**
 * Connect to MongoDB Atlas
 */
async function connectDB() {
  if (isConnected) {
    logger.info('Using existing MongoDB connection');
    return;
  }

  // Connection Event Listeners
  mongoose.connection.on('connected', () => {
    isConnected = true;
    logger.info('MongoDB connection established successfully');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', { error: err });
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('MongoDB disconnected. Reconnection will be attempted by driver.');
  });

  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    logger.info('MongoDB reconnected successfully');
  });

  try {
    const conn = await mongoose.connect(config.mongodb.uri, mongooseOptions);
    isConnected = true;
    logger.info(`MongoDB connected to host: ${conn.connection.host}, database: ${conn.connection.name}`);
  } catch (error) {
    logger.error('Initial MongoDB connection failed', { error });
    // In local development without active Mongo, log warning instead of crashing
    if (config.isProduction) {
      process.exit(1);
    } else {
      logger.warn('Running in development mode without active MongoDB instance. Server will continue with degraded DB features.');
    }
  }
}

/**
 * Graceful Disconnection for application teardown
 */
async function disconnectDB() {
  if (!isConnected) return;
  try {
    await mongoose.connection.close();
    isConnected = false;
    logger.info('MongoDB connection closed gracefully');
  } catch (error) {
    logger.error('Error during MongoDB disconnect', { error });
  }
}

/**
 * Get current database connection state
 */
function getDBState() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized',
  };
  const stateCode = mongoose.connection.readyState;
  return {
    state: states[stateCode] || 'unknown',
    isConnected: stateCode === 1,
  };
}

module.exports = {
  connectDB,
  disconnectDB,
  getDBState,
};
