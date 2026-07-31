const express = require("express");
const Category = require("../models/Category");
const Article = require("../models/Article");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const categories = await Category.find().sort({ slug: 1 }).lean();
    const withCounts = await Promise.all(
      categories.map(async (cat) => ({
        ...cat,
        count: await Article.countDocuments({ category: cat.id, published: true }),
      }))
    );
    res.json(withCounts);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { id, label, slug } = req.body;
    if (!id || !label || !slug) {
      return res.status(400).json({ error: "id, label, and slug are required" });
    }
    const existing = await Category.findOne({ $or: [{ id }, { slug }] });
    if (existing) {
      return res.status(409).json({ error: "Category already exists" });
    }
    const cat = await Category.create({ id, label, slug });
    res.status(201).json(cat);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const cat = await Category.findOneAndUpdate(
      { id: req.params.id },
      { ...req.body },
      { new: true, runValidators: true }
    );
    if (!cat) return res.status(404).json({ error: "Category not found" });
    res.json(cat);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const cat = await Category.findOneAndDelete({ id: req.params.id });
    if (!cat) return res.status(404).json({ error: "Category not found" });
    res.json({ message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
