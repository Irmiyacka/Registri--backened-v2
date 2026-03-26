const rateLimit = require("express-rate-limit");

const errorHandler = (err, req, res, next) => {
  console.error("❌ Error:", err.message);
  if (err.code === "23505") {
    return res.status(400).json({ success: false, message: "An account with this email already exists." });
  }
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal server error.",
  });
};

const validate = (rules) => (req, res, next) => {
  const errors = [];
  for (const [field, checks] of Object.entries(rules)) {
    const value = req.body[field];
    if (checks.required && (!value || String(value).trim() === "")) {
      errors.push(`${field} is required`);
      continue;
    }
    if (value) {
      if (checks.minLength && value.length < checks.minLength) {
        errors.push(`${field} must be at least ${checks.minLength} characters`);
      }
      if (checks.maxLength && value.length > checks.maxLength) {
        errors.push(`${field} must not exceed ${checks.maxLength} characters`);
      }
      if (checks.isEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push(`${field} must be a valid email address`);
        }
      }
    }
  }
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0], errors });
  }
  next();
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many login attempts. Try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many registration attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { errorHandler, validate, loginLimiter, registerLimiter, generalLimiter };