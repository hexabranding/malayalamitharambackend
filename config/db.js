const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;

async function connectDB() {
  try {
    const conn = await mongoose.connect(MONGO_URI);
    console.log("\n MongoDB connected: " + conn.connection.host + "/" + conn.connection.name);
    return conn;
  } catch (err) {
    console.error(" MongoDB connection error: " + err.message);
    console.log(" Retrying in 10s...");
    setTimeout(connectDB, 10000);
  }
}

module.exports = connectDB;
