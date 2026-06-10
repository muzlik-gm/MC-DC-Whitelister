const { validateEnvironment } = require('../../src/config/production');

describe('Production Config Validation Tests', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should pass validation with all required environment variables', () => {
    process.env.DISCORD_BOT_TOKEN = 'test.token.123';
    process.env.DISCORD_CLIENT_ID = '987654321';

    const result = validateEnvironment();
    expect(result).toBe(true);
  });

  test('should fail validation when missing DISCORD_BOT_TOKEN', () => {
    delete process.env.DISCORD_BOT_TOKEN;
    process.env.DISCORD_CLIENT_ID = '987654321';

    const result = validateEnvironment();
    expect(result).toBe(false);
  });

  test('should fail validation when missing DISCORD_CLIENT_ID', () => {
    process.env.DISCORD_BOT_TOKEN = 'test.token.123';
    delete process.env.DISCORD_CLIENT_ID;

    const result = validateEnvironment();
    expect(result).toBe(false);
  });

  test('should pass even without per-server env vars', () => {
    process.env.DISCORD_BOT_TOKEN = 'test.token.123';
    process.env.DISCORD_CLIENT_ID = '987654321';
    delete process.env.MINECRAFT_API_KEY;
    delete process.env.MINECRAFT_SERVER_HOST;
    delete process.env.MINECRAFT_SERVER_PORT;

    const result = validateEnvironment();
    expect(result).toBe(true);
  });

  test('should validate token format correctly', () => {
    process.env.DISCORD_BOT_TOKEN = 'x.x.x';
    process.env.DISCORD_CLIENT_ID = '987654321';

    const result = validateEnvironment();
    expect(result).toBe(true);
  });

  test('should reject malformed token', () => {
    process.env.DISCORD_BOT_TOKEN = 'invalid_token_without_dots';
    process.env.DISCORD_CLIENT_ID = '987654321';

    const result = validateEnvironment();
    expect(result).toBe(false);
  });
});
