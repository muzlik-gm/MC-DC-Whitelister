const { WebSocketServer } = require('ws');
const crypto = require('crypto');

class TunnelServer {
  constructor(port, logger) {
    this.port = port;
    this.logger = logger;
    this.pluginConnection = null;
    this.authenticated = false;
    this.pending = new Map();
    this.wss = null;
  }

  start() {
    this.wss = new WebSocketServer({ port: this.port });
    this.wss.on('connection', (ws, req) => {
      this.logger.info('Tunnel', 'Incoming connection from ' + req.socket.remoteAddress);
      if (this.pluginConnection) {
        this.logger.warn('Tunnel', 'Already have a plugin connection — rejecting duplicate');
        ws.close(4000, 'Already connected');
        return;
      }
      this.pluginConnection = ws;
      this.authenticated = false;
      let authTimer = setTimeout(() => {
        this.logger.warn('Tunnel', 'Auth timeout — closing connection');
        ws.close(4001, 'Authentication timeout');
        if (this.pluginConnection === ws) {
          this.pluginConnection = null;
          this.authenticated = false;
        }
      }, 10000);

      ws.on('message', (data) => {
        let msg;
        try {
          msg = JSON.parse(data.toString());
        } catch {
          return;
        }
        if (msg.type === 'auth' && !this.authenticated) {
          clearTimeout(authTimer);
          this.authenticated = true;
          this.logger.info('Tunnel', 'Plugin authenticated');
          return;
        }
        if (!this.authenticated) return;
        if (msg.type === 'response' && msg.id) {
          const pending = this.pending.get(msg.id);
          if (pending) {
            pending.resolve(msg);
            this.pending.delete(msg.id);
          }
        }
      });
      ws.on('close', () => {
        this.logger.warn('Tunnel', 'Plugin disconnected');
        clearTimeout(authTimer);
        if (this.pluginConnection === ws) {
          this.pluginConnection = null;
          this.authenticated = false;
        }
        for (const [id, p] of this.pending) {
          p.reject(new Error('Plugin disconnected'));
          this.pending.delete(id);
        }
      });
      ws.on('error', (err) => {
        this.logger.error('Tunnel', 'WebSocket error', err);
      });
    });
    this.wss.on('error', (err) => {
      this.logger.error('Tunnel', 'Server error', err);
    });
    this.logger.info('Tunnel', 'Listening on port ' + this.port);
  }

  async sendRequest(method, path, body) {
    if (!this.pluginConnection || !this.authenticated) {
      return { ok: false, error: 'Plugin not connected', unreachable: true };
    }
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Request timed out'));
      }, 15000);
      this.pending.set(id, { resolve: (msg) => { clearTimeout(timer); resolve(msg); }, reject: (err) => { clearTimeout(timer); reject(err); } });
      this.pluginConnection.send(JSON.stringify({ type: 'request', id, method, path, body: body || null }));
    });
  }

  async request(endpoint, method, body) {
    try {
      const msg = await this.sendRequest(method, endpoint, body);
      if (msg.status === 401) {
        return { ok: false, error: 'API key rejected by the plugin.', auth_failure: true };
      }
      const data = msg.body || {};
      if (msg.status < 200 || msg.status >= 300 || data.success === false) {
        return { ok: false, error: data.error || 'Request failed', status: msg.status };
      }
      return { ok: true, ...data };
    } catch (err) {
      this.logger.error('Tunnel', endpoint + ' — ' + err.message);
      return { ok: false, error: 'Could not reach the plugin.', unreachable: true };
    }
  }

  stop() {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.pluginConnection = null;
  }
}

module.exports = TunnelServer;