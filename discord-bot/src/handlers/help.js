const { EmbedBuilder } = require('discord.js');

async function help(ctx) {
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('🔐 WhitelistBot Commands')
    .setDescription('You can use either slash commands (`/`) or prefix commands (`>`) — they work identically.')
    .addFields(
      { name: '👤 Player Commands', value: '`>whitelist <username>` / `/whitelist` — Link your Minecraft account\n`>unlink` / `/unlink` — Remove your account\n`>status` / `/status` — Check your link status\n`/applications apply <username>` — Submit a whitelist application\n`/rep give <user> [reason]` — Give reputation\n`/rep check [user]` — Check reputation\n`/rep leaderboard` — View reputation rankings\n`/referrals leaderboard` — View top referrers', inline: false },
      { name: '🛠️ Admin Commands', value: '`/setup` — Manual config\n`/pair` — Generate pairing code\n`/connect` — Complete pairing\n`/unlinkserver` — Disconnect server\n`/config` — Configuration panel\n`/console <command>` — Run MC command remotely\n`/logging` — Activity log setup\n`/roles` — Manage role → group mappings\n`/events` — Community events\n`/onboarding` — Welcome message setup\n`/ban <username>` — Ban a player\n`/kick <username>` — Kick a player\n`/warn <username>` — Warn a player\n`/warnings <username>` — View warnings\n`/delwarn <id>` — Remove a warning\n`/applications setup` — Configure application questions\n`/applications pending` — View pending applications\n`/applications approve <id>` — Approve an application\n`/applications reject <id> <note>` — Reject an application\n`/applications questions add <question>` — Add a question\n`/applications questions remove <id>` — Remove a question\n`/applications questions list` — List questions\n`/rep role add <min_rep> <role>` — Auto-assign role at rep threshold\n`/rep role remove <min_rep>` — Remove rep role\n`/rep role list` — List rep roles\n`/cleanup config [days] [enabled]` — Set inactivity threshold\n`/cleanup dryrun` — Preview cleanup\n`/cleanup run` — Execute cleanup\n`/economy balance <username>` — Check balance\n`/economy give <username> <amount>` — Give money\n`/donations set <username> <amount>` — Record donation\n`/donations recent` — Recent donations\n`/donations leaderboard` — Top donors', inline: false },
      { name: 'ℹ️ Info Commands', value: '`>tutorial` / `/tutorial` — Full setup guide\n`>help` / `/help` — This message\n`>about` / `/about` — Bot info', inline: false }
    );

  return ctx.reply({ embeds: [embed] });
}

module.exports = help;
