const USERNAME_RE = /^[a-zA-Z0-9_]{3,16}$/;

// RFC 1918, loopback, link-local, and private network ranges
const PRIVATE_IP_RE = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|::1|fc00:|fe80:)/i;

function isValidMinecraftUsername(name) {
  return USERNAME_RE.test(name);
}

function isValidHost(host) {
  return /^[a-zA-Z0-9.-]+$/.test(host) && host.length <= 255;
}

function isValidPort(port) {
  const num = typeof port === 'string' ? parseInt(port, 10) : port;
  return Number.isInteger(num) && num > 0 && num <= 65535;
}

function isPrivateIp(host) {
  return PRIVATE_IP_RE.test(host);
}

module.exports = { isValidMinecraftUsername, isValidHost, isValidPort, isPrivateIp };
