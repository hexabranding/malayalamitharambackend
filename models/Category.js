const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("Category", categorySchema);
