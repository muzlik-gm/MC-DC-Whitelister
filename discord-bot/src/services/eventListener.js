const loadConfig = require('../config');
const { EmbedBuilder } = require('discord.js');

class EventListener {
  constructor(bot, commandHandler, logger) {
    this.bot = bot;
    this.commandHandler = commandHandler;
    this.logger = logger;
    this.config = loadConfig();
  }

  async registerGuildCommands(guildId) {
    const commands = [];
    for (const cmd of this.commandHandler.commands.values()) {
      commands.push(cmd.data.toJSON());
    }

    const { REST, Routes } = require('discord.js');
    const rest = new REST({ version: '10' }).setToken(this.config.token);
    try {
      const existing = await rest.get(Routes.applicationGuildCommands(this.config.clientId, guildId));
      const seen = new Set();

      for (const cmd of commands) {
        const match = existing.find(e => e.name === cmd.name);
        if (match) {
          seen.add(match.id);
          const cmdMeta = { name: 'name', description: 'description', options: 'options', default_member_permissions: 'default_member_permissions', dm_permission: 'dm_permission' };
          const stripMeta = (c) => Object.fromEntries(Object.keys(cmdMeta).filter(f => c[f] != null).map(f => [f, c[f]]));

          if (JSON.stringify(stripMeta(match)) !== JSON.stringify(cmd)) {
            await rest.patch(Routes.applicationGuildCommand(this.config.clientId, guildId, match.id), { body: cmd });
          }
        }
      }

      for (const e of existing) {
        if (!seen.has(e.id)) {
          await rest.delete(Routes.applicationGuildCommand(this.config.clientId, guildId, e.id));
        }
      }

      const newCmds = commands.filter(c => !existing.find(e => e.name === c.name));
      for (const cmd of newCmds) {
        await rest.post(Routes.applicationGuildCommands(this.config.clientId, guildId), { body: cmd });
      }

      this.logger.info('EventListener', `Synced ${commands.length} commands for guild ${guildId} (${newCmds.length} new, ${existing.length - seen.size} removed)`);
    } catch (err) {
      this.logger.error('EventListener', `Failed to register commands for guild ${guildId}`, err);
    }
  }

  async registerBotEvents() {
    this.bot.once('ready', async () => {
      this.logger.info('EventListener', `Bot logged in as ${this.bot.user.tag}`);
      this.logger.info('EventListener', `Loaded ${this.commandHandler.commands.size} commands in memory`);

      this.bot.user.setPresence({
        activities: [{ name: '>help for commands', type: 3 }],
        status: 'online',
      });

      const guilds = this.bot.guilds.cache;
      for (const guild of guilds.values()) {
        await this.registerGuildCommands(guild.id);
      }
      this.logger.info('EventListener', `Registered commands for ${guilds.size} guild(s)`);
    });

    this.bot.on('guildCreate', async (guild) => {
      this.logger.info('EventListener', `Joined ${guild.name} (${guild.id})`);
      await this.registerGuildCommands(guild.id);

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

      const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(this.bot.user)?.has('SendMessages'));
      if (channel) {
        channel.send({ embeds: [tutorialEmbed] }).catch(() => {});
      }
    });

    this.bot.on('messageCreate', (message) => {
      if (message.author.bot) return;
      try {
        const { handleMessage } = require('../prefix');
        handleMessage(message);
      } catch (err) {
        this.logger.error('EventListener', 'Prefix message handler error', err);
      }
    });

    this.bot.on('guildMemberAdd', async (member) => {
      try {
        const onboarding = require('../database/onboarding');
        const onboardingConfig = onboarding.getConfig(member.guild.id);
        if (!onboardingConfig || !onboardingConfig.enabled) return;

        if (onboardingConfig.auto_role_id) {
          const role = member.guild.roles.cache.get(onboardingConfig.auto_role_id);
          if (role) await member.roles.add(role).catch(() => {});
        }

        if (onboardingConfig.welcome_channel_id) {
          const channel = member.guild.channels.cache.get(onboardingConfig.welcome_channel_id);
          if (channel) {
            const msg = onboardingConfig.welcome_message || 'Welcome {user}!';
            await channel.send(msg.replace('{user}', `<@${member.id}>`).replace('{server}', member.guild.name)).catch(() => {});
          }
        }
      } catch (err) {
        this.logger.error('EventListener', 'Onboarding guildMemberAdd handler error', err);
      }
    });

    this.bot.on('interactionCreate', async interaction => {
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        if (interaction.customId && interaction.customId.startsWith('config_')) {
          try {
            const handleComponent = require('../handlers/config').handleComponent;
            await handleComponent(interaction);
          } catch (err) {
            this.logger.error('EventListener', 'Component interaction error', err);
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({
                embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('An error occurred.')],
                flags: 64
              }).catch(() => {});
            }
          }
          return;
        }

        if (interaction.customId === 'help_category') {
          try {
            const { buildEmbed, buildMenu } = require('../handlers/help');
            const selected = interaction.values[0];
            const embed = buildEmbed(selected);
            const menu = buildMenu(selected);
            await interaction.update({ embeds: [embed], components: [menu] });
          } catch (err) {
            this.logger.error('EventListener', 'Select menu error', err);
          }
          return;
        }

        if (interaction.customId && interaction.customId.startsWith('help_')) {
          try {
            const { buildEmbed, buildButtons } = require('../handlers/help');
            const selected = interaction.customId.replace('help_', '');
            const embed = buildEmbed(selected);
            const components = buildButtons(selected);
            await interaction.update({ embeds: [embed], components });
          } catch (err) {
            this.logger.error('EventListener', 'Button interaction error', err);
          }
          return;
        }

        return;
      }

      if (!interaction.isChatInputCommand()) return;

      const cmd = this.commandHandler.commands.get(interaction.commandName);
      if (!cmd) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Unknown command.')],
          flags: 64
        });
      }

      if (!interaction.inGuild()) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('This command can only be used in a server.')],
          flags: 64
        });
      }

      try {
        await cmd.execute(interaction);
      } catch (err) {
        this.logger.error('EventListener', `/${interaction.commandName}`, err);

        const payload = {
          embeds: [
            new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle('Unexpected Error')
              .setDescription('An unexpected error occurred. Please try again.')
          ],
          flags: 64
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload);
        } else {
          await interaction.reply(payload);
        }
      }
    });
  }

  start() {
    this.registerBotEvents();
    this.logger.info('EventListener', 'Event listener service started');
  }
}

module.exports = EventListener;