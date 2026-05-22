const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), override: true });
console.log("MONGO_URI:", process.env.MONGO_URI ? "SET" : "NOT SET");

const express = require("express");
const http = require("http");
const { Server: SocketIOServer } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");

const { connectDB, getMongoConnectionStatus } = require("../database/db");
const Notification = require("../database/models/Notification");
const ServerMessage = require("../database/models/ServerMessage");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin.routes");
const marketplaceRoutes = require("./routes/marketplace.routes");
const communityRoutes = require("./routes/community.routes");
const userRoutes = require("./routes/user.routes");
const taskRoutes = require("./routes/task.routes");
const blockchainRoutes = require("./routes/blockchain.routes");
const notificationRoutes = require("./routes/notification.routes");
const certificateRoutes = require("./routes/certificate.routes");
const connectionRoutes = require("./routes/connection.routes");
const dmRoutes = require("./routes/dm.routes");
const serverRoutes = require("./routes/server.routes");
const verificationRoutes = require("./routes/verification.routes");
const networkRoutes = require("./routes/network.routes");
const canvasRoutes = require("./routes/canvas.routes");
const setupSocket = require("./socket");

const app = express();
const server = http.createServer(app);

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing from .env");
}

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

console.log(`[CORS] Allowed origins: ${allowedOrigins.join(", ")}`);

const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    methods: ["GET", "POST"],
    credentials: true,
  },
  maxHttpBufferSize: 5e6,
  pingInterval: 25000,
  pingTimeout: 20000,
});
app.set("io", io);
setupSocket(io);

// Start NFT mint queue processor
const { setSocketIO, startQueueProcessor } = require("../blockchain/nftQueueProcessor");
setSocketIO(io);
startQueueProcessor();

const PORT = Number(process.env.PORT) || 5000;
const PORT_RETRIES = Number(process.env.PORT_RETRIES) || 20;
const ALLOW_START_WITHOUT_DB = process.env.ALLOW_START_WITHOUT_DB !== "false";
const MONGO_RETRY_INTERVAL_MS = Number(process.env.MONGO_RETRY_INTERVAL_MS) || 15000;

let dbReconnectTimer = null;
let dbConnectPromise = null;
let isDegradedMode = false;

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));

const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || localhostOriginPattern.test(origin)) {
      return cb(null, true);
    }

    console.warn(`[CORS] Blocked origin: ${origin}`);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(morgan("dev"));

const apiRequestLogger = (req, res, next) => {
  const startedAt = Date.now();
  const requestId = Math.random().toString(36).slice(2, 8);
  const origin = req.get("origin") || "-";
  const clientIp = req.ip || req.socket?.remoteAddress || "-";

  console.log(`[API][${requestId}] IN ${req.method} ${req.originalUrl} origin=${origin} ip=${clientIp}`);

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    console.log(`[API][${requestId}] OUT ${req.method} ${req.originalUrl} status=${res.statusCode} ${durationMs}ms`);
  });

  next();
};

app.use("/api", apiRequestLogger);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
app.use("/api", limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many auth attempts, please try again later" },
});
app.use("/api/auth", authLimiter);

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: "Too many uploads, please try again later" },
});
app.use("/api/verify/submit", uploadLimiter);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/uploads", express.static(path.join(__dirname, "uploads")));

const sendHealth = (_req, res) => {
  const dbStatus = getMongoConnectionStatus();
  res.json({
    status: dbStatus.connected ? "ok" : "degraded",
    db: {
      ...dbStatus,
      allowStartWithoutDb: ALLOW_START_WITHOUT_DB,
      retryIntervalMs: ALLOW_START_WITHOUT_DB ? MONGO_RETRY_INTERVAL_MS : null,
      reconnectScheduled: Boolean(dbReconnectTimer),
    },
  });
};

app.get("/health", sendHealth);
app.get("/api/health", sendHealth);

