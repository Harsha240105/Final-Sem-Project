/**
 * Cleanup script to remove old/duplicate teacher records from admin collection
 * This helps when a teacher deleted their account and wants to register again with the same email
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const Admin = require("../database/models/Admin");

async function cleanupDuplicateTeachers() {
  try {
    // Connect to MongoDB
    const mongoUrl = process.env.MONGO_URI;
    if (!mongoUrl) {
      throw new Error("MONGO_URI is required in backend/.env");
    }

    console.log("🔧 Connecting to MongoDB...");
    await mongoose.connect(mongoUrl);
    console.log("✅ Connected to MongoDB");

    // Get email to search for (you can modify this)
    const emailToCheck = process.argv[2];

    if (!emailToCheck) {
      console.log("\n📋 Usage: node cleanup-duplicate-teachers.js <email@example.com>\n");

      // Show all pending teachers
      console.log("📌 All pending teachers in admin collection:");
      const allTeachers = await Admin.find({ role: "teacher" })
        .select("name gmail role createdAt")
        .sort({ createdAt: -1 });

      if (allTeachers.length === 0) {
        console.log("   No teachers found in admin collection");
      } else {
        allTeachers.forEach((t, i) => {
          console.log(
            `   ${i + 1}. ${t.name} (${t.gmail}) - Created: ${t.createdAt}`
          );
        });
      }
    } else {
      // Check for existing record
      console.log(`\n🔍 Checking for existing record with email: ${emailToCheck}`);
      const existingRecord = await Admin.findOne({ gmail: emailToCheck });

      if (existingRecord) {
        console.log(`\n⚠️  Found existing record:`);
        console.log(`   ID: ${existingRecord._id}`);
        console.log(`   Name: ${existingRecord.name}`);
        console.log(`   Email: ${existingRecord.gmail}`);
        console.log(`   Role: ${existingRecord.role}`);
        console.log(`   Created: ${existingRecord.createdAt}`);

        // Ask for confirmation before deleting
        console.log(`\n❓ To delete this record, run:`);
        console.log(
          `   node cleanup-duplicate-teachers.js ${emailToCheck} --delete\n`
        );

        if (process.argv[3] === "--delete") {
          await Admin.deleteOne({ _id: existingRecord._id });
          console.log(`✅ Deleted the record. You can now register a new teacher with this email.\n`);
        }
      } else {
        console.log(`✅ No records found with this email. Registration should work!\n`);
      }
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

cleanupDuplicateTeachers();
