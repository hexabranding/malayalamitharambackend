const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["admin", "editor"], default: "admin" },
  name: { type: String, required: true },
}, { timestamps: true });

userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    username: this.username,
    name: this.name,
    role: this.role,
    email: this.email,
  };
};

module.exports = mongoose.model("User", userSchema);
