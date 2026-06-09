const { getDb } = require('./index');

let stmts = null;

function ensureStmts() {
  if (stmts) return stmts;
  const db = getDb();
  stmts = {
    insert: db.prepare(`
      INSERT OR IGNORE INTO referrals (guild_id, referrer_discord_id, referee_discord_id, referee_minecraft)
      VALUES (@guild_id, @referrer_discord_id, @referee_discord_id, @referee_minecraft)
    `),
    getByReferrer: db.prepare(
      'SELECT * FROM referrals WHERE guild_id = ? AND referrer_discord_id = ? ORDER BY created_at DESC'
    ),
    countByReferrer: db.prepare(
      'SELECT COUNT(*) AS count FROM referrals WHERE guild_id = ? AND referrer_discord_id = ?'
    ),
    leaderboard: db.prepare(`
      SELECT referrer_discord_id, COUNT(*) AS count
      FROM referrals
      WHERE guild_id = ?
      GROUP BY referrer_discord_id
      ORDER BY count DESC
      LIMIT ?
    `),
  };
  return stmts;
}

function addReferral(guildId, referrerId, refereeId, refereeMinecraft) {
  const s = ensureStmts();
  const result = s.insert.run({
    guild_id: guildId,
    referrer_discord_id: referrerId,
    referee_discord_id: refereeId,
    referee_minecraft: refereeMinecraft,
  });
  return { ok: result.changes > 0 };
}

function getReferralsByReferrer(guildId, referrerId) {
  const s = ensureStmts();
  return s.getByReferrer.all(guildId, referrerId);
}

function getReferralCount(guildId, referrerId) {
  const s = ensureStmts();
  const row = s.countByReferrer.get(guildId, referrerId);
  return row ? row.count : 0;
}

function getLeaderboard(guildId, limit) {
  const s = ensureStmts();
  return s.leaderboard.all(guildId, limit);
}

module.exports = { addReferral, getReferralsByReferrer, getReferralCount, getLeaderboard };
