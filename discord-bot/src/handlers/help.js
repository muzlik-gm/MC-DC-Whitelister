const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const CATEGORIES = {
  player: {
    title: 'Player Commands',
    color: 0x2ecc71,
    emoji: '\uD83C\uDFAE',
    desc: 'Commands available to everyone:',
    commands: [
      ['`/whitelist <username>`', 'Link your Minecraft account to Discord'],
      ['`/unlink`', 'Remove your linked Minecraft account'],
      ['`/status`', 'Check your link status and server info'],
      ['`/applications apply <username>`', 'Submit a whitelist application'],
      ['`/rep give <user> [reason]`', 'Give reputation to another player'],
      ['`/rep check [user]`', 'Check reputation score'],
      ['`/rep leaderboard`', 'View reputation rankings'],
      ['`/referrals leaderboard`', 'View top referrers leaderboard'],
    ],
  },
  setup: {
    title: 'Server Setup',
    color: 0xe67e22,
    emoji: '\u2699\uFE0F',
    desc: 'Configure your Minecraft server connection:',
    commands: [
      ['`/setup`', 'Manually configure MC server details'],
      ['`/pair`', 'Generate a pairing code to connect'],
      ['`/connect <code>`', 'Complete the pairing process'],
      ['`/unlinkserver`', 'Disconnect Discord from MC server'],
      ['`/config`', 'Open the configuration panel'],
      ['`/onboarding channel <ch>`', 'Set welcome message channel'],
      ['`/onboarding message <text>`', 'Set welcome message template'],
      ['`/onboarding role <role>`', 'Set auto-assign role for joiners'],
    ],
  },
  management: {
    title: 'Server Management',
    color: 0x3498db,
    emoji: '\uD83D\uDCCA',
    desc: 'Monitor and manage your server:',
    commands: [
      ['`/console <command>`', 'Run any MC server command remotely'],
      ['`/logging channel <ch>`', 'Set channel for activity logs'],
      ['`/logging types`', 'Toggle join/leave/death/advancement logs'],
      ['`/logging status`', 'Show current log configuration'],
      ['`/logging clear`', 'Remove logging channel'],
      ['`/statuschannel set <on> <pl>`', 'Set dynamic online player channels'],
      ['`/nickname sync`', 'Sync all nicknames to MC usernames'],
      ['`/nickname format <fmt>`', 'Set nickname format template'],
      ['`/cleanup config [days]`', 'Set inactivity auto-removal'],
      ['`/cleanup dryrun`', 'Preview inactive accounts'],
      ['`/cleanup run`', 'Remove inactive whitelist entries'],
    ],
  },
  moderation: {
    title: 'Staff Moderation',
    color: 0xe74c3c,
    emoji: '\uD83D\uDD28',
    desc: 'Cross-platform moderation tools:',
    commands: [
      ['`/ban <username> [reason]`', 'Ban a player from MC server'],
      ['`/kick <username> [reason]`', 'Kick an online player'],
      ['`/mute <user> <duration> [reason]`', 'Mute a player'],
      ['`/mute remove <username>`', 'Unmute a player'],
      ['`/warn <username> <reason>`', 'Issue a warning to a player'],
      ['`/warnings <username>`', 'View all warnings'],
      ['`/delwarn <id>`', 'Remove a specific warning'],
      ['`/notes add <user> <content>`', 'Add a private staff note'],
      ['`/notes list <username>`', 'View staff notes'],
      ['`/audit [limit]`', 'Recent staff actions log'],
    ],
  },
  community: {
    title: 'Community Features',
    color: 0x9b59b6,
    emoji: '\uD83C\uDF10',
    desc: 'Grow and engage your community:',
    commands: [
      ['`/roles set @role <group>`', 'Map Discord role to LuckPerms group'],
      ['`/roles list`', 'View all role mappings'],
      ['`/roles sync`', 'Sync all members to their mapped groups'],
      ['`/events create`', 'Create a scheduled event'],
      ['`/events list`', 'View upcoming events'],
      ['`/events rsvp <id>`', 'RSVP to an event'],
      ['`/tempwhitelist add <user> <h>`', 'Time-limited whitelist invite'],
      ['`/applications setup`', 'Configure application questions'],
      ['`/applications pending`', 'Review pending applications'],
      ['`/applications approve <id>`', 'Approve an application'],
      ['`/economy balance <user>`', 'Check in-game balance'],
      ['`/economy give <user> <amt>`', 'Give in-game currency'],
      ['`/donations set <user> <amt>`', 'Record a donation'],
    ],
  },
  info: {
    title: 'Information',
    color: 0x95a5a6,
    emoji: '\u2139\uFE0F',
    desc: 'Helpful information:',
    commands: [
      ['`/help [category]`', 'This command — view help by category'],
      ['`/tutorial`', 'Full setup guide with step-by-step'],
      ['`/about`', 'Bot information and version'],
    ],
  },
};

const CATEGORY_ORDER = ['player', 'setup', 'management', 'moderation', 'community', 'info'];
const CATEGORY_LABELS = {
  player: 'Player',
  setup: 'Setup',
  management: 'Management',
  moderation: 'Moderation',
  community: 'Community',
  info: 'Info',
};

function buildButtons(selected) {
  const row1 = new ActionRowBuilder();
  const row2 = new ActionRowBuilder();

  for (let i = 0; i < CATEGORY_ORDER.length; i++) {
    const key = CATEGORY_ORDER[i];
    const btn = new ButtonBuilder()
      .setCustomId(`help_${key}`)
      .setLabel(CATEGORY_LABELS[key])
      .setEmoji(CATEGORIES[key].emoji)
      .setStyle(key === selected ? ButtonStyle.Primary : ButtonStyle.Secondary);

    if (i < 5) {
      row1.addComponents(btn);
    } else {
      row2.addComponents(btn);
    }
  }

  return row2.components.length > 0 ? [row1, row2] : [row1];
}

function buildEmbed(category) {
  const cat = CATEGORIES[category];
  if (!cat) {
    return new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('WhitelistBot Commands')
      .setDescription(
        'Browse all available commands using the buttons below.\n\n' +
        'All commands work as both **slash commands** (`/`) and **prefix commands** (`>`).'
      )
      .addFields(
        { name: '\uD83C\uDFAE Player', value: '8 commands', inline: true },
        { name: '\u2699\uFE0F Setup', value: '8 commands', inline: true },
        { name: '\uD83D\uDCCA Management', value: '11 commands', inline: true },
        { name: '\uD83D\uDD28 Moderation', value: '10 commands', inline: true },
        { name: '\uD83C\uDF10 Community', value: '13 commands', inline: true },
        { name: '\u2139\uFE0F Info', value: '3 commands', inline: true },
      )
      .setFooter({ text: 'Click a button to view commands' });
  }

  const lines = cat.commands.map(([cmd, desc]) => `${cmd} — ${desc}`).join('\n');
  return new EmbedBuilder()
    .setColor(cat.color)
    .setTitle(`${cat.emoji} ${cat.title}`)
    .setDescription(cat.desc)
    .addFields({ name: 'Commands', value: lines, inline: false });
}

async function help(ctx) {
  const category = ctx.options.get('category');
  const embed = buildEmbed(category);
  const components = buildButtons(category || null);
  return ctx.reply({ embeds: [embed], components });
}

module.exports = { help, buildEmbed, buildButtons, CATEGORIES };
