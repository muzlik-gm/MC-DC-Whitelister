const fs = require('fs');
const path = require('path');

const PLACEHOLDER_RE = /^\$\{[A-Z_]+\}$/;

function isPlaceholder(val) {
  return typeof val === 'string' && PLACEHOLDER_RE.test(val);
}

function loadConfig() {
  const env = process.env;

  const token = env.DISCORD_BOT_TOKEN;
  const clientId = env.DISCORD_CLIENT_ID;
  const apiKey = env.MINECRAFT_API_KEY || null;

  if (token && !isPlaceholder(token) && clientId && !isPlaceholder(clientId)) {
    return { token, clientId, apiKey };
  }

  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    try {
      require('dotenv').config({ path: envPath });
      const token = process.env.DISCORD_BOT_TOKEN;
      const clientId = process.env.DISCORD_CLIENT_ID;
      const apiKey = process.env.MINECRAFT_API_KEY || null;
      if (token && !isPlaceholder(token) && clientId && !isPlaceholder(clientId)) {
        return { token, clientId, apiKey };
      }
    } catch (err) {
      // .env file parse error - ignore, fall through to config.example.json
    }
  }

  const cfgPath = path.join(__dirname, '..', 'config.json');
  if (fs.existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (cfg.token && !isPlaceholder(cfg.token) && cfg.clientId && !isPlaceholder(cfg.clientId)) {
        return { token: cfg.token, clientId: cfg.clientId, apiKey: cfg.apiKey || null };
      }
    } catch (err) {
      // config.json parse error - ignore, fall through
    }
  }

  const examplePath = path.join(__dirname, '..', 'config.example.json');
  if (fs.existsSync(examplePath)) {
    console.warn('WARNING: No Discord credentials found in environment variables, .env, or config.json.');
    console.warn('Please set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID environment variables.');
    console.warn('Config will be loaded from config.example.json for development only.');
    return { token: 'YOUR_BOT_TOKEN', clientId: 'YOUR_BOT_CLIENT_ID', apiKey: null };
  }

  console.error('CRITICAL: Missing Discord credentials!');
  console.error('Please set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID environment variables.');
  console.error('Or create a .env file with these credentials.');
  process.exit(1);
}

module.exports = loadConfig;
