const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const supabase = require("../config/supabase");

const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

const mapUser = (u) => ({
  id:        u.id,
  fullname:  u.fullname,
  email:     u.email,
  phone:     u.phone,
  nin:       u.nin,
  docType:   u.doc_type,
  state:     u.state,
  lga:       u.lga,
  area:      u.area,
  address:   u.address,
  zipcode:   u.zipcode,
  role:      u.role,
  status:    u.status,
  wallet:    u.wallet,
  createdAt: u.created_at,
});

const register = async (req, res, next) => {
  try {
    const { fullname, email, password, phone, nin, docType, state, lga, area, address, zipcode } = req.body;
    const { data: existing } = await supabase
      .from("users").select("id").eq("email", email.toLowerCase().trim()).single();
    if (existing) {
      return res.status(400).json({ success: false, message: "An account with this email already exists." });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const { data: user, error } = await supabase.from("users").insert({
      fullname: fullname.trim(),
      email: email.toLowerCase().trim(),
      password: passwordHash,
      phone: phone?.trim(),
      nin: nin?.trim(),
      doc_type: docType,
      state, lga,
      area: area?.trim(),
      address: address?.trim(),
      zipcode: zipcode?.trim(),
      role: "user",
      status: "pending",
      wallet: 0,
    }).select().single();
    if (error) return next(error);
    const token = signToken(user.id);
    res.status(201).json({
      success: true,
      message: "Account created! Your documents are under review.",
      token,
      user: mapUser(user),
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { data: user, error } = await supabase
      .from("users").select("*").eq("email", email.toLowerCase().trim()).single();
    if (error || !user) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }
    if (user.status === "rejected") {
      return res.status(403).json({ success: false, message: "Your account was rejected. Please contact support." });
    }
    if (user.status === "blocked") {
      return res.status(403).json({ success: false, message: "Your account has been blocked. Please contact support." });
    }
    const token = signToken(user.id);
    res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: mapUser(user),
    });
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from("users").select("*").eq("id", req.user.id).single();
    if (error || !user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    res.status(200).json({ success: true, user: mapUser(user) });
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { fullname, phone, state, lga, area, address, zipcode } = req.body;
    const updates = {};
    if (fullname) updates.fullname = fullname.trim();
    if (phone)    updates.phone    = phone.trim();
    if (state)    updates.state    = state;
    if (lga)      updates.lga      = lga;
    if (area)     updates.area     = area.trim();
    if (address)  updates.address  = address.trim();
    if (zipcode)  updates.zipcode  = zipcode.trim();
    const { data: user, error } = await supabase
      .from("users").update(updates).eq("id", req.user.id).select().single();
    if (error) return next(error);
    res.status(200).json({ success: true, message: "Profile updated.", user: mapUser(user) });
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Both passwords are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters." });
    }
    const { data: user } = await supabase
      .from("users").select("password").eq("id", req.user.id).single();
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password is incorrect." });
    }
    const newHash = await bcrypt.hash(newPassword, 12);
    await supabase.from("users").update({ password: newHash }).eq("id", req.user.id);
    res.status(200).json({ success: true, message: "Password changed successfully." });
  } catch (err) {
    next(err);
  }
};

const adminResetPassword = async (req, res, next) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) {
      return res.status(400).json({ success: false, message: "userId and newPassword are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }
    const newHash = await bcrypt.hash(newPassword, 12);
    await supabase.from("users").update({ password: newHash }).eq("id", userId);
    res.status(200).json({ success: true, message: "Password reset successfully." });
  } catch (err) {
    next(err);
  }
};

const logout = (req, res) => {
  res.status(200).json({ success: true, message: "Logged out successfully." });
};

module.exports = { register, login, getMe, updateProfile, changePassword, adminResetPassword, logout };