app.use("/api", (req, res, next) => {
  if (req.path === "/health") {
    return next();
  }

  if (mongoose.connection.readyState === 1) {
    return next();
  }

  console.error(`[DB GUARD] Blocking ${req.method} ${req.originalUrl} because DB is not connected`);
  return res.status(503).json({
    error: "Database unavailable. Please try again in a moment.",
    code: "DB_UNAVAILABLE",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/communities", communityRoutes);
app.use("/api/user", userRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/blockchain", blockchainRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/dm", dmRoutes);
app.use("/api/servers", serverRoutes);
app.use("/api/verify", verificationRoutes);
app.use("/api/network", networkRoutes);
app.use("/api/canvas", canvasRoutes);
app.use("/api/social", require("./routes/social.routes"));
app.use((req, res) => {
  console.warn(`[404] ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: "Not found",
    path: req.originalUrl,
    method: req.method,
  });
});

app.use((err, req, res, _next) => {
  console.error(`[API ERROR] ${req.method} ${req.originalUrl}`, err);
  const status = err.status || 500;
  const message = err.message || "Server error";
  res.status(status).json({ error: message });
});

// ── Periodic cleanup jobs ──
const NOTIFICATION_RETENTION_DAYS = 90;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function cleanupOldNotifications() {
  try {
    const cutoff = new Date(Date.now() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await Notification.deleteMany({ createdAt: { $lt: cutoff } });
    if (result.deletedCount > 0) {
      console.log(`[CLEANUP] Deleted ${result.deletedCount} old notifications`);
    }
  } catch (err) {
    console.error("[CLEANUP] Notification cleanup error:", err.message);
  }
}

const cleanupInterval = setInterval(cleanupOldNotifications, CLEANUP_INTERVAL_MS);
if (cleanupInterval.unref) cleanupInterval.unref();

// ── Cascading delete helper ──
async function cascadeUserDelete(userId) {
  await Promise.all([
    Notification.deleteMany({ userId }),
    ServerMessage.deleteMany({ sender: userId }),
  ]);
}

function listenOnPort(port) {
  return new Promise((resolve, reject) => {
    server.listen(port, () => resolve({ server, port }));
    server.once("error", (err) => reject(err));
  });
}

function ensurePortInRange(port) {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

function enterDegradedMode(reason) {
  if (isDegradedMode) return;
  isDegradedMode = true;
  console.warn(`[SERVER] Running in degraded mode (${reason}). API routes that need MongoDB will return 503 until the database reconnects.`);
}

function exitDegradedMode() {
  if (!isDegradedMode) return;
  isDegradedMode = false;
  console.log("[SERVER] Database connection restored. Full API access is available again.");
}

function scheduleDbReconnect(reason) {
  if (!ALLOW_START_WITHOUT_DB) return;
  if (dbReconnectTimer || mongoose.connection.readyState === 1) return;

  enterDegradedMode(reason);
  console.warn(`[Mongo] Next reconnect attempt in ${Math.round(MONGO_RETRY_INTERVAL_MS / 1000)}s.`);

  dbReconnectTimer = setTimeout(() => {
    dbReconnectTimer = null;
    void ensureDatabaseConnection("scheduled retry");
  }, MONGO_RETRY_INTERVAL_MS);

  if (typeof dbReconnectTimer.unref === "function") {
    dbReconnectTimer.unref();
  }
}

async function ensureDatabaseConnection(reason = "startup") {
  if (mongoose.connection.readyState === 1) {
    exitDegradedMode();
    return true;
  }

  if (dbConnectPromise) {
    return dbConnectPromise;
  }

  dbConnectPromise = (async () => {
    try {
      await connectDB({ verbose: reason === "startup" });
      exitDegradedMode();
      return true;
    } catch (err) {
      if (!ALLOW_START_WITHOUT_DB) {
        throw err;
      }

      scheduleDbReconnect(reason);
      return false;
    } finally {
      dbConnectPromise = null;
    }
  })();

  return dbConnectPromise;
}

mongoose.connection.on("connected", async () => {
  if (dbReconnectTimer) {
    clearTimeout(dbReconnectTimer);
    dbReconnectTimer = null;
  }
  exitDegradedMode();
  try {
    const db = mongoose.connection.db;
    if (db) {
      const indexes = await db.collection("users").indexes();
      if (indexes.some(idx => idx.name === "gmail_1")) {
        console.log("[SERVER] Dropping stale gmail_1 unique index from users collection...");
        await db.collection("users").dropIndex("gmail_1");
        console.log("[SERVER] Stale gmail_1 index dropped successfully");
      }
    }
      } catch (idxErr) {
    if (idxErr.message && idxErr.message.includes("index not found")) return;
    console.error("[SERVER] Index cleanup error:", idxErr.message);
  }

  // Ensure Follow collection unique index exists (prevents duplicate follows)
  try {
    const db = mongoose.connection.db;
    if (db) {
      const followsIndexes = await db.collection("follows").indexes();
      const hasUniqueIndex = followsIndexes.some(
        (idx) => idx.key?.follower === 1 && idx.key?.following === 1 && idx.unique === true
      );
      if (!hasUniqueIndex) {
        console.log("[SERVER] Creating unique compound index on follows collection...");
        await db.collection("follows").createIndex(
          { follower: 1, following: 1 },
          { unique: true, background: true }
        );
        console.log("[SERVER] Follows unique index created successfully.");
      }
    }
  } catch (idxErr) {
    console.error("[SERVER] Follow index sync error:", idxErr.message);
  }
});

mongoose.connection.on("disconnected", () => {
  if (ALLOW_START_WITHOUT_DB) {
    const dbStatus = getMongoConnectionStatus();
    if (!dbStatus.lastConnectedAt) {
      return;
    }
    scheduleDbReconnect("connection lost");
  }
});

async function startHttpServerWithFallback(preferredPort) {
  if (!ensurePortInRange(preferredPort)) {
    throw new Error(`Invalid PORT value: ${preferredPort}`);
  }

  for (let attempt = 0; attempt <= PORT_RETRIES; attempt++) {
    const candidatePort = preferredPort + attempt;
    if (!ensurePortInRange(candidatePort)) break;

    try {
      return await listenOnPort(candidatePort);
    } catch (err) {
      if (err.code === "EADDRINUSE") {
        console.warn(`[SERVER] Port ${candidatePort} is in use. Trying ${candidatePort + 1}...`);
        continue;
      }
      throw err;
    }
  }

  const maxTried = Math.min(65535, preferredPort + PORT_RETRIES);
  throw new Error(`No free port found in range ${preferredPort}-${maxTried}. Set PORT to a free port.`);
}

async function startServer() {
  try {
    if (ALLOW_START_WITHOUT_DB) {
    const { port } = await startHttpServerWithFallback(PORT);
    console.log(`Server running on port ${port}`);
    console.log(`Health check at http://localhost:${port}/health`);
    console.log("[SERVER] MongoDB fail-open mode is enabled. The server will keep retrying Atlas in the background.");
    void ensureDatabaseConnection("startup");

    mongoose.connection.once("connected", () => {
      console.log("[SERVER] MongoDB connected");
    });

    if (mongoose.connection.readyState === 1) {
      console.log("[SERVER] MongoDB already connected");
    }

    return;
    }

    await ensureDatabaseConnection("startup");
    const { port } = await startHttpServerWithFallback(PORT);
    console.log(`Server running on port ${port}`);
    console.log(`Health check at http://localhost:${port}/health`);

    if (mongoose.connection.readyState === 1) {
      console.log("[SERVER] MongoDB already connected");
    }
  } catch (err) {
    console.error("[SERVER] Startup failed:", err.message);
    process.exit(1);
  }
}

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

startServer();
