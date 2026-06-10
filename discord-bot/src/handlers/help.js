const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');

const CATEGORIES = {
  player: {
    title: '👤 Player Commands',
    color: 0x2ecc71,
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
    title: '🛠️ Server Setup',
    color: 0xe67e22,
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
    title: '⚙️ Server Management',
    color: 0x3498db,
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
    title: '🔨 Staff Moderation',
    color: 0xe74c3c,
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
    title: '🎮 Community Features',
    color: 0x9b59b6,
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
    title: 'ℹ️ Info Commands',
    color: 0x95a5a6,
    desc: 'Helpful information:',
    commands: [
      ['`/help [category]`', 'This command — view help by category'],
      ['`/tutorial`', 'Full setup guide with step-by-step'],
      ['`/about`', 'Bot information and version'],
    ],
  },
};

const CATEGORY_LABELS = {
  player: 'Player Commands',
  setup: 'Server Setup',
  management: 'Server Management',
  moderation: 'Staff Moderation',
  community: 'Community Features',
  info: 'Information',
};

function buildMenu(selected) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_category')
      .setPlaceholder('Choose a category...')
      .addOptions(
        Object.entries(CATEGORIES).map(([key, cat]) => ({
          label: CATEGORY_LABELS[key],
          value: key,
          description: `${cat.commands.length} commands`,
          default: key === selected,
        }))
      )
  );
}

function buildEmbed(category) {
  const cat = CATEGORIES[category];
  if (!cat) {
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🔐 WhitelistBot Commands')
      .setDescription(
        'Browse all available commands using the menu below.\n\n' +
        'All commands work as both **slash commands** (`/`) and **prefix commands** (`>`).'
      )
      .addFields(
        { name: '👤 Player', value: '8 commands', inline: true },
        { name: '🛠️ Setup', value: '8 commands', inline: true },
        { name: '⚙️ Management', value: '11 commands', inline: true },
        { name: '🔨 Moderation', value: '10 commands', inline: true },
        { name: '🎮 Community', value: '13 commands', inline: true },
        { name: 'ℹ️ Info', value: '3 commands', inline: true },
      )
      .setFooter({ text: 'Select a category from the menu below' });
    return embed;
  }

  const lines = cat.commands.map(([cmd, desc]) => `${cmd} — ${desc}`).join('\n');
  return new EmbedBuilder()
    .setColor(cat.color)
    .setTitle(cat.title)
    .setDescription(cat.desc)
    .addFields({ name: 'Commands', value: lines, inline: false });
}

async function help(ctx) {
  const category = ctx.options.get('category');
  const embed = buildEmbed(category);
  const menu = buildMenu(category || null);
  return ctx.reply({ embeds: [embed], components: [menu] });
}

module.exports = { help, buildEmbed, buildMenu, CATEGORIES };
