/**
 * Cleanup Duplicate Certificates and Teachers
 *
 * Run: node scripts/cleanup-duplicates.js
 *
 * WHAT IT DOES:
 * 1. Removes duplicate Certificate documents (keeps oldest by issuedAt)
 * 2. Removes duplicate Teacher documents (keeps first created)
 * 3. Reports what was cleaned up
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const Certificate = require("../database/models/Certificate");
const Teacher = require("../database/models/Teacher");
const User = require("../database/models/User");

async function cleanupCertificates() {
  console.log("\n=== CLEANUP: Duplicate Certificates ===");

  const duplicates = await Certificate.aggregate([
    {
      $group: {
        _id: { userId: "$userId", communityId: "$communityId", taskId: "$taskId" },
        count: { $sum: 1 },
        docs: { $push: { _id: "$_id", issuedAt: "$issuedAt", certificateId: "$certificateId", tokenId: "$tokenId" } },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  console.log(`Found ${duplicates.length} duplicate groups`);

  let totalRemoved = 0;
  for (const group of duplicates) {
    const sorted = group.docs.sort((a, b) => new Date(a.issuedAt) - new Date(b.issuedAt));
    const keep = sorted[0];
    const remove = sorted.slice(1);

    console.log(`  Keeping: ${keep.certificateId} (tokenId: ${keep.tokenId}, issuedAt: ${keep.issuedAt})`);
    for (const dup of remove) {
      console.log(`  Removing duplicate: ${dup.certificateId} (tokenId: ${dup.tokenId}, issuedAt: ${dup.issuedAt})`);
      await Certificate.findByIdAndDelete(dup._id);
      totalRemoved++;
    }
  }

  console.log(`Total duplicate certificates removed: ${totalRemoved}`);
  return totalRemoved;
}

async function cleanupTeachers() {
  console.log("\n=== CLEANUP: Duplicate Teachers ===");

  const duplicates = await Teacher.aggregate([
    {
      $group: {
        _id: "$walletAddress",
        count: { $sum: 1 },
        docs: { $push: { _id: "$_id", name: "$name", createdAt: "$createdAt" } },
      },
    },
    { $match: { _id: { $ne: null }, count: { $gt: 1 } } },
  ]);

  console.log(`Found ${duplicates.length} duplicate wallet groups`);

  let totalRemoved = 0;
  for (const group of duplicates) {
    const sorted = group.docs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const keep = sorted[0];
    const remove = sorted.slice(1);

    console.log(`  Wallet: ${group._id}`);
    console.log(`  Keeping: ${keep.name} (ID: ${keep._id}, created: ${keep.createdAt})`);
    for (const dup of remove) {
      console.log(`  Removing duplicate: ${dup.name} (ID: ${dup._id}, created: ${dup.createdAt})`);
      await Teacher.findByIdAndDelete(dup._id);
      totalRemoved++;
    }
  }

  if (duplicates.length === 0) {
    console.log("No duplicate teachers found (by walletAddress)");
  }

  console.log(`Total duplicate teachers removed: ${totalRemoved}`);
  return totalRemoved;
}

async function cleanupDuplicateUserTeacherRecords() {
  console.log("\n=== CLEANUP: User records with same walletAddress ===");

  const duplicates = await User.aggregate([
    { $match: { role: "teacher", walletAddress: { $ne: null } } },
    {
      $group: {
        _id: "$walletAddress",
        count: { $sum: 1 },
        docs: { $push: { _id: "$_id", name: "$name", createdAt: "$createdAt" } },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  console.log(`Found ${duplicates.length} duplicate User wallet groups`);

  let totalRemoved = 0;
  for (const group of duplicates) {
    const sorted = group.docs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const keep = sorted[0];
    const remove = sorted.slice(1);

    console.log(`  Wallet: ${group._id}`);
    console.log(`  Keeping: ${keep.name} (ID: ${keep._id})`);
    for (const dup of remove) {
      console.log(`  Removing duplicate User: ${dup.name} (ID: ${dup._id})`);
      await User.findByIdAndDelete(dup._id);
      totalRemoved++;
    }
  }

  console.log(`Total duplicate user records removed: ${totalRemoved}`);
  return totalRemoved;
}

async function run() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB\n");

    const certRemoved = await cleanupCertificates();
    const teacherRemoved = await cleanupTeachers();
    const userRemoved = await cleanupDuplicateUserTeacherRecords();

    console.log("\n=== SUMMARY ===");
    console.log(`Certificates removed: ${certRemoved}`);
    console.log(`Duplicate teachers removed: ${teacherRemoved}`);
    console.log(`Duplicate user records removed: ${userRemoved}`);
    console.log("Cleanup complete!\n");
  } catch (err) {
    console.error("Cleanup failed:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
