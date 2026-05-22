const DEBUG_ENABLED = process.env.DEBUG === "true" || process.env.NODE_ENV !== "production";

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL] || (DEBUG_ENABLED ? 0 : 1);

function formatTimestamp() {
  return new Date().toISOString().slice(11, 23);
}

function logger(namespace) {
  const prefix = `[${namespace}]`;

  function shouldLog(level) {
    return LOG_LEVELS[level] >= CURRENT_LEVEL;
  }

  return {
    debug: (...args) => {
      if (shouldLog("debug")) {
        console.log(`${formatTimestamp()} ${prefix}`, ...args);
      }
    },
    info: (...args) => {
      if (shouldLog("info")) {
        console.log(`${formatTimestamp()} ${prefix}`, ...args);
      }
    },
    warn: (...args) => {
      if (shouldLog("warn")) {
        console.warn(`${formatTimestamp()} ${prefix}`, ...args);
      }
    },
    error: (...args) => {
      if (shouldLog("error")) {
        console.error(`${formatTimestamp()} ${prefix}`, ...args);
      }
    },
  };
}

module.exports = { logger };
