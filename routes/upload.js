const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { authMiddleware } = require("../middleware/auth");
const Image = require("../models/Image");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "uploads");
try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch {}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

function generateFilename(file) {
  const ext = path.extname(file.originalname) || ".jpg";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
}

router.post(
  "/image",
  authMiddleware,
  upload.single("image"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const filename = generateFilename(req.file);

    // Best-effort disk copy (kept for local/static compatibility).
    try {
      fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
    } catch {}

    // Persistent store in MongoDB so uploads survive redeploys.
    let storageOk = true;
    try {
      await Image.create({
        filename,
        contentType: req.file.mimetype,
        size: req.file.size,
        data: req.file.buffer,
      });
    } catch (err) {
      storageOk = false;
      console.error("Mongo image save failed:", err.message);
    }

    res.json({
      url: `/uploads/${filename}`,
      _storageOk: storageOk,
    });
  },
  (err, _req, res, _next) => {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large. Maximum size is 5 MB." });
    }
    res.status(400).json({ error: err.message || "Upload failed" });
  }
);

module.exports = router;