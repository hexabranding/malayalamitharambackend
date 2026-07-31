const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { authMiddleware, JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const user = await User.findOne({
      $or: [{ username }, { email: username }],
    });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token, user: user.toPublic() });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: user.toPublic() });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/logout", authMiddleware, (_req, res) => {
  res.json({ message: "Logged out successfully" });
});

module.exports = router;
