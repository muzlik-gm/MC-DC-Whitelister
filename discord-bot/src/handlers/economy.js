const { EmbedBuilder } = require('discord.js');
const MinecraftApi = require('../services/MinecraftApi');

async function economyHandler(ctx) {
  if (!ctx.guildConfig) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('This server is not linked to any Minecraft server.')]
    });
  }

  const sub = ctx.options.get('sub') || ctx.options.get('action');

  if (sub === 'balance') return handleBalance(ctx);
  if (sub === 'give') return handleGive(ctx);

  return ctx.reply({
    embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Unknown subcommand.')]
  });
}

async function handleBalance(ctx) {
  const username = ctx.options.get('username');
  if (!username || username.trim().length === 0) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Specify a Minecraft username.')]
    });
  }

  await ctx.deferReply();

  const api = new MinecraftApi(ctx.guildConfig);
  const res = await api.getBalance(username);

  if (!res.ok) {
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(res.error || 'Could not fetch balance.')]
    });
  }

  return ctx.editReply({
    embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle('Economy').setDescription(`**${username}**'s balance: **${res.balance}**`)]
  });
}

async function handleGive(ctx) {
  const username = ctx.options.get('username');
  const amount = Number(ctx.options.get('amount'));
  const reason = ctx.options.get('reason') || null;

  if (!username) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Specify a Minecraft username.')]
    });
  }

  if (isNaN(amount) || amount <= 0) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Amount must be a positive number.')]
    });
  }

  await ctx.deferReply();

  const api = new MinecraftApi(ctx.guildConfig);
  const res = await api.giveMoney(username, amount, reason);

  if (!res.ok) {
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(res.error || 'Could not give money.')]
    });
  }

  return ctx.editReply({
    embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle('Economy').setDescription(`Gave **${amount}** to **${username}**.${reason ? `\nReason: ${reason}` : ''}`)]
  });
}

module.exports = economyHandler;
