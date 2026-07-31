const mongoose = require("mongoose");

const authorSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  nameMl: { type: String, default: "" },
  role: { type: String, default: "Reporter" },
  roleMl: { type: String, default: "" },
  bio: { type: String, default: "" },
  photo: { type: String, default: "" },
  email: { type: String, default: "" },
  count: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("Author", authorSchema);
