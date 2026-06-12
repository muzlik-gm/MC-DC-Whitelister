let instance = null;

function setTunnel(tunnelServer) {
  instance = tunnelServer;
}

function getTunnel() {
  return instance;
}

module.exports = { setTunnel, getTunnel };