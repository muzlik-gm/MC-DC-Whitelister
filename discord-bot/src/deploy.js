const { REST, Routes } = require('discord.js');
const path = require('path');
const config = require('./config');
const requireDir = require('./utils/requireDir');
const logger = require('./utils/logger');

const commands = [];
for (const file of requireDir(path.join(__dirname, 'commands'))) {
  const cmd = require(file);
  if (cmd.data) {
    commands.push(cmd.data.toJSON());
  }
}

function stripMeta(c) {
  const fields = ['name', 'description', 'options', 'default_member_permissions', 'dm_permission'];
  return Object.fromEntries(fields.filter(f => c[f] != null).map(f => [f, c[f]]));
}

const rest = new REST({ version: '10' }).setToken(config.token);
const args = process.argv.slice(2);
const guildId = args.find(a => !a.startsWith('--'));
const cleanGlobal = args.includes('--clean-global');

(async () => {
  // Validate environment
  if (!config.token || config.token === 'YOUR_BOT_TOKEN') {
    console.error('Deploy failed: Bot token not configured. Update config.json with your bot token.');
    process.exit(1);
  }

  if (!config.clientId || config.clientId === 'YOUR_BOT_CLIENT_ID') {
    console.error('Deploy failed: Bot client ID not configured. Update config.json with your bot client ID.');
    process.exit(1);
  }

  if (!guildId && !process.env.NODE_ENV?.includes('production')) {
    console.log('WARNING: Deploying global commands. This may cause duplicates with guild commands.');
    console.log('For production deployments, use: node deploy.js <GUILD_ID> to deploy to a specific guild.');
  }

  try {
    if (guildId) {
      logger.info('Deploy', `Deploying ${commands.length} commands to guild ${guildId}...`);

      if (cleanGlobal) {
        logger.info('Deploy', '--clean-global flag set — removing old global commands...');
        try {
          const globalCommands = await rest.get(Routes.applicationCommands(config.clientId));
          const cmdNames = new Set(commands.map(c => c.name));
          for (const gc of globalCommands) {
            if (cmdNames.has(gc.name)) {
              await rest.delete(Routes.applicationCommand(config.clientId, gc.id));
              logger.info('Deploy', `Removed stale global command "${gc.name}"`);
            }
          }
        } catch (err) {
          // may not have global commands
          logger.warn('Deploy', 'Failed to clean global commands:', err.message);
        }
      }

      const existing = await rest.get(Routes.applicationGuildCommands(config.clientId, guildId));
      const seen = new Set();

      for (const cmd of commands) {
        const match = existing.find(e => e.name === cmd.name);
        if (match) {
          seen.add(match.id);
          if (JSON.stringify(stripMeta(match)) !== JSON.stringify(cmd)) {
            await rest.patch(Routes.applicationGuildCommand(config.clientId, guildId, match.id), { body: cmd });
          }
        }
      }

      for (const e of existing) {
        if (!seen.has(e.id)) {
          await rest.delete(Routes.applicationGuildCommand(config.clientId, guildId, e.id));
        }
      }

      const newCmds = commands.filter(c => !existing.find(e => e.name === c.name));
      for (const cmd of newCmds) {
        await rest.post(Routes.applicationGuildCommands(config.clientId, guildId), { body: cmd });
      }

      const total = commands.length;
      logger.info('Deploy', `Deploy complete — ${total} commands synced to guild ${guildId} (${newCmds.length} new, ${existing.length - seen.size} removed)`);
    } else {
      logger.info('Deploy', `Deploying ${commands.length} global commands...`);
      logger.warn('Deploy', 'The bot also registers guild commands on startup.');
      logger.warn('Deploy', 'Global + guild commands with the same name will appear DUPLICATED in Discord.');
      logger.warn('Deploy', 'Prefer: node deploy.js <GUUILD_ID>');
      const result = await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands }
      );
      logger.info('Deploy', `Global deploy complete (${result.length} commands) — may take up to 1 hour to appear in all servers.`);
    }
  } catch (err) {
    if (err.code === 'ENOTFOUND') {
      logger.error('Deploy', `Deploy failed: Cannot reach Discord API (${err.hostname}).`);
      logger.error('Deploy', 'Check your internet connection and DNS settings.');
    } else if (err.status === 401) {
      logger.error('Deploy', 'Deploy failed: Invalid bot token. Check your config.json.');
    } else if (err.status === 403) {
      logger.error('Deploy', 'Deploy failed: Missing permissions. Make sure the bot has applications.commands scope.');
    } else {
      logger.error('Deploy', 'Deploy failed:', err.message || err);
    }
    process.exit(1);
  }
})();
