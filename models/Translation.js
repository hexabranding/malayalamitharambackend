const mongoose = require("mongoose");

// Global text cache: every translated string is stored once, keyed by hash,
// so repeated values (category names, shared phrases) are never paid for twice.
const translationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    lang: { type: String, required: true },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Translation", translationSchema);
