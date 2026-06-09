const { getDb } = require('./index');

let stmts = null;

function ensureStmts() {
  if (stmts) return stmts;
  const db = getDb();
  stmts = {
    getAll: db.prepare('SELECT * FROM role_mappings WHERE guild_id = ? ORDER BY discord_role_id'),
    upsert: db.prepare(`
      INSERT INTO role_mappings (guild_id, discord_role_id, mc_group)
      VALUES (@guild_id, @discord_role_id, @mc_group)
      ON CONFLICT(guild_id, discord_role_id) DO UPDATE SET
        mc_group = excluded.mc_group
    `),
    remove: db.prepare('DELETE FROM role_mappings WHERE guild_id = ? AND discord_role_id = ?'),
    getByRole: db.prepare('SELECT * FROM role_mappings WHERE guild_id = ? AND discord_role_id = ?'),
  };
  return stmts;
}

function getMappings(guildId) {
  const s = ensureStmts();
  return s.getAll.all(guildId);
}

function setMapping(guildId, discordRoleId, mcGroup) {
  const s = ensureStmts();
  s.upsert.run({ guild_id: guildId, discord_role_id: discordRoleId, mc_group: mcGroup });
}

function removeMapping(guildId, discordRoleId) {
  const s = ensureStmts();
  s.remove.run(guildId, discordRoleId);
}

function getGroupForRoles(guildId, discordRoleIds) {
  const s = ensureStmts();
  for (const roleId of discordRoleIds) {
    const row = s.getByRole.get(guildId, roleId);
    if (row) return row.mc_group;
  }
  return null;
}

module.exports = { getMappings, setMapping, removeMapping, getGroupForRoles };
