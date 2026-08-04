// Backfill: import every file currently in backend/uploads into MongoDB so images
// are persisted and keep serving even if the server disk is wiped on redeploy.
// Usage (on the server, inside backend/):  node scripts/backfill-uploads.js
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const Image = require(path.join(__dirname, "..", "models", "Image"));

const uploadDir = path.join(__dirname, "..", "uploads");

function guessContentType(f) {
  const e = path.extname(f).toLowerCase();
  const map = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };
  return map[e] || "application/octet-stream";
}

async function run() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("MONGO_URI not found in backend/.env");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log("Connected to MongoDB");

  if (!fs.existsSync(uploadDir)) {
    console.log("No uploads folder at " + uploadDir);
    process.exit(0);
  }

  const files = fs.readdirSync(uploadDir).filter((f) => !f.startsWith("."));
  let added = 0;
  let existing = 0;
  let failed = 0;

  for (const f of files) {
    const full = path.join(uploadDir, f);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;

    try {
      const found = await Image.findOne({ filename: f });
      if (found) {
        existing += 1;
        continue;
      }
      const data = fs.readFileSync(full);
      await Image.create({
        filename: f,
        contentType: guessContentType(f),
        size: data.length,
        data,
      });
      added += 1;
      console.log("Added " + f);
    } catch (err) {
      failed += 1;
      console.error("Failed " + f + ": " + err.message);
    }
  }

  console.log("\nDone. Added: " + added + ", already existed: " + existing + ", failed: " + failed);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});