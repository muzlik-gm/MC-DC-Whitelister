const fs = require('fs');
const path = require('path');

function requireDir(dir) {
  const results = [];

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.js')) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}

module.exports = requireDir;
