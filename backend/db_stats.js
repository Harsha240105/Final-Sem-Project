const mongoose = require('mongoose');
const path = require('path');

// Load env
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://Data-NFT:Goku6126@cluster0.qbnsjzy.mongodb.net/web3connect?retryWrites=true&w=majority&appName=Cluster0";

async function getStats() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB\n");

    const collections = await mongoose.connection.db.listCollections().toArray();
    const stats = {};

    for (const coll of collections) {
      const count = await mongoose.connection.db.collection(coll.name).countDocuments();
      if (count > 0) {
        stats[coll.name] = count;
      }
    }

    console.log(JSON.stringify(stats, null, 2));
    await mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

getStats();
