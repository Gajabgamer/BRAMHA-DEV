const mongoose = require("mongoose");

async function connectDatabase(mongoUri) {
  if (!mongoUri) {
    throw new Error("Missing MONGO_URI from environment variables.");
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000
    });
    console.log("[movie24] MongoDB successfully connected.");
    return { connected: true, mode: "mongo" };
  } catch (error) {
    console.error(`[movie24] CRITICAL: MongoDB connection failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  connectDatabase
};
