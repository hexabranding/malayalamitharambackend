const express = require("express");
const Article = require("../models/Article");
const { authMiddleware } = require("../middleware/auth");
const { slugifyEnglish, suggestNewsSlug, slugifyManglish, isCleanNewsSlug } = require("../utils/newsSlug");
const {
  normalizeLang,
  translateOne,
  translateMany,
  translateArticle,
} = require("../utils/translate");
const { warmArticle } = require("../utils/warmTranslations");

const router = express.Router();

// Returns articles rendered in `?lang=en` / `?lang=ar`. Translation is
// cached globally so each unique string is only ever paid for once.
async function withLang(docs, req, full) {
  const lang = normalizeLang(req.query.lang);
  if (!lang) return docs;
  return Promise.all(docs.map((doc) => translateArticle(doc, lang, { full })));
}

const BG_COLORS = ["#c91f26", "#1565c0", "#2e7d32", "#ef6c00", "#6a1b9a"];

function getRandomBgColor() {
  return BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)];
}

async function ensureUniqueSlug(baseSlug, excludeId) {
  let candidate = baseSlug;
  let counter = 2;
  while (true) {
    const existing = await Article.findOne({
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (!existing) return candidate;
    candidate = baseSlug + "-" + counter;
    counter++;
  }
}

async function findArticleBySlug(slugParam, isAdmin) {
  const filter = isAdmin ? {} : { published: true };

  let article = await Article.findOne({ ...filter, slug: slugParam });
  if (article) return article;

  article = await Article.findOne({ ...filter, legacySlugs: slugParam });
  if (article) return article;

  try {
    const decoded = decodeURIComponent(slugParam);
    if (decoded !== slugParam) {
      article = await Article.findOne({ ...filter, slug: decoded });
      if (article) return article;
      article = await Article.findOne({ ...filter, legacySlugs: decoded });
      if (article) return article;
    }
  } catch {}

  if (slugParam.match(/^[0-9a-fA-F]{24}$/)) {
    article = await Article.findById(slugParam);
    if (article) return article;
  }

  return null;
}

router.get("/", async (req, res) => {
  try {
    const { category, subcategory, featured, breaking, limit = 50, page = 1, search } = req.query;
    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const pg = Math.max(parseInt(page, 10) || 1, 1);

    const filter = {};
    if (subcategory) filter.subcategory = subcategory;
    if (featured !== undefined) filter.featured = featured === "true";
    if (breaking !== undefined) filter.breaking = breaking === "true";

    const isAdmin = req.headers.authorization?.startsWith("Bearer ");
    if (!isAdmin) filter.published = true;

    const orGroups = [];
    if (category) {
      const cats = String(category).split(",").map((s) => s.trim()).filter(Boolean);
      const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const makeRegexes = (arr) => arr.map((c) => new RegExp("^" + escapeRegExp(c) + "$", "i"));
      if (cats.length === 1) {
        const rx = new RegExp("^" + escapeRegExp(cats[0]) + "$", "i");
        orGroups.push({ $or: [{ category: rx }, { categories: rx }, { categoryMl: rx }] });
      } else if (cats.length > 1) {
        const regexes = makeRegexes(cats);
        orGroups.push({ $or: [{ category: { $in: regexes } }, { categories: { $in: regexes } }, { categoryMl: { $in: regexes } }] });
      }
    }
    if (search) {
      orGroups.push({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { excerpt: { $regex: search, $options: "i" } },
          { tags: { $regex: search, $options: "i" } },
        ],
      });
    }
    if (orGroups.length === 1) {
      filter.$or = orGroups[0].$or;
    } else if (orGroups.length > 1) {
      filter.$and = orGroups;
    }

    const total = await Article.countDocuments(filter);
    const docs = await Article.find(filter)
      .sort({ createdAt: -1 })
      .skip((pg - 1) * lim)
      .limit(lim)
      .lean({ virtuals: true });

    // lean virtuals already includes id = slug, but ensure id field exists for frontend
    const news = await withLang(docs.map((d) => ({ ...d, id: d.id || d.slug })), req, false);

    res.json({ news, total, page: pg, limit: lim });
  } catch (err) {
    console.error("GET /api/news error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/slug/:slug", async (req, res) => {
  try {
    const isAdmin = req.headers.authorization?.startsWith("Bearer ");
    const article = await findArticleBySlug(req.params.slug, isAdmin);
    if (!article) return res.status(404).json({ error: "Article not found" });
    if (!article.published && !isAdmin) return res.status(404).json({ error: "Article not found" });
    const [payload] = await withLang([article.toJSON()], req, true);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const isAdmin = req.headers.authorization?.startsWith("Bearer ");
    const article = await findArticleBySlug(req.params.slug, isAdmin);
    if (!article) return res.status(404).json({ error: "Article not found" });
    if (!article.published && !isAdmin) return res.status(404).json({ error: "Article not found" });

    const [payload] = await withLang([article.toJSON()], req, true);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

function sanitizeGallery(input) {
  if (!Array.isArray(input)) return [];
  return input.map((u) => String(u).trim()).filter(Boolean).slice(0, 30);
}

router.post("/translate", async (req, res) => {
  try {
    const lang = normalizeLang(req.body?.lang);
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    if (!lang) return res.status(400).json({ error: "Unsupported lang" });
    const translated = await translateOne(text, lang);
    res.json({ translated });
  } catch (err) {
    res.status(500).json({ error: "Translation failed" });
  }
});

router.post("/translate-batch", async (req, res) => {
  try {
    const lang = normalizeLang(req.body?.lang);
    const texts = Array.isArray(req.body?.texts) ? req.body.texts : [];
    if (!lang) return res.status(400).json({ error: "Unsupported lang" });
    const translations = await translateMany(texts, lang);
    res.json({ translations });
  } catch (err) {
    res.status(500).json({ error: "Translation failed" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { title, titleEn, slug: requestedSlug, category, categories, subcategory, content, excerpt, image, gallery, tags, featured, breaking, published, author, body, media, videoUrl, relatedVideos, categoryMl, readTime, backgroundColor, likes, views, mainNews, popular } = req.body;
    if (!title || !category || !content) {
      return res.status(400).json({ error: "title, category, and content are required" });
    }
    let baseSlug = slugifyEnglish(requestedSlug) || slugifyManglish(title, titleEn);
    if (!baseSlug || /^new-\d{8,}/.test(baseSlug) || baseSlug.includes("---")) {
      baseSlug = slugifyManglish(title, titleEn);
    }
    if (!baseSlug) return res.status(400).json({ error: "Enter a valid English slug or title" });
    const slug = await ensureUniqueSlug(baseSlug);
    const articleCategories = (categories && categories.length > 0) ? categories : [category];
    const cleanGallery = sanitizeGallery(gallery);

    const article = await Article.create({
      slug,
      engSlug: slug,
      title,
      titleEn: titleEn || "",
      category,
      categories: articleCategories,
      subcategory: subcategory || "",
      author: author || req.user.name,
      date: new Date().toISOString().split("T")[0],
      image: image || "/images/blog/1.jpg",
      gallery: cleanGallery,
      excerpt: excerpt || content.slice(0, 120),
      content,
      body: body || [],
      tags: tags || [],
      featured: featured === true,
      breaking: breaking === true,
      mainNews: mainNews === true,
      popular: popular === true,
      published: published !== false,
      media: media || "standard",
      videoUrl: videoUrl || "",
      relatedVideos: relatedVideos || [],
      categoryMl: categoryMl || "",
      readTime: readTime || "3 മിനിറ്റ്",
      views: views || 0,
      likes: likes || 0,
      comments: 0,
      backgroundColor: backgroundColor || getRandomBgColor(),
    });

    const payload = article.toJSON();
    // New articles have a cold translation cache: warm it in the background so
    // switching to English/Arabic right after publishing already shows them
    // translated.
    warmArticle(payload).catch(() => {});

    res.status(201).json(payload);
  } catch (err) {
    console.error("POST /api/news failed:", err);
    res.status(500).json({ error: "Failed to save news: " + (err.message || "unknown error") });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const filter = req.params.id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: req.params.id }
      : { slug: req.params.id };
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };
    // Ensure gallery is always a clean array if provided
    if (req.body.gallery !== undefined) {
      updateData.gallery = sanitizeGallery(req.body.gallery);
    }
    const existing = await Article.findOne(filter);
    if (!existing) return res.status(404).json({ error: "Article not found" });
    const requestedSlug = req.body.slug !== undefined ? req.body.slug : (req.body.engSlug || "");
    const shouldUpdateSlug = requestedSlug || req.body.titleEn || req.body.title;
    let computedLegacy = null;
    if (shouldUpdateSlug) {
      let baseSlug = slugifyEnglish(requestedSlug) || slugifyManglish(req.body.title || existing.title, req.body.titleEn || existing.titleEn);
      if (!baseSlug || /^new-\d{8,}/.test(baseSlug) || baseSlug.includes("---") || !isCleanNewsSlug(baseSlug)) {
        baseSlug = slugifyManglish(req.body.title || existing.title, req.body.titleEn || existing.titleEn);
      }
      if (!baseSlug) return res.status(400).json({ error: "An English title or valid slug is required" });
      const slug = await ensureUniqueSlug(baseSlug, existing._id);
      updateData.slug = slug;
      updateData.engSlug = slug;
      if (slug !== existing.slug) {
        computedLegacy = [...new Set([...(existing.legacySlugs || []), existing.slug].filter(Boolean))];
      }
    }
    delete updateData.legacySlugs;
    delete updateData.slugManuallyEdited;
    if (computedLegacy) updateData.legacySlugs = computedLegacy;
    const article = await Article.findOneAndUpdate(
      filter,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    if (!article) return res.status(404).json({ error: "Article not found" });
    // Edited text is new to the cache; re-warm it so the saved article shows
    // translated in every language.
    warmArticle(article.toJSON()).catch(() => {});
    res.json(article);
  } catch (err) {
    console.error("PUT /api/news failed:", err);
    res.status(500).json({ error: "Failed to update news: " + (err.message || "unknown error") });
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

router.post("/migrate-slugs", authMiddleware, async (req, res) => {
  try {
    const articles = await Article.find({});
    let updated = 0, skipped = 0;
    for (const article of articles) {
      let baseSlug = slugifyManglish(article.title, article.titleEn) || (isCleanNewsSlug(article.engSlug) ? article.engSlug : "");
      if (!baseSlug || /^new-\d{8,}/.test(baseSlug) || baseSlug.includes("---")) baseSlug = slugifyManglish(article.title, article.titleEn);
      if (!baseSlug) { skipped++; continue; }
      const isBad = /^new-\d{8,}/.test(article.slug) || article.slug.includes("---") || !isCleanNewsSlug(article.slug);
      const slug = await ensureUniqueSlug(baseSlug, article._id);
      if (slug !== article.slug || isBad) {
        await Article.updateOne({ _id: article._id }, { $set: { slug, engSlug: slug, legacySlugs: [...new Set([...(article.legacySlugs || []), article.slug].filter(Boolean))] } });
        updated++;
      }
    }
    res.json({ message: "Migration complete", updated, skipped, total: articles.length });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
