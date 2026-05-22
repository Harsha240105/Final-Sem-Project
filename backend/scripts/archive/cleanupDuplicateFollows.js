const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), override: true });

const mongoose = require("mongoose");
const Follow = require("../database/models/Follow");

async function cleanupDuplicateFollows() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("[CLEANUP] Connected to MongoDB");

    const duplicates = await Follow.aggregate([
      {
        $group: {
          _id: { follower: "$follower", following: "$following" },
          count: { $sum: 1 },
          ids: { $push: "$_id" },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);

    if (duplicates.length === 0) {
      console.log("[CLEANUP] No duplicate follow records found.");
      await mongoose.disconnect();
      return;
    }

    let totalRemoved = 0;
    for (const dup of duplicates) {
      const [keep, ...remove] = dup.ids;
      const result = await Follow.deleteMany({ _id: { $in: remove } });
      totalRemoved += result.deletedCount;
      console.log(
        `[CLEANUP] Removed ${result.deletedCount} duplicate(s) for follower=${dup._id.follower} following=${dup._id.following}`
      );
    }

    console.log(`[CLEANUP] Total duplicate records removed: ${totalRemoved}`);

    await mongoose.disconnect();
    console.log("[CLEANUP] Done.");
  } catch (err) {
    console.error("[CLEANUP] Error:", err);
    process.exit(1);
  }
}

cleanupDuplicateFollows();
