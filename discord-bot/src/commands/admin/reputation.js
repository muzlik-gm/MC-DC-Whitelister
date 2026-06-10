const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guilds = require('../../database/guilds');
const handler = require('../../handlers/reputation');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rep')
    .setDescription('Reputation system')
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub.setName('give')
        .setDescription('Give reputation to a user')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('The user to give reputation to')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('reason')
            .setDescription('Reason for giving reputation')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('check')
        .setDescription('Check a user\'s reputation')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('The user to check (defaults to you)')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('leaderboard')
        .setDescription('View reputation leaderboard'))
    .addSubcommandGroup(group =>
      group.setName('role')
        .setDescription('Manage auto-assign roles for reputation thresholds')
        .addSubcommand(sub =>
          sub.setName('add')
            .setDescription('Set a role to auto-assign at a rep threshold')
            .addIntegerOption(opt =>
              opt.setName('min_rep')
                .setDescription('Minimum reputation required')
                .setRequired(true))
            .addRoleOption(opt =>
              opt.setName('role')
                .setDescription('Role to assign')
                .setRequired(true)))
        .addSubcommand(sub =>
          sub.setName('remove')
            .setDescription('Remove a rep role threshold')
            .addIntegerOption(opt =>
              opt.setName('min_rep')
                .setDescription('The min reputation threshold to remove')
                .setRequired(true)))
        .addSubcommand(sub =>
          sub.setName('list')
            .setDescription('List all rep role thresholds'))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup();

    const ctx = {
      reply: (data) => interaction.reply({ ...data, flags: 64 }),
      deferReply: (opts) => interaction.deferReply({ ...opts, flags: 64 }),
      editReply: (data) => interaction.editReply(data),
      options: new Map(),
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      guildId: interaction.guildId,
      member: interaction.member,
      guildConfig: guilds.getConfig(interaction.guildId),
    };

    if (group === 'role') {
      ctx.options.set('sub', 'roles');
      ctx.options.set('action', sub);
      if (sub === 'add') {
        ctx.options.set('min_rep', interaction.options.getInteger('min_rep'));
        ctx.options.set('role', interaction.options.getRole('role'));
      } else if (sub === 'remove') {
        ctx.options.set('min_rep', interaction.options.getInteger('min_rep'));
      }
    } else {
      ctx.options.set('sub', sub);
      if (sub === 'give') {
        ctx.options.set('user', interaction.options.getUser('user'));
        ctx.options.set('reason', interaction.options.getString('reason'));
      } else if (sub === 'check') {
        ctx.options.set('user', interaction.options.getUser('user'));
      }
    }

    if (group === 'role') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          embeds: [new (require('discord.js').EmbedBuilder)().setColor(0xe74c3c).setDescription('You need Administrator permission.')],
          flags: 64
        });
      }
    }

    await handler(ctx);
  }
};
