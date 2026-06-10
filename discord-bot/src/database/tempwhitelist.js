const { getDb } = require('./index');

let stmts = null;

function ensureStmts() {
  if (stmts) return stmts;
  const db = getDb();
  stmts = {
    add: db.prepare(`
      INSERT INTO temp_whitelist (guild_id, discord_id, minecraft_username, expires_at, created_by)
      VALUES (@guild_id, @discord_id, @minecraft_username, @expires_at, @created_by)
    `),
    getActive: db.prepare("SELECT * FROM temp_whitelist WHERE guild_id = ? AND expires_at > datetime('now') ORDER BY created_at DESC"),
    getExpired: db.prepare("SELECT * FROM temp_whitelist WHERE expires_at <= datetime('now')"),
    remove: db.prepare('DELETE FROM temp_whitelist WHERE guild_id = ? AND minecraft_username = ?'),
    removeExpired: db.prepare('DELETE FROM temp_whitelist WHERE id = ?'),
  };
  return stmts;
}

function addTempWhitelist(guildId, discordId, minecraftUsername, expiresAt, createdBy) {
  const s = ensureStmts();
  const info = s.add.run({
    guild_id: guildId,
    discord_id: discordId || null,
    minecraft_username: minecraftUsername,
    expires_at: expiresAt,
    created_by: createdBy,
  });
  return { ok: true, id: info.lastInsertRowid };
}

function getActive(guildId) {
  const s = ensureStmts();
  return s.getActive.all(guildId);
}

function getExpired() {
  const s = ensureStmts();
  return s.getExpired.all();
}

function remove(guildId, minecraftUsername) {
  const s = ensureStmts();
  const info = s.remove.run(guildId, minecraftUsername);
  return { ok: info.changes > 0 };
}

function removeExpired(id) {
  const s = ensureStmts();
  s.removeExpired.run(id);
}

module.exports = { addTempWhitelist, getActive, getExpired, remove, removeExpired };
