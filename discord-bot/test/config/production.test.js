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
    process.env.MINECRAFT_API_KEY = 'minecraft_key_abc';
    process.env.MINECRAFT_SERVER_HOST = 'localhost';
    process.env.MINECRAFT_SERVER_PORT = '25252';

    const result = validateEnvironment();
    expect(result).toBe(true);
  });

  test('should fail validation when missing DISCORD_BOT_TOKEN', () => {
    delete process.env.DISCORD_BOT_TOKEN;
    process.env.DISCORD_CLIENT_ID = '987654321';
    process.env.MINECRAFT_API_KEY = 'minecraft_key_abc';
    process.env.MINECRAFT_SERVER_HOST = 'localhost';
    process.env.MINECRAFT_SERVER_PORT = '25252';

    const result = validateEnvironment();
    expect(result).toBe(false);
  });

  test('should fail validation when missing DISCORD_CLIENT_ID', () => {
    process.env.DISCORD_BOT_TOKEN = 'test.token.123';
    delete process.env.DISCORD_CLIENT_ID;
    process.env.MINECRAFT_API_KEY = 'minecraft_key_abc';
    process.env.MINECRAFT_SERVER_HOST = 'localhost';
    process.env.MINECRAFT_SERVER_PORT = '25252';

    const result = validateEnvironment();
    expect(result).toBe(false);
  });

  test('should fail validation when missing MINECRAFT_API_KEY', () => {
    process.env.DISCORD_BOT_TOKEN = 'test.token.123';
    process.env.DISCORD_CLIENT_ID = '987654321';
    delete process.env.MINECRAFT_API_KEY;
    process.env.MINECRAFT_SERVER_HOST = 'localhost';
    process.env.MINECRAFT_SERVER_PORT = '25252';

    const result = validateEnvironment();
    expect(result).toBe(false);
  });

  test('should fail validation when missing MINECRAFT_SERVER_HOST', () => {
    process.env.DISCORD_BOT_TOKEN = 'test.token.123';
    process.env.DISCORD_CLIENT_ID = '987654321';
    process.env.MINECRAFT_API_KEY = 'minecraft_key_abc';
    delete process.env.MINECRAFT_SERVER_HOST;
    process.env.MINECRAFT_SERVER_PORT = '25252';

    const result = validateEnvironment();
    expect(result).toBe(false);
  });

  test('should fail validation when missing MINECRAFT_SERVER_PORT', () => {
    process.env.DISCORD_BOT_TOKEN = 'test.token.123';
    process.env.DISCORD_CLIENT_ID = '987654321';
    process.env.MINECRAFT_API_KEY = 'minecraft_key_abc';
    process.env.MINECRAFT_SERVER_HOST = 'localhost';
    delete process.env.MINECRAFT_SERVER_PORT;

    const result = validateEnvironment();
    expect(result).toBe(false);
  });

  test('should validate token format correctly', () => {
    process.env.DISCORD_BOT_TOKEN = 'x.x.x';
    process.env.DISCORD_CLIENT_ID = '987654321';
    process.env.MINECRAFT_API_KEY = 'minecraft_key_abc';
    process.env.MINECRAFT_SERVER_HOST = 'localhost';
    process.env.MINECRAFT_SERVER_PORT = '25252';

    const result = validateEnvironment();
    expect(result).toBe(true);
  });

  test('should reject malformed token', () => {
    process.env.DISCORD_BOT_TOKEN = 'invalid_token_without_dots';
    process.env.DISCORD_CLIENT_ID = '987654321';
    process.env.MINECRAFT_API_KEY = 'minecraft_key_abc';
    process.env.MINECRAFT_SERVER_HOST = 'localhost';
    process.env.MINECRAFT_SERVER_PORT = '25252';

    const result = validateEnvironment();
    expect(result).toBe(false);
  });
});
