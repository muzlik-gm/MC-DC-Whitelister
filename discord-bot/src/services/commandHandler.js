const prefix = require('../prefix');

class CommandHandler {
  constructor(bot, config, logger) {
    this.bot = bot;
    this.config = config;
    this.logger = logger;
    this.commandsPath = require('path').join(__dirname, '..', 'commands');
    this.requireDir = require('../utils/requireDir');
    this.commands = new Map();
    this.registerBotHandlers();
  }

  async loadCommands() {
    try {
      this.commands.clear();
      const commands = this.requireDir(this.commandsPath);
      for (const file of commands) {
        const cmd = require(file);
        if (cmd.data && cmd.execute) {
          this.commands.set(cmd.data.name, cmd);
        }
      }
      this.logger.info('CommandHandler', `Loaded ${this.commands.size} commands`);
    } catch (err) {
      this.logger.error('CommandHandler', 'Failed to load commands', err);
      throw err;
    }
  }

  registerBotHandlers() {
    this.bot.on('messageCreate', this.handleMessage.bind(this));
    this.bot.on('error', this.handleError.bind(this));
  }

  handleError(error) {
    this.logger.error('CommandHandler', 'Bot error', error);
  }

  handleMessage(message) {
    prefix.handleMessage(message);
  }

  start() {
    return this.loadCommands().then(() => {
      this.logger.info('CommandHandler', 'Command handler started');
    });
  }
}

module.exports = CommandHandler;