/**
 * Migration script to add 'approved' field to existing teacher records in admin collection
 * Run this once to update all existing teacher records
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const Admin = require("../database/models/Admin");

async function addApprovedField() {
  try {
    const mongoUrl = process.env.MONGO_URI;
    if (!mongoUrl) {
      throw new Error("MONGO_URI is required in backend/.env");
    }

    console.log("🔧 Connecting to MongoDB...");
    await mongoose.connect(mongoUrl);
    console.log("✅ Connected to MongoDB");

    // Find all teachers in admin collection that don't have the 'approved' field
    console.log("\n📌 Checking for teachers without 'approved' field...");
    const teachersWithoutApproved = await Admin.find({ approved: { $exists: false } });

    if (teachersWithoutApproved.length === 0) {
      console.log("✅ All teachers already have 'approved' field!");
      await mongoose.disconnect();
      return;
    }

    console.log(`⚠️  Found ${teachersWithoutApproved.length} teachers without 'approved' field`);
    teachersWithoutApproved.forEach((teacher, index) => {
      console.log(`   ${index + 1}. ${teacher.name} (${teacher.gmail})`);
    });

    // Update all teachers without 'approved' field to have approved: false
    console.log("\n🔄 Updating all teachers to add 'approved: false'...");
    const result = await Admin.updateMany(
      { approved: { $exists: false } },
      { $set: { approved: false } }
    );

    console.log(`✅ Updated ${result.modifiedCount} teacher records`);

    if (result.modifiedCount > 0) {
      console.log("\n📋 Updated teachers:");
      const updatedTeachers = await Admin.find({ role: "teacher" }).select(
        "name gmail approved"
      );
      updatedTeachers.forEach((teacher) => {
        console.log(`   ✓ ${teacher.name} (${teacher.gmail}) - approved: ${teacher.approved}`);
      });
    }

    console.log("\n✅ Migration complete! All teachers now have 'approved' field set to false");
    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

addApprovedField();
