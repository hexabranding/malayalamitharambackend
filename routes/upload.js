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
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No image uploaded",
        });
      }

      const filename = generateFilename(req.file);

      // Save to local disk as an optional cache.
      try {
        fs.writeFileSync(
          path.join(uploadDir, filename),
          req.file.buffer
        );
      } catch (diskErr) {
        console.warn(
          "Local disk image save failed:",
          diskErr.message
        );
      }

      // MongoDB is the persistent storage.
      try {
        await Image.create({
          filename,
          contentType: req.file.mimetype,
          size: req.file.size,
          data: req.file.buffer,
        });
      } catch (mongoErr) {
        console.error(
          "Mongo image save failed:",
          mongoErr
        );

        return res.status(500).json({
          error: "Image could not be saved to database",
          details:
            process.env.NODE_ENV === "production"
              ? undefined
              : mongoErr.message,
        });
      }

      return res.status(201).json({
        success: true,
        url: `/uploads/${filename}`,
      });

    } catch (err) {
      console.error("Upload failed:", err);

      return res.status(500).json({
        error: "Image upload failed",
        details:
          process.env.NODE_ENV === "production"
            ? undefined
            : err.message,
      });
    }
  },
  (err, _req, res, _next) => {
    console.error("Multer upload error:", err);

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File too large. Maximum size is 5 MB.",
      });
    }

    return res.status(400).json({
      error: err.message || "Upload failed",
    });
  }
);

module.exports = router;