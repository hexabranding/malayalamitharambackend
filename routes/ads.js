const express = require("express");
const Ad = require("../models/Ad");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

const DEFAULT_SLOTS = [
  { slot: "top-leaderboard", label: "Top Leaderboard (728 x 90)", title: "പേജ് മുകൾ പരസ്യം" },
  { slot: "mid-leaderboard", label: "Mid Leaderboard (970 x 90)", title: "പേജ് നടുവിലെ പരസ്യം" },
  { slot: "bottom-leaderboard", label: "Bottom Leaderboard (728 x 90)", title: "പേജ് താഴെ പരസ്യം" },
  { slot: "sidebar", label: "Sidebar (300 x 250)", title: "സൈഡ് ബാർ പരസ്യം" },
  { slot: "category", label: "Category Page Ad", title: "വിഭാഗ പേജ് പരസ്യം" },
  { slot: "article", label: "In-Article Ad (300 x 250)", title: "ലേഖന പരസ്യം" },
  { slot: "search", label: "Search Page Ad", title: "തിരച്ചിൽ പേജ് പരസ്യം" },
  { slot: "tags", label: "Tags Page Ad", title: "ടാഗ് പേജ് പരസ്യം" },
  { slot: "media", label: "Media Page Ad", title: "മീഡിയ പേജ് പരസ്യം" },
  { slot: "page", label: "Info Page Ad", title: "ഇൻഫോ പേജ് പരസ്യം" },
];

router.get("/", async (_req, res) => {
  try {
    const ads = await Ad.find({ active: true }).sort({ slot: 1 });
    res.json(ads.map((a) => a.toJSON()));
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/all", authMiddleware, async (_req, res) => {
  try {
    const ads = await Ad.find().sort({ slot: 1 });
    res.json(ads.map((a) => a.toJSON()));
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/slots", async (_req, res) => {
  res.json(DEFAULT_SLOTS);
});

router.get("/:slot", async (req, res) => {
  try {
    const ad = await Ad.findOne({ slot: req.params.slot, active: true });
    if (!ad) return res.json(null);
    res.json(ad.toJSON());
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { slot, title, image, link, active, label } = req.body;
    if (!slot) return res.status(400).json({ error: "slot is required" });

    const ad = await Ad.findOneAndUpdate(
      { slot },
      {
        slot,
        title: title || "",
        image: image || "",
        link: link || "",
        active: active !== false,
        label: label || "",
      },
      { new: true, upsert: true, runValidators: true }
    );
    res.status(201).json(ad.toJSON());
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:slot", authMiddleware, async (req, res) => {
  try {
    const ad = await Ad.findOneAndUpdate(
      { slot: req.params.slot },
      { ...req.body, slot: req.params.slot },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(ad.toJSON());
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:slot", authMiddleware, async (req, res) => {
  try {
    const ad = await Ad.findOneAndDelete({ slot: req.params.slot });
    if (!ad) return res.status(404).json({ error: "Ad not found" });
    res.json({ message: "Ad deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
