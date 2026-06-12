class CommandHandler {
  constructor(bot, config, logger) {
    this.bot = bot;
    this.config = config;
    this.logger = logger;
    this.commandsPath = require('path').join(__dirname, '..', 'commands');
    this.requireDir = require('../utils/requireDir');
    this.commands = new Map();
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

  handleError(error) {
    this.logger.error('CommandHandler', 'Bot error', error);
  }

  start() {
    return this.loadCommands().then(() => {
      this.logger.info('CommandHandler', 'Command handler started');
    });
  }
}

module.exports = CommandHandler;