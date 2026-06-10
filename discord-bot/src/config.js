const fs = require('fs');

function loadConfig() {
  const env = process.env;

  const token = env.DISCORD_BOT_TOKEN;
  const clientId = env.DISCORD_CLIENT_ID;

  if (token && clientId) {
    return { token, clientId };
  }

  if (fs.existsSync('.env')) {
    try {
      require('dotenv').config();
      const token = process.env.DISCORD_BOT_TOKEN;
      const clientId = process.env.DISCORD_CLIENT_ID;
      if (token && clientId) {
        return { token, clientId };
      }
    } catch (err) {
      // .env file parse error - ignore, fall through to config.example.json
    }
  }

  const cfgPath = require('path').join(__dirname, '..', 'config.example.json');
  if (fs.existsSync(cfgPath)) {
    console.warn('WARNING: No Discord credentials found in environment variables or .env file.');
    console.warn('Please set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID environment variables.');
    console.warn('Config will be loaded from config.example.json for development only.');
    return { token: 'YOUR_BOT_TOKEN', clientId: 'YOUR_BOT_CLIENT_ID' };
  }

  console.error('CRITICAL: Missing Discord credentials!');
  console.error('Please set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID environment variables.');
  console.error('Or create a .env file with these credentials.');
  process.exit(1);
}

module.exports = loadConfig;
