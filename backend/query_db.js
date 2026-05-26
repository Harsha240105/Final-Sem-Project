// Use backend's own modules
const mongoose = require('mongoose');

async function getStats() {
  try {
    const admin = mongoose.connection.db.admin();
    const dbInfo = await admin.serverStatus();
    console.log("MongoDB version:", dbInfo.version);
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    const results = {};

    for (const coll of collections) {
      const name = coll.name;
      const count = await mongoose.connection.db.collection(name).countDocuments();
      if (count > 0) {
        results[name] = count;
      }
    }

    console.log("\n=== COLLECTION COUNTS ===");
    console.log(JSON.stringify(results, null, 2));

    // Get sample communities
    if (results.communities) {
      const comms = await mongoose.connection.db.collection('communities').find().limit(5).toArray();
      console.log("\n=== SAMPLE COMMUNITIES ===");
      comms.forEach(c => {
        console.log(`- ${c.name} (type: ${c.communityType || 'N/A'}, members: ${c.members?.length || 0}, tasks: ${c.tasks?.length || 0})`);
      });
    }

    // Get sample certificates
    if (results.certificates) {
      const certs = await mongoose.connection.db.collection('certificates').find().limit(3).toArray();
      console.log("\n=== SAMPLE CERTIFICATES ===");
      certs.forEach(c => {
        console.log(`- Token #${c.tokenId} community: ${c.communityId} status: ${c.status}`);
      });
    }

    // Get users by role
    const adminCount = await mongoose.connection.db.collection('admin_users').countDocuments();
    const teacherCount = await mongoose.connection.db.collection('teachers').countDocuments();
    const studentCount = await mongoose.connection.db.collection('students').countDocuments();
    const userCount = await mongoose.connection.db.collection('users').countDocuments();
    console.log(`\n=== USER BREAKDOWN ===`);
    console.log(`Users: ${userCount}, Students: ${studentCount}, Teachers: ${teacherCount}, Admins: ${adminCount}`);

    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

// Wait for mongoose connection then query
if (mongoose.connection.readyState === 1) {
  getStats();
} else {
  mongoose.connection.once('connected', getStats);
}
