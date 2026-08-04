const express = require("express");
const Ad = require("../models/Ad");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

const DEFAULT_SLOTS = [
  { slot: "article-top", label: "Article Top Ad (728 x 90)", title: "ലേഖനത്തിന് മുകളിലെ പരസ്യം" },
  { slot: "top-leaderboard", label: "Top Leaderboard (728 x 90)", title: "പേജ് മുകൾ പരസ്യം" },
  { slot: "mid-leaderboard", label: "Mid Leaderboard (970 x 90)", title: "പേജ് നടുവിലെ പരസ്യം" },
  { slot: "bottom-leaderboard", label: "Bottom Leaderboard (728 x 90)", title: "പേജ് താഴെ പരസ്യം" },
  { slot: "sidebar", label: "Sidebar (300 x 250)", title: "സൈഡ് ബാർ പരസ്യം" },
  { slot: "category", label: "Category Page Ad", title: "വിഭാഗ പേജ് പരസ്യം" },
  { slot: "article-part-1", label: "In-Article Ad 1 (300 x 250)", title: "ലേഖന പരസ്യം ഭാഗം 1" },
  { slot: "article-part-2", label: "In-Article Ad 2 (300 x 250)", title: "ലേഖന പരസ്യം ഭാഗം 2" },
  { slot: "article-part-3", label: "In-Article Ad 3 (300 x 250)", title: "ലേഖന പരസ്യം ഭാഗം 3" },
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

router.get("/batch", async (req, res) => {
  try {
    const slotsParam = req.query.slots;
    if (!slotsParam) return res.status(400).json({ error: "slots query param is required" });
    const slots = slotsParam.split(",");
    const ads = await Ad.find({ slot: { $in: slots }, active: true });
    const adsMap = {};
    ads.forEach(a => {
      if (!adsMap[a.slot]) adsMap[a.slot] = [];
      adsMap[a.slot].push(a.toJSON());
    });
    res.json(adsMap);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { slot, title, image, link, active, label } = req.body;
    if (!slot) return res.status(400).json({ error: "slot is required" });

    const ad = new Ad({
      slot,
      title: title || "",
      image: image || "",
      link: link || "",
      active: active !== false,
      label: label || "",
    });
    await ad.save();
    res.status(201).json(ad.toJSON());
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "An ad for this slot already exists. Delete it first or use a different slot." });
    }
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const ad = await Ad.findByIdAndUpdate(
      req.params.id,
      { ...req.body, _id: req.params.id },
      { new: true, runValidators: true }
    );
    if (!ad) return res.status(404).json({ error: "Ad not found" });
    res.json(ad.toJSON());
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const ad = await Ad.findByIdAndDelete(req.params.id);
    if (!ad) return res.status(404).json({ error: "Ad not found" });
    res.json({ message: "Ad deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
