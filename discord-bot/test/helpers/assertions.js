const { expect } = require('@jest/globals');

expect.extend({
  toHaveValidUser: (received) => {
    const pass = received &&
      received.id &&
      received.tag &&
      received.name &&
      received.discriminator;

    return {
      message: () => `Expected user to have valid properties`,
      pass,
    };
  },
  toHaveValidGuild: (received) => {
    const pass = received &&
      received.id &&
      received.name &&
      typeof received.memberCount === 'number';

    return {
      message: () => `Expected guild to have valid properties`,
      pass,
    };
  },
  toHaveValidRole: (received) => {
    const pass = received &&
      received.id &&
      received.name &&
      received.color !== undefined &&
      typeof received.permissions === 'bigint' || typeof received.permissions === 'number';

    return {
      message: () => `Expected role to have valid properties`,
      pass,
    };
  },
  toHaveValidChannel: (received) => {
    const pass = received &&
      received.id &&
      received.name &&
      received.type !== undefined;

    return {
      message: () => `Expected channel to have valid properties`,
      pass,
    };
  },
  toHaveValidWhitelistEntry: (received) => {
    const pass = received &&
      received.userId &&
      received.username &&
      received.addedAt &&
      received.addedBy;

    return {
      message: () => `Expected whitelist entry to have valid properties`,
      pass,
    };
  },
  toHaveValidModerationEntry: (received) => {
    const pass = received &&
      received.id &&
      received.userId &&
      received.moderatorId &&
      received.type &&
      received.reason &&
      received.createdAt &&
      received.active !== undefined;

    return {
      message: () => `Expected moderation entry to have valid properties`,
      pass,
    };
  },
  toHaveValidNote: (received) => {
    const pass = received &&
      received.id &&
      received.userId &&
      received.authorId &&
      received.content &&
      received.createdAt &&
      received.private !== undefined;

    return {
      message: () => `Expected note to have valid properties`,
      pass,
    };
  },
  toHaveValidEconomyBalance: (received) => {
    const pass = received &&
      typeof received === 'number' &&
      received >= 0;

    return {
      message: () => `Expected balance to be a valid non-negative number`,
      pass,
    };
  },
  toHaveValidApplication: (received) => {
    const pass = received &&
      received.id &&
      received.userId &&
      received.minecraftUsername &&
      received.minecraftUuid &&
      ['pending', 'approved', 'rejected', 'cancelled'].includes(received.status) &&
      received.submittedAt &&
      received.reason;

    return {
      message: () => `Expected application to have valid properties`,
      pass,
    };
  },
  toBeWithinTimeRange: (received, min, max) => {
    const pass = received >= min && received <= max;

    return {
      message: () => `Expected ${received} to be within range [${min}, ${max}]`,
      pass,
    };
  },
});