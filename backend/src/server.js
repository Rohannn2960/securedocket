const app = require('./app');
const config = require('./config/env');
const logger = require('./config/logger');
const { connectDB, disconnectDB } = require('./config/database');

let server;

async function bootstrap() {
  logger.info(`Starting SIH-26190 Secure DMS API Server in [${config.env}] mode...`);

  // Initialize Database Connection
  await connectDB();

  // Start HTTP Listener
  server = app.listen(config.port, () => {
    logger.info(`Secure DMS API Gateway running on http://localhost:${config.port}`);
    logger.info(`Health check available at http://localhost:${config.port}/api/v1/health`);
  });
}

/**
 * Graceful Shutdown Handler
 */
async function gracefulShutdown(signal) {
  logger.warn(`Received ${signal}. Commencing graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      await disconnectDB();
      logger.info('Process terminated cleanly.');
      process.exit(0);
    });

    // Force exit if shutdown hangs beyond 10 seconds
    setTimeout(() => {
      logger.error('Shutdown timed out. Forcing termination.');
      process.exit(1);
    }, 10000);
  } else {
    await disconnectDB();
    process.exit(0);
  }
}

// Process Lifecycle Handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('CRITICAL UNCAUGHT EXCEPTION', { error: err });
  if (config.isProduction) {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  logger.error('CRITICAL UNHANDLED REJECTION', {
    error: reason instanceof Error ? reason : new Error(String(reason)),
  });
});

bootstrap();
