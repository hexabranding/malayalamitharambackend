const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV !== "production" ? "malayalamithram_secret_2026_change_in_prod" : null);

function authMiddleware(req, res, next) {
  if (!JWT_SECRET) return res.status(503).json({ error: "Authentication is not configured" });
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
  }
}

module.exports = { authMiddleware, JWT_SECRET };
