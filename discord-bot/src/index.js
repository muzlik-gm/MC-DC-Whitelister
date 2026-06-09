const { Client, GatewayIntentBits, Collection, EmbedBuilder, REST, Routes, ActivityType } = require('discord.js');
const { handleComponent } = require('./handlers/config');
const path = require('path');
const config = require('./config');
const requireDir = require('./utils/requireDir');
const { handleMessage } = require('./prefix');
const logger = require('./utils/logger');
const settings = require('./database/settings');
const MinecraftApi = require('./services/MinecraftApi');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
for (const file of requireDir(commandsPath)) {
  const cmd = require(file);
  if (cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
  }
}

function stripMeta(c) {
  const fields = ['name', 'description', 'options', 'default_member_permissions', 'dm_permission'];
  return Object.fromEntries(fields.filter(f => c[f] != null).map(f => [f, c[f]]));
}

async function registerGuildCommands(guildId) {
  const commands = [];
  for (const cmd of client.commands.values()) {
    commands.push(cmd.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(config.token);
  try {
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

    logger.info('Guilds', `Synced ${commands.length} commands for guild ${guildId} (${newCmds.length} new, ${existing.length - seen.size} removed)`);
  } catch (err) {
    logger.error('Guilds', `Failed to register commands for guild ${guildId}`, err);
  }
}

client.once('clientReady', async () => {
  logger.info('Bot', `Logged in as ${client.user.tag}`);
  logger.info('Commands', `Loaded ${client.commands.size} commands in memory`);

  client.user.setPresence({
    activities: [{ name: '>help for commands', type: ActivityType.Watching }],
    status: 'online',
  });

  const guilds = client.guilds.cache;
  for (const guild of guilds.values()) {
    await registerGuildCommands(guild.id);
  }
  logger.info('Guilds', `Registered commands for ${guilds.size} guild(s)`);

  // Start activity polling loop
  const lastPoll = new Map();
  setInterval(async () => {
    const now = Math.floor(Date.now() / 1000);
    for (const [guildId, guild] of client.guilds.cache) {
      const gc = settings.getSettings(guildId);
      const guildCfg = require('./database/guilds').getConfig(guildId);
      if (!gc?.log_channel_id || !guildCfg) continue;

      const since = lastPoll.get(guildId) || now - 30;
      lastPoll.set(guildId, now);

      const api = new MinecraftApi(guildCfg);
      const res = await api._get(`/api/activity/poll?since=${since}`);
      if (!res.ok || !res.events?.length) continue;

      const channel = guild.channels.cache.get(gc.log_channel_id);
      if (!channel) continue;

      for (const evt of res.events) {
        const type = evt.type;
        const player = evt.player;
        const detail = evt.detail || '';

        let color = 0x2ecc71;
        let title = '';
        let desc = '';

        if (type === 'join') { color = 0x2ecc71; title = 'Player Joined'; desc = `**${player}** joined the server`; }
        else if (type === 'first_join') { color = 0x3498db; title = 'First Join'; desc = `**${player}** joined for the first time!`; }
        else if (type === 'leave') { color = 0xe67e22; title = 'Player Left'; desc = `**${player}** left the server`; }
        else if (type === 'death') { color = 0xe74c3c; title = 'Player Died'; desc = detail || `**${player}** died`; }
        else if (type === 'advancement') {
          color = 0xf1c40f;
          title = 'Advancement';
          const name = detail.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          desc = `**${player}** earned **${name}**`;
        } else continue;

        if ((type === 'join' && !gc.log_joins) ||
            (type === 'leave' && !gc.log_leaves) ||
            (type === 'death' && !gc.log_deaths) ||
            (type === 'advancement' && !gc.log_advancements)) continue;

        const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc);

        channel.send({ embeds: [embed] }).catch(() => {});
      }
    }
  }, 15000);
});

client.on('guildCreate', async (guild) => {
  logger.info('Guilds', `Joined ${guild.name} (${guild.id})`);
  await registerGuildCommands(guild.id);

  const tutorialEmbed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('🔐 Thanks for adding WhitelistBot!')
    .setDescription('Get your Minecraft server connected in two simple steps:')
    .addFields(
      { name: 'Method 1: MC → Discord (easiest)', value: '1. Run **`/wlb pair`** in your Minecraft server\n2. Click the **yellow command** to copy it\n3. **Paste** it here in Discord — it starts with **`>`**\n4. Done!', inline: false },
      { name: 'Method 2: Discord → MC', value: '1. Run **`>pair ip:your.server.ip`** here\n2. In MC, run **`/wlb connect <code>`**\n3. Paste the **`>`** command it gives you back here', inline: false },
      { name: 'For Players', value: 'Use **`>whitelist <username>`** or **`/whitelist <username>`** to join the whitelist!', inline: false },
      { name: 'Need help?', value: 'Type **`>tutorial`** or **`/tutorial`** for the full guide.', inline: false }
    );

  const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(client.user)?.has('SendMessages'));
  if (channel) {
    channel.send({ embeds: [tutorialEmbed] }).catch(() => {});
  }
});

client.on('guildMemberAdd', async (member) => {
  try {
    const onboarding = require('./database/onboarding');
    const config = onboarding.getConfig(member.guild.id);
    if (!config || !config.enabled) return;

    if (config.auto_role_id) {
      const role = member.guild.roles.cache.get(config.auto_role_id);
      if (role) await member.roles.add(role).catch(() => {});
    }

    if (config.welcome_channel_id) {
      const channel = member.guild.channels.cache.get(config.welcome_channel_id);
      if (channel) {
        const msg = config.welcome_message || 'Welcome {user}!';
        await channel.send(msg.replace('{user}', `<@${member.id}>`).replace('{server}', member.guild.name)).catch(() => {});
      }
    }
  } catch (err) {
    logger.error('Onboarding', 'guildMemberAdd handler error', err);
  }
});

client.on('messageCreate', (message) => {
  handleMessage(message);
});

client.on('interactionCreate', async interaction => {
  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    if (interaction.customId && interaction.customId.startsWith('config_')) {
      try {
        await handleComponent(interaction);
      } catch (err) {
        logger.error('Config', 'Component interaction error', err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('An error occurred.')],
            ephemeral: true
          }).catch(() => {});
        }
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Unknown command.')],
      ephemeral: true
    });
  }

  if (!interaction.inGuild()) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('This command can only be used in a server.')],
      ephemeral: true
    });
  }

  try {
    await cmd.execute(interaction);
  } catch (err) {
    logger.error('Commands', `/${interaction.commandName}`, err);

    const payload = {
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('Unexpected Error')
          .setDescription('An unexpected error occurred. Please try again.')
      ],
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  }
});

async function shutdown(signal) {
  logger.info('Bot', `Received ${signal} — shutting down gracefully`);
  client.removeAllListeners();
  await client.destroy().catch(() => {});
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

client.login(config.token).catch(err => {
  logger.error('Bot', 'Login failed', err);
  process.exit(1);
});
