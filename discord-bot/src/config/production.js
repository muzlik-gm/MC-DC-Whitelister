function validateEnvironment(config) {
  const env = process.env;
  const errors = [];

  const token = config?.token || env.DISCORD_BOT_TOKEN;
  const clientId = config?.clientId || env.DISCORD_CLIENT_ID;

  if (!token) {
    errors.push('Missing required environment variable: DISCORD_BOT_TOKEN');
  } else if (!token.includes('.') || token.split('.').length < 3) {
    errors.push('Invalid Discord bot token format');
  }

  if (!clientId) {
    errors.push('Missing required environment variable: DISCORD_CLIENT_ID');
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