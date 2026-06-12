const { Client, GatewayIntentBits } = require('discord.js');
const logger = require('./utils/logger');
const config = require('./config');
const services = require('./services');
const productionConfig = require('./config/production');

async function initialize() {
  logger.info('Bot', 'Starting WhitelistBot...');

  const cfg = config();

  if (!productionConfig.validateEnvironment(cfg)) {
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

  // Login first — if this fails, nothing else started
  await client.login(cfg.token).catch(err => {
    logger.error('Bot', 'Login failed', err);
    process.exit(1);
  });

  logger.info('Bot', 'Discord client logged in successfully');

  const dbs = {
    guilds: require('./database/guilds'),
    tempWhitelist: require('./database/tempwhitelist'),
    cleanup: require('./database/cleanup'),
    whitelist: require('./database/whitelist'),
    settings: require('./database/settings'),
    roles: require('./database/roles'),
  };

  // References for cleanup
  let cleanupInterval;
  let tunnelServer;

  try {
    const commandHandler = new services.CommandHandler(client, cfg, logger);
    await commandHandler.start();

    const apiClient = new services.ApiClient(logger);
    apiClient.start();

    const cleanupService = new services.CleanupService(cfg, logger, client, apiClient, dbs);
    cleanupInterval = cleanupService.start();

    const eventListener = new services.EventListener(client, commandHandler, logger);
    eventListener.start();

    const tunnelPort = parseInt(process.env.TUNNEL_PORT || '9000', 10);
    tunnelServer = new services.TunnelServer(tunnelPort, logger, cfg.apiKey || null);
    // Set tunnel singleton before starting the server
    const tunnel = require('./services/tunnel');
    tunnel.setTunnel(tunnelServer);
    tunnelServer.start();

    logger.info('Bot', 'All services initialized successfully');
  } catch (err) {
    logger.error('Bot', 'Failed to initialize services', err);
    if (tunnelServer) tunnelServer.stop();
    if (cleanupInterval) clearInterval(cleanupInterval);
    process.exit(1);
  }

  async function shutdown(signal) {
    logger.info('Bot', 'Received ' + signal + ' — shutting down gracefully');
    if (cleanupInterval) clearInterval(cleanupInterval);
    if (tunnelServer) tunnelServer.stop();
    client.removeAllListeners();
    await client.destroy().catch(() => {});
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

initialize().catch(err => {
  logger.error('Bot', 'Unhandled error in initialize()', err);
  process.exit(1);
});
