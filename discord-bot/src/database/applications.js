const { getDb } = require('./index');

let stmts = null;

function ensureStmts() {
  if (stmts) return stmts;
  const db = getDb();
  stmts = {
    addQuestion: db.prepare(`
      INSERT INTO application_questions (guild_id, question, sort_order)
      VALUES (@guild_id, @question, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM application_questions WHERE guild_id = @guild_id))
    `),
    removeQuestion: db.prepare('DELETE FROM application_questions WHERE id = ? AND guild_id = ?'),
    getQuestions: db.prepare('SELECT * FROM application_questions WHERE guild_id = ? ORDER BY sort_order ASC'),
    submit: db.prepare(`
      INSERT INTO applications (guild_id, discord_id, minecraft_username, answers)
      VALUES (@guild_id, @discord_id, @minecraft_username, @answers)
    `),
    getById: db.prepare('SELECT * FROM applications WHERE id = ?'),
    getPending: db.prepare("SELECT * FROM applications WHERE guild_id = ? AND status = 'pending' ORDER BY created_at ASC"),
    getByUser: db.prepare('SELECT * FROM applications WHERE guild_id = ? AND discord_id = ? ORDER BY created_at DESC'),
    approve: db.prepare(`
      UPDATE applications SET status = 'approved', reviewed_by = @reviewed_by, review_note = @review_note, reviewed_at = datetime('now')
      WHERE id = ? AND status = 'pending'
    `),
    reject: db.prepare(`
      UPDATE applications SET status = 'rejected', reviewed_by = @reviewed_by, review_note = @review_note, reviewed_at = datetime('now')
      WHERE id = ? AND status = 'pending'
    `),
  };
  return stmts;
}

function addQuestion(guildId, question) {
  const s = ensureStmts();
  const result = s.addQuestion.run({ guild_id: guildId, question });
  return { ok: true, id: result.lastInsertRowid };
}

function removeQuestion(guildId, questionId) {
  const s = ensureStmts();
  const result = s.removeQuestion.run(questionId, guildId);
  return { ok: result.changes > 0 };
}

function getQuestions(guildId) {
  const s = ensureStmts();
  return s.getQuestions.all(guildId);
}

function submitApplication(guildId, discordId, mcUsername, answers) {
  const s = ensureStmts();
  const result = s.submit.run({
    guild_id: guildId,
    discord_id: discordId,
    minecraft_username: mcUsername,
    answers: JSON.stringify(answers),
  });
  return { ok: true, id: result.lastInsertRowid };
}

function getApplication(applicationId) {
  const s = ensureStmts();
  return s.getById.get(applicationId) || null;
}

function getPendingApplications(guildId) {
  const s = ensureStmts();
  return s.getPending.all(guildId);
}

function getApplicationsByUser(guildId, discordId) {
  const s = ensureStmts();
  return s.getByUser.all(guildId, discordId);
}

function approveApplication(applicationId, reviewerId, note) {
  const s = ensureStmts();
  const result = s.approve.run({ reviewed_by: reviewerId, review_note: note || null }, applicationId);
  return { ok: result.changes > 0 };
}

function rejectApplication(applicationId, reviewerId, note) {
  const s = ensureStmts();
  const result = s.reject.run({ reviewed_by: reviewerId, review_note: note || null }, applicationId);
  return { ok: result.changes > 0 };
}

module.exports = { addQuestion, removeQuestion, getQuestions, submitApplication, getApplication, getPendingApplications, getApplicationsByUser, approveApplication, rejectApplication };
