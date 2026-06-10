const { EmbedBuilder } = require('discord.js');
const guilds = require('./database/guilds');
const logger = require('./utils/logger');

const PREFIX = '>';

const handlers = {
  whitelist: require('./handlers/whitelist'),
  unlink: require('./handlers/unlink'),
  status: require('./handlers/status'),
  setup: require('./handlers/setup'),
  connect: require('./handlers/connect'),
  pair: require('./handlers/pair'),
  unlinkserver: require('./handlers/unlinkserver'),
  tutorial: require('./handlers/tutorial'),
  help: require('./handlers/help'),
  about: require('./handlers/about'),
  config: require('./handlers/config').handleCommand,
  console: require('./handlers/console'),
  logging: require('./handlers/logging'),
  roles: require('./handlers/roles'),
  ban: require('./handlers/moderation'),
  kick: require('./handlers/moderation'),
  warn: require('./handlers/moderation'),
  warnings: require('./handlers/moderation'),
  delwarn: require('./handlers/moderation'),
  referrals: require('./handlers/referrals'),
  events: require('./handlers/events'),
  onboarding: require('./handlers/onboarding'),
  nickname: require('./handlers/nickname').handleSync,
  statuschannel: require('./handlers/statuschannel').handleStatus,
  mute: require('./handlers/mute'),
  notes: require('./handlers/notes'),
  audit: require('./handlers/audit'),
  tempwhitelist: require('./handlers/tempwhitelist'),
  applications: require('./handlers/applications'),
  rep: require('./handlers/reputation'),
  cleanup: require('./handlers/cleanup'),
  economy: require('./handlers/economy'),
  donations: require('./handlers/donations'),
};

const ADMIN_ONLY = new Set(['setup', 'pair', 'connect', 'unlinkserver', 'config', 'console', 'logging', 'roles', 'ban', 'kick', 'warn', 'delwarn', 'events', 'onboarding', 'nickname', 'statuschannel', 'mute', 'notes', 'audit', 'tempwhitelist', 'cleanup', 'economy', 'donations']);

// command aliases
const ALIASES = {
  wl: 'whitelist',
  disconnectserver: 'unlinkserver',
  info: 'help',
  commands: 'help',
};

function parseOptions(args, cmdMeta) {
  if (!cmdMeta || !cmdMeta.options) {
    return new Map();
  }

  const options = new Map();
  const namedArgs = [];
  const positionalArgs = [];

  for (const arg of args) {
    if (arg.includes(':')) {
      namedArgs.push(arg);
    } else {
      positionalArgs.push(arg);
    }
  }

  const namedMap = new Map();
  for (const arg of namedArgs) {
    const idx = arg.indexOf(':');
    const key = arg.slice(0, idx);
    const val = arg.slice(idx + 1);
    namedMap.set(key, val);
  }

  const positionalMeta = cmdMeta.options.filter(o => !o.named);

  let posIdx = 0;
  for (const meta of positionalMeta) {
    const namedVal = namedMap.get(meta.name);
    if (namedVal !== undefined) {
      options.set(meta.name, namedVal);
    } else if (posIdx < positionalArgs.length) {
      options.set(meta.name, positionalArgs[posIdx]);
      posIdx++;
    }
  }

  for (const meta of cmdMeta.options) {
    if (meta.named) {
      const val = namedMap.get(meta.name) || namedMap.get(meta.alias);
      if (val !== undefined) {
        options.set(meta.name, val);
      }
    }
  }

  return options;
}

