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
    const existing = await Setting.findOne({ key: req.params.key });
    const update = { value: req.body.value };
    if (existing) {
      if (existing.label) update.label = existing.label;
      if (existing.type) update.type = existing.type;
      if (existing.options) update.options = existing.options;
    }
    const setting = await Setting.findOneAndUpdate(
      { key: req.params.key },
      update,
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
      { key: "footer_logo", value: "/images/footer%20logo.png", label: "Footer Logo", type: "image" },
      { key: "facebook_url", value: "https://www.facebook.com/malayalamithramonline/", label: "Facebook URL", type: "text" },
      { key: "youtube_url", value: "#", label: "Youtube URL", type: "text" },
      { key: "twitter_url", value: "#", label: "Twitter URL", type: "text" },
      { key: "instagram_url", value: "https://www.instagram.com/malayalamithram/", label: "Instagram URL", type: "text" },
      { key: "whatsapp_url", value: "https://chat.whatsapp.com/IU6daNIAJNiGmv84PDBpyc?s=cl&p=a&mlu=4", label: "WhatsApp URL", type: "text" },
      { key: "telegram_url", value: "https://t.me/+Q5U7RMWGuj-NNk4w", label: "Telegram URL", type: "text" },
      { key: "linkedin_url", value: "https://www.linkedin.com/in/malayalamithram-online-news-a929ba5a/", label: "LinkedIn URL", type: "text" },
      { key: "threads_url", value: "https://www.threads.com/@malayalamithram", label: "Threads URL", type: "text" },
      { key: "primary_color", value: "#bd1d25", label: "Primary Color", type: "color" },
      { key: "secondary_color", value: "#e6b313", label: "Secondary Color", type: "color" },
      { key: "articles_per_page", value: 20, label: "Articles Per Page", type: "number" },
      { key: "carousel_category_width", value: 5, label: "Carousel Category Badge Width (px)", type: "number" },
      { key: "banner_date_format", value: "malayalam", label: "Banner Date Format", type: "select", options: ["malayalam", "english"] },
      { key: "show_banner_date", value: true, label: "Show Current Date in Banner", type: "boolean" },
      { key: "banner_time_format", value: "24h", label: "Banner Time Format", type: "select", options: ["12h", "24h"] },
      { key: "show_calendar_strip", value: true, label: "Show Date Strip", type: "boolean" },
      { key: "date_display_order", value: "kollavarsham-hijri", label: "Date Display Order", type: "select", options: ["kollavarsham-hijri", "hijri-kollavarsham", "kollavarsham-only", "hijri-only"] },
      { key: "show_kollavarsham", value: true, label: "Show Malayalam Date", type: "boolean" },
      { key: "ml_show_weekday", value: true, label: "Malayalam: Show Weekday", type: "boolean" },
      { key: "ml_show_day", value: true, label: "Malayalam: Show Day", type: "boolean" },
      { key: "ml_show_month", value: true, label: "Malayalam: Show Month", type: "boolean" },
      { key: "ml_show_year", value: true, label: "Malayalam: Show Year", type: "boolean" },
      { key: "ml_day_override", value: 0, label: "Malayalam: Set Day", type: "number" },
      { key: "ml_date_override", value: "", label: "Edit Malayalam Date", type: "text" },
      { key: "show_hijri_date", value: true, label: "Show Arabic Date", type: "boolean" },
      { key: "hijri_show_weekday", value: true, label: "Arabic: Show Weekday", type: "boolean" },
      { key: "hijri_show_day", value: true, label: "Arabic: Show Day", type: "boolean" },
      { key: "hijri_show_month", value: true, label: "Arabic: Show Month", type: "boolean" },
      { key: "hijri_show_year", value: true, label: "Arabic: Show Year", type: "boolean" },
      { key: "hijri_day_override", value: 0, label: "Arabic: Set Day", type: "number" },
      { key: "hijri_month_lang", value: "malayalam", label: "Arabic: Month & Weekday Name Language", type: "select", options: ["malayalam", "arabic"] },
      { key: "hijri_date_override", value: "", label: "Edit Arabic Date", type: "text" },
      { key: "article_date_format", value: "malayalam", label: "Article Date Format", type: "select", options: ["malayalam", "english", "short"] },
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
