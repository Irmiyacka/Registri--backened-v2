const jwt = require("jsonwebtoken");
const supabase = require("../config/supabase");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Access denied. No token provided." });
    }
    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ success: false, message: "Session expired. Please login again." });
      }
      return res.status(401).json({ success: false, message: "Invalid token." });
    }
    const { data: user, error } = await supabase
      .from("users")
      .select("id, fullname, email, role, status, wallet")
      .eq("id", decoded.id)
      .single();
    if (error || !user) {
      return res.status(401).json({ success: false, message: "User no longer exists." });
    }
    if (user.status === "blocked") {
      return res.status(403).json({ success: false, message: "Your account has been blocked. Contact support." });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error during authentication." });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Access denied. Admins only." });
  }
  next();
};

const activeOnly = (req, res, next) => {
  if (req.user.status !== "active") {
    return res.status(403).json({ success: false, message: "Your account is pending verification." });
  }
  next();
};

module.exports = { protect, adminOnly, activeOnly };