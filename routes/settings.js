const express = require("express");
const Setting = require("../models/Setting");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const settings = await Setting.find().sort({ key: 1 });
    const obj = {};
    settings.forEach(s => { obj[s.key] = s.value; });
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/all", async (req, res) => {
  try {
    const settings = await Setting.find().sort({ key: 1 });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:key", authMiddleware, async (req, res) => {
  try {
    const setting = await Setting.findOneAndUpdate(
      { key: req.params.key },
      { value: req.body.value },
      { new: true, upsert: true }
    );
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/seed", authMiddleware, async (req, res) => {
  try {
    const defaults = [
      { key: "site_name", value: "Malayalamithram", label: "Site Name", type: "text" },
      { key: "site_tagline", value: "മലയാളികളുടെ വാർത്താ കൂട്ടുകാരൻ", label: "Tagline", type: "text" },
      { key: "site_logo", value: "/images/malayalamithram-logo.png", label: "Logo URL", type: "image" },
      { key: "site_banner", value: "/images/malayala-mitra-banner.jpeg", label: "Banner URL", type: "image" },
      { key: "facebook_url", value: "#", label: "Facebook URL", type: "text" },
      { key: "youtube_url", value: "#", label: "Youtube URL", type: "text" },
      { key: "twitter_url", value: "#", label: "Twitter URL", type: "text" },
      { key: "instagram_url", value: "#", label: "Instagram URL", type: "text" },
      { key: "primary_color", value: "#bd1d25", label: "Primary Color", type: "color" },
      { key: "secondary_color", value: "#e6b313", label: "Secondary Color", type: "color" },
      { key: "articles_per_page", value: 20, label: "Articles Per Page", type: "number" },
    ];
    for (const d of defaults) {
      await Setting.findOneAndUpdate({ key: d.key }, d, { upsert: true, new: true });
    }
    res.json({ message: "Settings seeded" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
