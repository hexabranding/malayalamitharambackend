const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
  filename: { type: String, required: true, unique: true, index: true },
  contentType: { type: String, default: "application/octet-stream" },
  size: { type: Number, default: 0 },
  data: { type: Buffer, required: true },
  createdBy: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Image", imageSchema);