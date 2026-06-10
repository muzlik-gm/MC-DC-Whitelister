const { getDb } = require('./index');

let stmts = null;

function ensureStmts() {
  if (stmts) return stmts;
  const db = getDb();
  stmts = {
    give: db.prepare(`
      INSERT OR IGNORE INTO reputation (guild_id, from_discord_id, to_discord_id, reason)
      VALUES (@guild_id, @from_discord_id, @to_discord_id, @reason)
    `),
    getRepCount: db.prepare('SELECT COUNT(*) AS count FROM reputation WHERE guild_id = ? AND to_discord_id = ?'),
    hasGiven: db.prepare('SELECT id FROM reputation WHERE guild_id = ? AND from_discord_id = ? AND to_discord_id = ?'),
    leaderboard: db.prepare(`
      SELECT to_discord_id, COUNT(*) AS count
      FROM reputation
      WHERE guild_id = ?
      GROUP BY to_discord_id
      ORDER BY count DESC
      LIMIT ?
    `),
    setRepRole: db.prepare(`
      INSERT OR REPLACE INTO reputation_roles (guild_id, min_reputation, role_id)
      VALUES (@guild_id, @min_reputation, @role_id)
    `),
    removeRepRole: db.prepare('DELETE FROM reputation_roles WHERE guild_id = ? AND min_reputation = ?'),
    getRepRoles: db.prepare('SELECT * FROM reputation_roles WHERE guild_id = ? ORDER BY min_reputation ASC'),
    getAllRepRoles: db.prepare('SELECT * FROM reputation_roles ORDER BY guild_id'),
  };
  return stmts;
}

function giveRep(guildId, fromId, toId, reason) {
  const s = ensureStmts();
  const result = s.give.run({ guild_id: guildId, from_discord_id: fromId, to_discord_id: toId, reason: reason || null });
  return { ok: result.changes > 0 };
}

function getRep(guildId, userId) {
  const s = ensureStmts();
  const row = s.getRepCount.get(guildId, userId);
  return row ? row.count : 0;
}

function getLeaderboard(guildId, limit) {
  const s = ensureStmts();
  return s.leaderboard.all(guildId, limit || 10);
}

function hasGiven(guildId, fromId, toId) {
  const s = ensureStmts();
  return !!s.hasGiven.get(guildId, fromId, toId);
}

function setRepRole(guildId, minRep, roleId) {
  const s = ensureStmts();
  s.setRepRole.run({ guild_id: guildId, min_reputation: minRep, role_id: roleId });
}

function removeRepRole(guildId, minRep) {
  const s = ensureStmts();
  s.removeRepRole.run(guildId, minRep);
}

function getRepRoles(guildId) {
  const s = ensureStmts();
  return s.getRepRoles.all(guildId);
}

function getAllRepRoles() {
  const s = ensureStmts();
  return s.getAllRepRoles.all();
}

module.exports = { giveRep, getRep, getLeaderboard, hasGiven, setRepRole, removeRepRole, getRepRoles, getAllRepRoles };
