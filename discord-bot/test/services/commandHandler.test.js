const CommandHandler = require('../../src/services/commandHandler');

const mockBot = {
  on: jest.fn(),
  user: { id: 'test_bot_id' },
};

const mockConfig = {
  prefix: '>',
  adminRoles: ['admin'],
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

jest.mock('../../src/utils/requireDir', () => jest.fn(() => []));

describe('Command Handler Tests', () => {
  let commandHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    commandHandler = new CommandHandler(mockBot, mockConfig, mockLogger);
  });

  test('should not register messageCreate handler on construction', () => {
    const messageCreateCalls = mockBot.on.mock.calls.filter(c => c[0] === 'messageCreate');
    expect(messageCreateCalls.length).toBe(0);
  });

  test('should handle bot error', () => {
    const error = new Error('Test error');
    commandHandler.handleError(error);
    expect(mockLogger.error).toHaveBeenCalledWith('CommandHandler', 'Bot error', error);
  });

  test('should start and load commands', async () => {
    await commandHandler.start();
    expect(mockLogger.info).toHaveBeenCalledWith('CommandHandler', 'Loaded 0 commands');
    expect(mockLogger.info).toHaveBeenCalledWith('CommandHandler', 'Command handler started');
  });

  test('should handle load failure', async () => {
    const requireDir = require('../../src/utils/requireDir');
    requireDir.mockImplementation(() => { throw new Error('Load failed'); });
    await expect(commandHandler.loadCommands()).rejects.toThrow('Load failed');
  });
});
