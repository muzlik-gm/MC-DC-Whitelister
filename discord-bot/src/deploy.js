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

function stripMeta(c) {
  const fields = ['name', 'description', 'options', 'default_member_permissions', 'dm_permission'];
  return Object.fromEntries(fields.filter(f => c[f] != null).map(f => [f, c[f]]));
}

const rest = new REST({ version: '10' }).setToken(config.token);
const args = process.argv.slice(2);
const guildId = args.find(a => !a.startsWith('--'));
const cleanGlobal = args.includes('--clean-global');

(async () => {
  try {
    if (guildId) {
      console.log(`Deploying ${commands.length} commands to guild ${guildId}...`);

      if (cleanGlobal) {
        console.log('  --clean-global flag set — removing old global commands...');
        try {
          const globalCommands = await rest.get(Routes.applicationCommands(config.clientId));
          const cmdNames = new Set(commands.map(c => c.name));
          for (const gc of globalCommands) {
            if (cmdNames.has(gc.name)) {
              await rest.delete(Routes.applicationCommand(config.clientId, gc.id));
              console.log(`  Removed stale global command "${gc.name}"`);
            }
          }
        } catch {
          // may not have global commands
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
      console.log(`Deploy complete — ${total} commands synced to guild ${guildId} (${newCmds.length} new, ${existing.length - seen.size} removed)`);
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
