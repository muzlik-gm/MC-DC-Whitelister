const { EmbedBuilder } = require('discord.js');
const appsDb = require('../database/applications');
const whitelistDb = require('../database/whitelist');
const MinecraftApi = require('../services/MinecraftApi');

async function applicationsHandler(ctx) {
  if (!ctx.guildConfig) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('This server is not linked to any Minecraft server.')]
    });
  }

  const sub = ctx.options.get('sub') || ctx.options.get('action') || 'apply';

  if (sub === 'setup') return handleSetup(ctx);
  if (sub === 'apply') return handleApply(ctx);
  if (sub === 'pending') return handlePending(ctx);
  if (sub === 'approve') return handleApprove(ctx);
  if (sub === 'reject') return handleReject(ctx);
  if (sub === 'questions' || sub === 'list') return handleQuestions(ctx);
  if (sub === 'add') return handleAddQuestion(ctx);
  if (sub === 'remove') return handleRemoveQuestion(ctx);

  return ctx.reply({
    embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Unknown subcommand.')]
  });
}

async function handleSetup(ctx) {
  const questions = appsDb.getQuestions(ctx.guildId);
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('Application Setup')
    .setDescription(questions.length === 0 ? 'No questions configured yet.' : `Current questions (${questions.length}):`);

  if (questions.length > 0) {
    const lines = questions.map(q => `**\`${q.id}\`** ${q.question}`);
    embed.addFields({ name: 'Questions', value: lines.join('\n'), inline: false });
  }

  embed.addFields({ name: 'Managing Questions', value: 'Use `/applications questions add <question>` to add\nUse `/applications questions remove <id>` to remove\nPlayers apply with `/applications apply <username>`', inline: false });

  return ctx.reply({ embeds: [embed], ephemeral: true });
}

async function handleApply(ctx) {
  const username = ctx.options.get('username');
  if (!username || username.trim().length === 0) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Specify your Minecraft username. Usage: `/applications apply <username>`')]
    });
  }

  const questions = appsDb.getQuestions(ctx.guildId);
  if (questions.length === 0) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('No application questions have been set up. Tell an admin to run `/applications questions add <question>`.')]
    });
  }

  const existing = whitelistDb.getLink(ctx.guildId, ctx.userId);
  if (existing) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('You are already whitelisted. Use `/unlink` first.')]
    });
  }

  await ctx.deferReply();

  const channel = ctx.channel;
  if (!channel) {
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Could not access channel for collecting answers.')]
    });
  }

  const answers = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await ctx.editReply({
      content: `**Question ${i + 1}/${questions.length}:** ${q.question}\nType your answer in chat.`,
      embeds: []
    });

    const collected = await new Promise(resolve => {
      const filter = m => m.author.id === ctx.userId && !m.author.bot;
      const collector = channel.createMessageCollector({ filter, max: 1, time: 120000 });
      collector.on('collect', m => {
        resolve(m.content);
        m.delete().catch(() => {});
      });
      collector.on('end', collected => {
        if (collected.size === 0) resolve(null);
      });
    });

    if (!collected) {
      return ctx.editReply({
        content: '',
        embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Application timed out. Please try again.')]
      });
    }

    answers.push({ question: q.question, answer: collected });
  }

  const result = appsDb.submitApplication(ctx.guildId, ctx.userId, username, answers);

  return ctx.editReply({
    content: '',
    embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle('Application Submitted').setDescription(`Your application (ID: \`${result.id}\`) has been submitted. An admin will review it shortly.`)]
  });
}

async function handlePending(ctx) {
  const applications = appsDb.getPendingApplications(ctx.guildId);

  if (applications.length === 0) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('No pending applications.')]
    });
  }

  const chunks = [];
  for (const a of applications) {
    const answers = JSON.parse(a.answers);
    const summary = answers.map((q, i) => `**Q${i + 1}:** ${q.answer}`).join('\n');
    const ts = Math.floor(new Date(a.created_at).getTime() / 1000);
    chunks.push(`**\`${a.id}\`** — <@${a.discord_id}> — **${a.minecraft_username}**\n${summary}\n_<t:${ts}:R>_`);
  }

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`Pending Applications (${applications.length})`)
    .setDescription(chunks.join('\n\n'));

  return ctx.reply({ embeds: [embed] });
}

async function handleApprove(ctx) {
  const appId = Number(ctx.options.get('id'));
  const note = ctx.options.get('note') || null;

  const app = appsDb.getApplication(appId);
  if (!app || app.guild_id !== ctx.guildId) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`Application \`${appId}\` not found.`)]
    });
  }

  if (app.status !== 'pending') {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription(`Application \`${appId}\` has already been ${app.status}.`)]
    });
  }

  await ctx.deferReply();

  const api = new MinecraftApi(ctx.guildConfig);
  const apiResult = await api.addToWhitelist(app.minecraft_username);
  if (!apiResult.ok) {
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`Failed to whitelist **${app.minecraft_username}**: ${apiResult.error || 'Unknown error'}`)]
    });
  }

  appsDb.approveApplication(appId, ctx.userId, note);
  whitelistDb.linkAccount(ctx.guildId, app.discord_id, app.minecraft_username, 'Application');

  return ctx.editReply({
    embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle('Application Approved').setDescription(`**${app.minecraft_username}** has been whitelisted.${note ? `\nNote: ${note}` : ''}`)]
  });
}

async function handleReject(ctx) {
  const appId = Number(ctx.options.get('id'));
  const note = ctx.options.get('note');

  if (!note) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('A rejection reason is required. Usage: `/applications reject <id> <note>`')]
    });
  }

  const app = appsDb.getApplication(appId);
  if (!app || app.guild_id !== ctx.guildId) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`Application \`${appId}\` not found.`)]
    });
  }

  if (app.status !== 'pending') {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription(`Application \`${appId}\` has already been ${app.status}.`)]
    });
  }

  appsDb.rejectApplication(appId, ctx.userId, note);

  return ctx.reply({
    embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Application Rejected').setDescription(`**${app.minecraft_username}**'s application rejected.\nReason: ${note}`)]
  });
}

async function handleQuestions(ctx) {
  const questions = appsDb.getQuestions(ctx.guildId);

  if (questions.length === 0) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('No application questions configured.')]
    });
  }

  const lines = questions.map(q => `**\`${q.id}\`** — ${q.question}`);
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('Application Questions')
    .setDescription(lines.join('\n'));

  return ctx.reply({ embeds: [embed] });
}

async function handleAddQuestion(ctx) {
  const question = ctx.options.get('question');
  if (!question || question.trim().length === 0) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Specify a question to add.')]
    });
  }

  appsDb.addQuestion(ctx.guildId, question);
  return ctx.reply({
    embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`Question added.`)]
  });
}

async function handleRemoveQuestion(ctx) {
  const questionId = Number(ctx.options.get('id'));

  if (isNaN(questionId)) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Invalid question ID.')]
    });
  }

  const result = appsDb.removeQuestion(ctx.guildId, questionId);
  if (!result.ok) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`Question \`${questionId}\` not found.`)]
    });
  }

  return ctx.reply({
    embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`Question removed.`)]
  });
}

module.exports = applicationsHandler;
