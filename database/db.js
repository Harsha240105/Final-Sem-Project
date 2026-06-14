const mongoose = require("mongoose");
const dns = require("dns");

mongoose.set("bufferCommands", false);

const mongoState = {
  lastAttemptAt: null,
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  lastError: null,
};

let listenersBound = false;

function ensureAtlasAuthSource(uri) {
  if (typeof uri !== "string") return uri;
  if (!uri.startsWith("mongodb+srv://")) return uri;
  if (!/\/\/[^/]+@/.test(uri)) return uri;
  if (/([?&])authSource=/i.test(uri)) return uri;

  const separator = uri.includes("?") ? "&" : "?";
  return `${uri}${separator}authSource=admin`;
}

function getMongoUriSummary(uri) {
  try {
    const normalized = uri.replace(/^mongodb(\+srv)?:\/\//i, "http://");
    const parsed = new URL(normalized);
    return {
      username: parsed.username || "unknown",
      host: parsed.host || "unknown",
      database: (parsed.pathname || "/").replace(/^\//, "") || "unknown",
    };
  } catch {
    return null;
  }
}

function classifyMongoError(error) {
  const message = error?.message || String(error);

  if (/timed out|etimeout|server selection timed out/i.test(message)) {
    return {
      type: "timeout",
      message: "Connection timeout. Network path to Atlas is blocked or unstable (DNS, firewall, VPN, or proxy).",
    };
  }

  if (/querysrv|enotfound|eai_again|getaddrinfo/i.test(message)) {
    return {
      type: "dns",
      message: "DNS / network issue. Check internet, DNS resolver, and Atlas cluster host.",
    };
  }

  if (/whitelist|whitelisted|network access list|not authorized on|could not connect to any servers/i.test(message)) {
    return {
      type: "whitelist",
      message: "IP whitelist issue. Add your current public IP (or 0.0.0.0/0 temporarily) in Atlas Network Access.",
    };
  }

  if (/econnrefused/i.test(message)) {
    return {
      type: "refused",
      message: "IP whitelist issue. Check Atlas Network Access (add 0.0.0.0/0 temporarily).",
    };
  }

  if (/authentication|auth failed|bad auth|password/i.test(message)) {
    return {
      type: "auth",
      message: "Wrong username/password. Recreate Atlas DB user and use URL-encoded password.",
    };
  }

  return {
    type: "unknown",
    message: "Unknown MongoDB connection issue. Check Atlas cluster status and URI.",
  };
}

function setLastMongoError(error) {
  const classified = classifyMongoError(error);
  mongoState.lastError = {
    type: classified.type,
    hint: classified.message,
    message: error?.message || String(error),
    at: new Date().toISOString(),
  };
  return classified;
}

function clearLastMongoError() {
  mongoState.lastError = null;
}

function bindMongoListeners() {
  if (listenersBound) return;
  listenersBound = true;

  mongoose.connection.on("connected", () => {
    mongoState.lastConnectedAt = new Date().toISOString();
    clearLastMongoError();
  });

  mongoose.connection.on("error", (err) => {
    const classified = setLastMongoError(err);
    if (!mongoState.lastConnectedAt) {
      return;
    }
    console.error("[Mongo Runtime Error]", err.message);
    console.error(`[Mongo Hint] ${classified.message}`);
  });

  mongoose.connection.on("disconnected", () => {
    mongoState.lastDisconnectedAt = new Date().toISOString();
    if (mongoState.lastConnectedAt) {
      console.warn("[Mongo] Connection lost.");
    }
  });
}

function getMongoConnectionStatus() {
  return {
    readyState: mongoose.connection.readyState,
    connection: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    connected: mongoose.connection.readyState === 1,
    database: mongoose.connection.name || null,
    host: mongoose.connection.host || null,
    lastAttemptAt: mongoState.lastAttemptAt,
    lastConnectedAt: mongoState.lastConnectedAt,
    lastDisconnectedAt: mongoState.lastDisconnectedAt,
    lastError: mongoState.lastError,
  };
}

async function connectDB(options = {}) {
  const { verbose = true } = options;

  bindMongoListeners();

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  mongoState.lastAttemptAt = new Date().toISOString();

  if (verbose) {
    console.log("Connecting to MongoDB...");
    console.log("URI exists:", !!process.env.MONGO_URI);
  } else {
    console.log("[Mongo] Retrying connection...");
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Atlas URI is required.");
  }

  const mongoUri = ensureAtlasAuthSource(process.env.MONGO_URI);
  if (verbose && mongoUri !== process.env.MONGO_URI) {
    console.log("[Mongo] authSource not found in URI. Using authSource=admin for Atlas compatibility.");
  }

  const uriSummary = getMongoUriSummary(mongoUri);
  if (verbose && uriSummary) {
    console.log(`[Mongo] URI user: ${uriSummary.username}`);
    console.log(`[Mongo] URI host: ${uriSummary.host}`);
    console.log(`[Mongo] URI database: ${uriSummary.database}`);
  }

  const connectOptions = {
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 10000,
    connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS) || 10000,
    socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS) || 45000,
    maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 10,
    family: 4,
  };

  if (verbose) {
    console.log("[Mongo] Connection options:", {
      serverSelectionTimeoutMS: connectOptions.serverSelectionTimeoutMS,
      connectTimeoutMS: connectOptions.connectTimeoutMS,
      socketTimeoutMS: connectOptions.socketTimeoutMS,
      maxPoolSize: connectOptions.maxPoolSize,
      family: connectOptions.family,
      bufferCommands: false,
    });
  }

  const connectWithAtlas = async () => mongoose.connect(mongoUri, connectOptions);

  try {
    await connectWithAtlas();
  } catch (firstError) {
    const isSrvFailure = /querysrv|enotfound|eai_again|getaddrinfo/i.test(firstError?.message || "");
    const allowDnsRetry = process.env.MONGO_DNS_RETRY !== "false";

    if (!isSrvFailure || !allowDnsRetry) {
      const classified = setLastMongoError(firstError);
      console.error("MongoDB connection failed:", firstError.message);
      console.error(`[Mongo Hint] ${classified.message}`);
      throw firstError;
    }

    const dnsServers = (process.env.MONGO_DNS_SERVERS || "8.8.8.8,1.1.1.1")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (dnsServers.length) {
      dns.setServers(dnsServers);
      console.warn(`[Mongo] querySrv failed. Retrying with DNS servers: ${dnsServers.join(", ")}`);
    }

    try {
      await connectWithAtlas();
    } catch (retryError) {
      const classified = setLastMongoError(retryError);
      console.error("MongoDB connection failed:", retryError.message);
      console.error(`[Mongo Hint] ${classified.message}`);
      throw retryError;
    }
  }

  clearLastMongoError();
  mongoState.lastConnectedAt = new Date().toISOString();

  console.log("MongoDB Connected");
  console.log(`Connected to database: ${mongoose.connection.name}`);
  console.log(`[Mongo] Ready state: ${mongoose.connection.readyState}`);
}

module.exports = { connectDB, getMongoConnectionStatus, classifyMongoError };
