const mongoose = require("mongoose");

const articleSchema = new mongoose.Schema({
  slug: { type: String, unique: true, index: true },
  title: { type: String, required: true },
  titleEn: { type: String, default: "" },
  category: { type: String, required: true, index: true },
  subcategory: { type: String, default: "" },
  author: { type: String, default: "Staff Reporter" },
  date: { type: String },
  image: { type: String, default: "/images/blog/1.jpg" },
  excerpt: { type: String, default: "" },
  content: { type: String, default: "" },
  body: [{ type: String }],
  tags: [{ type: String }],
  featured: { type: Boolean, default: false, index: true },
  breaking: { type: Boolean, default: false, index: true },
  published: { type: Boolean, default: true, index: true },
  media: { type: String, default: "standard" },
  videoUrl: { type: String, default: "" },
  views: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  categoryMl: { type: String, default: "" },
  readTime: { type: String, default: "3 മിനിറ്റ്" },
  backgroundColor: { type: String, default: "#c91f26" },
}, { timestamps: true, toJSON: { virtuals: true } });

articleSchema.virtual("id").get(function () {
  return this.slug;
});

articleSchema.index({ title: "text", excerpt: "text", content: "text" });
articleSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Article", articleSchema);
