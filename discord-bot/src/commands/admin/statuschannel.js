const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guilds = require('../../database/guilds');
const { handleSet, handleRemove, handleStatus } = require('../../handlers/statuschannel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('statuschannel')
    .setDescription('Manage dynamic voice channels that show server status')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set voice channels for dynamic status display')
        .addChannelOption(opt =>
          opt.setName('online_channel')
            .setDescription('Voice channel to show online count')
            .setRequired(false))
        .addChannelOption(opt =>
          opt.setName('player_channel')
            .setDescription('Voice channel to show player count')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove status channel configuration'))
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Show current status channel configuration')),

  async execute(interaction) {
    const ctx = {
      reply: (data) => interaction.reply({ ...data, flags: 64 }),
      deferReply: () => interaction.deferReply({ flags: 64 }),
      editReply: (data) => interaction.editReply(data),
      options: new Map(),
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      guildId: interaction.guildId,
      member: interaction.member,
      guildConfig: guilds.getConfig(interaction.guildId),
    };

    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      ctx.options.set('online_channel', interaction.options.getChannel('online_channel'));
      ctx.options.set('player_channel', interaction.options.getChannel('player_channel'));
      await handleSet(ctx);
    } else if (sub === 'remove') {
      await handleRemove(ctx);
    } else if (sub === 'status') {
      await handleStatus(ctx);
    }
  }
};