const express = require("express");
const Author = require("../models/Author");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const authors = await Author.find().sort({ count: -1 });
    res.json(authors);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, nameMl, role, roleMl, bio, photo, email } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const existing = await Author.findOne({ name });
    if (existing) return res.status(409).json({ error: "Author already exists" });
    const author = await Author.create({ name, nameMl, role, roleMl, bio, photo, email });
    res.status(201).json(author);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const author = await Author.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!author) return res.status(404).json({ error: "Author not found" });
    res.json(author);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const author = await Author.findByIdAndDelete(req.params.id);
    if (!author) return res.status(404).json({ error: "Author not found" });
    res.json({ message: "Author deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
