function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function format(level, component, message, err) {
  const base = `[${timestamp()}] [${level}] [${component}] ${message}`;
  if (err) {
    return `${base} — ${err.message || err}`;
  }
  return base;
}

module.exports = {
  info(component, message) {
    console.log(format('INFO', component, message));
  },
  warn(component, message) {
    console.warn(format('WARN', component, message));
  },
  error(component, message, err) {
    console.error(format('ERROR', component, message, err));
  },
};
