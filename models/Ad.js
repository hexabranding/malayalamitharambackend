const mongoose = require("mongoose");

const adSchema = new mongoose.Schema({
  slot: { type: String, required: true, unique: true, index: true },
  title: { type: String, default: "" },
  image: { type: String, default: "" },
  link: { type: String, default: "" },
  active: { type: Boolean, default: true },
  label: { type: String, default: "" },
}, { timestamps: true, toJSON: { virtuals: true } });

adSchema.virtual("id").get(function () {
  return this._id.toString();
});

module.exports = mongoose.model("Ad", adSchema);
