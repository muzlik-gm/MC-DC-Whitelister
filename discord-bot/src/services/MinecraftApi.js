const logger = require('../utils/logger');

const FETCH_TIMEOUT = 10000;

class MinecraftApi {
  constructor(guildConfig) {
    this.base = `http://${guildConfig.mc_host}:${guildConfig.mc_port}`;
    this.apiKey = guildConfig.api_key;
  }

  _fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
  }

  async _get(endpoint) {
    try {
      const res = await this._fetchWithTimeout(`${this.base}${endpoint}`, {
        method: 'GET',
        headers: { 'X-API-Key': this.apiKey },
      });
      if (res.status === 401) {
        logger.warn('API', `${endpoint} — 401 Unauthorized`);
        return { ok: false, error: 'API key rejected by the plugin.', auth_failure: true };
      }
      const data = await res.json();
      if (!res.ok || data.success === false) return { ok: false, error: data.error || 'Request failed' };
      return { ok: true, ...data };
    } catch (err) {
      logger.error('API', `${endpoint} — network error`, err);
      return { ok: false, error: 'Could not reach the plugin.', unreachable: true };
    }
  }

  async _request(endpoint, body) {
    let res;
    try {
      res = await this._fetchWithTimeout(`${this.base}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      logger.error('API', `${endpoint} — network error`, err);
      return { ok: false, error: 'Could not reach the plugin. Is the server online?', unreachable: true };
    }

    // Detect 401 — API key was rotated on MC side, Discord bot is out of sync
    if (res.status === 401) {
      logger.warn('API', `${endpoint} — 401 Unauthorized (API key rejected — was it rotated on the MC server?)`);
      return { ok: false, error: 'API key rejected by the plugin. The key may have been rotated on the Minecraft server.', auth_failure: true };
    }

    let data;
    try {
      data = await res.json();
    } catch {
      logger.error('API', `${endpoint} — invalid JSON response (${res.status})`);
      return { ok: false, error: `Unexpected response from plugin (${res.status})` };
    }

    if (!res.ok) {
      const errMsg = data.error || `Server error (${res.status})`;
      logger.warn('API', `${endpoint} — failed (${res.status}): ${errMsg}`);
      return { ok: false, error: errMsg };
    }

    if (data && data.success === false) {
      const errMsg = data.error || 'Request was not successful';
      logger.warn('API', `${endpoint} — success:false from plugin: ${errMsg}`);
      return { ok: false, error: errMsg };
    }

    return { ok: true, ...data };
  }

  async addToWhitelist(player) {
    return this._request('/api/whitelist/add', { player });
  }

  async removeFromWhitelist(player) {
    return this._request('/api/whitelist/remove', { player });
  }

  async request(endpoint, body) {
    return this._request(endpoint, body);
  }

  async getServerStatus() {
    try {
      await this._fetchWithTimeout(`${this.base}/api/health`, {
        headers: { 'X-API-Key': this.apiKey },
      });
      return { ok: false };
    } catch {
      return { ok: false };
    }
  }

  async healthCheck() {
    try {
      const res = await this._fetchWithTimeout(`${this.base}/api/health`, {
        headers: { 'X-API-Key': this.apiKey },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getConfig() {
    try {
      const res = await this._fetchWithTimeout(`${this.base}/api/config`, {
        headers: { 'X-API-Key': this.apiKey },
      });
      const data = await res.json();
      if (!res.ok || data.success === false) return { ok: false, error: data.error || 'Failed to fetch config' };
      return { ok: true, ...data };
    } catch {
      return { ok: false, error: 'Could not reach the plugin.' };
    }
  }

  async updateConfig(body) {
    return this._request('/api/config', body);
  }

  async syncRoles(discordId, mcUsername, group) {
    return this._request('/api/roles/sync', { player: mcUsername, group });
  }

  async banPlayer(username, reason) {
    return this._request('/api/moderation/ban', { player: username, reason });
  }

  async kickPlayer(username, reason) {
    return this._request('/api/moderation/kick', { player: username, reason });
  }

  async warnPlayer(username, reason) {
    return this._request('/api/moderation/warn', { player: username, reason });
  }

  async rewardPlayer(player, command) {
    return this._request('/api/community/reward', { player, command });
  }

  async getOnlinePlayers() {
    return this._get('/api/community/online');
  }

  async getBalance(player) {
    return this._get(`/api/economy/balance?player=${encodeURIComponent(player)}`);
  }

  async giveMoney(player, amount, reason) {
    return this._request('/api/economy/give', { player, amount, reason: reason || '' });
  }

  async mutePlayer(username, duration, reason) {
    return this._request('/api/moderation/mute', { player: username, duration, reason });
  }

  async unmutePlayer(username) {
    return this._request('/api/moderation/unmute', { player: username });
  }
}

module.exports = MinecraftApi;
