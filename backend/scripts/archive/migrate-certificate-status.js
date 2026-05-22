#!/usr/bin/env node

/**
 * NFT Certificate Status Migration Script
 * 
 * Migrates existing certificate records to have the new status fields.
 * Run AFTER deploying the updated models but BEFORE restarting production.
 * 
 * Usage: node migrate-certificate-status.js
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const Student = require("../database/models/Student");
const User = require("../database/models/User");
const Teacher = require("../database/models/Teacher");

async function main() {
  try {
    console.log("🔄 Starting certificate status migration...\n");

    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI not set in .env");
    }

    console.log("📦 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected\n");

    // Migrate each model
    await migrateModel("Student", Student);
    await migrateModel("User", User);
    await migrateModel("Teacher", Teacher);

    console.log("\n✅ Migration complete!");
    console.log("📊 Summary:");
    console.log("   - Added status field to certificates without it");
    console.log("   - Set status='confirmed' for certificates with txHash");
    console.log("   - Set status='pending' for certificates without txHash");
    console.log("   - Preserved existing metadata and transactions");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

async function migrateModel(modelName, Model) {
  console.log(`\n📝 Migrating ${modelName} collection...`);

  try {
    // Find all documents with nftCertificates
    const documents = await Model.find({
      nftCertificates: { $exists: true, $ne: [] },
    }).select("_id name nftCertificates");

    console.log(`   Found ${documents.length} users with certificates`);

    let updated = 0;
    let needsStatus = 0;
    let alreadyHasStatus = 0;

    for (const doc of documents) {
      let docChanged = false;

      for (let i = 0; i < doc.nftCertificates.length; i++) {
        const cert = doc.nftCertificates[i];

        // Check if status field needs to be set
        if (!cert.status) {
          needsStatus++;

          // Determine status based on available data
          if (cert.txHash || cert.transactionHash) {
            cert.status = "confirmed";
            cert.mintedAt = cert.mintedAt || new Date();
          } else {
            cert.status = "pending";
          }

          // Ensure other fields exist
          cert.retryCount = cert.retryCount || 0;
          cert.issuedAt = cert.issuedAt || new Date();

          docChanged = true;
        } else {
          alreadyHasStatus++;
        }
      }

      if (docChanged) {
        await doc.save();
        updated++;
        console.log(`   ✓ ${doc.name} - updated ${doc.nftCertificates.length} certificates`);
      }
    }

    console.log(`\n   Summary for ${modelName}:`);
    console.log(`   - Documents updated: ${updated}`);
    console.log(`   - Certificates with new status: ${needsStatus}`);
    console.log(`   - Certificates already had status: ${alreadyHasStatus}`);
  } catch (err) {
    console.error(`   ❌ Error migrating ${modelName}:`, err.message);
    throw err;
  }
}

// Run migration
main();
