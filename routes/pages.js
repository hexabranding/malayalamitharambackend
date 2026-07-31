const express = require("express");
const Page = require("../models/Page");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

function slugify(text) {
  return text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 60);
}

router.get("/", async (req, res) => {
  try {
    const pages = await Page.find().sort({ order: 1 });
    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const page = await Page.findOne({ slug: req.params.slug });
    if (!page) return res.status(404).json({ error: "Page not found" });
    res.json(page);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { title, titleMl, content, contentMl } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });
    const slug = slugify(title) + "-" + Date.now().toString(36);
    const page = await Page.create({ slug, title, titleMl, content, contentMl });
    res.status(201).json(page);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const page = await Page.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!page) return res.status(404).json({ error: "Page not found" });
    res.json(page);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const page = await Page.findByIdAndDelete(req.params.id);
    if (!page) return res.status(404).json({ error: "Page not found" });
    res.json({ message: "Page deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
