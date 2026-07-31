const express = require("express");
const Article = require("../models/Article");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

const BG_COLORS = ["#c91f26", "#1565c0", "#2e7d32", "#ef6c00", "#6a1b9a"];

function getRandomBgColor() {
  return BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)];
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

router.get("/", async (req, res) => {
  try {
    const { category, subcategory, featured, breaking, limit = 50, page = 1, search } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (subcategory) filter.subcategory = subcategory;
    if (featured !== undefined) filter.featured = featured === "true";
    if (breaking !== undefined) filter.breaking = breaking === "true";

    const isAdmin = req.headers.authorization?.startsWith("Bearer ");
    if (!isAdmin) filter.published = true;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { excerpt: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Article.countDocuments(filter);
    const docs = await Article.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit));

    const news = docs.map(d => d.toJSON());

    res.json({ news, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    let article = await Article.findOne({ slug: req.params.slug });
    if (!article) {
      if (req.params.slug.match(/^[0-9a-fA-F]{24}$/)) {
        article = await Article.findById(req.params.slug);
      }
      if (!article) return res.status(404).json({ error: "Article not found" });
    }
    if (!article.published) {
      const isAdmin = req.headers.authorization?.startsWith("Bearer ");
      if (!isAdmin) return res.status(404).json({ error: "Article not found" });
    }
    res.json(article.toJSON());
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { title, titleEn, category, subcategory, content, excerpt, image, tags, featured, breaking, published, author, body, media, videoUrl, categoryMl, readTime, backgroundColor } = req.body;
    if (!title || !category || !content) {
      return res.status(400).json({ error: "title, category, and content are required" });
    }

    const slug = slugify(titleEn || title) + "-" + Date.now().toString(36);

    const article = await Article.create({
      slug,
      title,
      titleEn: titleEn || "",
      category,
      subcategory: subcategory || "",
      author: author || req.user.name,
      date: new Date().toISOString().split("T")[0],
      image: image || "/images/blog/1.jpg",
      excerpt: excerpt || content.slice(0, 120),
      content,
      body: body || [],
      tags: tags || [],
      featured: featured === true,
      breaking: breaking === true,
      published: published !== false,
      media: media || "standard",
      videoUrl: videoUrl || "",
      categoryMl: categoryMl || "",
      readTime: readTime || "3 മിനിറ്റ്",
      views: 0,
      comments: 0,
      backgroundColor: backgroundColor || getRandomBgColor(),
    });

    res.status(201).json(article.toJSON());
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { slug: req.params.id };
    const article = await Article.findOneAndUpdate(
      filter,
      { ...req.body, updatedAt: new Date().toISOString() },
      { new: true, runValidators: true }
    );
    if (!article) return res.status(404).json({ error: "Article not found" });
    res.json(article);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/view", async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { slug: req.params.id };
    const article = await Article.findOneAndUpdate(
      filter,
      { $inc: { views: 1 } },
      { new: true, select: "views slug" }
    );
    if (!article) return res.status(404).json({ error: "Article not found" });
    res.json({ views: article.views });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { slug: req.params.id };
    const article = await Article.findOneAndDelete(filter);
    if (!article) return res.status(404).json({ error: "Article not found" });
    res.json({ message: "Article deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
