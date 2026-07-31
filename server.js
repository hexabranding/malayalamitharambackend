require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth");
const newsRoutes = require("./routes/news");
const categoriesRoutes = require("./routes/categories");
const tagsRoutes = require("./routes/tags");
const pagesRoutes = require("./routes/pages");
const authorsRoutes = require("./routes/authors");
const settingsRoutes = require("./routes/settings");
const adsRoutes = require("./routes/ads");
const uploadRoutes = require("./routes/upload");

const app = express();
const PORT = process.env.PORT || 4000;

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }
    const allowed = [
      FRONTEND_URL,
      process.env.ALLOWED_ORIGIN,
      "https://demo.malayalamitharam.in",
      "https://malayalamitharam.in",
    ].filter(Boolean);
    if (allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/tags", tagsRoutes);
app.use("/api/pages", pagesRoutes);
app.use("/api/authors", authorsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/ads", adsRoutes);
app.use("/api/upload", uploadRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "Malayalamithram API", timestamp: new Date().toISOString() });
});

const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.use((_req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

connectDB().then(async () => {
  try {
    const bcrypt = require("bcryptjs");
    const User = require("./models/User");
    const userExists = await User.findOne({ username: "admin" });
    if (!userExists) {
      const passwordHash = await bcrypt.hash("Admin@123", 10);
      await User.create({
        username: "admin",
        email: "admin@malayalamithram.in",
        passwordHash,
        role: "admin",
        name: "Malayalamithram Admin",
      });
      console.log("Default admin user created (admin / Admin@123)");
    }
  } catch (e) {
    console.log("Auto-seed skipped:", e.message);
  }

  app.listen(PORT, () => {
    console.log(`\n Malayalamithram Backend running on http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health\n`);
  });
});
