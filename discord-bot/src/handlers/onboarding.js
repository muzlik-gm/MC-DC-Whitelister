const { EmbedBuilder } = require('discord.js');
const onboardingDb = require('../database/onboarding');

async function onboardingHandler(ctx) {
  const sub = ctx.options.get('sub') || 'status';

  if (sub === 'channel') return handleChannel(ctx);
  if (sub === 'message') return handleMessage(ctx);
  if (sub === 'role') return handleRole(ctx);
  if (sub === 'enable') return handleEnable(ctx);
  if (sub === 'disable') return handleDisable(ctx);
  if (sub === 'status') return handleStatus(ctx);

  return ctx.reply({
    embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Unknown subcommand.')]
  });
}

async function handleChannel(ctx) {
  const channel = ctx.options.get('channel');

  const config = onboardingDb.getConfig(ctx.guildId) || {};
  onboardingDb.setConfig(ctx.guildId, {
    ...config,
    welcome_channel_id: channel.id,
  });

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Welcome Channel Set')
    .setDescription(`Welcome messages will be sent to ${channel}.`);

  return ctx.reply({ embeds: [embed] });
}

async function handleMessage(ctx) {
  const text = ctx.options.get('text');

  const config = onboardingDb.getConfig(ctx.guildId) || {};
  onboardingDb.setConfig(ctx.guildId, {
    ...config,
    welcome_message: text,
  });

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Welcome Message Set')
    .setDescription(`Welcome message updated.\n\nUse \`{user}\` for mentions and \`{server}\` for the server name.\n\nCurrent:\n${text}`);

  return ctx.reply({ embeds: [embed] });
}

async function handleRole(ctx) {
  const role = ctx.options.get('role');

  const config = onboardingDb.getConfig(ctx.guildId) || {};
  onboardingDb.setConfig(ctx.guildId, {
    ...config,
    auto_role_id: role.id,
  });

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Auto-Role Set')
    .setDescription(`New members will automatically receive ${role}.`);

  return ctx.reply({ embeds: [embed] });
}

async function handleEnable(ctx) {
  onboardingDb.setEnabled(ctx.guildId, true);

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Onboarding Enabled')
    .setDescription('Welcome messages and auto-role are now active.');

  return ctx.reply({ embeds: [embed] });
}

async function handleDisable(ctx) {
  onboardingDb.setEnabled(ctx.guildId, false);

  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle('Onboarding Disabled')
    .setDescription('Welcome messages and auto-role are now disabled.');

  return ctx.reply({ embeds: [embed] });
}

async function handleStatus(ctx) {
  const config = onboardingDb.getConfig(ctx.guildId);

  if (!config) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('Onboarding is not configured. Use `/onboarding channel` to set up.')]
    });
  }

  const embed = new EmbedBuilder()
    .setColor(config.enabled ? 0x2ecc71 : 0x95a5a6)
    .setTitle('Onboarding Status')
    .addFields(
      { name: 'Enabled', value: config.enabled ? '✅' : '❌', inline: true },
      { name: 'Welcome Channel', value: config.welcome_channel_id ? `<#${config.welcome_channel_id}>` : 'Not set', inline: true },
      { name: 'Auto-Role', value: config.auto_role_id ? `<@&${config.auto_role_id}>` : 'Not set', inline: true },
    );

  if (config.welcome_message) {
    embed.addFields({ name: 'Welcome Message', value: config.welcome_message, inline: false });
  }

  return ctx.reply({ embeds: [embed] });
}

module.exports = onboardingHandler;
