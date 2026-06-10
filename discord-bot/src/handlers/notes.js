const { EmbedBuilder } = require('discord.js');
const notesDb = require('../database/notes');
const whitelistDb = require('../database/whitelist');
const { isValidMinecraftUsername } = require('../utils/validation');
const { logAction } = require('../database/audit');

async function notesHandler(ctx) {
  if (!ctx.guildConfig) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('This server is not linked to any Minecraft server. Pair one first with `/pair` or `>pair`.')]
    });
  }

  const action = ctx.options.get('action');

  if (action === 'add') return handleAdd(ctx);
  if (action === 'list') return handleList(ctx);
  if (action === 'remove') return handleRemove(ctx);

  return ctx.reply({
    embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Usage: `/notes add <username> <content>`, `/notes list <username>`, or `/notes remove <id>`')]
  });
}

async function handleAdd(ctx) {
  const username = ctx.options.get('username');
  if (!username || !isValidMinecraftUsername(username)) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Invalid Minecraft username.')]
    });
  }

  const content = ctx.options.get('content');
  if (!content || content.trim().length === 0) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Note content cannot be empty.')]
    });
  }

  const existing = whitelistDb.getByMinecraftUsername(ctx.guildId, username);
  const uuid = existing ? existing.discord_id : username;
  const playerName = existing ? existing.minecraft_username : username;

  const result = notesDb.addNote(ctx.guildId, uuid, playerName, ctx.userId, ctx.userTag, content);

  logAction(ctx.guildId, 'note_add', ctx.userId, username, content);

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Note Added')
    .setDescription(`Note for **${username}** (ID: \`${result.id}\`).`);

  return ctx.reply({ embeds: [embed] });
}

async function handleList(ctx) {
  const username = ctx.options.get('username');
  if (!username || !isValidMinecraftUsername(username)) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Invalid Minecraft username.')]
    });
  }

  const existing = whitelistDb.getByMinecraftUsername(ctx.guildId, username);
  const uuid = existing ? existing.discord_id : username;

  const notes = notesDb.getNotes(ctx.guildId, uuid);

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`Notes for ${username}`)
    .setDescription(notes.length === 0 ? 'No notes found.' : `${notes.length} note(s):`);

  if (notes.length > 0) {
    const lines = notes.map(n =>
      `**#${n.id}** — ${n.content}\nBy ${n.author_name} — ${n.created_at}`
    );
    embed.addFields({ name: 'Notes', value: lines.join('\n\n'), inline: false });
  }

  return ctx.reply({ embeds: [embed] });
}

async function handleRemove(ctx) {
  const id = ctx.options.get('id');
  if (id == null) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Specify a note ID.')]
    });
  }

  const result = notesDb.removeNote(id);
  if (!result.ok) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`Note ID \`${id}\` not found.`)]
    });
  }

  logAction(ctx.guildId, 'note_remove', ctx.userId, null, `Note ID: ${id}`);

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Note Removed')
    .setDescription(`Note ID \`${id}\` has been removed.`);

  return ctx.reply({ embeds: [embed] });
}

module.exports = notesHandler;
