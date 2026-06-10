const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guilds = require('../../database/guilds');
const handler = require('../../handlers/setup');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure the Minecraft server connection for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('apikey')
        .setDescription('The API key from the plugin\'s config.yml')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('host')
        .setDescription('Minecraft server IP or hostname (default: 127.0.0.1)')
        .setRequired(false))
    .addIntegerOption(opt =>
      opt.setName('port')
        .setDescription('Plugin HTTP server port (default: 25252)')
        .setRequired(false))
    .addRoleOption(opt =>
      opt.setName('role')
        .setDescription('Role required to use /whitelist (default: no restriction)')
        .setRequired(false)),

  async execute(interaction) {
    const ctx = {
      reply: (data) => interaction.reply({ ...data, flags: 64 }),
      deferReply: () => interaction.deferReply({ flags: 64 }),
      editReply: (data) => interaction.editReply(data),
      options: new Map(interaction.options.data.map(o => [o.name, o.value])),
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      guildId: interaction.guildId,
      member: interaction.member,
      guildConfig: guilds.getConfig(interaction.guildId),
    };
    await handler(ctx);
  }
};
