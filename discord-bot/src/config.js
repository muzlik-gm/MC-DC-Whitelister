const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('config.json not found.');
    process.exit(1);
  }

  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  if (!cfg.token || !cfg.clientId) {
    console.error('config.json must have token and clientId');
    process.exit(1);
  }
  return cfg;
}

module.exports = loadConfig();