const COMMAND_META = {
  whitelist: {
    options: [
      { name: 'username', named: false }
    ]
  },
  setup: {
    options: [
      { name: 'apikey', named: true, alias: 'key' },
      { name: 'host', named: true, alias: 'ip' },
      { name: 'port', named: true, alias: 'p' },
      { name: 'role', named: true, alias: 'r' },
    ]
  },
  connect: {
    options: [
      { name: 'code', named: false },
      { name: 'ip', named: true, alias: 'ip' },
      { name: 'port', named: true, alias: 'p' },
    ]
  },
  pair: {
    options: [
      { name: 'ip', named: true, alias: 'ip' },
      { name: 'port', named: true, alias: 'p' },
    ]
  },
  console: {
    options: [
      { name: 'command', named: false },
    ]
  },
  logging: {
    options: [
      { name: 'action', named: false },
      { name: 'channel', named: true, alias: 'ch' },
      { name: 'join', named: true },
      { name: 'leave', named: true },
      { name: 'death', named: true },
      { name: 'advancement', named: true },
    ]
  },
  roles: {
    options: [
      { name: 'action', named: false },
      { name: 'role', named: false },
      { name: 'group', named: true },
    ]
  },
  ban: {
    options: [
      { name: 'username', named: false },
      { name: 'reason', named: true },
    ]
  },
  kick: {
    options: [
      { name: 'username', named: false },
      { name: 'reason', named: true },
    ]
  },
  warn: {
    options: [
      { name: 'username', named: false },
      { name: 'reason', named: true },
    ]
  },
  warnings: {
    options: [
      { name: 'username', named: false },
    ]
  },
  delwarn: {
    options: [
      { name: 'id', named: false },
    ]
  },
  referrals: {
    options: [
      { name: 'sub', named: false },
    ]
  },
  events: {
    options: [
      { name: 'sub', named: false },
      { name: 'name', named: true },
      { name: 'description', named: true },
      { name: 'mc_command', named: true },
      { name: 'reward_role', named: true },
      { name: 'max_participants', named: true },
      { name: 'starts_at', named: true },
      { name: 'event_id', named: true },
      { name: 'minecraft_username', named: true },
    ]
  },
  onboarding: {
    options: [
      { name: 'sub', named: false },
      { name: 'channel', named: true },
      { name: 'text', named: true },
      { name: 'role', named: true },
    ]
  },
  nickname: {
    options: [
      { name: 'sub', named: false },
      { name: 'format', named: true },
    ]
  },
  statuschannel: {
    options: [
      { name: 'sub', named: false },
    ]
  },
  mute: {
    options: [
      { name: 'username', named: false },
      { name: 'duration', named: false },
      { name: 'reason', named: true },
      { name: 'remove', named: true },
    ]
  },
  notes: {
    options: [
      { name: 'sub', named: false },
      { name: 'username', named: false },
      { name: 'content', named: true },
      { name: 'id', named: true },
    ]
  },
  audit: {
    options: [
      { name: 'limit', named: false },
    ]
  },
  tempwhitelist: {
    options: [
      { name: 'sub', named: false },
      { name: 'username', named: false },
      { name: 'duration', named: true },
    ]
  },
  applications: {
    options: [
      { name: 'sub', named: false },
      { name: 'username', named: false },
      { name: 'id', named: true },
      { name: 'note', named: true },
      { name: 'question', named: true },
    ]
  },
  rep: {
    options: [
      { name: 'sub', named: false },
      { name: 'user', named: false },
      { name: 'reason', named: true },
      { name: 'min_rep', named: true },
      { name: 'role', named: true },
    ]
  },
  cleanup: {
    options: [
      { name: 'sub', named: false },
      { name: 'days', named: true },
      { name: 'enabled', named: true },
    ]
  },
  economy: {
    options: [
      { name: 'sub', named: false },
      { name: 'username', named: false },
      { name: 'amount', named: true },
      { name: 'reason', named: true },
    ]
  },
  donations: {
    options: [
      { name: 'sub', named: false },
      { name: 'username', named: false },
      { name: 'amount', named: true },
    ]
  },
};

function createContext(message, commandName, options) {
  const ctx = {
    _replyMsg: null,
    options,
    userId: message.author.id,
    userTag: message.author.tag,
    guildId: message.guild.id,
    member: message.member,
    guildConfig: guilds.getConfig(message.guild.id),
    channel: message.channel,

    reply: async (data) => {
      if (data.embeds && data.embeds.length > 0) {
        const msg = await message.reply({ embeds: data.embeds });
        ctx._replyMsg = msg;
        return msg;
      }
      const msg = await message.reply(data);
      ctx._replyMsg = msg;
      return msg;
    },

    deferReply: async () => {
      const msg = await message.reply({ content: '⏳ Processing...' });
      ctx._replyMsg = msg;
    },

    editReply: async (data) => {
      if (ctx._replyMsg) {
        try {
          const editData = {};
          if (data.content) editData.content = data.content;
          if (data.embeds) { editData.content = null; editData.embeds = data.embeds; }
          if (data.components) editData.components = data.components;
          await ctx._replyMsg.edit(editData);
          return;
        } catch {
          // fall through to new reply
        }
      }
      if (data.embeds && data.embeds.length > 0) {
        const msg = await message.reply({ embeds: data.embeds });
        ctx._replyMsg = msg;
      }
    },
  };

  return ctx;
}

function handleMessage(message) {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const rawCommand = args.shift().toLowerCase();
  const commandName = ALIASES[rawCommand] || rawCommand;

  if (!handlers[commandName]) {
    message.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`Unknown command. Use \`>help\` to see available commands.`)]
    }).catch(() => {});
    return;
  }

  if (!message.member) {
    message.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('This command can only be used in a server.')]
    }).catch(() => {});
    return;
  }

  if (ADMIN_ONLY.has(commandName)) {
    if (!message.member.permissions.has('Administrator')) {
      message.reply({
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('You need the **Administrator** permission to use this command.')]
      }).catch(() => {});
      return;
    }
  }

  const meta = COMMAND_META[commandName];
  const options = parseOptions(args, meta);

  const ctx = createContext(message, commandName, options);

  handlers[commandName](ctx).catch(err => {
    logger.error('Commands', `>${commandName}`, err);
    const payload = {
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Unexpected Error').setDescription('An unexpected error occurred. Please try again.')]
    };
    if (ctx._replyMsg) {
      ctx._replyMsg.edit(payload).catch(() => {});
    } else {
      message.reply(payload).catch(() => {});
    }
  });
}

module.exports = { handleMessage, PREFIX, handlers, ADMIN_ONLY };
