const tunnel = require('./tunnel');
const ApiClient = require('./apiClient');

class MinecraftApi extends ApiClient {
  constructor(guildConfig) {
    super(require('../utils/logger'));
    this.guildConfig = guildConfig;
  }

  _getTunnel() {
    return tunnel.getTunnel();
  }

  async _post(endpoint, body) {
    const t = this._getTunnel();
    if (t && t.pluginConnection) {
      return t.request(endpoint, 'POST', body);
    }
    return this.post(endpoint, this.guildConfig, body);
  }

  async _get(endpoint) {
    const t = this._getTunnel();
    if (t && t.pluginConnection) {
      return t.request(endpoint, 'GET', null);
    }
    return this.get(endpoint, this.guildConfig);
  }

  async addToWhitelist(player) {
    return this._post('/api/whitelist/add', { player });
  }

  async removeFromWhitelist(player) {
    return this._post('/api/whitelist/remove', { player });
  }

  async request(endpoint, body) {
    return this._post(endpoint, body);
  }

  async getServerStatus() {
    const t = this._getTunnel();
    if (t && t.pluginConnection) {
      return this._get('/api/health');
    }
    try {
      const res = await this._fetchWithTimeout('http://' + this.guildConfig.mc_host + ':' + this.guildConfig.mc_port + '/api/health', {
        headers: { 'X-API-Key': this.guildConfig.api_key },
      });
      return { ok: res.ok };
    } catch {
      return { ok: false };
    }
  }

  async healthCheck() {
    const t = this._getTunnel();
    if (t && t.pluginConnection) {
      const res = await this._get('/api/health');
      return res.ok;
    }
    return super.healthCheck(this.guildConfig);
  }

  async getConfig() {
    return this._get('/api/config');
  }

  async updateConfig(body) {
    return this._post('/api/config', body);
  }

  async syncRoles(discordId, mcUsername, group) {
    return this._post('/api/roles/sync', { player: mcUsername, group });
  }

  async banPlayer(username, reason) {
    return this._post('/api/moderation/ban', { player: username, reason });
  }

  async kickPlayer(username, reason) {
    return this._post('/api/moderation/kick', { player: username, reason });
  }

  async warnPlayer(username, reason) {
    return this._post('/api/moderation/warn', { player: username, reason });
  }

  async rewardPlayer(player, command) {
    return this._post('/api/community/reward', { player, command });
  }

  async getOnlinePlayers() {
    return this._get('/api/community/online');
  }

  async getBalance(player) {
    return this._get('/api/economy/balance?player=' + encodeURIComponent(player));
  }

  async giveMoney(player, amount, reason) {
    return this._post('/api/economy/give', { player, amount, reason: reason || '' });
  }

  async mutePlayer(username, duration, reason) {
    return this._post('/api/moderation/mute', { player: username, duration, reason });
  }

  async unmutePlayer(username) {
    return this._post('/api/moderation/unmute', { player: username });
  }
}

module.exports = MinecraftApi;
