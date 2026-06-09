const { REST, Routes } = require('discord.js');
const path = require('path');
const config = require('./config');
const requireDir = require('./utils/requireDir');

const commands = [];
for (const file of requireDir(path.join(__dirname, 'commands'))) {
  const cmd = require(file);
  if (cmd.data) {
    commands.push(cmd.data.toJSON());
  }
}

const rest = new REST({ version: '10' }).setToken(config.token);
const guildId = process.argv[2];

(async () => {
  try {
    if (guildId) {
      console.log(`Deploying ${commands.length} commands to guild ${guildId}...`);

      // Delete any global commands with the same names to prevent duplication
      try {
        const globalCommands = await rest.get(Routes.applicationCommands(config.clientId));
        const cmdNames = new Set(commands.map(c => c.name));
        for (const gc of globalCommands) {
          if (cmdNames.has(gc.name)) {
            await rest.delete(Routes.applicationCommand(config.clientId, gc.id));
            console.log(`  Deleted global command "${gc.name}" to prevent duplication`);
          }
        }
      } catch {
        // may not have global commands
      }

      const result = await rest.put(
        Routes.applicationGuildCommands(config.clientId, guildId),
        { body: commands }
      );
      console.log(`Instant deploy to guild complete (${result.length} commands).`);
    } else {
      console.log(`Deploying ${commands.length} global commands...`);
      console.log('  WARNING: The bot also registers guild commands on startup.');
      console.log('  Global + guild commands with the same name will appear DUPLICATED in Discord.');
      console.log('  Prefer: node deploy.js <GUILD_ID>');
      const result = await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands }
      );
      console.log(`Global deploy complete (${result.length} commands) — may take up to 1 hour to appear in all servers.`);
    }
  } catch (err) {
    if (err.code === 'ENOTFOUND') {
      console.error(`Deploy failed: Cannot reach Discord API (${err.hostname}).`);
      console.error('Check your internet connection and DNS settings.');
    } else if (err.status === 401) {
      console.error('Deploy failed: Invalid bot token. Check your config.json.');
    } else if (err.status === 403) {
      console.error('Deploy failed: Missing permissions. Make sure the bot has applications.commands scope.');
    } else {
      console.error('Deploy failed:', err.message || err);
    }
    process.exit(1);
  }
})();
