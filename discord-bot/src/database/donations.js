const { getDb } = require('./index');

let stmts = null;

function ensureStmts() {
  if (stmts) return stmts;
  const db = getDb();
  stmts = {
    insert: db.prepare(`
      INSERT INTO donations (guild_id, discord_id, minecraft_username, amount, message)
      VALUES (@guild_id, @discord_id, @minecraft_username, @amount, @message)
    `),
    getRecent: db.prepare(`
      SELECT * FROM donations WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?
    `),
    getTopDonors: db.prepare(`
      SELECT COALESCE(discord_id, '') AS discord_id, minecraft_username, SUM(amount) AS total
      FROM donations WHERE guild_id = ?
      GROUP BY COALESCE(discord_id, ''), minecraft_username
      ORDER BY total DESC LIMIT ?
    `),
  };
  return stmts;
}

function addDonation(guildId, discordId, mcUsername, amount, message) {
  const s = ensureStmts();
  s.insert.run({
    guild_id: guildId,
    discord_id: discordId || null,
    minecraft_username: mcUsername || null,
    amount: amount,
    message: message || null,
  });
  return { ok: true };
}

function getRecent(guildId, limit) {
  const s = ensureStmts();
  return s.getRecent.all(guildId, limit || 10);
}

function getTopDonors(guildId, limit) {
  const s = ensureStmts();
  return s.getTopDonors.all(guildId, limit || 10);
}

module.exports = { addDonation, getRecent, getTopDonors };
