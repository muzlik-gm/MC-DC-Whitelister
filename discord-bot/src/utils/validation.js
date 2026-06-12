const USERNAME_RE = /^[a-zA-Z0-9_]{3,16}$/;

// RFC 1918, loopback, link-local, private network, and IPv4-mapped IPv6 ranges
const PRIVATE_IP_RE = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|::1|0:0:0:0:0:0:0:1|fc00:|fe80:)/i;

// Known DNS rebinding / SSRF bypass domains
const SSRF_DOMAINS = /\.(nip\.io|xip\.io|sslip\.io|lvh\.me|localtest\.me)$/i;

// Dotted IPv4 pattern (e.g., "192.168.1.1")
const DOTTED_IP_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function isValidMinecraftUsername(name) {
  return USERNAME_RE.test(name);
}

function isValidHost(host) {
  if (typeof host !== 'string') return false;
  if (host.length > 255) return false;
  // Reject leading/trailing dots, consecutive dots
  if (host.startsWith('.') || host.endsWith('.')) return false;
  if (host.includes('..')) return false;
  // Reject bare numerical formats that resolve to IPs
  if (/^\d+$/.test(host) || /^0x/i.test(host)) return false;
  // Reject octal/hex IP formats (e.g., "0177.0.0.1" or "0x7f.0.0.1")
  if (DOTTED_IP_RE.test(host)) {
    const octets = host.split('.').map(Number);
    if (octets.some(o => o < 0 || o > 255)) return false;
    if (/^0\d/.test(host)) return false; // leading zeros = octal interpretation
  }
  return /^[a-zA-Z0-9.-]+$/.test(host);
}

function isValidPort(port) {
  const num = typeof port === 'string' ? parseInt(port, 10) : port;
  return Number.isInteger(num) && num > 0 && num <= 65535;
}

function isPrivateIp(host) {
  if (PRIVATE_IP_RE.test(host)) return true;
  if (host.toLowerCase() === 'localhost') return true;
  if (SSRF_DOMAINS.test(host)) return true;
  // Check IPv4-mapped IPv6: ::ffff:127.0.0.1, ::ffff:10.x.x.x, etc.
  const v4mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i;
  const match = host.match(v4mapped);
  if (match) {
    return isPrivateIp(match[1]);
  }
  // Check 0.0.0.0 which is not a valid target
  if (host === '0.0.0.0') return true;
  return false;
}

module.exports = { isValidMinecraftUsername, isValidHost, isValidPort, isPrivateIp };
