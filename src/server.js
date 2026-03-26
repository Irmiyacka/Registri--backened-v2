require("dotenv").config();
const express = require("express");

const authRoutes   = require("./routes/authRoutes");
const userRoutes   = require("./routes/userRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const walletRoutes = require("./routes/walletRoutes");

const { errorHandler } = require("./middleware/helpers");

const app  = express();
const PORT = process.env.PORT || 3000;

// CORS — allow all origins
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🛡️ Registri API is running",
    version: "1.0.0",
  });
});

app.use("/api/auth",    authRoutes);
app.use("/api/users",   userRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/wallet",  walletRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found.`,
  });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅ Registri API running on port ${PORT}`);
});

module.exports = app;