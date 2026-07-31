const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/malayalamithram";

async function connectDB() {
  try {
    const conn = await mongoose.connect(MONGO_URI, { tls: true });
    console.log("\n MongoDB connected: " + conn.connection.host);
    return conn;
  } catch (err) {
    console.error(" MongoDB connection error: " + err.message);
    console.log(" Retrying in 10s...");
    setTimeout(connectDB, 10000);
  }
}

module.exports = connectDB;
