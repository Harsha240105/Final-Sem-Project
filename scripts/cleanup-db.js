/**
 * Database cleanup script — run once to remove stale/empty collections and self-follow records.
 *
 * Usage:
 *   1. Ensure MONGO_URI is set in backend/.env
 *   2. Run: node scripts/cleanup-db.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", "backend", ".env") });
const mongoose = require("mongoose");

async function cleanup() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI not found in backend/.env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log("Connected to:", db.databaseName);

  // 1. Remove self-follow records
  const followsCol = db.collection("follows");
  const selfFollows = await followsCol
    .aggregate([
      { $addFields: { followerStr: { $toString: "$follower" }, followingStr: { $toString: "$following" } } },
      { $match: { $expr: { $eq: ["$followerStr", "$followingStr"] } } },
    ])
    .toArray();

  if (selfFollows.length > 0) {
    const ids = selfFollows.map((d) => d._id);
    await followsCol.deleteMany({ _id: { $in: ids } });
    console.log(`Removed ${ids.length} self-follow record(s)`);
  } else {
    console.log("No self-follow records found.");
  }

  // 2. Drop empty collections (0 documents AND 0 indexes beyond _id)
  const EMPTY_OK = new Set([
    "teachers", "admin", "servermessages", "marketplaces", "nftcertificates",
  ]);
  const cols = await db.listCollections().toArray();
  for (const col of cols) {
    const name = col.name;
    if (!EMPTY_OK.has(name)) continue;
    const count = await db.collection(name).countDocuments();
    if (count > 0) continue;
    await db.collection(name).drop();
    console.log(`Dropped empty collection: ${name}`);
  }

  // 3. Clean stale nonces (older than 24 hours)
  const noncesCol = db.collection("nonces");
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const staleNonces = await noncesCol.deleteMany({ createdAt: { $lt: cutoff } });
  if (staleNonces.deletedCount > 0) {
    console.log(`Cleaned ${staleNonces.deletedCount} stale nonce(s)`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

cleanup().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
