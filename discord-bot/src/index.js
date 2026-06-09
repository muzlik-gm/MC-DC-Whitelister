const { Client, GatewayIntentBits, Collection, EmbedBuilder, REST, Routes, ActivityType } = require('discord.js');
const { handleComponent } = require('./handlers/config');
const path = require('path');
const config = require('./config');
const requireDir = require('./utils/requireDir');
const { handleMessage } = require('./prefix');
const logger = require('./utils/logger');

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

async function registerGuildCommands(guildId) {
  const commands = [];
  for (const cmd of client.commands.values()) {
    commands.push(cmd.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(config.token);
  try {
    // Delete any global commands with the same names to prevent duplication
    try {
      const globalCommands = await rest.get(Routes.applicationCommands(config.clientId));
      const cmdNames = new Set(commands.map(c => c.name));
      for (const gc of globalCommands) {
        if (cmdNames.has(gc.name)) {
          await rest.delete(Routes.applicationCommand(config.clientId, gc.id));
          logger.info('Guilds', `Deleted global command ${gc.name} to prevent duplication`);
        }
      }
    } catch {
      // non-critical — may not have global commands at all
    }

    const existing = await rest.get(Routes.applicationGuildCommands(config.clientId, guildId));
    const existingIds = existing.map(c => c.id);
    const newNames = new Set(commands.map(c => c.name));

    const stale = existingIds.filter((_, i) => !newNames.has(existing[i].name));
    for (const id of stale) {
      await rest.delete(Routes.applicationGuildCommand(config.clientId, guildId, id));
    }

    await rest.put(
      Routes.applicationGuildCommands(config.clientId, guildId),
      { body: commands }
    );
    logger.info('Guilds', `Registered ${commands.length} commands for guild ${guildId}` + (stale.length ? ` (${stale.length} stale removed)` : ''));
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

client.login(config.token).catch(err => {
  logger.error('Bot', 'Login failed', err);
  process.exit(1);
});
