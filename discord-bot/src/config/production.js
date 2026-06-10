function validateEnvironment() {
  const env = process.env;
  const errors = [];

  const requiredVars = [
    'DISCORD_BOT_TOKEN',
    'DISCORD_CLIENT_ID',
    'MINECRAFT_API_KEY',
    'MINECRAFT_SERVER_HOST',
    'MINECRAFT_SERVER_PORT',
  ];

  for (const varName of requiredVars) {
    if (!env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  const token = env.DISCORD_BOT_TOKEN;
  const clientId = env.DISCORD_CLIENT_ID;

  if (token && clientId) {
    if (!token.includes('.') || token.split('.').length < 3) {
      errors.push('Invalid Discord bot token format');
    }
  }

  if (errors.length > 0) {
    console.error('Production environment validation failed:');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    console.error('\nPlease set all required environment variables before running the bot in production.');
    return false;
  }

  console.log('Production environment validation passed.');
  return true;
}

module.exports = {
  validateEnvironment,
};