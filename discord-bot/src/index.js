const { Client, GatewayIntentBits } = require('discord.js');
const logger = require('./utils/logger');
const config = require('./config');
const services = require('./services');
const productionConfig = require('./config/production');

async function initialize() {
  logger.info('Bot', 'Starting WhitelistBot...');

  if (!productionConfig.validateEnvironment()) {
    process.exit(1);
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ]
  });

  const dbs = {
    guilds: require('./database/guilds'),
    tempWhitelist: require('./database/tempwhitelist'),
    cleanup: require('./database/cleanup'),
    whitelist: require('./database/whitelist'),
    settings: require('./database/settings'),
    roles: require('./database/roles'),
  };

  try {
    const commandHandler = new services.CommandHandler(client, config, logger);
    await commandHandler.start();

    const apiClient = new services.ApiClient(logger);
    apiClient.start();

    const cleanupService = new services.CleanupService(config, logger, client, apiClient, dbs);
    cleanupService.start();

    const eventListener = new services.EventListener(client, commandHandler, logger);
    eventListener.start();

    logger.info('Bot', 'All services initialized successfully');
  } catch (err) {
    logger.error('Bot', 'Failed to initialize services', err);
    process.exit(1);
  }

  async function shutdown(signal) {
    logger.info('Bot', `Received ${signal} — shutting down gracefully`);
    client.removeAllListeners();
    await client.destroy().catch(() => {});
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await client.login(config.token).catch(err => {
    logger.error('Bot', 'Login failed', err);
    process.exit(1);
  });
}

initialize();