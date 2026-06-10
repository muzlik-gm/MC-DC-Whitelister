class ApiClient {
  constructor(logger) {
    this.logger = logger;
    this.FETCH_TIMEOUT = 10000;
  }

  _buildUrl(guildConfig, endpoint) {
    return `http://${guildConfig.mc_host}:${guildConfig.mc_port}${endpoint}`;
  }

  _fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
  }

  async request(method, endpoint, guildConfig, body) {
    const url = this._buildUrl(guildConfig, endpoint);
    let res;

    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': guildConfig.api_key,
        },
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      res = await this._fetchWithTimeout(url, options);
    } catch (err) {
      this.logger.error('ApiClient', `${endpoint} — network error`, err);
      return { ok: false, error: 'Could not reach the plugin. Is the server online?', unreachable: true };
    }

    if (res.status === 401) {
      this.logger.warn('ApiClient', `${endpoint} — 401 Unauthorized (API key rejected — was it rotated on the MC server?)`);
      return { ok: false, error: 'API key rejected by the plugin. The key may have been rotated on the Minecraft server.', auth_failure: true };
    }

    let data;
    try {
      data = await res.json();
    } catch {
      this.logger.error('ApiClient', `${endpoint} — invalid JSON response (${res.status})`);
      return { ok: false, error: `Unexpected response from plugin (${res.status})` };
    }

    if (!res.ok) {
      const errMsg = data.error || `Server error (${res.status})`;
      this.logger.warn('ApiClient', `${endpoint} — failed (${res.status}): ${errMsg}`);
      return { ok: false, error: errMsg };
    }

    if (data && data.success === false) {
      const errMsg = data.error || 'Request was not successful';
      this.logger.warn('ApiClient', `${endpoint} — success:false from plugin: ${errMsg}`);
      return { ok: false, error: errMsg };
    }

    return { ok: true, ...data };
  }

  async get(endpoint, guildConfig) {
    return this.request('GET', endpoint, guildConfig);
  }

  async post(endpoint, guildConfig, body) {
    return this.request('POST', endpoint, guildConfig, body);
  }

  async put(endpoint, guildConfig, body) {
    return this.request('PUT', endpoint, guildConfig, body);
  }

  async delete(endpoint, guildConfig) {
    return this.request('DELETE', endpoint, guildConfig);
  }

  async addToWhitelist(player, guildConfig) {
    return this.post('/api/whitelist/add', guildConfig, { player });
  }

  async removeFromWhitelist(player, guildConfig) {
    return this.post('/api/whitelist/remove', guildConfig, { player });
  }

  async syncRoles(discordId, mcUsername, group, guildConfig) {
    return this.post('/api/roles/sync', guildConfig, { player: mcUsername, group });
  }

  async banPlayer(username, reason, guildConfig) {
    return this.post('/api/moderation/ban', guildConfig, { player: username, reason });
  }

  async kickPlayer(username, reason, guildConfig) {
    return this.post('/api/moderation/kick', guildConfig, { player: username, reason });
  }

  async warnPlayer(username, reason, guildConfig) {
    return this.post('/api/moderation/warn', guildConfig, { player: username, reason });
  }

  async rewardPlayer(player, command, guildConfig) {
    return this.post('/api/community/reward', guildConfig, { player, command });
  }

  async getOnlinePlayers(guildConfig) {
    return this.get('/api/community/online', guildConfig);
  }

  async getBalance(player, guildConfig) {
    return this.get(`/api/economy/balance?player=${encodeURIComponent(player)}`, guildConfig);
  }

  async giveMoney(player, amount, reason, guildConfig) {
    return this.post('/api/economy/give', guildConfig, { player, amount, reason: reason || '' });
  }

  async mutePlayer(username, duration, reason, guildConfig) {
    return this.post('/api/moderation/mute', guildConfig, { player: username, duration, reason });
  }

  async unmutePlayer(username, guildConfig) {
    return this.post('/api/moderation/unmute', guildConfig, { player: username });
  }

  async healthCheck(guildConfig) {
    try {
      const res = await this._fetchWithTimeout(this._buildUrl(guildConfig, '/api/health'), {
        headers: { 'X-API-Key': guildConfig.api_key },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getConfig(guildConfig) {
    try {
      const res = await this._fetchWithTimeout(this._buildUrl(guildConfig, '/api/config'), {
        headers: { 'X-API-Key': guildConfig.api_key },
      });
      const data = await res.json();
      if (!res.ok || data.success === false) return { ok: false, error: data.error || 'Failed to fetch config' };
      return { ok: true, ...data };
    } catch {
      return { ok: false, error: 'Could not reach the plugin.' };
    }
  }

  async updateConfig(body, guildConfig) {
    return this.post('/api/config', guildConfig, body);
  }

  start() {
    this.logger.info('ApiClient', 'API client service started');
  }
}

module.exports = ApiClient;
