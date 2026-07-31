const mongoose = require("mongoose");

const pageSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  titleMl: { type: String, default: "" },
  content: { type: String, default: "" },
  contentMl: { type: String, default: "" },
  published: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("Page", pageSchema);
