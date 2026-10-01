const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  id: { type: String, default: "" },
  label: { type: String, required: true },
  slug: { type: String, required: true, unique: true, index: true },
  titleMl: { type: String, default: "" },
  parent: { type: String, default: null },
  count: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("Category", categorySchema);
