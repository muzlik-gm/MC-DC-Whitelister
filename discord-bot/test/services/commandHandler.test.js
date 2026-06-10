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

  test('should register bot handlers on construction', () => {
    expect(mockBot.on).toHaveBeenCalledWith('messageCreate', expect.any(Function));
    expect(mockBot.on).toHaveBeenCalledWith('error', expect.any(Function));
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
