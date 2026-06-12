const { EmbedBuilder } = require('discord.js');

class CleanupService {
  constructor(config, logger, bot, apiClient, dbs) {
    this.config = config;
    this.logger = logger;
    this.bot = bot;
    this.apiClient = apiClient;
    this.dbs = dbs;
    this.lastPoll = new Map();
  }

  async performTempWhitelistCleanup() {
    try {
      const expired = this.dbs.tempWhitelist.getExpired();
      for (const entry of expired) {
        try {
          const guildCfg = this.dbs.guilds.getConfig(entry.guild_id);
          if (guildCfg) {
            await this.apiClient.removeFromWhitelist(entry.minecraft_username, guildCfg);
          }
          this.dbs.tempWhitelist.removeExpired(entry.id);
        } catch (err) {
          this.logger.error('CleanupService', `Temp whitelist cleanup failed for ${entry.minecraft_username}`, err);
        }
      }
      if (expired.length > 0) {
        this.logger.info('CleanupService', `Cleaned up ${expired.length} expired temp whitelist entries`);
      }
    } catch (err) {
      this.logger.error('CleanupService', 'Temp whitelist cleanup failed', err);
    }
  }

  async performDailyCleanup() {
    try {
      const configs = this.dbs.cleanup.getAllConfigs();
      for (const config of configs) {
        try {
          const guildCfg = this.dbs.guilds.getConfig(config.guild_id);
          if (!guildCfg) continue;

          const entries = this.dbs.cleanup.getInactiveEntries(config.guild_id, config.inactive_days);

          for (const entry of entries) {
            const result = await this.apiClient.removeFromWhitelist(entry.minecraft_username, guildCfg);
            if (result.ok) {
              this.dbs.whitelist.unlinkAccount(config.guild_id, entry.discord_id);
            }
          }

          if (entries.length > 0) {
            this.logger.info('CleanupService', `Cleaned up ${entries.length} inactive entries for guild ${config.guild_id}`);
          }
        } catch (err) {
          this.logger.error('CleanupService', `Daily cleanup failed for guild ${config.guild_id}`, err);
        }
      }
    } catch (err) {
      this.logger.error('CleanupService', 'Daily cleanup failed', err);
    }
  }

  async performActivityPolling() {
    try {
      const now = Math.floor(Date.now() / 1000);
      const settings = this.dbs.settings;

      for (const [guildId, guild] of this.bot.guilds.cache) {
        const guildCfg = this.dbs.guilds.getConfig(guildId);
        if (!guildCfg) continue;

        const gc = settings.getSettings(guildId);
        if (!gc?.log_channel_id) continue;

        const since = this.lastPoll.get(guildId) || now - 30;
        this.lastPoll.set(guildId, now);

        const res = await this.apiClient.get(`/api/activity/poll?since=${since}`, guildCfg);
        if (!res.ok || !res.events?.length) continue;

        const channel = guild.channels.cache.get(gc.log_channel_id);
        if (!channel) continue;

        for (const evt of res.events) {
          await this.handleActivityEvent(channel, guild, evt, gc);
        }
      }
    } catch (err) {
      this.logger.error('CleanupService', 'Activity polling failed', err);
    }
  }

  async handleActivityEvent(channel, guild, evt, gc) {

    const type = evt.type;
    const player = evt.player;
    const detail = evt.detail || '';
    const hours = evt.hours;

    let color = 0x2ecc71;
    let title = '';
    let desc = '';

    const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc);

    switch (type) {
      case 'join':
        color = 0x2ecc71;
        title = 'Player Joined';
        desc = `**${player}** joined the server`;
        if (gc.log_joins) {
          embed.setColor(color).setTitle(title).setDescription(desc);
          channel.send({ embeds: [embed] }).catch(() => {});
        }
        if (gc.nickname_format && gc.nickname_format !== '{username}') {
          const whitelistDb = this.dbs.whitelist;
          const rolesDb = this.dbs.roles;
          const { buildNickname } = require('../handlers/nickname');
          const entry = whitelistDb.getByMinecraftUsername(guild.id, player);
          if (entry) {
            const member = guild.members.cache.get(entry.discord_id);
            if (member) {
              const memberRoles = member.roles.cache.map(r => r.id);
              const mapping = rolesDb.getGroupForRoles(guild.id, memberRoles);
              const nickname = buildNickname(gc.nickname_format, player, mapping || '', '');
              if (member.nickname !== nickname) {
                member.setNickname(nickname).catch(() => {});
              }
            }
          }
        }
        break;

      case 'first_join':
        color = 0x3498db;
        title = 'First Join';
        desc = `**${player}** joined for the first time!`;
        if (gc.log_joins) {
          embed.setColor(color).setTitle(title).setDescription(desc);
          channel.send({ embeds: [embed] }).catch(() => {});
        }
        break;

      case 'leave':
        color = 0xe67e22;
        title = 'Player Left';
        desc = `**${player}** left the server`;
        if (gc.log_leaves) {
          embed.setColor(color).setTitle(title).setDescription(desc);
          channel.send({ embeds: [embed] }).catch(() => {});
        }
        break;

      case 'death':
        color = 0xe74c3c;
        title = 'Player Died';
        desc = detail || `**${player}** died`;
        if (gc.log_deaths) {
          embed.setColor(color).setTitle(title).setDescription(desc);
          channel.send({ embeds: [embed] }).catch(() => {});
        }
        break;

      case 'advancement': {
        color = 0xf1c40f;
        title = 'Advancement';
        const name = detail.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        desc = `**${player}** earned **${name}**`;
        if (gc.log_advancements) {
          embed.setColor(color).setTitle(title).setDescription(desc);
          channel.send({ embeds: [embed] }).catch(() => {});
        }
        break;
        }

      case 'milestone':
        if (gc.log_milestones) {
          color = 0x9b59b6;
          title = 'Playtime Milestone';
          desc = `**${player}** reached **${hours}** hours of playtime!`;
          embed.setColor(color).setTitle(title).setDescription(desc);
          channel.send({ embeds: [embed] }).catch(() => {});
        }
        break;
    }
  }

  async performStatusChannelUpdates() {
    try {
      const { updateStatusChannels } = require('../handlers/statuschannel');
      await updateStatusChannels(this.bot);
    } catch (err) {
      this.logger.error('CleanupService', 'Status channel update failed', err);
    }
  }

  async performAllCleanups() {
    this.logger.info('CleanupService', 'Starting periodic cleanup operations');
    await this.performTempWhitelistCleanup();
    await this.performDailyCleanup();
    await this.performActivityPolling();
    await this.performStatusChannelUpdates();
    this.logger.info('CleanupService', 'Completed periodic cleanup operations');
  }

  start() {
    const interval = setInterval(() => this.performAllCleanups(), 300000);
    this.logger.info('CleanupService', 'Cleanup service started');
    return interval;
  }
}

module.exports = CleanupService;