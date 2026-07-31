const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  label: { type: String, default: "" },
  type: { type: String, default: "text", enum: ["text", "textarea", "image", "color", "number", "boolean"] },
}, { timestamps: true });

module.exports = mongoose.model("Setting", settingSchema);
