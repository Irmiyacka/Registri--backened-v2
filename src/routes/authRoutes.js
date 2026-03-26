const express = require("express");
const router  = express.Router();
const { register, login, getMe, updateProfile, changePassword, adminResetPassword, logout } = require("../controllers/authController");
const { protect, adminOnly } = require("../middleware/auth");
const { validate, loginLimiter, registerLimiter } = require("../middleware/helpers");

router.post("/register", registerLimiter,
  validate({
    fullname: { required: true, minLength: 2 },
    email:    { required: true, isEmail: true },
    password: { required: true, minLength: 6 },
    phone:    { required: true },
    nin:      { required: true, minLength: 11, maxLength: 11 },
    state:    { required: true },
    lga:      { required: true },
  }),
  register
);

router.post("/login", loginLimiter,
  validate({
    email:    { required: true, isEmail: true },
    password: { required: true },
  }),
  login
);

router.get("/me",               protect, getMe);
router.post("/logout",          protect, logout);
router.patch("/update-profile", protect, updateProfile);
router.post("/change-password", protect, changePassword);
router.post("/reset-password",  protect, adminOnly, adminResetPassword);

module.exports = router;