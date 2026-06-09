const { getDb } = require('./index');

let stmts = null;

function ensureStmts() {
  if (stmts) return stmts;
  const db = getDb();
  stmts = {
    insert: db.prepare(`
      INSERT INTO whitelist_entries (guild_id, discord_id, minecraft_username, discord_tag)
      VALUES (@guild_id, @discord_id, @minecraft_username, @discord_tag)
    `),
    findByDiscord: db.prepare(
      'SELECT * FROM whitelist_entries WHERE guild_id = ? AND discord_id = ?'
    ),
    findByMinecraft: db.prepare(
      'SELECT * FROM whitelist_entries WHERE guild_id = ? AND minecraft_username = ?'
    ),
    remove: db.prepare(
      'DELETE FROM whitelist_entries WHERE guild_id = ? AND discord_id = ?'
    ),
    removeAll: db.prepare(
      'DELETE FROM whitelist_entries WHERE guild_id = ?'
    ),
  };
  return stmts;
}

function linkAccount(guildId, discordId, minecraftUsername, discordTag) {
  const s = ensureStmts();

  const existing = s.findByDiscord.get(guildId, discordId);
  if (existing) {
    return { ok: false, error: 'You already have a linked account in this server. Use `/unlink` first.' };
  }

  const taken = s.findByMinecraft.get(guildId, minecraftUsername);
  if (taken) {
    return { ok: false, error: `\`${minecraftUsername}\` is already whitelisted by another user in this server.` };
  }

  s.insert.run({ guild_id: guildId, discord_id: discordId, minecraft_username: minecraftUsername, discord_tag: discordTag });
  return { ok: true };
}

function unlinkAccount(guildId, discordId) {
  const s = ensureStmts();

  const existing = s.findByDiscord.get(guildId, discordId);
  if (!existing) {
    return { ok: false, error: 'You do not have a linked account in this server.' };
  }

  s.remove.run(guildId, discordId);
  return { ok: true, minecraft_username: existing.minecraft_username };
}

function getLink(guildId, discordId) {
  const s = ensureStmts();
  return s.findByDiscord.get(guildId, discordId) || null;
}

function removeAllForGuild(guildId) {
  const s = ensureStmts();
  const count = s.removeAll.run(guildId).changes;
  return { ok: true, removed: count };
}

module.exports = { linkAccount, unlinkAccount, getLink, removeAllForGuild };
