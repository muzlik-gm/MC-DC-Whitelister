describe('Config Tests', () => {
  let envBackup;

  beforeEach(() => {
    envBackup = { ...process.env };
  });

  afterEach(() => {
    process.env = envBackup;
  });

  test('should load config from environment variables', () => {
    jest.isolateModules(() => {
      process.env.DISCORD_BOT_TOKEN = 'env_token';
      process.env.DISCORD_CLIENT_ID = 'env_client_id';
      const loadConfig = require('../../src/config');
      const config = loadConfig();
      expect(config).toEqual({
        token: 'env_token',
        clientId: 'env_client_id',
      });
    });
  });

  test('should load config from .env file when env vars not set', () => {
    jest.isolateModules(() => {
      delete process.env.DISCORD_BOT_TOKEN;
      delete process.env.DISCORD_CLIENT_ID;
      const loadConfig = require('../../src/config');
      const config = loadConfig();
      expect(config.token).toBeDefined();
      expect(config.clientId).toBeDefined();
    });
  });
});
