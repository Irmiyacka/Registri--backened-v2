const express = require("express");
const router  = express.Router();
const { registerDevice, getMyDevices, searchDevices, updateDeviceStatus,
  getAllDevices, approveDevice, rejectDevice, adminUpdateStatus } = require("../controllers/deviceController");
const { protect, adminOnly, activeOnly } = require("../middleware/auth");

router.get("/search",              searchDevices);
router.get("/my",                  protect, getMyDevices);
router.post("/",                   protect, activeOnly, registerDevice);
router.patch("/:id/status",        protect, updateDeviceStatus);
router.get("/all",                 protect, adminOnly, getAllDevices);
router.post("/:id/approve",        protect, adminOnly, approveDevice);
router.post("/:id/reject",         protect, adminOnly, rejectDevice);
router.patch("/:id/admin-status",  protect, adminOnly, adminUpdateStatus);

module.exports = router;